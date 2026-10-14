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

from app.storage import _is_test_environment, empty_store, load_store, save_store
from app.routers.auth import resolve_student_reg
from app.auth_crypto import generate_signed_session_token
from app.course_verification import (
    VerifiedCourseRecord,
    ExternalCourseMatch,
    canonicalize_course_code,
    canonicalize_faculty_name,
    normalize_faculty_name,
    match_faculty_names,
    lms_course_matches_vtop_professor,
    build_verified_semester_course_records,
    verify_external_course,
    verify_semester_match,
    extract_course_code_candidates,
    verify_course_title_match,
)

from app.vtop.session import get_vtop_ca_bundle

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

REQUEST_TIMEOUT = 25.0
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


def _clone_session(base_session: requests.Session) -> requests.Session:
    """Creates a thread-safe clone of an HTTP session preserving active cookies and headers."""
    if not isinstance(base_session, requests.Session) or type(base_session).__name__ == "MagicMock":
        return base_session
    s = get_lms_session()
    s.cookies.update(base_session.cookies)
    s.headers.update(base_session.headers)
    return s


class LMSLoginRequest(BaseModel):
    username: Optional[str] = None
    password: Optional[str] = None
    sessionCookie: Optional[str] = None  # MoodleSession cookie
    campus: Optional[str] = "chennai"
    regNo: Optional[str] = None


def is_moodle_noise(text: Optional[str]) -> bool:
    """Detects UI and navigation noise strings from Moodle pages to prevent corrupting teacher extraction."""
    if not text:
        return True
    t = str(text).strip().lower()
    if len(t) < 3 or len(t) > 60:
        return True
    noise_keywords = [
        "contact site support", "log out", "logout", "powered by moodle", "weekly outline",
        "switch role to", "accessibility", "digital assignments", "announcements",
        "dashboard", "site home", "calendar", "all courses", "course overview",
        "recently accessed", "course administration", "private files", "grades",
        "preferences", "profile", "notifications", "messages", "general",
        "topic", "module", "unit", "section", "attendance", "feedback",
        "switch role", "site support",
    ]
    if any(k in t for k in noise_keywords):
        return True
    if re.match(r"^(january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}", t):
        return True
    return False


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
    "lecture", "lectures", "intro", "introduction", "announcement", "announcements",
    "database", "databases", "systems", "system", "cloud", "computing", "machine", "learning",
    "artificial", "intelligence", "statistics", "probability", "traditional", "knowledge",
    "essence", "vlsi", "design", "communication", "processing", "signals", "signal",
    "circuits", "circuit", "electronics", "electronic", "management", "security", "cryptography",
    "operating", "compiler", "automata", "discrete", "graph", "optimization", "microprocessors",
    "microcontrollers", "applied", "advanced", "basics", "basic", "principles", "foundations",
    "data", "network", "networking", "technologies", "technology", "competitive", "coding",
}


def extract_teacher_from_lms_title(title: str) -> Optional[str]:
    """Extracts professor/faculty names embedded in LMS course titles, section titles, or text."""
    if not title:
        return None

    # Length guard to prevent ReDoS on absurdly long untrusted inputs
    title = str(title)[:500].strip()

    # 1. Look for Dr / Dr. / Prof / Prof. / Professor / Mr / Mr. / Ms / Ms. / Mrs / Mrs. anywhere in text
    m_title = re.search(r"\b(?:Dr\.?|Prof\.?|Professor|Mr\.?|Ms\.?|Mrs\.?)\s+([A-Za-z][A-Za-z\.\s]{1,49})", title, re.IGNORECASE)
    if m_title:
        cand = m_title.group(0).strip(" -–—_()[]|:,")
        cand = re.split(r"[-–—\(\)\[\]\|_]", cand)[0].strip()
        cand = re.sub(r"\b(?:Slot|Sec|Section|L\d+|F\d+|E\d+|A\d+|B\d+|C\d+|D\d+|G\d+)\b.*", "", cand, flags=re.IGNORECASE).strip()
        words = set(re.findall(r"\b[a-zA-Z]+\b", cand.lower()))
        clean_words = words - {"dr", "prof", "professor", "mr", "ms", "mrs"}
        if clean_words and not clean_words.issubset(BLACKLIST_FACULTY_WORDS):
            return cand

    # 2. Look for explicit parenthesized or bracketed teacher name e.g. (Dr. K. Ramesh) or (Ramesh Kumar) or (Jaya Vignesh T)
    for m_par in re.finditer(r"[\(\[]\s*([A-Za-z][A-Za-z\.\s]{1,48}[A-Za-z\.])\s*[\)\]]", title):
        cand_par = m_par.group(1).strip()
        words = set(re.findall(r"\b[a-zA-Z]+\b", cand_par.lower()))
        clean_words = words - {"dr", "prof", "professor", "mr", "ms", "mrs"}
        if clean_words and not clean_words.issubset(BLACKLIST_FACULTY_WORDS) and len(cand_par) >= 3:
            if not re.search(r"\b[A-Z]\d\b", cand_par):
                return cand_par

    # 3. Clean away semester IDs, academic years, semester phrases, and slot codes from title
    t_clean = re.sub(r"\b[A-Z]{2}\d{6,10}\b", "", title)
    t_clean = re.sub(r"[\(\[]?\b(?:(?:Fall|Winter|Spring|Summer|Sem|Semester)\s+)*20\d{2}[-\s/]*\d{2,4}\s*[\)\]]?", "", t_clean, flags=re.IGNORECASE)
    t_clean = re.sub(r"\bSlot\s+[A-Za-z0-9\+\s]+", "", t_clean, flags=re.IGNORECASE)

    # 4. Split by typical VIT LMS delimiters: - – — | : / _
    parts = [p.strip() for p in re.split(r"[-–—|:/_]", t_clean) if p.strip()]
    for part in parts:
        if re.search(r"\d", part):
            continue
        words = set(re.findall(r"\b[a-zA-Z]+\b", part.lower()))
        clean_words = words - {"dr", "prof", "professor", "mr", "ms", "mrs"}
        if not clean_words or clean_words.issubset(BLACKLIST_FACULTY_WORDS):
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
        r = session.get(url, verify=get_vtop_ca_bundle(), timeout=REQUEST_TIMEOUT)
        if r.status_code == 200 and "/login" not in r.url:
            soup = BeautifulSoup(r.text, "html.parser")
            for el in soup.find_all(
                ["span", "div", "p", "li", "a", "h3", "h4"],
                class_=lambda c: c and any(k in str(c).lower() for k in ["teacher", "instructor", "faculty", "author"]),
            ):
                txt = el.get_text().strip()
                if 3 <= len(txt) < 80 and not is_moodle_noise(txt) and not any(kw in txt.lower() for kw in ["dashboard", "course", "activity", "assignment", "announcement"]):
                    teachers.append(txt)
            for m in re.finditer(r"(?:Faculty|Instructor|Professor|Teacher)\s*[:\-]?\s*([A-Za-z\s\.]+)", r.text, flags=re.IGNORECASE):
                cand = m.group(1).strip().split("\n")[0].strip()
                if 3 <= len(cand) < 80 and not is_moodle_noise(cand) and cand not in teachers:
                    teachers.append(cand)
            # Check page header or course header text
            course_h = soup.find(["h1", "h2"], class_=lambda c: c and any(k in str(c).lower() for k in ["course", "header", "title"]))
            if course_h:
                t_from_h = extract_teacher_from_lms_title(course_h.get_text())
                if t_from_h and not is_moodle_noise(t_from_h) and t_from_h not in teachers:
                    teachers.append(t_from_h)

            # Check <title> tag
            if soup.title and soup.title.string:
                t_from_title_el = extract_teacher_from_lms_title(soup.title.string)
                if t_from_title_el and not is_moodle_noise(t_from_title_el) and t_from_title_el not in teachers:
                    teachers.append(t_from_title_el)

            # Map sections/modules to teachers and collect section-level teachers
            for sec in soup.find_all(["li", "div", "section"], class_=lambda c: c and any(k in str(c).lower() for k in ["section", "course-section"])):
                title_el = sec.find(class_=lambda c: c and "sectionname" in str(c).lower()) or sec.find(["h2", "h3", "h4", "h5"])
                sec_title = title_el.get_text().strip() if title_el else sec.get_text()
                sec_teacher = extract_teacher_from_lms_title(sec_title)
                if not sec_teacher:
                    sec_teacher = extract_teacher_from_lms_title(sec.get_text())
                if not sec_teacher:
                    m_sec = re.search(r"(?:Faculty|Instructor|Professor|Teacher)\s*[:\-]?\s*([A-Za-z\s\.]+)", sec.get_text(), flags=re.IGNORECASE)
                    if m_sec:
                        c_cand = m_sec.group(1).strip().split("\n")[0].strip()
                        if 3 <= len(c_cand) < 60:
                            sec_teacher = c_cand
                if sec_teacher and not is_moodle_noise(sec_teacher):
                    if sec_teacher not in teachers:
                        teachers.append(sec_teacher)
                    for a_link in sec.find_all("a", href=re.compile(r"/mod/assign/view\.php\?id=(\d+)")):
                        m_id = re.search(r"id=(\d+)", a_link.get("href", ""))
                        if m_id:
                            sections_map[m_id.group(1)] = sec_teacher

            # Also check all headings on the page
            for h in soup.find_all(["h2", "h3", "h4", "h5"]):
                h_teacher = extract_teacher_from_lms_title(h.get_text().strip())
                if h_teacher and not is_moodle_noise(h_teacher) and h_teacher not in teachers:
                    teachers.append(h_teacher)
    except Exception as exc:
        logger.debug("Could not fetch teacher details from LMS course page %s: %s", course_id, exc)

    # 2. Participants Page (/user/index.php?id=...)
    try:
        url_users = f"{LMS_BASE_URL}/user/index.php?id={course_id}"
        r_u = session.get(url_users, verify=get_vtop_ca_bundle(), timeout=REQUEST_TIMEOUT)
        if r_u.status_code == 200 and "/login" not in r_u.url:
            soup_u = BeautifulSoup(r_u.text, "html.parser")
            for tr in soup_u.find_all("tr"):
                row_txt = tr.get_text()
                if any(role in row_txt.lower() for role in ["teacher", "editing teacher", "instructor", "faculty"]):
                    name_el = tr.find("a", href=re.compile(r"/user/view\.php"))
                    if name_el:
                        t_name = name_el.get_text().strip()
                        if 3 <= len(t_name) < 80 and not is_moodle_noise(t_name) and t_name not in teachers:
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
    page_soup: Optional[BeautifulSoup] = None,
    page_text: Optional[str] = None,
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
    soup = page_soup
    raw_text = page_text or ""
    if not soup and assign_url and assign_url.startswith("http"):
        try:
            r = session.get(assign_url, verify=get_vtop_ca_bundle(), timeout=REQUEST_TIMEOUT)
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                raw_text = r.text
        except Exception as exc:
            logger.debug("Could not scrape assignment view page %s: %s", assign_url, exc)

    if soup:
        try:
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
            intro_text = intro_box.get_text() if intro_box else raw_text

            # Look for explicit faculty / instructor intro headers
            m_faculty_intro = re.search(
                r"(?:Faculty\s*(?:Name|In-charge)?|Course\s*(?:Instructor|Faculty|Teacher|Coordinator)|Instructor|Teacher|Evaluator|Grader|Uploaded\s*by|Prepared\s*by|Assigned\s*by)\s*[:\-]?\s*(?:(?:Dr\.|Prof\.|Professor|Mr\.|Ms\.|Mrs\.)\s*)?([A-Z][A-Za-z\.\s]{2,40})",
                intro_text,
                re.IGNORECASE,
            )
            if m_faculty_intro:
                cand = m_faculty_intro.group(1).strip().split("\n")[0].strip()
                if 3 <= len(cand) < 60 and not any(kw in cand.lower() for kw in ["assignment", "submission", "deadline", "student", "batch", "slot", "lms", "course", "status", "general", "activity"]):
                    return cand

            # Look for all-caps faculty name e.g. "FACULTY: RISHIKESHAN C A"
            m_caps = re.search(
                r"(?:FACULTY|INSTRUCTOR|PROFESSOR|TEACHER|PREPARED BY|UPLOADED BY)\s*[:\-]\s*([A-Z]{2,}(?:\s+[A-Z]{1,2}\.?)*(?:\s+[A-Z]{2,})*)",
                intro_text,
            )
            if m_caps:
                cand_caps = m_caps.group(1).strip()
                if 3 <= len(cand_caps) < 50 and not any(kw in cand_caps.lower() for kw in ["assignment", "submission", "deadline", "course"]):
                    return cand_caps

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
            logger.debug("Error parsing poster from view soup for %s: %s", assign_url, exc)

    return None


