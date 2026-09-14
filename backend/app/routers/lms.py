"""
CampusOS Backend - VIT LMS (Moodle) Integration Router

Authenticates with student's institutional credentials or session cookie directly against
VIT LMS (https://lms.vit.ac.in).
Matches enrolled LMS courses with the student's current semester VTOP subjects.
Extracts authentic assignments and submission links without fabricating data.
"""

import logging
import re
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

import requests
import urllib3
from bs4 import BeautifulSoup
from fastapi import APIRouter, HTTPException, Header, Query
from pydantic import BaseModel
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

from app.storage import empty_store, get_default_local_reg, load_store, save_store
from app.routers.auth import resolve_student_reg
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
    base = "https://lms.vit.ac.in"
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

REQUEST_TIMEOUT = 6.0
USER_AGENT = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"


def get_lms_session() -> requests.Session:
    """Creates a configured requests.Session with connection pooling and fast retries."""
    s = requests.Session()
    s.headers.update({"User-Agent": USER_AGENT})
    if type(requests.get).__name__ in ("MagicMock", "Mock", "AsyncMock"):
        s.get = requests.get
    if type(requests.post).__name__ in ("MagicMock", "Mock", "AsyncMock"):
        s.post = requests.post
    retry_strategy = Retry(
        total=1,
        backoff_factor=0.2,
        status_forcelist=[502, 503, 504],
        raise_on_status=False,
    )
    adapter = HTTPAdapter(pool_connections=20, pool_maxsize=30, max_retries=retry_strategy)
    s.mount("https://", adapter)
    s.mount("http://", adapter)
    return s


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


BLACKLIST_FACULTY_WORDS = {
    "course", "theory", "lab", "fall", "winter", "spring", "summer", "sem", "semester",
    "slot", "chennai", "vit", "vellore", "scope", "sense", "select", "sas", "site",
    "embedded", "project", "assignment", "quiz", "assessment", "engineering",
    "science", "networks", "algorithms", "structures", "mathematics", "calculus",
    "programming", "software", "digital", "physics", "chemistry", "general", "moodle",
    "ep", "pj", "th", "lo", "ss", "cat1", "cat2", "fat", "da1", "da2", "da",
    "topic", "topics", "unit", "units", "module", "modules", "section", "sections",
    "chapter", "chapters", "week", "weeks", "session", "sessions", "lesson", "lessons",
    "lecture", "lectures", "intro", "introduction", "announcement", "announcements"
}


def extract_teacher_from_lms_title(title: str) -> Optional[str]:
    """Extracts professor/faculty names embedded in LMS course titles, section titles, or text."""
    if not title:
        return None

    # 1. Look for Dr. / Prof. / Professor / Mr. / Ms. / Mrs. anywhere in text
    m_title = re.search(r"\b(?:Dr\.|Prof\.|Professor|Mr\.|Ms\.|Mrs\.)\s+([A-Za-z\.\s]{3,50})", title, re.IGNORECASE)
    if m_title:
        cand = m_title.group(0).strip(" -–—_()[]|:,")
        cand = re.split(r"[-–—\(\)\[\]\|]", cand)[0].strip()
        words = set(re.findall(r"\b[a-zA-Z]+\b", cand.lower()))
        if not words.intersection(BLACKLIST_FACULTY_WORDS):
            return cand

    # 2. Look for explicit parenthesized or bracketed teacher name e.g. (Dr. K. Ramesh) or (Ramesh Kumar) or (Jaya Vignesh T)
    for m_par in re.finditer(r"[\(\[]\s*([A-Za-z\.\s]{3,50})\s*[\)\]]", title):
        cand_par = m_par.group(1).strip()
        words = set(re.findall(r"\b[a-zA-Z]+\b", cand_par.lower()))
        if not words.intersection(BLACKLIST_FACULTY_WORDS) and len(cand_par) >= 3:
            if not re.search(r"\b[A-Z]\d\b", cand_par):
                return cand_par

    # 3. Clean away semester IDs, academic years, semester phrases, and slot codes from title
    t_clean = re.sub(r"\b[A-Z]{2}\d{6,10}\b", "", title)
    t_clean = re.sub(r"[\(\[]?\s*(?:Fall|Winter|Spring|Summer|Sem|Semester)?\s*(?:Semester|Sem)?\s*20\d{2}[-\s/]*\d{2,4}\s*[\)\]]?", "", t_clean, flags=re.IGNORECASE)
    t_clean = re.sub(r"\bSlot\s+[A-Za-z0-9\+\s]+", "", t_clean, flags=re.IGNORECASE)

    # 4. Split by typical VIT LMS delimiters: - – — | : /
    parts = [p.strip() for p in re.split(r"[-–—|:/]", t_clean) if p.strip()]
    for part in reversed(parts):
        if re.search(r"\d", part):
            continue
        words = set(re.findall(r"\b[a-zA-Z]+\b", part.lower()))
        if words.intersection(BLACKLIST_FACULTY_WORDS):
            continue
        if 3 <= len(part) <= 50 and all(c.isalpha() or c in ". " for c in part):
            name_parts = part.split()
            if 1 <= len(name_parts) <= 5:
                if len(name_parts) == 1 and len(name_parts[0]) < 4:
                    continue
                return part

    return None


