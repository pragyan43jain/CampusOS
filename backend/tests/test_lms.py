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

    def test_multi_cookie_support(self):
        from app.routers.lms import authenticate_lms_session
        with patch("app.routers.lms.requests.Session.get") as mock_get:
            r = MagicMock()
            r.status_code = 200
            r.text = '<div class="userbutton"><span class="usertext">Pragyan Jain</span></div>'
            mock_get.return_value = r

            sess, info = authenticate_lms_session(
                username=None,
                password=None,
                session_cookie="MoodleSession=test_session_123; cookiesession1=load_balancer_456",
            )
            assert info["sessionCookie"] == "test_session_123"
            assert "cookiesession1" in info["cookies"]
            assert info["cookies"]["cookiesession1"] == "load_balancer_456"

    def test_sync_lms_auto_reauth(self):
        store = storage.load_store()
        store["lmsConnected"] = True
        store["lmsAccount"] = {
            "username": "24BLC1100",
            "sessionCookie": None,
            "cookies": {},
        }
        storage.save_store(store)

        with patch("app.routers.lms.authenticate_lms_session") as mock_auth, \
             patch("app.routers.lms.fetch_vit_lms_coursework") as mock_fetch:
            fake_sess = MagicMock()
            mock_auth.return_value = (fake_sess, {
                "username": "24BLC1100",
                "displayName": "Pragyan Jain",
                "sessionCookie": "new_moodle_session",
                "cookies": {"MoodleSession": "new_moodle_session", "cookiesession1": "lb123"},
            })
            mock_fetch.return_value = ([], [], 0, [])

            res = client.post(
                "/api/lms/sync",
                headers={
                    "X-Reg-No": "24BLC1100",
                    "X-LMS-User": "24BLC1100",
                    "X-LMS-Pass": "SuperSecret123!",
                },
            )
            assert res.status_code == 200
            assert res.json()["success"] is True

            updated = storage.load_store()
            assert updated["lmsAccount"]["sessionCookie"] == "new_moodle_session"
            assert updated["lmsAccount"]["status"] == "connected"

    def test_sync_lms_expired_fails_descriptively_without_credentials(self):
        store = storage.load_store()
        store["lmsConnected"] = True
        store["lmsAccount"] = {
            "username": "24BLC1100",
            "sessionCookie": None,
            "cookies": {},
        }
        storage.save_store(store)

        res = client.post(
            "/api/lms/sync",
            headers={"X-Reg-No": "24BLC1100"},
        )
        assert res.status_code == 401
        assert "expired" in res.json()["detail"].lower()


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


