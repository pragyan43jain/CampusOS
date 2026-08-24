"""
VTOP endpoints: sign-in, sync, and read-back of the last sync.

Two kinds of route live here and the distinction is worth keeping straight:

* ``/captcha``, ``/login``, ``/sync``, ``/logout`` talk to VTOP through
  ``client_manager``. They are the only routes that can block for tens of seconds.
* everything else is a thin read of the persisted store. No route computes,
  defaults, or backfills anything — if a field is absent the caller gets ``None``
  and is expected to render "not available".

Deliberately no ``response_model`` on these routes. FastAPI would validate the
outgoing payload and raise a 500 on any mismatch, so a schema that drifted behind
the pipeline would take the whole dashboard down rather than show a stale doc.
``app/vtop/models.py`` documents the shapes instead, and the smoke test validates
a real payload against them.
"""

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Query
from pydantic import BaseModel

from app.storage import clear_store, empty_store, load_store
from app.vtop.client import client_manager

logger = logging.getLogger("vtop.routes")

router = APIRouter(prefix="/api/vtop", tags=["vtop"])


class LoginRequest(BaseModel):
    """
    Sign-in payload.

    ``sessionId`` must be the one returned by ``GET /captcha``: the captcha is
    bound to the session that issued it. It is typed Optional so a missing id
    comes back as a readable message instead of a 422 the UI has to decode.

    There is no ``campus`` field any more — this integration targets VIT Chennai
    (vtopcc.vit.ac.in) and every endpoint path was verified against that portal.
    Accepting a campus we do not support would just move the failure later.
    """

    username: str
    password: str
    sessionId: Optional[str] = None
    captcha: Optional[str] = None
    semesterId: Optional[str] = None


# ---------------------------------------------------------------------------
# live VTOP conversation
# ---------------------------------------------------------------------------


@router.get("/captcha")
def get_captcha() -> Dict[str, Any]:
    """
    Start a VTOP session and return its login captcha.

    Response carries ``sessionId`` plus the captcha as a data URL and our OCR
    guess in ``solvedCaptcha``. The guess is a convenience only — it is wrong
    often enough that the UI must show the image and let the user correct it.

    When VTOP is serving Google reCAPTCHA instead of its own image, this returns
    ``success: false`` with an explanation rather than an unusable blank box.
    """
    return client_manager.issue_captcha()


@router.post("/login")
def login(req: LoginRequest) -> Dict[str, Any]:
    """
    Authenticate with VTOP, then scrape and persist everything.

    ``success: true`` with a non-empty ``syncReport.failed`` is normal and means a
    partial sync: some modules were unreadable, the rest are real. The store is
    only written on success, so a failed sign-in never clobbers existing data.

    The password is forwarded to VTOP and then dropped. It is not stored, logged,
    or kept on the session, which is why a later ``/sync`` needs the session to
    still be alive rather than being able to silently re-authenticate.
    """
    return client_manager.login_and_sync(
        session_id=req.sessionId,
        username=req.username,
        password=req.password,
        captcha=req.captcha,
        semester_id=req.semesterId,
    )