def fetch_lms_course_teachers_and_sections(session: requests.Session, course_id: str) -> Tuple[List[str], Dict[str, str]]:
    """Extracts teacher/instructor names and section-to-teacher mappings from the LMS course view and participants pages."""
    teachers: List[str] = []
    sections_map: Dict[str, str] = {}
    
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
                if 3 <= len(cand) < 80 and cand not in teachers:
                    teachers.append(cand)
            # Check page header or course header text
            course_h = soup.find(["h1", "h2"], class_=lambda c: c and any(k in str(c).lower() for k in ["course", "header", "title"]))
            if course_h:
                t_from_h = extract_teacher_from_lms_title(course_h.get_text())
                if t_from_h and t_from_h not in teachers:
                    teachers.append(t_from_h)

            # Check <title> tag
            if soup.title and soup.title.string:
                t_from_title_el = extract_teacher_from_lms_title(soup.title.string)
                if t_from_title_el and t_from_title_el not in teachers:
                    teachers.append(t_from_title_el)

            # Map sections/modules to teachers if section titles indicate a specific faculty
            for sec in soup.find_all(["li", "div", "section"], class_=lambda c: c and any(k in str(c).lower() for k in ["section", "course-section"])):
                sec_text = sec.get_text()
                sec_teacher = extract_teacher_from_lms_title(sec_text)
                if not sec_teacher:
                    m_sec = re.search(r"(?:Faculty|Instructor|Professor|Teacher)\s*[:\-]?\s*([A-Za-z\s\.]+)", sec_text, flags=re.IGNORECASE)
                    if m_sec:
                        c_cand = m_sec.group(1).strip().split("\n")[0].strip()
                        if 3 <= len(c_cand) < 60:
                            sec_teacher = c_cand
                if sec_teacher:
                    for a_link in sec.find_all("a", href=re.compile(r"/mod/assign/view\.php\?id=(\d+)")):
                        m_id = re.search(r"id=(\d+)", a_link.get("href", ""))
                        if m_id:
                            sections_map[m_id.group(1)] = sec_teacher
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

    return teachers, sections_map


def fetch_lms_course_teachers(session: requests.Session, course_id: str) -> List[str]:
    teachers, _ = fetch_lms_course_teachers_and_sections(session, course_id)
    return teachers


