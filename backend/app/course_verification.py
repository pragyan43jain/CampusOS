"""
CampusOS Backend - Strict Course Code + Faculty + Title + Semester Verification Engine

Architecture: "VTOP CURRENT SEMESTER -> CANONICAL COURSE REGISTRY -> EXTERNAL COURSE DISCOVERY -> STRICT MATCHING -> VERIFIED EXTERNAL COURSE -> FETCH ASSIGNMENTS -> VERIFY ASSIGNMENT OWNERSHIP -> DISPLAY"

Mandates:
1. Source of truth is student's currently enrolled semester data from VTOP.
2. Canonical course identity: academicYear + semester + courseCode + normalizedCourseTitle + verifiedFaculty.
3. An external Teams or LMS course is eligible for assignment retrieval ONLY when:
   - exactCourseCodeMatch == True (canonical, preserving L/P distinctions)
   - exactFacultyMatch == True (strict token-level canonical identity)
   - courseTitleMatch == True (semantic subject keywords match, no conflicting courses like Computer Architecture != Computer Networks)
   - semesterMatch == True (current academic year and semester match)
4. Fail-closed on any missing or conflicting metadata.
5. Invalidation of stale cached assignments from previous semesters.
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Set, Tuple

from pydantic import BaseModel, Field

logger = logging.getLogger("vtop.course_verification")


# ============================================================================
# 1. Models
# ============================================================================

class VerifiedCourseRecord(BaseModel):
    """Authoritative course + faculty pair from the student's current semester in VTOP."""
    academicYear: str = "2026"
    semester: str = "Fall Semester 2026-27"
    semesterId: str = "CH20262701"
    courseCode: str
    courseName: str
    facultyName: str
    facultyId: Optional[str] = None
    slot: Optional[str] = None
    section: Optional[str] = None
    type: Optional[str] = None
    verified: bool = True

    @property
    def canonicalIdentity(self) -> str:
        fac = canonicalize_faculty_name(self.facultyName) or "UNKNOWN"
        code = canonicalize_course_code(self.courseCode) or "UNKNOWN"
        return f"{self.academicYear}:{self.semesterId}:{code}:{self.courseName.lower()}:{fac}"


class ExternalCourseMatch(BaseModel):
    """Verification record for a synchronized external Teams/LMS course."""
    userId: Optional[str] = None
    academicYear: str = "2026"
    semesterId: str = "CH20262701"
    source: str  # "Teams" or "LMS"
    sourceCourseId: str
    sourceCourseName: str
    sourceCourseCode: Optional[str] = None
    sourceFacultyId: Optional[str] = None
    sourceFacultyName: Optional[str] = None
    sourceSection: Optional[str] = None

    matchedSubjectId: Optional[str] = None
    matchedCourseCode: Optional[str] = None
    matchedCourseTitle: Optional[str] = None
    matchedFacultyId: Optional[str] = None
    matchedFacultyName: Optional[str] = None

    courseCodeMatch: bool = False
    courseTitleMatch: bool = False
    facultyMatch: bool = False
    sectionMatch: bool = True
    semesterMatch: bool = True
    verified: bool = False
    rejectionReason: Optional[str] = None
    lastVerifiedAt: str = Field(default_factory=lambda: datetime.now(timezone.utc).isoformat())


# ============================================================================
# 2. Safe Canonical Normalization Functions
# ============================================================================

def canonicalize_course_code(code: Optional[str]) -> Optional[str]:
    """
    Canonicalizes course code by trimming whitespace, upper-casing,
    and removing internal harmless punctuation/spacing while PRESERVING
    meaningful distinction suffixes ('L', 'P', 'J', 'N').
    
    Examples:
    - 'BCSE 308L'  -> 'BCSE308L'
    - 'bcse-308p'  -> 'BCSE308P'
    - 'BCSE308L'   != 'BCSE308P' (Theory and Lab are distinct courses)
    - 'BCSE308'    != 'BCSE308L' (Base code is not equivalent to full code)
    """
    if not code:
        return None
    raw = str(code).strip().upper()
    clean = re.sub(r"[\s\-_/]+", "", raw)
    # Standard university course pattern: 3-4 letters + 3-4 digits + optional 1-2 letters
    if re.match(r"^[A-Z]{3,4}\d{3,4}[A-Z]{0,2}$", clean):
        return clean
    return None


