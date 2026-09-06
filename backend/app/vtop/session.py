"""
VTOP session handling: pre-login handshake, captcha retrieval, authentication,
and authenticated POST helpers.

The single most important thing in this file is CSRF handling. VTOP rotates its
CSRF token, and StudentCC re-reads `input[name="_csrf"]` out of the *current*
page DOM before every single request. A `requests`-based client has no live DOM,
so we emulate it by re-scraping the token from every response that carries one
and always sending the freshest value.

Sending the stale pre-login token is the reason an earlier version of this
integration silently synced nothing: VTOP answers a bad token with a valid-looking
200 that contains no data.
"""

from __future__ import annotations

import base64
import datetime
import logging
import re
from typing import Any, Dict, List, Optional, Tuple

import requests
import urllib3
from bs4 import BeautifulSoup

from app.vtop import constants as C
from app.vtop.ocr import solve_captcha_bytes

urllib3.disable_warnings()

logger = logging.getLogger("vtop.session")

_CSRF_RE = re.compile(
    r'name=["\']_csrf["\'][^>]*value=["\']([^"\']+)["\']', re.IGNORECASE
)
_CSRF_RE_ALT = re.compile(
    r'value=["\']([^"\']+)["\'][^>]*name=["\']_csrf["\']', re.IGNORECASE
)


class VTOPAuthError(Exception):
    """Raised when VTOP refuses the credentials or captcha."""

    def __init__(self, message: str, code: int = 0, retryable: bool = False):
        super().__init__(message)
        self.message = message
        self.code = code
        # True when the user can just try again (bad captcha), False when the
        # credentials themselves are the problem.
        self.retryable = retryable


def _extract_csrf(html: str) -> Optional[str]:
    """Pull the CSRF token out of a page. Tries both attribute orderings."""
    for pattern in (_CSRF_RE, _CSRF_RE_ALT):
        match = pattern.search(html)
        if match:
            return match.group(1)
    return None


def _extract_input_value(html: str, element_id: str) -> Optional[str]:
    """Read the value of a hidden input by its id, e.g. authorizedIDX."""
    soup = BeautifulSoup(html, "html.parser")
    node = soup.find(id=element_id)
    if node is None:
        return None
    value = node.get("value")
    if value is None:
        return None
    value = value.strip()
    return value or None


