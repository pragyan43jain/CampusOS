"""
The manager that sits between the HTTP layer and the scrape pipeline.

Its whole job is bookkeeping: hold live authenticated :class:`VTOPSession`
objects, hand out opaque ids for them, and run :func:`scraper.sync` against the
right one. All of the protocol knowledge lives in ``session.py``, all of the
parsing in ``parser.py``, and all of the assembly in ``scraper.py``.

Two things this module deliberately does NOT do:

* **Store credentials.** A password is used once, passed straight to VTOP, and
  never written anywhere — not to the store, not to a field on the session. The
  consequence is that a re-sync needs a live session; when the session has
  expired the honest answer is "sign in again", not a silent stale read.
* **Fabricate a fallback.** There is no demo mode and no generated payload. If
  VTOP cannot be reached the caller gets an error, because a dashboard that
  invents attendance figures is worse than one that admits it is offline.
"""

from __future__ import annotations

import logging
import secrets
import threading
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from app.storage import empty_store, save_store
from app.vtop import scraper
from app.vtop.session import VTOPAuthError, VTOPSession

logger = logging.getLogger("vtop.client")

# VTOP itself drops idle sessions after roughly half an hour. Expiring ours a
# little sooner means the user gets a clear "session expired" from us instead of
# an inscrutable empty page from VTOP.
SESSION_TTL = timedelta(minutes=20)

# Codes returned to the client. Anything >= 100 is our side of the fence.
CODE_NO_SESSION = 110
CODE_SESSION_EXPIRED = 111
CODE_NOT_AUTHENTICATED = 112
CODE_TRANSPORT = 113


class _Handle:
    """A live session plus the timestamps needed to expire it."""

    __slots__ = ("session", "created_at", "last_used", "reg_no")

    def __init__(self, session: VTOPSession):
        now = datetime.now(timezone.utc)
        self.session = session
        self.created_at = now
        self.last_used = now
        self.reg_no: Optional[str] = None

    @property
    def expired(self) -> bool:
        return datetime.now(timezone.utc) - self.last_used > SESSION_TTL

    def touch(self) -> None:
        self.last_used = datetime.now(timezone.utc)