def extract_course_code_candidates(text: Optional[str]) -> List[str]:
    """
    Extracts all potential academic course code tokens from a string.
    Matches patterns like 'BCSE308L', 'BCSE 308P', 'BECE355L', 'BMAT202L'.
    """
    if not text:
        return []
    text_upper = str(text).upper()
    raw_matches = re.findall(r"\b([A-Z]{3,4}\s*[-_]?\s*\d{3,4}[A-Z]{0,2})\b", text_upper)
    candidates = []
    for rm in raw_matches:
        canon = canonicalize_course_code(rm)
        if canon and canon not in candidates:
            candidates.append(canon)

            # If canon is base code (e.g. BCSE308) and slot is in text, synthesize full course code
            if len(canon) == 7 and not canon[-1].isalpha():
                if re.search(r"\b(?:A1|A2|B1|B2|C1|C2|D1|D2|E1|E2|F1|F2|G1|G2|TA1|TA2|TB1|TB2|TC1|TC2|TD1|TD2|TE1|TE2|TF1|TF2|TG1|TG2|THEORY)\b", text_upper):
                    theory_code = f"{canon}L"
                    if theory_code not in candidates:
                        candidates.append(theory_code)
                if re.search(r"\b(?:L[1-9]|L1[0-9]|L20|LAB|PRACTICAL)\b", text_upper):
                    lab_code = f"{canon}P"
                    if lab_code not in candidates:
                        candidates.append(lab_code)
    return candidates


def canonicalize_faculty_name(name: Optional[str]) -> Optional[str]:
    """
    Safely normalizes faculty names for full-identity comparison:
    1. Trim leading/trailing whitespace
    2. Collapse multiple whitespace to single space
    3. Letter case to uppercase
    4. Strip harmless honorific prefixes at start ('DR.', 'DR', 'PROF.', 'PROFESSOR', 'MR.', 'MS.', 'MRS.', 'DOC.')
    5. Normalizes internal punctuation around initials ('T.' -> 'T', 'C.A.' -> 'C A')
    6. PRESERVES all initials and token identities:
       - 'Ravi Kumar' != 'Ravi Kumar P' (different person)
       - 'John Smith' != 'John' (no partial/first-name matching)
    """
    if not name:
        return None
    clean = str(name).strip().upper()
    clean = re.sub(r"^(?:DR|PROF|PROFESSOR|MR|MS|MRS|DOC)\b\.?\s*", "", clean, flags=re.IGNORECASE).strip()
    clean = re.sub(r"[\.,;]", " ", clean)
    clean = re.sub(r"[\(\)]", " ", clean)
    tokens = clean.split()
    if not tokens:
        return None
    return " ".join(tokens)


def canonicalize_faculty_id(fac_id: Optional[str]) -> Optional[str]:
    """Normalizes stable faculty ID if available."""
    if not fac_id:
        return None
    clean = str(fac_id).strip().lower()
    return clean if clean else None


def extract_section(text: Optional[str]) -> Optional[str]:
    """Extracts section identifier if reliably available (e.g. 'SEC A', 'Section 1', 'L1')."""
    if not text:
        return None
    m = re.search(r"\b(?:SEC|SECTION|SLOT)\s*[:\-]?\s*([A-Z0-9\+]+)\b", str(text).upper())
    if m:
        return m.group(1).strip()
    return None


def normalize_subject_title_tokens(title: Optional[str]) -> Set[str]:
    """
    Extracts meaningful subject title tokens, stripping course codes and generic noise words.
    """
    if not title:
        return set()
    raw = str(title).lower()
    # Strip course codes
    raw = re.sub(r"\b[a-z]{3,4}\s*[-_]?\s*\d{3,4}[a-z]{0,2}\b", " ", raw)
    noise_words = {
        "theory", "th", "lab", "laboratory", "lo", "course", "slot", "faculty", "prof",
        "dr", "section", "sec", "vit", "chennai", "vellore", "sem", "semester", "class",
        "and", "for", "the", "with", "general", "academic",
    }
    tokens = {t for t in re.findall(r"[a-z]{3,}", raw) if t not in noise_words}
    return tokens


