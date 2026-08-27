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

logger = logging.getLogger("vtop.routes.teams")

router = APIRouter(prefix="/api/teams", tags=["teams"])

# Well-known Microsoft Teams / Microsoft 365 Public Client ID & Endpoints
TEAMS_CLIENT_ID = "1fec8e78-bce4-4aaf-ab1b-5451cc387264"  # Official Microsoft Teams Client
GRAPH_RESOURCE = "https://graph.microsoft.com"
SKYPE_RESOURCE = "https://api.spaces.skype.com"
LOGIN_TOKEN_URL = "https://login.microsoftonline.com/common/oauth2/token"
USERREALM_URL = "https://login.microsoftonline.com/common/userrealm/"
TEAMS_PORTAL_URL = "https://www.microsoft.com/en-in/microsoft-teams/log-in"

REQUEST_TIMEOUT = 12


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

    return {
        "title": title or "Class Assignment",
        "dueText": due_text or "No deadline specified",
        "dueDate": due_date,
        "dueTime": due_time,
        "url": url,
    }


def fetch_assignments_for_matched_team(
    team_id: str,
    team_name: str,
    vtop_course: Dict[str, Any],
    headers: Dict[str, str],
) -> List[Dict[str, Any]]:
    """
    Goes to the assignments section in Microsoft Teams for a matched VTOP subject
    and fetches the authentic assignment details.
    """
    assignments: List[Dict[str, Any]] = []
    seen_ids = set()

    course_code = vtop_course.get("code") or vtop_course.get("courseCode") or "TEAMS"
    course_title = vtop_course.get("title") or vtop_course.get("courseTitle") or vtop_course.get("courseName") or team_name
    faculty = vtop_course.get("faculty") or vtop_course.get("facultyName")

    # 1. Query Microsoft Education Class Assignments for this matched team
    try:
        url_edu = f"https://graph.microsoft.com/v1.0/education/classes/{team_id}/assignments"
        r_edu = requests.get(url_edu, headers=headers, timeout=REQUEST_TIMEOUT)
        if r_edu.status_code == 200:
            for item in r_edu.json().get("value", []):
                assign_id = item.get("id") or "item"
                seen_ids.add(assign_id)
                due_dt = item.get("dueDateTime") or ""
                due_date_str = due_dt.split("T")[0] if "T" in due_dt else "TBA"
                due_time_str = due_dt.split("T")[1][:5] if "T" in due_dt else "23:59"

                status_raw = (item.get("status") or "").lower()
                is_sub = status_raw in ("submitted", "turnedin", "completed")

                instructions_obj = item.get("instructions")
                instructions_raw = instructions_obj.get("content") if isinstance(instructions_obj, dict) else ""
                clean_instr = clean_html_instructions(instructions_raw)

                web_url = item.get("webUrl") or f"https://teams.microsoft.com/l/team/{team_id}/conversations"

                assignments.append({
                    "id": f"teams-{assign_id}",
                    "title": item.get("displayName") or f"{course_code} Assignment",
                    "courseCode": course_code,
                    "courseTitle": course_title,
                    "faculty": faculty,
                    "source": "Teams",
                    "platformName": "Microsoft Teams",
                    "platformUrl": web_url,
                    "dueDate": due_date_str,
                    "dueTime": due_time_str,
                    "status": "Submitted" if is_sub else "Pending",
                    "priority": "Critical" if not is_sub else "Medium",
                    "weightage": 10,
                    "instructions": clean_instr,
                    "matchedTeamName": team_name,
                })
    except Exception as exc:
        logger.warning("Education class assignments query for %s failed: %s", team_id, exc)

    # 2. Query team channels, Adaptive Cards, and assignment tabs
    try:
        r_ch = requests.get(f"https://graph.microsoft.com/v1.0/teams/{team_id}/channels", headers=headers, timeout=REQUEST_TIMEOUT)
        if r_ch.status_code == 200:
            channels = r_ch.json().get("value", [])
            for ch in channels:
                ch_id = ch.get("id")
                # Look for Assignments Tab URL
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
                            if msg_id in seen_ids:
                                continue

                            # Check for Adaptive Card assignment attachments
                            for att in msg.get("attachments") or []:
                                card_data = parse_teams_adaptive_card(att)
                                if card_data and card_data.get("title"):
                                    seen_ids.add(msg_id)
                                    target_url = card_data.get("url") or tab_url or f"https://teams.microsoft.com/l/team/{team_id}/conversations"
                                    assignments.append({
                                        "id": f"teams-card-{msg_id}",
                                        "title": card_data["title"],
                                        "courseCode": course_code,
                                        "courseTitle": course_title,
                                        "faculty": faculty,
                                        "source": "Teams",
                                        "platformName": "Microsoft Teams",
                                        "platformUrl": target_url,
                                        "dueDate": card_data["dueDate"],
                                        "dueTime": card_data["dueTime"],
                                        "status": "Pending",
                                        "priority": "Critical" if "lab" in card_data["title"].lower() or "da" in card_data["title"].lower() else "Medium",
                                        "weightage": 10,
                                        "instructions": f"Published in Teams: {card_data['dueText']}",
                                        "matchedTeamName": team_name,
                                    })
                                    break

                            if msg_id in seen_ids:
                                continue

                            # Fallback: Check if message text is an assignment announcement
                            subj = msg.get("subject") or ""
                            body_dict = msg.get("body") or {}
                            body_content = clean_html_instructions(body_dict.get("content") or "")

                            is_assignment_msg = any(
                                kw in subj.lower() or kw in body_content.lower()
                                for kw in ["digital assignment", "da 1", "da 2", "da1", "da2", "submission link", "submission deadline"]
                            )

                            if is_assignment_msg and (len(body_content) > 10 or subj):
                                seen_ids.add(msg_id)
                                created_dt = msg.get("createdDateTime") or ""
                                created_date_str = created_dt.split("T")[0] if "T" in created_dt else "TBA"

                                due_date_str = created_date_str
                                m_due = re.search(r'(due\s*(?:date|on|by)?[:\s]+)(\d{1,2}[-/]\d{1,2}[-/]\d{2,4}|\w+\s+\d{1,2}(?:st|nd|rd|th)?)', body_content, re.I)
                                if m_due:
                                    due_date_str = m_due.group(2)

                                title_str = subj if subj else body_content[:60]
                                if len(title_str) > 70:
                                    title_str = title_str[:67] + "..."

                                assignments.append({
                                    "id": f"teams-msg-{msg_id}",
                                    "title": title_str,
                                    "courseCode": course_code,
                                    "courseTitle": course_title,
                                    "faculty": faculty,
                                    "source": "Teams",
                                    "platformName": "Microsoft Teams",
                                    "platformUrl": tab_url or msg.get("webUrl") or f"https://teams.microsoft.com/l/team/{team_id}/conversations",
                                    "dueDate": due_date_str,
                                    "dueTime": "23:59",
                                    "status": "Pending",
                                    "priority": "Medium",
                                    "weightage": 10,
                                    "instructions": body_content[:300] if len(body_content) > 300 else body_content,
                                    "matchedTeamName": team_name,
                                })
                except Exception:
                    pass
    except Exception as exc:
        logger.warning("Channels query for %s failed: %s", team_id, exc)

    return assignments


