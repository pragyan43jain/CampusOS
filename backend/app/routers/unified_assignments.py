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

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.storage import load_store, save_store
from app.routers.teams import match_faculty_names, get_base_code

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
    Requires:
    1. Matching normalized course code
    2. High title similarity OR (matching due date AND moderate title similarity)
    """
    c1 = re.sub(r"[^A-Z0-9]", "", (a1.get("courseCode") or "").upper())
    c2 = re.sub(r"[^A-Z0-9]", "", (a2.get("courseCode") or "").upper())
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
    Preserves both source submission URLs.
    """
    # Pick title with best detail
    title1 = teams_item.get("title") or ""
    title2 = lms_item.get("title") or ""
    title = title1 if len(title1) >= len(title2) else title2

    # Status: if either is submitted, reflect submitted
    st1 = teams_item.get("status") or "Pending"
    st2 = lms_item.get("status") or "Pending"
    merged_status = "Submitted" if (st1 == "Submitted" or st2 == "Submitted") else "Pending"

    # Descriptions
    desc1 = teams_item.get("instructions") or ""
    desc2 = lms_item.get("instructions") or ""
    desc = desc1 if len(desc1) >= len(desc2) else desc2

    # Dates
    due_date = teams_item.get("dueDate") if teams_item.get("dueDate") != "TBA" else lms_item.get("dueDate")
    due_time = teams_item.get("dueTime") or lms_item.get("dueTime") or "23:59"

    return {
        "id": f"unified-{teams_item.get('id', '')}-{lms_item.get('id', '')}",
        "courseCode": teams_item.get("courseCode") or lms_item.get("courseCode"),
        "courseTitle": teams_item.get("courseTitle") or lms_item.get("courseTitle"),
        "faculty": teams_item.get("faculty") or lms_item.get("faculty"),
        "title": title,
        "description": desc,
        "instructions": desc,
        "source": "Teams + LMS",
        "sourceList": ["Teams", "LMS"],
        "dueDate": due_date or "TBA",
        "dueTime": due_time,
        "status": merged_status,
        "priority": teams_item.get("priority") or lms_item.get("priority") or "Medium",
        "weightage": teams_item.get("weightage") or lms_item.get("weightage") or 10,
        "submissionUrl": teams_item.get("platformUrl") or lms_item.get("platformUrl"),
        "teamsSubmissionUrl": teams_item.get("platformUrl"),
        "lmsSubmissionUrl": lms_item.get("platformUrl"),
        "matchedTeamName": teams_item.get("matchedTeamName"),
        "matchedLmsCourse": lms_item.get("matchedLmsCourse"),
    }


def compute_relative_deadline(
    due_date_str: str, due_time_str: str, current_status: str, now: Optional[datetime] = None
) -> Dict[str, Any]:
    """
    Calculates dynamic relative deadline and overdue state based on current time.
    Does NOT use hardcoded dates.
    """
    if not now:
        now = datetime.now(timezone.utc)

    if not due_date_str or due_date_str == "TBA":
        return {
            "formattedDeadline": "TBA",
            "relativeDeadline": "No deadline specified",
            "isOverdue": False,
            "isDueSoon": False,
            "sortKey": "9999-99-99T99:99:99",
            "finalStatus": current_status,
        }

    time_part = due_time_str if due_time_str else "23:59"
    try:
        dt = datetime.strptime(f"{due_date_str} {time_part}", "%Y-%m-%d %H:%M").replace(tzinfo=timezone.utc)
    except Exception:
        return {
            "formattedDeadline": f"{due_date_str} {time_part}",
            "relativeDeadline": "TBA",
            "isOverdue": False,
            "isDueSoon": False,
            "sortKey": "9999-99-99",
            "finalStatus": current_status,
        }

    formatted = dt.strftime("%d %b %Y, %I:%M %p")
    diff = dt - now
    total_seconds = diff.total_seconds()

    if current_status == "Submitted":
        return {
            "formattedDeadline": formatted,
            "relativeDeadline": "Completed",
            "isOverdue": False,
            "isDueSoon": False,
            "sortKey": dt.isoformat(),
            "finalStatus": "Submitted",
        }

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
            "finalStatus": "Overdue",
        }

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
            "finalStatus": "Pending",
        }


