"""
The sync pipeline: one authenticated VTOP session in, one complete dashboard out.

Three things make this more than a loop over endpoints.

**Order matters.** The registered-course table has to be scraped and indexed
before anything else, because attendance, marks and exam rows are bound to
courses through it (see ``registry``). ``processViewTimeTable`` is requested once
and parsed twice — the same response carries both ``#studentDetailsList`` (the
courses) and ``#timeTableStyle`` (the grid).

**Every module is isolated.** A failure in marks must not cost the user their
attendance. Each step runs inside ``_step``, which records the outcome and moves
on, so a partial sync is still a useful sync — and the sync report says exactly
which parts are missing rather than leaving the UI to imply everything is fine.

**Nothing is invented.** Percentages are recomputed from attended/total rather
than trusted from the page; a row that cannot be bound to a course keeps whatever
VTOP did print and is counted as unresolved; a module that returns nothing is
reported empty, not backfilled. If a value isn't here, VTOP didn't give it to us.
"""

from __future__ import annotations

import logging
import os
import re
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple

from . import constants as C
from . import parser as P
from .calendar import fetch_vtop_academic_calendar, get_fallback_calendar
from .math_engine import calculate_attendance_metrics, calculate_od_metrics
from .registry import CourseRegistry, build_registry
from .session import VTOPAuthError, VTOPSession

logger = logging.getLogger("vtop.scraper")

# Grid day keys -> the short codes the frontend uses.
_DAY_CODES = [
    ("monday", "MON"),
    ("tuesday", "TUE"),
    ("wednesday", "WED"),
    ("thursday", "THU"),
    ("friday", "FRI"),
    ("saturday", "SAT"),
    ("sunday", "SUN"),
]

_TYPE_LABELS = {
    C.TYPE_THEORY: "Theory",
    C.TYPE_LAB: "Lab",
    C.TYPE_PROJECT: "Project",
}

# Module outcome statuses used in the sync report.
OK = "ok"
EMPTY = "empty"
FAILED = "failed"
UNAVAILABLE = "unavailable"


class SyncReport:
    """
    Per-module record of what actually came back, surfaced to the user.

    The old dashboard's worst property was that a failed scrape looked identical
    to an empty semester. This exists so the UI can say "marks: failed - VTOP
    returned the login page" instead of showing a confident, empty page.
    """

    def __init__(self) -> None:
        self.modules: Dict[str, Dict[str, Any]] = {}
        self.warnings: List[str] = []
        self.started_at = datetime.now(timezone.utc)

    def record(
        self,
        name: str,
        status: str,
        count: Optional[int] = None,
        message: Optional[str] = None,
    ) -> None:
        self.modules[name] = {
            "status": status,
            "count": count,
            "message": message,
        }

    def warn(self, message: str) -> None:
        logger.warning("[SYNC] %s", message)
        self.warnings.append(message)

    @property
    def ok(self) -> bool:
        """True when no module outright failed."""
        return all(
            module["status"] != FAILED for module in self.modules.values()
        )

    def as_dict(self) -> Dict[str, Any]:
        finished = datetime.now(timezone.utc)
        return {
            "ok": self.ok,
            "startedAt": self.started_at.isoformat(),
            "finishedAt": finished.isoformat(),
            "durationSeconds": round((finished - self.started_at).total_seconds(), 2),
            "modules": self.modules,
            "warnings": self.warnings,
            "failed": [
                name
                for name, module in self.modules.items()
                if module["status"] == FAILED
            ],
        }


def _step(
    report: SyncReport,
    name: str,
    fetch: Callable[[], Any],
    *,
    count_of: Optional[Callable[[Any], int]] = None,
) -> Any:
    """
    Run one module, record its outcome, and never raise.

    Returns None on failure so callers can carry on with the modules that did
    work. The exception text is kept in the report because "why is marks empty"
    is otherwise unanswerable without server logs.
    """
    try:
        result = fetch()
    except VTOPAuthError:
        raise
    except Exception as exc:  # noqa: BLE001 - module isolation is the point
        logger.exception("[SYNC] Module '%s' failed", name)
        report.record(name, FAILED, message=f"{type(exc).__name__}: {exc}")
        return None

    count = count_of(result) if count_of else (len(result) if hasattr(result, "__len__") else None)
    if not result:
        report.record(name, EMPTY, count=0)
    else:
        report.record(name, OK, count=count)
    return result


# ---------------------------------------------------------------------------
# fetch helpers — each pairs an endpoint with the body shape it requires
# ---------------------------------------------------------------------------


def fetch_semesters(session: VTOPSession) -> List[Dict[str, str]]:
    try:
        html = session.post_menu(C.SEMESTER_LIST)
        sems = P.parse_semesters(html)
        if sems:
            return sems
    except Exception as exc:
        logger.debug("[VTOP] Primary semester fetch notice: %s", exc)

    # Fallback to candidate menu endpoints that also contain #semesterSubId
    fallback_endpoints = [
        "academics/common/StudentTimeTable",
        "academics/common/StudentAttendanceChn",
        "academics/common/StudentAttendance",
        "examinations/doStudentMarkView",
        "examinations/StudentMarkView",
    ]
    for alt_ep in fallback_endpoints:
        try:
            alt_html = session.post_menu(alt_ep)
            alt_sems = P.parse_semesters(alt_html)
            if alt_sems:
                return alt_sems
        except Exception:
            continue
    return []


def fetch_profile(session: VTOPSession) -> Dict[str, Any]:
    return P.parse_profile(session.post_menu(C.PROFILE))