class VTOPSession:
    """
    A single authenticated conversation with VTOP.

    Lifecycle: ``start_handshake()`` -> ``fetch_captcha()`` -> ``login()`` ->
    any number of ``post_semester()`` / ``post_menu()`` calls.
    """

    def __init__(self, user_agent: Optional[str] = None):
        self.base_url = C.BASE_URL
        self.http = requests.Session()
        # VTOP's certificate chain is frequently misconfigured; StudentCC runs in
        # a WebView that tolerates it. We keep verification off but confine this
        # client to the single known VIT host.
        self.http.verify = False
        self.http.headers.update(
            {
                "User-Agent": user_agent or C.DEFAULT_USER_AGENT,
                "Accept": (
                    "text/html,application/xhtml+xml,application/xml;q=0.9,"
                    "image/avif,image/webp,*/*;q=0.8"
                ),
                "Accept-Language": "en-US,en;q=0.9",
                "Origin": self.base_url,
                "Referer": f"{self.base_url}/{C.LOGIN_PAGE}",
            }
        )

        self.csrf: Optional[str] = None
        self.authorized_id: Optional[str] = None
        self.win_image: Optional[str] = None
        self.captcha_kind: str = "default"  # or "grecaptcha"
        self.is_authenticated = False
        self.username: Optional[str] = None
        self.last_login_at: Optional[datetime.datetime] = None

    def serialize_state(self) -> Dict[str, Any]:
        """Serialize session state for stateless serverless persistence."""
        return {
            "cookies": self.http.cookies.get_dict(),
            "csrf": self.csrf,
            "authorized_id": self.authorized_id,
            "win_image": self.win_image,
            "captcha_kind": self.captcha_kind,
            "is_authenticated": self.is_authenticated,
            "username": self.username,
        }

    def restore_state(self, state: Dict[str, Any]) -> None:
        """Restore session state across serverless invocations."""
        cookies = state.get("cookies") or {}
        for k, v in cookies.items():
            self.http.cookies.set(k, v)
        self.csrf = state.get("csrf")
        self.authorized_id = state.get("authorized_id")
        self.win_image = state.get("win_image")
        self.captcha_kind = state.get("captcha_kind") or "default"
        self.is_authenticated = bool(state.get("is_authenticated", False))
        self.username = state.get("username")

    # -- low level ---------------------------------------------------------

    def _url(self, path: str) -> str:
        return f"{self.base_url}/{path.lstrip('/')}"

    def _absorb(self, html: str) -> None:
        """
        Update rotating session state from a response body.

        Called after every request so the next request always carries the
        freshest CSRF token, mirroring StudentCC's live-DOM reads.
        """
        token = _extract_csrf(html)
        if token:
            self.csrf = token

        authorized = _extract_input_value(html, "authorizedIDX")
        if authorized:
            self.authorized_id = authorized

        win_image = _extract_input_value(html, "winImage")
        if win_image:
            self.win_image = win_image

    def _get(self, path: str, **kwargs: Any) -> requests.Response:
        timeout = kwargs.pop("timeout", 4.0)
        response = self.http.get(self._url(path), timeout=timeout, **kwargs)
        self._absorb(response.text)
        return response

    def _post(
        self, path: str, data: List[Tuple[str, str]], **kwargs: Any
    ) -> requests.Response:
        timeout = kwargs.pop("timeout", 4.5)
        response = self.http.post(self._url(path), data=data, timeout=timeout, **kwargs)
        self._absorb(response.text)
        return response

    # -- handshake ---------------------------------------------------------

    def start_handshake(self) -> None:
        """
        Walk VTOP's pre-login sequence until we land on the real login form.

        VTOP first serves a landing page whose only job is to POST #stdForm to
        /prelogin/setup; only after that does it serve the form that accepts
        credentials.
        """
        logger.info("[VTOP] Starting pre-login handshake")
        response = self._get(C.LOGIN_PAGE)

        for attempt in range(2):
            if self._is_login_page(response.text):
                self.captcha_kind = self._detect_captcha_kind(response.text)
                logger.info(
                    "[VTOP] Reached login form (captcha kind: %s)", self.captcha_kind
                )
                return

            # Still on the landing page — submit the pre-login form.
            logger.info("[VTOP] Landing page, submitting prelogin/setup (try %d)", attempt + 1)
            self._submit_prelogin(response.text)
            response = self._get(C.LOGIN_PAGE)

        raise VTOPAuthError(
            "VTOP never served its login form. The portal is likely down or "
            "under maintenance.",
            code=101,
        )

    def _submit_prelogin(self, landing_html: str) -> None:
        """POST the landing page's #stdForm, exactly as StudentCC serialises it."""
        soup = BeautifulSoup(landing_html, "html.parser")
        form = soup.find(id="stdForm")

        fields: List[Tuple[str, str]] = []
        if form is not None:
            for node in form.find_all(["input", "select", "textarea"]):
                name = node.get("name")
                if not name:
                    continue
                fields.append((name, node.get("value") or ""))

        if not fields:
            # Fall back to the minimum VTOP accepts.
            fields = [("_csrf", self.csrf or ""), ("flag", "VTOP")]
        elif not any(name == "flag" for name, _ in fields):
            fields.append(("flag", "VTOP"))

        self._post(C.PRELOGIN_SETUP, fields)

    @staticmethod
    def _is_login_page(html: str) -> bool:
        return 'id="vtopLoginForm"' in html or "id='vtopLoginForm'" in html

    @staticmethod
    def _detect_captcha_kind(html: str) -> str:
        """VTOP serves either its own image captcha or an invisible reCAPTCHA."""
        if "recaptcha/api.js" in html or 'class="g-recaptcha"' in html:
            return "grecaptcha"
        return "default"

    # -- captcha -----------------------------------------------------------

    def fetch_captcha(self) -> Dict[str, Any]:
        """
        Return the login captcha as a data URL, plus our best OCR guess.

        Extracts the in-page base64 image or queries the dynamic
        /get/new/captcha endpoint that VTOP loads.
        """
        response = self._get(C.LOGIN_PAGE)
        if not self._is_login_page(response.text):
            self.start_handshake()
            response = self._get(C.LOGIN_PAGE)

        # 1. Try to extract from login page HTML
        b64 = self._extract_captcha_b64(response.text)

        # 2. If not in static HTML, query VTOP's dynamic captcha endpoint
        if not b64:
            try:
                r_cap = self._get(C.CAPTCHA_ENDPOINT)
                if r_cap.status_code == 200:
                    b64 = self._extract_captcha_b64(r_cap.text)
            except Exception as exc:
                logger.warning("[VTOP] Dynamic captcha endpoint fetch failed: %s", exc)

        if not b64:
            return {
                "captchaKind": "default",
                "captchaImage": None,
                "solvedCaptcha": None,
                "message": "VTOP did not return a captcha image.",
            }

        self.captcha_kind = "default"
        try:
            raw = base64.b64decode(b64)
        except Exception as exc:  # pragma: no cover - malformed portal response
            logger.error("[VTOP] Captcha base64 decode failed: %s", exc)
            return {
                "captchaKind": "default",
                "captchaImage": None,
                "solvedCaptcha": None,
                "message": "VTOP returned an unreadable captcha image.",
            }

        guess = solve_captcha_bytes(raw)
        logger.info("[VTOP] Captcha retrieved (OCR guess: %s)", guess or "<none>")
        mime_prefix = "image/jpeg" if raw.startswith(b"\xff\xd8\xff") else "image/png"
        return {
            "captchaKind": "default",
            "captchaImage": f"data:{mime_prefix};base64,{b64}",
            "solvedCaptcha": guess or "",
        }

    @staticmethod
    def _extract_captcha_b64(html: str) -> Optional[str]:
        soup = BeautifulSoup(html, "html.parser")
        block = soup.find(id="captchaBlock")
        candidates = []
        if block is not None:
            candidates.extend(block.find_all("img"))
        candidates.extend(soup.find_all("img"))

        for img in candidates:
            src = img.get("src") or ""
            if "base64," in src:
                return src.split("base64,", 1)[1].strip()
        return None

    # -- login -------------------------------------------------------------

    def login(self, username: str, password: str, captcha: str) -> None:
        """
        Authenticate. Raises VTOPAuthError on rejection.

        Success is detected the same way StudentCC does it: the response body
        contains the string ``authorizedIDX``. VTOP returns HTTP 200 for both
        success and failure, so there is nothing else to key off.
        """
        reg_no = username.strip().upper()
        self.username = reg_no

        fields: List[Tuple[str, str]] = [
            ("_csrf", self.csrf or ""),
            ("username", reg_no),
            ("password", password),
            # VTOP reads one or the other depending on which captcha mode is
            # live; StudentCC populates both with the same value.
            ("captchaStr", captcha or ""),
            ("gResponse", captcha or ""),
        ]

        logger.info("[VTOP] Submitting credentials for %s", reg_no)
        response = self._post(C.LOGIN_SUBMIT, fields)
        body = response.text

        if C.AUTH_MARKER in body:
            self._finalise_login(body)
            return

        self._raise_login_error(body)

    def _finalise_login(self, login_body: str) -> None:
        """Capture the post-login session identifiers we need for every request."""
        self._absorb(login_body)

        if not self.authorized_id:
            # The marker was present but the input wasn't parseable from the
            # login response; the content page always carries it.
            content = self._get(C.CONTENT_PAGE)
            self._absorb(content.text)

        if not self.authorized_id:
            raise VTOPAuthError(
                "Logged in but VTOP did not return an authorizedID, so no data "
                "can be requested. Please retry.",
                code=102,
                retryable=True,
            )

        self.is_authenticated = True
        self.last_login_at = datetime.datetime.now()
        logger.info(
            "[VTOP] Authenticated as %s (authorizedID=%s)",
            self.username,
            self.authorized_id,
        )

    @staticmethod
    def _raise_login_error(body: str) -> None:
        """Map VTOP's error text onto a precise, actionable message."""
        lowered = body.lower()

        if re.search(r"invalid\s*captcha", lowered):
            raise VTOPAuthError(
                "Incorrect captcha. Please verify the characters from the captcha image and try again.",
                code=1,
                retryable=True,
            )
        if re.search(
            r"invalid\s*(user\s*name|login\s*id|user\s*id)\s*/\s*password", lowered
        ):
            raise VTOPAuthError(
                "Incorrect registration number or password.", code=2
            )
        if re.search(r"account\s*is\s*locked", lowered):
            raise VTOPAuthError(
                "This VTOP account is locked. Unlock it on the VTOP website first.",
                code=3,
            )
        if re.search(r"maximum\s*fail\s*attempts\s*reached", lowered):
            raise VTOPAuthError(
                "VTOP has temporarily blocked sign-in after too many failed "
                "attempts. Wait a while before retrying.",
                code=4,
            )
        if C.UNAUTHORIZED_MARKER in lowered:
            raise VTOPAuthError(
                "VTOP rejected this client. It may be blocking non-browser "
                "clients right now.",
                code=6,
            )

        raise VTOPAuthError(
            "VTOP rejected the sign-in for an unrecognised reason.", code=5
        )

    # -- authenticated requests -------------------------------------------

    def _require_auth(self) -> Tuple[str, str]:
        if not self.is_authenticated or not self.authorized_id:
            raise VTOPAuthError("Not signed in to VTOP.", code=100)
        return self.csrf or "", self.authorized_id

    def post_menu(self, path: str, with_win_image: bool = False) -> str:
        """
        Request a top-level menu page.

        Body shape: verifyMenu=true & [winImage] & authorizedID & _csrf & nocache
        """
        csrf, authorized_id = self._require_auth()
        fields: List[Tuple[str, str]] = [("verifyMenu", "true")]
        if with_win_image:
            fields.append(("winImage", self.win_image or ""))
        fields.extend(
            [
                ("authorizedID", authorized_id),
                ("_csrf", csrf),
                ("nocache", C.NOCACHE_LITERAL),
            ]
        )
        return self._post(path, fields).text

    def post_semester(self, path: str, semester_id: str, csrf_first: bool = True) -> str:
        """
        Request a semester-scoped data page.

        Body shape: _csrf & semesterSubId & authorizedID (order varies by module
        in the reference client; harmless, but kept faithful).
        """
        csrf, authorized_id = self._require_auth()
        if csrf_first:
            fields = [
                ("_csrf", csrf),
                ("semesterSubId", semester_id),
                ("authorizedID", authorized_id),
            ]
        else:
            fields = [
                ("semesterSubId", semester_id),
                ("authorizedID", authorized_id),
                ("_csrf", csrf),
            ]
        return self._post(path, fields).text

    def post_simple(self, path: str) -> str:
        """Body shape: _csrf & authorizedID & x= (used by the spotlight/home call)."""
        csrf, authorized_id = self._require_auth()
        return self._post(
            path,
            [("_csrf", csrf), ("authorizedID", authorized_id), ("x", "")],
        ).text

    def post_od(self, path: str, semester_id: Optional[str] = None) -> str:
        """
        Request an OD-specific endpoint with full parameter payload.
        """
        csrf, authorized_id = self._require_auth()
        fields: List[Tuple[str, str]] = [
            ("_csrf", csrf),
            ("authorizedID", authorized_id),
            ("x", ""),
            ("nocache", C.NOCACHE_LITERAL),
        ]
        if semester_id:
            fields.insert(1, ("semesterSubId", semester_id))
        return self._post(path, fields).text

    def post_custom(self, path: str, extra_fields: Optional[List[Tuple[str, str]]] = None) -> str:
        """
        Post custom fields with authenticated headers, auto-injected CSRF and authorizedID.
        """
        csrf, authorized_id = self._require_auth()
        fields: List[Tuple[str, str]] = [
            ("_csrf", csrf),
            ("authorizedID", authorized_id),
        ]
        if extra_fields:
            fields.extend(extra_fields)
        return self._post(path, fields).text

    def logout(self) -> None:
        self.is_authenticated = False
        self.csrf = None
        self.authorized_id = None
        self.win_image = None
        try:
            self.http.close()
        except Exception:  # pragma: no cover
            pass