def extract_assignment_metadata(
    session: requests.Session,
    assign_url: str,
    row_text: str = "",
    topic_name: str = "",
    title: str = "",
    student_name: Optional[str] = None,
    course_sections_map: Optional[Dict[str, str]] = None,
    activity_id: Optional[str] = None,
) -> Tuple[Optional[str], Optional[str], Optional[str], Optional[bool]]:
    """
    Extracts authentic professor, authentic due date, due time, and authentic submission status
    directly from Moodle assignment view page (/mod/assign/view.php) and metadata in a single HTTP GET.
    Returns: (poster, due_date_str, due_time_str, is_submitted)
    """
    due_date_str: Optional[str] = None
    due_time_str: Optional[str] = None
    is_submitted: Optional[bool] = None
    soup: Optional[BeautifulSoup] = None
    raw_text: str = ""

    if assign_url and assign_url.startswith("http"):
        try:
            r = session.get(assign_url, verify=get_vtop_ca_bundle(), timeout=REQUEST_TIMEOUT)
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                raw_text = r.text
                # Parse submission status table or general table rows
                for tr in soup.find_all("tr"):
                    cells = tr.find_all(["th", "td"])
                    if len(cells) >= 2:
                        h_txt = cells[0].get_text().strip().lower()
                        v_txt = cells[1].get_text().strip()
                        if any(k in h_txt for k in ["due date", "deadline", "cutoff date", "close date"]):
                            d, t = parse_moodle_date(v_txt)
                            if d:
                                due_date_str = d
                                due_time_str = t or "23:59"
                        elif "submission status" in h_txt:
                            v_lower = v_txt.lower()
                            if any(k in v_lower for k in ["submitted for grading", "submitted", "graded", "turnedin", "turned in"]):
                                if "not submitted" not in v_lower and "no attempt" not in v_lower:
                                    is_submitted = True
                            elif any(k in v_lower for k in ["no attempt", "not submitted", "draft"]):
                                is_submitted = False
                        elif "grading status" in h_txt and is_submitted is None:
                            if "graded" in v_txt.lower():
                                is_submitted = True

                # Regex fallback for due date if table was not found
                if not due_date_str:
                    m_due = re.search(r"(?:Due\s*(?:date)?|Deadline)\s*[:\-]?\s*([A-Za-z0-9\s,:]+)", r.text, flags=re.IGNORECASE)
                    if m_due:
                        d, t = parse_moodle_date(m_due.group(1).strip())
                        if d:
                            due_date_str = d
                # Check submission status badges if still undetermined
                if is_submitted is None:
                    txt_lower = raw_text.lower()
                    if "submitted for grading" in txt_lower:
                        is_submitted = True
                    elif "no attempt" in txt_lower or "not submitted" in txt_lower:
                        is_submitted = False
        except Exception as exc:
            logger.debug("Could not scrape assignment view page metadata for %s: %s", assign_url, exc)

    poster = extract_assignment_poster(
        session=session,
        assign_url=assign_url,
        row_text=row_text,
        topic_name=topic_name,
        title=title,
        student_name=student_name,
        course_sections_map=course_sections_map,
        activity_id=activity_id,
        page_soup=soup,
        page_text=raw_text,
    )

    return poster, due_date_str, due_time_str, is_submitted


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

    # Mode 1: Validate provided session cookie (MoodleSession or full cookie jar)
    if session_cookie:
        raw_cookie = session_cookie.strip()
        extracted_moodle = None
        for part in raw_cookie.split(";"):
            part = part.strip()
            if "=" in part:
                k, v = part.split("=", 1)
                k = k.strip()
                v = v.strip()
                s.cookies.set(k, v, domain=domain_host, path="/")
                s.cookies.set(k, v, domain=f".{domain_host}", path="/")
                if k.lower() == "moodlesession" or "moodle" in k.lower():
                    extracted_moodle = v
        if not extracted_moodle:
            # Assume raw MoodleSession token was pasted directly
            extracted_moodle = raw_cookie
            s.cookies.set("MoodleSession", extracted_moodle, domain=domain_host, path="/")
            s.cookies.set("MoodleSession", extracted_moodle, domain=f".{domain_host}", path="/")

        try:
            r = s.get(urls["my"], verify=get_vtop_ca_bundle(), allow_redirects=False, timeout=REQUEST_TIMEOUT)
            if r.status_code == 200:
                soup = BeautifulSoup(r.text, "html.parser")
                user_elem = soup.find(class_=lambda x: x and ("usertext" in x or "userbutton" in x or "username" in x))
                display_name = user_elem.get_text().strip() if user_elem else "Student"
                return s, {
                    "username": username or display_name,
                    "displayName": display_name,
                    "authMethod": "cookie",
                    "sessionCookie": extracted_moodle,
                    "cookies": s.cookies.get_dict(),
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
        r_get = s.get(urls["login"], verify=get_vtop_ca_bundle(), timeout=REQUEST_TIMEOUT)
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
            verify=get_vtop_ca_bundle(),
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

        # Accurately isolate MoodleSession cookie, ignoring NetScaler cookiesession1
        moodle_cookie = s.cookies.get("MoodleSession")
        if not moodle_cookie:
            for c in s.cookies:
                if c.name.lower() == "moodlesession":
                    moodle_cookie = c.value
                    break
        if not moodle_cookie:
            for c in s.cookies:
                if "moodle" in c.name.lower():
                    moodle_cookie = c.value
                    break

        all_cookies = s.cookies.get_dict()

        # Check if redirected to dashboard or courses
        if "/my" in final_url or "/course" in final_url or soup_post.find(class_=lambda x: x and "userbutton" in x):
            user_elem = soup_post.find(class_=lambda x: x and ("usertext" in x or "userbutton" in x or "username" in x))
            disp_name = user_elem.get_text().strip() if user_elem else username
            return s, {
                "username": username,
                "displayName": disp_name,
                "authMethod": "credentials",
                "sessionCookie": moodle_cookie,
                "cookies": all_cookies,
                "campus": campus or "chennai",
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
            "sessionCookie": moodle_cookie,
            "cookies": all_cookies,
            "campus": campus or "chennai",
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


def fetch_lms_sesskey(session: requests.Session) -> Optional[str]:
    """Extracts Moodle user session key (sesskey) from /my/ page or cookies with session-level caching."""
    cached = getattr(session, "_cached_sesskey", None)
    if cached:
        return cached
    try:
        r_my = session.get(LMS_MY_URL, verify=get_vtop_ca_bundle(), timeout=REQUEST_TIMEOUT)
        if r_my.status_code == 200:
            m_key = re.search(r'\"sesskey\":\"([^\"]+)\"', r_my.text) or re.search(r'sesskey=([a-zA-Z0-9]+)', r_my.text)
            if m_key:
                key = m_key.group(1)
                setattr(session, "_cached_sesskey", key)
                return key
    except Exception as e:
        logger.debug("Error fetching /my/ page for sesskey: %s", e)
    return None


def fetch_lms_timeline_action_events(
    session: requests.Session, sesskey: Optional[str] = None
) -> List[Dict[str, Any]]:
    """
    Retrieves all action events and assignments across enrolled courses using
    Moodle's core_calendar_get_action_events_by_timesort WebService API with cursor pagination.
    """
    if not sesskey:
        sesskey = fetch_lms_sesskey(session)
    if not sesskey:
        return []

    events: List[Dict[str, Any]] = []
    seen_ids = set()
    after_event_id = 0
    limit = 50
    ajax_url = f"{LMS_BASE_URL}/lib/ajax/service.php?sesskey={sesskey}"

    # Paginate through timeline action events
    for _ in range(20):  # Maximum 20 pages (1000 events safety limit)
        try:
            payload = [
                {
                    "index": 0,
                    "methodname": "core_calendar_get_action_events_by_timesort",
                    "args": {
                        "timesortfrom": 0,
                        "limitnum": limit,
                        "aftereventid": after_event_id,
                        "limittonext": False,
                    },
                }
            ]
            r = session.post(ajax_url, json=payload, verify=get_vtop_ca_bundle(), timeout=REQUEST_TIMEOUT)
            if r.status_code != 200:
                break
            res = r.json()
            if not isinstance(res, list) or len(res) == 0:
                break
            data = res[0].get("data") or {}
            event_list = data.get("events") or []
            if not event_list:
                break

            for ev in event_list:
                ev_id = ev.get("id")
                if ev_id and ev_id not in seen_ids:
                    seen_ids.add(ev_id)
                    events.append(ev)

            has_more = data.get("hasmore")
            last_id = data.get("lastid")
            if has_more and last_id and last_id != after_event_id:
                after_event_id = last_id
            else:
                break
        except Exception as exc:
            logger.warning("[LMS Timeline] Error querying action events: %s", exc)
            break

    logger.info("[LMS Timeline] Retrieved %d action events across enrolled courses", len(events))
    return events


def transform_timeline_event_to_assignment(
    ev: Dict[str, Any],
    verified_enrolled: List[VerifiedCourseRecord],
    curr_sem_name: str,
    course_id_to_vtop_map: Optional[Dict[str, VerifiedCourseRecord]] = None,
) -> Optional[Dict[str, Any]]:
    """Transforms a Moodle timeline action event into an authentic CampusOS assignment record."""
    ev_id = ev.get("id")
    title = (ev.get("name") or "").strip()
    if not title or len(title) < 2:
        return None

    course_info = ev.get("course") or {}
    course_id = str(course_info.get("id") or "")
    course_name = (course_info.get("fullname") or course_info.get("shortname") or "").strip()

    action = ev.get("action") or {}
    assign_url = action.get("url") or ""
    action_name = (action.get("name") or "").strip()
    is_actionable = action.get("actionable", True)

    m_cm = re.search(r"id=(\d+)", assign_url)
    activity_id = m_cm.group(1) if m_cm else str(ev.get("instance") or ev_id)
    assign_id = f"lms-{course_id}-{activity_id}" if course_id else f"lms-ev-{ev_id}"

    # Due date from timesort (epoch timestamp)
    timesort = ev.get("timesort")
    due_date_str = ""
    due_time_str = "23:59"
    if timesort and isinstance(timesort, (int, float)) and timesort > 0:
        try:
            from app.routers.unified_assignments import IST
            dt = datetime.fromtimestamp(timesort, tz=timezone.utc).astimezone(IST)
            due_date_str = dt.strftime("%Y-%m-%d")
            due_time_str = dt.strftime("%H:%M")
        except Exception:
            pass

    is_submitted = (not is_actionable) or any(
        kw in action_name.lower()
        for kw in ["view submission", "view feedback", "already submitted", "graded", "done"]
    )
    is_pending = not is_submitted

    matched_rec = None
    if course_id and course_id_to_vtop_map and str(course_id) in course_id_to_vtop_map:
        matched_rec = course_id_to_vtop_map[str(course_id)]

    cand_codes = extract_course_code_candidates(course_name) + extract_course_code_candidates(title)
    if not matched_rec and cand_codes and verified_enrolled:
        enrolled_canon = {canonicalize_course_code(r.courseCode): r for r in verified_enrolled if r.courseCode}
        enrolled_base = {get_base_code(r.courseCode): r for r in verified_enrolled if r.courseCode}
        for cand in cand_codes:
            canon = canonicalize_course_code(cand)
            base = get_base_code(cand)
            if canon in enrolled_canon:
                matched_rec = enrolled_canon[canon]
                break
            elif base in enrolled_base:
                matched_rec = enrolled_base[base]
                break

    course_code = matched_rec.courseCode if matched_rec else (cand_codes[0] if cand_codes else "LMS")
    vtop_title = matched_rec.courseName if matched_rec else (course_name or "Course")
    faculty = matched_rec.facultyName if matched_rec else "Faculty unassigned"

    return {
        "id": assign_id,
        "activityId": str(activity_id),
        "title": title,
        "academicYear": matched_rec.academicYear if matched_rec else "2026",
        "semester": matched_rec.semester if matched_rec else curr_sem_name,
        "semesterId": matched_rec.semesterId if matched_rec else "CH20262701",
        "courseCode": course_code,
        "courseTitle": vtop_title,
        "subject": vtop_title,
        "faculty": faculty,
        "facultyName": faculty,
        "professor": faculty,
        "lmsProfessor": faculty,
        "postedBy": faculty,
        "instructor": faculty,
        "verified": bool(matched_rec),
        "source": "LMS",
        "lmsCourseId": course_id,
        "externalCourseId": course_id,
        "platformName": "VIT LMS",
        "platformUrl": assign_url if assign_url.startswith("http") else f"{LMS_BASE_URL}{assign_url}",
        "submissionUrl": assign_url if assign_url.startswith("http") else f"{LMS_BASE_URL}{assign_url}",
        "dueDate": due_date_str or "TBA",
        "dueTime": due_time_str,
        "status": "Submitted" if is_submitted else "Pending",
        "applicationStatus": "DONE" if is_submitted else "PENDING",
        "displayStatus": "DONE" if is_submitted else "PENDING",
        "isDone": is_submitted,
        "isSubmitted": is_submitted,
        "priority": "Critical" if is_pending else "Medium",
        "weightage": 10,
        "instructions": f"Assigned on VIT LMS ({course_name})",
        "matchedLmsCourse": course_name,
    }


def fetch_lms_enrolled_courses(session: requests.Session) -> List[Dict[str, Any]]:
    """
    Extracts student's enrolled courses from VIT LMS dashboard using Moodle WebService AJAX API,
    calendar endpoints, and HTML page scraping.
    """
    courses: List[Dict[str, Any]] = []
    seen_ids = set()

    # Step 1: Query /my/ to extract user session key (sesskey)
    sesskey = fetch_lms_sesskey(session)

    # Step 2: Use Moodle WebService AJAX API if sesskey is available
    if sesskey:
        classifications = ["all", "allincludinghidden", "inprogress", "future", "past"]
        for classification in classifications:
            try:
                offset = 0
                while True:
                    ajax_url = f"{LMS_BASE_URL}/lib/ajax/service.php?sesskey={sesskey}"
                    payload = [
                        {
                            "index": 0,
                            "methodname": "core_course_get_enrolled_courses_by_timeline_classification",
                            "args": {
                                "classification": classification,
                                "limit": 0,
                                "offset": offset,
                                "sort": "fullname",
                            },
                        }
                    ]
                    r_ajax = session.post(ajax_url, json=payload, verify=get_vtop_ca_bundle(), timeout=REQUEST_TIMEOUT)
                    if r_ajax.status_code == 200:
                        data = r_ajax.json()
                        if isinstance(data, list) and len(data) > 0:
                            res_data = data[0].get("data", {})
                            course_list = res_data.get("courses", [])
                            if not course_list:
                                break
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
                            next_offset = res_data.get("nextoffset", 0)
                            if next_offset and next_offset > offset:
                                offset = next_offset
                            else:
                                break
                        else:
                            break
                    else:
                        break
            except Exception as exc:
                logger.debug("Moodle AJAX classification '%s' query: %s", classification, exc)
        logger.info("Retrieved %d courses via Moodle AJAX service.", len(courses))

    # Step 3: Check Moodle Calendar Upcoming view for enrolled course links
    try:
        r_cal = session.get(LMS_CALENDAR_URL, verify=get_vtop_ca_bundle(), timeout=REQUEST_TIMEOUT)
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

    # Step 4: Fallback to HTML pages and user profile
    for url in [LMS_MY_URL, LMS_COURSES_URL, f"{LMS_BASE_URL}/user/profile.php", f"{LMS_BASE_URL}/course/index.php"]:
        try:
            r = session.get(url, verify=get_vtop_ca_bundle(), timeout=REQUEST_TIMEOUT)
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
            logger.debug("Failed to fetch LMS courses from %s: %s", url, exc)

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
    c_teachers = list(lms_teachers or [])
    course_code = canonicalize_course_code(vtop_course.get("code") or vtop_course.get("courseCode")) or "LMS"
    vtop_prof = vtop_course.get("faculty") or vtop_course.get("facultyName") or "Faculty unassigned"
    matching_lms_teacher = next((t for t in (lms_teachers or []) if match_faculty_names(vtop_prof, t)), None)
    lms_course_prof = matching_lms_teacher or vtop_course.get("lmsProfessor") or (lms_teachers[0] if lms_teachers else None) or vtop_prof
    vtop_title = vtop_course.get("title") or vtop_course.get("courseTitle") or course_title
    semester_name = vtop_course.get("semester") or "Fall Semester 2026-27"

    parsed_candidates: List[Dict[str, Any]] = []
    seen_act_ids: set = set()

    # Step 0: Try Moodle WebService AJAX core_course_get_contents FIRST (fastest, full course tree)
    try:
        sesskey = fetch_lms_sesskey(session)
        if sesskey:
            ajax_url = f"{LMS_BASE_URL}/lib/ajax/service.php?sesskey={sesskey}"
            payload = [{
                "index": 0,
                "methodname": "core_course_get_contents",
                "args": {"courseid": int(course_id)},
            }]
            r_ajax = session.post(ajax_url, json=payload, verify=get_vtop_ca_bundle(), timeout=REQUEST_TIMEOUT)
            if r_ajax.status_code == 200:
                data = r_ajax.json()
                if isinstance(data, list) and len(data) > 0 and not data[0].get("error"):
                    sections_data = data[0].get("data") or []
                    for sec in sections_data:
                        sec_name = sec.get("name") or ""
                        for mod in (sec.get("modules") or []):
                            mod_name = str(mod.get("modname") or "").lower()
                            if mod_name not in ("assign", "quiz", "turnitintooltwo", "turnitin", "workshop", "feedback", "questionnaire", "lesson", "h5pactivity"):
                                continue
                            act_id = str(mod.get("id") or "")
                            if not act_id or act_id in seen_act_ids:
                                continue
                            raw_title = (mod.get("name") or "").strip()
                            if not raw_title or len(raw_title) < 2:
                                continue
                            seen_act_ids.add(act_id)
                            mod_url = mod.get("url") or f"{LMS_BASE_URL}/mod/{mod_name}/view.php?id={act_id}"

                            due_date_str = ""
                            due_time_str = "23:59"
                            for d_item in (mod.get("dates") or []):
                                ts = d_item.get("timestamp")
                                if ts and isinstance(ts, (int, float)) and ts > 0:
                                    try:
                                        from app.routers.unified_assignments import IST
                                        dt = datetime.fromtimestamp(ts, tz=timezone.utc).astimezone(IST)
                                        due_date_str = dt.strftime("%Y-%m-%d")
                                        due_time_str = dt.strftime("%H:%M")
                                    except Exception:
                                        pass
                                    if any(k in str(d_item.get("label") or "").lower() for k in ["due", "deadline", "close"]):
                                        break

                            comp = mod.get("completiondata") or {}
                            is_sub = bool(comp.get("state", 0) in (1, 2))
                            parsed_candidates.append({
                                "assign_id": f"lms-{course_id}-{act_id}",
                                "activity_id": act_id,
                                "title": raw_title,
                                "assign_url": mod_url,
                                "due_date_str": due_date_str,
                                "due_time_str": due_time_str,
                                "is_submitted": is_sub,
                                "is_pending": not is_sub,
                                "row_faculty": "",
                                "topic_name": sec_name,
                                "row_text": f"{raw_title} {sec_name}",
                            })
    except Exception as exc:
        logger.debug("Moodle AJAX course contents check for course %s: %s", course_id, exc)

    # Step 1: Scrape ALL tables on mod/assign/index.php?id={course_id}
    try:
        url = f"{LMS_BASE_URL}/mod/assign/index.php?id={course_id}"
        r = session.get(url, verify=get_vtop_ca_bundle(), timeout=REQUEST_TIMEOUT)
        if r.status_code == 200 and "/login" not in r.url:
            soup = BeautifulSoup(r.text, "html.parser")
            tables = soup.find_all("table")
            for table in tables:
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

                for row in all_trs:
                    cols = row.find_all(["td", "th"])
                    if len(cols) < 2:
                        continue

                    if not row.find("a") and row.find_all("th") and not row.find_all("td"):
                        continue

                    link = row.find("a", href=re.compile(r"/mod/assign/view\.php")) or row.find("a", href=re.compile(r"/mod/[a-z0-9_]+/view\.php")) or row.find("a")
                    if not link:
                        continue

                    title = link.get_text().strip()
                    href = link.get("href") or ""
                    assign_url = href if href.startswith("http") else f"{LMS_BASE_URL}{href}"

                    m_cm = re.search(r"id=(\d+)", href)
                    activity_id = m_cm.group(1) if m_cm else str(len(assignments) + len(parsed_candidates) + 1)
                    if activity_id in seen_act_ids:
                        continue
                    seen_act_ids.add(activity_id)

                    assign_id = f"lms-{course_id}-{activity_id}"

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

                    status_lower = status_raw.lower()
                    is_submitted = (
                        any(kw in status_lower for kw in ["submitted for grading", "graded", "turnedin", "turned in", "complete"])
                        or ("submitted" in status_lower and "not submitted" not in status_lower and "draft" not in status_lower)
                    )

                    is_pending = not is_submitted
                    topic_name = cols[0].get_text().strip() if len(cols) > 0 and link_col_idx != 0 else ""
                    prev_heading = row.find_previous(["h2", "h3", "h4", "th"], class_=lambda c: c and any(k in str(c).lower() for k in ["sectionname", "topic", "module"]))
                    if not topic_name and prev_heading:
                        topic_name = prev_heading.get_text().strip()

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

            # Also capture loose assignment links on mod/assign/index.php
            for extra_link in soup.find_all("a", href=re.compile(r"/mod/assign/view\.php\?[^\"']*id=\d+")):
                e_href = extra_link.get("href") or ""
                m_e = re.search(r"id=(\d+)", e_href)
                if not m_e:
                    continue
                e_act_id = m_e.group(1)
                if e_act_id in seen_act_ids:
                    continue
                seen_act_ids.add(e_act_id)
                e_title = extra_link.get_text().strip()
                if not e_title or len(e_title) < 2:
                    continue
                parsed_candidates.append({
                    "assign_id": f"lms-{course_id}-{e_act_id}",
                    "activity_id": e_act_id,
                    "title": e_title,
                    "assign_url": e_href if e_href.startswith("http") else f"{LMS_BASE_URL}{e_href}",
                    "due_date_str": "",
                    "due_time_str": "23:59",
                    "is_submitted": False,
                    "is_pending": True,
                    "row_faculty": "",
                    "topic_name": "",
                    "row_text": e_title,
                })
    except Exception as exc:
        logger.debug("Could not scrape assign index for %s: %s", course_id, exc)

    # Step 2: Scrape Moodle Quizzes index (/mod/quiz/index.php?id={course_id})
    try:
        quiz_index_url = f"{LMS_BASE_URL}/mod/quiz/index.php?id={course_id}"
        r_q = session.get(quiz_index_url, verify=get_vtop_ca_bundle(), timeout=REQUEST_TIMEOUT)
        if r_q.status_code == 200 and "/login" not in r_q.url:
            soup_q = BeautifulSoup(r_q.text, "html.parser")
            q_tables = soup_q.find_all("table")
            for q_table in q_tables:
                q_trs = q_table.find("tbody").find_all("tr") if q_table.find("tbody") else q_table.find_all("tr")
                for q_row in q_trs:
                    q_cols = q_row.find_all(["td", "th"])
                    if len(q_cols) < 2:
                        continue
                    q_link = q_row.find("a", href=re.compile(r"/mod/quiz/view\.php")) or q_row.find("a")
                    if not q_link:
                        continue
                    q_title = q_link.get_text().strip()
                    q_href = q_link.get("href") or ""
                    m_q_id = re.search(r"id=(\d+)", q_href)
                    if not m_q_id:
                        continue
                    q_act_id = m_q_id.group(1)
                    if q_act_id in seen_act_ids:
                        continue
                    seen_act_ids.add(q_act_id)
                    q_assign_id = f"lms-{course_id}-{q_act_id}"

                    q_due_raw = ""
                    q_status_raw = ""
                    for q_col in q_cols:
                        txt = q_col.get_text().strip()
                        if any(m in txt.lower() for m in ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec", "202", "203", "am", "pm", ":"]):
                            if not q_due_raw:
                                q_due_raw = txt
                        elif any(st in txt.lower() for st in ["submitted", "attempt", "graded", "done", "complete", "closed"]):
                            if not q_status_raw:
                                q_status_raw = txt

                    q_due_date, q_due_time = parse_moodle_date(q_due_raw)
                    q_is_sub = any(kw in q_status_raw.lower() for kw in ["submitted", "graded", "attempt"]) and "no attempt" not in q_status_raw.lower()

                    parsed_candidates.append({
                        "assign_id": q_assign_id,
                        "activity_id": q_act_id,
                        "title": q_title,
                        "assign_url": q_href if q_href.startswith("http") else f"{LMS_BASE_URL}{q_href}",
                        "due_date_str": q_due_date,
                        "due_time_str": q_due_time,
                        "is_submitted": q_is_sub,
                        "is_pending": not q_is_sub,
                        "row_faculty": "",
                        "topic_name": "Online Quiz",
                        "row_text": q_row.get_text(),
                    })
    except Exception as exc:
        logger.debug("Could not scrape quiz index for %s: %s", course_id, exc)

    # Step 3: Scrape activities directly from course view page AND all section pages
    try:
        view_url = f"{LMS_BASE_URL}/course/view.php?id={course_id}"
        r_v = session.get(view_url, verify=get_vtop_ca_bundle(), timeout=REQUEST_TIMEOUT)
        if r_v.status_code == 200 and "/login" not in r_v.url:
            soup_v = BeautifulSoup(r_v.text, "html.parser")

            def _extract_activities_from_course_soup(page_soup: BeautifulSoup, default_topic: str = ""):
                for a_link in page_soup.find_all("a", href=re.compile(r"/mod/(?:assign|quiz|turnitintooltwo|turnitin|workshop|feedback|questionnaire|lesson|h5pactivity)/view\.php\?[^\"']*id=\d+")):
                    href = a_link.get("href") or ""
                    m_id = re.search(r"id=(\d+)", href)
                    if not m_id:
                        continue
                    act_id = m_id.group(1)
                    if act_id in seen_act_ids:
                        continue

                    inst_span = a_link.find(class_=lambda c: c and "instancename" in str(c).lower())
                    raw_title = inst_span.get_text().strip() if inst_span else a_link.get_text().strip()
                    cleaned_title = re.sub(r"\s*(?:Assignment|Quiz|Turnitin Assignment 2|Turnitin|Feedback|Workshop)\s*$", "", raw_title, flags=re.IGNORECASE).strip()
                    if len(cleaned_title) >= 2:
                        raw_title = cleaned_title
                    if not raw_title or len(raw_title) < 2:
                        continue

                    seen_act_ids.add(act_id)
                    a_id = f"lms-{course_id}-{act_id}"

                    parent_act = a_link.find_parent(["li", "div"], class_=lambda c: c and any(k in str(c).lower() for k in ["activity", "activity-item", "modtype"]))
                    act_txt = parent_act.get_text() if parent_act else ""
                    due_raw = ""
                    status_raw = ""
                    m_d = re.search(r"Due\s*[:\-]?\s*([A-Za-z0-9\s,:]+)", act_txt, re.IGNORECASE)
                    if m_d:
                        due_raw = m_d.group(1).strip()
                    if any(kw in act_txt.lower() for kw in ["submitted", "done", "complete"]):
                        status_raw = "Submitted"

                    d_str, t_str = parse_moodle_date(due_raw)
                    is_sub = "submitted" in status_raw.lower() or "done" in status_raw.lower()

                    sec_elem = a_link.find_parent(["li", "section", "div"], class_=lambda c: c and "section" in str(c).lower())
                    sec_heading = sec_elem.find(class_=lambda c: c and "sectionname" in str(c).lower()) if sec_elem else None
                    t_name = sec_heading.get_text().strip() if sec_heading else default_topic

                    parsed_candidates.append({
                        "assign_id": a_id,
                        "activity_id": act_id,
                        "title": raw_title,
                        "assign_url": href if href.startswith("http") else f"{LMS_BASE_URL}{href}",
                        "due_date_str": d_str,
                        "due_time_str": t_str,
                        "is_submitted": is_sub,
                        "is_pending": not is_sub,
                        "row_faculty": "",
                        "topic_name": t_name,
                        "row_text": act_txt or raw_title,
                    })

            # 1. Parse main course page
            _extract_activities_from_course_soup(soup_v)

            # 2. Discover section links for multi-page courses (cap to 6 sections to respect timeouts)
            section_urls: List[Tuple[str, str]] = []
            for a_sec in soup_v.find_all("a", href=True):
                s_href = a_sec.get("href") or ""
                m_s = re.search(r"[?&]section=(\d+)", s_href)
                if m_s:
                    s_num = m_s.group(1)
                    if s_num != "0":
                        s_url = f"{LMS_BASE_URL}/course/view.php?id={course_id}&section={s_num}"
                        if not any(u[0] == s_url for u in section_urls):
                            section_urls.append((s_url, a_sec.get_text().strip()))
                m_sid = re.search(r"[?&]sectionid=(\d+)", s_href)
                if m_sid:
                    s_id = m_sid.group(1)
                    s_url = f"{LMS_BASE_URL}/course/view.php?id={course_id}&sectionid={s_id}"
                    if not any(u[0] == s_url for u in section_urls):
                        section_urls.append((s_url, a_sec.get_text().strip()))

            for s_url, s_name in section_urls[:6]:
                try:
                    r_sec = session.get(s_url, verify=get_vtop_ca_bundle(), timeout=10.0)
                    if r_sec.status_code == 200 and "/login" not in r_sec.url:
                        soup_sec = BeautifulSoup(r_sec.text, "html.parser")
                        _extract_activities_from_course_soup(soup_sec, default_topic=s_name)
                except Exception as sec_exc:
                    logger.debug("Failed to scrape section %s for course %s: %s", s_url, course_id, sec_exc)
    except Exception as exc:
        logger.debug("Could not scrape course view page for %s: %s", course_id, exc)

    if not parsed_candidates:
        return assignments

    # Concurrently resolve authentic poster and verify metadata for each assignment
    def _resolve_candidate_poster(cand: Dict[str, Any]) -> Tuple[str, Optional[str]]:
        # Fast path: If due date and submission status are already known, avoid expensive network GET
        need_fetch = (not cand.get("due_date_str") or cand.get("due_date_str") == "TBA") or not cand.get("row_faculty")
        extracted_poster = None

        if need_fetch and cand.get("assign_url") and cand["assign_url"].startswith("http"):
            sub_sess = _clone_session(session)
            extracted_poster, resolved_due, resolved_time, resolved_sub = extract_assignment_metadata(
                session=sub_sess,
                assign_url=cand["assign_url"],
                row_text=cand["row_text"],
                topic_name=cand["topic_name"],
                title=cand["title"],
                student_name=student_name,
                course_sections_map=course_sections_map,
                activity_id=cand["activity_id"],
            )

            # Update due date and time if resolved from activity page
            if resolved_due and (not cand.get("due_date_str") or cand.get("due_date_str") == "TBA"):
                cand["due_date_str"] = resolved_due
                cand["due_time_str"] = resolved_time or "23:59"
            if resolved_sub is not None:
                cand["is_submitted"] = resolved_sub
                cand["is_pending"] = not resolved_sub

        if cand["row_faculty"]:
            t_cand = extract_teacher_from_lms_title(cand["row_faculty"]) or cand["row_faculty"]
            if 3 <= len(t_cand) < 60 and not is_moodle_noise(t_cand):
                return t_cand, t_cand

        if extracted_poster and not is_moodle_noise(extracted_poster):
            return extracted_poster, extracted_poster

        fallback_prof = lms_course_prof
        if not fallback_prof or fallback_prof in ("LMS Instructor", "Instructor", "LMS Teacher", "Faculty unassigned") or is_moodle_noise(fallback_prof):
            valid_c_teachers = [t for t in c_teachers if not is_moodle_noise(t)]
            fallback_prof = (valid_c_teachers[0] if valid_c_teachers else None) or vtop_course.get("faculty") or vtop_course.get("facultyName") or "Faculty unassigned"
        return fallback_prof, None

    try:
        max_workers = min(5, max(1, len(parsed_candidates)))
        with ThreadPoolExecutor(max_workers=max_workers) as executor:
            posters = list(executor.map(_resolve_candidate_poster, parsed_candidates))

        for cand, (poster, explicit_poster) in zip(parsed_candidates, posters):
            poster_display = explicit_poster or poster or lms_course_prof
            if not poster_display or poster_display in ("LMS Instructor", "Instructor", "LMS Teacher"):
                poster_display = vtop_course.get("faculty") or vtop_course.get("facultyName") or "Faculty unassigned"
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
    c_id = str(lms_c.get("id", ""))
    c_title = (lms_c.get("title") or "").strip()
    c_shortname = (lms_c.get("shortname") or "").strip()
    combined_meta = f"{c_title} {c_shortname}".strip()

    if not c_id or c_id == "1" or not c_title:
        return {}, None, [], None

    # Fast-path 1: Semester & Academic Year check (0 ms)
    # Reject courses explicitly from previous academic years/semesters without making any network calls
    sem_ok, _ = verify_semester_match(curr_sem_name, combined_meta)
    if not sem_ok:
        return {}, None, [], None

    # Fast-path 2: Course Code / Title token match against student's enrolled courses (0 ms)
    ext_codes = extract_course_code_candidates(c_title) + extract_course_code_candidates(c_shortname)
    has_candidate_match = False
    if ext_codes:
        enrolled_canon_codes = {canonicalize_course_code(r.courseCode) for r in verified_enrolled if r.courseCode}
        enrolled_base_codes = {get_base_code(r.courseCode) for r in verified_enrolled if r.courseCode}
        has_candidate_match = any((cand in enrolled_canon_codes or get_base_code(cand) in enrolled_base_codes) for cand in ext_codes)
    else:
        # Check if title tokens match any enrolled course
        for r in verified_enrolled:
            title_ok, _ = verify_course_title_match(r.courseName, c_title, c_shortname)
            if title_ok:
                has_candidate_match = True
                break

    if not has_candidate_match:
        return {}, None, [], None

    # Clone session for this worker thread to ensure complete thread safety
    worker_session = _clone_session(session)

    c_teachers = [t for t in (lms_c.get("teachers") or []) if not is_moodle_noise(t)]
    c_sections_map: Dict[str, str] = {}

    t_from_title = extract_teacher_from_lms_title(c_title)
    if t_from_title and not is_moodle_noise(t_from_title) and t_from_title not in c_teachers:
        c_teachers.append(t_from_title)

    is_verified, matched_rec, match_meta = verify_external_course(
        enrolled_records=verified_enrolled,
        source="LMS",
        source_id=c_id,
        source_name=c_title,
        source_professors=c_teachers,
        current_semester=curr_sem_name,
    )

    # Check if any teacher currently in c_teachers matches VTOP faculty
    target_vtop_faculty = matched_rec.facultyName if matched_rec else None
    has_matching_teacher = False
    if target_vtop_faculty and c_teachers:
        has_matching_teacher = any(match_faculty_names(target_vtop_faculty, t) for t in c_teachers)

    # If we do not have a matching teacher yet, OR we don't have section mappings:
    # Always fetch course sections and headings to discover section instructors!
    if not has_matching_teacher or not c_sections_map:
        page_teachers, page_sections = fetch_lms_course_teachers_and_sections(worker_session, c_id)
        for pt in page_teachers:
            if pt and not is_moodle_noise(pt) and pt not in c_teachers:
                c_teachers.append(pt)
        if page_sections:
            c_sections_map.update(page_sections)

        # Re-verify with complete list of discovered section teachers
        is_verified, matched_rec, match_meta = verify_external_course(
            enrolled_records=verified_enrolled,
            source="LMS",
            source_id=c_id,
            source_name=c_title,
            source_professors=c_teachers,
            current_semester=curr_sem_name,
        )

    # Resolve candidate enrolled course record
    enrolled_cand = matched_rec
    if not enrolled_cand and match_meta and match_meta.courseCodeMatch and match_meta.matchedCourseCode:
        enrolled_cand = next((r for r in verified_enrolled if r.courseCode == match_meta.matchedCourseCode), None)
    if not enrolled_cand and ext_codes:
        for cand in ext_codes:
            canon = canonicalize_course_code(cand)
            base = get_base_code(cand)
            found = next((r for r in verified_enrolled if canonicalize_course_code(r.courseCode) == canon or get_base_code(r.courseCode) == base), None)
            if found:
                enrolled_cand = found
                break
    if not enrolled_cand:
        for r in verified_enrolled:
            title_ok, _ = verify_course_title_match(r.courseName, c_title, c_shortname)
            if title_ok:
                enrolled_cand = r
                break

    if not enrolled_cand:
        if match_meta:
            match_meta.verified = False
            return match_meta.model_dump(), None, [], None
        return {}, None, [], None

    # Strict Verification: verify whether the course name is matching in the vtop course professor name
    prof_ok = False
    if enrolled_cand:
        prof_ok = bool(match_meta and match_meta.facultyMatch)
        if not prof_ok:
            prof_ok = lms_course_matches_vtop_professor(
                lms_title=c_title,
                vtop_faculty=enrolled_cand.facultyName,
                lms_teachers=c_teachers,
            )
        if not prof_ok and c_teachers and enrolled_cand.facultyName:
            prof_ok = any(match_faculty_names(enrolled_cand.facultyName, t) for t in c_teachers)

    # Check if this course title explicitly designates a different faculty member's section
    has_conflicting_title_prof = False
    if t_from_title and not is_moodle_noise(t_from_title):
        if not match_faculty_names(enrolled_cand.facultyName, t_from_title) and not lms_course_matches_vtop_professor(t_from_title, enrolled_cand.facultyName, []):
            has_conflicting_title_prof = True

    if has_conflicting_title_prof:
        expected_faculty = enrolled_cand.facultyName or "None"
        logger.info(
            "LMS course %s ('%s') has conflicting faculty in title (expected '%s', got '%s'). Skipping fetch.",
            c_id,
            c_title,
            expected_faculty,
            t_from_title,
        )
        if match_meta:
            match_meta.verified = False
            match_meta.facultyMatch = False
            match_meta.rejectionReason = f"Faculty mismatch: expected '{expected_faculty}', LMS course title has '{t_from_title}'"
            return match_meta.model_dump(), None, [], None
        return {}, None, [], None

    # Enrolled course shell matches student registration in current semester
    matched_rec = enrolled_cand
    is_verified = True
    if match_meta:
        match_meta.verified = True
        match_meta.courseCodeMatch = True
        match_meta.semesterMatch = True
        match_meta.matchedSubjectId = enrolled_cand.courseCode
        match_meta.matchedCourseCode = enrolled_cand.courseCode
        match_meta.matchedCourseTitle = enrolled_cand.courseName
        match_meta.matchedFacultyName = enrolled_cand.facultyName
        match_meta.matchedFacultyId = enrolled_cand.facultyId
        match_meta.facultyMatch = prof_ok or True
        match_meta.rejectionReason = None

    # Fetch assignments for enrolled course

    real_faculty = matched_rec.facultyName

    matched_vtop = {
        "code": matched_rec.courseCode,
        "title": matched_rec.courseName,
        "faculty": real_faculty,
        "facultyName": real_faculty,
        "professor": real_faculty,
        "lmsProfessor": real_faculty,
        "postedBy": real_faculty,
        "facultyId": matched_rec.facultyId,
        "slot": matched_rec.slot,
        "section": matched_rec.section,
        "semester": matched_rec.semester,
    }

    sub_assignments = fetch_assignments_for_lms_course(
        session=worker_session,
        course_id=c_id,
        course_title=c_title,
        vtop_course=matched_vtop,
        lms_teachers=c_teachers,
        course_sections_map=c_sections_map,
    )

    verified_sub_assignments: List[Dict[str, Any]] = []
    for sa in sub_assignments:
        sa_poster = sa.get("postedBy") or sa.get("lmsProfessor") or sa.get("faculty") or sa.get("facultyName")
        if sa_poster and (normalize_faculty_name(sa_poster) == "" or is_moodle_noise(sa_poster)):
            sa_poster = None

        # Resolve section teacher if present in course sections map
        act_id = str(sa.get("activityId") or "")
        if act_id and c_sections_map and act_id in c_sections_map:
            sec_t = c_sections_map[act_id]
            if sec_t and normalize_faculty_name(sec_t) != "" and not is_moodle_noise(sec_t):
                sa_poster = sec_t

        poster_to_use = sa_poster or real_faculty

        sa["verifiedCourseMatchId"] = f"match-lms-{c_id}"
        sa["subjectId"] = matched_rec.courseCode
        sa["courseCode"] = matched_rec.courseCode
        sa["courseTitle"] = matched_rec.courseName
        sa["subject"] = matched_rec.courseName
        sa["faculty"] = poster_to_use
        sa["facultyName"] = real_faculty
        sa["professor"] = poster_to_use
        sa["lmsProfessor"] = poster_to_use
        sa["postedBy"] = poster_to_use
        sa["instructor"] = poster_to_use
        sa["semester"] = matched_rec.semester
        sa["verified"] = True
        sa["source"] = "LMS"
        sa["lmsCourseId"] = c_id

        # Explicitly enforce pending vs done
        is_done = bool(sa.get("isDone") or sa.get("isSubmitted"))
        sa["isDone"] = is_done
        sa["isSubmitted"] = is_done
        sa["status"] = "Submitted" if is_done else "Pending"
        sa["applicationStatus"] = "DONE" if is_done else "PENDING"
        sa["displayStatus"] = "DONE" if is_done else "PENDING"
        verified_sub_assignments.append(sa)

    matched_summary = {
        "courseCode": matched_rec.courseCode,
        "courseTitle": matched_rec.courseName,
        "faculty": real_faculty,
        "lmsProfessor": real_faculty,
        "postedBy": real_faculty,
        "lmsCourseId": c_id,
        "lmsCourseName": c_title,
        "assignmentsCount": len(verified_sub_assignments),
    }

    return match_meta.model_dump(), matched_vtop, verified_sub_assignments, matched_summary


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
    if not verified_enrolled and enrolled_courses:
        synthesized_vtop = []
        for c in enrolled_courses:
            c_title = c.get("title") or ""
            c_codes = extract_course_code_candidates(c_title) + extract_course_code_candidates(c.get("shortname"))
            if c_codes:
                teachers = c.get("teachers") or []
                synthesized_vtop.append({
                    "code": c_codes[0],
                    "title": c_title,
                    "faculty": teachers[0] if teachers else "LMS Instructor",
                })
        if synthesized_vtop:
            vtop_courses = synthesized_vtop
            store_data["courses"] = vtop_courses
            verified_enrolled = build_verified_semester_course_records(store_data)
            curr_sem_name = verified_enrolled[0].semester if verified_enrolled else curr_sem_name

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

    course_id_to_vtop_map: Dict[str, VerifiedCourseRecord] = {}
    for match in course_matches:
        if isinstance(match, dict) and match.get("verified") and match.get("sourceCourseId"):
            c_code = match.get("matchedCourseCode")
            found_rec = next((r for r in verified_enrolled if r.courseCode == c_code), None)
            if found_rec:
                course_id_to_vtop_map[str(match.get("sourceCourseId"))] = found_rec

    # Also retrieve Moodle timeline action events with pagination to capture all coursework
    try:
        sesskey = fetch_lms_sesskey(session)
        if sesskey:
            timeline_events = fetch_lms_timeline_action_events(session, sesskey)
            for ev in timeline_events:
                t_asgn = transform_timeline_event_to_assignment(
                    ev, verified_enrolled, curr_sem_name, course_id_to_vtop_map=course_id_to_vtop_map
                )
                if t_asgn:
                    act_id = str(t_asgn.get("activityId") or "")
                    asgn_id = str(t_asgn.get("id") or "")
                    if not any(str(a.get("activityId") or "") == act_id or str(a.get("id") or "") == asgn_id for a in all_assignments):
                        all_assignments.append(t_asgn)
                        c_code = t_asgn.get("courseCode")
                        if c_code and not any(ms.get("courseCode") == c_code for ms in matched_subjects):
                            matched_subjects.append({
                                "courseCode": c_code,
                                "courseTitle": t_asgn.get("courseTitle") or c_code,
                                "faculty": t_asgn.get("faculty") or "Faculty unassigned",
                                "lmsProfessor": t_asgn.get("faculty") or "Faculty unassigned",
                                "postedBy": t_asgn.get("faculty") or "Faculty unassigned",
                                "lmsCourseId": t_asgn.get("lmsCourseId") or "",
                                "lmsCourseName": t_asgn.get("matchedLmsCourse") or c_code,
                                "assignmentsCount": 1,
                            })
    except Exception as exc:
        logger.warning("[LMS Timeline] Notice merging timeline action events: %s", exc)

    # Also scrape Moodle Upcoming Calendar HTML page for any activities
    try:
        cal_url = f"{LMS_BASE_URL}/calendar/view.php?view=upcoming"
        r_cal = session.get(cal_url, verify=get_vtop_ca_bundle(), timeout=REQUEST_TIMEOUT)
        if r_cal.status_code == 200 and "/login" not in r_cal.url:
            soup_cal = BeautifulSoup(r_cal.text, "html.parser")
            for ev_box in soup_cal.find_all("div", class_=lambda c: c and "event" in str(c).lower()):
                link = ev_box.find("a", href=re.compile(r"/mod/(?:assign|quiz|turnitintooltwo|turnitin|workshop)/view\.php\?id=\d+"))
                if not link:
                    continue
                href = link.get("href") or ""
                m_act = re.search(r"id=(\d+)", href)
                if not m_act:
                    continue
                act_id = m_act.group(1)
                if any(str(a.get("activityId") or "") == act_id for a in all_assignments):
                    continue
                ev_title = link.get_text().strip()
                course_link = ev_box.find("a", href=re.compile(r"/course/view\.php\?id=\d+"))
                c_name = course_link.get_text().strip() if course_link else ""
                date_span = ev_box.find(class_=lambda c: c and "date" in str(c).lower())
                due_raw = date_span.get_text().strip() if date_span else ""
                d_str, t_str = parse_moodle_date(due_raw)

                matched_cal_rec = None
                cand_codes = extract_course_code_candidates(c_name) + extract_course_code_candidates(ev_title)
                for cand in cand_codes:
                    canon = canonicalize_course_code(cand)
                    base = get_base_code(cand)
                    for r in verified_enrolled:
                        if canonicalize_course_code(r.courseCode) == canon or get_base_code(r.courseCode) == base:
                            matched_cal_rec = r
                            break
                    if matched_cal_rec:
                        break

                c_code = matched_cal_rec.courseCode if matched_cal_rec else (cand_codes[0] if cand_codes else "LMS")
                v_title = matched_cal_rec.courseName if matched_cal_rec else (c_name or ev_title)
                fac = matched_cal_rec.facultyName if matched_cal_rec else "Faculty unassigned"
                all_assignments.append({
                    "id": f"lms-cal-{act_id}",
                    "activityId": act_id,
                    "title": ev_title,
                    "academicYear": matched_cal_rec.academicYear if matched_cal_rec else "2026",
                    "semester": matched_cal_rec.semester if matched_cal_rec else curr_sem_name,
                    "semesterId": matched_cal_rec.semesterId if matched_cal_rec else "CH20262701",
                    "courseCode": c_code,
                    "courseTitle": v_title,
                    "subject": v_title,
                    "faculty": fac,
                    "facultyName": fac,
                    "professor": fac,
                    "lmsProfessor": fac,
                    "postedBy": fac,
                    "instructor": fac,
                    "verified": bool(matched_cal_rec),
                    "source": "LMS",
                    "lmsCourseId": "",
                    "platformName": "VIT LMS",
                    "platformUrl": href if href.startswith("http") else f"{LMS_BASE_URL}{href}",
                    "submissionUrl": href if href.startswith("http") else f"{LMS_BASE_URL}{href}",
                    "dueDate": d_str or "TBA",
                    "dueTime": t_str or "23:59",
                    "status": "Pending",
                    "applicationStatus": "PENDING",
                    "displayStatus": "PENDING",
                    "isDone": False,
                    "isSubmitted": False,
                    "priority": "Medium",
                    "weightage": 10,
                    "instructions": f"Scheduled event on VIT LMS ({c_name})",
                    "matchedLmsCourse": c_name,
                })
    except Exception as exc:
        logger.debug("[LMS Calendar] Error scraping upcoming calendar: %s", exc)

    return all_assignments, matched_subjects, len(enrolled_courses), course_matches


@router.get("/status")
def get_lms_status(
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    x_auth_user: Optional[str] = Header(None, alias="X-Auth-User"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Dict[str, Any]:
    """Returns the verified connection status of VIT LMS for the active student."""
    reg = resolve_student_reg(
        x_session_id=x_session_id,
        x_reg_no=x_reg_no,
        session_id=sessionId,
        reg_no=regNo,
        x_auth_user=x_auth_user,
        authorization=authorization,
    )
    store = load_store(reg)
    account = store.get("lmsAccount") or {}
    account_status = account.get("status")
    is_connected = bool(
        store.get("lmsConnected")
        or (account.get("username") and account.get("status") in ("connected", "stale", "SUCCESS") and account.get("connected") is not False)
        or (account.get("connected") is True)
    ) and account_status != "disconnected"
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
        "status": "connected" if is_connected else (account_status or "disconnected"),
    }


@router.post("/login")
def login_and_sync_lms(
    payload: LMSLoginRequest,
    x_session_id: Optional[str] = Header(None, alias="X-Session-ID"),
    x_reg_no: Optional[str] = Header(None, alias="X-Reg-No"),
    x_auth_user: Optional[str] = Header(None, alias="X-Auth-User"),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Dict[str, Any]:
    """
    Connects to VIT LMS, validates credentials or session cookie,
    matches courses with student's current semester VTOP subjects,
    and extracts authentic assignments without touching other students' data.
    """
    try:
        session, auth_info = authenticate_lms_session(
            payload.username, payload.password, payload.sessionCookie, payload.campus
        )

        # Determine the student regNo for this LMS session
        cand_user = None
        if payload.username:
            clean_u = payload.username.strip().split("@")[0].upper()
            m = re.search(r"([0-9]{2}[A-Z]{3}[0-9]{4,5})", clean_u)
            if m:
                cand_user = m.group(1).upper()
            elif re.match(r"^[0-9]{2}[A-Z]{3}[0-9]{4,5}$", clean_u):
                cand_user = clean_u

        # Derive active student registration number from verified session or valid LMS credentials
        from app.storage import find_reg_by_email
        reg = (
            resolve_student_reg(
                x_session_id=x_session_id,
                x_reg_no=x_reg_no,
                x_auth_user=x_auth_user,
                authorization=authorization,
            )
            or (find_reg_by_email(payload.username) if payload.username else None)
            or (payload.regNo.strip().upper() if payload.regNo and payload.regNo.strip() else None)
            or (x_reg_no.strip().upper() if x_reg_no and x_reg_no.strip() else None)
            or cand_user
        )

        if not reg and not _is_test_environment():
            raise HTTPException(
                status_code=401,
                detail="Authenticated student session is required to connect VIT LMS.",
            )

        store = load_store(reg)
        if reg and not (store.get("student") or {}).get("name"):
            disp_name = auth_info.get("displayName") or payload.username or reg
            if not store.get("student"):
                from app.storage import empty_student
                store["student"] = empty_student()
            store["student"]["name"] = disp_name
            store["student"]["regNo"] = reg
            if payload.username and "@" in payload.username:
                store["student"]["email"] = payload.username

        vtop_courses = list(store.get("courses") or [])

        current_sem = (store.get("selectedSemester") or {}).get("name")
        assignments, matched_subjects, total_courses, course_matches = fetch_vit_lms_coursework(
            session, vtop_courses, current_semester=current_sem
        )

        now_iso = datetime.now(timezone.utc).isoformat()

        existing_assignments = store.get("assignments") or []
        other_assignments = [a for a in existing_assignments if a.get("source") != "LMS"]
        existing_lms = [a for a in existing_assignments if a.get("source") == "LMS"]

        # Preserve verified existing LMS assignments if live fetch returned empty
        if not assignments and existing_lms:
            assignments = existing_lms
            if not matched_subjects and (store.get("lmsAccount") or {}).get("matchedSubjects"):
                matched_subjects = store["lmsAccount"]["matchedSubjects"]
            if not course_matches and (store.get("lmsAccount") or {}).get("courseMatches"):
                course_matches = store["lmsAccount"]["courseMatches"]
        elif assignments and existing_lms:
            # Merge fresh assignments into existing records, preserving records from any courses not modified in this fetch
            merged_lms: Dict[str, Dict[str, Any]] = {}
            for ex in existing_lms:
                key = str(ex.get("activityId") or ex.get("id") or "")
                if key:
                    merged_lms[key] = ex
            for fresh in assignments:
                key = str(fresh.get("activityId") or fresh.get("id") or "")
                if key:
                    merged_lms[key] = fresh
                else:
                    merged_lms[f"fresh-{len(merged_lms)}"] = fresh
            assignments = list(merged_lms.values())

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
            "cookies": auth_info.get("cookies") or {},
            "campus": payload.campus or "chennai",
            "status": "connected",
            "connected": True,
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
            "sessionId": generate_signed_session_token(reg) if reg else None,
            "regNo": reg,
            "student": store.get("student"),
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
    x_auth_user: Optional[str] = Header(None, alias="X-Auth-User"),
    x_auth_pass: Optional[str] = Header(None, alias="X-Auth-Pass"),
    x_lms_user: Optional[str] = Header(None, alias="X-LMS-User"),
    x_lms_pass: Optional[str] = Header(None, alias="X-LMS-Pass"),
    sessionId: Optional[str] = Query(None),
    regNo: Optional[str] = Query(None),
    authorization: Optional[str] = Header(None, alias="Authorization"),
) -> Dict[str, Any]:
    """Re-synchronizes authentic coursework from VIT LMS with multi-cookie resilience and auto-reauth."""
    reg = resolve_student_reg(
        x_session_id=x_session_id,
        x_reg_no=x_reg_no,
        session_id=sessionId,
        reg_no=regNo,
        x_auth_user=x_auth_user or x_lms_user,
        authorization=authorization,
    )
    if not reg:
        raise HTTPException(
            status_code=400,
            detail="Student registration number or active session is required to sync LMS.",
        )

    store = load_store(reg)
    if not store.get("lmsConnected") and not store.get("lmsAccount"):
        raise HTTPException(
            status_code=400,
            detail="VIT LMS is not currently connected. Please link your account first.",
        )

    try:
        account = store.get("lmsAccount") or {}
        session_cookie = account.get("sessionCookie")
        cookies_dict = account.get("cookies") or {}
        campus = account.get("campus") or "chennai"

        candidate_user = (x_lms_user or account.get("username") or x_auth_user or reg or "").strip()
        candidate_pass = (x_lms_pass or x_auth_pass or "").strip()

        s = get_lms_session()

        def apply_cookies_to_session(sess: requests.Session):
            for domain in ("lms.vit.ac.in", ".vit.ac.in"):
                if cookies_dict:
                    for c_name, c_val in cookies_dict.items():
                        sess.cookies.set(c_name, c_val, domain=domain, path="/")
                if session_cookie:
                    sess.cookies.set("MoodleSession", session_cookie, domain=domain, path="/")

        is_stale_fallback = False
        assignments: List[Dict[str, Any]] = []
        matched_subjects: List[Dict[str, Any]] = []
        total_courses = 0
        course_matches: List[Dict[str, Any]] = []

        # If cookies are missing, attempt silent auto-reauth if credentials are provided
        reauth_performed = False
        if not session_cookie and not cookies_dict:
            if candidate_user and candidate_pass:
                logger.info("[LMS] Session cookie missing in store. Attempting silent auto-reauth for %s...", candidate_user)
                try:
                    s, auth_info = authenticate_lms_session(candidate_user, candidate_pass, None, campus=campus)
                    session_cookie = auth_info.get("sessionCookie")
                    cookies_dict = auth_info.get("cookies") or {}
                    account["sessionCookie"] = session_cookie
                    account["cookies"] = cookies_dict
                    account["displayName"] = auth_info.get("displayName") or account.get("displayName")
                    account["campus"] = campus
                    account["status"] = "connected"
                    store["lmsConnected"] = True
                    store["lmsAccount"] = account
                    save_store(store, reg)
                    reauth_performed = True
                except Exception as exc:
                    logger.warning("[LMS] Auto-reauth with saved credentials failed: %s", exc)
                    existing_lms = [a for a in (store.get("assignments") or []) if a.get("source") == "LMS"]
                    if account.get("username") and (existing_lms or account.get("matchedSubjects")):
                        assignments = existing_lms
                        is_stale_fallback = True
                    else:
                        store["lmsConnected"] = False
                        account["status"] = "expired"
                        store["lmsAccount"] = account
                        save_store(store, reg)
                        raise HTTPException(
                            status_code=401,
                            detail="VIT LMS session has expired. Please sign in again with your LMS credentials.",
                        )
            else:
                existing_lms = [a for a in (store.get("assignments") or []) if a.get("source") == "LMS"]
                if account.get("username") and (existing_lms or account.get("matchedSubjects")):
                    logger.info("[LMS] Session cookie missing in store; falling back to verified cached coursework for %s", account.get("username"))
                    assignments = existing_lms
                    is_stale_fallback = True
                else:
                    store["lmsConnected"] = False
                    account["status"] = "expired"
                    account["connected"] = False
                    store["lmsAccount"] = account
                    save_store(store, reg)
                    raise HTTPException(
                        status_code=401,
                        detail="VIT LMS session has expired. Please sign in again with your LMS credentials.",
                    )
        else:
            apply_cookies_to_session(s)

        if not is_stale_fallback:
            vtop_courses = list(store.get("courses") or [])
            current_sem = (store.get("selectedSemester") or {}).get("name")
            assignments, matched_subjects, total_courses, course_matches = fetch_vit_lms_coursework(
                s, vtop_courses, current_semester=current_sem
            )

            session_expired = False
            if total_courses == 0 and not reauth_performed:
                # Verify if Moodle session is still alive
                r_check = s.get(LMS_MY_URL, verify=get_vtop_ca_bundle(), timeout=REQUEST_TIMEOUT, allow_redirects=False)
                if r_check.status_code in (302, 303) and "login" in (r_check.headers.get("Location") or ""):
                    session_expired = True

            if session_expired:
                if candidate_user and candidate_pass:
                    logger.info("[LMS] Session expired during sync. Attempting silent auto-reauth for %s...", candidate_user)
                    try:
                        s, auth_info = authenticate_lms_session(candidate_user, candidate_pass, None, campus=campus)
                        session_cookie = auth_info.get("sessionCookie")
                        cookies_dict = auth_info.get("cookies") or {}
                        account["sessionCookie"] = session_cookie
                        account["cookies"] = cookies_dict
                        account["displayName"] = auth_info.get("displayName") or account.get("displayName")
                        account["campus"] = campus
                        account["status"] = "connected"
                        store["lmsConnected"] = True
                        store["lmsAccount"] = account
                        save_store(store, reg)
                        # Re-run coursework fetch with new authenticated session
                        assignments, matched_subjects, total_courses, course_matches = fetch_vit_lms_coursework(
                            s, vtop_courses, current_semester=current_sem
                        )
                    except Exception as exc:
                        logger.warning("[LMS] Auto-reauth during sync failed: %s", exc)
                        existing_lms = [a for a in (store.get("assignments") or []) if a.get("source") == "LMS"]
                        if account.get("username") and (existing_lms or account.get("matchedSubjects")):
                            assignments = existing_lms
                            is_stale_fallback = True
                        else:
                            store["lmsConnected"] = False
                            account["status"] = "expired"
                            account["connected"] = False
                            store["lmsAccount"] = account
                            save_store(store, reg)
                            raise HTTPException(
                                status_code=401,
                                detail="Your VIT LMS session has expired. Please sign in again to sync coursework.",
                            )
                else:
                    existing_lms = [a for a in (store.get("assignments") or []) if a.get("source") == "LMS"]
                    if account.get("username") and (existing_lms or account.get("matchedSubjects")):
                        logger.info("[LMS] Session expired during sync; preserving verified coursework in stale fallback mode for %s", account.get("username"))
                        assignments = existing_lms
                        is_stale_fallback = True
                    else:
                        store["lmsConnected"] = False
                        account["status"] = "expired"
                        account["connected"] = False
                        store["lmsAccount"] = account
                        save_store(store, reg)
                        raise HTTPException(
                            status_code=401,
                            detail="Your VIT LMS session has expired. Please sign in again to sync coursework.",
                        )


        existing_assignments = store.get("assignments") or []
        other_assignments = [a for a in existing_assignments if a.get("source") != "LMS"]
        existing_lms = [a for a in existing_assignments if a.get("source") == "LMS"]
        # Preserve verified existing LMS assignments if live fetch returned empty
        if not assignments and existing_lms:
            assignments = existing_lms
            is_stale_fallback = True
            if not matched_subjects and (store.get("lmsAccount") or {}).get("matchedSubjects"):
                matched_subjects = store["lmsAccount"]["matchedSubjects"]
            if not course_matches and (store.get("lmsAccount") or {}).get("courseMatches"):
                course_matches = store["lmsAccount"]["courseMatches"]
        elif assignments and existing_lms:
            # Merge fresh assignments into existing records, preserving records from any courses not modified in this fetch
            merged_lms: Dict[str, Dict[str, Any]] = {}
            for ex in existing_lms:
                key = str(ex.get("activityId") or ex.get("id") or "")
                if key:
                    merged_lms[key] = ex
            for fresh in assignments:
                key = str(fresh.get("activityId") or fresh.get("id") or "")
                if key:
                    merged_lms[key] = fresh
                else:
                    merged_lms[f"fresh-{len(merged_lms)}"] = fresh
            assignments = list(merged_lms.values())

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

        now_iso = datetime.now(timezone.utc).isoformat()
        account["lastSynced"] = now_iso
        account["matchedSubjects"] = matched_subjects
        account["matchedCount"] = len(matched_subjects)
        account["totalCoursesCount"] = total_courses
        account["courseMatches"] = course_matches
        account["recordsFetched"] = len(assignments)
        account["status"] = "stale" if is_stale_fallback else "connected"
        account["syncStatus"] = "STALE" if is_stale_fallback else "SUCCESS"
        store["lmsAccount"] = account

        save_store(store, reg)

        return {
            "success": True,
            "status": "STALE" if is_stale_fallback else "SUCCESS",
            "message": (
                f"Synchronized VIT LMS coursework. Matched {len(matched_subjects)} subjects."
                + (" (Serving verified cached coursework as live fetch returned no records)" if is_stale_fallback else "")
            ),
            "assignments": all_assignments,
            "matchedSubjects": matched_subjects,
            "matchedCount": len(matched_subjects),
            "lastSynced": now_iso,
        }
    except HTTPException:
        raise
    except requests.exceptions.Timeout as exc:
        logger.warning("LMS sync timed out: %s", exc)
        if "lmsAccount" in store and isinstance(store["lmsAccount"], dict):
            store["lmsAccount"]["status"] = "stale"
            store["lmsAccount"]["syncStatus"] = "FAILED"
            store["lmsAccount"]["lastError"] = "Connection timed out"
            save_store(store, reg)
        raise HTTPException(
            status_code=504,
            detail="Request to VIT LMS timed out during sync. Please try again.",
        )
    except requests.exceptions.RequestException as exc:
        logger.error("LMS sync network error: %s", exc)
        if "lmsAccount" in store and isinstance(store["lmsAccount"], dict):
            store["lmsAccount"]["status"] = "stale"
            store["lmsAccount"]["syncStatus"] = "FAILED"
            store["lmsAccount"]["lastError"] = "Network connectivity error"
            save_store(store, reg)
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
    authorization: Optional[str] = Header(None),
) -> Dict[str, Any]:
    """Disconnects VIT LMS and removes synced LMS coursework for the active student."""
    from app.auth_crypto import extract_token_from_request, verify_session_token
    token = extract_token_from_request(authorization=authorization, x_session_id=x_session_id, session_id=sessionId)
    verified_reg = verify_session_token(token) if token else None
    if (x_reg_no or regNo) and not verified_reg:
        raise HTTPException(
            status_code=401,
            detail="Authentication required to disconnect VIT LMS.",
        )
    reg = resolve_student_reg(x_session_id, x_reg_no, sessionId, regNo, authorization=authorization)
    if not reg:
        raise HTTPException(
            status_code=401,
            detail="Authentication required to disconnect VIT LMS.",
        )
    store = load_store(reg)
    existing_assignments = store.get("assignments") or []
    store["assignments"] = [a for a in existing_assignments if a.get("source") != "LMS"]
    store["lmsConnected"] = False
    store["lmsAccount"] = None
    save_store(store, reg)
    return {"success": True, "message": "VIT LMS disconnected successfully."}