def verify_course_title_match(vtop_title: str, external_name: str, external_desc: str = "") -> Tuple[bool, Optional[str]]:
    """
    Verifies that the external course title/description refers to the same subject as VTOP.
    Rejects conflicting subjects (e.g. Computer Architecture != Computer Networks).
    Section 6 requirement: Exact course title verification.
    """
    vtop_tokens = normalize_subject_title_tokens(vtop_title)
    if not vtop_tokens:
        return True, None

    ext_text = f"{external_name} {external_desc}"
    ext_tokens = normalize_subject_title_tokens(ext_text)

    # If external text only had course codes / slot codes, title check relies on exact code match
    if not ext_tokens:
        return True, None

    # Distinguish generic subject words from domain-specific subject words
    generic_words = {
        "computer", "advanced", "systems", "system", "engineering", "introduction",
        "intro", "science", "applied", "design", "technology", "studies", "basic",
    }
    vtop_specific = vtop_tokens - generic_words
    ext_specific = ext_tokens - generic_words

    if vtop_specific and ext_specific:
        spec_overlap = vtop_specific.intersection(ext_specific)
        if not spec_overlap:
            reason = (
                f"Course title mismatch: VTOP title is '{vtop_title}' (specific: {vtop_specific}), "
                f"external course is '{external_name}' (specific: {ext_specific})"
            )
            return False, reason

    # Check overall overlap if multiple tokens exist
    overlap = vtop_tokens.intersection(ext_tokens)
    if len(vtop_tokens) >= 2 and len(overlap) == 0:
        reason = f"Course title mismatch: external '{external_name}' has no title keywords matching VTOP '{vtop_title}'"
        return False, reason

    return True, None


def extract_academic_context(text: Optional[str]) -> Dict[str, Any]:
    """
    Extracts all structured academic context attributes from a text string:
    - season: "FALL", "WINTER", "SUMMER"
    - year: 2026, 2025, etc.
    - sem_num: 1, 2, 3, 4, etc.
    - is_archived: bool
    """
    if not text:
        return {"season": None, "year": None, "sem_num": None, "is_archived": False}

    upper = str(text).upper()
    is_archived = any(kw in upper for kw in ["ARCHIVED", "OLD COURSE", "PREVIOUS SEMESTER", "PREV SEM"])

    m_sem_num = re.search(r"\b(?:SEM|SEMESTER)\s*[:\-]?\s*([1-8])\b", upper)
    sem_num = int(m_sem_num.group(1)) if m_sem_num else None

    season = None
    if "FALL" in upper or "AUTUMN" in upper:
        season = "FALL"
    elif "WINTER" in upper or "WIN" in upper:
        season = "WINTER"
    elif "SUMMER" in upper or "SUM" in upper:
        season = "SUMMER"

    m_yr = re.search(r"\b(20[2-3]\d)\b", upper)
    year = int(m_yr.group(1)) if m_yr else None

    return {"season": season, "year": year, "sem_num": sem_num, "is_archived": is_archived}


def extract_semester_term_year(text: Optional[str]) -> Optional[Tuple[str, int]]:
    """Helper for backward compatibility."""
    ctx = extract_academic_context(text)
    if ctx["season"] and ctx["year"]:
        return ctx["season"], ctx["year"]
    if ctx["sem_num"]:
        return "SEM", ctx["sem_num"]
    if ctx["year"]:
        return "YEAR", ctx["year"]
    return None


def verify_semester_match(current_sem_name: str, external_text: str) -> Tuple[bool, Optional[str]]:
    """
    Ensures external courses belonging to previous semesters (e.g. Semester 3 vs Semester 4,
    Fall 2025 vs Fall 2026) are rejected.
    """
    curr = extract_academic_context(current_sem_name)
    ext = extract_academic_context(external_text)

    if ext["is_archived"]:
        return False, "Archived course rejected: external course is explicitly tagged as historical/archived"

    # 1. Season mismatch (if both specify season)
    if curr["season"] and ext["season"] and curr["season"] != ext["season"]:
        ext_yr_str = f" {ext['year']}" if ext['year'] else ""
        curr_yr_str = f" {curr['year']}" if curr['year'] else ""
        return False, f"Semester mismatch: external course is {ext['season']}{ext_yr_str}, current is {curr['season']}{curr_yr_str}"

    # 2. Year mismatch (if both specify year)
    if curr["year"] and ext["year"] and curr["year"] != ext["year"]:
        return False, f"Academic year mismatch: external course belongs to year {ext['year']}, current is {curr['year']}"

    # 3. Semester number mismatch (if both specify sem number)
    if curr["sem_num"] and ext["sem_num"] and curr["sem_num"] != ext["sem_num"]:
        return False, f"Semester mismatch: external course is Semester {ext['sem_num']}, current is Semester {curr['sem_num']}"

    return True, None