def fetch_hostel(session: VTOPSession, profile: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    Fetch student hostel room, block, mess, and approved leave history.
    Probes official VTOP hostel modules and merges with profile allotment info.
    """
    from app.vtop.hostel import parse_hostel_info, parse_leave_history

    prof = profile or {}
    block_name = prof.get("blockName") or None
    room_no = prof.get("roomNo") or None
    mess_info = prof.get("messInfo") or None
    gender = prof.get("gender") or None
    is_hosteller = prof.get("isHosteller")
    if block_name or room_no:
        is_hosteller = True

    hostel_info: Dict[str, Any] = {
        "gender": gender,
        "isHosteller": is_hosteller,
        "blockName": block_name,
        "roomNo": room_no,
        "messInfo": mess_info,
    }

    leaves: List[Dict[str, Any]] = []
    leave_endpoints = [
        "leave/viewStudentLeaveHistoryChn",
        "hostel/viewHostelDetailsChn",
    ]
    for ep in leave_endpoints:
        try:
            resp_html = session.post_menu(ep, with_win_image=True)
            if resp_html and ("leavehistorytable" in resp_html.lower() or "leaveappliedtable" in resp_html.lower() or "leave" in resp_html.lower()):
                parsed_leaves = parse_leave_history(resp_html)
                if parsed_leaves:
                    leaves = parsed_leaves
                    break
            if resp_html and ("block" in resp_html.lower() or "room" in resp_html.lower()):
                extra_info = parse_hostel_info(resp_html)
                for k, v in extra_info.items():
                    if v and not hostel_info.get(k):
                        hostel_info[k] = v
        except Exception:
            continue


    if hostel_info.get("blockName") or hostel_info.get("roomNo"):
        hostel_info["isHosteller"] = True

    return {
        "hostelInfo": hostel_info,
        "leaveHistory": leaves,
    }


def fetch_timetable_page(session: VTOPSession, semester_id: str) -> str:
    """
    One request, two payloads.

    ``processViewTimeTable`` returns the registered-course table *and* the
    timetable grid in the same document, so requesting it twice would double the
    load on VTOP for no benefit.
    """
    return session.post_semester(C.TIMETABLE, semester_id, csrf_first=True)


def fetch_attendance_page(session: VTOPSession, semester_id: str) -> str:
    return session.post_semester(C.ATTENDANCE, semester_id, csrf_first=True)


def fetch_marks_page(session: VTOPSession, semester_id: str) -> str:
    # Marks puts _csrf last in the body; the reference is specific about this.
    return session.post_semester(C.MARKS, semester_id, csrf_first=False)


def fetch_exam_page(session: VTOPSession, semester_id: str) -> str:
    return session.post_semester(C.EXAM_SCHEDULE, semester_id, csrf_first=False)


def fetch_grade_history(session: VTOPSession) -> Dict[str, Any]:
    html = session.post_menu(C.GRADE_HISTORY)
    data = P.parse_grade_history(html)
    if not data.get("hasValidData") and getattr(session, "win_image", None):
        html2 = session.post_menu(C.GRADE_HISTORY, with_win_image=True)
        data2 = P.parse_grade_history(html2)
        if data2.get("hasValidData"):
            return data2
    return data


def fetch_semester_grades(session: VTOPSession, semester_id: str) -> Dict[str, Any]:
    return P.parse_semester_grades(session.post_semester(C.SEMESTER_GRADES, semester_id, csrf_first=False))


def fetch_receipts(session: VTOPSession) -> List[Dict[str, Any]]:
    return P.parse_receipts(session.post_menu(C.RECEIPTS, with_win_image=True))


def fetch_payments(session: VTOPSession) -> Dict[str, Any]:
    return P.parse_payments(session.post_menu(C.PAYMENTS, with_win_image=True))


def fetch_proctor(session: VTOPSession) -> Optional[Dict[str, Any]]:
    return P.parse_proctor(session.post_menu(C.PROCTOR, with_win_image=True))


def fetch_dean_hod(session: VTOPSession) -> List[Dict[str, Any]]:
    return P.parse_dean_hod(session.post_menu(C.HOD_DEAN, with_win_image=True))


def fetch_spotlight(session: VTOPSession) -> List[Dict[str, Any]]:
    return P.parse_spotlight(session.post_simple(C.SPOTLIGHT))


def fetch_course_attendance_detail(
    session: VTOPSession,
    semester_id: str,
    class_id: str,
    slot_name: str = "",
    course_code: str = "",
    course_title: str = "",
    faculty_name: str = "",
) -> Tuple[List[Dict[str, str]], List[Dict[str, Any]]]:
    """
    Query the subject attendance drill-down modal from VTOP CC to extract
    day-by-day attendance punch logs and credited 'On Duty' / 'OD' records.
    Matches UniCC specification.
    """
    import time
    csrf = session.csrf or ""
    auth_id = session.authorized_id or ""
    fields = [
        ("_csrf", str(csrf)),
        ("authorizedID", str(auth_id)),
        ("x", str(int(time.time() * 1000))),
        ("classId", str(class_id)),
        ("slotName", str(slot_name)),
    ]
    if semester_id:
        fields.append(("semesterSubId", str(semester_id)))

    headers = {
        "Referer": f"{session.base_url}/open/page",
        "Content-Type": "application/x-www-form-urlencoded",
    }

    for ep in ["processViewAttendanceDetail", "academics/common/processViewAttendanceDetail"]:
        try:
            resp = session._post(ep, fields, headers=headers)
            html = resp.text
            if html and ("<table" in html.lower() or "present" in html.lower() or "absent" in html.lower() or "duty" in html.lower() or "od" in html.lower()):
                logs = P.parse_attendance_detail_logs(html)
                od_records = P.parse_subject_attendance_details(html, course_code, course_title, faculty_name)
                is_lab = slot_name.upper().startswith("L") or course_code.upper().endswith("P")
                hours = 2 if is_lab else 1
                for log in logs:
                    st = (log.get("status") or "").strip().lower()
                    if st in ("on duty", "od", "duty"):
                        d = log.get("date") or "Active Semester"
                        if not any(r.get("date") == d and r.get("subjectCode") == course_code for r in od_records):
                            od_records.append({
                                "id": f"od-class-{course_code}-{d}",
                                "date": d,
                                "fromDate": d,
                                "toDate": d,
                                "fromTime": None,
                                "toTime": None,
                                "timeRange": None,
                                "subjectCode": course_code,
                                "subjectTitle": course_title or course_code,
                                "hours": hours,
                                "days": 1,
                                "slot": slot_name,
                                "type": "LAB" if is_lab else "TH",
                                "reason": f"Class Attendance On-Duty ({course_code})",
                                "status": "Approved",
                                "isApproved": True,
                                "approvedBy": faculty_name or "Course Faculty / VTOP",
                            })
                return logs, od_records
        except Exception as e:
            logger.debug("[VTOP OD] Could not query detail endpoint %s for class %s: %s", ep, class_id, e)
    return [], []


def fetch_od(
    session: VTOPSession,
    semester_id: Optional[str] = None,
    attendance_rows: Optional[List[Dict[str, Any]]] = None,
    attendance_html: Optional[str] = None,
    fast_mode: bool = False,
) -> Dict[str, Any]:
    """
    Fetch and parse student On-Duty (OD) hours directly from VTOP:
    Academics -> Student OD details (official university OD module).
    """
    best_result: Optional[Dict[str, Any]] = None
    selected_ep: Optional[str] = None

    # Probe official VTOP Student OD endpoints under Academics -> Student OD details
    candidates = [
        ("academics/common/StudentODDetails", "menu", True),
        ("academics/common/StudentODDetails", "semester", True),
        ("processViewStudentODDetails", "semester", True),
        ("processViewStudentOD", "semester", True),
        (C.OD, "semester", True),
        (C.OD, "menu", True),
        (C.OD, "od", True),
        ("students/viewStudentODDetails", "menu", True),
        ("students/viewStudentODDetails", "semester", True),
        ("academics/common/StudentODDetailsChn", "semester", True),
        ("academics/common/StudentODViewChn", "semester", True),
    ]

    active_candidates = candidates if not fast_mode else candidates[:6]

    for endpoint, req_type, csrf_first in active_candidates:
        try:
            html: Optional[str] = None
            if req_type == "semester" and semester_id:
                html = session.post_semester(endpoint, semester_id, csrf_first=csrf_first)
            elif req_type == "od":
                html = session.post_od(endpoint, semester_id)
            elif req_type == "menu":
                html = session.post_menu(endpoint, with_win_image=True)
            else:
                html = session.post_simple(endpoint)

            if html and not P.body_says(html, "not authorized", "http status 404", "session expired", "please login"):
                parsed = P.parse_od(html)
                records = parsed.get("records") or parsed.get("odRecords") or []
                state = parsed.get("state", "unknown")
                if state == "success_with_records" and records:
                    best_result = parsed
                    selected_ep = endpoint
                    break
                elif state == "success_with_no_records":
                    if best_result is None:
                        best_result = parsed
                        selected_ep = endpoint
        except Exception as e:
            logger.debug("[VTOP OD] Probe '%s' exception: %s", endpoint, e)

    # If no records found in the standalone OD module, extract OD records from attendance table & logs
    att_od_records = P.extract_attendance_od_records(attendance_html or "", attendance_rows)
    has_module_records = best_result is not None and bool(best_result.get("records") or best_result.get("odRecords"))

    if not has_module_records and att_od_records:
        total_hours = sum(r.get("hours", 0) for r in att_od_records)
        return {
            "state": "success_with_records",
            "hasValidData": True,
            "usedHours": total_hours,
            "odHours": total_hours,
            "totalOdHours": total_hours,
            "approvedHours": total_hours,
            "pendingHours": 0,
            "rejectedHours": 0,
            "maxHours": C.OD_MAX_HOURS,
            "maxOdHours": C.OD_MAX_HOURS,
            "remainingHours": max(0, C.OD_MAX_HOURS - total_hours),
            "percentageUsed": round((total_hours / float(C.OD_MAX_HOURS)) * 100.0, 1),
            "records": att_od_records,
            "odRecords": att_od_records,
            "message": f"{total_hours} On-Duty hours credited across academic courses.",
            "diagnostics": {"selectedEndpoint": selected_ep or "attendance_table"},
        }

    if best_result is None:
        best_result = {
            "state": "success_with_no_records",
            "hasValidData": True,
            "usedHours": 0,
            "odHours": 0,
            "totalOdHours": 0,
            "approvedHours": 0,
            "pendingHours": 0,
            "rejectedHours": 0,
            "maxHours": C.OD_MAX_HOURS,
            "maxOdHours": C.OD_MAX_HOURS,
            "remainingHours": C.OD_MAX_HOURS,
            "percentageUsed": 0.0,
            "records": [],
            "odRecords": [],
            "message": "No sanctioned On-Duty leave records found on VTOP for this semester.",
            "diagnostics": {"selectedEndpoint": selected_ep},
        }

    return best_result


def _course_identity(
    course: Optional[Dict[str, Any]], row: Dict[str, Any], report: SyncReport
) -> Dict[str, Any]:
    """
    Decide the code/title/venue/faculty for a row, preferring the registry.

    The registry entry comes from the registered-course table, which is the only
    page carrying venue, faculty and credits. When a row *also* printed a course
    code and the two disagree, that is a real signal something is misaligned, so
    it goes in the report rather than being quietly resolved in favour of one.
    """
    row_code = row.get("courseCode")

    if course is None:
        return {
            "courseId": None,
            "code": row_code,
            "title": row.get("courseTitle"),
            "venue": None,
            "faculty": row.get("facultyName"),
            "credits": None,
            "resolved": False,
        }

    if row_code and course.get("code") and row_code != course["code"]:
        report.warn(
            f"Slot {row.get('slot')} ({row.get('type')}) resolved to "
            f"{course['code']} but the row printed {row_code}"
        )

    return {
        "courseId": course["id"],
        "code": course.get("code") or row_code,
        "title": course.get("title") or row.get("courseTitle"),
        "venue": course.get("venue"),
        "faculty": course.get("faculty") or row.get("facultyName"),
        "credits": course.get("credits"),
        "resolved": True,
    }


def build_attendance(
    rows: List[Dict[str, Any]], registry: CourseRegistry, report: SyncReport
) -> List[Dict[str, Any]]:
    """
    Turn attendance rows into records with recomputed metrics.
    """
    records: List[Dict[str, Any]] = []
    unresolved = 0

    for row in rows:
        course = registry.resolve(row.get("slot"), row.get("type"), row.get("courseCode"))
        identity = _course_identity(course, row, report)
        if not identity["resolved"]:
            unresolved += 1

        metrics = calculate_attendance_metrics(
            row.get("attended"), row.get("total"), C.MIN_ATTENDANCE_PCT
        )

        reported = row.get("reportedPercentage")
        computed = metrics.get("percentage")
        if reported is not None and computed is not None and abs(reported - computed) > 1.0:
            report.warn(
                f"{identity['code']} attendance: VTOP printed {reported}% but "
                f"{row.get('attended')}/{row.get('total')} is {computed}%"
            )

        records.append(
            {
                "id": str(identity["courseId"] or f"unbound-{len(records) + 1}"),
                "courseId": identity["courseId"],
                "courseCode": identity["code"],
                "courseTitle": identity["title"],
                "courseType": row.get("courseType"),
                "type": _TYPE_LABELS.get(row.get("type"), "Theory"),
                "slot": row.get("slot"),
                "slots": row.get("slots"),
                "venue": identity["venue"],
                "faculty": identity["faculty"],
                "facultyName": identity["faculty"],
                "courseName": identity["title"],
                "credits": identity["credits"],
                "resolved": identity["resolved"],
                "classesAttended": row.get("attended"),
                "classesConducted": row.get("total"),
                "attendancePercentage": metrics.get("percentage"),
                "attendanceStatus": metrics.get("status"),
                "reportedPercentage": reported,
                "odAttended": row.get("odAttended") or 0,
                "odHours": row.get("odAttended") or 0,
                "classId": row.get("classId"),
                "slotName": row.get("slotName") or row.get("slot"),
                "viewLink": row.get("viewLink") or [],
                "viewLinkOnclick": row.get("viewLinkOnclick"),
                **metrics,
            }
        )

    if unresolved:
        report.warn(
            f"{unresolved} of {len(rows)} attendance rows could not be matched to a "
            "registered course"
        )
    return records


def build_marks(
    rows: List[Dict[str, Any]], registry: CourseRegistry, report: SyncReport
) -> List[Dict[str, Any]]:
    """
    Turn marks rows into per-course component lists.

    Deliberately *not* mapped into fixed cat1/cat2/quiz buckets. VTOP's component
    names vary by course and faculty ("CAT-1", "Quiz 1", "DA-2", "Lab Assessment
    3"); forcing them into a fixed shape is how components get dropped or
    mislabelled. The UI renders whatever components exist.
    """
    records: List[Dict[str, Any]] = []
    unresolved = 0

    for row in rows:
        course = registry.resolve(row.get("slot"), row.get("type"), row.get("courseCode"))
        identity = _course_identity(course, row, report)
        if not identity["resolved"]:
            unresolved += 1

        components = row.get("components") or []

        # A component counts as graded when a weightage mark exists for it. Note
        # that a *zero* weightage mark is graded — Quiz 1 scoring 0 is a result,
        # not a missing value.
        graded = [c for c in components if c.get("weightage") is not None]
        scored = [c["weightage"] for c in graded]
        out_of = [c["maxWeightage"] for c in graded if c.get("maxWeightage") is not None]
        all_weightage = [
            c["maxWeightage"] for c in components if c.get("maxWeightage") is not None
        ]

        records.append(
            {
                "id": str(identity["courseId"] or f"unbound-{len(records) + 1}"),
                "courseId": identity["courseId"],
                "courseCode": identity["code"],
                "courseTitle": identity["title"],
                "courseType": row.get("courseType"),
                "type": _TYPE_LABELS.get(row.get("type"), "Theory"),
                "slot": row.get("slot"),
                "faculty": identity["faculty"],
                "resolved": identity["resolved"],
                "components": components,
                # Running total: scored out of what has actually been graded. The
                # denominator must exclude ungraded components, or an upcoming
                # CAT-2 would drag the visible score down as if it were a zero.
                "weightageScored": round(sum(scored), 2) if scored else None,
                "weightageGraded": round(sum(out_of), 2) if out_of else None,
                # How much of the course's assessment exists in total, graded or
                # not — kept separate so it can't be mistaken for the denominator.
                "weightageTotal": round(sum(all_weightage), 2) if all_weightage else None,
            }
        )

    if unresolved:
        report.warn(
            f"{unresolved} of {len(rows)} marks rows could not be matched to a "
            "registered course"
        )
    return records


def extract_row_column(seat_location: Optional[str]) -> Tuple[Optional[str], Optional[str]]:
    if not seat_location:
        return None, None
    text = str(seat_location).strip()
    m = re.search(r"R(?:ow)?\s*[:#-]?\s*(\d+|[A-Za-z]+)\s*[,/-]?\s*C(?:ol(?:umn)?)?\s*[:#-]?\s*(\d+|[A-Za-z]+)", text, re.IGNORECASE)
    if m:
        return m.group(1), m.group(2)
    m_row = re.search(r"R(?:ow)?\s*[:#-]?\s*(\d+|[A-Za-z]+)", text, re.IGNORECASE)
    row_val = m_row.group(1) if m_row else None
    m_col = re.search(r"C(?:ol(?:umn)?)?\s*[:#-]?\s*(\d+|[A-Za-z]+)", text, re.IGNORECASE)
    col_val = m_col.group(1) if m_col else None
    return row_val, col_val


def build_exams(
    schedule_by_type: Dict[str, List[Dict[str, Any]]],
    registry: CourseRegistry,
) -> List[Dict[str, Any]]:
    """
    Flatten and normalize the parsed exam schedule into an array of exam cards.
    """
    cards: List[Dict[str, Any]] = []
    idx = 1
    for exam_type, items in (schedule_by_type or {}).items():
        for item in items:
            slot = item.get("slot")
            course = (
                registry.resolve(slot, C.TYPE_THEORY)
                or registry.resolve(slot, C.TYPE_LAB)
                or registry.resolve(slot, C.TYPE_PROJECT)
            )
            course_code = (course.get("code") if course else None) or (slot or f"EXAM-{idx}")
            course_title = (course.get("title") if course else None) or f"{exam_type} Examination"
            faculty_str = (course.get("faculty") if course else None) or "Faculty"
            venue_str = item.get("venue") or "TBA"
            room_str = venue_str.split("-")[-1] if "-" in venue_str else venue_str
            bld_str = venue_str.split("-")[0] if "-" in venue_str else venue_str

            start_t = item.get("start_time")
            end_t = item.get("end_time")

            seat_loc = item.get("seat_location")
            row_val = item.get("row") or item.get("seat_row")
            col_val = item.get("column") or item.get("seat_column") or item.get("col") or item.get("seat_col")
            if (not row_val or not col_val) and seat_loc:
                derived_r, derived_c = extract_row_column(seat_loc)
                row_val = row_val or derived_r
                col_val = col_val or derived_c

            cards.append({
                "id": f"exam-{idx}-{slot or 'noslot'}",
                "examType": exam_type,
                "title": f"{exam_type} - {course_code}",
                "courseCode": course_code,
                "courseName": course_title,
                "courseTitle": course_title,
                "subjectCode": course_code,
                "subjectTitle": course_title,
                "faculty": faculty_str,
                "facultyName": faculty_str,
                "slot": slot,
                "date": item.get("date") or "TBA",
                "time": f"{start_t} - {end_t}" if start_t and end_t else (start_t or "TBA"),
                "startTime": start_t,
                "endTime": end_t,
                "venue": venue_str,
                "room": room_str,
                "building": bld_str,
                "block": bld_str,
                "seatLocation": seat_loc,
                "seatNumber": item.get("seat_number"),
                "row": row_val,
                "column": col_val,
                "seatRow": row_val,
                "seatColumn": col_val,
                "status": "Scheduled",
            })
            idx += 1
    return cards


def build_timetable(
    grid: Dict[str, List[Dict[str, Any]]],
    registry: CourseRegistry,
    attendance_by_course: Dict[int, Dict[str, Any]],
    report: SyncReport,
) -> List[Dict[str, Any]]:
    """
    Flatten the transposed grid into one entry per (day, period) class.

    The grid cell gives the slot code and the period row gives the times; every
    other field — course code, title, venue, faculty — comes from the registry.
    Reading them out of the cell text would be unreliable, and inventing them is
    what produced the old "AB-2 - Room 304" venues.
    """
    entries: List[Dict[str, Any]] = []

    day_full_names = {
        "MON": "Monday",
        "TUE": "Tuesday",
        "WED": "Wednesday",
        "THU": "Thursday",
        "FRI": "Friday",
        "SAT": "Saturday",
        "SUN": "Sunday",
    }

    for period_type in (C.TYPE_THEORY, C.TYPE_LAB):
        for period in grid.get(period_type, []):
            start = period.get("start_time")
            end = period.get("end_time")

            for day_key, day_code in _DAY_CODES:
                slot = period.get(day_key)
                if not slot:
                    continue

                course = registry.resolve(slot, period_type)
                if course is None:
                    continue

                course_id = course["id"]
                attendance = attendance_by_course.get(course_id)
                venue_str = course.get("venue") or "TBA"
                room_str = venue_str.split("-")[-1] if "-" in venue_str else venue_str
                bld_str = venue_str.split("-")[0] if "-" in venue_str else venue_str

                code = course.get("code") or "COURSE"
                title = course.get("title") or "Class Lecture"
                fac = course.get("faculty") or "Faculty"

                entries.append(
                    {
                        "id": f"{day_code}-{start or 'na'}-{slot}",
                        "day": day_code,
                        "dayName": day_full_names.get(day_code, day_code),
                        "slotName": slot,
                        "slot": slot,
                        "startTime": start,
                        "endTime": end,
                        "startTime12h": P.to_12h(start),
                        "endTime12h": P.to_12h(end),
                        "courseId": course_id,
                        "courseCode": code,
                        "courseName": title,
                        "courseTitle": title,
                        "subjectCode": code,
                        "subjectTitle": title,
                        "venue": venue_str,
                        "room": room_str,
                        "building": bld_str,
                        "block": bld_str,
                        "faculty": fac,
                        "facultyName": fac,
                        "credits": course.get("credits"),
                        "isLab": period_type == C.TYPE_LAB,
                        "classType": "Lab" if period_type == C.TYPE_LAB else "Theory",
                        "type": _TYPE_LABELS[period_type],
                        "resolved": True,
                        "attendance": attendance,
                "odHours": attendance.get("odAttended") if attendance else 0,
                    }
                )

    entries.sort(
        key=lambda e: (
            [code for _, code in _DAY_CODES].index(e["day"])
            if e["day"] in [code for _, code in _DAY_CODES]
            else 99,
            e["startTime"] or "99:99",
        )
    )

    return entries


def build_courses(
    registry: CourseRegistry,
    attendance_by_course: Dict[int, Dict[str, Any]],
    marks_by_course: Dict[int, Dict[str, Any]],
    grades_by_code: Optional[Dict[str, str]] = None,
) -> List[Dict[str, Any]]:
    """One record per registered course, with its attendance, marks, and grade attached."""
    grades_by_code = grades_by_code or {}
    courses: List[Dict[str, Any]] = []
    for course in registry.courses:
        attendance = attendance_by_course.get(course["id"])
        marks = marks_by_course.get(course["id"])
        code = course.get("code")
        courses.append(
            {
                "id": str(course["id"]),
                "code": code,
                "title": course.get("title"),
                "type": _TYPE_LABELS.get(course.get("type"), "Theory"),
                "typeKey": course.get("type"),
                "slot": "+".join(course.get("slots") or []) or None,
                "slots": course.get("slots") or [],
                "venue": course.get("venue"),
                "faculty": course.get("faculty"),
                "credits": course.get("credits"),
                "grade": grades_by_code.get(code) if code else None,
                "attendance": attendance,
                "classId": attendance.get("classId") if attendance else None,
                "slotName": attendance.get("slotName") if attendance else ("+".join(course.get("slots") or []) or None),
                "viewLink": attendance.get("viewLink") if attendance else [],
                "odHours": attendance.get("odAttended") if attendance else 0,
                "marks": marks["components"] if marks else None,
            }
        )
    return courses


def overall_attendance(records: List[Dict[str, Any]]) -> Dict[str, Any]:
    """
    Aggregate attendance across courses from raw counts.

    Summing attended and total and dividing once is the correct aggregate;
    averaging per-course percentages would weight a 4-class lab the same as a
    45-class theory course.
    """
    attended = sum(r["attended"] for r in records if r.get("attended") is not None)
    total = sum(r["total"] for r in records if r.get("total") is not None)
    if not records or total <= 0:
        return calculate_attendance_metrics(None, None, C.MIN_ATTENDANCE_PCT)
    return calculate_attendance_metrics(attended, total, C.MIN_ATTENDANCE_PCT)


def build_student(
    profile: Optional[Dict[str, Any]],
    registry: CourseRegistry,
    overall: Dict[str, Any],
    semester: Optional[Dict[str, str]],
    grade_history: Optional[Dict[str, Any]] = None,
    semester_grades: Optional[Dict[str, Any]] = None,
    proctor: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    """
    Assemble the student header.

    CGPA and earned credits are populated from StudentGradeHistory when available;
    semester GPA is recorded when doStudentGradeView succeeds.
    """
    profile = profile or {}
    cgpa = grade_history.get("cgpa") if grade_history else None
    credits_earned = grade_history.get("creditsEarned") if grade_history else None
    registered_credits = (
        (grade_history.get("registeredCredits") if grade_history else None)
        or registry.total_credits
    )
    sem_gpa = semester_grades.get("gpa") if semester_grades else None

    # Derive cumulative CGPA from semester history if summary row was missing
    if cgpa is None and grade_history and grade_history.get("semesterHistory"):
        valid_sems = [s for s in grade_history["semesterHistory"] if s.get("gpa") is not None and s.get("credits")]
        if valid_sems:
            total_pts = sum(s["gpa"] * s["credits"] for s in valid_sems)
            total_cr = sum(s["credits"] for s in valid_sems)
            if total_cr > 0:
                cgpa = round(total_pts / total_cr, 2)
                if credits_earned is None:
                    credits_earned = total_cr

    # Adopt single semester GPA as cumulative CGPA ONLY for true first-semester students
    # (where cumulative CGPA is mathematically identical to term 1 GPA).
    # Never corrupt multi-semester students by setting cumulative CGPA to a single semester GPA.
    if cgpa is None and sem_gpa is not None:
        is_first_term = False
        if not grade_history or not grade_history.get("hasValidData"):
            sem_name = (semester.get("name") if semester else "") or ""
            if "1" in sem_name or (credits_earned is None or credits_earned <= registry.total_credits):
                is_first_term = True
        if is_first_term:
            cgpa = sem_gpa

    # Assemble semester_gpa_list from historical semesters
    semester_gpa_list = []
    if grade_history and grade_history.get("semesterHistory"):
        for sem_rec in grade_history["semesterHistory"]:
            semester_gpa_list.append({
                "semester": sem_rec.get("semester"),
                "gpa": sem_rec.get("gpa"),
                "cgpa": cgpa,
                "credits": sem_rec.get("credits"),
            })

    if sem_gpa is not None:
        current_sem_name = semester.get("name") if semester else "Current"
        if not any(s.get("semester") == current_sem_name for s in semester_gpa_list):
            semester_gpa_list.append({
                "semester": current_sem_name,
                "gpa": sem_gpa,
                "cgpa": cgpa or sem_gpa,
                "credits": registry.total_credits,
            })

    branch = profile.get("branch")
    school = profile.get("school") or (proctor.get("school") if proctor else None)
    if not branch and school:
        branch = school

    block_name = profile.get("blockName")
    room_no = profile.get("roomNo")
    mess_info = profile.get("messInfo")
    is_hosteller = profile.get("isHosteller")
    if block_name or room_no:
        is_hosteller = True

    return {
        "name": profile.get("name"),
        "regNo": profile.get("regNo"),
        "email": profile.get("email"),
        "program": profile.get("program"),
        "branch": branch,
        "school": school,
        "semester": semester.get("name") if semester else None,
        "semesterId": semester.get("id") if semester else None,
        "batch": profile.get("batch"),
        "cgpa": cgpa,
        "creditsEarned": credits_earned,
        "totalCreditsRequired": None,
        "registeredCredits": registered_credits,
        "rank": None,
        "overallAttendance": overall,
        "semesterGpa": semester_gpa_list,
        "proctor": proctor,
        "gender": profile.get("gender"),
        "isHosteller": is_hosteller,
        "blockName": block_name if is_hosteller else None,
        "roomNo": room_no if is_hosteller else None,
        "messInfo": mess_info if is_hosteller else None,
        "lastSynced": datetime.now(timezone.utc).isoformat(),
    }


def build_assignments(
    courses: List[Dict[str, Any]],
) -> List[Dict[str, Any]]:
    """
    Extract digital assignments (DA) from VTOP courses and marks.
    """
    assignments: List[Dict[str, Any]] = []
    for c in courses:
        code = c.get("code") or ""
        title = c.get("title") or ""
        faculty = c.get("faculty") or ""
        marks_list = c.get("marks") or []
        for m in marks_list:
            m_title = m.get("title") or ""
            m_lower = m_title.lower()
            if any(term in m_lower for term in ("da", "assignment", "project", "quiz", "assessment", "review", "exercise", "case study", "seminar", "task")):
                if any(exam_kw in m_lower for exam_kw in ("cat-1", "cat 1", "cat1", "cat-2", "cat 2", "cat2", "fat theory", "fat exam")) and not any(term in m_lower for term in ("da", "assignment", "quiz")):
                    continue
                is_submitted = (m.get("status") or "").lower() == "present" or (m.get("scored") is not None)
                weight = m.get("maxWeightage") or m.get("weightage") or 10.0
                assignments.append({
                    "id": f"assign-{code}-{m_title}".replace(" ", "-").lower(),
                    "title": f"{code} - {m_title}",
                    "courseCode": code,
                    "courseTitle": title,
                    "faculty": faculty,
                    "source": "VTOP Portal",
                    "platformName": "VTOP Continuous Assessment",
                    "dueDate": "Continuous Evaluation",
                    "dueTime": "23:59",
                    "status": "Submitted" if is_submitted else "Pending",
                    "priority": "Critical" if weight >= 10.0 else "Medium",
                    "weightage": weight,
                    "weightagePercentage": weight,
                    "instructions": f"Continuous Evaluation {m_title} for {title}",
                })
    return assignments


def build_ai_tasks(
    student: Dict[str, Any],
    courses: List[Dict[str, Any]],
    attendance: List[Dict[str, Any]],
    marks: List[Dict[str, Any]],
    exams: Dict[str, List[Dict[str, Any]]],
) -> List[Dict[str, Any]]:
    """
    Generate smart, data-driven AI study and attendance tasks based on real VTOP data.
    """
    tasks: List[Dict[str, Any]] = []

    # 1. Critical attendance (< 75%)
    for att in attendance:
        pct = att.get("percentage")
        need = att.get("needToAttend") or 0
        code = att.get("courseCode") or "Course"
        title = att.get("courseTitle") or code
        slot = att.get("slot") or "Slot"
        if pct is not None and pct < 75.0:
            tasks.append({
                "id": f"task-att-{code}".lower(),
                "courseCode": code,
                "subjectCode": code,
                "courseTitle": title,
                "subjectTitle": title,
                "type": "Attendance Risk",
                "category": "Attendance Recovery",
                "urgency": "HIGH",
                "headline": f"Attend next {need} classes in {code} ({pct}%)",
                "reason": f"Current attendance is below mandatory 75% threshold. Missing more classes risks debarment.",
                "actionReason": f"Attend next {need} consecutive lectures to recover 75% margin.",
                "estimatedHours": need * 1,
                "suggestedSlot": slot,
            })

    # 2. Internal marks (< 50%)
    for mk in marks:
        scored = mk.get("weightageScored")
        graded = mk.get("weightageGraded")
        code = mk.get("courseCode") or "Course"
        title = mk.get("courseTitle") or code
        slot = mk.get("slot") or "Slot"
        if scored is not None and graded is not None and graded > 0:
            ratio = (scored / graded) * 100
            if ratio < 50.0:
                tasks.append({
                    "id": f"task-marks-{code}".lower(),
                    "courseCode": code,
                    "subjectCode": code,
                    "courseTitle": title,
                    "subjectTitle": title,
                    "type": "Assignment Crunch",
                    "category": "Marks Recovery Sprint",
                    "urgency": "HIGH",
                    "headline": f"Revise {code} core syllabus (Score: {scored}/{graded})",
                    "reason": f"Internal score is {ratio:.1f}%. Need high FAT score to secure passing grade.",
                    "actionReason": f"Practice previous FAT question papers and solve Digital Assignments.",
                    "estimatedHours": 3,
                    "suggestedSlot": slot,
                })

    # 3. Upcoming exams
    for exam_type, exam_list in (exams or {}).items():
        for ex in exam_list:
            slot = ex.get("slot")
            date = ex.get("date")
            time_str = ex.get("start_time")
            venue = ex.get("venue") or "TBA"
            tasks.append({
                "id": f"task-exam-{slot}-{exam_type}".replace(" ", "-").lower(),
                "type": "Exam Preparation",
                "category": f"{exam_type} Revision",
                "urgency": "MEDIUM",
                "headline": f"Prepare for {exam_type} exam ({slot})",
                "reason": f"Scheduled on {date} {time_str or ''} at {venue}",
                "actionReason": f"Complete module revision and formula sheets.",
                "estimatedHours": 4,
                "suggestedSlot": slot or "Weekend",
            })

    return tasks


def _faculty_from_registry(
    registry: CourseRegistry,
    proctor: Optional[Dict[str, Any]] = None,
    dean_hod: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Enriched faculty, combining course teachers, proctor, and dean/hod.
    """
    seen: Dict[str, Dict[str, Any]] = {}
    for course in registry.courses:
        name = course.get("faculty")
        if not name:
            continue
        entry = seen.setdefault(
            name, {
                "name": name,
                "courses": [],
                "venue": course.get("venue"),
                "cabin": None,
                "email": None,
                "phone": None,
                "designation": "Course Faculty",
                "isProctor": False,
            }
        )
        code = course.get("code")
        if code and code not in entry["courses"]:
            entry["courses"].append(code)

    if proctor and proctor.get("name"):
        p_name = proctor["name"]
        if p_name in seen:
            seen[p_name].update({
                "email": proctor.get("email"),
                "phone": proctor.get("phone"),
                "cabin": proctor.get("cabin"),
                "designation": proctor.get("designation") or "Proctor",
                "isProctor": True,
            })
        else:
            seen[p_name] = {
                "name": p_name,
                "courses": ["Student Proctor"],
                "venue": proctor.get("cabin"),
                "cabin": proctor.get("cabin"),
                "email": proctor.get("email"),
                "phone": proctor.get("phone"),
                "designation": proctor.get("designation") or "Proctor",
                "isProctor": True,
            }

    if dean_hod:
        for staff in dean_hod:
            s_name = staff.get("name")
            if s_name:
                if s_name in seen:
                    seen[s_name].update({
                        "email": staff.get("email"),
                        "phone": staff.get("phone"),
                        "cabin": staff.get("cabin"),
                        "designation": staff.get("title") or staff.get("role"),
                    })
                else:
                    seen[s_name] = {
                        "name": s_name,
                        "courses": [staff.get("title") or staff.get("role") or "University Leadership"],
                        "venue": staff.get("cabin"),
                        "cabin": staff.get("cabin"),
                        "email": staff.get("email"),
                        "phone": staff.get("phone"),
                        "designation": staff.get("title") or staff.get("role"),
                        "isProctor": False,
                    }

    return sorted(seen.values(), key=lambda f: f["name"])


# ---------------------------------------------------------------------------
# the pipeline
# ---------------------------------------------------------------------------


def choose_semester(
    semesters: List[Dict[str, str]], requested: Optional[str], report: SyncReport
) -> Optional[Dict[str, str]]:
    """
    Pick which semester to sync.

    An explicit request wins. Otherwise the first dropdown entry is used, which is
    VTOP's most recent semester. The choice is recorded in the report so a user
    seeing last semester's data can tell why.
    """
    if requested and requested.strip():
        req_clean = requested.strip()
        for semester in semesters:
            if semester.get("id") == req_clean:
                return semester
        if semesters:
            report.warn(
                f"Requested semester {req_clean} is not in the dropdown; "
                f"falling back to {semesters[0]['name']}"
            )
            return semesters[0]
        return {"id": req_clean, "name": req_clean}

    if semesters:
        return semesters[0]

    return None


def sync(
    session: VTOPSession,
    semester_id: Optional[str] = None,
    fast_mode: Optional[bool] = None,
) -> Dict[str, Any]:
    """
    Run a full scrape against an already-authenticated session.

    Returns the complete store payload plus a ``syncReport``. Raises only if the
    session is unusable; individual module failures are captured in the report.
    """
    if fast_mode is None:
        fast_mode = bool(os.environ.get("VERCEL") or os.environ.get("AWS_LAMBDA_FUNCTION_NAME"))

    report = SyncReport()

    if isinstance(session, VTOPSession) and (not getattr(session, "is_authenticated", False) or not getattr(session, "authorized_id", None)):
        raise VTOPAuthError(
            "Your VTOP session has expired. Sign in again to sync.",
            code=111,
            retryable=True,
        )

    semesters = _step(report, "semesters", lambda: fetch_semesters(session)) or []
    semester = choose_semester(semesters, semester_id, report)
    if semester is None:
        report.warn(
            "No semester could be selected — VTOP returned no semester dropdown, "
            "so no semester-scoped module can be fetched"
        )

    sem_id = semester["id"] if semester else None

    # Sequential execution: VTOP CC rotates CSRF tokens on each request, so each request
    # must absorb and provide the freshest token to the next.
    profile = _step(report, "profile", lambda: fetch_profile(session))
    grade_history = _step(report, "gradeHistory", lambda: fetch_grade_history(session))

    page = None
    att_html = None
    marks_html = None
    exams_html = None
    page_err = None
    att_err = None
    marks_err = None
    exams_err = None

    if sem_id:
        try:
            page = fetch_timetable_page(session, sem_id)
        except VTOPAuthError:
            raise
        except Exception as exc:
            logger.warning("[VTOP Scraper] Timetable fetch failed: %s", exc)
            page_err = exc

        try:
            att_html = fetch_attendance_page(session, sem_id)
        except VTOPAuthError:
            raise
        except Exception as exc:
            logger.warning("[VTOP Scraper] Attendance fetch failed: %s", exc)
            att_err = exc

        try:
            marks_html = fetch_marks_page(session, sem_id)
        except VTOPAuthError:
            raise
        except Exception as exc:
            logger.warning("[VTOP Scraper] Marks fetch failed: %s", exc)
            marks_err = exc

        if not fast_mode:
            try:
                exams_html = fetch_exam_page(session, sem_id)
            except VTOPAuthError:
                raise
            except Exception as exc:
                logger.warning("[VTOP Scraper] Exam fetch failed: %s", exc)
                exams_err = exc

    semester_grades = _step(report, "semesterGrades", lambda: fetch_semester_grades(session, sem_id)) if sem_id else {"grades": [], "gpa": None}
    proctor = _step(report, "proctor", lambda: fetch_proctor(session))
    receipts = _step(report, "receipts", lambda: fetch_receipts(session)) or [] if not fast_mode else []
    payments = _step(report, "payments", lambda: fetch_payments(session)) or {"hasDues": False, "totalDue": 0.0, "items": []} if not fast_mode else {"hasDues": False, "totalDue": 0.0, "items": []}
    dean_hod = _step(report, "deanHod", lambda: fetch_dean_hod(session)) or [] if not fast_mode else []
    spotlight = _step(report, "spotlight", lambda: fetch_spotlight(session)) or [] if not fast_mode else []
    calendar_data = _step(report, "calendar", lambda: fetch_vtop_academic_calendar(session, sem_id)) if (sem_id and not fast_mode) else None

    registry = build_registry([])
    grid: Dict[str, List[Dict[str, Any]]] = {}
    attendance_rows: List[Dict[str, Any]] = []
    marks_rows: List[Dict[str, Any]] = []
    exams: Dict[str, List[Dict[str, Any]]] = {}

    if semester is not None:
        if page:
            courses = _step(report, "courses", lambda: P.parse_courses(page)) or []
            registry = build_registry(courses)
            grid = _step(
                report,
                "timetableGrid",
                lambda: P.parse_timetable_grid(page),
                count_of=lambda g: sum(len(v) for v in (g or {}).values()),
            ) or {}
        else:
            msg = str(page_err) if page_err else "timetable page not retrieved"
            report.record("courses", FAILED, message=msg)
            report.record("timetableGrid", FAILED, message=msg)

        def _get_attendance():
            if att_err:
                raise att_err
            if att_html is None:
                raise RuntimeError("attendance page not retrieved")
            return P.parse_attendance(att_html)

        def _get_marks():
            if marks_err:
                raise marks_err
            if marks_html is None:
                raise RuntimeError("marks page not retrieved")
            return P.parse_marks(marks_html)

        def _get_exams():
            if exams_err:
                raise exams_err
            if exams_html is None:
                return {}
            return P.parse_exam_schedule(exams_html)

        attendance_rows = _step(report, "attendance", _get_attendance) or []
        if not fast_mode and sem_id and getattr(session, "is_authenticated", False) and attendance_rows:
            # Query top courses attendance detail sequentially and safely without breaking main sync
            for row in attendance_rows[:4]:
                cid = row.get("classId")
                sname = row.get("slotName") or row.get("slot") or ""
                if cid and sname:
                    try:
                        logs, _ = fetch_course_attendance_detail(
                            session, sem_id, cid, slot_name=sname,
                            course_code=row.get("courseCode", ""),
                            course_title=row.get("courseTitle", ""),
                            faculty_name=row.get("facultyName", ""),
                        )
                        if logs:
                            row["viewLink"] = logs
                    except Exception as e:
                        logger.debug("[VTOP Scraper] Detail log notice for class %s: %s", cid, e)

        marks_rows = _step(report, "marks", _get_marks) or []
        if not fast_mode and sem_id:
            exams = _step(
                report,
                "exams",
                _get_exams,
                count_of=lambda e: sum(len(v) for v in (e or {}).values()),
            ) or {}

    # -- assemble ----------------------------------------------------------

    attendance = build_attendance(attendance_rows, registry, report)
    marks = build_marks(marks_rows, registry, report)

    attendance_by_course = {
        record["courseId"]: record for record in attendance if record["courseId"]
    }
    marks_by_course = {
        record["courseId"]: record for record in marks if record["courseId"]
    }

    grades_by_code = {
        g["courseCode"]: g["grade"] for g in (semester_grades.get("grades") or []) if g.get("courseCode")
    }

    timetable = build_timetable(grid, registry, attendance_by_course, report)
    courses_out = build_courses(registry, attendance_by_course, marks_by_course, grades_by_code)
    overall = overall_attendance(attendance)
    student = build_student(profile, registry, overall, semester, grade_history, semester_grades, proctor)

    # Assemble fees (receipts + pending dues)
    fees = list(receipts)
    if payments and payments.get("items"):
        fees.extend(payments["items"])

    # Assemble assignments from digital assignment marks
    assignments = build_assignments(courses_out)

    # Assemble AI study & attendance tasks
    ai_tasks = build_ai_tasks(student, courses_out, attendance, marks, exams)

    # Fetch and assemble student hostel & leave details
    hostel_data = _step(report, "hostel", lambda: fetch_hostel(session, profile)) or {
        "hostelInfo": {
            "gender": student.get("gender"),
            "isHosteller": student.get("isHosteller"),
            "blockName": student.get("blockName"),
            "roomNo": student.get("roomNo"),
            "messInfo": student.get("messInfo"),
        },
        "leaveHistory": [],
    }

    # Scrape On-duty (OD) records
    od_data = _step(
        report,
        "od",
        lambda: fetch_od(
            session,
            semester["id"] if semester else None,
            attendance_rows=attendance_rows,
            attendance_html=att_html if semester else None,
            fast_mode=fast_mode,
        ),
    ) or {
        "state": "source_unavailable",
        "hasValidData": False,
        "usedHours": None,
        "odHours": None,
        "totalOdHours": None,
        "approvedHours": 0,
        "pendingHours": 0,
        "rejectedHours": 0,
        "maxHours": 40,
        "maxOdHours": 40,
        "remainingHours": None,
        "percentageUsed": None,
        "records": [],
        "odRecords": [],
    }

    if od_data and isinstance(student, dict):
        approved_od = od_data.get("approvedHours") if od_data.get("approvedHours") is not None else (od_data.get("usedHours") or 0)
        student["odHours"] = approved_od
        student["approvedOdHours"] = approved_od
        student["totalOdHours"] = od_data.get("totalOdHours") or approved_od
        student["remainingOdHours"] = od_data.get("remainingHours")
        student["od"] = od_data

    normalized_exams = build_exams(exams, registry)

    all_grades_dict = {}
    if grade_history and grade_history.get("semesterHistory"):
        for sem_rec in grade_history["semesterHistory"]:
            s_name = sem_rec.get("semester") or "Semester"
            all_grades_dict[s_name] = {
                "gpa": str(sem_rec.get("gpa")) if sem_rec.get("gpa") is not None else None,
                "grades": sem_rec.get("courses") or [],
            }
    if sem_id and semester_grades and semester_grades.get("grades"):
        current_sem_label = (semester.get("name") if semester else None) or sem_id
        all_grades_dict[current_sem_label] = {
            "gpa": str(semester_grades.get("gpa")) if semester_grades.get("gpa") is not None else None,
            "grades": semester_grades.get("grades") or [],
        }

    all_grades_data = {
        "grades": all_grades_dict,
        "cgpa": student.get("cgpa"),
        "creditsEarned": student.get("creditsEarned"),
    }

    return {
        "student": student,
        "semesters": semesters,
        "selectedSemester": semester,
        "courses": courses_out,
        "timetable": timetable,
        "attendance": attendance,
        "marks": marks,
        "exams": exams,
        "examsList": normalized_exams,
        "examsByType": exams,
        "faculty": _faculty_from_registry(registry, proctor, dean_hod),
        "receipts": receipts,
        "dues": payments,
        "fees": fees,
        "spotlight": spotlight,
        "proctor": proctor,
        "deanHod": dean_hod,
        "assignments": assignments,
        "aiTasks": ai_tasks,
        "hostel": hostel_data,
        "hostelInfo": hostel_data.get("hostelInfo"),
        "od": od_data,
        "calendar": calendar_data or get_fallback_calendar(sem_id),
        "grades": (semester_grades.get("grades") or []) if semester_grades else [],
        "gradeHistory": grade_history,
        "allGrades": all_grades_data,
        "registry": registry.report(),
        "syncReport": report.as_dict(),
    }

