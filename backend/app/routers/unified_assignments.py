"""
CampusOS Backend - Unified Academic Assignments & Subject Aggregation Router

Core architectural principle: "Subject first, assignment second, source third."
Aggregates coursework across Microsoft Teams and VIT LMS under the student's
current enrolled semester subjects.
Performs duplicate detection, authentic deadline relative calculation, and status determination.
"""

import difflib
import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel

from app.storage import empty_store, load_store, save_store
from app.routers.auth import resolve_student_reg
from app.course_verification import (
    VerifiedCourseRecord,
    ExternalCourseMatch,
    canonicalize_course_code,
    canonicalize_faculty_name,
    normalize_faculty_name,
    match_faculty_names,
    find_matching_vtop_subject,
    verify_course_title_match,
    verify_semester_match,
    build_verified_semester_course_records,
)

logger = logging.getLogger("vtop.routes.unified_assignments")

router = APIRouter(prefix="/api", tags=["unified_assignments"])


def normalize_title(text: Optional[str]) -> str:
    if not text:
        return ""
    clean = re.sub(r"[^a-z0-9\s]", " ", text.lower())
    return " ".join(clean.split())


def are_duplicate_assignments(a1: Dict[str, Any], a2: Dict[str, Any]) -> bool:
    """
    Determines whether an assignment from Teams and an assignment from LMS
    represent the exact same academic task.
    Section 18: Never merge assignments belonging to different verified courses.
    (e.g. BCSE308L must never merge with BCSE308P).
    Requires:
    1. Exact canonical course code match
    2. High title similarity OR (matching due date AND moderate title similarity)
    """
    c1 = canonicalize_course_code(a1.get("courseCode"))
    c2 = canonicalize_course_code(a2.get("courseCode"))
    if not c1 or not c2 or c1 != c2:
        return False

    t1 = normalize_title(a1.get("title"))
    t2 = normalize_title(a2.get("title"))
    if not t1 or not t2:
        return False

    ratio = difflib.SequenceMatcher(None, t1, t2).ratio()
    if ratio >= 0.85:
        return True

    d1 = a1.get("dueDate")
    d2 = a2.get("dueDate")
    dates_match = d1 and d2 and d1 != "TBA" and d2 != "TBA" and d1 == d2

    if dates_match and ratio >= 0.60:
        return True

    return False


def merge_assignment_pair(teams_item: Dict[str, Any], lms_item: Dict[str, Any]) -> Dict[str, Any]:
    """
    Combines duplicate assignment records into a single unified record.
    Preserves both source submission URLs and authentic submission states.
    """
    # Pick title with best detail
    title1 = teams_item.get("title") or ""
    title2 = lms_item.get("title") or ""
    title = title1 if len(title1) >= len(title2) else title2

    # Status priority: If either is DONE / Submitted, final is DONE / Submitted
    is_done = bool(
        teams_item.get("isDone")
        or lms_item.get("isDone")
        or (teams_item.get("status") or "").upper() in ("DONE", "SUBMITTED", "COMPLETED")
        or (lms_item.get("status") or "").upper() in ("DONE", "SUBMITTED", "COMPLETED")
    )
    is_unavail = (
        teams_item.get("status") == "STATUS_UNAVAILABLE" and lms_item.get("status") == "STATUS_UNAVAILABLE"
    )

    if is_done:
        merged_status = "DONE"
    elif is_unavail:
        merged_status = "STATUS_UNAVAILABLE"
    else:
        merged_status = teams_item.get("applicationStatus") or lms_item.get("status") or "PENDING"

    # Descriptions
    desc1 = teams_item.get("instructions") or ""
    desc2 = lms_item.get("instructions") or ""
    desc = desc1 if len(desc1) >= len(desc2) else desc2

    # Dates
    due_date = teams_item.get("dueDate") if teams_item.get("dueDate") != "TBA" else lms_item.get("dueDate")
    due_time = teams_item.get("dueTime") or lms_item.get("dueTime") or "23:59"

    submitted_at = teams_item.get("submittedAt") or lms_item.get("submittedAt")

    lms_poster = lms_item.get("postedBy") or lms_item.get("lmsProfessor")
    prof_name = lms_poster or teams_item.get("faculty") or lms_item.get("faculty") or "Instructor"

    return {
        "id": f"unified-{teams_item.get('id', '')}-{lms_item.get('id', '')}",
        "courseCode": teams_item.get("courseCode") or lms_item.get("courseCode"),
        "courseTitle": teams_item.get("courseTitle") or lms_item.get("courseTitle"),
        "faculty": prof_name,
        "facultyName": prof_name,
        "professor": prof_name,
        "lmsProfessor": lms_poster or lms_item.get("facultyName") or lms_item.get("faculty") or prof_name or "Faculty unassigned",
        "postedBy": lms_poster or lms_item.get("facultyName") or lms_item.get("faculty") or prof_name,
        "title": title,
        "description": desc,
        "instructions": desc,
        "source": "Teams + LMS",
        "sourceList": ["Teams", "LMS"],
        "dueDate": due_date or "TBA",
        "dueTime": due_time,
        "status": merged_status,
        "applicationStatus": merged_status,
        "isDone": is_done,
        "isSubmitted": is_done,
        "submittedAt": submitted_at,
        "teamsSubmissionState": teams_item.get("teamsSubmissionState"),
        "submissionStatus": teams_item.get("submissionStatus") or lms_item.get("submissionStatus"),
        "priority": teams_item.get("priority") or lms_item.get("priority") or "Medium",
        "weightage": teams_item.get("weightage") or lms_item.get("weightage") or 10,
        "submissionUrl": teams_item.get("platformUrl") or lms_item.get("platformUrl"),
        "teamsSubmissionUrl": teams_item.get("platformUrl"),
        "lmsSubmissionUrl": lms_item.get("platformUrl"),
        "matchedTeamName": teams_item.get("matchedTeamName"),
        "matchedLmsCourse": lms_item.get("matchedLmsCourse"),
    }