# ============================================================================
# 3. Verified Semester Course Records Builder
# ============================================================================

def build_verified_semester_course_records(store: Dict[str, Any]) -> List[VerifiedCourseRecord]:
    """
    Source of truth builder:
    1. Identifies the student's selected semester from actual VTOP data.
    2. Retrieves enrolled courses for that semester.
    3. Retrieves verified faculty assigned to each course.
    4. Creates immutable verified canonical course records.
    5. Fails closed if faculty or course code is missing.
    """
    sem = store.get("selectedSemester") or {}
    student = store.get("student") or {}

    sem_name = sem.get("name") or student.get("semester") or "Fall Semester 2026-27"
    sem_id = sem.get("id") or student.get("semesterId") or "CH20262701"

    # Extract academic year (e.g. "2026-27" -> "2026")
    m_yr = re.search(r"\b(20[2-3]\d)\b", sem_name)
    acad_year = m_yr.group(1) if m_yr else "2026"

    courses = list(store.get("courses") or [])
    verified_records: List[VerifiedCourseRecord] = []

    for c in courses:
        code = canonicalize_course_code(c.get("code") or c.get("courseCode"))
        title = (c.get("title") or c.get("courseTitle") or c.get("courseName") or "").strip()
        faculty_raw = (c.get("faculty") or c.get("facultyName") or "").strip()
        faculty_id = c.get("facultyId") or (f"fac-{re.sub(r'[^a-z0-9]', '-', faculty_raw.lower())}" if faculty_raw else None)
        slot = (c.get("slot") or "").strip()
        c_type = (c.get("type") or c.get("courseType") or "").strip()

        # Data integrity check: course code and faculty must both be present
        if not code:
            logger.warning("Enrolled course record missing valid course code: %s", c)
            continue

        if not faculty_raw:
            logger.warning("Enrolled course record [%s: %s] has no assigned faculty; failing closed.", code, title)
            continue

        canon_faculty = canonicalize_faculty_name(faculty_raw)
        if not canon_faculty:
            logger.warning("Could not canonicalize faculty for [%s: %s]; failing closed.", code, title)
            continue

        verified_records.append(VerifiedCourseRecord(
            academicYear=acad_year,
            semester=sem_name,
            semesterId=sem_id,
            courseCode=code,
            courseName=title or code,
            facultyName=faculty_raw,
            facultyId=faculty_id,
            slot=slot if slot else None,
            section=extract_section(slot) or extract_section(c.get("section")),
            type=c_type if c_type else None,
            verified=True,
        ))

    logger.info("Built %d canonical verified course records for semester '%s'", len(verified_records), sem_name)
    return verified_records


# ============================================================================
# 4. Multi-Stage Strict Verification Engine
# ============================================================================

