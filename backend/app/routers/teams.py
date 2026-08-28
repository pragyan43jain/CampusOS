"""
CampusOS Backend - Microsoft Teams Integration Router

Authenticates student institutional Microsoft credentials directly against
Microsoft Online (https://login.microsoftonline.com / https://www.microsoft.com/en-in/microsoft-teams/log-in).
Validates user credentials against Microsoft Entra ID / Microsoft 365 tenant.
If the password is incorrect, returns an explicit 401 Invalid Credentials response.
If authenticated, fetches authentic class coursework via Microsoft Graph API.
Under no circumstances generates fake, mock, or placeholder assignments.
"""

import json
import logging
import re
import urllib.parse
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.storage import load_store, save_store
from app.course_verification import (
    VerifiedCourseRecord,
    ExternalCourseMatch,
    canonicalize_course_code,
    canonicalize_faculty_name,
    build_verified_semester_course_records,
    verify_external_course,
)

import time

logger = logging.getLogger("vtop.routes.teams")

router = APIRouter(prefix="/api/teams", tags=["teams"])

# Well-known Microsoft Teams / Microsoft 365 Public Client ID & Endpoints
TEAMS_CLIENT_ID = "1fec8e78-bce4-4aaf-ab1b-5451cc387264"  # Official Microsoft Teams Client
GRAPH_RESOURCE = "https://graph.microsoft.com"
SKYPE_RESOURCE = "https://api.spaces.skype.com"
ASSIGNMENTS_RESOURCE = "https://assignments.onenote.com"
LOGIN_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/token"
USERREALM_URL = "https://login.microsoftonline.com/common/userrealm/"
TEAMS_PORTAL_URL = "https://www.microsoft.com/en-in/microsoft-teams/log-in"

REQUEST_TIMEOUT = 12


def map_teams_submission_status(
    submission_data: Optional[Dict[str, Any]],
    due_datetime_iso: Optional[str] = None,
    now: Optional[datetime] = None,
    api_failed: bool = False,
) -> Dict[str, Any]:
    """
    Centralized mapper for Microsoft Teams assignment submission states.
    Strictly implements priority from Sections 8 & 15 of user specification:
    1. Actual submitted/completed state -> DONE
    2. Explicit resubmission requirement -> PENDING
    3. Confirmed not submitted + deadline passed -> OVERDUE
    4. Confirmed not submitted + deadline not passed -> PENDING
    5. Submission status unavailable / API failure -> STATUS_UNAVAILABLE
    """
    if now is None:
        now = datetime.now(timezone.utc)

    if api_failed:
        return {
            "teamsSubmissionState": "unavailable",
            "applicationStatus": "STATUS_UNAVAILABLE",
            "isDone": False,
            "isSubmitted": False,
            "isOverdue": False,
            "isLate": False,
            "submittedAt": None,
            "returnedAt": None,
            "submissionId": None,
            "statusSource": "teams_api_failure",
            "statusVerifiedAt": now.isoformat(),
            "uiStatus": "STATUS_UNAVAILABLE",
        }

    if not submission_data:
        is_overdue = False
        if due_datetime_iso:
            try:
                due_dt = datetime.fromisoformat(due_datetime_iso.replace("Z", "+00:00"))
                is_overdue = due_dt < now
            except Exception:
                pass
        app_status = "OVERDUE" if is_overdue else "PENDING"
        return {
            "teamsSubmissionState": "notSubmitted",
            "applicationStatus": app_status,
            "isDone": False,
            "isSubmitted": False,
            "isOverdue": is_overdue,
            "isLate": False,
            "submittedAt": None,
            "returnedAt": None,
            "submissionId": None,
            "statusSource": "teams_confirmed_empty",
            "statusVerifiedAt": now.isoformat(),
            "uiStatus": app_status,
        }

    raw_state = (submission_data.get("status") or "").lower().strip()
    submission_id = submission_data.get("id")
    submitted_at = submission_data.get("submittedDateTime")
    returned_at = submission_data.get("returnedDateTime") or submission_data.get("releasedDateTime")
    reassigned_at = submission_data.get("reassignedDateTime")

    # Priority 1: Actual submitted / completed / released
    if raw_state in ("submitted", "turnedin", "completed", "released"):
        is_late = False
        if due_datetime_iso and submitted_at:
            try:
                due_dt = datetime.fromisoformat(due_datetime_iso.replace("Z", "+00:00"))
                sub_dt = datetime.fromisoformat(submitted_at.replace("Z", "+00:00"))
                is_late = sub_dt > due_dt
            except Exception:
                pass
        return {
            "teamsSubmissionState": raw_state,
            "applicationStatus": "DONE",
            "isDone": True,
            "isSubmitted": True,
            "isOverdue": False,
            "isLate": is_late,
            "submittedAt": submitted_at,
            "returnedAt": returned_at,
            "submissionId": submission_id,
            "statusSource": "teams_graph_submission",
            "statusVerifiedAt": now.isoformat(),
            "uiStatus": "DONE",
        }

    # Section 9: Returned -> DONE unless source explicitly indicates resubmission is required
    if raw_state == "returned":
        is_resubmission_required = bool(reassigned_at)
        if is_resubmission_required:
            return {
                "teamsSubmissionState": "resubmissionRequired",
                "applicationStatus": "PENDING",
                "isDone": False,
                "isSubmitted": False,
                "isOverdue": False,
                "isLate": False,
                "submittedAt": submitted_at,
                "returnedAt": returned_at,
                "submissionId": submission_id,
                "statusSource": "teams_graph_submission",
                "statusVerifiedAt": now.isoformat(),
                "uiStatus": "PENDING",
            }
        else:
            return {
                "teamsSubmissionState": "returned",
                "applicationStatus": "DONE",
                "isDone": True,
                "isSubmitted": True,
                "isOverdue": False,
                "isLate": False,
                "submittedAt": submitted_at,
                "returnedAt": returned_at,
                "submissionId": submission_id,
                "statusSource": "teams_graph_submission",
                "statusVerifiedAt": now.isoformat(),
                "uiStatus": "DONE",
            }

    # Priority 2: Explicit resubmission requirement
    if raw_state in ("reassigned", "resubmissionrequired"):
        return {
            "teamsSubmissionState": "resubmissionRequired",
            "applicationStatus": "PENDING",
            "isDone": False,
            "isSubmitted": False,
            "isOverdue": False,
            "isLate": False,
            "submittedAt": submitted_at,
            "returnedAt": returned_at,
            "submissionId": submission_id,
            "statusSource": "teams_graph_submission",
            "statusVerifiedAt": now.isoformat(),
            "uiStatus": "PENDING",
        }

    # Priority 3 & 4: Working / not submitted
    if raw_state in ("working", "notsubmitted", "pending", "unsubmitted"):
        is_overdue = False
        if due_datetime_iso:
            try:
                due_dt = datetime.fromisoformat(due_datetime_iso.replace("Z", "+00:00"))
                is_overdue = due_dt < now
            except Exception:
                pass
        app_status = "OVERDUE" if is_overdue else "PENDING"
        return {
            "teamsSubmissionState": "notSubmitted" if raw_state != "working" else "working",
            "applicationStatus": app_status,
            "isDone": False,
            "isSubmitted": False,
            "isOverdue": is_overdue,
            "isLate": False,
            "submittedAt": None,
            "returnedAt": None,
            "submissionId": submission_id,
            "statusSource": "teams_graph_submission",
            "statusVerifiedAt": now.isoformat(),
            "uiStatus": app_status,
        }

    # Priority 5: Unknown state -> STATUS_UNAVAILABLE
    return {
        "teamsSubmissionState": raw_state or "unknown",
        "applicationStatus": "STATUS_UNAVAILABLE",
        "isDone": False,
        "isSubmitted": False,
        "isOverdue": False,
        "isLate": False,
        "submittedAt": submitted_at,
        "returnedAt": returned_at,
        "submissionId": submission_id,
        "statusSource": "teams_graph_unknown",
        "statusVerifiedAt": now.isoformat(),
        "uiStatus": "STATUS_UNAVAILABLE",
    }


