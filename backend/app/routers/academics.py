"""
Legacy ``/api/*`` routes the frontend still calls.

Two groups:

* **VTOP-backed** (``/student``, ``/courses``, ``/timetable``, ``/attendance``,
  ``/marks``, ``/od``, ``/faculty``, ``/exams``) — thin reads of the persisted
  sync, identical to their ``/api/vtop/*`` counterparts. Kept so existing callers
  keep working.
* **Not VTOP data** (``/assignments``, ``/fees``, ``/placements``, ``/dsa``,
  ``/ai-tasks``) — app features whose data used to come from the mock generator.
  With the generator gone they are genuinely empty, and they return ``[]`` rather
  than something plausible. ``GET /api/features`` reports which sections have a
  real source so the UI can label an empty section as "no source yet" instead of
  "you have no assignments".
"""

import json
import logging
import os
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from app.storage import empty_store, load_store, save_store
from app.vtop.hostel import fetch_laundry_schedule, fetch_mess_menu
from app.routers.auth import normalize_marks_item, normalize_faculty_item, resolve_student_reg, get_vtop_od

logger = logging.getLogger("vtop.routes.academics")

router = APIRouter(prefix="/api", tags=["academics"])


class AssignmentStatusUpdate(BaseModel):
    status: str


# ---------------------------------------------------------------------------
# VTOP-backed
# ---------------------------------------------------------------------------