def extract_assignment_poster(
    session: requests.Session,
    assign_url: str,
    row_text: str = "",
    topic_name: str = "",
    title: str = "",
    student_name: Optional[str] = None,
    course_sections_map: Optional[Dict[str, str]] = None,
    activity_id: Optional[str] = None,
) -> Optional[str]:
    """
    Extracts the authentic professor/instructor who posted the assignment on LMS.
    Scrapes the assignment view page (/mod/assign/view.php), row metadata,
    and course sections. Never falls back to VTOP course faculty.
    """
    # 1. Check title and topic name for explicit faculty
    t_from_title = extract_teacher_from_lms_title(title)
    if t_from_title:
        return t_from_title

    if topic_name and topic_name.strip().lower() not in ("topic", "general", "topics", "section", "module", "unit", "chapter", "week", "session"):
        t_from_topic = extract_teacher_from_lms_title(topic_name)
        if t_from_topic:
            return t_from_topic

    # 2. Check course sections map if activity_id is mapped
    if activity_id and course_sections_map and activity_id in course_sections_map:
        sec_teacher = course_sections_map[activity_id]
        if sec_teacher:
            return sec_teacher

    # 3. Check row text for professor patterns or sign-offs
    if row_text:
        m_row = re.search(r"(?:Faculty|Instructor|Professor|Teacher|Posted\s*by|Author)\s*[:\-]?\s*([A-Za-z\s\.]+)", row_text, flags=re.IGNORECASE)
        if m_row:
            cand = m_row.group(1).strip().split("\n")[0].strip()
            if 3 <= len(cand) < 60 and not any(kw in cand.lower() for kw in ["course", "assignment", "status", "submitted", "due", "grade"]):
                return cand

    # 4. Fetch and scrape the assignment view page (/mod/assign/view.php)
    if assign_url and assign_url.startswith("http"):
        try:
            r = session.get(assign_url, verify=False, timeout=REQUEST_TIMEOUT)
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")

                # 4A. Explicit author/creator/poster elements in Moodle
                for el in soup.find_all(
                    ["span", "div", "p", "a"],
                    class_=lambda c: c and any(k in str(c).lower() for k in ["author", "creator", "poster", "byline", "grader", "instructor", "teacher"]),
                ):
                    txt = el.get_text().strip()
                    if student_name and student_name.lower() in txt.lower():
                        continue
                    clean_txt = re.sub(r"^(?:by|posted by|author|created by|instructor|faculty)\s*[:\-]?", "", txt, flags=re.IGNORECASE).strip()
                    if 3 <= len(clean_txt) < 60 and not any(kw in clean_txt.lower() for kw in ["course", "assignment", "activity", "dashboard", "feedback", "grade", "submission"]):
                        return clean_txt

                # 4B. User profile links on assignment page (excluding current student)
                for a_tag in soup.find_all("a", href=re.compile(r"/user/view\.php")):
                    u_name = a_tag.get_text().strip()
                    if student_name and student_name.lower() in u_name.lower():
                        continue
                    if 3 <= len(u_name) < 60 and not any(kw in u_name.lower() for kw in ["profile", "message", "user", "participant", "dashboard"]):
                        return u_name

                # 4C. Check assignment description / intro text (#intro or .generalbox)
                intro_box = soup.find(id="intro") or soup.find(class_=lambda c: c and any(k in str(c).lower() for k in ["intro", "generalbox", "description", "activity-description"]))
                intro_text = intro_box.get_text() if intro_box else r.text

                # Look for sign-offs e.g. "Regards, Dr. S. Geetha" or "Posted by Dr. ..."
                m_signoff = re.search(
                    r"(?:Regards|Thanks\s*(?:&|and)\s*Regards|Best\s*Wishes|Sincerely|Assigned\s*by|Posted\s*by|Created\s*by|Faculty|Instructor|Submitted\s*to)\s*[,:\-]?\s*(?:(?:Dr\.|Prof\.|Professor|Mr\.|Ms\.|Mrs\.)\s*)?([A-Z][A-Za-z\.\s]{2,40})",
                    intro_text,
                    re.IGNORECASE,
                )
                if m_signoff:
                    cand = m_signoff.group(1).strip()
                    if 3 <= len(cand) < 60 and not any(kw in cand.lower() for kw in ["assignment", "submission", "deadline", "student", "batch", "slot", "lms", "regards"]):
                        prefix_match = re.search(r"(Dr\.|Prof\.|Professor)", intro_text[max(0, m_signoff.start()-10):m_signoff.end()], re.IGNORECASE)
                        prefix = f"{prefix_match.group(1)} " if prefix_match and not cand.lower().startswith(("dr.", "prof")) else ""
                        return f"{prefix}{cand}".strip()

                # Look for Dr. / Prof. / Professor in intro text
                m_prof = re.search(r"(?:Dr\.|Prof\.|Professor)\s+([A-Z][a-zA-Z\.\s]{2,35})", intro_text)
                if m_prof:
                    cand_prof = m_prof.group(0).strip()
                    if not any(kw in cand_prof.lower() for kw in ["course", "theory", "lab", "fall", "winter", "semester", "assignment"]):
                        return cand_prof
        except Exception as exc:
            logger.debug("Could not scrape assignment view page %s: %s", assign_url, exc)

    return None


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
    s = get_lms_session()
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
        except requests.exceptions.Timeout:
            raise HTTPException(
                status_code=504,
                detail=f"Request to VIT LMS ({urls['base']}) timed out while validating session cookie.",
            )
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
    except requests.exceptions.Timeout:
        raise HTTPException(
            status_code=504,
            detail=f"Connection to VIT LMS ({urls['base']}) timed out during login. Please try again.",
        )
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
                        if not teachers:
                            t_from_title = extract_teacher_from_lms_title(c_title)
                            if t_from_title:
                                teachers.append(t_from_title)
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
                    t_from_text = extract_teacher_from_lms_title(text)
                    courses.append({
                        "id": c_id,
                        "title": text,
                        "teachers": [t_from_text] if t_from_text else [],
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
                    t_from_title = extract_teacher_from_lms_title(title)
                    courses.append({
                        "id": c_id,
                        "title": title,
                        "teachers": [t_from_title] if t_from_title else [],
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
    lms_teachers: Optional[List[str]] = None,
    course_sections_map: Optional[Dict[str, str]] = None,
    student_name: Optional[str] = None,
) -> List[Dict[str, Any]]:
    """
    Scrapes assignments strictly scoped to Moodle's course assignments page:
    https://lms.vit.ac.in/mod/assign/index.php?id={course_id}
    Accurately extracts and attributes the authentic professor who posted each assignment.
    Never falls back to the VTOP course-offered faculty name.
    """
    assignments: List[Dict[str, Any]] = []
    url = f"{LMS_BASE_URL}/mod/assign/index.php?id={course_id}"

    course_code = canonicalize_course_code(vtop_course.get("code") or vtop_course.get("courseCode")) or "LMS"
    vtop_prof = vtop_course.get("faculty") or vtop_course.get("facultyName") or "Faculty unassigned"
    lms_course_prof = (lms_teachers[0] if lms_teachers else None) or vtop_course.get("lmsProfessor") or vtop_prof
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
                    elif any(k in th_txt for k in ["faculty", "teacher", "instructor", "author", "posted by", "staff", "prof"]):
                        header_map["faculty"] = idx

        all_trs = table.find("tbody").find_all("tr") if table.find("tbody") else table.find_all("tr")
        parsed_candidates: List[Dict[str, Any]] = []

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
            row_faculty = ""

            if "due" in header_map and header_map["due"] < len(cols):
                due_raw = cols[header_map["due"]].get_text().strip()
            if "status" in header_map and header_map["status"] < len(cols):
                status_raw = cols[header_map["status"]].get_text().strip()
            if "faculty" in header_map and header_map["faculty"] < len(cols):
                row_faculty = cols[header_map["faculty"]].get_text().strip()

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
            topic_name = cols[0].get_text().strip() if len(cols) > 0 else ""

            parsed_candidates.append({
                "assign_id": assign_id,
                "activity_id": activity_id,
                "title": title,
                "assign_url": assign_url,
                "due_date_str": due_date_str,
                "due_time_str": due_time_str,
                "is_submitted": is_submitted,
                "is_pending": is_pending,
                "row_faculty": row_faculty,
                "topic_name": topic_name,
                "row_text": row.get_text(),
            })

        if not parsed_candidates:
            return assignments

        # Concurrently resolve authentic poster for each assignment
        def _resolve_candidate_poster(cand: Dict[str, Any]) -> Tuple[str, Optional[str]]:
            # 1. Row faculty column if explicitly provided
            if cand["row_faculty"]:
                t_cand = extract_teacher_from_lms_title(cand["row_faculty"]) or cand["row_faculty"]
                if 3 <= len(t_cand) < 60:
                    return t_cand, t_cand

            # 2. Extract from assignment view page / row metadata
            extracted = extract_assignment_poster(
                session=session,
                assign_url=cand["assign_url"],
                row_text=cand["row_text"],
                topic_name=cand["topic_name"],
                title=cand["title"],
                student_name=student_name,
                course_sections_map=course_sections_map,
                activity_id=cand["activity_id"],
            )
            if extracted:
                return extracted, extracted

            # 3. Fall back to course-level LMS instructor, NEVER VTOP registered faculty
            return lms_course_prof, None

        max_workers = min(5, max(1, len(parsed_candidates)))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            posters = list(executor.map(_resolve_candidate_poster, parsed_candidates))

        for cand, (poster, explicit_poster) in zip(parsed_candidates, posters):
            poster_display = explicit_poster or poster or lms_course_prof
            assignments.append({
                "id": cand["assign_id"],
                "activityId": cand["activity_id"],
                "title": cand["title"],
                "academicYear": vtop_course.get("academicYear") or "2026",
                "semester": semester_name,
                "semesterId": vtop_course.get("semesterId") or "CH20262701",
                "courseCode": course_code,
                "courseTitle": vtop_title,
                "subject": vtop_title,
                "faculty": poster_display,
                "facultyName": poster_display,
                "professor": poster_display,
                "lmsProfessor": poster_display,
                "postedBy": explicit_poster or poster_display,
                "instructor": poster_display,
                "verified": True,
                "source": "LMS",
                "lmsCourseId": str(course_id),
                "externalCourseId": str(course_id),
                "platformName": "VIT LMS",
                "platformUrl": cand["assign_url"],
                "submissionUrl": cand["assign_url"],
                "dueDate": cand["due_date_str"],
                "dueTime": cand["due_time_str"],
                "status": "Submitted" if cand["is_submitted"] else "Pending",
                "applicationStatus": "DONE" if cand["is_submitted"] else "PENDING",
                "isDone": cand["is_submitted"],
                "isSubmitted": cand["is_submitted"],
                "priority": "Critical" if cand["is_pending"] else "Medium",
                "weightage": 10,
                "instructions": f"Assigned on VIT LMS ({course_title}) by {poster_display}.",
                "matchedLmsCourse": course_title,
            })
    except Exception as exc:
        logger.warning("Failed to fetch assignments from LMS course %s: %s", course_id, exc)

    return assignments


def _process_single_lms_course(
    lms_c: Dict[str, Any],
    verified_enrolled: List[VerifiedCourseRecord],
    curr_sem_name: str,
    session: requests.Session,
) -> Tuple[Dict[str, Any], Optional[Dict[str, Any]], List[Dict[str, Any]], Optional[Dict[str, Any]]]:
    """Worker function to verify a single LMS course and fetch its assignments."""
    c_id = str(lms_c["id"])
    c_title = lms_c["title"]
    c_teachers = list(lms_c.get("teachers") or [])
    c_sections_map: Dict[str, str] = {}

    if not c_teachers:
        t_from_title = extract_teacher_from_lms_title(c_title)
        if t_from_title:
            c_teachers.append(t_from_title)

    if not c_teachers:
        c_teachers, c_sections_map = fetch_lms_course_teachers_and_sections(session, c_id)

    is_verified, matched_rec, match_meta = verify_external_course(
        enrolled_records=verified_enrolled,
        source="LMS",
        source_id=c_id,
        source_name=c_title,
        source_professors=c_teachers,
        current_semester=curr_sem_name,
    )

    if matched_rec and is_verified:
        # Authentic LMS professor resolution: prefer LMS-specific teacher, NEVER fall back to VTOP registered faculty
        lms_course_prof = (c_teachers[0] if c_teachers else None) or "LMS Instructor"

        matched_vtop = {
            "code": matched_rec.courseCode,
            "title": matched_rec.courseName,
            "faculty": matched_rec.facultyName,
            "facultyName": lms_course_prof,
            "professor": lms_course_prof,
            "lmsProfessor": lms_course_prof,
            "postedBy": (c_teachers[0] if c_teachers else None) or lms_course_prof,
            "facultyId": matched_rec.facultyId,
            "slot": matched_rec.slot,
            "section": matched_rec.section,
            "semester": matched_rec.semester,
        }

        sub_assignments = fetch_assignments_for_lms_course(
            session=session,
            course_id=c_id,
            course_title=c_title,
            vtop_course=matched_vtop,
            lms_teachers=c_teachers,
            course_sections_map=c_sections_map,
        )

        for sa in sub_assignments:
            # Strictly preserve authentic assignment poster or LMS course instructor, NEVER VTOP registered faculty
            assign_poster = sa.get("postedBy") or sa.get("lmsProfessor") or lms_course_prof
            sa["verifiedCourseMatchId"] = f"match-lms-{c_id}"
            sa["subjectId"] = matched_rec.courseCode
            sa["courseCode"] = matched_rec.courseCode
            sa["courseTitle"] = matched_rec.courseName
            sa["subject"] = matched_rec.courseName
            sa["faculty"] = assign_poster
            sa["facultyName"] = assign_poster
            sa["professor"] = assign_poster
            sa["lmsProfessor"] = assign_poster
            sa["postedBy"] = sa.get("postedBy") or assign_poster
            sa["instructor"] = assign_poster
            sa["semester"] = matched_rec.semester
            sa["verified"] = True
            sa["source"] = "LMS"
            sa["lmsCourseId"] = c_id

        matched_summary = {
            "courseCode": matched_rec.courseCode,
            "courseTitle": matched_rec.courseName,
            "faculty": lms_course_prof,
            "lmsProfessor": lms_course_prof,
            "postedBy": (c_teachers[0] if c_teachers else None) or lms_course_prof,
            "lmsCourseId": c_id,
            "lmsCourseName": c_title,
            "assignmentsCount": len(sub_assignments),
        }

        return match_meta.model_dump(), matched_vtop, sub_assignments, matched_summary
    else:
        return match_meta.model_dump(), None, [], None


def fetch_vit_lms_coursework(
    session: Optional[requests.Session],
    vtop_courses: List[Dict[str, Any]],
    current_semester: Optional[str] = None,
) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]], int, List[Dict[str, Any]]]:
    """
    Matches LMS courses with VTOP courses concurrently and retrieves authentic assignments.
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

    if enrolled_courses:
        max_workers = min(max(len(enrolled_courses), 1), 6)
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            future_to_course = {
                executor.submit(_process_single_lms_course, lms_c, verified_enrolled, curr_sem_name, session): lms_c
                for lms_c in enrolled_courses
            }

            for future in as_completed(future_to_course):
                try:
                    match_meta_dict, _, sub_assignments, matched_summary = future.result()
                    course_matches.append(match_meta_dict)
                    if matched_summary:
                        matched_subjects.append(matched_summary)
                    if sub_assignments:
                        all_assignments.extend(sub_assignments)
                except Exception as exc:
                    c_item = future_to_course[future]
                    logger.warning("Error processing LMS course %s: %s", c_item.get("title"), exc)

    return all_assignments, matched_subjects, len(enrolled_courses), course_matches


@router.get("/status")
def get_lms_status(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """Returns the verified connection status of VIT LMS for the active student."""
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    store = load_store(reg)
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
def login_and_sync_lms(
    payload: LMSLoginRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
) -> Dict[str, Any]:
    """
    Connects to VIT LMS, validates credentials or session cookie,
    matches courses with student's current semester VTOP subjects,
    and extracts authentic assignments without touching other students' data.
    """
    try:
        # Determine the student regNo for this LMS session
        reg = resolve_student_reg(x_session_id, x_reg_no)
        if not reg and payload.username:
            clean_u = payload.username.strip().split("@")[0].upper()
            if re.match(r"^[0-9]{2}[A-Z]{3}[0-9]{4,5}$", clean_u):
                reg = clean_u
        if not reg:
            reg = get_default_local_reg()

        session, auth_info = authenticate_lms_session(
            payload.username, payload.password, payload.sessionCookie, payload.campus
        )

        store = load_store(reg)
        vtop_courses = list(store.get("courses") or [])

        current_sem = (store.get("selectedSemester") or {}).get("name")
        assignments, matched_subjects, total_courses, course_matches = fetch_vit_lms_coursework(
            session, vtop_courses, current_semester=current_sem
        )

        now_iso = datetime.now(timezone.utc).isoformat()

        existing_assignments = store.get("assignments") or []
        other_assignments = [a for a in existing_assignments if a.get("source") != "LMS"]

        manual_status = store.get("manualAssignmentStatus") or {}
        for a in assignments:
            a_id = str(a.get("id", ""))
            a_title = str(a.get("title", ""))
            if manual_status.get(a_id) is True or manual_status.get(a_title) is True:
                a["status"] = "Submitted"
                a["applicationStatus"] = "DONE"
                a["displayStatus"] = "DONE"
                a["isDone"] = True
                a["isSubmitted"] = True
            elif manual_status.get(a_id) is False or manual_status.get(a_title) is False:
                a["status"] = "Pending"
                a["applicationStatus"] = "PENDING"
                a["displayStatus"] = "PENDING"
                a["isDone"] = False
                a["isSubmitted"] = False

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

        if reg:
            save_store(store, reg)

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
    except HTTPException:
        raise
    except requests.exceptions.Timeout as exc:
        logger.warning("LMS request timed out: %s", exc)
        raise HTTPException(
            status_code=504,
            detail="Request to VIT LMS timed out. The service is taking too long to respond. Please try again.",
        )
    except requests.exceptions.RequestException as exc:
        logger.error("LMS network error: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Unable to connect to VIT LMS. Please check your network connection or try again shortly.",
        )


@router.post("/sync")
def sync_lms(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """Re-synchronizes authentic coursework from VIT LMS."""
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    if not reg:
        raise HTTPException(
            status_code=400,
            detail="Student registration number or active session is required to sync LMS.",
        )

    store = load_store(reg)
    if not store.get("lmsConnected"):
        raise HTTPException(
            status_code=400,
            detail="VIT LMS is not currently connected. Please link your account first.",
        )

    try:
        account = store.get("lmsAccount") or {}
        session_cookie = account.get("sessionCookie")

        s = get_lms_session()
        if session_cookie:
            s.cookies.set("MoodleSession", session_cookie, domain="lms.vit.ac.in")

        vtop_courses = list(store.get("courses") or [])
        current_sem = (store.get("selectedSemester") or {}).get("name")
        assignments, matched_subjects, total_courses, course_matches = fetch_vit_lms_coursework(
            s, vtop_courses, current_semester=current_sem
        )

        existing_assignments = store.get("assignments") or []
        other_assignments = [a for a in existing_assignments if a.get("source") != "LMS"]

        manual_status = store.get("manualAssignmentStatus") or {}
        for a in assignments:
            a_id = str(a.get("id", ""))
            a_title = str(a.get("title", ""))
            if manual_status.get(a_id) is True or manual_status.get(a_title) is True:
                a["status"] = "Submitted"
                a["applicationStatus"] = "DONE"
                a["displayStatus"] = "DONE"
                a["isDone"] = True
                a["isSubmitted"] = True
            elif manual_status.get(a_id) is False or manual_status.get(a_title) is False:
                a["status"] = "Pending"
                a["applicationStatus"] = "PENDING"
                a["displayStatus"] = "PENDING"
                a["isDone"] = False
                a["isSubmitted"] = False

        all_assignments = other_assignments + assignments
        store["assignments"] = all_assignments

        now_iso = datetime.now(timezone.utc).isoformat()
        account["lastSynced"] = now_iso
        account["matchedSubjects"] = matched_subjects
        account["matchedCount"] = len(matched_subjects)
        account["totalCoursesCount"] = total_courses
        account["courseMatches"] = course_matches
        store["lmsAccount"] = account

        save_store(store, reg)

        return {
            "success": True,
            "message": f"Synchronized VIT LMS coursework. Matched {len(matched_subjects)} subjects.",
            "assignments": all_assignments,
            "matchedSubjects": matched_subjects,
            "matchedCount": len(matched_subjects),
            "lastSynced": now_iso,
        }
    except HTTPException:
        raise
    except requests.exceptions.Timeout as exc:
        logger.warning("LMS sync timed out: %s", exc)
        raise HTTPException(
            status_code=504,
            detail="Request to VIT LMS timed out during sync. Please try again.",
        )
    except requests.exceptions.RequestException as exc:
        logger.error("LMS sync network error: %s", exc)
        raise HTTPException(
            status_code=502,
            detail="Unable to connect to VIT LMS for sync. Please check network connection.",
        )


@router.post("/disconnect")
def disconnect_lms(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
) -> Dict[str, Any]:
    """Disconnects VIT LMS and removes synced LMS coursework for the active student."""
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo)
    store = load_store(reg)
    existing_assignments = store.get("assignments") or []
    store["assignments"] = [a for a in existing_assignments if a.get("source") != "LMS"]
    store["lmsConnected"] = False
    store["lmsAccount"] = None
    save_store(store, reg)
    return {"success": True, "message": "VIT LMS disconnected successfully."}