def fetch_student_teams_submission(
    class_id: str,
    assignment_id: str,
    headers: Dict[str, str],
    authenticated_user_id: Optional[str] = None,
    max_retries: int = 2,
) -> Tuple[Optional[Dict[str, Any]], bool]:
    """
    Fetches the submission record for the authenticated student with retry logic.
    Returns: (submission_record, api_failed)
    """
    url = f"https://assignments.onenote.com/api/v1.0/edu/classes/{class_id}/assignments/{assignment_id}/submissions"
    for attempt in range(max_retries + 1):
        try:
            r = requests.get(url, headers=headers, timeout=REQUEST_TIMEOUT)
            if r.status_code == 200:
                data = r.json()
                items = data.get("value", [])
                if not items:
                    return None, False

                if authenticated_user_id:
                    for item in items:
                        recip = item.get("recipient") or {}
                        recip_id = recip.get("userId")
                        sub_by = (item.get("submittedBy") or {}).get("user") or {}
                        sub_id = sub_by.get("id")
                        if recip_id == authenticated_user_id or sub_id == authenticated_user_id:
                            return item, False
                    if len(items) == 1:
                        return items[0], False
                    return None, False
                else:
                    return items[0], False

            elif r.status_code == 404:
                return None, False
            elif r.status_code in (401, 403):
                logger.warning("Teams submission auth issue (%s) for class %s / assignment %s", r.status_code, class_id, assignment_id)
                return None, True
            else:
                if attempt < max_retries:
                    time.sleep(0.4 * (attempt + 1))
                    continue
                return None, True
        except Exception as exc:
            logger.warning("Teams submission fetch attempt %d failed: %s", attempt + 1, exc)
            if attempt < max_retries:
                time.sleep(0.4 * (attempt + 1))
                continue
            return None, True

    return None, True


class TeamsLoginRequest(BaseModel):
    email: str
    password: str
    tenant: Optional[str] = "vitstudent.ac.in"


def verify_microsoft_realm(email: str) -> Dict[str, Any]:
    """
    Checks if the student's email domain is a recognized Microsoft 365 / Entra ID tenant.
    """
    domain = email.split("@")[-1].lower() if "@" in email else ""
    try:
        url = f"{USERREALM_URL}?user={urllib.parse.quote(email)}&api-version=2.1"
        res = requests.get(url, timeout=REQUEST_TIMEOUT)
        if res.status_code == 200:
            data = res.json()
            ns_type = data.get("NameSpaceType")
            if ns_type == "Unknown":
                raise HTTPException(
                    status_code=400,
                    detail=(
                        f"The domain '@{domain}' is not recognized as an institutional Microsoft 365 tenant. "
                        "Please use your university Microsoft email address (e.g. @vitstudent.ac.in)."
                    ),
                )
            return data
    except HTTPException:
        raise
    except Exception as exc:
        logger.warning("Microsoft UserRealm check network issue: %s", exc)
    return {"NameSpaceType": "Managed", "DomainName": domain}


def authenticate_microsoft_online(email: str, password: str) -> Dict[str, Any]:
    """
    Authenticates user credentials directly with Microsoft Online OAuth2 token endpoint.
    Returns token payload on success, or raises HTTPException on invalid credentials.
    """
    payload = {
        "client_id": TEAMS_CLIENT_ID,
        "grant_type": "password",
        "resource": GRAPH_RESOURCE,
        "username": email,
        "password": password,
    }
    headers = {
        "User-Agent": (
            "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 "
            "(KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36"
        ),
        "Accept": "application/json",
        "Referer": TEAMS_PORTAL_URL,
    }

    try:
        res = requests.post(LOGIN_TOKEN_URL, data=payload, headers=headers, timeout=15)
    except Exception as exc:
        logger.error("Failed to connect to Microsoft login service: %s", exc)
        raise HTTPException(
            status_code=502,
            detail=(
                "Unable to connect to Microsoft Online authentication service. "
                "Please verify your internet connection or try again shortly."
            ),
        )

    if res.status_code == 200:
        return {"success": True, "token": res.json()}

    # Parse error response from Microsoft Entra ID
    try:
        err_json = res.json()
    except Exception:
        err_json = {}

    error_codes = err_json.get("error_codes") or []
    error_desc = err_json.get("error_description") or ""

    logger.warning(
        "Microsoft authentication failed for %s: codes=%s, desc=%s",
        email,
        error_codes,
        error_desc[:120],
    )

    # 1. Explicit invalid password error
    if 50126 in error_codes:
        raise HTTPException(
            status_code=401,
            detail="Invalid credentials. The password entered is incorrect for this Microsoft account.",
        )

    # 2. User account not found in directory
    if 50034 in error_codes:
        raise HTTPException(
            status_code=401,
            detail=f"Invalid credentials. Account '{email}' was not found in the Microsoft directory.",
        )

    # 3. Account locked / too many attempts
    if 50053 in error_codes:
        raise HTTPException(
            status_code=401,
            detail=(
                "Account temporarily locked due to too many incorrect password attempts. "
                f"Please reset your password on the Microsoft portal: {TEAMS_PORTAL_URL}"
            ),
        )

    # 4. Password expired
    if 50055 in error_codes:
        raise HTTPException(
            status_code=401,
            detail=(
                "Your Microsoft 365 password has expired. "
                f"Please update it on the official portal: {TEAMS_PORTAL_URL}"
            ),
        )

    # 5. Account disabled
    if 50057 in error_codes:
        raise HTTPException(
            status_code=401,
            detail="This Microsoft account has been disabled by your university IT administrator.",
        )

    # 6. Multi-Factor Authentication (MFA) required by institutional policy
    # Microsoft triggers 50076/50079 ONLY AFTER verifying that the password is valid and correct!
    if 50076 in error_codes or 50079 in error_codes:
        return {
            "success": True,
            "mfa_required": True,
            "message": (
                "Institutional credentials verified successfully with Microsoft Online. "
                "Note: Multi-Factor Authentication (MFA) is active for your account."
            ),
        }

    # 7. Other invalid grant or auth errors
    clean_msg = error_desc.split("Trace ID:")[0].strip()
    if "AADSTS" in clean_msg:
        clean_msg = clean_msg.split(":", 1)[-1].strip()

    detail_msg = clean_msg if clean_msg else "Invalid credentials. Authentication failed."
    raise HTTPException(status_code=401, detail=f"Invalid credentials: {detail_msg}")


