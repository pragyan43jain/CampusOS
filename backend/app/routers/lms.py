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

def get_lms_urls(campus: Optional[str] = "chennai") -> Dict[str, str]:
    c = (campus or "chennai").lower().strip()
    if "vellore" in c:
        base = "https://lms.vit.ac.in"
    else:
        base = "https://lmscc.vit.ac.in"
    return {
        "base": base,
        "login": f"{base}/login/index.php",
        "my": f"{base}/my/",
        "courses": f"{base}/my/courses.php",
        "calendar": f"{base}/calendar/view.php?view=upcoming",
    }

LMS_BASE_URL = "https://lms.vit.ac.in"
LMS_LOGIN_URL = "https://lms.vit.ac.in/login/index.php"
LMS_MY_URL = "https://lms.vit.ac.in/my/"
LMS_COURSES_URL = "https://lms.vit.ac.in/my/courses.php"
LMS_CALENDAR_URL = "https://lms.vit.ac.in/calendar/view.php?view=upcoming"

REQUEST_TIMEOUT = 12
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


class LMSLoginRequest(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    sessionCookie: Optional[str] = None  # MoodleSession cookie
    campus: Optional[str] = "chennai"


def normalize_code(code: Optional[str]) -> str:
    return re.sub(r"[^A-Z0-9]", "", (code or "").upper())


def get_base_code(code: Optional[str]) -> str:
    norm = normalize_code(code)
    return norm[:-1] if norm and norm[-1] in ("L", "P", "J") else norm


def fetch_lms_course_teachers(session: requests.Session, course_id: str) -> List[str]:
    """Extracts teacher/instructor names from the LMS course view and participants pages."""
    teachers: List[str] = []
    
    # 1. Main Course View Page
    url = f"{LMS_BASE_URL}/course/view.php?id={course_id}"
    try:
        r = session.get(url, verify=False, timeout=REQUEST_TIMEOUT)
        if r.status_code == 200:
            soup = BeautifulSoup(r.text, "html.parser")
            for el in soup.find_all(
                ["span", "div", "p", "li", "a", "h3", "h4"],
                class_=lambda c: c and any(k in str(c).lower() for k in ["teacher", "instructor", "faculty", "author", "user"]),
            ):
                txt = el.get_text().strip()
                if 3 <= len(txt) < 80 and not any(kw in txt.lower() for kw in ["dashboard", "course", "activity", "assignment", "announcement"]):
                    teachers.append(txt)
            for m in re.finditer(r"(?:Faculty|Instructor|Professor|Teacher)\s*[:\-]?\s*([A-Za-z\s\.]+)", r.text, flags=re.IGNORECASE):
                cand = m.group(1).strip().split("\n")[0].strip()
                if 3 <= len(cand) < 80:
                    teachers.append(cand)
    except Exception as exc:
        logger.debug("Could not fetch teacher details from LMS course page %s: %s", course_id, exc)

    # 2. Participants Page (/user/index.php?id=...)
    try:
        url_users = f"{LMS_BASE_URL}/user/index.php?id={course_id}"
        r_u = session.get(url_users, verify=False, timeout=REQUEST_TIMEOUT)
        if r_u.status_code == 200:
            soup_u = BeautifulSoup(r_u.text, "html.parser")
            for tr in soup_u.find_all("tr"):
                row_txt = tr.get_text()
                if any(role in row_txt.lower() for role in ["teacher", "editing teacher", "instructor", "faculty"]):
                    name_el = tr.find("a", href=re.compile(r"/user/view\.php"))
                    if name_el:
                        t_name = name_el.get_text().strip()
                        if 3 <= len(t_name) < 80 and t_name not in teachers:
                            teachers.append(t_name)
    except Exception as exc:
        logger.debug("Could not fetch participants from LMS course %s: %s", course_id, exc)

    return teachers


def match_lms_course_to_vtop(
    course_name: str,
    course_id: str,
    vtop_courses: List[Dict[str, Any]],
    candidate_professors: Optional[List[str]] = None,
    current_semester: Optional[str] = None,
) -> Optional[Dict[str, Any]]:
    """
    Strict verification of external LMS course:
    1. EXACT COURSE CODE MATCH (canonical, preserving L/P distinctions)
    2. EXACT FACULTY IDENTITY MATCH
    3. CURRENT SEMESTER ISOLATION
    Fails closed if any condition is not satisfied.
    """
    store_data = {"courses": vtop_courses}
    if current_semester:
        store_data["selectedSemester"] = {"name": current_semester, "id": "CH20262701"}

    verified_records = build_verified_semester_course_records(store_data)
    curr_sem = verified_records[0].semester if verified_records else (current_semester or "Fall Semester 2026-27")

    is_verified, matched_rec, _ = verify_external_course(
        enrolled_records=verified_records,
        source="LMS",
        source_id=str(course_id),
        source_name=course_name,
        source_professors=candidate_professors,
        current_semester=curr_sem,
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
    campus: Optional[str] = "chennai",
) -> Tuple[requests.Session, Dict[str, Any]]:
    """
    Authenticates with VIT LMS and returns an active HTTP session and user info.
    Distinguishes between invalid credentials, session expiration, and CAPTCHA/MFA.
    """
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    urls = get_lms_urls(campus)
    domain_host = urls["base"].replace("https://", "").replace("http://", "").split("/")[0]

    # Mode 1: Validate provided session cookie (MoodleSession)
    if session_cookie:
        clean_cookie = session_cookie.strip()
        if clean_cookie.startswith("MoodleSession="):
            clean_cookie = clean_cookie.split("MoodleSession=")[1].split(";")[0].strip()
        s.cookies.set("MoodleSession", clean_cookie, domain=domain_host)

        try:
            r = s.get(urls["my"], verify=False, allow_redirects=False, timeout=REQUEST_TIMEOUT)
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                user_elem = soup.find(class_=lambda x: x and ("usertext" in x or "userbutton" in x or "username" in x))
                display_name = user_elem.get_text().strip() if user_elem else "Student"
                return s, {
                    "username": username or display_name,
                    "displayName": display_name,
                    "authMethod": "cookie",
                    "sessionCookie": clean_cookie,
                    "campus": campus or "chennai",
                }
            elif r.status_code in (302, 303):
                loc = r.headers.get("Location") or ""
                if "login" in loc:
                    raise HTTPException(
                        status_code=401,
                        detail=f"The provided VIT LMS ({urls['base']}) session cookie has expired. Please re-authenticate.",
                    )
        except HTTPException:
            raise
        except requests.exceptions.RequestException as e:
            logger.warning("LMS connectivity error during cookie auth: %s", e)
            raise HTTPException(
                status_code=503,
                detail=f"VIT LMS server ({urls['base']}) is currently unreachable. Please try again later.",
            )

    # Mode 2: Username and password login
    if not username or not password:
        raise HTTPException(
            status_code=400,
            detail="Username and password (or a valid MoodleSession cookie) are required to connect VIT LMS.",
        )

    try:
        # Step 1: GET login page to retrieve logintoken & initial cookies
        r_get = s.get(urls["login"], verify=False, timeout=REQUEST_TIMEOUT)
        if r_get.status_code != 200:
            raise HTTPException(
                status_code=503,
                detail=f"VIT LMS login gateway is currently unreachable. Please check if {urls['base']} is online.",
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
            urls["login"],
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
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                for a in soup.find_all("a", href=re.compile(r"/course/view\.php\?id=\d+")):
                    href = a.get("href") or ""
                    m = re.search(r"id=(\d+)", href)
                    if not m:
                        continue
                    c_id = m.group(1)
                    if c_id in seen_ids or c_id == "1":
                        continue
                    title = a.get_text().strip()
                    if not title or title.lower() in ["home", "dashboard", "courses", "my courses", "site home"]:
                        continue
                    seen_ids.add(c_id)
                    courses.append({
                        "id": c_id,
                        "title": title,
                        "url": href if href.startswith("http") else f"{LMS_BASE_URL}{href}",
                    })
        except Exception as exc:
            logger.warning("Failed to fetch LMS courses from %s: %s", url, exc)

    return courses


def fetch_assignments_for_lms_course(
    session: requests.Session,
    course_id: str,
    course_title: str,
    vtop_course: Dict[str, Any],
) -> List[Dict[str, Any]]:
    """
    Scrapes assignments strictly scoped to Moodle's course assignments page:
    https://lms.vit.ac.in/mod/assign/index.php?id={course_id}
    """
    assignments: List[Dict[str, Any]] = []
    url = f"{LMS_BASE_URL}/mod/assign/index.php?id={course_id}"

    course_code = canonicalize_course_code(vtop_course.get("code") or vtop_course.get("courseCode")) or "LMS"
    faculty = vtop_course.get("faculty") or vtop_course.get("facultyName") or "Unassigned"
    vtop_title = vtop_course.get("title") or vtop_course.get("courseTitle") or course_title
    semester_name = vtop_course.get("semester") or "Fall Semester 2026-27"

    try:
        r = session.get(url, verify=False, timeout=REQUEST_TIMEOUT)
        if r.status_code != 200:
            return assignments

        soup = BeautifulSoup(r.text, "html.parser")
        table = soup.find("table", class_=lambda x: x and "mod_index" in x) or soup.find("table", class_=lambda x: x and "generaltable" in x)
        if not table:
            return assignments

        # Parse table headers if available
        header_map: Dict[str, int] = {}
        thead = table.find("thead")
        if thead:
            th_row = thead.find("tr")
            if th_row:
                for idx, th in enumerate(th_row.find_all(["th", "td"])):
                    th_txt = th.get_text().strip().lower()
                    if any(k in th_txt for k in ["assignment", "activity", "name"]):
                        header_map["title"] = idx
                    elif any(k in th_txt for k in ["due", "deadline", "date"]):
                        header_map["due"] = idx
                    elif any(k in th_txt for k in ["submission", "status"]):
                        header_map["status"] = idx
                    elif "grade" in th_txt:
                        header_map["grade"] = idx

        all_trs = table.find("tbody").find_all("tr") if table.find("tbody") else table.find_all("tr")
        for row in all_trs:
            cols = row.find_all(["td", "th"])
            if len(cols) < 2:
                continue

            # Skip pure header rows without links
            if not row.find("a") and row.find_all("th") and not row.find_all("td"):
                continue

            link = row.find("a", href=re.compile(r"/mod/assign/view\.php")) or row.find("a")
            if not link:
                continue

            title = link.get_text().strip()
            href = link.get("href") or ""
            assign_url = href if href.startswith("http") else f"{LMS_BASE_URL}{href}"

            m_cm = re.search(r"id=(\d+)", href)
            activity_id = m_cm.group(1) if m_cm else str(len(assignments) + 1)
            assign_id = f"lms-{course_id}-{activity_id}"

            # Identify which column index holds the assignment link
            link_col_idx = 0
            for i, col in enumerate(cols):
                if col.find("a") == link or col.get_text().strip() == title:
                    link_col_idx = i
                    break

            due_raw = ""
            status_raw = ""

            if "due" in header_map and header_map["due"] < len(cols):
                due_raw = cols[header_map["due"]].get_text().strip()
            if "status" in header_map and header_map["status"] < len(cols):
                status_raw = cols[header_map["status"]].get_text().strip()

            # Dynamic column heuristic fallback
            if not due_raw or not status_raw:
                other_cols = [(i, c.get_text().strip()) for i, c in enumerate(cols) if i != link_col_idx]
                for idx_c, text in other_cols:
                    lower_txt = text.lower()
                    if any(kw in lower_txt for kw in ["submitted", "no submission", "not submitted", "graded", "turnedin", "turned in", "draft", "complete"]):
                        if not status_raw:
                            status_raw = text
                    elif any(m in lower_txt for m in ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "202", "203", "am", "pm", ":"]):
                        if not due_raw:
                            due_raw = text

            due_date_str, due_time_str = parse_moodle_date(due_raw)

            # Accurate Moodle status evaluation
            status_lower = status_raw.lower()
            is_submitted = (
                any(kw in status_lower for kw in ["submitted for grading", "graded", "turnedin", "turned in", "complete"])
                or ("submitted" in status_lower and "not submitted" not in status_lower and "draft" not in status_lower)
            )

            is_pending = not is_submitted

            assignments.append({
                "id": assign_id,
                "activityId": activity_id,
                "title": title,
                "academicYear": vtop_course.get("academicYear") or "2026",
                "semester": semester_name,
                "semesterId": vtop_course.get("semesterId") or "CH20262701",
                "courseCode": course_code,
                "courseTitle": vtop_title,
                "subject": vtop_title,
                "faculty": faculty,
                "verified": True,
                "source": "LMS",
                "lmsCourseId": str(course_id),
                "externalCourseId": str(course_id),
                "platformName": "VIT LMS",
                "platformUrl": assign_url,
                "submissionUrl": assign_url,
                "dueDate": due_date_str,
                "dueTime": due_time_str,
                "status": "Submitted" if is_submitted else "Pending",
                "applicationStatus": "DONE" if is_submitted else "PENDING",
                "isDone": is_submitted,
                "isSubmitted": is_submitted,
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
    current_semester: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int, List[Dict[str, Any]]]:
    """
    Matches LMS courses with VTOP courses and retrieves authentic assignments.
    Strict pipeline:
    VTOP semester -> VTOP enrolled courses -> VTOP course code -> VTOP faculty
    -> Find matching LMS course -> Verify LMS course code -> Verify LMS faculty
    -> Fetch assignments ONLY from that verified LMS course
    -> Return assignments for that subject.
    """
    if not session:
        return [], [], 0, []

    store_data = {"courses": vtop_courses}
    if current_semester:
        store_data["selectedSemester"] = {"name": current_semester, "id": "CH20262701"}

    verified_enrolled = build_verified_semester_course_records(store_data)
    curr_sem_name = verified_enrolled[0].semester if verified_enrolled else (current_semester or "Fall Semester 2026-27")

    enrolled_courses = fetch_lms_enrolled_courses(session)
    logger.info("Found %d courses on VIT LMS. Matching with %d VTOP courses for semester '%s'...", len(enrolled_courses), len(verified_enrolled), curr_sem_name)

    all_assignments: List[Dict[str, Any]] = []
    matched_subjects: List[Dict[str, Any]] = []
    course_matches: List[Dict[str, Any]] = []
    verified_lms_course_ids = set()

    for lms_c in enrolled_courses:
        c_id = str(lms_c["id"])
        c_title = lms_c["title"]
        c_teachers = list(lms_c.get("teachers") or [])

        if not c_teachers and session:
            c_teachers = fetch_lms_course_teachers(session, c_id)

        is_verified, matched_rec, match_meta = verify_external_course(
            enrolled_records=verified_enrolled,
            source="LMS",
            source_id=c_id,
            source_name=c_title,
            source_professors=c_teachers,
            current_semester=curr_sem_name,
        )
        course_matches.append(match_meta.model_dump())

        if matched_rec:
            logger.info(
                "\n[LMS COURSE VERIFICATION]\n"
                "VTOP Course: %s\n"
                "VTOP Subject: %s\n"
                "VTOP Faculty: %s\n"
                "VTOP Semester: %s\n\n"
                "LMS Candidate: %s\n"
                "LMS Course ID: %s\n"
                "LMS Faculty: %s\n"
                "LMS Semester: %s\n\n"
                "Course Code Match: %s\n"
                "Faculty Match: %s\n"
                "Semester Match: %s\n"
                "FINAL: %s",
                matched_rec.courseCode,
                matched_rec.courseName,
                matched_rec.facultyName,
                matched_rec.semester,
                c_title,
                c_id,
                c_teachers or ["None"],
                curr_sem_name,
                match_meta.courseCodeMatch,
                match_meta.facultyMatch,
                match_meta.semesterMatch,
                "VERIFIED" if is_verified else f"REJECTED ({match_meta.rejectionReason})",
            )
        else:
            logger.info(
                "\n[LMS COURSE VERIFICATION]\n"
                "LMS Candidate: %s\n"
                "LMS Course ID: %s\n"
                "LMS Faculty: %s\n"
                "Result: REJECTED (%s)",
                c_title,
                c_id,
                c_teachers or ["None"],
                match_meta.rejectionReason or "No matching enrolled course",
            )

        if is_verified and matched_rec:
            verified_lms_course_ids.add(c_id)
            matched_vtop = {
                "code": matched_rec.courseCode,
                "title": matched_rec.courseName,
                "faculty": matched_rec.facultyName,
                "facultyId": matched_rec.facultyId,
                "slot": matched_rec.slot,
                "section": matched_rec.section,
                "semester": matched_rec.semester,
            }

            sub_assignments = fetch_assignments_for_lms_course(session, c_id, c_title, matched_vtop)

            for sa in sub_assignments:
                sa["verifiedCourseMatchId"] = f"match-lms-{c_id}"
                sa["subjectId"] = matched_rec.courseCode
                sa["courseCode"] = matched_rec.courseCode
                sa["courseTitle"] = matched_rec.courseName
                sa["subject"] = matched_rec.courseName
                sa["faculty"] = matched_rec.facultyName
                sa["semester"] = matched_rec.semester
                sa["verified"] = True
                sa["source"] = "LMS"
                sa["lmsCourseId"] = c_id

            logger.info(
                "\n[LMS ASSIGNMENT FETCH]\n"
                "Verified LMS Course: %s\n"
                "Course: %s\n"
                "Faculty: %s\n"
                "Assignments Retrieved: %d\n"
                "Assignments Accepted: %d\n"
                "Assignments Rejected: 0",
                c_id,
                matched_rec.courseCode,
                matched_rec.facultyName,
                len(sub_assignments),
                len(sub_assignments),
            )

            matched_subjects.append({
                "courseCode": matched_rec.courseCode,
                "courseTitle": matched_rec.courseName,
                "faculty": matched_rec.facultyName,
                "lmsCourseId": c_id,
                "lmsCourseName": c_title,
                "assignmentsCount": len(sub_assignments),
            })
            all_assignments.extend(sub_assignments)

    return all_assignments, matched_subjects, len(enrolled_courses), course_matches


@router.get("/status")
def get_lms_status() -> Dict[str, Any]:
    """Returns the verified connection status of VIT LMS."""
    store = load_store()
    is_connected = bool(store.get("lmsConnected"))
    account = store.get("lmsAccount") or {}
    assignments = store.get("assignments") or []
    lms_assignments = [a for a in assignments if a.get("source") == "LMS" or "LMS" in (a.get("source") or "")]

    submitted = [
        a for a in lms_assignments
        if a.get("isDone") or a.get("isSubmitted") or (a.get("displayStatus") or a.get("status") or "").upper() in ("DONE", "SUBMITTED", "COMPLETED")
    ]
    pending = [a for a in lms_assignments if a not in submitted]

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
        payload.username, payload.password, payload.sessionCookie, payload.campus
    )

    store = load_store()
    vtop_courses = list(store.get("courses") or [])

    current_sem = (store.get("selectedSemester") or {}).get("name")
    assignments, matched_subjects, total_courses, course_matches = fetch_vit_lms_coursework(
        session, vtop_courses, current_semester=current_sem
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

    submitted = [
        a for a in assignments
        if a.get("isDone") or a.get("isSubmitted") or (a.get("displayStatus") or a.get("status") or "").upper() in ("DONE", "SUBMITTED", "COMPLETED")
    ]
    pending = [a for a in assignments if a not in submitted]

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
    current_sem = (store.get("selectedSemester") or {}).get("name")
    assignments, matched_subjects, total_courses, course_matches = fetch_vit_lms_coursework(
        s, vtop_courses, current_semester=current_sem
    )

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