class VTOPClientManager:
    """
    Tracks live VTOP sessions by opaque id.

    FastAPI runs sync endpoints in a thread pool, so every mutation of the
    session table is taken under a lock. The scrape itself runs outside the lock —
    it takes tens of seconds, and holding the lock across it would serialise
    unrelated users.
    """

    def __init__(self) -> None:
        self._sessions: Dict[str, _Handle] = {}
        self._lock = threading.Lock()

    # -- session table -----------------------------------------------------

    def _prune(self) -> None:
        """Drop expired sessions. Called under the lock."""
        for session_id in [sid for sid, h in self._sessions.items() if h.expired]:
            logger.info("[VTOP] Expiring idle session %s", session_id[:8])
            handle = self._sessions.pop(session_id)
            try:
                handle.session.logout()
            except Exception:  # pragma: no cover - best effort cleanup
                pass

    def _put(self, session: VTOPSession) -> str:
        session_id = secrets.token_urlsafe(24)
        with self._lock:
            self._prune()
            self._sessions[session_id] = _Handle(session)
        return session_id

    def _get(self, session_id: Optional[str]) -> Optional[_Handle]:
        if not session_id:
            return None
        with self._lock:
            self._prune()
            handle = self._sessions.get(session_id)
            if handle is not None:
                handle.touch()
            return handle

    def _authenticated_handle(self) -> Optional[str]:
        """The id of any live authenticated session, for callers that omit one."""
        with self._lock:
            self._prune()
            for session_id, handle in self._sessions.items():
                if handle.session.is_authenticated:
                    return session_id
        return None

    # -- captcha -----------------------------------------------------------

    def issue_captcha(self) -> Dict[str, Any]:
        """
        Start a session, walk the pre-login handshake, and return its captcha.

        The returned ``sessionId`` is mandatory on the subsequent login call: the
        captcha is only valid for the session that was issued it, so a login that
        arrives without one cannot succeed no matter what the user typed.
        """
        session = VTOPSession()
        try:
            session.start_handshake()
            captcha = session.fetch_captcha()
        except VTOPAuthError as exc:
            logger.warning("[VTOP] Captcha handshake refused: %s", exc.message)
            return {
                "success": False,
                "message": exc.message,
                "code": exc.code,
                "sessionId": None,
                "captchaImage": None,
                "solvedCaptcha": None,
            }
        except Exception as exc:
            logger.error("[VTOP] Captcha fetch failed: %s", exc)
            return {
                "success": False,
                "message": (
                    "Could not reach the VTOP portal. Check your internet "
                    f"connection and whether VTOP is up. ({type(exc).__name__})"
                ),
                "code": CODE_TRANSPORT,
                "sessionId": None,
                "captchaImage": None,
                "solvedCaptcha": None,
            }

        session_id = self._put(session)
        logger.info("[VTOP] Issued captcha for session %s", session_id[:8])
        return {
            "success": captcha.get("captchaImage") is not None,
            "sessionId": session_id,
            **captcha,
        }

    # -- login -------------------------------------------------------------

    def login_and_sync(
        self,
        session_id: Optional[str],
        username: str,
        password: str,
        captcha: Optional[str] = None,
        semester_id: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Authenticate, then run a full scrape and persist it.

        Returns ``success: False`` with an actionable message on any failure. The
        store is only written on success, so a failed login never overwrites data
        the user already has.
        """
        handle = self._get(session_id)
        if handle is None:
            return self._error(
                "This sign-in attempt has no captcha session, or it expired. "
                "Request a fresh captcha and try again.",
                CODE_NO_SESSION if not session_id else CODE_SESSION_EXPIRED,
                retryable=True,
            )

        session = handle.session
        try:
            session.login(username, password, captcha or "")
        except VTOPAuthError as exc:
            logger.warning("[VTOP] Login refused (%s): %s", exc.code, exc.message)
            # The captcha is single-use, so the session is spent either way.
            self._drop(session_id)
            return self._error(exc.message, exc.code, retryable=exc.retryable)
        except Exception as exc:
            logger.error("[VTOP] Login transport error: %s", exc)
            self._drop(session_id)
            return self._error(
                "Lost the connection to VTOP while signing in. Please try again. "
                f"({type(exc).__name__})",
                CODE_TRANSPORT,
                retryable=True,
            )

        handle.reg_no = session.username
        handle.touch()
        return self._run_sync(session_id, handle, semester_id)

    # -- sync --------------------------------------------------------------

    def resync(
        self, session_id: Optional[str] = None, semester_id: Optional[str] = None
    ) -> Dict[str, Any]:
        """
        Re-scrape using an existing signed-in session.

        Falls back to any live authenticated session when the caller does not
        supply an id, which is what the single-user desktop case does.
        """
        resolved = session_id or self._authenticated_handle()
        handle = self._get(resolved)
        if handle is None:
            return self._error(
                "Your VTOP session has expired. Sign in again to sync.",
                CODE_SESSION_EXPIRED,
                retryable=True,
            )
        if not handle.session.is_authenticated:
            return self._error(
                "Not signed in to VTOP.", CODE_NOT_AUTHENTICATED, retryable=True
            )
        return self._run_sync(resolved, handle, semester_id)

    def _run_sync(
        self, session_id: Optional[str], handle: _Handle, semester_id: Optional[str]
    ) -> Dict[str, Any]:
        """Scrape, persist, and summarise. Runs outside the session lock."""
        try:
            payload = scraper.sync(handle.session, semester_id=semester_id)
        except VTOPAuthError as exc:
            self._drop(session_id)
            return self._error(exc.message, exc.code, retryable=exc.retryable)
        except Exception as exc:
            logger.exception("[VTOP] Sync failed outright")
            return self._error(
                f"The sync failed before any module could be read. ({type(exc).__name__}: {exc})",
                CODE_TRANSPORT,
                retryable=True,
            )

        handle.touch()
        report = payload.get("syncReport") or {}
        payload = {
            **payload,
            "authenticated": True,
            "message": _summarise(report),
            "lastSynced": payload.get("student", {}).get("lastSynced"),
        }
        save_store(payload)

        failed: List[str] = list(report.get("failed") or [])
        logger.info(
            "[VTOP] Sync complete for %s (%d failed module(s))",
            handle.reg_no or "unknown",
            len(failed),
        )
        return {
            # A partial sync is still a successful sign-in; the report says what
            # is missing. Reporting overall failure because one module was down
            # would throw away the modules that worked.
            "success": True,
            "message": payload["message"],
            "sessionId": session_id,
            "data": payload,
            "syncReport": report,
            "warnings": report.get("warnings") or [],
            "lastSynced": payload["lastSynced"],
        }

    # -- status / teardown -------------------------------------------------

    def status(self) -> Dict[str, Any]:
        with self._lock:
            self._prune()
            live = [
                {
                    "sessionId": session_id,
                    "regNo": handle.reg_no,
                    "authenticated": handle.session.is_authenticated,
                    "since": handle.created_at.isoformat(),
                    "lastUsed": handle.last_used.isoformat(),
                }
                for session_id, handle in self._sessions.items()
            ]
        return {"liveSessions": live, "sessionTtlMinutes": SESSION_TTL.seconds // 60}

    def _drop(self, session_id: Optional[str]) -> None:
        if not session_id:
            return
        with self._lock:
            handle = self._sessions.pop(session_id, None)
        if handle is not None:
            try:
                handle.session.logout()
            except Exception:  # pragma: no cover
                pass

    def logout(self, session_id: Optional[str] = None) -> Dict[str, Any]:
        """End one session, or all of them when no id is given."""
        if session_id:
            self._drop(session_id)
        else:
            with self._lock:
                handles = list(self._sessions.values())
                self._sessions.clear()
            for handle in handles:
                try:
                    handle.session.logout()
                except Exception:  # pragma: no cover
                    pass
        return {"success": True, "message": "Signed out of VTOP."}

    # -- helpers -----------------------------------------------------------

    @staticmethod
    def _error(message: str, code: int, retryable: bool = False) -> Dict[str, Any]:
        return {
            "success": False,
            "message": message,
            "code": code,
            "retryable": retryable,
            "data": None,
            "sessionId": None,
        }


def _summarise(report: Dict[str, Any]) -> str:
    """One line the UI can show verbatim, naming any module that did not load."""
    failed = list(report.get("failed") or [])
    if not failed:
        return "Synced with VTOP."
    listed = ", ".join(failed)
    return (
        f"Synced with VTOP, but {len(failed)} module(s) could not be read: {listed}. "
        "Those sections are shown as unavailable rather than estimated."
    )


def disconnected_store() -> Dict[str, Any]:
    """The payload to serve when VTOP has never been connected."""
    return empty_store()


client_manager = VTOPClientManager()