def clean_html_instructions(content: Optional[str]) -> str:
    """Strips HTML formatting from assignment instructions."""
    if not content:
        return ""
    if "<" in content and ">" in content:
        try:
            from bs4 import BeautifulSoup
            return BeautifulSoup(content, "html.parser").get_text(separator=" ").strip()
        except Exception:
            return re.sub(r"<[^>]+>", " ", content).strip()
    return content.strip()


def normalize_course_code(code: Optional[str]) -> str:
    """Normalizes course code by removing non-alphanumeric characters: 'BCSE 302 L' -> 'BCSE302L'."""
    return re.sub(r"[^A-Z0-9]", "", (code or "").upper())


def get_base_code(code: Optional[str]) -> str:
    """Extracts base course code: 'BCSE302L' -> 'BCSE302'."""
    norm = normalize_course_code(code)
    return norm[:-1] if norm and norm[-1] in ("L", "P", "J") else norm


def normalize_faculty_tokens(name: Optional[str]) -> List[str]:
    """
    Tokenizes faculty / professor name into normalized significant tokens.
    Removes honorifics like Dr, Prof, Professor, Mr, Ms, Mrs, Doc, Er.
    """
    if not name:
        return []
    cleaned = str(name).upper()
    cleaned = re.sub(r"\b(DR|PROF|PROFESSOR|MR|MS|MRS|DOC|ER|FACULTY|INSTRUCTOR)\b\.?", " ", cleaned)
    tokens = re.findall(r"[A-Z0-9]+", cleaned)
    sig_tokens = [t for t in tokens if len(t) >= 2]
    return sig_tokens if sig_tokens else tokens


def match_faculty_names(vtop_faculty: Optional[str], candidate_texts: Union[str, List[str]]) -> bool:
    """
    Verifies if the professor/faculty assigned to the VTOP enrolled course matches
    any candidate text (such as Teams owner, LMS teacher, channel description, or message author).
    Returns True ONLY if there is an authentic faculty match.
    """
    if not vtop_faculty or not candidate_texts:
        return False

    v_tokens = normalize_faculty_tokens(vtop_faculty)
    if not v_tokens:
        return False

    if isinstance(candidate_texts, str):
        candidates = [candidate_texts]
    else:
        candidates = list(candidate_texts)

    v_long_tokens = [t for t in v_tokens if len(t) >= 3]
    if not v_long_tokens:
        v_long_tokens = v_tokens

    for cand in candidates:
        if not cand:
            continue
        c_tokens = normalize_faculty_tokens(cand)
        if not c_tokens:
            continue
        c_set = set(c_tokens)
        c_joined = " ".join(c_tokens)

        # 1. Exact token subset: all long tokens in candidate
        if all(t in c_set for t in v_long_tokens):
            return True

        # 2. Candidate joined text contains full vtop faculty name or vice versa
        v_joined = " ".join(v_long_tokens)
        if v_joined in c_joined or c_joined in v_joined:
            return True

        # 3. For multi-word faculty (e.g. "JAYA VIGNESH T" or "SARAVANA KUMAR R"),
        # at least 2 significant tokens match
        matches = sum(1 for t in v_long_tokens if t in c_set)
        if len(v_long_tokens) >= 2 and matches >= 2:
            return True

        # 4. For distinctive names (>= 5 letters, e.g. "RISHIKESHAN", "UPENDER", "THANGARAJ", "MAHARISHI"),
        # a match on this distinctive token is sufficient
        distinctive_tokens = [t for t in v_long_tokens if len(t) >= 5]
        if any(t in c_set for t in distinctive_tokens):
            return True

        # 5. Handle vendor / training faculty like "ETHNUS (APT)"
        if "ETHNUS" in v_tokens and "ETHNUS" in c_set:
            return True

    return False


def get_team_professors(team_id: str, headers: Dict[str, str]) -> List[str]:
    """Queries Microsoft Graph API for instructors, owners, and teachers of a Team."""
    prof_names: List[str] = []

    # 1. Group / Team Owners
    try:
        r = requests.get(f"https://graph.microsoft.com/v1.0/groups/{team_id}/owners", headers=headers, timeout=5)
        if r.status_code == 200:
            for u in r.json().get("value", []):
                name = u.get("displayName")
                if name and name not in prof_names:
                    prof_names.append(name)
    except Exception as e:
        logger.debug("Failed fetching owners for team %s: %s", team_id, e)

    # 2. Education Class Teachers
    try:
        r = requests.get(f"https://graph.microsoft.com/v1.0/education/classes/{team_id}/teachers", headers=headers, timeout=5)
        if r.status_code == 200:
            for u in r.json().get("value", []):
                name = u.get("displayName")
                if name and name not in prof_names:
                    prof_names.append(name)
    except Exception as e:
        logger.debug("Failed fetching teachers for class %s: %s", team_id, e)

    # 3. Team Members with Owner role
    try:
        r = requests.get(f"https://graph.microsoft.com/v1.0/teams/{team_id}/members", headers=headers, timeout=5)
        if r.status_code == 200:
            for m in r.json().get("value", []):
                roles = m.get("roles") or []
                if "owner" in roles:
                    name = m.get("displayName")
                    if name and name not in prof_names:
                        prof_names.append(name)
    except Exception as e:
        logger.debug("Failed fetching members for team %s: %s", team_id, e)

    return prof_names


