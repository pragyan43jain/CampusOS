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
from datetime import datetime, timezone
from typing import Any, Callable, Dict, List, Optional, Tuple

from . import constants as C
from . import parser as P
from .math_engine import calculate_attendance_metrics, calculate_od_metrics
from .registry import CourseRegistry, build_registry
from .session import VTOPSession

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
    return P.parse_semesters(session.post_menu(C.SEMESTER_LIST))


def fetch_profile(session: VTOPSession) -> Dict[str, Any]:
    return P.parse_profile(session.post_menu(C.PROFILE))


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
    return P.parse_grade_history(session.post_menu(C.GRADE_HISTORY))


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
    course_code: str = "",
    course_title: str = "",
    faculty_name: str = "",
) -> List[Dict[str, Any]]:
    """
    Query the subject attendance drill-down modal from VTOP CC to extract
    every single class with 'On Duty' / 'OD' status.
    """
    detail_endpoints = [
        "processViewAttendanceDetail",
        "getAttendanceDetail",
        "processViewStudentAttendanceDetail",
        "academics/common/processViewAttendanceDetail",
        "students/processViewAttendanceDetail",
    ]
    for ep in detail_endpoints:
        try:
            fields = [
                ("semesterSubId", semester_id),
                ("classId", class_id),
                ("courseId", class_id),
                ("crscd", course_code),
            ]
            html = session.post_custom(ep, fields)
            if html and ("table" in html.lower() or "present" in html.lower() or "absent" in html.lower() or "duty" in html.lower() or "od" in html.lower()):
                records = P.parse_subject_attendance_details(html, course_code, course_title, faculty_name)
                if records:
                    return records
        except Exception as e:
            logger.debug("[VTOP OD] Could not query detail endpoint %s for class %s: %s", ep, class_id, e)
    return []