def compute_relative_deadline(
    due_date_str: str, due_time_str: str, current_status: str, now: Optional[datetime] = None, is_done: bool = False
) -> Dict[str, Any]:
    """
    Calculates dynamic relative deadline and overdue state based on current time.
    Sections 5, 6 & 7: Submission status has strict priority over deadline.
    If an assignment is submitted/completed/returned, it MUST show DONE and never OVERDUE or PENDING.
    """
    if not now:
        now = datetime.now(timezone.utc)

    st_upper = (current_status or "").upper().strip()
    is_already_done = is_done or st_upper in ("DONE", "SUBMITTED", "COMPLETED")
    is_unavailable = st_upper in ("STATUS_UNAVAILABLE", "UNAVAILABLE")

    if not due_date_str or due_date_str == "TBA":
        final_st = "DONE" if is_already_done else ("STATUS_UNAVAILABLE" if is_unavailable else "PENDING")
        return {
            "formattedDeadline": "TBA",
            "relativeDeadline": "Completed" if is_already_done else "No deadline specified",
            "isOverdue": False,
            "isDueSoon": False,
            "sortKey": "9999-99-99T99:99:99",
            "finalStatus": final_st,
        }

    time_part = due_time_str if due_time_str else "23:59"
    try:
        dt = datetime.strptime(f"{due_date_str} {time_part}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    except Exception:
        final_st = "DONE" if is_already_done else ("STATUS_UNAVAILABLE" if is_unavailable else current_status)
        return {
            "formattedDeadline": f"{due_date_str} {time_part}",
            "relativeDeadline": "Completed" if is_already_done else "TBA",
            "isOverdue": False,
            "isDueSoon": False,
            "sortKey": "9999-99-99",
            "finalStatus": final_st,
        }

    formatted = dt.strftime("%d %b %Y, %I:%M %p")
    diff = dt - now
    total_seconds = diff.total_seconds()

    # 1. Priority: Submitted assignments are ALWAYS DONE (Section 5 & 6)
    if is_already_done:
        return {
            "formattedDeadline": formatted,
            "relativeDeadline": "Completed",
            "isOverdue": False,
            "isDueSoon": False,
            "sortKey": dt.isoformat(),
            "finalStatus": "DONE",
        }

    # 2. Priority: API failure / submission status unavailable (Section 11)
    if is_unavailable:
        return {
            "formattedDeadline": formatted,
            "relativeDeadline": "Status unavailable",
            "isOverdue": False,
            "isDueSoon": False,
            "sortKey": dt.isoformat(),
            "finalStatus": "STATUS_UNAVAILABLE",
        }

    # 3. Priority: Unsubmitted + deadline passed -> OVERDUE (Section 7)
    if total_seconds < 0:
        overdue_sec = abs(total_seconds)
        overdue_days = int(overdue_sec // 86400)
        overdue_hours = int((overdue_sec % 86400) // 3600)
        if overdue_days > 0:
            rel = f"Overdue by {overdue_days} day{'s' if overdue_days > 1 else ''}"
        else:
            rel = f"Overdue by {max(1, overdue_hours)} hour{'s' if overdue_hours > 1 else ''}"
        return {
            "formattedDeadline": formatted,
            "relativeDeadline": rel,
            "isOverdue": True,
            "isDueSoon": False,
            "sortKey": dt.isoformat(),
            "finalStatus": "OVERDUE",
        }

    # 4. Priority: Unsubmitted + deadline not passed -> PENDING or Due Soon
    days = int(total_seconds // 86400)
    hours = int((total_seconds % 86400) // 3600)

    if days == 0:
        if hours <= 1:
            mins = max(1, int(total_seconds // 60))
            rel = f"Due in {mins} minute{'s' if mins > 1 else ''}"
        else:
            rel = f"Due today ({hours}h left)"
        return {
            "formattedDeadline": formatted,
            "relativeDeadline": rel,
            "isOverdue": False,
            "isDueSoon": True,
            "sortKey": dt.isoformat(),
            "finalStatus": "Due Soon",
        }
    elif days == 1:
        rel = f"Due tomorrow ({dt.strftime('%I:%M %p')})"
        return {
            "formattedDeadline": formatted,
            "relativeDeadline": rel,
            "isOverdue": False,
            "isDueSoon": True,
            "sortKey": dt.isoformat(),
            "finalStatus": "Due Soon",
        }
    elif days <= 3:
        rel = f"Due in {days} days"
        return {
            "formattedDeadline": formatted,
            "relativeDeadline": rel,
            "isOverdue": False,
            "isDueSoon": True,
            "sortKey": dt.isoformat(),
            "finalStatus": "Due Soon",
        }
    else:
        rel = f"Due in {days} days"
        return {
            "formattedDeadline": formatted,
            "relativeDeadline": rel,
            "isOverdue": False,
            "isDueSoon": False,
            "sortKey": dt.isoformat(),
            "finalStatus": "PENDING",
        }


def build_unified_assignment_dashboard(store: Dict[str, Any]) -> Dict[str, Any]:
    """
    Builds the subject-first unified assignment structure for the student's current semester.
    Strictly verifies course code, course title, faculty, academic year, and semester.
    """
    # 1. Current Semester Source of Truth
    semester = store.get("selectedSemester") or {}
    if not semester.get("name") and store.get("student"):
        semester = {
            "name": store["student"].get("semester", "Fall Semester 2026-27"),
            "id": store["student"].get("semesterId", "CH20262701"),
        }
    sem_name = semester.get("name") or "Fall Semester 2026-27"

    # 2. Student's enrolled courses for the current semester
    courses = list(store.get("courses") or [])

    # Extract student's subjects and the faculty assigned to each subject
    vtop_subjects_summary: List[Dict[str, Any]] = []
    for c in courses:
        code = canonicalize_course_code(c.get("code") or c.get("courseCode"))
        title = (c.get("title") or c.get("courseTitle") or c.get("courseName") or "").strip()
        faculty = (c.get("faculty") or c.get("facultyName") or "").strip()
        if code:
            vtop_subjects_summary.append({
                "code": code,
                "title": title or code,
                "faculty": faculty,
                "course": c,
            })

    # Requirement 5: Log VTOP faculty list
    logger.info(
        "\n======================================================\n"
        "[VTOP + LMS FACULTY MATCHING] Active Enrolled VTOP Subjects (%d):\n%s\n"
        "======================================================",
        len(vtop_subjects_summary),
        "\n".join([f"  - Subject: '{s['title']}' [{s['code']}] | Faculty: '{s['faculty']}' (norm: '{normalize_faculty_name(s['faculty'])}')" for s in vtop_subjects_summary])
    )

    # 3. Raw assignments stored from connected sources
    verified_enrolled = build_verified_semester_course_records(store)
    raw_unfiltered = list(store.get("assignments") or [])
    raw_assignments: List[Dict[str, Any]] = []

    for a in raw_unfiltered:
        is_lms = (
            a.get("source") == "LMS"
            or "lms" in str(a.get("id", "")).lower()
            or "LMS" in a.get("sourceList", [])
            or a.get("platformName") == "VIT LMS"
        )
        c_code = canonicalize_course_code(a.get("courseCode"))

        if c_code:
            # -------------------------------------------------------------
            # Path A: Assignment has an explicit Course Code
            # -------------------------------------------------------------
            matched_rec = next((r for r in verified_enrolled if canonicalize_course_code(r.courseCode) == c_code), None)
            if not matched_rec:
                logger.warning(
                    "\n[ASSIGNMENT VERIFICATION REJECTED]\n"
                    "Source: %s\n"
                    "Assignment: %s (ID: %s)\n"
                    "Assignment Code: %s\n"
                    "Current Semester: %s\n"
                    "Reason: COURSE CODE NOT ENROLLED IN CURRENT SEMESTER",
                    a.get("source"),
                    a.get("title"),
                    a.get("id"),
                    c_code,
                    sem_name,
                )
                continue

            # Semester & Academic Year Match
            combined_sem_meta = f"{a.get('semester', '')} {a.get('matchedLmsCourse', '')} {a.get('matchedTeamName', '')}"
            sem_ok, sem_reason = verify_semester_match(sem_name, combined_sem_meta)
            if not sem_ok:
                logger.warning(
                    "\n[ASSIGNMENT VERIFICATION REJECTED]\n"
                    "Source: %s\n"
                    "Assignment: %s (ID: %s)\n"
                    "Reason: %s",
                    a.get("source"),
                    a.get("title"),
                    a.get("id"),
                    sem_reason,
                )
                continue

            # Course Title Verification (e.g. reject Computer Architecture under Computer Networks)
            assign_title_meta = f"{a.get('courseTitle', '')} {a.get('subject', '')} {a.get('matchedLmsCourse', '')} {a.get('matchedTeamName', '')}"
            title_ok, title_reason = verify_course_title_match(matched_rec.courseName, assign_title_meta)
            if not title_ok:
                logger.warning(
                    "\n[ASSIGNMENT VERIFICATION REJECTED]\n"
                    "Source: %s\n"
                    "Assignment: %s (ID: %s)\n"
                    "Reason: %s",
                    a.get("source"),
                    a.get("title"),
                    a.get("id"),
                    title_reason,
                )
                continue

            # Faculty Matching
            enrolled_fac = matched_rec.facultyName
            assign_fac = a.get("faculty")
            assign_poster = a.get("postedBy") or a.get("lmsProfessor")
            norm_assign_fac = normalize_faculty_name(assign_fac)
            norm_poster = normalize_faculty_name(assign_poster)

            fac_matches = False
            if norm_assign_fac and match_faculty_names(enrolled_fac, assign_fac):
                fac_matches = True
            elif norm_poster and match_faculty_names(enrolled_fac, assign_poster):
                fac_matches = True
            elif not norm_assign_fac and not norm_poster:
                # No specific faculty was specified on the assignment, rely on course-level verified match
                has_verified_match = bool(a.get("verifiedCourseMatchId") or a.get("lmsCourseId"))
                if has_verified_match:
                    fac_matches = True
            else:
                # A specific faculty was specified, but it DOES NOT match enrolled VTOP faculty -> REJECT!
                fac_matches = False

            if not fac_matches:
                logger.warning(
                    "[FACULTY MATCHING] REJECTED/UNMATCHED:\n"
                    "  Assignment: '%s' (ID: %s)\n"
                    "  Faculty: '%s' (Poster: '%s')\n"
                    "  Enrolled VTOP Course: %s (%s)\n"
                    "  Enrolled VTOP Faculty: %s\n"
                    "  Reason: Faculty does not match enrolled VTOP faculty.",
                    a.get("title"),
                    a.get("id"),
                    assign_fac,
                    assign_poster,
                    matched_rec.courseCode,
                    matched_rec.courseName,
                    enrolled_fac,
                )
                continue

            poster_to_use = assign_poster or assign_fac or enrolled_fac
            if poster_to_use in ("LMS Instructor", "Instructor", "LMS Teacher") or normalize_faculty_name(poster_to_use) == "":
                poster_to_use = enrolled_fac

            logger.info(
                "[FACULTY MATCHING] SUCCESSFUL MATCH:\n"
                "  Assignment: '%s' (ID: %s)\n"
                "  Associated VTOP Subject: '%s' [%s]\n"
                "  Poster/Faculty: '%s'",
                a.get("title"),
                a.get("id"),
                matched_rec.courseName,
                matched_rec.courseCode,
                poster_to_use,
            )

            raw_assignments.append({
                **a,
                "academicYear": matched_rec.academicYear,
                "semester": matched_rec.semester,
                "semesterId": matched_rec.semesterId,
                "courseCode": matched_rec.courseCode,
                "courseTitle": matched_rec.courseName,
                "subject": matched_rec.courseName,
                "faculty": poster_to_use,
                "facultyName": poster_to_use,
                "professor": poster_to_use,
                "lmsProfessor": poster_to_use if is_lms else (a.get("lmsProfessor") or None),
                "postedBy": poster_to_use if is_lms else a.get("postedBy"),
                "instructor": poster_to_use,
                "source": "LMS" if is_lms else a.get("source", "Portal"),
                "verified": True,
            })

        else:
            # -------------------------------------------------------------
            # Path B: Assignment has NO course code (Pure Faculty -> Assignment flow)
            # E.g. LMS provides: Dr. Sharma -> Assignment 1, Dr. Kumar -> Assignment 2, Dr. Patel -> Assignment 3
            # -------------------------------------------------------------
            lms_faculty = (
                a.get("postedBy")
                or a.get("lmsProfessor")
                or a.get("facultyName")
                or a.get("faculty")
                or a.get("professor")
            )
            if lms_faculty and normalize_faculty_name(lms_faculty) == "":
                lms_faculty = None

            if not lms_faculty:
                from app.routers.lms import extract_teacher_from_lms_title
                for text_cand in [a.get("matchedLmsCourse"), a.get("instructions"), a.get("title")]:
                    if text_cand:
                        cand_t = extract_teacher_from_lms_title(str(text_cand))
                        if cand_t and normalize_faculty_name(cand_t) != "":
                            lms_faculty = cand_t
                            break

            logger.info(
                "[FACULTY MATCHING] Evaluating Assignment without Course Code:\n"
                "  Title: '%s'\n"
                "  ID: %s\n"
                "  Faculty: '%s'",
                a.get("title"),
                a.get("id"),
                lms_faculty,
            )

            matched_vtop = find_matching_vtop_subject(
                vtop_subjects=vtop_subjects_summary,
                lms_faculty=lms_faculty,
            )

            if matched_vtop:
                m_code = matched_vtop["code"]
                m_title = matched_vtop["title"]
                matched_rec = next((r for r in verified_enrolled if canonicalize_course_code(r.courseCode) == m_code), None)
                poster_prof = lms_faculty or matched_vtop["faculty"]

                logger.info(
                    "[FACULTY MATCHING] SUCCESSFUL MATCH:\n"
                    "  Assignment: '%s' (ID: %s)\n"
                    "  Faculty: '%s'\n"
                    "  --> Associated VTOP Subject: '%s' [%s]\n"
                    "  --> VTOP Faculty: '%s'",
                    a.get("title"),
                    a.get("id"),
                    lms_faculty,
                    m_title,
                    m_code,
                    matched_vtop["faculty"],
                )

                raw_assignments.append({
                    **a,
                    "academicYear": matched_rec.academicYear if matched_rec else "2026",
                    "semester": matched_rec.semester if matched_rec else sem_name,
                    "semesterId": matched_rec.semesterId if matched_rec else "CH20262701",
                    "courseCode": m_code,
                    "courseTitle": m_title,
                    "subject": m_title,
                    "faculty": poster_prof,
                    "facultyName": poster_prof,
                    "professor": poster_prof,
                    "lmsProfessor": poster_prof,
                    "postedBy": poster_prof,
                    "instructor": poster_prof,
                    "source": "LMS" if is_lms else a.get("source", "Portal"),
                    "verified": True,
                })
            else:
                logger.warning(
                    "[FACULTY MATCHING] REJECTED/UNMATCHED:\n"
                    "  Assignment: '%s' (ID: %s)\n"
                    "  Faculty: '%s'\n"
                    "  Reason: Faculty does not match any enrolled VTOP faculty for this student.\n"
                    "  Result: EXCLUDED / DROPPED from CampusOS.",
                    a.get("title"),
                    a.get("id"),
                    lms_faculty,
                )
                continue

    # Account metadata
    teams_account = store.get("teamsAccount") or {}
    lms_account = store.get("lmsAccount") or {}

    teams_matched_codes = {
        m.get("courseCode") for m in (teams_account.get("matchedSubjects") or [])
    }
    lms_matched_codes = {
        m.get("courseCode") for m in (lms_account.get("matchedSubjects") or [])
    }

    # 4. Deduplicate assignments per course code
    deduped_assignments: List[Dict[str, Any]] = []
    used_ids = set()

    teams_items = [a for a in raw_assignments if a.get("source") == "Teams"]
    lms_items = [a for a in raw_assignments if a.get("source") == "LMS"]
    other_items = [a for a in raw_assignments if a.get("source") not in ("Teams", "LMS")]

    for t_item in teams_items:
        t_id = t_item.get("id")
        matched_lms = None
        for l_item in lms_items:
            l_id = l_item.get("id")
            if l_id in used_ids:
                continue
            if are_duplicate_assignments(t_item, l_item):
                matched_lms = l_item
                used_ids.add(l_id)
                break

        if matched_lms:
            merged = merge_assignment_pair(t_item, matched_lms)
            used_ids.add(t_id)
            deduped_assignments.append(merged)
        else:
            used_ids.add(t_id)
            deduped_assignments.append({
                **t_item,
                "sourceList": ["Teams"],
                "teamsSubmissionUrl": t_item.get("platformUrl"),
            })

    for l_item in lms_items:
        l_id = l_item.get("id")
        if l_id not in used_ids:
            used_ids.add(l_id)
            prof = l_item.get("postedBy") or l_item.get("lmsProfessor") or l_item.get("facultyName") or l_item.get("faculty") or (matched_rec.facultyName if matched_rec else None) or "Faculty unassigned"
            if prof in ("LMS Instructor", "Instructor", "LMS Teacher") and matched_rec and matched_rec.facultyName:
                prof = matched_rec.facultyName
            deduped_assignments.append({
                **l_item,
                "sourceList": ["LMS"],
                "lmsSubmissionUrl": l_item.get("platformUrl"),
                "lmsProfessor": prof,
                "postedBy": prof,
                "facultyName": prof,
                "faculty": prof,
                "professor": prof,
            })

    for o_item in other_items:
        o_id = o_item.get("id")
        if o_id not in used_ids:
            used_ids.add(o_id)
            deduped_assignments.append({
                **o_item,
                "sourceList": [o_item.get("source", "Portal")],
            })

    # 5. Enrich with dynamic relative deadlines and honor manual completion status
    now_utc = datetime.now(timezone.utc)
    enriched_assignments: List[Dict[str, Any]] = []
    manual_status: Dict[str, Any] = store.get("manualAssignmentStatus") or {}

    for a in deduped_assignments:
        a_id = str(a.get("id", ""))
        a_title = str(a.get("title", ""))

        # Check manual status overrides
        is_manually_set = None
        if a_id in manual_status:
            is_manually_set = bool(manual_status[a_id])
        elif a_title in manual_status:
            is_manually_set = bool(manual_status[a_title])
        elif a_id.startswith("unified-"):
            rest = a_id[len("unified-"):]
            for sep in ("-lms-", "-teams-", "-vtop-", "-canvas-"):
                if sep in rest:
                    idx = rest.find(sep)
                    p1 = rest[:idx]
                    p2 = rest[idx + 1:]
                    if p1 in manual_status:
                        is_manually_set = bool(manual_status[p1])
                        break
                    if p2 in manual_status:
                        is_manually_set = bool(manual_status[p2])
                        break
            if is_manually_set is None:
                for part in rest.split("-"):
                    if part and part in manual_status:
                        is_manually_set = bool(manual_status[part])
                        break

        due_d = a.get("dueDate") or "TBA"
        due_t = a.get("dueTime") or "23:59"

        if is_manually_set is not None:
            is_done = is_manually_set
            raw_st = "SUBMITTED" if is_done else "PENDING"
            a["status"] = "Submitted" if is_done else "Pending"
            a["applicationStatus"] = "DONE" if is_done else "PENDING"
            a["displayStatus"] = "DONE" if is_done else "PENDING"
            a["isDone"] = is_done
            a["isSubmitted"] = is_done
        else:
            raw_st = a.get("applicationStatus") or a.get("status") or "PENDING"
            is_done = bool(a.get("isDone") or a.get("isSubmitted") or raw_st.upper() in ("DONE", "SUBMITTED", "COMPLETED"))

        meta = compute_relative_deadline(due_d, due_t, raw_st, now_utc, is_done=is_done)

        enriched = {
            **a,
            "formattedDeadline": meta["formattedDeadline"],
            "relativeDeadline": meta["relativeDeadline"],
            "isOverdue": meta["isOverdue"] if is_manually_set is None else False,
            "isDueSoon": meta["isDueSoon"] if is_manually_set is None else False,
            "sortKey": meta["sortKey"],
            "displayStatus": "DONE" if is_done else meta["finalStatus"],
            "status": "DONE" if is_done else meta["finalStatus"],
            "isDone": is_done or meta["finalStatus"] == "DONE",
        }
        enriched_assignments.append(enriched)

    # 6. Group by enrolled subject
    # Central Principle: "Subject first, assignment second, source third"
    subject_map: Dict[str, Dict[str, Any]] = {}
    for c in courses:
        code = canonicalize_course_code(c.get("code"))
        if not code:
            continue
        subject_map[code] = {
            "id": code,
            "courseCode": code,
            "courseTitle": c.get("title") or code,
            "type": c.get("type", "Theory"),
            "slot": c.get("slot"),
            "faculty": c.get("faculty"),
            "venue": c.get("venue"),
            "teamsMatched": code in teams_matched_codes,
            "teamsChannelName": next((m.get("teamName") for m in (teams_account.get("matchedSubjects") or []) if m.get("courseCode") == code), None),
            "lmsMatched": code in lms_matched_codes,
            "lmsCourseName": next((m.get("lmsCourseName") for m in (lms_account.get("matchedSubjects") or []) if m.get("courseCode") == code), None),
            "assignments": [],
            "pendingCount": 0,
            "submittedCount": 0,
            "overdueCount": 0,
            "dueSoonCount": 0,
            "totalCount": 0,
        }

    unmatched_assignments: List[Dict[str, Any]] = []

    for a in enriched_assignments:
        c_code = canonicalize_course_code(a.get("courseCode"))
        # Exact match to enrolled subject
        matched_sub = subject_map.get(c_code)
        if matched_sub:
            matched_sub["assignments"].append(a)
        else:
            is_lms_item = (
                a.get("source") == "LMS"
                or "lms" in str(a.get("id", "")).lower()
                or "LMS" in a.get("sourceList", [])
                or a.get("platformName") == "VIT LMS"
            )
            # Unmatched/unverified LMS coursework MUST NOT be shown anywhere in CampusOS
            if not is_lms_item:
                unmatched_assignments.append(a)

    # 7. Sort assignments under each subject: Overdue first, Due Soonest next, then Later deadlines
    total_pending_all = 0
    total_submitted_all = 0
    total_overdue_all = 0

    teams_connected = bool(store.get("teamsConnected"))
    lms_connected = bool(store.get("lmsConnected"))
    is_any_connected = teams_connected or lms_connected
    t_matches = teams_account.get("courseMatches") or []
    l_matches = lms_account.get("courseMatches") or []

    subject_list: List[Dict[str, Any]] = []
    for sub in subject_map.values():
        # Sort assignments: Overdue first, Due Soon next, Pending next, Status Unavailable next, DONE last
        def sort_priority(item: Dict[str, Any]) -> Tuple[int, str]:
            st = (item.get("displayStatus") or "").upper()
            if st == "OVERDUE":
                return (0, item.get("sortKey", ""))
            elif st == "DUE SOON":
                return (1, item.get("sortKey", ""))
            elif st == "PENDING":
                return (2, item.get("sortKey", ""))
            elif st == "STATUS_UNAVAILABLE":
                return (3, item.get("sortKey", ""))
            else:  # DONE / Submitted
                return (4, item.get("sortKey", ""))

        sub["assignments"].sort(key=sort_priority)

        p_cnt = len([a for a in sub["assignments"] if (a.get("displayStatus") or "").upper() in ("PENDING", "DUE SOON", "OVERDUE")])
        s_cnt = len([a for a in sub["assignments"] if (a.get("displayStatus") or "").upper() in ("DONE", "SUBMITTED", "COMPLETED")])
        o_cnt = len([a for a in sub["assignments"] if (a.get("displayStatus") or "").upper() == "OVERDUE"])
        d_cnt = len([a for a in sub["assignments"] if (a.get("displayStatus") or "").upper() == "DUE SOON"])

        sub["pendingCount"] = p_cnt
        sub["submittedCount"] = s_cnt
        sub["overdueCount"] = o_cnt
        sub["dueSoonCount"] = d_cnt
        sub["totalCount"] = len(sub["assignments"])

        # Section 25: Internally distinguish 0 assignments vs faculty mismatch vs external unavailable
        sync_note = None
        if len(sub["assignments"]) == 0:
            t_m = next((m for m in t_matches if m.get("matchedCourseCode") == sub["courseCode"]), None)
            l_m = next((m for m in l_matches if m.get("matchedCourseCode") == sub["courseCode"]), None)

            if (t_m and not t_m.get("facultyMatch") and t_m.get("courseCodeMatch")) or \
               (l_m and not l_m.get("facultyMatch") and l_m.get("courseCodeMatch")):
                sync_note = "Course not synchronized because faculty identity could not be verified."
            elif is_any_connected:
                sync_note = "No assignments found."
            else:
                sync_note = "Connect Microsoft Teams or VIT LMS to synchronize assignments."

        sub["syncStatusNote"] = sync_note

        total_pending_all += p_cnt
        total_submitted_all += s_cnt
        total_overdue_all += o_cnt

        subject_list.append(sub)

    # Sort subjects: subjects with pending/overdue assignments first, then by code
    subject_list.sort(key=lambda s: (-s["overdueCount"], -s["pendingCount"], s["courseCode"]))

    # Requirement 5: Log final subject-assignment mapping
    logger.info(
        "\n======================================================\n"
        "[FACULTY MATCHING] Final Subject-Assignment Mapping (%d subjects):\n%s\n"
        "======================================================",
        len(subject_list),
        "\n".join([
            f"  - Subject: [{sub['courseCode']}] {sub['courseTitle']} (Faculty: {sub.get('faculty')}) -> {len(sub['assignments'])} assignments:\n" +
            "\n".join([f"      * '{item['title']}' (Poster: {item.get('postedBy') or item.get('faculty')})" for item in sub["assignments"]])
            if sub["assignments"] else f"  - Subject: [{sub['courseCode']}] {sub['courseTitle']} (Faculty: {sub.get('faculty')}) -> 0 assignments"
            for sub in subject_list
        ])
    )

    # 8. Determine empty state & sync status
    teams_connected = bool(store.get("teamsConnected"))
    lms_connected = bool(store.get("lmsConnected"))
    is_any_connected = teams_connected or lms_connected

    last_synced = None
    if teams_account.get("lastSynced") or lms_account.get("lastSynced"):
        dates = [d for d in [teams_account.get("lastSynced"), lms_account.get("lastSynced")] if d]
        last_synced = max(dates) if dates else None

    state_label = "not_synced"
    if is_any_connected:
        if total_pending_all == 0 and len(raw_assignments) >= 0:
            state_label = "caught_up"
        else:
            state_label = "synced"

    return {
        "currentSemester": semester,
        "lastSynced": last_synced,
        "stateLabel": state_label,
        "totalPendingAssignments": total_pending_all,
        "totalSubmittedAssignments": total_submitted_all,
        "totalOverdueAssignments": total_overdue_all,
        "totalAssignments": len(enriched_assignments),
        "subjects": subject_list,
        "unmatchedAssignments": unmatched_assignments,
        "connectedAccounts": {
            "teams": {
                "connected": teams_connected,
                "email": teams_account.get("email"),
                "displayName": teams_account.get("displayName"),
                "lastSynced": teams_account.get("lastSynced"),
                "matchedCount": teams_account.get("matchedCount", 0),
                "portalUrl": "https://www.microsoft.com/en-in/microsoft-teams/log-in",
            },
            "lms": {
                "connected": lms_connected,
                "username": lms_account.get("username"),
                "displayName": lms_account.get("displayName"),
                "lastSynced": lms_account.get("lastSynced"),
                "matchedCount": lms_account.get("matchedCount", 0),
                "portalUrl": "https://lms.vit.ac.in",
            },
        },
    }


@router.get("/academic-accounts/status")
def get_academic_accounts_status(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Returns connection status and metadata for all connected academic platforms.
    """
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    store = load_store(reg)
    teams_connected = bool(store.get("teamsConnected"))
    lms_connected = bool(store.get("lmsConnected"))

    teams_acc = store.get("teamsAccount") or {}
    lms_acc = store.get("lmsAccount") or {}

    semester = store.get("selectedSemester") or {
        "name": store.get("student", {}).get("semester", "Fall Semester 2026-27"),
        "id": store.get("student", {}).get("semesterId", "CH20262701"),
    }

    return {
        "currentSemester": semester,
        "teams": {
            "connected": teams_connected,
            "status": "connected" if teams_connected else "disconnected",
            "email": teams_acc.get("email"),
            "displayName": teams_acc.get("displayName"),
            "lastSynced": teams_acc.get("lastSynced"),
            "matchedCount": teams_acc.get("matchedCount", 0),
            "portalUrl": "https://www.microsoft.com/en-in/microsoft-teams/log-in",
        },
        "lms": {
            "connected": lms_connected,
            "status": "connected" if lms_connected else "disconnected",
            "username": lms_acc.get("username"),
            "displayName": lms_acc.get("displayName"),
            "lastSynced": lms_acc.get("lastSynced"),
            "matchedCount": lms_acc.get("matchedCount", 0),
            "portalUrl": "https://lms.vit.ac.in",
        },
    }


@router.get("/assignments/unified")
def get_unified_assignments(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    x_auth_user: Optional[str] = Header(None, alias="X-Auth-User"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Returns the unified subject-centric assignment dashboard for the current semester.
    """
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo, x_auth_user)
    store = load_store(reg)
    return build_unified_assignment_dashboard(store)


@router.post("/academic-accounts/sync-all")
def sync_all_academic_accounts(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    x_auth_user: Optional[str] = Header(None, alias="X-Auth-User"),
    x_auth_pass: Optional[str] = Header(None, alias="X-Auth-Pass"),
    x_lms_user: Optional[str] = Header(None, alias="X-LMS-User"),
    x_lms_pass: Optional[str] = Header(None, alias="X-LMS-Pass"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Re-synchronizes all connected academic platforms (Teams + LMS)
    and returns the updated unified assignment dashboard.
    """
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo, x_auth_user or x_lms_user)
    if not reg:
        return {
            "success": False,
            "message": "Student registration number or active session is required to sync accounts.",
            "dashboard": build_unified_assignment_dashboard(empty_store()),
        }

    store = load_store(reg)
    synced_sources = []
    errors = []

    # Sync Teams if connected
    if store.get("teamsConnected"):
        try:
            from app.routers.teams import sync_teams
            sync_teams(x_session_id=x_session_id, x_reg_no=x_reg_no or reg, sessionId=sessionId, regNo=regNo or reg)
            synced_sources.append("Microsoft Teams")
        except HTTPException as he:
            logger.warning("Teams HTTP error during sync-all: %s", he.detail)
            errors.append(f"Microsoft Teams: {he.detail}")
        except Exception as e:
            logger.warning("Teams sync error during sync-all: %s", e)
            errors.append(f"Microsoft Teams: {e}")

    # Sync LMS if connected
    if store.get("lmsConnected"):
        try:
            from app.routers.lms import sync_lms
            sync_lms(
                x_session_id=x_session_id,
                x_reg_no=x_reg_no or reg,
                x_auth_user=x_auth_user,
                x_auth_pass=x_auth_pass,
                x_lms_user=x_lms_user,
                x_lms_pass=x_lms_pass,
                sessionId=sessionId,
                regNo=regNo or reg,
            )
            synced_sources.append("VIT LMS")
        except HTTPException as he:
            logger.warning("LMS HTTP error during sync-all: %s", he.detail)
            errors.append(f"VIT LMS: {he.detail}")
        except Exception as e:
            logger.warning("LMS sync error during sync-all: %s", e)
            errors.append(f"VIT LMS: {e}")

    updated_store = load_store(reg)
    dashboard = build_unified_assignment_dashboard(updated_store)

    msg = f"Synchronized across {', '.join(synced_sources)}." if synced_sources else "No external accounts connected to synchronize."
    if errors:
        msg += f" Note: {'; '.join(errors)}"

    overall_success = (len(synced_sources) > 0) or (len(errors) == 0)

    return {
        "success": overall_success,
        "message": msg,
        "dashboard": dashboard,
    }


class AssignmentStatusUpdateRequest(BaseModel):
    status: str


@router.get("/assignments")
def get_all_assignments_endpoint(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> List[Dict[str, Any]]:
    """
    Returns all verified assignments in store for the active student.
    """
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    store = load_store(reg)
    dash = build_unified_assignment_dashboard(store)
    flat: List[Dict[str, Any]] = []
    for s in dash.get("subjects", []):
        flat.extend(s.get("assignments", []))
    flat.extend(dash.get("unmatchedAssignments", []))
    return flat


@router.post("/assignments/{assignment_id}/status")
@router.put("/assignments/{assignment_id}/status")
def update_assignment_status_endpoint(
    assignment_id: str,
    payload: AssignmentStatusUpdateRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """
    Updates the completion status of an assignment in the store.
    """
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    store = load_store(reg)
    assignments = list(store.get("assignments") or [])
    manual_status = dict(store.get("manualAssignmentStatus") or {})
    new_status = payload.status
    is_done = new_status.upper() in ("SUBMITTED", "DONE", "COMPLETED")

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
    new_assignments = []
    found = False

    for a in assignments:
        a_id = str(a.get("id"))
        if a_id == str(assignment_id) or assignment_id in a_id or a_id in str(assignment_id):
            found = True
            a["status"] = "Submitted" if is_done else "Pending"
            a["displayStatus"] = "DONE" if is_done else "PENDING"
            a["applicationStatus"] = "DONE" if is_done else "PENDING"
            a["isDone"] = is_done
            a["isSubmitted"] = is_done
            if is_done:
                a["submittedAt"] = datetime.now(timezone.utc).isoformat()
            else:
                a["submittedAt"] = None
            if a.get("title"):
                manual_status[a["title"]] = is_done
            updated_assignment = a
        new_assignments.append(a)

    if not found:
        updated_assignment = {
            "id": assignment_id,
            "status": "Submitted" if is_done else "Pending",
            "displayStatus": "DONE" if is_done else "PENDING",
            "applicationStatus": "DONE" if is_done else "PENDING",
            "isDone": is_done,
            "isSubmitted": is_done,
            "submittedAt": datetime.now(timezone.utc).isoformat() if is_done else None,
        }
        new_assignments.append(updated_assignment)

    store["assignments"] = new_assignments
    store["manualAssignmentStatus"] = manual_status
    save_store(store, reg or get_default_local_reg())
    return {
        "success": True,
        "assignment": updated_assignment,
    }