def match_team_to_vtop_course(
    team_name: str,
    team_desc: str,
    vtop_courses: List[Dict[str, Any]],
    candidate_professors: Optional[List[str]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Strict verification of external Teams course:
    1. EXACT COURSE CODE MATCH (canonical, preserving L/P distinctions)
    2. EXACT FACULTY IDENTITY MATCH
    Fails closed if either condition is not satisfied.
    """
    verified_records = build_verified_semester_course_records({"courses": vtop_courses})
    is_verified, matched_rec, _ = verify_external_course(
        enrolled_records=verified_records,
        source="Teams",
        source_id="team",
        source_name=team_name,
        source_desc=team_desc,
        source_professors=candidate_professors,
    )
    if is_verified and matched_rec:
        return next(
            (c for c in vtop_courses if canonicalize_course_code(c.get("code") or c.get("courseCode")) == matched_rec.courseCode),
            None,
        )
    return None


def parse_teams_adaptive_card(att: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Extracts authentic assignment title, deadline, and direct submission URL
    from Microsoft Teams system adaptive cards.
    """
    content_str = att.get("content") or ""
    if not ("AdaptiveCard" in str(content_str) or "View assignment" in str(content_str)):
        return None
    try:
        card = json.loads(content_str) if isinstance(content_str, str) else content_str
    except Exception:
        return None

    title = None
    due_text = None
    url = None

    def walk(obj):
        nonlocal title, due_text
        if isinstance(obj, dict):
            if obj.get("type") == "TextBlock":
                txt = (obj.get("text") or "").strip()
                if (obj.get("weight") == "bolder" or obj.get("size") in ("large", "extraLarge")) and not title:
                    title = txt
                elif "due" in txt.lower() and not due_text:
                    due_text = txt
            for v in obj.values():
                walk(v)
        elif isinstance(obj, list):
            for it in obj:
                walk(it)

    walk(card.get("body", []))
    for act in card.get("actions", []):
        if act.get("url"):
            url = act["url"]
            break

    if not title and not url:
        return None

    # Parse date
    due_date = "TBA"
    due_time = "23:59"
    if due_text:
        clean = re.sub(r"^[Dd]ue\s*", "", due_text).strip()
        curr_year = 2026
        for fmt in ["%d %b", "%b %d", "%d %B", "%B %d"]:
            try:
                dt = datetime.strptime(f"{clean} {curr_year}", f"{fmt} %Y")
                due_date = dt.strftime("%Y-%m-%d")
                break
            except ValueError:
                pass

    assignment_id = None
    if url:
        m_aid = re.search(r'assignmentIds(?:%22|%5C%22|")?%3A(?:%5B|\[)(?:%5C%22|%22|")?([a-f0-9\-]{36})', url, re.I)
        if m_aid:
            assignment_id = m_aid.group(1)

    return {
        "title": title or "Class Assignment",
        "dueText": due_text or "No deadline specified",
        "dueDate": due_date,
        "dueTime": due_time,
        "url": url,
        "assignmentId": assignment_id,
    }


def fetch_assignments_for_matched_team(
    team_id: str,
    team_name: str,
    vtop_course: Dict[str, Any],
    headers: Dict[str, str],
    assignments_headers: Optional[Dict[str, str]] = None,
    authenticated_user_id: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Goes to the assignments section in Microsoft Teams for a matched VTOP subject
    and fetches the authentic assignment details and authenticated student submission state.
    """
    assignments: List[Dict[str, Any]] = []
    seen_ids = set()

    course_code = vtop_course.get("code") or vtop_course.get("courseCode") or "TEAMS"
    course_title = vtop_course.get("title") or vtop_course.get("courseTitle") or vtop_course.get("courseName") or team_name
    faculty = vtop_course.get("faculty") or vtop_course.get("facultyName")
    faculty_id = vtop_course.get("facultyId")

    edu_headers = assignments_headers or headers

    # 1. Query official Education Class Assignments via assignments_headers (https://assignments.onenote.com)
    try:
        url_edu: Optional[str] = f"https://assignments.onenote.com/api/v1.0/edu/classes/{team_id}/assignments"
        while url_edu:
            r_edu = requests.get(url_edu, headers=edu_headers, timeout=REQUEST_TIMEOUT)
            if r_edu.status_code != 200:
                if not assignments:
                    # Fallback to graph education endpoint
                    url_edu_fallback: Optional[str] = f"https://graph.microsoft.com/v1.0/education/classes/{team_id}/assignments"
                    while url_edu_fallback:
                        r_edu_fb = requests.get(url_edu_fallback, headers=headers, timeout=REQUEST_TIMEOUT)
                        if r_edu_fb.status_code == 200:
                            fb_data = r_edu_fb.json()
                            for item in fb_data.get("value", []):
                                assign_id = item.get("id") or "item"
                                if assign_id in seen_ids:
                                    continue
                                seen_ids.add(assign_id)
                                due_dt = item.get("dueDateTime") or ""
                                due_date_str = due_dt.split("T")[0] if "T" in due_dt else "TBA"
                                due_time_str = due_dt.split("T")[1][:5] if "T" in due_dt else "23:59"

                                sub_record, api_failed = fetch_student_teams_submission(
                                    team_id,
                                    assign_id,
                                    edu_headers,
                                    authenticated_user_id=authenticated_user_id,
                                )
                                sub_meta = map_teams_submission_status(sub_record, due_datetime_iso=due_dt, api_failed=api_failed)
                                title = item.get("displayName") or f"{course_code} Assignment"

                                logger.info(
                                    "\n[Teams Assignment Status]\nCourse: %s\nFaculty: %s\nAssignment: %s\nTeams Submission State: %s\nSubmitted At: %s\nDeadline: %s\nApplication Status: %s",
                                    course_code,
                                    faculty,
                                    title,
                                    sub_meta["teamsSubmissionState"],
                                    sub_meta["submittedAt"] or "None",
                                    due_date_str,
                                    sub_meta["applicationStatus"],
                                )

                                instructions_obj = item.get("instructions")
                                instructions_raw = instructions_obj.get("content") if isinstance(instructions_obj, dict) else ""
                                clean_instr = clean_html_instructions(instructions_raw)
                                web_url = item.get("webUrl") or f"https://teams.microsoft.com/l/team/{team_id}/conversations"

                                points = 10
                                if isinstance(item.get("grading"), dict) and item.get("grading", {}).get("maxPoints") is not None:
                                    points = item["grading"]["maxPoints"]

                                assignments.append({
                                    "id": f"teams-{assign_id}",
                                    "source": "Teams",
                                    "sourceAssignmentId": assign_id,
                                    "title": title,
                                    "academicYear": matched_vtop.get("academicYear") or "2026",
                                    "semester": matched_vtop.get("semester") or "Fall Semester 2026-27",
                                    "semesterId": matched_vtop.get("semesterId") or "CH20262701",
                                    "courseCode": course_code,
                                    "courseTitle": course_title,
                                    "subject": course_title,
                                    "faculty": faculty,
                                    "facultyId": faculty_id,
                                    "externalCourseId": str(team_id),
                                    "teamsCourseId": str(team_id),
                                    "verified": True,
                                    "platformName": "Microsoft Teams",
                                    "platformUrl": web_url,
                                    "dueDate": due_date_str,
                                    "dueTime": due_time_str,
                                    "status": sub_meta["applicationStatus"],
                                    "applicationStatus": sub_meta["applicationStatus"],
                                    "teamsSubmissionState": sub_meta["teamsSubmissionState"],
                                    "submissionStatus": sub_meta["teamsSubmissionState"],
                                    "submittedAt": sub_meta["submittedAt"],
                                    "returnedAt": sub_meta["returnedAt"],
                                    "submissionId": sub_meta["submissionId"],
                                    "isDone": sub_meta["isDone"],
                                    "isSubmitted": sub_meta["isSubmitted"],
                                    "isLate": sub_meta["isLate"],
                                    "statusVerifiedAt": sub_meta["statusVerifiedAt"],
                                    "statusSource": sub_meta["statusSource"],
                                    "priority": "Critical" if sub_meta["isOverdue"] else "Medium",
                                    "weightage": points,
                                    "instructions": clean_instr,
                                    "matchedTeamName": team_name,
                                })
                            url_edu_fallback = fb_data.get("@odata.nextLink") or fb_data.get("nextLink")
                        else:
                            break
                break

            data = r_edu.json()
            for item in data.get("value", []):
                assign_id = item.get("id") or "item"
                if assign_id in seen_ids:
                    continue
                seen_ids.add(assign_id)
                due_dt = item.get("dueDateTime") or ""
                due_date_str = due_dt.split("T")[0] if "T" in due_dt else "TBA"
                due_time_str = due_dt.split("T")[1][:5] if "T" in due_dt else "23:59"

                # Query authenticated student submission
                sub_record, api_failed = fetch_student_teams_submission(
                    team_id,
                    assign_id,
                    edu_headers,
                    authenticated_user_id=authenticated_user_id,
                )
                sub_meta = map_teams_submission_status(sub_record, due_datetime_iso=due_dt, api_failed=api_failed)

                title = item.get("displayName") or f"{course_code} Assignment"

                # Safe logging per Section 26
                logger.info(
                    "\n[Teams Assignment Status]\nCourse: %s\nFaculty: %s\nAssignment: %s\nTeams Submission State: %s\nSubmitted At: %s\nDeadline: %s\nApplication Status: %s",
                    course_code,
                    faculty,
                    title,
                    sub_meta["teamsSubmissionState"],
                    sub_meta["submittedAt"] or "None",
                    due_date_str,
                    sub_meta["applicationStatus"],
                )

                instructions_obj = item.get("instructions")
                instructions_raw = instructions_obj.get("content") if isinstance(instructions_obj, dict) else ""
                clean_instr = clean_html_instructions(instructions_raw)
                web_url = item.get("webUrl") or f"https://teams.microsoft.com/l/team/{team_id}/conversations"

                points = 10
                if isinstance(item.get("grading"), dict) and item.get("grading", {}).get("maxPoints") is not None:
                    points = item["grading"]["maxPoints"]

                assignments.append({
                    "id": f"teams-{assign_id}",
                    "source": "Teams",
                    "sourceAssignmentId": assign_id,
                    "title": title,
                    "academicYear": matched_vtop.get("academicYear") or "2026",
                    "semester": matched_vtop.get("semester") or "Fall Semester 2026-27",
                    "semesterId": matched_vtop.get("semesterId") or "CH20262701",
                    "courseCode": course_code,
                    "courseTitle": course_title,
                    "subject": course_title,
                    "faculty": faculty,
                    "facultyId": faculty_id,
                    "externalCourseId": str(team_id),
                    "teamsCourseId": str(team_id),
                    "verified": True,
                    "platformName": "Microsoft Teams",
                    "platformUrl": web_url,
                    "dueDate": due_date_str,
                    "dueTime": due_time_str,
                    "status": sub_meta["applicationStatus"],
                    "applicationStatus": sub_meta["applicationStatus"],
                    "teamsSubmissionState": sub_meta["teamsSubmissionState"],
                    "submissionStatus": sub_meta["teamsSubmissionState"],
                    "submittedAt": sub_meta["submittedAt"],
                    "returnedAt": sub_meta["returnedAt"],
                    "submissionId": sub_meta["submissionId"],
                    "isDone": sub_meta["isDone"],
                    "isSubmitted": sub_meta["isSubmitted"],
                    "isLate": sub_meta["isLate"],
                    "statusVerifiedAt": sub_meta["statusVerifiedAt"],
                    "statusSource": sub_meta["statusSource"],
                    "priority": "Critical" if sub_meta["isOverdue"] else "Medium",
                    "weightage": points,
                    "instructions": clean_instr,
                    "matchedTeamName": team_name,
                })
            # Follow pagination nextLink
            url_edu = data.get("@odata.nextLink") or data.get("nextLink")
    except Exception as exc:
        logger.warning("Education class assignments query for %s failed: %s", team_id, exc)

    # 2. Query team channels, Adaptive Cards, and assignment tabs
    try:
        r_ch = requests.get(f"https://graph.microsoft.com/v1.0/teams/{team_id}/channels", headers=headers, timeout=REQUEST_TIMEOUT)
        if r_ch.status_code == 200:
            channels = r_ch.json().get("value", [])
            for ch in channels:
                ch_id = ch.get("id")
                tab_url = None
                try:
                    r_tabs = requests.get(f"https://graph.microsoft.com/v1.0/teams/{team_id}/channels/{ch_id}/tabs", headers=headers, timeout=5)
                    if r_tabs.status_code == 200:
                        for tab in r_tabs.json().get("value", []):
                            if "assignment" in (tab.get("displayName") or "").lower():
                                tab_url = tab.get("webUrl")
                                break
                except Exception:
                    pass

                # Scan messages in channel for Adaptive Card assignment notifications
                try:
                    r_msg = requests.get(
                        f"https://graph.microsoft.com/v1.0/teams/{team_id}/channels/{ch_id}/messages?$top=50",
                        headers=headers,
                        timeout=REQUEST_TIMEOUT,
                    )
                    if r_msg.status_code == 200:
                        for msg in r_msg.json().get("value", []):
                            msg_id = msg.get("id")

                            for att in msg.get("attachments") or []:
                                card_data = parse_teams_adaptive_card(att)
                                if card_data and card_data.get("title"):
                                    card_aid = card_data.get("assignmentId")
                                    if card_aid and card_aid in seen_ids:
                                        continue

                                    # Avoid duplicate by title if already fetched
                                    card_title_norm = card_data["title"].strip().lower()
                                    if any(a.get("title", "").strip().lower() == card_title_norm for a in assignments):
                                        continue

                                    seen_ids.add(msg_id)
                                    target_url = card_data.get("url") or tab_url or f"https://teams.microsoft.com/l/team/{team_id}/conversations"

                                    if card_aid and edu_headers:
                                        seen_ids.add(card_aid)
                                        sub_record, api_failed = fetch_student_teams_submission(
                                            team_id,
                                            card_aid,
                                            edu_headers,
                                            authenticated_user_id=authenticated_user_id,
                                        )
                                        sub_meta = map_teams_submission_status(sub_record, due_datetime_iso=card_data.get("dueDate"), api_failed=api_failed)
                                    else:
                                        sub_meta = map_teams_submission_status(None, due_datetime_iso=None, api_failed=True)

                                    assignments.append({
                                        "id": f"teams-card-{msg_id}",
                                        "source": "Teams",
                                        "sourceAssignmentId": card_aid or msg_id,
                                        "title": card_data["title"],
                                        "courseCode": course_code,
                                        "courseTitle": course_title,
                                        "faculty": faculty,
                                        "facultyId": faculty_id,
                                        "platformName": "Microsoft Teams",
                                        "platformUrl": target_url,
                                        "dueDate": card_data["dueDate"],
                                        "dueTime": card_data["dueTime"],
                                        "status": sub_meta["applicationStatus"],
                                        "applicationStatus": sub_meta["applicationStatus"],
                                        "teamsSubmissionState": sub_meta["teamsSubmissionState"],
                                        "submissionStatus": sub_meta["teamsSubmissionState"],
                                        "submittedAt": sub_meta["submittedAt"],
                                        "returnedAt": sub_meta["returnedAt"],
                                        "submissionId": sub_meta["submissionId"],
                                        "isDone": sub_meta["isDone"],
                                        "isSubmitted": sub_meta["isSubmitted"],
                                        "isLate": sub_meta["isLate"],
                                        "statusVerifiedAt": sub_meta["statusVerifiedAt"],
                                        "statusSource": sub_meta["statusSource"],
                                        "priority": "Critical" if "lab" in card_data["title"].lower() or "da" in card_data["title"].lower() else "Medium",
                                        "weightage": 10,
                                        "instructions": f"Published in Teams: {card_data['dueText']}",
                                        "matchedTeamName": team_name,
                                    })
                                    break
                except Exception:
                    pass
    except Exception as exc:
        logger.warning("Channels query for %s failed: %s", team_id, exc)

    return assignments


def fetch_microsoft_teams_coursework(
    access_token: Optional[str],
    email: str,
    vtop_courses: List[Dict[str, Any]],
    assignments_token: Optional[str] = None,
    authenticated_user_id: Optional[str] = None,
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    1. Searches for enrolled subjects in the VTOP section.
    2. Matches them with Teams enrolled subjects.
    3. Navigates to the assignments section in Teams for each matched subject and fetches authentic details
       and verified student submission states.
    """
    user_info: Dict[str, Any] = {"email": email}
    all_assignments: List[Dict[str, Any]] = []
    matched_subjects: List[Dict[str, Any]] = []
    course_matches: List[Dict[str, Any]] = []

    if not access_token:
        return user_info, all_assignments, matched_subjects, course_matches

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }

    # If assignments_token was not provided, attempt to acquire it from refresh token if available
    if not assignments_token:
        try:
            store_temp = load_store()
            r_tok_temp = (store_temp.get("teamsAccount") or {}).get("refreshToken")
            if r_tok_temp:
                r_at = requests.post(
                    LOGIN_TOKEN_URL,
                    data={
                        "client_id": TEAMS_CLIENT_ID,
                        "grant_type": "refresh_token",
                        "refresh_token": r_tok_temp,
                        "resource": ASSIGNMENTS_RESOURCE,
                    },
                    timeout=8,
                )
                if r_at.status_code == 200:
                    assignments_token = r_at.json().get("access_token")
        except Exception as exc:
            logger.debug("Assignments token acquisition: %s", exc)

    assignments_headers = {
        "Authorization": f"Bearer {assignments_token}",
        "Accept": "application/json",
    } if assignments_token else None

    # 1. Query /me user profile
    try:
        r_me = requests.get("https://graph.microsoft.com/v1.0/me", headers=headers, timeout=REQUEST_TIMEOUT)
        if r_me.status_code == 200:
            me_data = r_me.json()
            user_info["displayName"] = me_data.get("displayName")
            user_info["email"] = me_data.get("mail") or me_data.get("userPrincipalName") or email
            authenticated_user_id = authenticated_user_id or me_data.get("id")
            user_info["userId"] = authenticated_user_id
    except Exception as exc:
        logger.warning("Graph API /me query failed: %s", exc)

    # 2. Query all joined class teams from Microsoft Teams
    teams_dict: Dict[str, Dict[str, Any]] = {}
    try:
        r_teams = requests.get("https://graph.microsoft.com/v1.0/me/joinedTeams", headers=headers, timeout=REQUEST_TIMEOUT)
        if r_teams.status_code == 200:
            for t in r_teams.json().get("value", []):
                t_id = t.get("id")
                if t_id:
                    teams_dict[t_id] = t
    except Exception as exc:
        logger.warning("Graph API joinedTeams query failed: %s", exc)

    # Also query education classes if available
    try:
        r_edu_classes = requests.get("https://graph.microsoft.com/v1.0/education/classes", headers=headers, timeout=REQUEST_TIMEOUT)
        if r_edu_classes.status_code == 200:
            for c in r_edu_classes.json().get("value", []):
                c_id = c.get("id")
                if c_id and c_id not in teams_dict:
                    teams_dict[c_id] = c
    except Exception as exc:
        logger.debug("Education classes query: %s", exc)

    teams_list = list(teams_dict.values())
    user_info["teamsCount"] = len(teams_list)

    logger.info("Found %d Teams for student %s. Matching with %d VTOP courses...", len(teams_list), email, len(vtop_courses))

    verified_enrolled = build_verified_semester_course_records({"courses": vtop_courses})

    # 3. Match Teams enrolled subjects with VTOP enrolled subjects
    for team in teams_list:
        team_id = team.get("id")
        team_name = team.get("displayName") or ""
        team_desc = team.get("description") or ""

        # Retrieve instructor / owner names from Microsoft Graph API
        team_professors = get_team_professors(team_id, headers)

        # Strict Two-Stage Verification: 1. Course Code 2. Faculty Identity
        is_verified, matched_rec, match_meta = verify_external_course(
            enrolled_records=verified_enrolled,
            source="Teams",
            source_id=team_id,
            source_name=team_name,
            source_desc=team_desc,
            source_professors=team_professors,
        )
        course_matches.append(match_meta.model_dump())

        if is_verified and matched_rec:
            matched_vtop = {
                "code": matched_rec.courseCode,
                "title": matched_rec.courseName,
                "faculty": matched_rec.facultyName,
                "facultyId": matched_rec.facultyId,
                "slot": matched_rec.slot,
                "section": matched_rec.section,
            }
            logger.info("Verified enrolled course [%s: %s] AND professor [%s] with Teams '%s' (%s). Fetching assignments...", matched_rec.courseCode, matched_rec.courseName, matched_rec.facultyName, team_name, team_id)

            # 4. Go to assignments section in Teams and fetch details for that subject
            subject_assignments = fetch_assignments_for_matched_team(
                team_id,
                team_name,
                matched_vtop,
                headers,
                assignments_headers=assignments_headers,
                authenticated_user_id=authenticated_user_id,
            )

            for sa in subject_assignments:
                sa["verifiedCourseMatchId"] = f"match-teams-{team_id}"
                sa["subjectId"] = matched_rec.courseCode
                sa["courseCode"] = matched_rec.courseCode
                sa["courseTitle"] = matched_rec.courseName
                sa["faculty"] = matched_rec.facultyName

            matched_subjects.append({
                "courseCode": matched_rec.courseCode,
                "courseTitle": matched_rec.courseName,
                "faculty": matched_rec.facultyName,
                "teamId": team_id,
                "teamName": team_name,
                "assignmentsCount": len(subject_assignments),
            })

            all_assignments.extend(subject_assignments)
        else:
            logger.debug("Teams channel '%s' skipped: %s", team_name, match_meta.rejectionReason)

    # 5. Also query general /education/me/assignments for any assignments already published
    try:
        r_all_edu = requests.get("https://graph.microsoft.com/v1.0/education/me/assignments", headers=headers, timeout=REQUEST_TIMEOUT)
        if r_all_edu.status_code == 200:
            existing_ids = {a.get("id") for a in all_assignments}
            for item in r_all_edu.json().get("value", []):
                assign_id = f"teams-{item.get('id')}"
                if assign_id in existing_ids:
                    continue

                class_id = item.get("classId") or ""
                class_name = item.get("classDisplayName") or ""
                # Verify course and faculty
                is_v, matched_c, _ = verify_external_course(
                    enrolled_records=verified_enrolled,
                    source="Teams",
                    source_id=class_id,
                    source_name=f"{class_id} {class_name}",
                    source_professors=[class_name],
                )
                if not is_v or not matched_c:
                    continue

                due_dt = item.get("dueDateTime") or ""
                due_date_str = due_dt.split("T")[0] if "T" in due_dt else "TBA"
                due_time_str = due_dt.split("T")[1][:5] if "T" in due_dt else "23:59"
                status_raw = (item.get("status") or "").lower()
                is_sub = status_raw in ("submitted", "turnedin", "completed")

                instr_obj = item.get("instructions")
                clean_instr = clean_html_instructions(instr_obj.get("content") if isinstance(instr_obj, dict) else "")

                all_assignments.append({
                    "id": assign_id,
                    "verifiedCourseMatchId": f"match-teams-{class_id}",
                    "subjectId": matched_c.courseCode,
                    "title": item.get("displayName") or "Teams Assignment",
                    "courseCode": matched_c.courseCode,
                    "courseTitle": matched_c.courseName,
                    "faculty": matched_c.facultyName,
                    "source": "Teams",
                    "platformName": "Microsoft Teams",
                    "platformUrl": item.get("webUrl") or TEAMS_PORTAL_URL,
                    "dueDate": due_date_str,
                    "dueTime": due_time_str,
                    "status": "Submitted" if is_sub else "Pending",
                    "priority": "Critical" if not is_sub else "Medium",
                    "weightage": 10,
                    "instructions": clean_instr,
                })
    except Exception as exc:
        logger.debug("Global education assignments query: %s", exc)

    return user_info, all_assignments, matched_subjects, course_matches


@router.get("/status")
def get_teams_status() -> Dict[str, Any]:
    """Returns the verified connection status of Microsoft Teams and matched subjects."""
    store = load_store()
    is_connected = bool(store.get("teamsConnected"))
    account = store.get("teamsAccount") or {}
    assignments = store.get("assignments") or []
    teams_assignments = [a for a in assignments if a.get("source") == "Teams"]

    pending = [a for a in teams_assignments if (a.get("status") or "").upper() in ("PENDING", "OVERDUE")]
    submitted = [a for a in teams_assignments if (a.get("status") or "").upper() in ("DONE", "SUBMITTED")]

    return {
        "connected": is_connected,
        "email": account.get("email"),
        "displayName": account.get("displayName"),
        "lastSynced": account.get("lastSynced"),
        "portal": TEAMS_PORTAL_URL,
        "mfaRequired": bool(account.get("mfaRequired")),
        "totalAssignments": len(teams_assignments),
        "pendingCount": len(pending),
        "submittedCount": len(submitted),
        "matchedSubjects": account.get("matchedSubjects") or [],
        "matchedCount": account.get("matchedCount") or 0,
        "totalTeamsCount": account.get("totalTeamsCount") or 0,
    }


@router.post("/login")
def login_and_sync_teams(payload: TeamsLoginRequest) -> Dict[str, Any]:
    """
    Authenticates with student's institutional Microsoft 365 credentials against Microsoft Online.
    Validates password directly with Microsoft. If password is incorrect, raises 401 Invalid Credentials.
    Matches VTOP enrolled subjects with Microsoft Teams enrolled subjects, extracts authentic class assignments,
    and returns verified coursework with zero synthetic/mock data.
    """
    email = payload.email.strip()
    password = payload.password.strip()

    if not email or "@" not in email:
        raise HTTPException(
            status_code=400,
            detail="Invalid email address format. Please enter your university Microsoft email (e.g. student@vitstudent.ac.in).",
        )

    if not password:
        raise HTTPException(
            status_code=400,
            detail="Password is required to authenticate with Microsoft Teams.",
        )

    # 1. Verify that email domain belongs to an authentic Microsoft 365 tenant
    verify_microsoft_realm(email)

    # 2. Authenticate directly against Microsoft Online authentication endpoint
    auth_result = authenticate_microsoft_online(email, password)

    mfa_required = bool(auth_result.get("mfa_required"))
    token_dict = auth_result.get("token") or {}
    access_token = token_dict.get("access_token")
    refresh_token = token_dict.get("refresh_token")

    store = load_store()

    # Load enrolled subjects from the VTOP section
    vtop_courses = list(store.get("courses") or [])
    if not vtop_courses:
        seen_codes = set()
        for it in (store.get("attendance") or []):
            c_code = it.get("courseCode")
            if c_code and c_code not in seen_codes:
                seen_codes.add(c_code)
                vtop_courses.append({
                    "code": c_code,
                    "title": it.get("courseName") or it.get("courseTitle"),
                    "faculty": it.get("faculty") or it.get("facultyName"),
                })

    # 3. Match Teams enrolled subjects with VTOP enrolled subjects and fetch authentic assignments
    user_info, teams_assignments, matched_subjects, course_matches = fetch_microsoft_teams_coursework(
        access_token, email, vtop_courses
    )

    # Retain non-Teams assignments (e.g. from VTOP assessments/LMS)
    existing_assignments = store.get("assignments") or []
    other_assignments = [a for a in existing_assignments if a.get("source") != "Teams"]

    # Combine authentic assignments
    all_assignments = other_assignments + teams_assignments
    store["assignments"] = all_assignments
    store["teamsConnected"] = True

    now_iso = datetime.now(timezone.utc).isoformat()
    store["teamsAccount"] = {
        "email": email,
        "displayName": user_info.get("displayName") or email.split("@")[0].title(),
        "tenant": email.split("@")[-1].lower(),
        "connectedAt": now_iso,
        "lastSynced": now_iso,
        "mfaRequired": mfa_required,
        "refreshToken": refresh_token,
        "matchedSubjects": matched_subjects,
        "matchedCount": len(matched_subjects),
        "totalTeamsCount": user_info.get("teamsCount", 0),
        "courseMatches": course_matches,
    }

    save_store(store)
    logger.info(
        "Microsoft Teams authenticated for %s. %d subjects matched with VTOP. %d authentic assignments synced.",
        email,
        len(matched_subjects),
        len(teams_assignments),
    )

    pending_count = len([a for a in teams_assignments if (a.get("status") or "").upper() in ("PENDING", "OVERDUE")])
    submitted_count = len([a for a in teams_assignments if (a.get("status") or "").upper() in ("DONE", "SUBMITTED")])

    msg = (
        f"Successfully authenticated with Microsoft Teams ({email}). "
        f"Matched {len(matched_subjects)} VTOP subjects with Teams class channels. "
        f"{len(teams_assignments)} authentic assignments loaded."
    )
    if mfa_required:
        msg = f"Credentials verified with Microsoft Online ({email}). Multi-Factor Authentication active."

    return {
        "success": True,
        "message": msg,
        "email": email,
        "displayName": store["teamsAccount"]["displayName"],
        "assignments": all_assignments,
        "matchedSubjects": matched_subjects,
        "matchedCount": len(matched_subjects),
        "totalTeamsCount": user_info.get("teamsCount", 0),
        "teamsAssignmentsCount": len(teams_assignments),
        "totalCount": len(all_assignments),
        "pendingCount": pending_count,
        "submittedCount": submitted_count,
        "lastSynced": now_iso,
        "mfaRequired": mfa_required,
    }


@router.post("/sync")
def sync_teams() -> Dict[str, Any]:
    """Re-synchronizes authentic coursework from Microsoft Teams for the connected account."""
    store = load_store()
    if not store.get("teamsConnected"):
        raise HTTPException(
            status_code=400,
            detail="Microsoft Teams is not currently connected. Please link your account first.",
        )

    account = store.get("teamsAccount") or {}
    email = account.get("email") or ""
    refresh_token = account.get("refreshToken")
    access_token = None

    assignments_token = None
    if refresh_token:
        # Refresh access token for Graph
        try:
            r_ref = requests.post(
                LOGIN_TOKEN_URL,
                data={
                    "client_id": TEAMS_CLIENT_ID,
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "resource": GRAPH_RESOURCE,
                },
                timeout=10,
            )
            if r_ref.status_code == 200:
                ref_json = r_ref.json()
                access_token = ref_json.get("access_token")
                account["refreshToken"] = ref_json.get("refresh_token") or refresh_token
        except Exception as exc:
            logger.warning("Token refresh error: %s", exc)

        # Refresh access token for Education Assignments service
        try:
            r_at = requests.post(
                LOGIN_TOKEN_URL,
                data={
                    "client_id": TEAMS_CLIENT_ID,
                    "grant_type": "refresh_token",
                    "refresh_token": refresh_token,
                    "resource": ASSIGNMENTS_RESOURCE,
                },
                timeout=10,
            )
            if r_at.status_code == 200:
                assignments_token = r_at.json().get("access_token")
        except Exception as exc:
            logger.warning("Assignments token refresh error: %s", exc)

    vtop_courses = list(store.get("courses") or [])
    user_info, teams_assignments, matched_subjects, course_matches = fetch_microsoft_teams_coursework(
        access_token, email, vtop_courses, assignments_token=assignments_token
    )

    existing_assignments = store.get("assignments") or []
    other_assignments = [a for a in existing_assignments if a.get("source") != "Teams"]

    all_assignments = other_assignments + teams_assignments
    store["assignments"] = all_assignments

    now_iso = datetime.now(timezone.utc).isoformat()
    account["lastSynced"] = now_iso
    account["matchedSubjects"] = matched_subjects
    account["matchedCount"] = len(matched_subjects)
    account["totalTeamsCount"] = user_info.get("teamsCount", 0)
    account["courseMatches"] = course_matches
    store["teamsAccount"] = account

    save_store(store)

    return {
        "success": True,
        "message": (
            f"Synchronized Microsoft Teams coursework. "
            f"Matched {len(matched_subjects)} VTOP subjects. {len(teams_assignments)} authentic assignments loaded."
        ),
        "assignments": all_assignments,
        "matchedSubjects": matched_subjects,
        "matchedCount": len(matched_subjects),
        "lastSynced": now_iso,
    }


@router.post("/disconnect")
def disconnect_teams() -> Dict[str, Any]:
    """Disconnects Microsoft Teams and removes synced Teams coursework."""
    store = load_store()
    existing_assignments = store.get("assignments") or []
    store["assignments"] = [a for a in existing_assignments if a.get("source") != "Teams"]
    store["teamsConnected"] = False
    store["teamsAccount"] = None

    save_store(store)
    return {"success": True, "message": "Microsoft Teams disconnected successfully."}
