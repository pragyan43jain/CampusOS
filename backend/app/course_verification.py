"""
CampusOS Backend - Strict Course Code + Faculty Verification Engine

Architecture: "STUDENT CURRENT SEMESTER -> ENROLLED COURSE -> EXACT COURSE CODE MATCH -> EXACT FACULTY MATCH -> VERIFIED EXTERNAL COURSE -> FETCH ASSIGNMENTS"

Mandates:
1. Source of truth is student's currently enrolled semester data from VTOP.
2. An external Teams or LMS course is eligible for assignment retrieval ONLY when:
   exactCourseCodeMatch == True AND exactFacultyMatch == True.
3. Fail-closed: missing course code or missing faculty fails the match.
4. No loose partial code matching (BCSE308L != BCSE308P, BCSE308L != BCSE308).
5. Full faculty identity matching with safe canonical formatting (Dr./Prof. removal, whitespace/case normalization, preserving initials).
"""

import logging
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional, Tuple

from pydantic import BaseModel, Field

logger = logging.getLogger("vtop.course_verification")


# ============================================================================
# 1. Models
# ============================================================================

class VerifiedCourseRecord(BaseModel):
    """Authoritative course + faculty pair from the student's current semester in VTOP."""
    courseCode: str
    courseName: str
    facultyName: str
    facultyId: Optional[str] = None
    slot: Optional[str] = None
    section: Optional[str] = None
    semester: str
    semesterId: str
    verified: bool = True


class ExternalCourseMatch(BaseModel):
    """Verification record for a synchronized external Teams/LMS course."""
    userId: Optional[str] = None
    semesterId: str
    source: str  # "Teams" or "LMS"
    sourceCourseId: str
    sourceCourseName: str
    sourceCourseCode: Optional[str] = None
    sourceFacultyId: Optional[str] = None
    sourceFacultyName: Optional[str] = None
    sourceSection: Optional[str] = None

    matchedSubjectId: Optional[str] = None
    matchedCourseCode: Optional[str] = None
    matchedFacultyId: Optional[str] = None
    matchedFacultyName: Optional[str] = None

    courseCodeMatch: bool = False
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
    # Check for standard university course pattern: 3-4 letters + 3-4 digits + optional 1-2 letters
    if re.match(r"^[A-Z]{3,4}\d{3,4}[A-Z]{0,2}$", clean):
        return clean
    return None


def extract_course_code_candidates(text: Optional[str]) -> List[str]:
    """
    Extracts all potential academic course code tokens from a string (e.g. channel or course name).
    Matches patterns like 'BCSE308L', 'BCSE 308P', 'BECE355L', 'BMAT202L'.
    """
    if not text:
        return []
    text_upper = str(text).upper()
    # Find all pattern sequences of letters followed by digits and optional letters
    raw_matches = re.findall(r"\b([A-Z]{3,4}\s*[-_]?\s*\d{3,4}[A-Z]{0,2})\b", text_upper)
    candidates = []
    for rm in raw_matches:
        canon = canonicalize_course_code(rm)
        if canon and canon not in candidates:
            candidates.append(canon)
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
    # Strip honorific prefix
    clean = re.sub(r"^(?:DR|PROF|PROFESSOR|MR|MS|MRS|DOC)\b\.?\s*", "", clean, flags=re.IGNORECASE).strip()
    # Replace dots, commas, semicolons with space so initials stay separate tokens
    clean = re.sub(r"[\.,;]", " ", clean)
    # Strip harmless parentheses around department/affiliations: "(APT)" -> "APT"
    clean = re.sub(r"[\(\)]", " ", clean)
    # Collapse multiple whitespace
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


# ============================================================================
# 3. Verified Semester Course Records Builder
# ============================================================================