def fetch_microsoft_teams_coursework(
    access_token: Optional[str],
    email: str,
    vtop_courses: List[Dict[str, Any]],
) -> Tuple[Dict[str, Any], List[Dict[str, Any]], List[Dict[str, Any]]]:
    """
    1. Searches for enrolled subjects in the VTOP section.
    2. Matches them with Teams enrolled subjects.
    3. Navigates to the assignments section in Teams for each matched subject and fetches authentic details.
    """
    user_info: Dict[str, Any] = {"email": email}
    all_assignments: List[Dict[str, Any]] = []
    matched_subjects: List[Dict[str, Any]] = []

    if not access_token:
        return user_info, all_assignments, matched_subjects

    headers = {
        "Authorization": f"Bearer {access_token}",
        "Accept": "application/json",
    }

    # 1. Query /me user profile
    try:
        r_me = requests.get("https://graph.microsoft.com/v1.0/me", headers=headers, timeout=REQUEST_TIMEOUT)
        if r_me.status_code == 200:
            me_data = r_me.json()
            user_info["displayName"] = me_data.get("displayName")
            user_info["email"] = me_data.get("mail") or me_data.get("userPrincipalName") or email
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
    course_matches: List[Dict[str, Any]] = []

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
            subject_assignments = fetch_assignments_for_matched_team(team_id, team_name, matched_vtop, headers)

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

    pending = [a for a in teams_assignments if a.get("status") == "Pending"]
    submitted = [a for a in teams_assignments if a.get("status") == "Submitted"]

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

    pending_count = len([a for a in teams_assignments if a.get("status") == "Pending"])
    submitted_count = len([a for a in teams_assignments if a.get("status") == "Submitted"])

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

    if refresh_token:
        # Refresh access token from Microsoft
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

    vtop_courses = list(store.get("courses") or [])
    user_info, teams_assignments, matched_subjects = fetch_microsoft_teams_coursework(
        access_token, email, vtop_courses
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
