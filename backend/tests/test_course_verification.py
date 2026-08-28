"""
Unit tests for CampusOS Strict Course Code + Faculty + Title + Semester Verification Engine.
Validates all acceptance criteria in the specification:
1. Exact Course Code Matching (preserves theory vs lab, refuses partial/base codes)
2. Exact Faculty Identity Matching (refuses approximate, partial, or wrong professors)
3. Course Title Verification (rejects conflicting courses like Computer Architecture != Computer Networks)
4. Semester & Academic Year Isolation (prevents historical/archived semester courses from leaking)
5. Fail-Closed on missing data
6. Complete Regression Test Suite (TEST 1 to TEST 16 + Specific Bug Test)
"""

import pytest
from app.course_verification import (
    VerifiedCourseRecord,
    ExternalCourseMatch,
    canonicalize_course_code,
    canonicalize_faculty_name,
    canonicalize_faculty_id,
    extract_course_code_candidates,
    verify_course_title_match,
    verify_semester_match,
    build_verified_semester_course_records,
    verify_external_course,
)
from app.routers.unified_assignments import build_unified_assignment_dashboard, are_duplicate_assignments


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


class TestCourseTitleVerification:
    def test_matching_title_accepted(self):
        ok, reason = verify_course_title_match("Computer Networks", "BCSE308L - Computer Networks")
        assert ok is True
        assert reason is None

    def test_conflicting_title_rejected(self):
        # Computer Networks vs Computer Architecture must be rejected
        ok, reason = verify_course_title_match("Computer Networks", "BCSE308L - Computer Architecture")
        assert ok is False
        assert "Course title mismatch" in reason

    def test_substantive_title_overlap_accepted(self):
        ok, reason = verify_course_title_match("Database Systems", "BCSE302L Database Management Systems")
        assert ok is True

    def test_different_subject_same_generic_words_rejected(self):
        # Operating Systems vs Database Systems
        ok, reason = verify_course_title_match("Database Systems", "Operating Systems")
        assert ok is False


class TestSemesterVerification:
    def test_current_semester_accepted(self):
        ok, reason = verify_semester_match("Fall Semester 2026-27", "BCSE308L Fall 2026")
        assert ok is True

    def test_previous_academic_year_rejected(self):
        ok, reason = verify_semester_match("Fall Semester 2026-27", "BCSE308L Fall 2024")
        assert ok is False
        assert "Semester mismatch" in reason or "Academic year mismatch" in reason

    def test_previous_semester_season_rejected(self):
        ok, reason = verify_semester_match("Fall Semester 2026-27", "BCSE308L Winter 2025")
        assert ok is False

    def test_semester_number_mismatch_rejected(self):
        ok, reason = verify_semester_match("Semester 4", "BCSE308L Semester 3")
        assert ok is False
        assert "Semester mismatch" in reason


# ============================================================================
# Regression Test Suite: TEST 1 to TEST 16 & Specific Bug Test
# ============================================================================

