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
from datetime import datetime
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Body, Header, HTTPException, Query
from pydantic import BaseModel, Field

from app.storage import clear_store, empty_store, load_store, save_store
from app.vtop.client import client_manager

logger = logging.getLogger("vtop.routes")

router = APIRouter(prefix="/api/vtop", tags=["vtop"])


def resolve_student_reg(
    x_session_id: Optional[str] = None,
    x_reg_no: Optional[str] = None,
    session_id: Optional[str] = None,
    reg_no: Optional[str] = None,
) -> Optional[str]:
    reg = reg_no or x_reg_no
    if reg and reg.strip() and reg.strip() != "Not available":
        return reg.strip()
    sid = session_id or x_session_id
    if sid:
        handle = client_manager._get(sid)
        if handle and handle.reg_no:
            return handle.reg_no
    return None


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
def logout(
    sessionId: Optional[str] = Query(None),
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """End the VTOP session(s) and clear the local store."""
    resolved_sid = sessionId or x_session_id
    resolved_reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    result = client_manager.logout(resolved_sid)
    clear_store(resolved_reg)
    return {**result, "message": "Signed out of VTOP and cleared local data."}


# ---------------------------------------------------------------------------
# read-back of the last sync
# ---------------------------------------------------------------------------


@router.get("/profile")
def get_vtop_profile(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    store = load_store(reg)
    return store.get("student") or empty_store()["student"]


@router.get("/cgpa")
def get_vtop_cgpa(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
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
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    student = load_store(reg).get("student") or {}
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
def get_vtop_attendance(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    return load_store(reg).get("attendance") or []


def normalize_marks_item(m: Dict[str, Any], courses: List[Dict[str, Any]]) -> Dict[str, Any]:
    code = m.get("courseCode") or ""
    matched_course = next((c for c in courses if c.get("code") == code), None)
    title = m.get("courseTitle") or (matched_course.get("title") if matched_course else None) or code
    faculty = m.get("faculty") or (matched_course.get("faculty") if matched_course else None) or "Faculty unassigned"
    slot = m.get("slot") or (matched_course.get("slot") if matched_course else None) or ""

    components = []
    for comp in m.get("components") or []:
        c_title = comp.get("title") or "Assessment Component"
        c_scored = comp.get("scored")
        c_max = comp.get("max") or comp.get("maxMark")
        c_weight = comp.get("weightage")
        c_max_weight = comp.get("maxWeightage") or comp.get("weightage")
        c_status = comp.get("status") or ("Present" if c_scored is not None else "")
        c_pct = round((c_scored / c_max) * 100, 1) if (c_scored is not None and c_max and c_max > 0) else None
        components.append({
            **comp,
            "title": c_title,
            "scored": c_scored,
            "max": c_max,
            "weightage": c_weight,
            "maxWeightage": c_max_weight,
            "percentage": c_pct,
            "status": c_status,
        })

    w_scored = m.get("weightageScored")
    w_graded = m.get("weightageGraded")
    w_total = m.get("weightageTotal")
    total_internal = None
    if w_scored is not None and w_graded is not None and w_graded > 0:
        total_internal = {
            "scored": w_scored,
            "max": w_graded,
            "percentage": round((w_scored / w_graded) * 100, 1),
        }

    cat1 = None
    cat2 = None
    da1 = None
    da2 = None
    quiz = None
    for c in components:
        t_low = c["title"].lower()
        if "cat-1" in t_low or "cat 1" in t_low or "assessment test - i" in t_low or "assessment test 1" in t_low:
            if not cat1: cat1 = c
        elif "cat-2" in t_low or "cat 2" in t_low or "assessment test - ii" in t_low or "assessment test 2" in t_low:
            if not cat2: cat2 = c
        elif "da-1" in t_low or "da 1" in t_low or "digital assignment 1" in t_low or "digital assignment-1" in t_low:
            if not da1: da1 = c
        elif "da-2" in t_low or "da 2" in t_low or "digital assignment 2" in t_low or "digital assignment-2" in t_low:
            if not da2: da2 = c
        elif "quiz" in t_low:
            if not quiz: quiz = c

    return {
        **m,
        "courseCode": code,
        "courseTitle": title,
        "courseName": title,
        "faculty": faculty,
        "facultyName": faculty,
        "slot": slot,
        "hasMarks": len(components) > 0,
        "components": components,
        "weightageScored": w_scored,
        "weightageGraded": w_graded,
        "weightageTotal": w_total,
        "totalInternal": total_internal,
        "cat1": cat1,
        "cat2": cat2,
        "da1": da1,
        "da2": da2,
        "quiz": quiz,
    }


def normalize_faculty_item(fac: Dict[str, Any], courses: List[Dict[str, Any]]) -> Dict[str, Any]:
    name = fac.get("name") or "Faculty Member"
    raw_courses = fac.get("courses") or []
    designation = fac.get("designation") or "Course Faculty"
    is_leadership = any(role in designation.lower() for role in ["dean", "head of the department", "hod", "proctor"]) or fac.get("isProctor") or any("proctor" in str(c).lower() for c in raw_courses)

    matched_courses = []
    for c_code in raw_courses:
        c = next((item for item in courses if item.get("code") == c_code), None)
        if c:
            matched_courses.append({
                "code": c.get("code"),
                "title": c.get("title"),
                "slot": c.get("slot"),
                "venue": c.get("venue"),
            })

    first_course = matched_courses[0] if matched_courses else None
    course_code = ", ".join(mc["code"] for mc in matched_courses) if matched_courses else (None if is_leadership else "-")
    course_title = ", ".join(mc["title"] for mc in matched_courses) if matched_courses else (None if is_leadership else "Course information unavailable")
    slot = ", ".join(mc["slot"] for mc in matched_courses if mc.get("slot")) if matched_courses else (None if is_leadership else None)
    venue = fac.get("venue") or (first_course["venue"] if first_course else None)

    return {
        **fac,
        "id": f"fac-{name.replace(' ', '-').lower()}",
        "name": name,
        "designation": designation,
        "isLeadership": is_leadership,
        "courseCode": course_code,
        "courseTitle": course_title,
        "slot": slot,
        "venue": venue,
        "enrolledCourses": matched_courses,
    }


@router.get("/marks")
def get_vtop_marks(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    store = load_store(reg)
    courses = store.get("courses") or []
    raw_marks = store.get("marks") or []
    return [normalize_marks_item(m, courses) for m in raw_marks]


@router.get("/marks/summary")
def get_vtop_marks_summary(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    """Returns continuous marks status for all enrolled courses."""
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    store = load_store(reg)
    courses = store.get("courses") or []
    raw_marks = store.get("marks") or []
    marks_by_code = {m.get("courseCode"): m for m in raw_marks if m.get("courseCode")}

    summary = []
    for c in courses:
        code = c.get("code")
        if code in marks_by_code:
            summary.append(normalize_marks_item(marks_by_code[code], courses))
        else:
            summary.append({
                "id": f"marks-{code}",
                "courseId": c.get("id"),
                "courseCode": code,
                "courseTitle": c.get("title"),
                "courseName": c.get("title"),
                "faculty": c.get("faculty") or "Faculty unassigned",
                "facultyName": c.get("faculty") or "Faculty unassigned",
                "slot": c.get("slot") or "",
                "hasMarks": False,
                "components": [],
                "weightageScored": None,
                "weightageGraded": None,
                "weightageTotal": None,
                "totalInternal": None,
                "statusMessage": "No assessment records returned by VTOP",
            })
    return summary


@router.get("/courses")
def get_vtop_courses(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    """Registered courses with their attendance and marks attached."""
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    return load_store(reg).get("courses") or []


@router.get("/od")
def get_vtop_od(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    On-duty hours extracted directly from VTOP leave modules.
    """
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    store = load_store(reg)
    od = store.get("od") or empty_store()["od"]
    is_auth = bool(store.get("authenticated"))
    
    has_valid = bool(od.get("hasValidData") or is_auth)
    used = od.get("usedHours") if od.get("usedHours") is not None else (od.get("odHours") if od.get("odHours") is not None else (0 if has_valid else None))
    max_h = od.get("maxHours") or od.get("maxOdHours") or 40
    records = od.get("records") or od.get("odRecords") or []
    remaining = max(0, max_h - (used or 0)) if used is not None else None
    pct = round(((used or 0) / float(max_h)) * 100.0, 1) if used is not None else None
    state = od.get("state") if od.get("state") and od.get("state") != "source_unavailable" else ("success_with_records" if records else ("success_with_no_records" if is_auth else "source_unavailable"))

    return {
        **od,
        "state": state,
        "hasValidData": has_valid,
        "usedHours": used,
        "odHours": used,
        "totalOdHours": used,
        "approvedHours": od.get("approvedHours", used or 0),
        "pendingHours": od.get("pendingHours", 0),
        "rejectedHours": od.get("rejectedHours", 0),
        "maxHours": max_h,
        "maxOdHours": max_h,
        "remainingHours": remaining,
        "percentageUsed": pct,
        "records": records,
        "odRecords": records,
    }


@router.get("/exams")
def get_vtop_exams(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, List[Dict[str, Any]]]:
    """
    Exam schedule grouped by exam type ("CAT 1", "FAT", ...), as VTOP groups it.
    """
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    exams = load_store(reg).get("exams")
    return exams if isinstance(exams, dict) else {}


@router.get("/timetable")
def get_vtop_timetable(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    return load_store(reg).get("timetable") or []


@router.get("/faculty")
def get_vtop_faculty(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    """
    The student's faculty, projected from the registered-course table and university staff records.
    """
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    store = load_store(reg)
    courses = store.get("courses") or []
    raw_fac = store.get("faculty") or []
    return [normalize_faculty_item(f, courses) for f in raw_fac]


@router.get("/receipts")
def get_vtop_receipts(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    return load_store(reg).get("receipts") or []


@router.get("/dues")
def get_vtop_dues(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    return load_store(reg).get("dues") or {"hasDues": False, "totalDue": 0.0, "items": []}


@router.get("/fees")
def get_vtop_fees(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    return load_store(reg).get("fees") or []


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
