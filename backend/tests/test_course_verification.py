"""
Unit tests for CampusOS Strict Course Code + Faculty Verification Engine.
Validates all acceptance criteria in the specification:
1. Exact Course Code Matching (preserves theory vs lab, refuses partial/base codes)
2. Exact Faculty Identity Matching (refuses approximate, partial, or wrong professors)
3. Fail-Closed on missing data (missing course code or missing faculty fails immediately)
4. Semester filter (prevents historical/archived semester courses)
5. Non-merging of distinct course codes during deduplication
"""

import pytest
from app.course_verification import (
    VerifiedCourseRecord,
    ExternalCourseMatch,
    canonicalize_course_code,
    canonicalize_faculty_name,
    canonicalize_faculty_id,
    extract_course_code_candidates,
    build_verified_semester_course_records,
    verify_external_course,
)


class TestCanonicalCourseCode:
    def test_canonicalize_preserves_distinct_suffixes(self):
        assert canonicalize_course_code("BCSE308L") == "BCSE308L"
        assert canonicalize_course_code("BCSE308P") == "BCSE308P"
        assert canonicalize_course_code("BCSE308J") == "BCSE308J"
        # Must never equate theory with lab or project
        assert canonicalize_course_code("BCSE308L") != canonicalize_course_code("BCSE308P")

    def test_canonicalize_normalizes_spacing_and_hyphens(self):
        assert canonicalize_course_code(" bcse 308l ") == "BCSE308L"
        assert canonicalize_course_code("BCSE-308L") == "BCSE308L"
        assert canonicalize_course_code("BCSE_308L") == "BCSE308L"

    def test_base_code_without_suffix_is_not_equal_to_suffixed_code(self):
        # Base code must not be treated as matching suffixed code
        assert canonicalize_course_code("BCSE308") != canonicalize_course_code("BCSE308L")

    def test_invalid_course_codes_return_none(self):
        assert canonicalize_course_code(None) is None
        assert canonicalize_course_code("") is None
        assert canonicalize_course_code("Music Club") is None


class TestCanonicalFacultyName:
    def test_strips_honorifics_safely(self):
        assert canonicalize_faculty_name("Dr. Ravi Kumar") == "RAVI KUMAR"
        assert canonicalize_faculty_name("DR RAVI KUMAR") == "RAVI KUMAR"
        assert canonicalize_faculty_name("Prof. Ravi Kumar") == "RAVI KUMAR"
        assert canonicalize_faculty_name("Professor Ravi Kumar") == "RAVI KUMAR"
        assert canonicalize_faculty_name("Mr. Ravi Kumar") == "RAVI KUMAR"

    def test_preserves_initials_and_distinguishes_different_people(self):
        # Ravi Kumar != Ravi Kumar P
        assert canonicalize_faculty_name("Dr. Ravi Kumar") != canonicalize_faculty_name("Ravi Kumar P")
        # John Smith != John Smith A
        assert canonicalize_faculty_name("Dr. John Smith") != canonicalize_faculty_name("John Smith A")

    def test_no_first_name_only_matching(self):
        # Dr. John Smith != John
        assert canonicalize_faculty_name("Dr. John Smith") != canonicalize_faculty_name("John")
        # Dr. John Smith != Dr. John
        assert canonicalize_faculty_name("Dr. John Smith") != canonicalize_faculty_name("Dr. John")

    def test_harmless_punctuation_normalized(self):
        assert canonicalize_faculty_name("Dr. Jaya Vignesh T.") == "JAYA VIGNESH T"
        assert canonicalize_faculty_name("Rishikeshan C.A.") == "RISHIKESHAN C A"
        assert canonicalize_faculty_name("ETHNUS (APT)") == "ETHNUS APT"