class TestLMSAssignmentPosterExtraction:
    """
    Unit tests ensuring assignments fetched from LMS accurately extract and display
    the authentic professor who posted the assignment, rather than just the VTOP
    course-offered faculty name.
    """

    def test_extract_poster_from_assignment_view_signoff(self):
        from app.routers.lms import extract_assignment_poster

        session = MagicMock()
        r = MagicMock()
        r.status_code = 200
        r.text = '''
        <html>
        <body>
          <div id="intro" class="box generalbox">
            <p>Please complete Digital Assignment 1 on Relational Algebra.</p>
            <p>Regards,<br>Dr. S. Geetha</p>
          </div>
        </body>
        </html>
        '''
        session.get.return_value = r

        poster = extract_assignment_poster(
            session=session,
            assign_url="https://lms.vit.ac.in/mod/assign/view.php?id=123",
            title="Digital Assignment 1",
        )
        assert poster is not None
        assert "Geetha" in poster

    def test_extract_poster_from_author_class(self):
        from app.routers.lms import extract_assignment_poster

        session = MagicMock()
        r = MagicMock()
        r.status_code = 200
        r.text = '''
        <html>
        <body>
          <div class="activity-information">
            <span class="author">Posted by Prof. Jaya Vignesh</span>
          </div>
        </body>
        </html>
        '''
        session.get.return_value = r

        poster = extract_assignment_poster(
            session=session,
            assign_url="https://lms.vit.ac.in/mod/assign/view.php?id=456",
            title="DA 2",
        )
        assert poster == "Prof. Jaya Vignesh"

    def test_extract_poster_from_user_link(self):
        from app.routers.lms import extract_assignment_poster

        session = MagicMock()
        r = MagicMock()
        r.status_code = 200
        r.text = '''
        <html>
        <body>
          <div class="generalbox">
            <a href="https://lms.vit.ac.in/user/view.php?id=999">Dr. K. Ramesh</a>
          </div>
        </body>
        </html>
        '''
        session.get.return_value = r

        poster = extract_assignment_poster(
            session=session,
            assign_url="https://lms.vit.ac.in/mod/assign/view.php?id=789",
            title="Lab Task 3",
            student_name="Pragyan Jain",
        )
        assert poster == "Dr. K. Ramesh"

    def test_extract_poster_from_table_faculty_column(self):
        from app.routers.lms import fetch_assignments_for_lms_course

        session = MagicMock()
        r = MagicMock()
        r.status_code = 200
        r.text = '''
        <table class="generaltable mod_index">
          <thead>
            <tr>
              <th>Topic</th>
              <th>Assignment</th>
              <th>Faculty</th>
              <th>Due Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Module 1</td>
              <td><a href="/mod/assign/view.php?id=555">Networks Lab 1</a></td>
              <td>Dr. Priya Sharma</td>
              <td>Monday, 15 September 2026, 11:59 PM</td>
              <td>No submission</td>
            </tr>
          </tbody>
        </table>
        '''
        session.get.return_value = r

        vtop_course = {
            "code": "BCSE308P",
            "title": "Computer Networks Lab",
            "faculty": "RISHIKESHAN C A",  # VTOP course faculty
            "semester": "Fall Semester 2026-27",
        }

        assignments = fetch_assignments_for_lms_course(
            session=session,
            course_id="101",
            course_title="Computer Networks Lab",
            vtop_course=vtop_course,
        )
        assert len(assignments) == 1
        assign = assignments[0]
        # Must tell the name of the professor who posted it!
        assert assign["postedBy"] == "Dr. Priya Sharma"
        assert assign["facultyName"] == "Dr. Priya Sharma"
        assert assign["lmsProfessor"] == "Dr. Priya Sharma"

    def test_unified_assignments_preserves_lms_poster_over_vtop_faculty(self):
        from app.routers.unified_assignments import build_unified_assignment_dashboard

        store = {
            "selectedSemester": {"name": "Fall Semester 2026-27", "id": "CH20262701"},
            "courses": [
                {
                    "code": "BCSE302L",
                    "title": "Database Systems",
                    "faculty": "RISHIKESHAN C A",  # VTOP faculty
                }
            ],
            "assignments": [
                {
                    "id": "lms-808-123",
                    "courseCode": "BCSE302L",
                    "courseTitle": "Database Systems",
                    "title": "Digital Assignment 1",
                    "postedBy": "Dr. S. Geetha",  # Authentically posted on LMS by Dr. Geetha
                    "lmsProfessor": "Dr. S. Geetha",
                    "faculty": "RISHIKESHAN C A",
                    "source": "LMS",
                    "dueDate": "2026-09-30",
                    "dueTime": "23:59",
                    "status": "Pending",
                    "lmsCourseId": "808",
                    "verifiedCourseMatchId": "match-lms-808",
                }
            ],
        }

        dashboard = build_unified_assignment_dashboard(store)
        sub = next(s for s in dashboard["subjects"] if s["courseCode"] == "BCSE302L")
        assert len(sub["assignments"]) == 1
        assign = sub["assignments"][0]
        # In the assignment section, it must tell the name of the professor who posted it!
        assert assign["postedBy"] == "Dr. S. Geetha"
        assert assign["lmsProfessor"] == "Dr. S. Geetha"
        assert assign["facultyName"] == "Dr. S. Geetha"

    def test_lms_fetch_only_when_course_name_matches_vtop_professor(self):
        """
        Verify whether the course name is matching in the VTOP course professor name:
        If they match -> ONLY THEN fetch assignments!
        Otherwise -> DO NOT FETCH!
        """
        from app.routers.lms import _process_single_lms_course
        from app.course_verification import build_verified_semester_course_records

        store_data = {
            "selectedSemester": {"name": "Fall Semester 2026-27", "id": "CH20262701"},
            "courses": [
                {
                    "code": "BCSE302L",
                    "title": "Database Systems",
                    "faculty": "RISHIKESHAN C A",
                }
            ],
        }
        verified_enrolled = build_verified_semester_course_records(store_data)

        mock_session = MagicMock()
        mock_response = MagicMock()
        mock_response.status_code = 200
        mock_response.text = "<html><body>No assignments table</body></html>"
        mock_session.get.return_value = mock_response

        # 1. LMS course name matches VTOP professor name -> Succeeded and eligible to fetch
        matching_course = {
            "id": "1001",
            "title": "BCSE302L - Database Systems - RISHIKESHAN C A",
            "teachers": [],
        }
        meta, vtop, sub_assigns, summary = _process_single_lms_course(
            lms_c=matching_course,
            verified_enrolled=verified_enrolled,
            curr_sem_name="Fall Semester 2026-27",
            session=mock_session,
        )
        assert meta["verified"] is True
        assert vtop is not None
        assert vtop["facultyName"] == "RISHIKESHAN C A"
        assert summary is not None
        assert summary["faculty"] == "RISHIKESHAN C A"

        # 2. LMS course name has DIFFERENT professor -> DO NOT FETCH (rejected)
        wrong_prof_course = {
            "id": "1002",
            "title": "BCSE302L - Database Systems - DR. WRONG PROFESSOR",
            "teachers": [],
        }
        meta_wrong, vtop_wrong, sub_wrong, summary_wrong = _process_single_lms_course(
            lms_c=wrong_prof_course,
            verified_enrolled=verified_enrolled,
            curr_sem_name="Fall Semester 2026-27",
            session=mock_session,
        )
        assert meta_wrong["verified"] is False
        assert vtop_wrong is None
        assert sub_wrong == []
        assert summary_wrong is None

        # 3. LMS course name MISSING professor -> DO NOT FETCH (rejected)
        missing_prof_course = {
            "id": "1003",
            "title": "BCSE302L - Database Systems",
            "teachers": [],
        }
        meta_missing, vtop_missing, sub_missing, summary_missing = _process_single_lms_course(
            lms_c=missing_prof_course,
            verified_enrolled=verified_enrolled,
            curr_sem_name="Fall Semester 2026-27",
            session=mock_session,
        )
        assert meta_missing["verified"] is False
        assert vtop_missing is None
        assert sub_missing == []
        assert summary_missing is None

