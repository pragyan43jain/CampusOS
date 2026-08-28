"""
Unit tests for VIT LMS router, authentication, subject matching, and assignment extraction.
"""

import os
import tempfile
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app import storage
from app.main import app
from app.routers.lms import (
    match_lms_course_to_vtop,
    parse_moodle_date,
    normalize_code,
)

REAL_STORE = storage.DATA_FILE
storage.DATA_FILE = os.path.join(
    tempfile.mkdtemp(prefix="campusos-lms-test-"), "store.json"
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_store(tmp_path, monkeypatch):
    temp_file = str(tmp_path / "store.json")
    monkeypatch.setattr(storage, "DATA_FILE", temp_file)
    storage.save_store({
        "authenticated": False,
        "lmsConnected": False,
        "lmsAccount": None,
        "assignments": [],
        "courses": [
            {
                "code": "BCSE302L",
                "title": "Database Systems",
                "faculty": "RISHIKESHAN C A",
            },
            {
                "code": "BCSE308L",
                "title": "Computer Networks",
                "faculty": "JAYA VIGNESH T",
            },
        ],
    })
    yield


class TestLMSStatus:
    def test_status_when_disconnected(self):
        res = client.get("/api/lms/status")
        assert res.status_code == 200
        data = res.json()
        assert data["connected"] is False
        assert data["username"] is None
        assert data["totalAssignments"] == 0
        assert data["pendingCount"] == 0
        assert "lms.vit.ac.in" in data["portalUrl"]


class TestLMSMatchingAndParsing:
    def test_match_by_code(self):
        vtop_courses = [{"code": "BCSE302L", "title": "Database Systems", "faculty": "RISHIKESHAN C A"}]
        match = match_lms_course_to_vtop(
            "BCSE302L - Database Systems (Fall 2026) - RISHIKESHAN C A",
            "1024",
            vtop_courses,
            candidate_professors=["RISHIKESHAN C A"],
        )
        assert match is not None
        assert match["code"] == "BCSE302L"

    def test_title_without_course_code_fails(self):
        """Title only without course code must fail closed."""
        vtop_courses = [{"code": "BCSE308L", "title": "Computer Networks", "faculty": "JAYA VIGNESH T"}]
        match = match_lms_course_to_vtop("Computer Networks - Theory Class", "2048", vtop_courses, candidate_professors=["JAYA VIGNESH T"])
        assert match is None

    def test_theory_vs_lab_distinction(self):
        """BCSE308L must not match BCSE308P."""
        vtop_courses = [{"code": "BCSE308L", "title": "Computer Networks", "faculty": "JAYA VIGNESH T"}]
        match = match_lms_course_to_vtop(
            "Computer Networks Lab (BCSE308P)",
            "2048",
            vtop_courses,
            candidate_professors=["JAYA VIGNESH T"],
        )
        assert match is None

    def test_unrelated_course_does_not_match(self):
        vtop_courses = [{"code": "BCSE302L", "title": "Database Systems", "faculty": "RISHIKESHAN C A"}]
        match = match_lms_course_to_vtop("Extra French Language Workshop", "9999", vtop_courses)
        assert match is None

    def test_match_requires_both_enrolled_course_and_professor(self):
        vtop_courses = [{"code": "BCSE308L", "title": "Computer Networks", "faculty": "JAYA VIGNESH T"}]
        # 1. Matching course and matching professor -> Success
        match_ok = match_lms_course_to_vtop(
            "Computer Networks(BCSE308L)",
            "2179",
            vtop_courses,
            candidate_professors=["JAYA VIGNESH T"],
        )
        assert match_ok is not None
        assert match_ok["code"] == "BCSE308L"

        # 2. Matching course code, but different professor -> Reject
        match_wrong_prof = match_lms_course_to_vtop(
            "Computer Networks(BCSE308L)",
            "2179",
            vtop_courses,
            candidate_professors=["Dr. Random Teacher"],
        )
        assert match_wrong_prof is None

        # 3. Missing professor -> Reject
        match_no_prof = match_lms_course_to_vtop(
            "Computer Networks(BCSE308L)",
            "2179",
            vtop_courses,
            candidate_professors=None,
        )
        assert match_no_prof is None


    def test_moodle_date_parser(self):
        d, t = parse_moodle_date("Friday, 28 August 2026, 11:59 PM")
        assert d == "2026-08-28"
        assert t == "23:59"

        d2, t2 = parse_moodle_date("Thursday, 3 September 2026, 06:30 PM")
        assert d2 == "2026-09-03"
        assert t2 == "18:30"


class TestLMSAuthentication:
    def test_empty_request_rejected(self):
        res = client.post("/api/lms/login", json={})
        assert res.status_code == 400
        assert "required" in res.json()["detail"].lower()

    def test_invalid_credentials_returns_401(self):
        with patch("app.routers.lms.requests.Session.get") as mock_get, \
             patch("app.routers.lms.requests.Session.post") as mock_post:
            # Login page GET
            r_get = MagicMock()
            r_get.status_code = 200
            r_get.text = '<input name="logintoken" value="testtoken123"/>'
            mock_get.return_value = r_get

            # Login POST returns error
            r_post = MagicMock()
            r_post.status_code = 200
            r_post.url = "https://lms.vit.ac.in/login/index.php"
            r_post.text = '<div class="alert alert-danger">Invalid login, please try again</div>'
            mock_post.return_value = r_post

            res = client.post(
                "/api/lms/login",
                json={"username": "24BLC1100", "password": "WrongPassword!"},
            )
            assert res.status_code == 401
            assert "invalid credentials" in res.json()["detail"].lower()

    def test_successful_login_with_assignments(self):
        with patch("app.routers.lms.requests.Session.get") as mock_get, \
             patch("app.routers.lms.requests.Session.post") as mock_post:
            r_get = MagicMock()
            r_get.status_code = 200
            r_get.text = '<input name="logintoken" value="testtoken123"/>'

            r_post = MagicMock()
            r_post.status_code = 200
            r_post.url = "https://lms.vit.ac.in/my/"
            r_post.text = '<div class="userbutton"><span class="usertext">Pragyan Jain</span></div>'
            mock_post.return_value = r_post

            # Router for subsequent GET calls (/my/, /courses.php, /mod/assign/index.php)
            def mock_get_router(url, **kwargs):
                r = MagicMock()
                r.status_code = 200
                if "login" in url:
                    r.text = '<input name="logintoken" value="token123"/>'
                elif "/my" in url or "courses" in url:
                    r.text = '<a href="/course/view.php?id=808">BCSE302L - Database Systems - RISHIKESHAN C A</a>'
                elif "/mod/assign/index.php" in url:
                    r.text = '''
                    <table class="generaltable mod_index">
                    <tbody>
                    <tr>
                      <td>Topic 1</td>
                      <td><a href="https://lms.vit.ac.in/mod/assign/view.php?id=12345">Digital Assignment 1</a></td>
                      <td>Friday, 28 August 2026, 11:59 PM</td>
                      <td><span class="badge">No submission</span></td>
                    </tr>
                    </tbody>
                    </table>
                    '''
                return r

            mock_get.side_effect = mock_get_router

            res = client.post(
                "/api/lms/login",
                json={"username": "24BLC1100", "password": "ValidPassword123!"},
            )
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["matchedCount"] == 1
            assert data["lmsAssignmentsCount"] == 1

            assign = data["assignments"][0]
            assert assign["title"] == "Digital Assignment 1"
            assert assign["courseCode"] == "BCSE302L"
            assert assign["source"] == "LMS"
            assert assign["status"] == "Pending"
            assert "lms.vit.ac.in/mod/assign/view.php" in assign["platformUrl"]

    def test_disconnect_lms(self):
        store = storage.load_store()
        store["lmsConnected"] = True
        store["lmsAccount"] = {"username": "24BLC1100"}
        store["assignments"] = [{"id": "lms-1", "source": "LMS", "title": "Test"}]
        storage.save_store(store)

        res = client.post("/api/lms/disconnect")
        assert res.status_code == 200
        assert res.json()["success"] is True

        status = client.get("/api/lms/status").json()
        assert status["connected"] is False
        assert status["totalAssignments"] == 0


class TestLMSStrictVerificationAndAssignmentPipeline:
    """
    Automated test suite verifying all 17 mandatory LMS course mapping,
    faculty verification, and assignment pipeline rules.
    """

    @pytest.fixture
    def vtop_enrolled_courses(self):
        return [
            {
                "code": "BCSE308L",
                "title": "Computer Networks",
                "faculty": "RISHIKESHAN C A",
                "semester": "Fall Semester 2026-27",
            },
            {
                "code": "BCSE308P",
                "title": "Computer Networks Lab",
                "faculty": "RISHIKESHAN C A",
                "semester": "Fall Semester 2026-27",
            },
            {
                "code": "BMAT202L",
                "title": "Probability and Statistics",
                "faculty": "THANGARAJ M",
                "semester": "Fall Semester 2026-27",
            },
        ]

    # 1. Exact Course Code Match
    def test_lms_exact_course_code_match(self, vtop_enrolled_courses):
        match = match_lms_course_to_vtop(
            "Computer Networks(BCSE308L)",
            "2179",
            vtop_enrolled_courses,
            candidate_professors=["RISHIKESHAN C A"],
        )
        assert match is not None
        assert match["code"] == "BCSE308L"

    # 2. Course Code Mismatch Rejected
    def test_lms_course_code_mismatch_rejected(self, vtop_enrolled_courses):
        # BCSE308L vs BCSE308P must not match
        match_lab = match_lms_course_to_vtop(
            "Computer Networks Lab(BCSE308P)",
            "2057",
            [vtop_enrolled_courses[0]],  # Only BCSE308L enrolled
            candidate_professors=["RISHIKESHAN C A"],
        )
        assert match_lab is None

        # Unrelated course code
        match_other = match_lms_course_to_vtop(
            "Database Systems(BCSE302L)",
            "2269",
            vtop_enrolled_courses,
            candidate_professors=["RISHIKESHAN C A"],
        )
        assert match_other is None

    # 3. Exact Faculty Match
    def test_lms_exact_faculty_match(self, vtop_enrolled_courses):
        match = match_lms_course_to_vtop(
            "BCSE308L - Computer Networks",
            "2179",
            vtop_enrolled_courses,
            candidate_professors=["Dr. Rishikeshan C.A."],
        )
        assert match is not None
        assert match["code"] == "BCSE308L"

    # 4. Faculty Mismatch Rejected
    def test_lms_faculty_mismatch_rejected(self, vtop_enrolled_courses):
        match = match_lms_course_to_vtop(
            "Computer Networks(BCSE308L)",
            "2179",
            vtop_enrolled_courses,
            candidate_professors=["SARAVANA KUMAR R"],
        )
        assert match is None

    # 5. Same Course Different Faculty Rejected
    def test_lms_same_course_different_faculty_rejected(self, vtop_enrolled_courses):
        # VTOP has BCSE308L with RISHIKESHAN C A
        # LMS has BCSE308L taught by PRAVEEN JARAUT
        match = match_lms_course_to_vtop(
            "BCSE308L - Computer Networks - PRAVEEN JARAUT",
            "9988",
            vtop_enrolled_courses,
            candidate_professors=["PRAVEEN JARAUT"],
        )
        assert match is None

    # 6. Previous Semester Rejected
    def test_lms_previous_semester_rejected(self, vtop_enrolled_courses):
        match = match_lms_course_to_vtop(
            "BCSE308L - Computer Networks (Winter Semester 2025-26)",
            "1001",
            vtop_enrolled_courses,
            candidate_professors=["RISHIKESHAN C A"],
            current_semester="Fall Semester 2026-27",
        )
        assert match is None

    # 7. Current Semester Course Accepted
    def test_lms_current_semester_course_accepted(self, vtop_enrolled_courses):
        match = match_lms_course_to_vtop(
            "BCSE308L - Computer Networks (Fall Semester 2026-27)",
            "2179",
            vtop_enrolled_courses,
            candidate_professors=["RISHIKESHAN C A"],
            current_semester="Fall Semester 2026-27",
        )
        assert match is not None
        assert match["code"] == "BCSE308L"

    # 8. Assignment Inherits Verified Course
    def test_lms_assignment_inherits_verified_course(self, vtop_enrolled_courses):
        from app.routers.lms import fetch_assignments_for_lms_course

        session = MagicMock()
        r = MagicMock()
        r.status_code = 200
        r.text = '''
        <table class="mod_index">
          <tr><td>Topic</td><td><a href="/mod/assign/view.php?id=901">Lab Task 1</a></td><td>Friday, 28 August 2026, 11:59 PM</td><td>Submitted</td></tr>
        </table>
        '''
        session.get.return_value = r

        assignments = fetch_assignments_for_lms_course(
            session, "2057", "Computer Networks Lab(BCSE308P)", vtop_enrolled_courses[1]
        )
        assert len(assignments) == 1
        assign = assignments[0]
        assert assign["courseCode"] == "BCSE308P"
        assert assign["faculty"] == "RISHIKESHAN C A"
        assert assign["lmsCourseId"] == "2057"
        assert assign["verified"] is True
        assert assign["source"] == "LMS"
        assert assign["isDone"] is True
        assert assign["status"] == "Submitted"

    # 9. Assignment From Wrong Course Rejected
    def test_lms_assignment_from_wrong_course_rejected(self, vtop_enrolled_courses):
        from app.routers.unified_assignments import build_unified_assignment_dashboard

        store = {
            "selectedSemester": {"name": "Fall Semester 2026-27", "id": "CH20262701"},
            "courses": vtop_enrolled_courses,
            "assignments": [
                {
                    "id": "lms-unrelated-1",
                    "courseCode": "BMEE101L",  # Not enrolled
                    "title": "Thermodynamics Assignment",
                    "faculty": "RISHIKESHAN C A",
                    "source": "LMS",
                    "dueDate": "2026-09-01",
                }
            ],
        }
        dash = build_unified_assignment_dashboard(store)
        assert dash["totalAssignments"] == 0

    # 10. Assignment From Wrong Faculty Rejected
    def test_lms_assignment_from_wrong_faculty_rejected(self, vtop_enrolled_courses):
        from app.routers.unified_assignments import build_unified_assignment_dashboard

        store = {
            "selectedSemester": {"name": "Fall Semester 2026-27", "id": "CH20262701"},
            "courses": vtop_enrolled_courses,
            "assignments": [
                {
                    "id": "lms-wrongprof-1",
                    "courseCode": "BCSE308L",
                    "title": "Computer Networks Assignment 1",
                    "faculty": "SARAVANA KUMAR R",  # Wrong professor!
                    "source": "LMS",
                    "dueDate": "2026-09-01",
                }
            ],
        }
        dash = build_unified_assignment_dashboard(store)
        # Assignment from wrong faculty must be dropped
        assert dash["totalAssignments"] == 0
        bcse308 = next((s for s in dash["subjects"] if s["courseCode"] == "BCSE308L"), None)
        assert bcse308 is not None
        assert len(bcse308["assignments"]) == 0

    # 11. Global Assignment Is Filtered by Verified Course
    def test_lms_global_assignment_is_filtered_by_verified_course(self, vtop_enrolled_courses):
        from app.routers.unified_assignments import build_unified_assignment_dashboard

        store = {
            "selectedSemester": {"name": "Fall Semester 2026-27", "id": "CH20262701"},
            "courses": vtop_enrolled_courses,
            "assignments": [
                {
                    "id": "lms-valid-1",
                    "courseCode": "BCSE308L",
                    "title": "Networks Assignment 1",
                    "faculty": "RISHIKESHAN C A",
                    "source": "LMS",
                    "dueDate": "2026-09-01",
                },
                {
                    "id": "lms-global-unverified-2",
                    "courseCode": "BCSE308L",
                    "title": "Global Networks Quiz",
                    "faculty": "UNKNOWN PROFESSOR",
                    "source": "LMS",
                    "dueDate": "2026-09-01",
                },
            ],
        }
        dash = build_unified_assignment_dashboard(store)
        assert dash["totalAssignments"] == 1
        assert dash["subjects"][0]["assignments"][0]["title"] == "Networks Assignment 1"

    # 12. Multiple Course Candidates Disambiguation
    def test_lms_multiple_course_candidates(self, vtop_enrolled_courses):
        # Candidate 1: BCSE308L with wrong faculty
        match1 = match_lms_course_to_vtop(
            "BCSE308L - Computer Networks",
            "101",
            vtop_enrolled_courses,
            candidate_professors=["SARAVANA KUMAR R"],
        )
        assert match1 is None

        # Candidate 2: BCSE308L with correct faculty
        match2 = match_lms_course_to_vtop(
            "BCSE308L - Computer Networks",
            "102",
            vtop_enrolled_courses,
            candidate_professors=["RISHIKESHAN C A"],
        )
        assert match2 is not None
        assert match2["code"] == "BCSE308L"

    # 13. Ambiguous Course Match Rejected
    def test_lms_ambiguous_course_match_rejected(self, vtop_enrolled_courses):
        # Missing instructor and missing code in title
        match = match_lms_course_to_vtop(
            "General Theory Course",
            "999",
            vtop_enrolled_courses,
            candidate_professors=None,
        )
        assert match is None

    # 14. Assignment Deduplication
    def test_lms_assignment_deduplication(self, vtop_enrolled_courses):
        from app.routers.unified_assignments import build_unified_assignment_dashboard

        store = {
            "selectedSemester": {"name": "Fall Semester 2026-27", "id": "CH20262701"},
            "courses": vtop_enrolled_courses,
            "assignments": [
                {
                    "id": "teams-1",
                    "courseCode": "BCSE308L",
                    "title": "Digital Assignment 1",
                    "faculty": "RISHIKESHAN C A",
                    "source": "Teams",
                    "dueDate": "2026-09-05",
                    "dueTime": "23:59",
                    "status": "Pending",
                },
                {
                    "id": "lms-1",
                    "courseCode": "BCSE308L",
                    "title": "Digital Assignment 1",
                    "faculty": "RISHIKESHAN C A",
                    "source": "LMS",
                    "dueDate": "2026-09-05",
                    "dueTime": "23:59",
                    "status": "Submitted",
                },
            ],
        }
        dash = build_unified_assignment_dashboard(store)
        assert dash["totalAssignments"] == 1
        assign = dash["subjects"][0]["assignments"][0]
        assert assign["source"] == "Teams + LMS"
        assert assign["isDone"] is True
        assert assign["status"] == "DONE"

    # 15. Subject Isolation
    def test_lms_subject_isolation(self, vtop_enrolled_courses):
        from app.routers.unified_assignments import build_unified_assignment_dashboard

        store = {
            "selectedSemester": {"name": "Fall Semester 2026-27", "id": "CH20262701"},
            "courses": vtop_enrolled_courses,
            "assignments": [
                {
                    "id": "lms-net-1",
                    "courseCode": "BCSE308L",
                    "title": "Networks Task",
                    "faculty": "RISHIKESHAN C A",
                    "source": "LMS",
                    "dueDate": "2026-09-05",
                },
                {
                    "id": "lms-mat-1",
                    "courseCode": "BMAT202L",
                    "title": "Math Task",
                    "faculty": "THANGARAJ M",
                    "source": "LMS",
                    "dueDate": "2026-09-05",
                },
            ],
        }
        dash = build_unified_assignment_dashboard(store)
        net_sub = next(s for s in dash["subjects"] if s["courseCode"] == "BCSE308L")
        mat_sub = next(s for s in dash["subjects"] if s["courseCode"] == "BMAT202L")
        assert len(net_sub["assignments"]) == 1
        assert net_sub["assignments"][0]["title"] == "Networks Task"
        assert len(mat_sub["assignments"]) == 1
        assert mat_sub["assignments"][0]["title"] == "Math Task"

    # 16. Completed Assignment Remains Visible
    def test_lms_completed_assignment_remains_visible(self, vtop_enrolled_courses):
        from app.routers.unified_assignments import build_unified_assignment_dashboard

        store = {
            "selectedSemester": {"name": "Fall Semester 2026-27", "id": "CH20262701"},
            "courses": vtop_enrolled_courses,
            "assignments": [
                {
                    "id": "lms-comp-1",
                    "courseCode": "BCSE308P",
                    "title": "Expt 1 - Completed Lab",
                    "faculty": "RISHIKESHAN C A",
                    "source": "LMS",
                    "status": "Submitted",
                    "isDone": True,
                    "dueDate": "2026-08-20",
                }
            ],
        }
        dash = build_unified_assignment_dashboard(store)
        assert dash["totalAssignments"] == 1
        assert dash["totalSubmittedAssignments"] == 1
        sub = next(s for s in dash["subjects"] if s["courseCode"] == "BCSE308P")
        assert len(sub["assignments"]) == 1
        assert sub["assignments"][0]["status"] == "DONE"
        assert sub["assignments"][0]["isDone"] is True

    # 17. Submission Status Handling
    def test_lms_submission_status(self, vtop_enrolled_courses):
        from app.routers.unified_assignments import build_unified_assignment_dashboard

        store = {
            "selectedSemester": {"name": "Fall Semester 2026-27", "id": "CH20262701"},
            "courses": vtop_enrolled_courses,
            "assignments": [
                # 1. Submitted -> DONE
                {
                    "id": "lms-1",
                    "courseCode": "BCSE308L",
                    "title": "Task 1",
                    "faculty": "RISHIKESHAN C A",
                    "source": "LMS",
                    "status": "Submitted",
                    "isDone": True,
                    "dueDate": "2026-08-20",
                },
                # 2. Not submitted + future deadline -> PENDING
                {
                    "id": "lms-2",
                    "courseCode": "BCSE308L",
                    "title": "Task 2",
                    "faculty": "RISHIKESHAN C A",
                    "source": "LMS",
                    "status": "Pending",
                    "dueDate": "2026-12-30",
                    "dueTime": "23:59",
                },
                # 3. Not submitted + past deadline -> OVERDUE
                {
                    "id": "lms-3",
                    "courseCode": "BCSE308L",
                    "title": "Task 3",
                    "faculty": "RISHIKESHAN C A",
                    "source": "LMS",
                    "status": "Pending",
                    "dueDate": "2026-01-01",
                    "dueTime": "23:59",
                },
            ],
        }
        dash = build_unified_assignment_dashboard(store)
        sub = next(s for s in dash["subjects"] if s["courseCode"] == "BCSE308L")
        assigns = {a["title"]: a for a in sub["assignments"]}
        assert assigns["Task 1"]["status"] == "DONE"
        assert assigns["Task 1"]["isDone"] is True
        assert assigns["Task 2"]["status"] in ("PENDING", "Due Soon")
        assert assigns["Task 3"]["status"] == "OVERDUE"
        assert assigns["Task 3"]["isOverdue"] is True
