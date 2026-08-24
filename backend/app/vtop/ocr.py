"""
Captcha OCR for VTOP's image captcha.

Mirrors StudentCC's strategy: try the image several ways and take the first
result that looks like a plausible captcha. StudentCC uses ML Kit; we use
Tesseract, so the preprocessing differs slightly, but the variant ladder and the
acceptance rule (3-8 alphanumeric characters) are the same.

The OCR guess is only ever a *suggestion* — the caller shows the image to the
user so they can correct it. Never treat a guess as authoritative.
"""

from __future__ import annotations

import base64
import io
import logging
from typing import Callable, List, Optional

from PIL import Image, ImageEnhance, ImageFilter

try:
    import pytesseract
except ImportError:  # pragma: no cover - optional dependency
    pytesseract = None  # type: ignore[assignment]

logger = logging.getLogger("vtop.ocr")

_WHITELIST = (
    "ABCDEFGHIJKLMNOPQRSTUVWXYZ" "abcdefghijklmnopqrstuvwxyz" "0123456789"
)
_MIN_LEN = 3
_MAX_LEN = 8


def _clean(text: str) -> str:
    return "".join(ch for ch in text if ch.isalnum())


def _is_plausible(text: str) -> bool:
    return _MIN_LEN <= len(text) <= _MAX_LEN and text.isalnum()


def _ocr(image: Image.Image, psm: int) -> str:
    if pytesseract is None:
        return ""
    config = f"--psm {psm} -c tessedit_char_whitelist={_WHITELIST}"
    try:
        return _clean(pytesseract.image_to_string(image, config=config).strip())
    except Exception as exc:  # pragma: no cover - tesseract missing/broken
        logger.warning("[OCR] Tesseract failed: %s", exc)
        return ""


# -- image variants ---------------------------------------------------------


def _variant_sharpened(img: Image.Image) -> Image.Image:
    """Grayscale, contrast-boosted, upscaled, sharpened, then binarised."""
    gray = img.convert("L")
    enhanced = ImageEnhance.Contrast(gray).enhance(2.5)
    width, height = enhanced.size
    scaled = enhanced.resize((width * 3, height * 3), Image.Resampling.LANCZOS)
    sharp = scaled.filter(ImageFilter.SHARPEN)
    return sharp.point(lambda p: 255 if p > 140 else 0)


def _variant_contrast(img: Image.Image) -> Image.Image:
    """StudentCC's contrast boost: (c - 128) * 2 + 128, clamped per channel."""
    rgb = img.convert("RGB")
    return rgb.point(lambda c: max(0, min(255, (c - 128) * 2 + 128)))


def _variant_grayscale(img: Image.Image) -> Image.Image:
    return img.convert("L")


def _variant_inverted(img: Image.Image) -> Image.Image:
    """255 - c. VTOP captchas are sometimes light-on-dark."""
    return img.convert("L").point(lambda c: 255 - c)


_VARIANTS: List[tuple[str, Callable[[Image.Image], Image.Image], int]] = [
    ("sharpened", _variant_sharpened, 8),
    ("contrast", _variant_contrast, 8),
    ("grayscale", _variant_grayscale, 7),
    ("inverted", _variant_inverted, 8),
]


def solve_captcha_bytes(image_bytes: bytes) -> Optional[str]:
    """
    Best-effort captcha read. Returns None when nothing plausible was found,
    so callers can distinguish "no guess" from "guessed an empty string".
    """
    if pytesseract is None:
        logger.info("[OCR] pytesseract unavailable; skipping captcha pre-solve")
        return None

    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.load()
    except Exception as exc:
        logger.error("[OCR] Could not open captcha image: %s", exc)
        return None

    for name, transform, psm in _VARIANTS:
        try:
            candidate = _ocr(transform(img), psm)
        except Exception as exc:
            logger.debug("[OCR] Variant %s failed: %s", name, exc)
            continue
        if _is_plausible(candidate):
            logger.info("[OCR] Captcha solved via '%s' variant", name)
            return candidate

    logger.info("[OCR] No plausible captcha reading; user must type it manually")
    return None


def solve_captcha_b64(b64_str: str) -> Optional[str]:
    """Convenience wrapper accepting a raw or data-URL base64 string."""
    if "base64," in b64_str:
        b64_str = b64_str.split("base64,", 1)[1]
    elif "," in b64_str:
        b64_str = b64_str.split(",", 1)[1]
    try:
        raw = base64.b64decode(b64_str)
    except Exception as exc:
        logger.error("[OCR] Bad base64 captcha payload: %s", exc)
        return None
    return solve_captcha_bytes(raw)
