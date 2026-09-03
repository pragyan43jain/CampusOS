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

import logging
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Header, HTTPException, Query
from pydantic import BaseModel

from app.storage import empty_store, load_store, save_store
from app.vtop.hostel import fetch_laundry_schedule, fetch_mess_menu
from app.routers.auth import normalize_marks_item, normalize_faculty_item, resolve_student_reg

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
    return load_store(reg).get("attendance") or []


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
) -> Dict[str, List[Dict[str, Any]]]:
    """Grouped by exam type, matching ``/api/vtop/exams``."""
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    exams = load_store(reg).get("exams")
    return exams if isinstance(exams, dict) else {}


@router.get("/receipts")
def get_receipts() -> List[Dict[str, Any]]:
    return load_store().get("receipts") or []


@router.get("/dues")
def get_dues() -> Dict[str, Any]:
    return load_store().get("dues") or {"hasDues": False, "totalDue": 0.0, "items": []}


@router.get("/spotlight")
def get_spotlight() -> List[Dict[str, Any]]:
    return load_store().get("spotlight") or []


@router.get("/proctor")
def get_proctor() -> Optional[Dict[str, Any]]:
    return load_store().get("proctor")


@router.get("/hostel/mess")
def get_hostel_mess(type: str = "M-N") -> List[Dict[str, Any]]:
    return fetch_mess_menu(type)


@router.get("/hostel/laundry")
def get_hostel_laundry(block: str = "A") -> List[Dict[str, Any]]:
    return fetch_laundry_schedule(block)


# ---------------------------------------------------------------------------
# app features
# ---------------------------------------------------------------------------

UNSOURCED_SECTIONS: Dict[str, str] = {
    "placements": "Placement drives are tracked via university placement portal and eligibility calculation.",
    "dsa": "The DSA tracker is a CampusOS study feature.",
}


@router.get("/features")
def get_feature_availability() -> Dict[str, Dict[str, Any]]:
    """
    Which dashboard sections currently have real data behind them.
    """
    store = load_store()
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
    od_count = len(od_data.get("records") or od_data.get("odRecords") or [])

    features: Dict[str, Dict[str, Any]] = {
        "attendance": vtop_section("attendance", "attendance"),
        "marks": vtop_section("marks", "marks"),
        "timetable": vtop_section("timetableGrid", "timetable"),
        "courses": vtop_section("courses", "courses"),
        "exams": vtop_section("exams", "exams"),
        "od": {
            "source": "vtop" if od_has_valid else None,
            "available": is_auth and od_has_valid,
            "count": od_count,
            "status": (report.get("od") or {}).get("status") or (od_data.get("state") if od_has_valid else "unavailable"),
            "message": (report.get("od") or {}).get("message") or od_data.get("message"),
        },
    }

    if store.get("fees"):
        features["fees"] = {
            "source": "vtop",
            "available": True,
            "count": len(store.get("fees")),
            "status": "ok",
            "message": None,
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
            "source": "vtop",
            "available": True,
            "count": len(store.get("assignments")),
            "status": "ok",
            "message": None,
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
            "message": None,
        }
    else:
        features["aiTasks"] = {
            "source": None,
            "available": False,
            "count": 0,
            "status": "unavailable",
            "message": "AI study tasks are generated locally; nothing is synced yet.",
        }

    for key, reason in UNSOURCED_SECTIONS.items():
        features[key] = {
            "source": None,
            "available": False,
            "count": 0,
            "status": "unavailable",
            "message": reason,
        }
    return features


@router.get("/assignments")
def get_assignments() -> List[Dict[str, Any]]:
    return load_store().get("assignments") or []


@router.post("/assignments/{assignment_id}/status")
def update_assignment_status(
    assignment_id: str, payload: AssignmentStatusUpdate
) -> Dict[str, Any]:
    store = load_store()
    assignments = store.get("assignments") or []
    for assignment in assignments:
        if assignment.get("id") == assignment_id:
            assignment["status"] = payload.status
            if payload.status == "Submitted":
                assignment["applicationStatus"] = "DONE"
                assignment["isDone"] = True
                assignment["isSubmitted"] = True
            elif payload.status == "Pending":
                assignment["applicationStatus"] = "PENDING"
                assignment["isDone"] = False
                assignment["isSubmitted"] = False
            save_store(store)
            return assignment
    raise HTTPException(status_code=404, detail=f"No assignment {assignment_id}")


@router.get("/fees")
def get_fees() -> List[Dict[str, Any]]:
    return load_store().get("fees") or []


@router.get("/placements")
def get_placements() -> List[Dict[str, Any]]:
    return load_store().get("placements") or []


@router.get("/dsa")
def get_dsa_topics() -> List[Dict[str, Any]]:
    return load_store().get("dsaTopics") or []


@router.get("/ai-tasks")
def get_ai_tasks() -> List[Dict[str, Any]]:
    return load_store().get("aiTasks") or []


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