@router.get("/student")
def get_student_profile(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    store = load_store(reg)
    return store.get("student") or empty_store()["student"]


@router.get("/courses")
def get_courses(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    return load_store(reg).get("courses") or []


@router.get("/timetable")
def get_timetable(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    return load_store(reg).get("timetable") or []


@router.get("/attendance")
def get_attendance(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    store = load_store(reg)
    return store.get("attendance") or []


@router.get("/marks")
def get_marks(
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
def get_marks_summary(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
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


@router.get("/od")
def get_od(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Dict[str, Any]:
    return get_vtop_od(x_session_id, x_reg_no, sessionId, regNo, authorization=authorization)


@router.get("/faculty")
def get_faculty(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    store = load_store(reg)
    courses = store.get("courses") or []
    raw_fac = store.get("faculty") or []
    return [normalize_faculty_item(f, courses) for f in raw_fac]


@router.get("/academics/subject/{course_code}")
def get_subject_details(
    course_code: str,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Returns authentic academic details specifically for one enrolled course code.
    Prevents cross-subject contamination.
    """
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    store = load_store(reg)
    courses = store.get("courses") or []
    matched = next((c for c in courses if (c.get("code") or "").upper() == course_code.upper()), None)
    if not matched:
        raise HTTPException(status_code=404, detail=f"Course '{course_code}' not found in enrolled courses.")

    code = matched.get("code")
    raw_marks = store.get("marks") or []
    course_marks = next((m for m in raw_marks if (m.get("courseCode") or "").upper() == code.upper()), None)
    norm_marks = normalize_marks_item(course_marks, courses) if course_marks else None

    # Attendance
    attendance_list = store.get("attendance") or []
    course_att = next((a for a in attendance_list if (a.get("courseCode") or "").upper() == code.upper()), None)

    # Timetable
    timetable_list = store.get("timetable") or []
    course_tt = [t for t in timetable_list if (t.get("courseCode") or "").upper() == code.upper()]

    # Exams
    exams_list = store.get("examsList") or []
    course_exams = [e for e in exams_list if (e.get("courseCode") or e.get("subjectCode") or "").upper() == code.upper()]

    # Faculty
    faculty_list = store.get("faculty") or []
    course_fac = [normalize_faculty_item(f, courses) for f in faculty_list if code in (f.get("courses") or [])]

    # Assignments
    assignments_list = store.get("assignments") or []
    course_assigns = [a for a in assignments_list if (a.get("courseCode") or "").upper() == code.upper()]

    return {
        "success": True,
        "course": matched,
        "marks": norm_marks,
        "hasMarks": norm_marks is not None and len(norm_marks.get("components") or []) > 0,
        "attendance": course_att,
        "timetable": course_tt,
        "exams": course_exams,
        "faculty": course_fac[0] if course_fac else None,
        "allFaculty": course_fac,
        "assignments": course_assigns,
        "studyMaterialUrl": "https://www.vhelpcc.com/",
    }


@router.get("/exams")
def get_exams(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Dict[str, List[Dict[str, Any]]]:
    """Grouped by exam type, matching ``/api/vtop/exams``."""
    from app.routers.auth import get_vtop_exams
    return get_vtop_exams(x_session_id, x_reg_no, sessionId, regNo, authorization=authorization)


@router.get("/receipts")
def get_receipts(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    x_auth_user: Optional[str] = Header(None, alias="X-Auth-User"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    reg = resolve_student_reg(
        x_session_id=x_session_id,
        x_reg_no=x_reg_no,
        session_id=sessionId,
        reg_no=regNo,
        x_auth_user=x_auth_user,
        authorization=authorization,
    )
    store = load_store(reg)
    receipts = store.get("receipts") or store.get("fees") or []
    if not receipts and reg:
        seed_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "seed", f"store_{reg}.json")
        if os.path.exists(seed_path):
            try:
                with open(seed_path, "r", encoding="utf-8") as f:
                    sdata = json.load(f)
                    receipts = sdata.get("receipts") or sdata.get("fees") or []
            except Exception:
                pass
    return receipts


@router.get("/dues")
def get_dues(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    x_auth_user: Optional[str] = Header(None, alias="X-Auth-User"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    reg = resolve_student_reg(
        x_session_id=x_session_id,
        x_reg_no=x_reg_no,
        session_id=sessionId,
        reg_no=regNo,
        x_auth_user=x_auth_user,
        authorization=authorization,
    )
    return load_store(reg).get("dues") or {"hasDues": False, "totalDue": 0.0, "items": []}


@router.get("/spotlight")
def get_spotlight(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    return load_store(reg).get("spotlight") or []


@router.get("/proctor")
def get_proctor(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Optional[Dict[str, Any]]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    return load_store(reg).get("proctor")


@router.get("/hostel/mess")
def get_hostel_mess(type: str = "M-N") -> List[Dict[str, Any]]:
    return fetch_mess_menu(type)


@router.get("/hostel/laundry")
def get_hostel_laundry(block: str = "A") -> List[Dict[str, Any]]:
    return fetch_laundry_schedule(block)


@router.get("/hostel/details")
def get_hostel_details(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    x_auth_user: Optional[str] = Header(None, alias="X-Auth-User"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Return student hostel details (gender, room, block, mess) and leave records.
    """
    reg = resolve_student_reg(
        x_session_id=x_session_id,
        x_reg_no=x_reg_no,
        session_id=sessionId,
        reg_no=regNo,
        x_auth_user=x_auth_user,
        authorization=authorization,
    )

    if not reg:
        return {
            "hostelInfo": {
                "gender": None,
                "isHosteller": None,
                "blockName": None,
                "roomNo": None,
                "messInfo": None,
            },
            "leaveHistory": [],
            "available": False,
        }

    store = load_store(reg)
    student = store.get("student") or {}
    hostel_data = store.get("hostel") or {}
    stored_info = hostel_data.get("hostelInfo") or store.get("hostelInfo") or {}

    gender = stored_info.get("gender") or student.get("gender") or None
    block_name = stored_info.get("blockName") or student.get("blockName") or None
    room_no = stored_info.get("roomNo") or student.get("roomNo") or None
    mess_info = stored_info.get("messInfo") or student.get("messInfo") or None

    is_hosteller = stored_info.get("isHosteller")
    if is_hosteller is None:
        is_hosteller = student.get("isHosteller")

    if block_name or room_no:
        is_hosteller = True

    hostel_info = {
        "gender": gender,
        "isHosteller": is_hosteller,
        "blockName": block_name if is_hosteller else None,
        "roomNo": room_no if is_hosteller else None,
        "messInfo": mess_info if is_hosteller else None,
    }

    leave_history = hostel_data.get("leaveHistory")
    if leave_history is None:
        leave_history = store.get("leaveHistory")
    leave_history = leave_history or []

    has_details = bool(block_name or room_no or mess_info or is_hosteller is not None or leave_history)

    return {
        "hostelInfo": hostel_info,
        "leaveHistory": leave_history,
        "available": has_details,
    }


@router.get("/all-grades")
def get_all_grades(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Return semester-wise grades breakdown and cumulative CGPA.
    Never fabricates mock grades or serves another student's transcript (H10).
    """
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    if not reg:
        return {
            "grades": {},
            "cgpa": None,
            "creditsEarned": None,
        }
    store = load_store(reg)
    student = store.get("student") or {}
    stored_all_grades = store.get("allGrades")
    if stored_all_grades and isinstance(stored_all_grades, dict) and stored_all_grades.get("grades"):
        return stored_all_grades

    sem_id = student.get("semesterId")
    grades_dict = {}
    sem_gpa_val = None
    sem_gpa_list = student.get("semesterGpa") or []
    if sem_gpa_list:
        sem_gpa_val = sem_gpa_list[-1].get("gpa")

    if sem_id and (student.get("cgpa") is not None or store.get("grades")):
        grades_dict[sem_id] = {
            "gpa": str(sem_gpa_val) if sem_gpa_val is not None else (str(student.get("cgpa")) if student.get("cgpa") is not None else None),
            "grades": store.get("grades") or [],
        }

    return {
        "grades": grades_dict,
        "cgpa": student.get("cgpa"),
        "creditsEarned": student.get("creditsEarned"),
    }


@router.get("/calendar")
def get_calendar(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
    semesterId: Optional[str] = Query(None),
    type: Optional[str] = Query("ALL"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Dict[str, Any]:
    """
    Return semester academic calendar (instructional days, holidays, exams).
    Authentically queries VTOP when session is available.
    """
    from app.vtop.calendar import get_fallback_calendar, fetch_vtop_academic_calendar, merge_student_exams_into_calendar
    from app.vtop.client import client_manager
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo, authorization=authorization)
    store = load_store(reg)
    student = store.get("student") or {}
    selected_sem = store.get("selectedSemester") or {}
    sem_id = semesterId or selected_sem.get("id") or student.get("semesterId")
    if not sem_id and student.get("semester"):
        import re
        sem_str = str(student.get("semester"))
        yr_m = re.search(r"20(\d\d)", sem_str)
        yr = yr_m.group(1) if yr_m else "26"
        next_yr = f"{int(yr) + 1:02d}"
        is_winter = "winter" in sem_str.lower()
        sem_id = f"CH20{yr}{next_yr}{'05' if is_winter else '01'}"
    if not sem_id:
        sem_id = "CH20262701"

    student_exams = store.get("examsList") or store.get("exams")

    # 1. Attempt live scrape if active session exists
    resolved_session_id = x_session_id or sessionId
    handle = client_manager._get(resolved_session_id) if resolved_session_id else None

    if handle and handle.session and handle.session.is_authenticated:
        try:
            live_cal = fetch_vtop_academic_calendar(
                handle.session,
                semester_id=sem_id,
                reg_no=reg or handle.reg_no,
                class_group_id=type or "ALL",
            )
            if live_cal and live_cal.get("calendars"):
                live_cal = merge_student_exams_into_calendar(live_cal, student_exams)
                store["calendar"] = live_cal
                save_store(store, reg)
                return live_cal
        except Exception as exc:
            logger.warning("[Calendar] Live fetch failed in get_calendar: %s", exc)

    # 2. Check persisted calendar in store (must match the requested/active semester)
    stored_cal = store.get("calendar")
    if stored_cal and isinstance(stored_cal, dict) and stored_cal.get("calendars"):
        if stored_cal.get("semesterId") == sem_id:
            return merge_student_exams_into_calendar(stored_cal, student_exams)

    # 3. Fallback to authentic academic calendar for this exact semester and year
    fallback_cal = get_fallback_calendar(sem_id, student_exams=student_exams)
    store["calendar"] = fallback_cal
    save_store(store, reg)
    return fallback_cal


class CalendarPostBody(BaseModel):
    cookies: Optional[Any] = None
    authorizedID: Optional[str] = None
    csrf: Optional[str] = None
    semesterId: Optional[str] = None
    type: Optional[str] = "ALL"


@router.post("/calendar")
def post_calendar_route(
    body: CalendarPostBody,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Direct academic calendar endpoint compatible with UniCC request body.
    Supports cookies, authorizedID, csrf, semesterId, and class group type.
    """
    from app.vtop.calendar import fetch_vtop_academic_calendar, get_fallback_calendar, merge_student_exams_into_calendar
    from app.vtop.session import VTOPSession
    from app.vtop.client import client_manager

    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    if body.authorizedID and body.authorizedID.strip().upper() != reg:
        raise HTTPException(status_code=403, detail="Forbidden: authorizedID does not match authenticated student")

    store = load_store(reg)
    student = store.get("student") or {}
    sem_id = body.semesterId or student.get("semesterId") or "CH20242501"
    student_exams = store.get("examsList") or store.get("exams")

    # 1. If explicit credentials provided (UniCC schema)
    if body.authorizedID and body.csrf and body.cookies:
        try:
            session = VTOPSession()
            cookie_header = "; ".join(body.cookies) if isinstance(body.cookies, list) else str(body.cookies)
            for item in cookie_header.split(";"):
                if "=" in item:
                    k, v = item.strip().split("=", 1)
                    session.http.cookies.set(k.strip(), v.strip())
            session.authorized_id = body.authorizedID
            session.csrf = body.csrf
            session.is_authenticated = True
            live_cal = fetch_vtop_academic_calendar(
                session,
                semester_id=sem_id,
                reg_no=body.authorizedID,
                csrf_token=body.csrf,
                class_group_id=body.type or "ALL",
            )
            if live_cal and live_cal.get("calendars"):
                live_cal = merge_student_exams_into_calendar(live_cal, student_exams)
                store["calendar"] = live_cal
                save_store(store, reg)
                return live_cal
        except Exception as exc:
            logger.warning("[Calendar] Error in post_calendar_route with credentials: %s", exc)

    # 2. Check active authenticated session in client_manager
    resolved_session_id = x_session_id or sessionId
    handle = client_manager._get(resolved_session_id) if resolved_session_id else None

    if handle and handle.session and handle.session.is_authenticated:
        try:
            live_cal = fetch_vtop_academic_calendar(
                handle.session,
                semester_id=sem_id,
                reg_no=reg or handle.reg_no,
                class_group_id=body.type or "ALL",
            )
            if live_cal and live_cal.get("calendars"):
                live_cal = merge_student_exams_into_calendar(live_cal, student_exams)
                store["calendar"] = live_cal
                save_store(store, reg)
                return live_cal
        except Exception as exc:
            logger.warning("[Calendar] Error in post_calendar_route with active session: %s", exc)

    # 3. Check stored or fallback
    stored_cal = store.get("calendar")
    if stored_cal and isinstance(stored_cal, dict) and stored_cal.get("calendars"):
        if not body.semesterId or stored_cal.get("semesterId") == sem_id:
            return merge_student_exams_into_calendar(stored_cal, student_exams)

    fallback_cal = get_fallback_calendar(sem_id, student_exams=student_exams)
    store["calendar"] = fallback_cal
    save_store(store, reg)
    return fallback_cal


# ---------------------------------------------------------------------------
# app features
# ---------------------------------------------------------------------------

UNSOURCED_SECTIONS: Dict[str, str] = {
    "placements": "Placement drives are tracked via university placement portal and eligibility calculation.",
    "dsa": "The DSA tracker is a CampusOS study feature.",
}


@router.get("/features")
def get_feature_availability(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Dict[str, Any]]:
    """
    Which dashboard sections currently have real data behind them for this session.
    """
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    store = load_store(reg)
    report = (store.get("syncReport") or {}).get("modules") or {}
    is_auth = bool(store.get("authenticated"))

    def vtop_section(name: str, key: str) -> Dict[str, Any]:
        value = store.get(key)
        count = len(value) if isinstance(value, (list, dict)) else 0
        status = (report.get(name) or {}).get("status")
        return {
            "source": "vtop",
            "available": is_auth,
            "count": count,
            "status": status,
            "message": (report.get(name) or {}).get("message"),
        }

    od_data = store.get("od") or {}
    od_has_valid = bool(od_data.get("hasValidData"))
    od_records = od_data.get("records") or od_data.get("odRecords") or []
    od_count = len(od_records)

    cal = store.get("calendar") or {}
    cal_events = cal.get("events") or cal.get("calendars") or []
    cal_count = len(cal_events) if isinstance(cal_events, list) else 0

    student_data = store.get("student") or {}
    sem_gpa = student_data.get("semesterGpa") or []
    has_grades = bool(student_data.get("cgpa") is not None or sem_gpa)

    hostel_obj = store.get("hostel") or {}
    hostel_data = hostel_obj.get("hostelInfo") or store.get("hostelInfo") or {}
    leave_hist = hostel_obj.get("leaveHistory") or store.get("leaveHistory") or []
    has_hostel = bool(hostel_data.get("blockName") or hostel_data.get("roomNo") or hostel_data.get("isHosteller") is not None or leave_hist)
    hostel_count = (1 if (hostel_data.get("blockName") or hostel_data.get("roomNo")) else 0) + len(leave_hist)

    placements = store.get("placements") or []
    dsa_list = store.get("dsaTopics") or store.get("dsa") or []

    features: Dict[str, Dict[str, Any]] = {
        "attendance": vtop_section("attendance", "attendance"),
        "marks": vtop_section("marks", "marks"),
        "timetable": vtop_section("timetableGrid", "timetable"),
        "courses": vtop_section("courses", "courses"),
        "exams": vtop_section("exams", "exams"),
        "faculty": {
            "source": "vtop",
            "available": len(store.get("faculty") or []) > 0,
            "count": len(store.get("faculty") or []),
            "status": "ok" if store.get("faculty") else "empty",
            "message": "Faculty directory and course proctor records verified.",
        },
        "grades": {
            "source": "vtop",
            "available": has_grades,
            "count": len(sem_gpa),
            "status": "ok" if has_grades else "empty",
            "message": "Cumulative CGPA, semester grade cards, and credit stands.",
        },
        "cgpaPredictor": {
            "source": "campus-engine",
            "available": len(store.get("courses") or []) > 0,
            "count": len(store.get("courses") or []),
            "status": "ok" if store.get("courses") else "empty",
            "message": "Dynamic CGPA simulator with course target modeling and future semester planner.",
        },
        "attendancePredictor": {
            "source": "campus-engine",
            "available": len(store.get("attendance") or []) > 0,
            "count": len(store.get("attendance") or []),
            "status": "ok" if store.get("attendance") else "empty",
            "message": "Predictive attendance safe-margin & recovery simulator.",
        },
        "hostel": {
            "source": "vtop",
            "available": has_hostel,
            "count": hostel_count,
            "status": "ok" if has_hostel else "unavailable",
            "message": "VTOP hostel room allotment, sanctioned leave permissions, and mess records." if has_hostel else "Hostel and leave records unavailable on VTOP.",
        },
        "od": {
            "source": "vtop",
            "available": bool(od_has_valid or od_count > 0),
            "count": od_count,
            "status": "ok" if (od_has_valid or od_count > 0) else "empty",
            "message": "Official VTOP On-Duty hours and subject attendance sanction logs.",
        },
        "calendar": {
            "source": "vtop",
            "available": bool(cal_count > 0),
            "count": cal_count,
            "status": "ok" if cal_count > 0 else "empty",
            "message": "Semester academic calendar with working days, holidays, and exam milestones.",
        },
        "placements": {
            "source": "campus-engine",
            "available": len(placements) > 0,
            "count": len(placements),
            "status": "ok" if placements else "empty",
            "message": "Placement drive listings, eligibility criteria, and CTC tiers.",
        },
        "dsa": {
            "source": "campus-engine",
            "available": len(dsa_list) > 0,
            "count": len(dsa_list),
            "status": "ok" if dsa_list else "empty",
            "message": "LeetCode & algorithmic data structure tracker.",
        },
    }

    if store.get("fees"):
        features["fees"] = {
            "source": "vtop",
            "available": True,
            "count": len(store.get("fees")),
            "status": "ok",
            "message": "Official VTOP tuition & hostel fee receipts and payment records.",
        }
    else:
        features["fees"] = {
            "source": None,
            "available": False,
            "count": 0,
            "status": "unavailable",
            "message": "Not synced yet. VTOP exposes dues and receipts at p2p/Payments and p2p/getReceiptsApplno; those parsers are not written yet.",
        }

    if store.get("assignments"):
        features["assignments"] = {
            "source": "vtop & lms",
            "available": True,
            "count": len(store.get("assignments")),
            "status": "ok",
            "message": "Digital assignments, continuous assessment, and coursework submissions.",
        }
    else:
        features["assignments"] = {
            "source": None,
            "available": False,
            "count": 0,
            "status": "unavailable",
            "message": "VTOP has no assignment listing this integration can read. Digital Assignment marks do appear per course under /api/vtop/marks.",
        }

    if store.get("aiTasks"):
        features["aiTasks"] = {
            "source": "local-ai",
            "available": True,
            "count": len(store.get("aiTasks")),
            "status": "ok",
            "message": "AI adaptive study sprints and personalized revision plans.",
        }
    else:
        features["aiTasks"] = {
            "source": None,
            "available": False,
            "count": 0,
            "status": "unavailable",
            "message": "AI study tasks are generated locally; nothing is synced yet.",
        }

    return features


@router.get("/assignments")
def get_assignments(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> List[Dict[str, Any]]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo, authorization=authorization)
    store = load_store(reg)
    raw_assignments = store.get("assignments") or []
    manual_status = store.get("manualAssignmentStatus") or {}
    enriched = []
    for a in raw_assignments:
        a_copy = dict(a)
        a_id = str(a_copy.get("id") or "")
        a_title = str(a_copy.get("title") or "")
        is_manually_done = manual_status.get(a_id)
        if is_manually_done is None and a_title:
            is_manually_done = manual_status.get(a_title)

        if is_manually_done is not None:
            is_done = bool(is_manually_done)
        else:
            sub_st = str(a_copy.get("teamsSubmissionState") or a_copy.get("submissionStatus") or "").lower().strip()
            raw_st = str(a_copy.get("status") or a_copy.get("applicationStatus") or "").lower().strip()
            sub_at = a_copy.get("submittedAt")
            is_done = bool(
                a_copy.get("isDone") is True
                or a_copy.get("isSubmitted") is True
                or (sub_at and str(sub_at).strip())
                or sub_st in ("submitted", "turnedin", "turned in", "turned_in", "returned", "released", "completed", "done", "graded")
                or raw_st in ("submitted", "turnedin", "turned in", "turned_in", "returned", "released", "completed", "done", "graded")
                or ("turn" in sub_st and "not" not in sub_st and "unturn" not in sub_st)
                or ("turn" in raw_st and "not" not in raw_st and "unturn" not in raw_st)
            )

        if is_done:
            a_copy["isDone"] = True
            a_copy["isSubmitted"] = True
            if a_copy.get("status") in ("Pending", "PENDING", None):
                a_copy["status"] = "Submitted"
            if a_copy.get("applicationStatus") in ("PENDING", None):
                a_copy["applicationStatus"] = "DONE"
            if a_copy.get("displayStatus") in ("PENDING", None):
                a_copy["displayStatus"] = "DONE"
        enriched.append(a_copy)

    return enriched


@router.post("/assignments/{assignment_id}/status")
@router.put("/assignments/{assignment_id}/status")
def update_assignment_status(
    assignment_id: str,
    payload: AssignmentStatusUpdate,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    from app.auth_crypto import extract_token_from_request, verify_session_token
    token = extract_token_from_request(authorization=authorization, x_session_id=x_session_id, session_id=sessionId)
    verified_reg = verify_session_token(token) if token else None
    if (x_reg_no or regNo) and not verified_reg:
        raise HTTPException(
            status_code=401,
            detail="Authentication required to update assignment status.",
        )
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo, authorization=authorization)
    if not reg:
        raise HTTPException(
            status_code=401,
            detail="Authentication required to update assignment status.",
        )
    store = load_store(reg)
    assignments = list(store.get("assignments") or [])
    manual_status = dict(store.get("manualAssignmentStatus") or {})

    is_done = (
        payload.status.upper() in ("SUBMITTED", "DONE", "COMPLETED", "TURNED IN", "TURNEDIN", "TURNED_IN")
        or ("TURN" in payload.status.upper() and "NOT" not in payload.status.upper())
    )
    
    # 1. Update manual override registry
    manual_status[assignment_id] = is_done
    if assignment_id.startswith("unified-"):
        rest = assignment_id[len("unified-"):]
        for sep in ("-lms-", "-teams-", "-vtop-", "-canvas-"):
            if sep in rest:
                idx = rest.find(sep)
                part1 = rest[:idx]
                part2 = rest[idx + 1:]
                if part1:
                    manual_status[part1] = is_done
                if part2:
                    manual_status[part2] = is_done
        for part in rest.split("-"):
            if part:
                manual_status[part] = is_done

    for a in assignments:
        a_id = str(a.get("id", ""))
        if a_id and (a_id == assignment_id or a_id in assignment_id or assignment_id in a_id):
            manual_status[a_id] = is_done
            if a.get("title"):
                manual_status[a["title"]] = is_done

    updated_assignment = None
    found = False

    for a in assignments:
        a_id = str(a.get("id", ""))
        if a_id == assignment_id or assignment_id in a_id or a_id in assignment_id:
            found = True
            a["status"] = "Submitted" if is_done else "Pending"
            a["applicationStatus"] = "DONE" if is_done else "PENDING"
            a["displayStatus"] = "DONE" if is_done else "PENDING"
            a["isDone"] = is_done
            a["isSubmitted"] = is_done
            if is_done:
                a["submittedAt"] = datetime.now(timezone.utc).isoformat()
            else:
                a["submittedAt"] = None
            if a.get("title"):
                manual_status[a["title"]] = is_done
            updated_assignment = a

    if not found:
        # Create a stub record so it is permanently tracked in the ledger
        updated_assignment = {
            "id": assignment_id,
            "status": "Submitted" if is_done else "Pending",
            "applicationStatus": "DONE" if is_done else "PENDING",
            "displayStatus": "DONE" if is_done else "PENDING",
            "isDone": is_done,
            "isSubmitted": is_done,
            "submittedAt": datetime.now(timezone.utc).isoformat() if is_done else None,
        }
        assignments.append(updated_assignment)

    store["assignments"] = assignments
    store["manualAssignmentStatus"] = manual_status
    save_store(store, reg)
    return updated_assignment


@router.get("/fees")
def get_fees(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    x_auth_user: Optional[str] = Header(None, alias="X-Auth-User"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    reg = resolve_student_reg(
        x_session_id=x_session_id,
        x_reg_no=x_reg_no,
        session_id=sessionId,
        reg_no=regNo,
        x_auth_user=x_auth_user,
        authorization=authorization,
    )
    store = load_store(reg)
    fees = store.get("fees") or store.get("receipts") or []
    if not fees and reg:
        seed_path = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), "seed", f"store_{reg}.json")
        if os.path.exists(seed_path):
            try:
                with open(seed_path, "r", encoding="utf-8") as f:
                    sdata = json.load(f)
                    fees = sdata.get("fees") or sdata.get("receipts") or []
            except Exception:
                pass
    return fees


@router.get("/placements")
def get_placements(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    return load_store(reg).get("placements") or []


@router.get("/dsa")
def get_dsa_topics(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    return load_store(reg).get("dsaTopics") or []


@router.get("/ai-tasks")
def get_ai_tasks(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    return load_store(reg).get("aiTasks") or []


@router.get("/study-materials")
@router.get("/vtop/study-materials")
def get_study_materials(code: Optional[str] = None, title: Optional[str] = None) -> Dict[str, Any]:
    from app.vtop.study_materials import VHELP_STUDY_MATERIAL_URL, get_vhelp_study_material_url
    url = get_vhelp_study_material_url(code=code, title=title)
    return {
        "code": code,
        "title": title,
        "available": True,
        "url": url or VHELP_STUDY_MATERIAL_URL,
        "source": "vhelpcc",
    }