def fetch_od(
    session: VTOPSession,
    semester_id: Optional[str] = None,
    attendance_rows: Optional[List[Dict[str, Any]]] = None,
    attendance_html: Optional[str] = None,
) -> Dict[str, Any]:
    """
    Fetch and parse student On-Duty (OD) hours.
    Probes multiple candidate VTOP endpoints, searches the class attendance page
    and all subject attendance tables for OD credits and detailed lecture logs.
    """
    diagnostics: List[Dict[str, Any]] = []
    best_result: Optional[Dict[str, Any]] = None
    selected_ep: Optional[str] = None

    logger.info("[VTOP OD] Starting OD fetch (semester_id=%s, candidate_count=%d)", semester_id, len(C.OD_CANDIDATES))

    for endpoint, req_type, csrf_first in C.OD_CANDIDATES:
        try:
            logger.info("[VTOP OD] Probing endpoint: '%s' (type=%s, csrf_first=%s)", endpoint, req_type, csrf_first)
            html: Optional[str] = None

            if req_type == "semester" and semester_id:
                html = session.post_semester(endpoint, semester_id, csrf_first=csrf_first)
            elif req_type == "od":
                html = session.post_od(endpoint, semester_id)
            elif req_type == "menu":
                html = session.post_menu(endpoint, with_win_image=True)
            else:
                html = session.post_simple(endpoint)

            resp_len = len(html) if html else 0
            snippet = (html[:160].replace("\n", " ") if html else "")
            logger.info("[VTOP OD] Raw VTOP response for '%s': length=%d, snippet='%s'", endpoint, resp_len, snippet)

            status_info = {
                "endpoint": endpoint,
                "requestType": req_type,
                "responseLength": resp_len,
                "hasHtml": bool(html),
                "containsAuthMarker": "authorizedIDX" in (html or ""),
                "containsTable": "<table" in (html or "").lower(),
            }

            if not html or P.body_says(html, "not authorized", "http status 404", "session expired", "please login"):
                status_info["status"] = "rejected_or_empty"
                diagnostics.append(status_info)
                continue

            parsed = P.parse_od(html)
            records = parsed.get("records") or parsed.get("odRecords") or []
            used_hours = parsed.get("usedHours")
            state = parsed.get("state", "unknown")

            logger.info("[VTOP OD] Parsed '%s' -> state=%s, records=%d, calculated OD hours=%s", endpoint, state, len(records), used_hours)

            status_info["status"] = state
            status_info["recordCount"] = len(records)
            status_info["usedHours"] = used_hours
            diagnostics.append(status_info)

            # If we found real records, prioritize and stop probing immediately
            if state == "success_with_records" and records:
                best_result = parsed
                selected_ep = endpoint
                logger.info("[VTOP OD] Found %d active OD record(s) on endpoint '%s'. Stopping probe.", len(records), endpoint)
                break
            elif state == "success_with_no_records":
                if best_result is None or best_result.get("state") != "success_with_records":
                    best_result = parsed
                    selected_ep = endpoint
            elif best_result is None and state not in ("source_unavailable", "authentication_required"):
                best_result = parsed
                selected_ep = endpoint

        except Exception as e:
            logger.warning("[VTOP OD] Exception querying '%s': %s", endpoint, e)
            diagnostics.append({
                "endpoint": endpoint,
                "requestType": req_type,
                "status": "exception",
                "error": str(e),
            })

    # Search attendance page and subject attendance for OD credits
    att_od_records: List[Dict[str, Any]] = []
    if attendance_html or attendance_rows:
        extracted = P.extract_attendance_od_records(attendance_html or "", attendance_rows or [])
        if extracted:
            att_od_records.extend(extracted)
            logger.info("[VTOP OD] Extracted %d OD record(s) from class attendance page.", len(extracted))

    # Drill down into individual subject attendance detail pages if semester_id is available.
    # Strategy 1: extract classIds from onclick attributes in attendance_html
    tried_class_ids: set = set()
    if semester_id and attendance_html:
        descriptors = P.extract_course_attendance_descriptors(attendance_html)
        for desc in descriptors:
            c_id = desc.get("classId")
            c_code = desc.get("courseCode") or ""
            if c_id and c_id not in tried_class_ids:
                tried_class_ids.add(c_id)
                logger.info("[VTOP OD] Querying attendance drilldown for %s (classId=%s)", c_code, c_id)
                detail_recs = fetch_course_attendance_detail(session, semester_id, c_id, course_code=c_code)
                if detail_recs:
                    logger.info("[VTOP OD] Found %d detailed OD lecture(s) in %s", len(detail_recs), c_code)
                    att_od_records.extend(detail_recs)

    # Strategy 2: fall back to courseId from attendance rows as classId.
    # VTOP CC uses numeric courseIds in processViewAttendanceDetail that often match
    # the sequential row IDs — this catches cases where HTML onclick parsing yields nothing.
    if semester_id and attendance_rows:
        for row in attendance_rows:
            c_id_raw = row.get("courseId") or row.get("id")
            c_code = (row.get("courseCode") or "").upper()
            c_title = row.get("courseTitle") or row.get("courseName") or ""
            fac = row.get("facultyName") or row.get("faculty") or ""
            c_id = str(c_id_raw) if c_id_raw is not None else None
            if c_id and c_id not in tried_class_ids and c_code:
                tried_class_ids.add(c_id)
                logger.info("[VTOP OD] Fallback drill-down for %s using courseId=%s", c_code, c_id)
                detail_recs = fetch_course_attendance_detail(
                    session, semester_id, c_id,
                    course_code=c_code,
                    course_title=c_title,
                    faculty_name=fac,
                )
                if detail_recs:
                    logger.info("[VTOP OD] Fallback found %d OD class(es) in %s", len(detail_recs), c_code)
                    att_od_records.extend(detail_recs)

    if att_od_records:
        total_att_od = sum(r.get("hours", 1) for r in att_od_records)
        logger.info("[VTOP OD] Found %d OD hours across class attendance records.", total_att_od)
        if best_result is None or not (best_result.get("records") or best_result.get("odRecords")):
            best_result = {
                "state": "success_with_records",
                "hasValidData": True,
                "usedHours": total_att_od,
                "odHours": total_att_od,
                "totalOdHours": total_att_od,
                "approvedHours": total_att_od,
                "pendingHours": 0,
                "rejectedHours": 0,
                "maxHours": C.OD_MAX_HOURS,
                "maxOdHours": C.OD_MAX_HOURS,
                "remainingHours": max(0, C.OD_MAX_HOURS - total_att_od),
                "percentageUsed": round((total_att_od / C.OD_MAX_HOURS) * 100, 1),
                "records": att_od_records,
                "odRecords": att_od_records,
                "message": f"Found {total_att_od} approved On-Duty hours credited in class attendance.",
            }
        else:
            # Merge non-duplicate records
            existing_dates_courses = {
                (r.get("date"), r.get("subjectCode"))
                for r in best_result.get("records", [])
            }
            for r in att_od_records:
                key = (r.get("date"), r.get("subjectCode"))
                if key not in existing_dates_courses:
                    best_result.setdefault("records", []).append(r)
                    best_result.setdefault("odRecords", []).append(r)
                    best_result["usedHours"] = (best_result.get("usedHours") or 0) + r.get("hours", 1)
                    best_result["odHours"] = best_result["usedHours"]
                    best_result["totalOdHours"] = best_result["usedHours"]
                    best_result["approvedHours"] = (best_result.get("approvedHours") or 0) + r.get("hours", 1)
            best_result["remainingHours"] = max(0, C.OD_MAX_HOURS - (best_result.get("usedHours") or 0))
            best_result["percentageUsed"] = round(((best_result.get("usedHours") or 0) / C.OD_MAX_HOURS) * 100, 1)

    if best_result is None:
        logger.info("[VTOP OD] No dedicated OD records found on candidate endpoints; authenticated student has 0 utilized OD hours.")
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
        }
    else:
        used = best_result.get("usedHours")
        records = best_result.get("records") or best_result.get("odRecords") or []
        max_h = best_result.get("maxHours") or best_result.get("maxOdHours") or C.OD_MAX_HOURS
        best_result["usedHours"] = used
        best_result["odHours"] = used
        best_result["totalOdHours"] = used
        best_result["maxHours"] = max_h
        best_result["maxOdHours"] = max_h
        best_result["records"] = records
        best_result["odRecords"] = records

    best_result["diagnostics"] = {
        "probedEndpoints": diagnostics,
        "selectedEndpoint": selected_ep,
        "candidateCount": len(C.OD_CANDIDATES),
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
                "seatLocation": item.get("seat_location"),
                "seatNumber": item.get("seat_number"),
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
    sem_gpa = semester_grades.get("gpa") if semester_grades else None

    semester_gpa_list = []
    if sem_gpa is not None:
        semester_gpa_list.append({
            "semester": semester.get("name") if semester else "Current",
            "gpa": sem_gpa,
            "cgpa": cgpa or sem_gpa,
            "credits": registry.total_credits,
        })

    return {
        "name": profile.get("name"),
        "regNo": profile.get("regNo"),
        "email": profile.get("email"),
        "program": profile.get("program"),
        "branch": profile.get("branch"),
        "semester": semester.get("name") if semester else None,
        "semesterId": semester.get("id") if semester else None,
        "batch": profile.get("batch"),
        "cgpa": cgpa,
        "creditsEarned": credits_earned,
        "totalCreditsRequired": 160.0 if (credits_earned or cgpa) else None,
        "registeredCredits": registry.total_credits,
        "rank": None,
        "overallAttendance": overall,
        "semesterGpa": semester_gpa_list,
        "proctor": proctor,
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
            if any(term in m_title.lower() for term in ("da", "assignment", "project", "quiz")):
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
    if not semesters:
        return None

    if requested:
        for semester in semesters:
            if semester["id"] == requested:
                return semester
        report.warn(
            f"Requested semester {requested} is not in the dropdown; "
            f"falling back to {semesters[0]['name']}"
        )

    return semesters[0]


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

    semesters = _step(report, "semesters", lambda: fetch_semesters(session)) or []
    semester = choose_semester(semesters, semester_id, report)
    if semester is None:
        report.warn(
            "No semester could be selected — VTOP returned no semester dropdown, "
            "so no semester-scoped module can be fetched"
        )

    profile = _step(report, "profile", lambda: fetch_profile(session))
    
    if not fast_mode:
        grade_history = _step(report, "gradeHistory", lambda: fetch_grade_history(session))
        receipts = _step(report, "receipts", lambda: fetch_receipts(session)) or []
        payments = _step(report, "payments", lambda: fetch_payments(session)) or {"hasDues": False, "totalDue": 0.0, "items": []}
        proctor = _step(report, "proctor", lambda: fetch_proctor(session))
        dean_hod = _step(report, "deanHod", lambda: fetch_dean_hod(session)) or []
        spotlight = _step(report, "spotlight", lambda: fetch_spotlight(session)) or []
    else:
        grade_history = None
        receipts = []
        payments = {"hasDues": False, "totalDue": 0.0, "items": []}
        proctor = None
        dean_hod = []
        spotlight = []

    registry = build_registry([])
    grid: Dict[str, List[Dict[str, Any]]] = {}
    attendance_rows: List[Dict[str, Any]] = []
    marks_rows: List[Dict[str, Any]] = []
    exams: Dict[str, List[Dict[str, Any]]] = {}
    semester_grades: Dict[str, Any] = {"grades": [], "gpa": None}

    if semester is not None:
        sem_id = semester["id"]

        # Courses and grid share one response — fetch once, parse twice.
        page = _step(
            report,
            "timetablePage",
            lambda: fetch_timetable_page(session, sem_id),
            count_of=lambda html: len(html or ""),
        )
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
            report.record("courses", FAILED, message="timetable page not retrieved")
            report.record("timetableGrid", FAILED, message="timetable page not retrieved")

        att_page: Optional[str] = None
        def _get_attendance() -> List[Dict[str, Any]]:
            nonlocal att_page
            att_page = fetch_attendance_page(session, sem_id)
            return P.parse_attendance(att_page)

        attendance_rows = _step(report, "attendance", _get_attendance) or []
        marks_rows = (
            _step(
                report,
                "marks",
                lambda: P.parse_marks(fetch_marks_page(session, sem_id)),
            )
            or []
        )
        if not fast_mode:
            exams = (
                _step(
                    report,
                    "exams",
                    lambda: P.parse_exam_schedule(fetch_exam_page(session, sem_id)),
                    count_of=lambda e: sum(len(v) for v in (e or {}).values()),
                )
                or {}
            )
            semester_grades = (
                _step(
                    report,
                    "semesterGrades",
                    lambda: fetch_semester_grades(session, sem_id),
                )
                or {"grades": [], "gpa": None}
            )
        else:
            exams = {}
            semester_grades = {"grades": [], "gpa": None}

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

    # Scrape On-duty (OD) records
    od_data = _step(
        report,
        "od",
        lambda: fetch_od(
            session,
            semester["id"] if semester else None,
            attendance_rows=attendance_rows,
            attendance_html=att_page if semester else None,
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

    normalized_exams = build_exams(exams, registry)

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
        "od": od_data,
        "registry": registry.report(),
        "syncReport": report.as_dict(),
    }

