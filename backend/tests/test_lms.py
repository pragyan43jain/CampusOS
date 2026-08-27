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
            "BCSE302L - Database Systems (WIN 2026) - RISHIKESHAN C A",
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
