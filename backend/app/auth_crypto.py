"""
CampusOS Cryptographic Authentication & Session Token Module.

Provides tamper-proof, HMAC-SHA256 signed session tokens and token verification.
Guarantees that student identity cannot be forged or self-asserted by unauthenticated callers.
"""

from __future__ import annotations

import base64
import hashlib
import hmac
import json
import logging
import os
import secrets
import time
import tempfile
from typing import Any, Dict, Optional

logger = logging.getLogger("campusos.auth_crypto")

_CACHED_SECRET: Optional[str] = None


def get_auth_secret() -> str:
    """
    Retrieve or initialize the cryptographic secret key used for session token signing.
    Prioritizes:
    1. Environment variable CAMPUSOS_SESSION_SECRET
    2. Environment variable CAMPUSOS_ADMIN_KEY
    3. Persistent secret file on disk (.session_secret or /tmp/.campusos_session_secret)
    """
    global _CACHED_SECRET
    if _CACHED_SECRET:
        return _CACHED_SECRET

    env_secret = (
        os.environ.get("CAMPUSOS_SESSION_SECRET")
        or os.environ.get("CAMPUSOS_ADMIN_KEY")
        or os.environ.get("SECRET_KEY")
    )
    if env_secret and env_secret.strip():
        _CACHED_SECRET = env_secret.strip()
        return _CACHED_SECRET

    # Stateless workers must share an operator-configured, private signing key.
    if os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"):
        raise RuntimeError("Set CAMPUSOS_SESSION_SECRET for serverless authentication")

    from app.storage import DATA_DIR
    candidate_paths = [
        os.path.join(DATA_DIR, ".session_secret"),
        os.path.join("/tmp", ".campusos_session_secret"),
    ]
    for secret_file in candidate_paths:
        try:
            if os.path.exists(secret_file):
                with open(secret_file, "r", encoding="utf-8") as f:
                    content = f.read().strip()
                    if content:
                        _CACHED_SECRET = content
                        return _CACHED_SECRET

            parent = os.path.dirname(secret_file)
            if parent:
                os.makedirs(parent, exist_ok=True)
            # Publish a complete key atomically so concurrent workers agree.
            with tempfile.NamedTemporaryFile(mode="w", dir=parent, delete=False) as f:
                temporary_path = f.name
                f.write(secrets.token_hex(32))
            try:
                try:
                    os.link(temporary_path, secret_file)
                except FileExistsError:
                    pass  # Another worker published the shared key first.
                with open(secret_file, "r", encoding="utf-8") as f:
                    _CACHED_SECRET = f.read().strip()
                if _CACHED_SECRET:
                    return _CACHED_SECRET
            finally:
                os.unlink(temporary_path)
        except Exception as exc:
            logger.debug("[AuthCrypto] Could not use %s: %s", secret_file, exc)
            continue

    raise RuntimeError("Cannot persist a session signing key; set CAMPUSOS_SESSION_SECRET")


def generate_signed_session_token(
    reg_no: str,
    ttl_seconds: int = 7 * 86400,
    session_uid: Optional[str] = None,
    extra: Optional[Dict[str, Any]] = None,
) -> str:
    """
    Generate an HMAC-SHA256 cryptographically signed session token for a verified student.
    Format: cos_<urlsafe_b64_payload>.<hmac_signature>
    """
    clean_reg = reg_no.strip().upper()
    now = int(time.time())
    payload = {
        "reg": clean_reg,
        "sid": session_uid or secrets.token_hex(16),
        "iat": now,
        "exp": now + ttl_seconds,
        "nonce": secrets.token_hex(8),
    }
    if extra:
        payload["ext"] = extra

    payload_json = json.dumps(payload, separators=(",", ":"))
    payload_b64 = base64.urlsafe_b64encode(payload_json.encode("utf-8")).decode("utf-8").rstrip("=")

    secret = get_auth_secret()
    signature = hmac.new(
        secret.encode("utf-8"),
        payload_b64.encode("utf-8"),
        hashlib.sha256,
    ).hexdigest()

    return f"cos_{payload_b64}.{signature}"


def verify_session_token(token: Optional[str]) -> Optional[str]:
    """
    Validate the session token's cryptographic signature, expiration, and format.
    Returns the verified student registration number if valid; otherwise None.
    """
    if not token or not isinstance(token, str):
        return None

    raw_token = token.strip()
    if raw_token.lower().startswith("bearer "):
        raw_token = raw_token[7:].strip()

    # 1. Process standard signed token: cos_<b64>.<sig>
    if raw_token.startswith("cos_"):
        parts = raw_token[4:].split(".")
        if len(parts) != 2:
            logger.warning("[AuthCrypto] Malformed signed token structure")
            return None

        payload_b64, provided_sig = parts
        secret = get_auth_secret()
        expected_sig = hmac.new(
            secret.encode("utf-8"),
            payload_b64.encode("utf-8"),
            hashlib.sha256,
        ).hexdigest()

        if not hmac.compare_digest(provided_sig, expected_sig):
            logger.warning("[AuthCrypto] Invalid token HMAC signature")
            return None

        try:
            # Restore base64 padding
            padding = 4 - (len(payload_b64) % 4)
            if padding and padding < 4:
                padded = payload_b64 + ("=" * padding)
            else:
                padded = payload_b64

            payload_json = base64.urlsafe_b64decode(padded.encode("utf-8")).decode("utf-8")
            payload = json.loads(payload_json)
        except Exception as exc:
            logger.warning("[AuthCrypto] Failed to parse token payload: %s", exc)
            return None

        if not isinstance(payload, dict):
            return None
        exp = payload.get("exp")
        if isinstance(exp, bool) or not isinstance(exp, (int, float)) or not (time.time() < exp < float("inf")):
            logger.info("[AuthCrypto] Token expired (exp=%s)", exp)
            return None

        reg_no = payload.get("reg")
        if reg_no and isinstance(reg_no, str):
            clean_reg = reg_no.strip().upper()
            if clean_reg and clean_reg not in ("NOT AVAILABLE", "SYNC REQUIRED"):
                return clean_reg

        return None

    # 2. Backward compatibility with active client_manager in-memory handles
    try:
        from app.vtop.client import client_manager
        handle = client_manager._get(raw_token)
        if handle and handle.reg_no and not handle.expired:
            clean_reg = handle.reg_no.strip().upper()
            if clean_reg and clean_reg not in ("NOT AVAILABLE", "SYNC REQUIRED"):
                return clean_reg
    except Exception as exc:
        logger.debug("[AuthCrypto] client_manager handle lookup notice: %s", exc)

    return None


def extract_token_from_request(
    authorization: Optional[str] = None,
    x_session_id: Optional[str] = None,
    session_id: Optional[str] = None,
) -> Optional[str]:
    """
    Extract the session token from Authorization header (Bearer), X-Session-ID, or sessionId query param.
    """
    if isinstance(authorization, str) and authorization.strip():
        auth_val = authorization.strip()
        if auth_val.lower().startswith("bearer "):
            return auth_val[7:].strip()
        return auth_val

    if isinstance(x_session_id, str) and x_session_id.strip():
        return x_session_id.strip()

    if isinstance(session_id, str) and session_id.strip():
        return session_id.strip()

    return None


def integration_session_token(reg_no: str, authorization: Optional[str], x_session_id: Optional[str]) -> str:
    """Keep the live VTOP state when linking another integration to its session."""
    token = extract_token_from_request(authorization=authorization, x_session_id=x_session_id)
    if token and verify_session_token(token) == reg_no:
        return token
    return generate_signed_session_token(reg_no)
