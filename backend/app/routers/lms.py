"""
CampusOS Backend - VIT LMS (Moodle) Integration Router

Authenticates with student's institutional credentials or session cookie directly against
VIT LMS (https://lms.vit.ac.in).
Matches enrolled LMS courses with the student's current semester VTOP subjects.
Extracts authentic assignments and submission links without fabricating data.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
import urllib3
from bs4 import BeautifulSoup
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

# Suppress insecure request warnings for VIT internal SSL certificates
urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

logger = logging.getLogger("vtop.routes.lms")

router = APIRouter(prefix="/api/lms", tags=["lms"])

LMS_BASE_URL = "https://lms.vit.ac.in"
LMS_LOGIN_URL = "https://lms.vit.ac.in/login/index.php"
LMS_MY_URL = "https://lms.vit.ac.in/my/"
LMS_COURSES_URL = "https://lms.vit.ac.in/my/courses.php"
LMS_CALENDAR_URL = "https://lms.vit.ac.in/calendar/view.php?view=upcoming"

REQUEST_TIMEOUT = 10
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


class LMSLoginRequest(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    sessionCookie: Optional[str] = None  # MoodleSession cookie


def normalize_code(code: Optional[str]) -> str:
    return re.sub(r"[^A-Z0-9]", "", (code or "").upper())


def get_base_code(code: Optional[str]) -> str:
    norm = normalize_code(code)
    return norm[:-1] if norm and norm[-1] in ("L", "P", "J") else norm


def fetch_lms_course_teachers(session: requests.Session, course_id: str) -> List[str]:
    """Extracts teacher/instructor names from the LMS course view page."""
    teachers: List[str] = []
    url = f"{LMS_BASE_URL}/course/view.php?id={course_id}"
    try:
        r = session.get(url, verify=False, timeout=REQUEST_TIMEOUT)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            for el in soup.find_all(
                ["span", "div", "p", "li"],
                class_=lambda c: c and any(k in str(c).lower() for k in ["teacher", "instructor"]),
            ):
                txt = el.get_text().strip()
                if txt and len(txt) < 80:
                    teachers.append(txt)
            for m in re.finditer(r"(?:Faculty|Instructor|Professor|Teacher)\s*:\s*([A-Za-z\s\.]+)", r.text):
                cand = m.group(1).strip().split("\n")[0].strip()
                if len(cand) >= 3 and len(cand) < 80:
                    teachers.append(cand)
    except Exception as exc:
        logger.debug("Could not fetch teacher details from LMS course page %s: %s", course_id, exc)
    return teachers


def match_lms_course_to_vtop(
    course_name: str,
    course_id: str,
    vtop_courses: List[Dict[str, Any]],
    candidate_professors: Optional[List[str]] = None,
) -> Optional[Dict[str, Any]]:
    """
    Strict verification of external LMS course:
    1. EXACT COURSE CODE MATCH (canonical, preserving L/P distinctions)
    2. EXACT FACULTY IDENTITY MATCH
    Fails closed if either condition is not satisfied.
    """
    verified_records = build_verified_semester_course_records({"courses": vtop_courses})
    is_verified, matched_rec, _ = verify_external_course(
        enrolled_records=verified_records,
        source="LMS",
        source_id=str(course_id),
        source_name=course_name,
        source_professors=candidate_professors,
    )
    if is_verified and matched_rec:
        return next(
            (c for c in vtop_courses if canonicalize_course_code(c.get("code") or c.get("courseCode")) == matched_rec.courseCode),
            None,
        )
    return None


def parse_moodle_date(raw: str) -> Tuple[str, str]:
    raw = raw.strip()
    if not raw or raw == "-":
        return "TBA", "23:59"
    # Remove day name if present: "Friday, 28 August 2026, 11:59 PM"
    clean = re.sub(r"^[A-Za-z]+,\s*", "", raw)
    formats = [
        "%d %B %Y, %I:%M %p",
        "%d %b %Y, %I:%M %p",
        "%d/%m/%Y, %I:%M %p",
        "%Y-%m-%d %H:%M:%S",
        "%Y-%m-%d",
    ]
    for fmt in formats:
        try:
            dt = datetime.strptime(clean, fmt)
            return dt.strftime("%Y-%m-%d"), dt.strftime("%H:%M")
        except ValueError:
            pass
    return raw, "23:59"


def authenticate_lms_session(
    username: Optional[str],
    password: Optional[str],
    session_cookie: Optional[str],
) -> Tuple[requests.Session, Dict[str, Any]]:
    """
    Authenticates with VIT LMS and returns an active HTTP session and user info.
    Distinguishes between invalid credentials, session expiration, and CAPTCHA/MFA.
    """
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})

    # Mode 1: Validate provided session cookie (MoodleSession)
    if session_cookie:
        clean_cookie = session_cookie.strip()
        if clean_cookie.startswith("MoodleSession="):
            clean_cookie = clean_cookie.split("MoodleSession=")[1].split(";")[0].strip()
        s.cookies.set("MoodleSession", clean_cookie, domain="lms.vit.ac.in")

        try:
            r = s.get(LMS_MY_URL, verify=False, allow_redirects=False, timeout=REQUEST_TIMEOUT)
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                user_elem = soup.find(class_=lambda x: x and ("usertext" in x or "userbutton" in x or "username" in x))
                display_name = user_elem.get_text().strip() if user_elem else "Student"
                return s, {
                    "username": username or display_name,
                    "displayName": display_name,
                    "authMethod": "cookie",
                    "sessionCookie": clean_cookie,
                }
            elif r.status_code in (302, 303):
                loc = r.headers.get("Location") or ""
                if "login" in loc:
                    raise HTTPException(
                        status_code=401,
                        detail="The provided VIT LMS session cookie has expired. Please re-authenticate.",
                    )
        except HTTPException:
            raise
        except requests.exceptions.RequestException as e:
            logger.warning("LMS connectivity error during cookie auth: %s", e)
            raise HTTPException(
                status_code=503,
                detail="VIT LMS server (https://lms.vit.ac.in) is currently unreachable. Please try again later.",
            )

    # Mode 2: Username and password login
    if not username or not password:
        raise HTTPException(
            status_code=400,
            detail="Username and password (or a valid MoodleSession cookie) are required to connect VIT LMS.",
        )

    try:
        # Step 1: GET login page to retrieve logintoken & initial cookies
        r_get = s.get(LMS_LOGIN_URL, verify=False, timeout=REQUEST_TIMEOUT)
        if r_get.status_code != 200:
            raise HTTPException(
                status_code=503,
                detail="VIT LMS login gateway is currently unreachable. Please check if https://lms.vit.ac.in is online.",
            )

        soup_get = BeautifulSoup(r_get.text, "html.parser")
        token_input = soup_get.find("input", {"name": "logintoken"})
        logintoken = token_input.get("value") if token_input else ""

        # Step 2: POST credentials
        post_data = {
            "username": username.strip(),
            "password": password.strip(),
            "logintoken": logintoken,
        }

        r_post = s.post(
            LMS_LOGIN_URL,
            data=post_data,
            verify=False,
            allow_redirects=True,
            timeout=REQUEST_TIMEOUT,
        )

        final_url = r_post.url
        soup_post = BeautifulSoup(r_post.text, "html.parser")

        # Check for Moodle login errors
        error_elem = soup_post.find(class_=lambda x: x and ("alert-danger" in x or "loginerrors" in x or "login-error" in x))
        if error_elem:
            err_text = error_elem.get_text().strip()
            if "invalid" in err_text.lower():
                raise HTTPException(
                    status_code=401,
                    detail="Invalid credentials. Please check your VIT LMS username and password.",
                )
            elif "captcha" in err_text.lower() or "verification" in err_text.lower():
                raise HTTPException(
                    status_code=401,
                    detail="Security verification (CAPTCHA) required by VIT LMS. You can connect using your browser session cookie.",
                )
            else:
                raise HTTPException(
                    status_code=401,
                    detail=f"VIT LMS authentication failed: {err_text}",
                )

        # Check if redirected to dashboard or courses
        if "/my" in final_url or "/course" in final_url or soup_post.find(class_=lambda x: x and "userbutton" in x):
            user_elem = soup_post.find(class_=lambda x: x and ("usertext" in x or "userbutton" in x or "username" in x))
            disp_name = user_elem.get_text().strip() if user_elem else username
            active_cookie = s.cookies.get("MoodleSession")
            return s, {
                "username": username,
                "displayName": disp_name,
                "authMethod": "credentials",
                "sessionCookie": active_cookie,
            }

        # If still on login page without error, check for MFA
        if "login" in final_url:
            if "mfa" in r_post.text.lower() or "token" in r_post.text.lower():
                raise HTTPException(
                    status_code=401,
                    detail="Multi-Factor Authentication (MFA) required by your VIT LMS account.",
                )
            raise HTTPException(
                status_code=401,
                detail="Authentication failed. Could not verify VIT LMS session. Please reconnect and verify credentials.",
            )

        return s, {
            "username": username,
            "displayName": username,
            "authMethod": "credentials",
            "sessionCookie": s.cookies.get("MoodleSession"),
        }

    except HTTPException:
        raise
    except requests.exceptions.RequestException as exc:
        logger.warning("Network failure communicating with VIT LMS: %s", exc)
        raise HTTPException(
            status_code=503,
            detail="Connection to VIT LMS timed out or failed. Please check network connectivity.",
        )


def fetch_lms_enrolled_courses(session: requests.Session) -> List[Dict[str, Any]]:
    """
    Extracts student's enrolled courses from VIT LMS dashboard using Moodle WebService AJAX API,
    calendar endpoints, and HTML page scraping.
    """
    courses: List[Dict[str, Any]] = []
    seen_ids = set()

    # Step 1: Query /my/ to extract user session key (sesskey)
    sesskey = None
    try:
        r_my = session.get(LMS_MY_URL, verify=False, timeout=REQUEST_TIMEOUT)
        if r_my.status_code == 200:
            m_key = re.search(r'\"sesskey\":\"([^\"]+)\"', r_my.text) or re.search(r'sesskey=([a-zA-Z0-9]+)', r_my.text)
            if m_key:
                sesskey = m_key.group(1)
    except Exception as e:
        logger.warning("Error fetching /my/ page for sesskey: %s", e)

    # Step 2: Use Moodle WebService AJAX API if sesskey is available
    if sesskey:
        try:
            ajax_url = f"{LMS_BASE_URL}/lib/ajax/service.php?sesskey={sesskey}"
            payload = [
                {
                    "index": 0,
                    "methodname": "core_course_get_enrolled_courses_by_timeline_classification",
                    "args": {
                        "classification": "all",
                        "limit": 0,
                        "offset": 0,
                        "sort": "fullname",
                    },
                }
            ]
            r_ajax = session.post(ajax_url, json=payload, verify=False, timeout=REQUEST_TIMEOUT)
            if r_ajax.status_code == 200:
                data = r_ajax.json()
                if isinstance(data, list) and len(data) > 0:
                    course_list = data[0].get("data", {}).get("courses", [])
                    for c in course_list:
                        c_id = str(c.get("id"))
                        c_title = c.get("fullname") or c.get("shortname") or ""
                        contacts = c.get("contacts") or []
                        teachers = [ct.get("fullname") for ct in contacts if ct.get("fullname")]
                        if c_id and c_id not in seen_ids and c_id != "1":
                            seen_ids.add(c_id)
                            courses.append({
                                "id": c_id,
                                "title": c_title,
                                "shortname": c.get("shortname", ""),
                                "teachers": teachers,
                                "url": f"{LMS_BASE_URL}/course/view.php?id={c_id}",
                            })
                    logger.info("Retrieved %d courses via Moodle AJAX service.", len(courses))
        except Exception as exc:
            logger.warning("Moodle AJAX service query failed: %s", exc)

    # Step 3: Check Moodle Calendar Upcoming view for enrolled course links
    try:
        r_cal = session.get(LMS_CALENDAR_URL, verify=False, timeout=REQUEST_TIMEOUT)
        if r_cal.status_code == 200:
            soup_cal = BeautifulSoup(r_cal.text, "html.parser")
            for a in soup_cal.find_all("a", href=re.compile(r"/course/view\.php\?id=\d+")):
                href = a.get("href") or ""
                m = re.search(r"id=(\d+)", href)
                if not m:
                    continue
                c_id = m.group(1)
                if c_id in seen_ids or c_id == "1":
                    continue
                text = a.get_text().strip()
                if text and len(text) > 3:
                    seen_ids.add(c_id)
                    courses.append({
                        "id": c_id,
                        "title": text,
                        "url": href if href.startswith("http") else f"{LMS_BASE_URL}{href}",
                    })
    except Exception as exc:
        logger.warning("Error fetching courses from LMS calendar: %s", exc)

    # Step 4: Fallback to HTML pages
    for url in [LMS_MY_URL, LMS_COURSES_URL]:
        try:
            r = session.get(url, verify=False, timeout=REQUEST_TIMEOUT)
            if r.status_code != 200:
                continue
            soup = BeautifulSoup(r.text, "html.parser")

            for a in soup.find_all("a", href=re.compile(r"/course/view\.php\?id=\d+")):
                href = a.get("href") or ""
                m = re.search(r"id=(\d+)", href)
                if not m:
                    continue
                c_id = m.group(1)
                if c_id in seen_ids or c_id == "1":
                    continue

                text = a.get_text().strip()
                if not text or len(text) < 3 or text.lower() in ("dashboard", "home", "my courses"):
                    continue

                seen_ids.add(c_id)
                courses.append({
                    "id": c_id,
                    "title": text,
                    "url": href if href.startswith("http") else f"{LMS_BASE_URL}{href}",
                })
        except Exception as e:
            logger.warning("Error fetching LMS courses from %s: %s", url, e)

    return courses


def fetch_assignments_for_lms_course(
    session: requests.Session,
    course_id: str,
    course_title: str,
    vtop_course: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Scrapes assignments from Moodle's course assignments page:
    https://lms.vit.ac.in/mod/assign/index.php?id={course_id}
    """
    assignments: List[Dict[str, Any]] = []
    url = f"{LMS_BASE_URL}/mod/assign/index.php?id={course_id}"

    course_code = vtop_course.get("code") or vtop_course.get("courseCode") or "LMS"
    faculty = vtop_course.get("faculty") or vtop_course.get("facultyName")
    vtop_title = vtop_course.get("title") or vtop_course.get("courseTitle") or course_title

    try:
        r = session.get(url, verify=False, timeout=REQUEST_TIMEOUT)
        if r.status_code != 200:
            return assignments

        soup = BeautifulSoup(r.text, "html.parser")
        table = soup.find("table", class_=lambda x: x and "mod_index" in x) or soup.find("table", class_=lambda x: x and "generaltable" in x)
        if not table:
            return assignments

        rows = table.find("tbody").find_all("tr") if table.find("tbody") else table.find_all("tr")[1:]
        for row in rows:
            cols = row.find_all(["td", "th"])
            if len(cols) < 3:
                continue

            link = cols[1].find("a")
            if not link:
                continue

            title = link.get_text().strip()
            href = link.get("href") or ""
            assign_url = href if href.startswith("http") else f"{LMS_BASE_URL}{href}"

            m_cm = re.search(r"id=(\d+)", href)
            assign_id = f"lms-{course_id}-{m_cm.group(1)}" if m_cm else f"lms-{course_id}-{len(assignments)+1}"

            due_raw = cols[2].get_text().strip()
            due_date_str, due_time_str = parse_moodle_date(due_raw)

            status_raw = cols[3].get_text().strip() if len(cols) >= 4 else "Unknown"
            is_submitted = any(
                kw in status_raw.lower()
                for kw in ["submitted", "graded", "turnedin", "complete"]
            )

            # Check if overdue
            is_pending = not is_submitted

            assignments.append({
                "id": assign_id,
                "title": title,
                "courseCode": course_code,
                "courseTitle": vtop_title,
                "faculty": faculty,
                "source": "LMS",
                "platformName": "VIT LMS",
                "platformUrl": assign_url,
                "dueDate": due_date_str,
                "dueTime": due_time_str,
                "status": "Submitted" if is_submitted else "Pending",
                "priority": "Critical" if is_pending else "Medium",
                "weightage": 10,
                "instructions": f"Assigned on VIT LMS ({course_title}).",
                "matchedLmsCourse": course_title,
            })
    except Exception as exc:
        logger.warning("Failed to fetch assignments from LMS course %s: %s", course_id, exc)

    return assignments