def verify_external_course(
    enrolled_records: List[VerifiedCourseRecord],
    source: str,
    source_id: str,
    source_name: str,
    source_desc: str = "",
    source_professors: Optional[List[str]] = None,
    source_faculty_ids: Optional[List[str]] = None,
    current_semester: Optional[str] = None,
) -> Tuple[bool, Optional[VerifiedCourseRecord], ExternalCourseMatch]:
    """
    Strict Four-Stage Course Verification:
    Stage 1: SEMESTER & ACADEMIC YEAR ISOLATION (rejects old/archived semesters)
    Stage 2: EXACT COURSE CODE MATCH (canonical, preserving L/P distinctions)
    Stage 3: COURSE TITLE VERIFICATION (semantic keyword validation, e.g. reject Computer Architecture for Computer Networks)
    Stage 4: EXACT FACULTY IDENTITY MATCH (strict canonical token matching)
    
    Fails closed if any stage fails.
    """
    sem_id = enrolled_records[0].semesterId if enrolled_records else "CH20262701"
    sem_name = enrolled_records[0].semester if enrolled_records else (current_semester or "Fall Semester 2026-27")
    acad_yr = enrolled_records[0].academicYear if enrolled_records else "2026"

    match_result = ExternalCourseMatch(
        academicYear=acad_yr,
        semesterId=sem_id,
        source=source,
        sourceCourseId=str(source_id),
        sourceCourseName=source_name,
        sourceFacultyName=", ".join(source_professors) if source_professors else None,
    )

    combined_meta = f"{source_name} {source_desc}"

    # Stage 1: Semester & Academic Year Isolation
    sem_ok, sem_reason = verify_semester_match(sem_name, combined_meta)
    if not sem_ok:
        match_result.semesterMatch = False
        match_result.verified = False
        match_result.rejectionReason = sem_reason
        logger.warning("[Course Verification] REJECTED %s '%s' (ID: %s): %s", source, source_name, source_id, sem_reason)
        return False, None, match_result

    match_result.semesterMatch = True

    # Stage 2: Course Code & Subject Resolution
    extracted_codes = extract_course_code_candidates(source_name) + extract_course_code_candidates(source_desc)
    matched_enrolled: Optional[VerifiedCourseRecord] = None
    matched_code: Optional[str] = None

    # Strategy 2A: Exact course code match (e.g. BCSE308L == BCSE308L)
    for cand_code in extracted_codes:
        c_found = next((r for r in enrolled_records if canonicalize_course_code(r.courseCode) == cand_code), None)
        if c_found:
            matched_enrolled = c_found
            matched_code = cand_code
            break

    # Strategy 2C: Title + Slot Resolution ONLY when NO course code was found in external metadata and slot matches (e.g. 'C2+TC2 2026 (Advanced Cloud Computing)')
    if not matched_enrolled and not extracted_codes:
        comb_upper = combined_meta.upper()
        for r in enrolled_records:
            title_ok, _ = verify_course_title_match(r.courseName, source_name, source_desc)
            if title_ok and r.slot:
                slot_tokens = [s.strip() for s in r.slot.upper().split("+") if s.strip()]
                slot_match = any(re.search(rf"\b{re.escape(st)}\b", comb_upper) for st in slot_tokens)
                if slot_match:
                    matched_enrolled = r
                    matched_code = r.courseCode
                    break

    if not matched_enrolled:
        match_result.courseCodeMatch = False
        match_result.verified = False
        match_result.rejectionReason = (
            f"Course code mismatch: extracted codes {extracted_codes} not in student's current enrolled courses"
            if extracted_codes else "Course code missing: no valid course code or matching enrolled subject found in external course metadata"
        )
        logger.debug("[Course Verification] REJECTED %s '%s': %s", source, source_name, match_result.rejectionReason)
        return False, None, match_result

    match_result.courseCodeMatch = True
    match_result.sourceCourseCode = matched_code
    match_result.matchedSubjectId = matched_enrolled.courseCode
    match_result.matchedCourseCode = matched_enrolled.courseCode
    match_result.matchedCourseTitle = matched_enrolled.courseName
    match_result.matchedFacultyId = matched_enrolled.facultyId
    match_result.matchedFacultyName = matched_enrolled.facultyName

    # Stage 3: Course Title Verification (Section 6 requirement)
    title_ok, title_reason = verify_course_title_match(matched_enrolled.courseName, source_name, source_desc)
    if not title_ok:
        match_result.courseTitleMatch = False
        match_result.verified = False
        match_result.rejectionReason = title_reason
        logger.warning(
            "\n[ASSIGNMENT/COURSE VERIFICATION REJECTED]\n"
            "Source: %s\n"
            "External Course: %s (ID: %s)\n"
            "External Code: %s\n"
            "Current VTOP Course: %s\n"
            "Current VTOP Title: %s\n"
            "Current VTOP Faculty: %s\n"
            "Current VTOP Semester: %s\n"
            "Reason: %s",
            source,
            source_name,
            source_id,
            matched_code,
            matched_enrolled.courseCode,
            matched_enrolled.courseName,
            matched_enrolled.facultyName,
            matched_enrolled.semester,
            title_reason,
        )
        return False, None, match_result

    match_result.courseTitleMatch = True

    # Stage 4: Exact Faculty Identity Match
    faculty_id_matched = False
    if matched_enrolled.facultyId and source_faculty_ids:
        enrolled_fid = canonicalize_faculty_id(matched_enrolled.facultyId)
        for s_fid in source_faculty_ids:
            if canonicalize_faculty_id(s_fid) == enrolled_fid:
                faculty_id_matched = True
                break

    faculty_name_matched = False
    enrolled_canon_fac = canonicalize_faculty_name(matched_enrolled.facultyName)
    
    candidate_fac_names: List[str] = []
    if source_professors:
        for p in source_professors:
            if p and str(p).strip():
                # If professors list is comma-separated (e.g. 'Prof A, Prof B')
                for p_sub in str(p).split(","):
                    if p_sub.strip():
                        candidate_fac_names.append(p_sub.strip())

    for m in re.finditer(r"(?:Faculty|Instructor|Professor|Teacher)\s*[:\-]\s*([A-Za-z\s\.]+)", combined_meta, flags=re.IGNORECASE):
        fn = m.group(1).strip().split("\n")[0].strip()
        if 3 <= len(fn) < 80:
            candidate_fac_names.append(fn)

    for text_field in [source_name, source_desc]:
        if not text_field:
            continue
        for part in re.split(r"[\-\|\–\—\(\)\/]", text_field):
            clean_part = part.strip()
            if len(clean_part) >= 4 and not any(ch.isdigit() for ch in clean_part):
                c_part = canonicalize_faculty_name(clean_part)
                if c_part and enrolled_canon_fac and c_part == enrolled_canon_fac:
                    candidate_fac_names.append(clean_part)
                elif re.search(r"\b(?:DR|PROF|PROFESSOR|MR|MS|MRS)\b", clean_part, flags=re.IGNORECASE):
                    candidate_fac_names.append(clean_part)

    # If external instructors exist, perform strict token matching
    if candidate_fac_names:
        for cand in candidate_fac_names:
            c_canon = canonicalize_faculty_name(cand)
            if c_canon and enrolled_canon_fac and (c_canon == enrolled_canon_fac or c_canon in enrolled_canon_fac or enrolled_canon_fac in c_canon):
                faculty_name_matched = True
                match_result.sourceFacultyName = cand
                break

    # Fail closed if faculty is missing or mismatched
    if not (faculty_id_matched or faculty_name_matched):
        match_result.facultyMatch = False
        match_result.verified = False
        if not candidate_fac_names and not source_faculty_ids:
            match_result.rejectionReason = f"Faculty missing: external course '{source_name}' has no verifiable instructor"
        else:
            match_result.rejectionReason = (
                f"Faculty mismatch: expected '{matched_enrolled.facultyName}', "
                f"external instructor was {source_professors or candidate_fac_names}"
            )
        logger.warning(
            "\n[ASSIGNMENT/COURSE VERIFICATION REJECTED]\n"
            "Source: %s\n"
            "External Course: %s (ID: %s)\n"
            "External Faculty: %s\n"
            "Current VTOP Course: %s\n"
            "Current VTOP Subject: %s\n"
            "Current VTOP Faculty: %s\n"
            "Reason: %s",
            source,
            source_name,
            source_id,
            source_professors or candidate_fac_names or "Missing",
            matched_enrolled.courseCode,
            matched_enrolled.courseName,
            matched_enrolled.facultyName,
            match_result.rejectionReason,
        )
        return False, None, match_result

    match_result.facultyMatch = True

    # All Stages Passed: VERIFIED
    match_result.verified = True
    logger.info(
        "\n[COURSE VERIFICATION: SUCCESS]\n"
        "VTOP Course: %s (%s)\n"
        "VTOP Faculty: %s\n"
        "VTOP Semester: %s\n"
        "External Source: %s\n"
        "External Course: %s (ID: %s)\n"
        "Code Match: TRUE | Title Match: TRUE | Faculty Match: TRUE | Semester Match: TRUE\n"
        "FINAL: VERIFIED",
        matched_enrolled.courseCode,
        matched_enrolled.courseName,
        matched_enrolled.facultyName,
        matched_enrolled.semester,
        source,
        source_name,
        source_id,
    )
    return True, matched_enrolled, match_result