class TestStrictRegressionScenarios:
    @pytest.fixture
    def canonical_store(self):
        return {
            "selectedSemester": {
                "name": "Fall Semester 2026-27",
                "id": "CH20262701",
            },
            "student": {
                "name": "PRAGYAN JAIN",
                "regNo": "24BLC1100",
                "semester": "Fall Semester 2026-27",
                "semesterId": "CH20262701",
            },
            "courses": [
                {
                    "code": "BCSE308L",
                    "title": "Computer Networks",
                    "faculty": "JAYA VIGNESH T",
                    "slot": "A2+TA2",
                },
                {
                    "code": "BCSE308P",
                    "title": "Computer Networks Lab",
                    "faculty": "JAYA VIGNESH T",
                    "slot": "L9+L10",
                },
                {
                    "code": "BECE355L",
                    "title": "Advanced Cloud Computing",
                    "faculty": "UPENDER P",
                    "slot": "C2+TC2",
                },
            ],
            "assignments": [],
        }

    def test_specific_bug_computer_architecture_assignment_prevented(self, canonical_store):
        """
        SPECIFIC BUG TEST:
        VTOP Current: Semester 4, BCSE308L, Computer Networks, JAYA VIGNESH T
        Historical LMS/Teams: Computer Architecture from previous semester
        Assignment: 'Digital Assignment 1'
        Result: MUST NEVER appear under BCSE308L Computer Networks.
        """
        enrolled_records = build_verified_semester_course_records(canonical_store)

        # 1. Verification of historical external course fails due to title and semester mismatch
        ok, rec, meta = verify_external_course(
            enrolled_records=enrolled_records,
            source="LMS",
            source_id="lms-old-999",
            source_name="BCSE308L - Computer Architecture (Winter 2025)",
            source_desc="Archived course from previous semester",
            source_professors=["JAYA VIGNESH T"],
            current_semester="Fall Semester 2026-27",
        )
        assert ok is False
        assert meta.verified is False

        # 2. Even if stale assignment was in store, dashboard builder purges it
        canonical_store["assignments"] = [
            {
                "id": "lms-stale-1",
                "title": "Digital Assignment 1",
                "courseCode": "BCSE308L",
                "courseTitle": "Computer Architecture",
                "faculty": "JAYA VIGNESH T",
                "semester": "Winter Semester 2024-25",
                "source": "LMS",
                "lmsCourseId": "lms-old-999",
                "dueDate": "2025-03-15",
                "dueTime": "23:59",
                "status": "Pending",
                "matchedLmsCourse": "Computer Architecture",
            }
        ]

        dashboard = build_unified_assignment_dashboard(canonical_store)
        net_subject = next(s for s in dashboard["subjects"] if s["courseCode"] == "BCSE308L")
        
        # Digital Assignment 1 must NOT be in Computer Networks
        assert len(net_subject["assignments"]) == 0
        assert net_subject["totalCount"] == 0

    def test_1_same_course_code_same_faculty_current_semester_accept(self, canonical_store):
        """TEST 1: Same course code + same faculty + current semester -> ACCEPT."""
        enrolled_records = build_verified_semester_course_records(canonical_store)
        ok, rec, meta = verify_external_course(
            enrolled_records=enrolled_records,
            source="Teams",
            source_id="team-1",
            source_name="BCSE308L - Computer Networks - JAYA VIGNESH T",
            source_professors=["JAYA VIGNESH T"],
            current_semester="Fall Semester 2026-27",
        )
        assert ok is True
        assert meta.verified is True
        assert rec.courseCode == "BCSE308L"

    def test_2_same_course_code_different_faculty_reject(self, canonical_store):
        """TEST 2: Same course code + different faculty -> REJECT."""
        enrolled_records = build_verified_semester_course_records(canonical_store)
        ok, rec, meta = verify_external_course(
            enrolled_records=enrolled_records,
            source="Teams",
            source_id="team-2",
            source_name="BCSE308L - Computer Networks - Dr. Ram Sharma",
            source_professors=["Dr. Ram Sharma"],
            current_semester="Fall Semester 2026-27",
        )
        assert ok is False
        assert meta.facultyMatch is False
        assert meta.verified is False

    def test_3_different_course_code_same_faculty_reject(self, canonical_store):
        """TEST 3: Different course code + same faculty -> REJECT."""
        enrolled_records = build_verified_semester_course_records(canonical_store)
        ok, rec, meta = verify_external_course(
            enrolled_records=enrolled_records,
            source="LMS",
            source_id="lms-3",
            source_name="BCSE202L - Data Structures - JAYA VIGNESH T",
            source_professors=["JAYA VIGNESH T"],
            current_semester="Fall Semester 2026-27",
        )
        assert ok is False
        assert meta.courseCodeMatch is False
        assert meta.verified is False

    def test_4_same_course_name_different_course_code_reject(self, canonical_store):
        """TEST 4: Same course name + different course code -> REJECT."""
        enrolled_records = build_verified_semester_course_records(canonical_store)
        ok, rec, meta = verify_external_course(
            enrolled_records=enrolled_records,
            source="Teams",
            source_id="team-4",
            source_name="BCSE208L - Computer Networks - JAYA VIGNESH T",
            source_professors=["JAYA VIGNESH T"],
            current_semester="Fall Semester 2026-27",
        )
        assert ok is False
        assert meta.courseCodeMatch is False
        assert meta.verified is False

    def test_5_same_course_code_previous_semester_reject(self, canonical_store):
        """TEST 5: Same course code + previous semester -> REJECT."""
        enrolled_records = build_verified_semester_course_records(canonical_store)
        ok, rec, meta = verify_external_course(
            enrolled_records=enrolled_records,
            source="LMS",
            source_id="lms-5",
            source_name="BCSE308L - Computer Networks (Winter 2025)",
            source_desc="Semester 3 winter course",
            source_professors=["JAYA VIGNESH T"],
            current_semester="Fall Semester 2026-27",
        )
        assert ok is False
        assert meta.semesterMatch is False
        assert meta.verified is False

    def test_6_same_course_code_previous_academic_year_reject(self, canonical_store):
        """TEST 6: Same course code + previous academic year -> REJECT."""
        enrolled_records = build_verified_semester_course_records(canonical_store)
        ok, rec, meta = verify_external_course(
            enrolled_records=enrolled_records,
            source="Teams",
            source_id="team-6",
            source_name="BCSE308L - Computer Networks 2024-25",
            source_desc="Archived 2024 batch",
            source_professors=["JAYA VIGNESH T"],
            current_semester="Fall Semester 2026-27",
        )
        assert ok is False
        assert meta.semesterMatch is False
        assert meta.verified is False

    def test_7_current_course_historical_assignment_reject(self, canonical_store):
        """TEST 7: Current course + historical assignment (stale assignment metadata) -> REJECT."""
        canonical_store["assignments"] = [
            {
                "id": "old-assign-7",
                "title": "Old CAT 1 Submission",
                "courseCode": "BCSE308L",
                "courseTitle": "Computer Networks",
                "faculty": "JAYA VIGNESH T",
                "semester": "Fall Semester 2024-25",  # Old semester tag
                "source": "LMS",
                "dueDate": "2024-09-10",
                "status": "Submitted",
            }
        ]
        dashboard = build_unified_assignment_dashboard(canonical_store)
        net_subject = next(s for s in dashboard["subjects"] if s["courseCode"] == "BCSE308L")
        assert len(net_subject["assignments"]) == 0

    def test_8_external_course_missing_faculty_reject(self, canonical_store):
        """TEST 8: External course has missing faculty -> REJECT."""
        enrolled_records = build_verified_semester_course_records(canonical_store)
        ok, rec, meta = verify_external_course(
            enrolled_records=enrolled_records,
            source="LMS",
            source_id="lms-8",
            source_name="BCSE308L - Computer Networks",
            source_professors=None,
            current_semester="Fall Semester 2026-27",
        )
        assert ok is False
        assert meta.facultyMatch is False
        assert meta.verified is False

    def test_9_external_course_missing_course_id_reject(self, canonical_store):
        """TEST 9: External course has missing/invalid course code -> REJECT."""
        enrolled_records = build_verified_semester_course_records(canonical_store)
        ok, rec, meta = verify_external_course(
            enrolled_records=enrolled_records,
            source="Teams",
            source_id="team-9",
            source_name="General Discussion Group - JAYA VIGNESH T",
            source_professors=["JAYA VIGNESH T"],
            current_semester="Fall Semester 2026-27",
        )
        assert ok is False
        assert meta.courseCodeMatch is False
        assert meta.verified is False

    def test_10_ambiguous_external_course_reject(self, canonical_store):
        """TEST 10: Ambiguous external course with multiple/unmatched codes -> REJECT."""
        enrolled_records = build_verified_semester_course_records(canonical_store)
        ok, rec, meta = verify_external_course(
            enrolled_records=enrolled_records,
            source="Teams",
            source_id="team-10",
            source_name="BCSE999L / BCSE888L Combined Class",
            source_professors=["JAYA VIGNESH T"],
            current_semester="Fall Semester 2026-27",
        )
        assert ok is False
        assert meta.verified is False

    def test_11_stale_cached_assignment_reject(self, canonical_store):
        """TEST 11: Stale cached assignment from un-enrolled course -> REJECT."""
        canonical_store["assignments"] = [
            {
                "id": "stale-11",
                "title": "Operating Systems Lab 1",
                "courseCode": "BCSE304L",  # Not in enrolled courses
                "courseTitle": "Operating Systems",
                "faculty": "PROF XYZ",
                "semester": "Fall Semester 2026-27",
                "source": "LMS",
                "dueDate": "2026-09-01",
                "status": "Pending",
            }
        ]
        dashboard = build_unified_assignment_dashboard(canonical_store)
        assert all(s["courseCode"] != "BCSE304L" for s in dashboard["subjects"])

    def test_12_valid_assignment_completed_submission_marked_done(self, canonical_store):
        """TEST 12: Valid assignment with completed submission -> ACCEPT and mark DONE."""
        canonical_store["assignments"] = [
            {
                "id": "teams-assign-12",
                "title": "Expt 1 - Network Packet Analysis",
                "courseCode": "BCSE308P",
                "courseTitle": "Computer Networks Lab",
                "faculty": "JAYA VIGNESH T",
                "semester": "Fall Semester 2026-27",
                "source": "Teams",
                "dueDate": "2026-09-10",
                "dueTime": "23:59",
                "status": "DONE",
                "applicationStatus": "DONE",
                "isDone": True,
                "isSubmitted": True,
                "submittedAt": "2026-09-08T10:00:00Z",
            }
        ]
        dashboard = build_unified_assignment_dashboard(canonical_store)
        lab_sub = next(s for s in dashboard["subjects"] if s["courseCode"] == "BCSE308P")
        assert len(lab_sub["assignments"]) == 1
        assert lab_sub["assignments"][0]["displayStatus"] == "DONE"
        assert lab_sub["submittedCount"] == 1
        assert lab_sub["pendingCount"] == 0

    def test_13_valid_assignment_pending_and_overdue_classified(self, canonical_store):
        """TEST 13: Valid assignment with no submission -> ACCEPT and mark PENDING/OVERDUE."""
        canonical_store["assignments"] = [
            {
                "id": "teams-assign-13a",
                "title": "Future Assignment",
                "courseCode": "BCSE308L",
                "courseTitle": "Computer Networks",
                "faculty": "JAYA VIGNESH T",
                "semester": "Fall Semester 2026-27",
                "source": "Teams",
                "dueDate": "2026-12-15",
                "dueTime": "23:59",
                "status": "Pending",
                "isDone": False,
            },
            {
                "id": "teams-assign-13b",
                "title": "Past Assignment",
                "courseCode": "BCSE308L",
                "courseTitle": "Computer Networks",
                "faculty": "JAYA VIGNESH T",
                "semester": "Fall Semester 2026-27",
                "source": "Teams",
                "dueDate": "2026-08-01",  # Past deadline
                "dueTime": "23:59",
                "status": "Pending",
                "isDone": False,
            },
        ]
        dashboard = build_unified_assignment_dashboard(canonical_store)
        net_sub = next(s for s in dashboard["subjects"] if s["courseCode"] == "BCSE308L")
        assert len(net_sub["assignments"]) == 2
        overdue_item = next(a for a in net_sub["assignments"] if a["id"] == "teams-assign-13b")
        assert overdue_item["isOverdue"] is True
        assert overdue_item["displayStatus"] == "OVERDUE"

    def test_14_valid_assignment_from_teams_accept(self, canonical_store):
        """TEST 14: Valid assignment from Teams -> ACCEPT."""
        canonical_store["assignments"] = [
            {
                "id": "teams-cloud-14",
                "title": "Cloud Architecture Design Project",
                "courseCode": "BECE355L",
                "courseTitle": "Advanced Cloud Computing",
                "faculty": "UPENDER P",
                "semester": "Fall Semester 2026-27",
                "source": "Teams",
                "dueDate": "2026-10-01",
                "dueTime": "23:59",
                "status": "Pending",
            }
        ]
        dashboard = build_unified_assignment_dashboard(canonical_store)
        cloud_sub = next(s for s in dashboard["subjects"] if s["courseCode"] == "BECE355L")
        assert len(cloud_sub["assignments"]) == 1
        assert cloud_sub["assignments"][0]["source"] == "Teams"

    def test_15_valid_assignment_from_lms_accept(self, canonical_store):
        """TEST 15: Valid assignment from LMS -> ACCEPT."""
        canonical_store["assignments"] = [
            {
                "id": "lms-cloud-15",
                "title": "Cloud Security Quiz",
                "courseCode": "BECE355L",
                "courseTitle": "Advanced Cloud Computing",
                "faculty": "UPENDER P",
                "semester": "Fall Semester 2026-27",
                "source": "LMS",
                "dueDate": "2026-10-05",
                "dueTime": "23:59",
                "status": "Pending",
            }
        ]
        dashboard = build_unified_assignment_dashboard(canonical_store)
        cloud_sub = next(s for s in dashboard["subjects"] if s["courseCode"] == "BECE355L")
        assert len(cloud_sub["assignments"]) == 1
        assert cloud_sub["assignments"][0]["source"] == "LMS"

    def test_16_same_assignment_lms_and_teams_deduplicate_after_verification(self, canonical_store):
        """TEST 16: Same assignment returned by LMS and Teams -> deduplicate only after course verified."""
        canonical_store["assignments"] = [
            {
                "id": "teams-dup-16",
                "title": "Assignment 1 - Subnetting and Routing",
                "courseCode": "BCSE308L",
                "courseTitle": "Computer Networks",
                "faculty": "JAYA VIGNESH T",
                "semester": "Fall Semester 2026-27",
                "source": "Teams",
                "platformUrl": "https://teams.microsoft.com/assign/1",
                "dueDate": "2026-09-20",
                "dueTime": "23:59",
                "status": "Pending",
            },
            {
                "id": "lms-dup-16",
                "title": "Assignment 1 - Subnetting and Routing",
                "courseCode": "BCSE308L",
                "courseTitle": "Computer Networks",
                "faculty": "JAYA VIGNESH T",
                "semester": "Fall Semester 2026-27",
                "source": "LMS",
                "platformUrl": "https://lms.vit.ac.in/assign/1",
                "dueDate": "2026-09-20",
                "dueTime": "23:59",
                "status": "Submitted",
                "isDone": True,
            },
        ]
        dashboard = build_unified_assignment_dashboard(canonical_store)
        net_sub = next(s for s in dashboard["subjects"] if s["courseCode"] == "BCSE308L")
        # Merged into a single item
        assert len(net_sub["assignments"]) == 1
        merged_item = net_sub["assignments"][0]
        assert merged_item["source"] == "Teams + LMS"
        assert merged_item["displayStatus"] == "DONE"
        assert merged_item["teamsSubmissionUrl"] == "https://teams.microsoft.com/assign/1"
        assert merged_item["lmsSubmissionUrl"] == "https://lms.vit.ac.in/assign/1"