def build_verified_semester_course_records(store: Dict[str, Any]) -> List[VerifiedCourseRecord]:
    """
    Source of truth builder:
    1. Identifies the student's selected semester from actual VTOP data.
    2. Retrieves enrolled courses for that semester.
    3. Retrieves verified faculty assigned to each course.
    4. Creates immutable verified course + faculty pairs.
    5. Fails closed if faculty is missing from enrolled course record.
    """
    sem = store.get("selectedSemester") or {}
    student = store.get("student") or {}

    sem_name = sem.get("name") or student.get("semester") or "Fall Semester 2026-27"
    sem_id = sem.get("id") or student.get("semesterId") or "CH20262701"

    courses = list(store.get("courses") or [])
    verified_records: List[VerifiedCourseRecord] = []

    for c in courses:
        code = canonicalize_course_code(c.get("code") or c.get("courseCode"))
        title = (c.get("title") or c.get("courseTitle") or c.get("courseName") or "").strip()
        faculty_raw = (c.get("faculty") or c.get("facultyName") or "").strip()
        faculty_id = c.get("facultyId") or (f"fac-{re.sub(r'[^a-z0-9]', '-', faculty_raw.lower())}" if faculty_raw else None)
        slot = (c.get("slot") or "").strip()

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
            courseCode=code,
            courseName=title or code,
            facultyName=faculty_raw,
            facultyId=faculty_id,
            slot=slot if slot else None,
            section=extract_section(slot) or extract_section(c.get("section")),
            semester=sem_name,
            semesterId=sem_id,
            verified=True,
        ))

    logger.info("Built %d verified course+faculty pairs for semester '%s'", len(verified_records), sem_name)
    return verified_records