@router.post("/sync")
def sync_data(
    sessionId: Optional[str] = Query(None),
    semesterId: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Re-scrape using the existing signed-in session.

    Returns ``success: false`` with ``retryable: true`` once the VTOP session has
    lapsed — the honest outcome, since we hold no credentials to re-authenticate
    with. The previous implementation reported success here by checking whether a
    string in the store was not ``"Not available"``, which meant it reported
    success while syncing nothing.
    """
    return client_manager.resync(session_id=sessionId, semester_id=semesterId)


@router.post("/semester")
def switch_semester(
    semesterId: str = Body(..., embed=True),
    sessionId: Optional[str] = Body(None, embed=True),
) -> Dict[str, Any]:
    """
    Re-sync against a different semester.

    Every semester-scoped module is refetched, because mixing a new timetable with
    last semester's attendance is exactly the kind of quiet inconsistency this
    rewrite exists to remove.
    """
    return client_manager.resync(session_id=sessionId, semester_id=semesterId)


@router.post("/logout")
def logout(sessionId: Optional[str] = Query(None)) -> Dict[str, Any]:
    """End the VTOP session(s) and clear the local store."""
    result = client_manager.logout(sessionId)
    clear_store()
    return {**result, "message": "Signed out of VTOP and cleared local data."}


# ---------------------------------------------------------------------------
# read-back of the last sync
# ---------------------------------------------------------------------------


@router.get("/profile")
def get_vtop_profile() -> Dict[str, Any]:
    store = load_store()
    return store.get("student") or empty_store()["student"]


@router.get("/cgpa")
def get_vtop_cgpa() -> Dict[str, Any]:
    """
    Cumulative academic standing.

    Every field here is currently ``None`` by design: CGPA and earned credits come
    from the grade-history module, which is not wired up yet, and VTOP does not
    publish class rank at all. ``registeredCredits`` is the one real number — it is
    summed from the registered-course table.

    The previous version returned ``totalCreditsRequired: 160`` unconditionally.
    That is a programme-dependent figure nobody had checked, and it fed a progress
    bar that therefore meant nothing.
    """
    student = load_store().get("student") or {}
    return {
        "currentCgpa": student.get("cgpa"),
        "creditsEarned": student.get("creditsEarned"),
        "totalCreditsRequired": student.get("totalCreditsRequired"),
        "registeredCredits": student.get("registeredCredits"),
        "rank": student.get("rank"),
        "semesterGpa": student.get("semesterGpa") or [],
        "hasValidData": student.get("cgpa") is not None,
        "message": (
            None
            if student.get("cgpa") is not None
            else "Grade history is not synced yet, so CGPA is unavailable."
        ),
    }


@router.get("/attendance")
def get_vtop_attendance() -> List[Dict[str, Any]]:
    return load_store().get("attendance") or []


@router.get("/marks")
def get_vtop_marks() -> List[Dict[str, Any]]:
    return load_store().get("marks") or []


@router.get("/courses")
def get_vtop_courses() -> List[Dict[str, Any]]:
    """Registered courses with their attendance and marks attached."""
    return load_store().get("courses") or []


@router.get("/od")
def get_vtop_od() -> Dict[str, Any]:
    """
    On-duty hours extracted directly from VTOP leave modules.
    """
    store = load_store()
    od = store.get("od") or empty_store()["od"]
    return od


@router.get("/exams")
def get_vtop_exams() -> Dict[str, List[Dict[str, Any]]]:
    """
    Exam schedule grouped by exam type ("CAT 1", "FAT", ...), as VTOP groups it.
    """
    exams = load_store().get("exams")
    return exams if isinstance(exams, dict) else {}


@router.get("/exams-list")
def get_vtop_exams_list() -> List[Dict[str, Any]]:
    """
    Normalized flat array of scheduled examinations for card/timeline rendering.
    """
    store = load_store()
    exams_list = store.get("examsList")
    if isinstance(exams_list, list):
        return exams_list
    exams = store.get("exams")
    if isinstance(exams, dict):
        cards = []
        idx = 1
        for etype, items in exams.items():
            for it in items:
                cards.append({
                    "id": f"exam-{idx}",
                    "examType": etype,
                    "title": f"{etype} - {it.get('slot') or 'Exam'}",
                    **it,
                })
                idx += 1
        return cards
    return []


@router.get("/debug")
def get_vtop_debug() -> Dict[str, Any]:
    """
    Development debug telemetry for VTOP scraping & module state.
    """
    store = load_store()
    od = store.get("od") or {}
    report = store.get("syncReport") or {}
    return {
        "syncReport": report,
        "odState": {
            "state": od.get("state"),
            "usedHours": od.get("usedHours"),
            "maxHours": od.get("maxHours"),
            "remainingHours": od.get("remainingHours"),
            "recordCount": len(od.get("records", [])),
            "diagnostics": od.get("diagnostics"),
        },
        "sessionStatus": client_manager.status(),
        "modules": {
            "coursesCount": len(store.get("courses") or []),
            "timetableCount": len(store.get("timetable") or []),
            "attendanceCount": len(store.get("attendance") or []),
            "marksCount": len(store.get("marks") or []),
            "examsCount": len(store.get("exams") or []),
            "facultyCount": len(store.get("faculty") or []),
        },
        "lastSynced": store.get("lastSynced"),
    }


@router.get("/timetable")
def get_vtop_timetable() -> List[Dict[str, Any]]:
    return load_store().get("timetable") or []


@router.get("/faculty")
def get_vtop_faculty() -> List[Dict[str, Any]]:
    """
    The student's faculty, projected from the registered-course table.

    Not a separate VTOP module — that table is the only page listing them — so
    there are no emails or cabin numbers here rather than invented ones.
    """
    return load_store().get("faculty") or []


@router.get("/receipts")
def get_vtop_receipts() -> List[Dict[str, Any]]:
    return load_store().get("receipts") or []


@router.get("/dues")
def get_vtop_dues() -> Dict[str, Any]:
    return load_store().get("dues") or {"hasDues": False, "totalDue": 0.0, "items": []}


@router.get("/fees")
def get_vtop_fees() -> List[Dict[str, Any]]:
    return load_store().get("fees") or []


@router.get("/spotlight")
def get_vtop_spotlight() -> List[Dict[str, Any]]:
    return load_store().get("spotlight") or []


@router.get("/proctor")
def get_vtop_proctor() -> Optional[Dict[str, Any]]:
    return load_store().get("proctor")


@router.get("/dean-hod")
def get_vtop_dean_hod() -> List[Dict[str, Any]]:
    return load_store().get("deanHod") or []


@router.get("/assignments")
def get_vtop_assignments() -> List[Dict[str, Any]]:
    return load_store().get("assignments") or []


@router.get("/semesters")
def get_semesters() -> Dict[str, Any]:
    """The semester dropdown, and which one the stored data belongs to."""
    store = load_store()
    return {
        "semesters": store.get("semesters") or [],
        "selected": store.get("selectedSemester"),
    }


@router.get("/sync-report")
def get_sync_report() -> Dict[str, Any]:
    """
    Per-module outcome of the last sync.

    The point of this route is that ``empty`` and ``failed`` are different: "no
    exams are scheduled" and "we could not read your exams" look identical on a
    dashboard unless something says which happened. ``registry`` additionally
    reports slot-binding conflicts, which is where a wrong course attribution
    would show up first.
    """
    store = load_store()
    return {
        "syncReport": store.get("syncReport"),
        "registry": store.get("registry"),
        "lastSynced": store.get("lastSynced"),
    }


@router.get("/status")
def get_status() -> Dict[str, Any]:
    """
    Whether the dashboard is showing real synced data.

    ``authenticated`` is the stored boolean written by a successful sync — not, as
    before, the result of comparing a name field against the string
    ``"Not available"``. That comparison is why a never-connected account could
    read as connected.
    """
    store = load_store()
    student = store.get("student") or {}
    report = store.get("syncReport") or {}
    return {
        "authenticated": bool(store.get("authenticated")),
        "sessionLive": bool(client_manager.status()["liveSessions"]),
        "student": student,
        "selectedSemester": store.get("selectedSemester"),
        "lastSynced": store.get("lastSynced") or student.get("lastSynced"),
        "syncOk": report.get("ok"),
        "failedModules": report.get("failed") or [],
        "warnings": report.get("warnings") or [],
        "message": store.get("message"),
    }