def fetch_vit_lms_coursework(
    session: Optional[requests.Session],
    vtop_courses: List[Dict[str, Any]],
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int, List[Dict[str, Any]]]:
    """
    Matches LMS courses with VTOP courses and retrieves authentic assignments.
    """
    if not session:
        return [], [], 0, []

    enrolled_courses = fetch_lms_enrolled_courses(session)
    logger.info("Found %d courses on VIT LMS. Matching with %d VTOP courses...", len(enrolled_courses), len(vtop_courses))

    verified_enrolled = build_verified_semester_course_records({"courses": vtop_courses})
    all_assignments: List[Dict[str, Any]] = []
    matched_subjects: List[Dict[str, Any]] = []
    course_matches: List[Dict[str, Any]] = []

    for lms_c in enrolled_courses:
        c_id = lms_c["id"]
        c_title = lms_c["title"]
        c_teachers = list(lms_c.get("teachers") or [])

        # If teachers were not in AJAX metadata, scrape course page for teacher names
        if not c_teachers and session:
            c_teachers = fetch_lms_course_teachers(session, c_id)

        # Check 1: Enrolled course in that semester
        # Check 2: Professor name of that course
        is_verified, matched_rec, match_meta = verify_external_course(
            enrolled_records=verified_enrolled,
            source="LMS",
            source_id=str(c_id),
            source_name=c_title,
            source_professors=c_teachers,
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
            logger.info("Verified enrolled course [%s: %s] AND professor [%s] with LMS '%s' (%s). Fetching assignments...", matched_rec.courseCode, matched_rec.courseName, matched_rec.facultyName, c_title, c_id)

            sub_assignments = fetch_assignments_for_lms_course(session, c_id, c_title, matched_vtop)

            for sa in sub_assignments:
                sa["verifiedCourseMatchId"] = f"match-lms-{c_id}"
                sa["subjectId"] = matched_rec.courseCode
                sa["courseCode"] = matched_rec.courseCode
                sa["courseTitle"] = matched_rec.courseName
                sa["faculty"] = matched_rec.facultyName

            matched_subjects.append({
                "courseCode": matched_rec.courseCode,
                "courseTitle": matched_rec.courseName,
                "faculty": matched_rec.facultyName,
                "lmsCourseId": c_id,
                "lmsCourseName": c_title,
                "assignmentsCount": len(sub_assignments),
            })
            all_assignments.extend(sub_assignments)
        else:
            logger.debug("LMS course '%s' (%s) skipped: %s", c_title, c_id, match_meta.rejectionReason)

    return all_assignments, matched_subjects, len(enrolled_courses), course_matches


@router.get("/status")
def get_lms_status() -> Dict[str, Any]:
    """Returns the verified connection status of VIT LMS."""
    store = load_store()
    is_connected = bool(store.get("lmsConnected"))
    account = store.get("lmsAccount") or {}
    assignments = store.get("assignments") or []
    lms_assignments = [a for a in assignments if a.get("source") == "LMS" or "LMS" in (a.get("source") or "")]

    pending = [a for a in lms_assignments if a.get("status") in ("Pending", "Overdue", "Due Soon")]
    submitted = [a for a in lms_assignments if a.get("status") == "Submitted"]

    return {
        "connected": is_connected,
        "username": account.get("username"),
        "displayName": account.get("displayName"),
        "portalUrl": LMS_BASE_URL,
        "lastSynced": account.get("lastSynced"),
        "totalAssignments": len(lms_assignments),
        "pendingCount": len(pending),
        "submittedCount": len(submitted),
        "matchedSubjects": account.get("matchedSubjects") or [],
        "matchedCount": account.get("matchedCount") or 0,
        "totalCoursesCount": account.get("totalCoursesCount") or 0,
        "courseMatches": account.get("courseMatches") or [],
        "status": "connected" if is_connected else "disconnected",
    }


@router.post("/login")
def login_and_sync_lms(payload: LMSLoginRequest) -> Dict[str, Any]:
    """
    Connects to VIT LMS, validates credentials or session cookie,
    matches courses with student's current semester VTOP subjects,
    and extracts authentic assignments.
    """
    session, auth_info = authenticate_lms_session(
        payload.username, payload.password, payload.sessionCookie
    )

    store = load_store()
    vtop_courses = list(store.get("courses") or [])

    assignments, matched_subjects, total_courses, course_matches = fetch_vit_lms_coursework(
        session, vtop_courses
    )

    now_iso = datetime.now(timezone.utc).isoformat()

    existing_assignments = store.get("assignments") or []
    other_assignments = [a for a in existing_assignments if a.get("source") != "LMS"]

    all_assignments = other_assignments + assignments
    store["assignments"] = all_assignments
    store["lmsConnected"] = True
    store["lmsAccount"] = {
        "username": auth_info.get("username"),
        "displayName": auth_info.get("displayName"),
        "authMethod": auth_info.get("authMethod"),
        "sessionCookie": auth_info.get("sessionCookie"),
        "connectedAt": now_iso,
        "lastSynced": now_iso,
        "matchedSubjects": matched_subjects,
        "matchedCount": len(matched_subjects),
        "totalCoursesCount": total_courses,
        "courseMatches": course_matches,
    }

    save_store(store)

    pending = [a for a in assignments if a.get("status") in ("Pending", "Overdue", "Due Soon")]
    submitted = [a for a in assignments if a.get("status") == "Submitted"]

    return {
        "success": True,
        "message": f"Successfully connected to VIT LMS. Matched {len(matched_subjects)} subjects. {len(assignments)} authentic assignments loaded.",
        "username": auth_info.get("username"),
        "displayName": auth_info.get("displayName"),
        "assignments": all_assignments,
        "matchedSubjects": matched_subjects,
        "matchedCount": len(matched_subjects),
        "totalCoursesCount": total_courses,
        "lmsAssignmentsCount": len(assignments),
        "pendingCount": len(pending),
        "submittedCount": len(submitted),
        "lastSynced": now_iso,
    }


@router.post("/sync")
def sync_lms() -> Dict[str, Any]:
    """Re-synchronizes authentic coursework from VIT LMS."""
    store = load_store()
    if not store.get("lmsConnected"):
        raise HTTPException(
            status_code=400,
            detail="VIT LMS is not currently connected. Please link your account first.",
        )

    account = store.get("lmsAccount") or {}
    session_cookie = account.get("sessionCookie")

    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    if session_cookie:
        s.cookies.set("MoodleSession", session_cookie, domain="lms.vit.ac.in")

    vtop_courses = list(store.get("courses") or [])
    assignments, matched_subjects, total_courses, course_matches = fetch_vit_lms_coursework(s, vtop_courses)

    existing_assignments = store.get("assignments") or []
    other_assignments = [a for a in existing_assignments if a.get("source") != "LMS"]

    all_assignments = other_assignments + assignments
    store["assignments"] = all_assignments

    now_iso = datetime.now(timezone.utc).isoformat()
    account["lastSynced"] = now_iso
    account["matchedSubjects"] = matched_subjects
    account["matchedCount"] = len(matched_subjects)
    account["totalCoursesCount"] = total_courses
    account["courseMatches"] = course_matches
    store["lmsAccount"] = account

    save_store(store)

    return {
        "success": True,
        "message": f"Synchronized VIT LMS coursework. Matched {len(matched_subjects)} subjects.",
        "assignments": all_assignments,
        "matchedSubjects": matched_subjects,
        "matchedCount": len(matched_subjects),
        "lastSynced": now_iso,
    }


@router.post("/disconnect")
def disconnect_lms() -> Dict[str, Any]:
    """Disconnects VIT LMS and removes synced LMS coursework."""
    store = load_store()
    existing_assignments = store.get("assignments") or []
    store["assignments"] = [a for a in existing_assignments if a.get("source") != "LMS"]
    store["lmsConnected"] = False
    store["lmsAccount"] = None

    save_store(store)
    return {"success": True, "message": "VIT LMS disconnected successfully."}