# ============================================================================
# 4. Two-Stage Strict Verification Engine
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
    Strict Two-Stage Verification:
    Stage 1: EXACT COURSE CODE MATCH
    Stage 2: EXACT FACULTY IDENTITY MATCH
    
    Fails closed if either is missing or does not match fully.
    Never falls back to course code only or faculty only.
    """
    sem_id = enrolled_records[0].semesterId if enrolled_records else "CH20262701"
    match_result = ExternalCourseMatch(
        semesterId=sem_id,
        source=source,
        sourceCourseId=str(source_id),
        sourceCourseName=source_name,
        sourceFacultyName=", ".join(source_professors) if source_professors else None,
    )

    # 1. Semester Check: Reject if external course explicitly references another semester
    combined_meta = f"{source_name} {source_desc}".upper()
    if current_semester:
        curr_sem_upper = current_semester.upper()
        # Look for past or future semester names like "WINTER SEMESTER 2025-26", "FALL 2024", etc.
        for term in ["FALL", "WINTER", "SUMMER"]:
            for yr in range(2020, 2030):
                sem_str = f"{term} {yr}"
                sem_str2 = f"{term} SEMESTER {yr}"
                if (sem_str in combined_meta or sem_str2 in combined_meta) and (sem_str not in curr_sem_upper):
                    match_result.semesterMatch = False
                    match_result.verified = False
                    match_result.rejectionReason = f"Semester mismatch: course belongs to {sem_str}, not current semester {current_semester}"
                    logger.warning("[Assignment Matcher] REJECTED: %s", match_result.rejectionReason)
                    return False, None, match_result

    # 2. Stage 1: Exact Course Code Match
    extracted_codes = extract_course_code_candidates(source_name) + extract_course_code_candidates(source_desc)
    if not extracted_codes:
        match_result.courseCodeMatch = False
        match_result.verified = False
        match_result.rejectionReason = "Course code missing: no valid course code found in external course metadata"
        logger.debug("[Assignment Matcher] REJECTED %s '%s': %s", source, source_name, match_result.rejectionReason)
        return False, None, match_result

    # Find candidate enrolled course
    matched_enrolled: Optional[VerifiedCourseRecord] = None
    matched_code: Optional[str] = None
    for cand_code in extracted_codes:
        c_found = next((r for r in enrolled_records if canonicalize_course_code(r.courseCode) == cand_code), None)
        if c_found:
            matched_enrolled = c_found
            matched_code = cand_code
            break

    if not matched_enrolled:
        match_result.courseCodeMatch = False
        match_result.verified = False
        match_result.rejectionReason = f"Course code mismatch: extracted codes {extracted_codes} not in student's enrolled courses"
        logger.debug("[Assignment Matcher] REJECTED %s '%s': %s", source, source_name, match_result.rejectionReason)
        return False, None, match_result

    match_result.courseCodeMatch = True
    match_result.sourceCourseCode = matched_code
    match_result.matchedSubjectId = matched_enrolled.courseCode
    match_result.matchedCourseCode = matched_enrolled.courseCode
    match_result.matchedFacultyId = matched_enrolled.facultyId
    match_result.matchedFacultyName = matched_enrolled.facultyName

    # 3. Stage 2: Exact Faculty Identity Match
    # Priority 1: Stable Faculty ID Match
    faculty_id_matched = False
    if matched_enrolled.facultyId and source_faculty_ids:
        enrolled_fid = canonicalize_faculty_id(matched_enrolled.facultyId)
        for s_fid in source_faculty_ids:
            if canonicalize_faculty_id(s_fid) == enrolled_fid:
                faculty_id_matched = True
                break

    # Priority 2: Full Canonical Name Match
    faculty_name_matched = False
    enrolled_canon_fac = canonicalize_faculty_name(matched_enrolled.facultyName)
    
    candidate_fac_names: List[str] = []
    if source_professors:
        candidate_fac_names.extend(source_professors)

    # Check if external title or description has explicitly stated faculty name
    # e.g. "BCSE308L - Computer Networks - JAYA VIGNESH T"
    for part in re.split(r"[\-\|\–\—\:]", f"{source_name} - {source_desc}"):
        clean_part = part.strip()
        if len(clean_part) >= 4 and not any(ch.isdigit() for ch in clean_part):
            candidate_fac_names.append(clean_part)

    # Check candidate names strictly
    for cand in candidate_fac_names:
        c_canon = canonicalize_faculty_name(cand)
        if c_canon and enrolled_canon_fac and c_canon == enrolled_canon_fac:
            faculty_name_matched = True
            match_result.sourceFacultyName = cand
            break

    if faculty_id_matched or faculty_name_matched:
        match_result.facultyMatch = True
    else:
        match_result.facultyMatch = False
        match_result.verified = False
        match_result.rejectionReason = (
            f"Faculty mismatch: expected '{matched_enrolled.facultyName}', "
            f"external instructor was {source_professors or candidate_fac_names or 'unspecified'}"
        )
        logger.warning(
            "[Assignment Matcher]\n"
            "Semester: %s\n"
            "Student Course: %s (Faculty: %s)\n"
            "%s Course: %s (Faculty: %s)\n"
            "Course Match: True\n"
            "Faculty Match: False\n"
            "Eligible: False\n"
            "Assignments skipped.",
            matched_enrolled.semester,
            matched_enrolled.courseCode,
            matched_enrolled.facultyName,
            source,
            source_name,
            source_professors or "None",
        )
        return False, None, match_result

    # 4. Optional Section Verification (if available in both)
    ext_section = extract_section(source_name) or extract_section(source_desc)
    if matched_enrolled.section and ext_section:
        if matched_enrolled.section.upper() != ext_section.upper():
            logger.info("Section distinction note: enrolled %s, external %s", matched_enrolled.section, ext_section)

    # 5. Full Match Verified
    match_result.verified = True
    logger.info(
        "[Assignment Matcher]\n"
        "Semester: %s\n"
        "Student Course: %s (Faculty: %s)\n"
        "%s Course: %s (Faculty: %s)\n"
        "Course Match: True\n"
        "Faculty Match: True\n"
        "Eligible: True",
        matched_enrolled.semester,
        matched_enrolled.courseCode,
        matched_enrolled.facultyName,
        source,
        source_name,
        match_result.sourceFacultyName or matched_enrolled.facultyName,
    )
    return True, matched_enrolled, match_result
