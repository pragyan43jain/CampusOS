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
import shutil
from typing import Callable, List, Optional

from PIL import Image, ImageEnhance, ImageFilter

try:
    import pytesseract
except ImportError:  # pragma: no cover - optional dependency
    pytesseract = None  # type: ignore[assignment]

_TESSERACT_AVAILABLE = bool(pytesseract is not None and shutil.which("tesseract"))


def is_ocr_available() -> bool:
    """True when pytesseract and the tesseract binary are present."""
    return _TESSERACT_AVAILABLE

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
    if not _TESSERACT_AVAILABLE or pytesseract is None:
        return ""
    config = f"--psm {psm} -c tessedit_char_whitelist={_WHITELIST}"
    try:
        return _clean(pytesseract.image_to_string(image, config=config, timeout=3).strip())
    except Exception as exc:  # pragma: no cover - tesseract missing/broken/timeout
        logger.debug("[OCR] Tesseract skipped or timed out: %s", exc)
        return ""


# -- image variants ---------------------------------------------------------


def _variant_scaled_gray(img: Image.Image) -> Image.Image:
    gray = img.convert("L")
    return gray.resize((img.width * 3, img.height * 3), Image.Resampling.LANCZOS)


def _variant_contrast(img: Image.Image) -> Image.Image:
    gray = img.convert("L")
    enh = ImageEnhance.Contrast(gray).enhance(1.8)
    return enh.resize((img.width * 3, img.height * 3), Image.Resampling.LANCZOS)


def _variant_sharpened(img: Image.Image) -> Image.Image:
    gray = img.convert("L")
    scaled = gray.resize((img.width * 3, img.height * 3), Image.Resampling.LANCZOS)
    return scaled.filter(ImageFilter.SHARPEN)


def _variant_inverted(img: Image.Image) -> Image.Image:
    gray = img.convert("L")
    return gray.point(lambda c: 255 - c).resize(
        (img.width * 3, img.height * 3), Image.Resampling.LANCZOS
    )


_VARIANTS: List[tuple[str, Callable[[Image.Image], Image.Image]]] = [
    ("scaled_gray", _variant_scaled_gray),
    ("contrast", _variant_contrast),
    ("sharpened", _variant_sharpened),
    ("inverted", _variant_inverted),
]

_PSM_MODES = [8, 7, 6]


def solve_captcha_bytes(image_bytes: bytes) -> Optional[str]:
    """
    High-accuracy captcha reader for VTOP captchas (which are 6 alphanumeric characters).
    Prioritizes exact 6-character results across preprocessing pipelines.
    Safe against missing tesseract binary in serverless runtimes.
    """
    if not _TESSERACT_AVAILABLE:
        logger.info("[OCR] Tesseract binary unavailable in runtime; user will enter captcha manually")
        return None

    try:
        img = Image.open(io.BytesIO(image_bytes))
        img.load()
    except Exception as exc:
        logger.error("[OCR] Could not open captcha image: %s", exc)
        return None

    fallback_candidates: List[str] = []

    for name, transform in _VARIANTS:
        try:
            processed = transform(img)
        except Exception as exc:
            logger.debug("[OCR] Transform %s failed: %s", name, exc)
            continue

        for psm in _PSM_MODES:
            try:
                candidate = _ocr(processed, psm)
            except Exception as exc:
                logger.debug("[OCR] Variant %s psm %d failed: %s", name, psm, exc)
                continue

            if len(candidate) == 6 and candidate.isalnum():
                logger.info("[OCR] Captcha solved (exact 6 chars) via '%s' (psm %d): %s", name, psm, candidate)
                return candidate
            if 5 <= len(candidate) <= 7 and candidate.isalnum():
                fallback_candidates.append(candidate)

    if fallback_candidates:
        best = fallback_candidates[0]
        logger.info("[OCR] Captcha fallback candidate chosen: %s", best)
        return best

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