def build_unified_assignment_dashboard(store: Dict[str, Any]) -> Dict[str, Any]:
    """
    Builds the subject-first unified assignment structure for the student's current semester.
    """
    # 1. Current Semester Source of Truth
    semester = store.get("selectedSemester") or {}
    if not semester.get("name") and store.get("student"):
        semester = {
            "name": store["student"].get("semester", "Fall Semester 2026-27"),
            "id": store["student"].get("semesterId", "CH20262701"),
        }

    # 2. Student's enrolled courses for the current semester
    courses = list(store.get("courses") or [])

    # 3. Raw assignments stored from connected sources
    # Strictly verify: 1. Enrolled in current semester 2. Professor name matches course faculty
    raw_unfiltered = list(store.get("assignments") or [])
    raw_assignments: List[Dict[str, Any]] = []
    for a in raw_unfiltered:
        c_code = a.get("courseCode")
        matched_c = next((c for c in courses if c.get("code") == c_code or get_base_code(c.get("code")) == get_base_code(c_code)), None)
        if not matched_c:
            continue

        vtop_faculty = matched_c.get("faculty")
        assign_faculty_sources = [a.get("faculty"), a.get("matchedTeamName"), a.get("matchedLmsCourse")]
        if not match_faculty_names(vtop_faculty, [s for s in assign_faculty_sources if s]):
            logger.warning(
                "Unified dashboard dropping assignment '%s' [%s]: course faculty '%s' did not match %s",
                a.get("title"),
                c_code,
                vtop_faculty,
                assign_faculty_sources,
            )
            continue

        raw_assignments.append({
            **a,
            "courseCode": matched_c.get("code") or c_code,
            "courseTitle": matched_c.get("title") or a.get("courseTitle"),
            "faculty": vtop_faculty,
        })

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
            deduped_assignments.append({
                **l_item,
                "sourceList": ["LMS"],
                "lmsSubmissionUrl": l_item.get("platformUrl"),
            })

    for o_item in other_items:
        o_id = o_item.get("id")
        if o_id not in used_ids:
            used_ids.add(o_id)
            deduped_assignments.append({
                **o_item,
                "sourceList": [o_item.get("source", "Portal")],
            })

    # 5. Enrich with dynamic relative deadlines
    now_utc = datetime.now(timezone.utc)
    enriched_assignments: List[Dict[str, Any]] = []
    for a in deduped_assignments:
        due_d = a.get("dueDate") or "TBA"
        due_t = a.get("dueTime") or "23:59"
        raw_st = a.get("status") or "Pending"
        meta = compute_relative_deadline(due_d, due_t, raw_st, now_utc)

        enriched = {
            **a,
            "formattedDeadline": meta["formattedDeadline"],
            "relativeDeadline": meta["relativeDeadline"],
            "isOverdue": meta["isOverdue"],
            "isDueSoon": meta["isDueSoon"],
            "sortKey": meta["sortKey"],
            "displayStatus": meta["finalStatus"],
        }
        enriched_assignments.append(enriched)

    # 6. Group by enrolled subject
    # Central Principle: "Subject first, assignment second, source third"
    subject_map: Dict[str, Dict[str, Any]] = {}
    for c in courses:
        code = c.get("code")
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
        c_code = a.get("courseCode")
        # Match to enrolled subject
        matched_sub = subject_map.get(c_code)
        if not matched_sub:
            # Check base code
            base_code = c_code[:-1] if c_code and c_code[-1] in ("L", "P", "J") else c_code
            for sub_code, sub_val in subject_map.items():
                if sub_code.startswith(base_code):
                    matched_sub = sub_val
                    break

        if matched_sub:
            matched_sub["assignments"].append(a)
        else:
            unmatched_assignments.append(a)

    # 7. Sort assignments under each subject: Overdue first, Due Soonest next, then Later deadlines
    total_pending_all = 0
    total_submitted_all = 0
    total_overdue_all = 0

    subject_list: List[Dict[str, Any]] = []
    for sub in subject_map.values():
        # Sort assignments
        def sort_priority(item: Dict[str, Any]) -> Tuple[int, str]:
            st = item.get("displayStatus")
            if st == "Overdue":
                return (0, item.get("sortKey", ""))
            elif st == "Due Soon":
                return (1, item.get("sortKey", ""))
            elif st == "Pending":
                return (2, item.get("sortKey", ""))
            else:  # Submitted
                return (3, item.get("sortKey", ""))

        sub["assignments"].sort(key=sort_priority)

        p_cnt = len([a for a in sub["assignments"] if a.get("displayStatus") in ("Pending", "Due Soon", "Overdue")])
        s_cnt = len([a for a in sub["assignments"] if a.get("displayStatus") == "Submitted"])
        o_cnt = len([a for a in sub["assignments"] if a.get("displayStatus") == "Overdue"])
        d_cnt = len([a for a in sub["assignments"] if a.get("displayStatus") == "Due Soon"])

        sub["pendingCount"] = p_cnt
        sub["submittedCount"] = s_cnt
        sub["overdueCount"] = o_cnt
        sub["dueSoonCount"] = d_cnt
        sub["totalCount"] = len(sub["assignments"])

        total_pending_all += p_cnt
        total_submitted_all += s_cnt
        total_overdue_all += o_cnt

        subject_list.append(sub)

    # Sort subjects: subjects with pending/overdue assignments first, then by code
    subject_list.sort(key=lambda s: (-s["overdueCount"], -s["pendingCount"], s["courseCode"]))

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
def get_academic_accounts_status() -> Dict[str, Any]:
    """
    Returns connection status and metadata for all connected academic platforms.
    """
    store = load_store()
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
def get_unified_assignments() -> Dict[str, Any]:
    """
    Returns the unified subject-centric assignment dashboard for the current semester.
    """
    store = load_store()
    return build_unified_assignment_dashboard(store)


@router.post("/academic-accounts/sync-all")
def sync_all_academic_accounts() -> Dict[str, Any]:
    """
    Re-synchronizes all connected academic platforms (Teams + LMS)
    and returns the updated unified assignment dashboard.
    """
    store = load_store()
    synced_sources = []
    errors = []

    # Sync Teams if connected
    if store.get("teamsConnected"):
        try:
            from app.routers.teams import sync_teams
            sync_teams()
            synced_sources.append("Microsoft Teams")
        except Exception as e:
            logger.warning("Teams sync error during sync-all: %s", e)
            errors.append(f"Microsoft Teams: {e}")

    # Sync LMS if connected
    if store.get("lmsConnected"):
        try:
            from app.routers.lms import sync_lms
            sync_lms()
            synced_sources.append("VIT LMS")
        except Exception as e:
            logger.warning("LMS sync error during sync-all: %s", e)
            errors.append(f"VIT LMS: {e}")

    updated_store = load_store()
    dashboard = build_unified_assignment_dashboard(updated_store)

    msg = f"Synchronized across {', '.join(synced_sources)}." if synced_sources else "No external accounts connected to synchronize."
    if errors:
        msg += f" Note: {'; '.join(errors)}"

    return {
        "success": len(errors) == 0,
        "message": msg,
        "dashboard": dashboard,
    }