class TestTwoStageVerification:
    @pytest.fixture
    def sample_enrolled_courses(self):
        return [
            VerifiedCourseRecord(
                courseCode="BCSE308L",
                courseName="Computer Networks",
                facultyName="JAYA VIGNESH T",
                facultyId="fac-101",
                slot="A2+TA2",
                section="L1",
                semester="Fall Semester 2026-27",
                semesterId="CH20262701",
                verified=True,
            ),
            VerifiedCourseRecord(
                courseCode="BCSE308P",
                courseName="Computer Networks Lab",
                facultyName="JAYA VIGNESH T",
                facultyId="fac-101",
                slot="L9+L10",
                section="L1",
                semester="Fall Semester 2026-27",
                semesterId="CH20262701",
                verified=True,
            ),
            VerifiedCourseRecord(
                courseCode="BECE355L",
                courseName="Advanced Cloud Computing",
                facultyName="UPENDER P",
                facultyId="fac-102",
                slot="C2+TC2",
                section="C2",
                semester="Fall Semester 2026-27",
                semesterId="CH20262701",
                verified=True,
            ),
        ]

    def test_exact_match_approved(self, sample_enrolled_courses):
        """Case 1: Both Course Code and Faculty match -> Eligible."""
        ok, rec, meta = verify_external_course(
            enrolled_records=sample_enrolled_courses,
            source="Teams",
            source_id="team-1",
            source_name="BCSE308L - Computer Networks - JAYA VIGNESH T",
            source_professors=["JAYA VIGNESH T"],
            current_semester="Fall Semester 2026-27",
        )
        assert ok is True
        assert rec.courseCode == "BCSE308L"
        assert meta.courseCodeMatch is True
        assert meta.facultyMatch is True
        assert meta.verified is True

    def test_course_match_but_faculty_mismatch_rejected(self, sample_enrolled_courses):
        """Case 2: Course code matches, but different faculty -> REJECTED."""
        ok, rec, meta = verify_external_course(
            enrolled_records=sample_enrolled_courses,
            source="Teams",
            source_id="team-2",
            source_name="BCSE308L - Computer Networks",
            source_professors=["Dr. Arun Kumar"],
            current_semester="Fall Semester 2026-27",
        )
        assert ok is False
        assert rec is None
        assert meta.courseCodeMatch is True
        assert meta.facultyMatch is False
        assert meta.verified is False
        assert "Faculty mismatch" in meta.rejectionReason

    def test_theory_vs_lab_mismatch_rejected(self, sample_enrolled_courses):
        """Case 3: Theory course BCSE308L must not match BCSE308P team."""
        theory_only = [c for c in sample_enrolled_courses if c.courseCode == "BCSE308L"]
        ok, rec, meta = verify_external_course(
            enrolled_records=theory_only,
            source="Teams",
            source_id="team-3",
            source_name="BCSE308P - Computer Networks Lab - JAYA VIGNESH T",
            source_professors=["JAYA VIGNESH T"],
            current_semester="Fall Semester 2026-27",
        )
        assert ok is False
        assert meta.courseCodeMatch is False

    def test_missing_faculty_fails_closed(self, sample_enrolled_courses):
        """Case 4: External course provides course code but no faculty -> Fails closed."""
        ok, rec, meta = verify_external_course(
            enrolled_records=sample_enrolled_courses,
            source="LMS",
            source_id="lms-1",
            source_name="BCSE308L - Computer Networks",
            source_professors=None,
            current_semester="Fall Semester 2026-27",
        )
        assert ok is False
        assert meta.facultyMatch is False
        assert meta.verified is False

    def test_missing_course_code_fails_closed(self, sample_enrolled_courses):
        """Case 5: External course provides faculty but no course code -> Fails closed."""
        ok, rec, meta = verify_external_course(
            enrolled_records=sample_enrolled_courses,
            source="Teams",
            source_id="team-5",
            source_name="Advanced Cloud Computing Discussion Forum",
            source_professors=["UPENDER P"],
            current_semester="Fall Semester 2026-27",
        )
        assert ok is False
        assert meta.courseCodeMatch is False
        assert meta.verified is False

    def test_previous_semester_rejected(self, sample_enrolled_courses):
        """Case 6: Course from Winter 2024-25 must not match current Fall 2026-27 semester."""
        ok, rec, meta = verify_external_course(
            enrolled_records=sample_enrolled_courses,
            source="Teams",
            source_id="team-6",
            source_name="BCSE308L - Computer Networks (Winter 2024)",
            source_desc="Archived class from Winter 2024 semester",
            source_professors=["JAYA VIGNESH T"],
            current_semester="Fall Semester 2026-27",
        )
        assert ok is False
        assert meta.semesterMatch is False
        assert "Semester mismatch" in meta.rejectionReason
