"""
Unit tests for Microsoft Teams authentication and coursework synchronization router.

Tests:
1. Status reporting when disconnected.
2. Input validation for email and password.
3. Verification of Microsoft domain realm.
4. Correct 401 response on invalid password (AADSTS50126).
5. Correct 401 response on unknown user account (AADSTS50034).
6. Correct 401 response on locked account (AADSTS50053).
7. Matching of VTOP enrolled subjects with Microsoft Teams enrolled subjects.
8. Fetching authentic assignments from the matched subject's assignments section in Teams.
9. Successful authentication with real tokens and zero-fake-data guarantee.
10. Sync and disconnect lifecycle.
"""

import os
import tempfile
from unittest.mock import MagicMock, patch

import pytest
from fastapi.testclient import TestClient

from app import storage
from app.main import app
from app.routers.teams import (
    match_team_to_vtop_course,
    fetch_assignments_for_matched_team,
    normalize_course_code,
    get_base_code,
)

# Isolate DATA_FILE at module load time so test executions never touch real store.json
REAL_STORE = storage.DATA_FILE
storage.DATA_FILE = os.path.join(
    tempfile.mkdtemp(prefix="campusos-teams-test-"), "store.json"
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_store(tmp_path, monkeypatch):
    """Ensure each test runs against a clean isolated store file."""
    temp_file = str(tmp_path / "store.json")
    monkeypatch.setattr(storage, "DATA_FILE", temp_file)
    storage.save_store({
        "authenticated": False,
        "teamsConnected": False,
        "teamsAccount": None,
        "assignments": [],
        "courses": [
            {
                "code": "BCSE302L",
                "title": "Database Systems",
                "faculty": "RISHIKESHAN C A",
                "slot": "F2+TF2",
            },
            {
                "code": "BCSE308L",
                "title": "Computer Networks",
                "faculty": "JAYA VIGNESH T",
                "slot": "A2+TA2",
            },
            {
                "code": "BECE303L",
                "title": "VLSI System Design",
                "faculty": "SARAVANA KUMAR R",
                "slot": "B2+TB2",
            },
        ],
    })
    yield


class TestTeamsStatus:
    def test_status_when_disconnected(self):
        res = client.get("/api/teams/status")
        assert res.status_code == 200
        data = res.json()
        assert data["connected"] is False
        assert data["email"] is None
        assert data["totalAssignments"] == 0
        assert data["pendingCount"] == 0
        assert data["submittedCount"] == 0
        assert "microsoft.com" in data["portal"]


class TestTeamsValidation:
    def test_empty_email_rejected(self):
        res = client.post("/api/teams/login", json={"email": "", "password": "password123"})
        assert res.status_code == 400
        assert "email" in res.json()["detail"].lower()

    def test_missing_password_rejected(self):
        res = client.post("/api/teams/login", json={"email": "student@vitstudent.ac.in", "password": ""})
        assert res.status_code == 400
        assert "password" in res.json()["detail"].lower()

    def test_invalid_email_format_rejected(self):
        res = client.post("/api/teams/login", json={"email": "notanemail", "password": "password123"})
        assert res.status_code == 400
        assert "email" in res.json()["detail"].lower()

    def test_unregistered_domain_rejected(self):
        with patch("app.routers.teams.requests.get") as mock_get:
            mock_res = MagicMock()
            mock_res.status_code = 200
            mock_res.json.return_value = {"NameSpaceType": "Unknown"}
            mock_get.return_value = mock_res

            res = client.post(
                "/api/teams/login",
                json={"email": "student@fakeunknownnonmicrosoft.edu", "password": "password123"},
            )
            assert res.status_code == 400
            assert "not recognized" in res.json()["detail"] or "not registered" in res.json()["detail"]


class TestTeamsAuthenticationErrors:
    def test_wrong_password_returns_401_invalid_credentials(self):
        """Simulates Microsoft returning AADSTS50126 (wrong password)."""
        with patch("app.routers.teams.requests.post") as mock_post, \
             patch("app.routers.teams.requests.get") as mock_get:
            mock_realm = MagicMock()
            mock_realm.status_code = 200
            mock_realm.json.return_value = {"NameSpaceType": "Managed"}
            mock_get.return_value = mock_realm

            mock_auth = MagicMock()
            mock_auth.status_code = 400
            mock_auth.json.return_value = {
                "error": "invalid_grant",
                "error_codes": [50126],
                "error_description": "AADSTS50126: Error validating credentials due to invalid username or password.",
            }
            mock_post.return_value = mock_auth

            res = client.post(
                "/api/teams/login",
                json={"email": "student@vitstudent.ac.in", "password": "WrongPassword123!"},
            )
            assert res.status_code == 401
            assert "invalid credentials" in res.json()["detail"].lower()
            assert "password" in res.json()["detail"].lower()

    def test_unknown_user_returns_401_invalid_credentials(self):
        """Simulates Microsoft returning AADSTS50034 (user not found)."""
        with patch("app.routers.teams.requests.post") as mock_post, \
             patch("app.routers.teams.requests.get") as mock_get:
            mock_realm = MagicMock()
            mock_realm.status_code = 200
            mock_realm.json.return_value = {"NameSpaceType": "Managed"}
            mock_get.return_value = mock_realm

            mock_auth = MagicMock()
            mock_auth.status_code = 400
            mock_auth.json.return_value = {
                "error": "invalid_grant",
                "error_codes": [50034],
                "error_description": "AADSTS50034: The user account does not exist in the directory.",
            }
            mock_post.return_value = mock_auth

            res = client.post(
                "/api/teams/login",
                json={"email": "nonexistent@vitstudent.ac.in", "password": "Password123!"},
            )
            assert res.status_code == 401
            assert "not found" in res.json()["detail"].lower()

    def test_account_locked_returns_401(self):
        """Simulates Microsoft returning AADSTS50053 (account locked)."""
        with patch("app.routers.teams.requests.post") as mock_post, \
             patch("app.routers.teams.requests.get") as mock_get:
            mock_realm = MagicMock()
            mock_realm.status_code = 200
            mock_realm.json.return_value = {"NameSpaceType": "Managed"}
            mock_get.return_value = mock_realm

            mock_auth = MagicMock()
            mock_auth.status_code = 400
            mock_auth.json.return_value = {
                "error": "invalid_grant",
                "error_codes": [50053],
                "error_description": "AADSTS50053: You've tried to sign in too many times.",
            }
            mock_post.return_value = mock_auth

            res = client.post(
                "/api/teams/login",
                json={"email": "student@vitstudent.ac.in", "password": "Password123!"},
            )
            assert res.status_code == 401
            assert "locked" in res.json()["detail"].lower()


class TestVTOPAndTeamsSubjectMatching:
    def test_match_team_by_exact_course_code(self):
        vtop_courses = [{"code": "BCSE302L", "title": "Database Systems"}]
        match = match_team_to_vtop_course("BCSE302L - Database Systems (F2+TF2)", "Fall 2026", vtop_courses)
        assert match is not None
        assert match["code"] == "BCSE302L"

    def test_match_team_by_base_course_code(self):
        vtop_courses = [{"code": "BCSE302L", "title": "Database Systems"}]
        match = match_team_to_vtop_course("BCSE302 - Database Systems", "", vtop_courses)
        assert match is not None
        assert match["code"] == "BCSE302L"

    def test_match_team_by_title_keywords(self):
        vtop_courses = [{"code": "BCSE308L", "title": "Computer Networks"}]
        match = match_team_to_vtop_course("Computer Networks Class Team 2026", "", vtop_courses)
        assert match is not None
        assert match["code"] == "BCSE308L"

    def test_unrelated_team_does_not_match(self):
        vtop_courses = [{"code": "BCSE302L", "title": "Database Systems"}]
        match = match_team_to_vtop_course("University Music Club", "Extracurricular", vtop_courses)
        assert match is None


class TestTeamsAuthenticationSuccessAndZeroFakeData:
    def test_successful_login_with_no_assignments_returns_zero_fake_data(self):
        """When student has 0 assignments on Teams, verify 0 fake records are created."""
        with patch("app.routers.teams.requests.post") as mock_post, \
             patch("app.routers.teams.requests.get") as mock_get:
            # Realm check
            mock_realm = MagicMock()
            mock_realm.status_code = 200
            mock_realm.json.return_value = {"NameSpaceType": "Managed"}

            # Auth token
            mock_token = MagicMock()
            mock_token.status_code = 200
            mock_token.json.return_value = {
                "access_token": "fake_access_token_123",
                "refresh_token": "fake_refresh_token_123",
                "expires_in": 3600,
            }
            mock_post.return_value = mock_token

            def mock_get_router(url, **kwargs):
                r = MagicMock()
                r.status_code = 200
                if "userrealm" in url:
                    r.json.return_value = {"NameSpaceType": "Managed"}
                elif "/v1.0/me/joinedTeams" in url:
                    # Joined a team matching BCSE302L
                    r.json.return_value = {"value": [
                        {"id": "team-dbms", "displayName": "BCSE302L - Database Systems", "description": ""}
                    ]}
                elif "/education/classes/team-dbms/assignments" in url:
                    # ZERO assignments posted in this class
                    r.json.return_value = {"value": []}
                elif "/channels" in url:
                    r.json.return_value = {"value": []}
                elif "/v1.0/education/classes" in url:
                    r.json.return_value = {"value": []}
                elif "/v1.0/education/me/assignments" in url:
                    r.json.return_value = {"value": []}
                elif "/v1.0/me" in url:
                    r.json.return_value = {
                        "displayName": "Pragyan Jain",
                        "mail": "pragyan.jain2024@vitstudent.ac.in",
                    }
                return r

            mock_get.side_effect = mock_get_router

            res = client.post(
                "/api/teams/login",
                json={"email": "pragyan.jain2024@vitstudent.ac.in", "password": "ValidPassword123!"},
            )
            assert res.status_code == 200
            data = res.json()
            assert data["success"] is True
            assert data["email"] == "pragyan.jain2024@vitstudent.ac.in"
            # Subject matching verified
            assert data["matchedCount"] == 1
            assert data["matchedSubjects"][0]["courseCode"] == "BCSE302L"
            # Crucial: NO fake assignments generated
            assert data["teamsAssignmentsCount"] == 0
            assert data["pendingCount"] == 0
            assert data["submittedCount"] == 0

            # Verify persisted store state
            status = client.get("/api/teams/status").json()
            assert status["connected"] is True
            assert status["email"] == "pragyan.jain2024@vitstudent.ac.in"
            assert status["matchedCount"] == 1
            assert status["totalAssignments"] == 0

    def test_successful_login_matches_vtop_subject_and_fetches_assignments(self):
        """When matched subject has assignments in Teams, fetch authentic assignment details."""
        with patch("app.routers.teams.requests.post") as mock_post, \
             patch("app.routers.teams.requests.get") as mock_get:
            mock_token = MagicMock()
            mock_token.status_code = 200
            mock_token.json.return_value = {
                "access_token": "fake_token",
                "refresh_token": "fake_refresh",
            }
            mock_post.return_value = mock_token

            def mock_get_router(url, **kwargs):
                r = MagicMock()
                r.status_code = 200
                if "userrealm" in url:
                    r.json.return_value = {"NameSpaceType": "Managed"}
                elif "/v1.0/me/joinedTeams" in url:
                    r.json.return_value = {
                        "value": [
                            {"id": "team-cn", "displayName": "BCSE308L - Computer Networks", "description": "VIT Chennai"}
                        ]
                    }
                elif "/education/classes/team-cn/assignments" in url:
                    r.json.return_value = {
                        "value": [
                            {
                                "id": "assign-cn-1",
                                "displayName": "Digital Assignment 1 - Packet Tracer",
                                "classId": "team-cn",
                                "dueDateTime": "2026-09-15T23:59:00Z",
                                "status": "assigned",
                                "instructions": {"content": "<p>Design a 3-router subnet topology.</p>"},
                                "webUrl": "https://teams.microsoft.com/l/entity/assignment/cn1",
                            }
                        ]
                    }
                elif "/submissions" in url:
                    r.json.return_value = {"value": [{"status": "working"}]}
                elif "/channels" in url:
                    r.json.return_value = {"value": []}
                elif "/v1.0/education/classes" in url:
                    r.json.return_value = {"value": []}
                elif "/v1.0/education/me/assignments" in url:
                    r.json.return_value = {"value": []}
                elif "/v1.0/me" in url:
                    r.json.return_value = {"displayName": "Pragyan Jain", "mail": "pragyan@vitstudent.ac.in"}
                return r

            mock_get.side_effect = mock_get_router

            res = client.post(
                "/api/teams/login",
                json={"email": "pragyan@vitstudent.ac.in", "password": "ValidPassword!"},
            )
            assert res.status_code == 200
            data = res.json()
            assert data["matchedCount"] == 1
            assert data["matchedSubjects"][0]["courseCode"] == "BCSE308L"
            assert data["teamsAssignmentsCount"] == 1
            assert data["pendingCount"] == 1

            assign = data["assignments"][0]
            assert assign["title"] == "Digital Assignment 1 - Packet Tracer"
            assert assign["courseCode"] == "BCSE308L"
            assert assign["courseTitle"] == "Computer Networks"
            assert assign["source"] == "Teams"
            assert assign["status"] == "Pending"
            assert assign["instructions"] == "Design a 3-router subnet topology."
            assert "teams.microsoft.com" in assign["platformUrl"]

    def test_sync_and_disconnect(self):
        # 1. Sync when disconnected fails
        res_sync_bad = client.post("/api/teams/sync")
        assert res_sync_bad.status_code == 400

        # 2. Connect
        store = storage.load_store()
        store["teamsConnected"] = True
        store["teamsAccount"] = {"email": "pragyan@vitstudent.ac.in"}
        store["assignments"] = [{"id": "teams-1", "source": "Teams", "title": "Test"}]
        storage.save_store(store)

        # 3. Disconnect clears teams data
        res_dc = client.post("/api/teams/disconnect")
        assert res_dc.status_code == 200
        assert res_dc.json()["success"] is True

        status = client.get("/api/teams/status").json()
        assert status["connected"] is False
        assert status["totalAssignments"] == 0
