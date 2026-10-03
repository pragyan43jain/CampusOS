"""
Security & Authorization Test Suite for CampusOS.

Verifies:
1. Zero Data Leakage for anonymous callers across all student endpoints.
2. Protection against Insecure Direct Object Reference (IDOR) attacks.
3. Cryptographic rejection of forged, tampered, or expired session tokens.
4. Correct data access for legitimately authenticated student sessions.
"""

import json
import os
import tempfile
import time
import pytest
from fastapi.testclient import TestClient

from app import storage
from app.auth_crypto import generate_signed_session_token
from app.main import app

client = TestClient(app)

VICTIM_REG = "21BCE9999"
ATTACKER_REG = "24BLC1100"


@pytest.fixture
def populated_student_stores(tmp_path, monkeypatch):
    """
    Creates real student stores for both a victim and an attacker in the active storage directory.
    """
    data_dir = tmp_path / "data"
    data_dir.mkdir(parents=True, exist_ok=True)
    monkeypatch.setattr(storage, "DATA_DIR", str(data_dir))
    monkeypatch.setattr(storage, "DATA_FILE", str(data_dir / "store.json"))

    victim_payload = {
        **storage.empty_store(),
        "storeVersion": storage.STORE_VERSION,
        "authenticated": True,
        "student": {
            **storage.empty_student(),
            "name": "VICTIM STUDENT",
            "regNo": VICTIM_REG,
            "email": "victim@vitstudent.ac.in",
            "branch": "Computer Science and Engineering",
            "cgpa": 9.42,
        },
        "attendance": [
            {
                "courseCode": "BCSE302L",
                "courseTitle": "Database Systems",
                "percentage": 96.0,
                "attended": 24,
                "total": 25,
            }
        ],
        "marks": [
            {
                "courseCode": "BCSE302L",
                "courseTitle": "Database Systems",
                "components": [{"title": "CAT-1", "maxMarks": 50, "scoredMarks": 48}],
            }
        ],
        "timetable": [{"day": "MON", "slot": "A1", "courseCode": "BCSE302L", "venue": "AB1-405"}],
        "receipts": [
            {"id": "rcpt-999", "receiptNumber": "RCPT-999", "amount": 195000.0, "status": "Paid"}
        ],
        "dues": {"hasDues": True, "totalDue": 5000.0, "items": [{"feeType": "Hostel Due", "amount": 5000.0}]},
        "fees": [{"title": "Tuition Fee", "amount": 195000.0}],
    }

    attacker_payload = {
        **storage.empty_store(),
        "storeVersion": storage.STORE_VERSION,
        "authenticated": True,
        "student": {
            **storage.empty_student(),
            "name": "ATTACKER STUDENT",
            "regNo": ATTACKER_REG,
            "email": "attacker@vitstudent.ac.in",
            "branch": "Electronics and Communication",
            "cgpa": 7.50,
        },
        "attendance": [
            {
                "courseCode": "BECE201L",
                "courseTitle": "Digital Logic",
                "percentage": 80.0,
                "attended": 20,
                "total": 25,
            }
        ],
        "receipts": [
            {"id": "rcpt-100", "receiptNumber": "RCPT-100", "amount": 180000.0, "status": "Paid"}
        ],
    }

    # Save directly to isolated student files
    storage.save_store(victim_payload, VICTIM_REG)
    storage.save_store(attacker_payload, ATTACKER_REG)

    return {"victim": victim_payload, "attacker": attacker_payload}


class TestAnonymousZeroLeakage:
    """Verifies that an anonymous caller with 0 headers cannot read any student data."""

    def test_anonymous_profile_does_not_leak_victim(self, populated_student_stores):
        res = client.get("/api/vtop/profile")
        assert res.status_code == 200
        data = res.json()
        assert data["name"] is None
        assert data["regNo"] is None
        assert data["cgpa"] is None

    def test_anonymous_student_endpoint_does_not_leak(self, populated_student_stores):
        res = client.get("/api/student")
        assert res.status_code == 200
        data = res.json()
        assert data["name"] is None
        assert data["regNo"] is None

    def test_anonymous_attendance_does_not_leak(self, populated_student_stores):
        res_vtop = client.get("/api/vtop/attendance")
        assert res_vtop.status_code == 200
        assert res_vtop.json() == []

        res_acad = client.get("/api/attendance")
        assert res_acad.status_code == 200
        assert res_acad.json() == []

    def test_anonymous_marks_does_not_leak(self, populated_student_stores):
        res = client.get("/api/vtop/marks")
        assert res.status_code == 200
        assert res.json() == []

        res_acad = client.get("/api/marks")
        assert res_acad.status_code == 200
        assert res_acad.json() == []

    def test_anonymous_receipts_does_not_leak(self, populated_student_stores):
        res = client.get("/api/vtop/receipts")
        assert res.status_code == 200
        assert res.json() == []

    def test_anonymous_dues_does_not_leak(self, populated_student_stores):
        res = client.get("/api/vtop/dues")
        assert res.status_code == 200
        data = res.json()
        assert data["hasDues"] is False
        assert data["totalDue"] == 0.0
        assert data["items"] == []

    def test_anonymous_timetable_does_not_leak(self, populated_student_stores):
        res = client.get("/api/vtop/timetable")
        assert res.status_code == 200
        assert res.json() == []

        res_acad = client.get("/api/timetable")
        assert res_acad.status_code == 200
        assert res_acad.json() == []

    def test_anonymous_status_reports_disconnected(self, populated_student_stores):
        res = client.get("/api/vtop/status")
        assert res.status_code == 200
        data = res.json()
        assert data["authenticated"] is False
        assert data["lastSynced"] is None

    def test_anonymous_all_grades_does_not_leak(self, populated_student_stores):
        res = client.get("/api/all-grades")
        assert res.status_code == 200
        data = res.json()
        assert data["grades"] == {}
        assert data["cgpa"] is None
        assert data["creditsEarned"] is None

    def test_anonymous_hostel_details_does_not_leak(self, populated_student_stores):
        res = client.get("/api/hostel/details")
        assert res.status_code == 200
        data = res.json()
        assert data["leaveHistory"] == []
        assert data["hostelInfo"]["gender"] is None
        assert data["hostelInfo"]["roomNo"] is None


class TestIDORPrevention:
    """Verifies that an authenticated student cannot access another student's record."""

    def test_attacker_cannot_read_victim_via_x_reg_no(self, populated_student_stores):
        attacker_token = generate_signed_session_token(ATTACKER_REG)
        res = client.get(
            "/api/vtop/profile",
            headers={
                "X-Session-ID": attacker_token,
                "X-Reg-No": VICTIM_REG,
            },
        )
        assert res.status_code == 403
        assert "another student" in res.json()["detail"].lower()

    def test_attacker_cannot_read_victim_via_query_param(self, populated_student_stores):
        attacker_token = generate_signed_session_token(ATTACKER_REG)
        res = client.get(
            f"/api/vtop/profile?regNo={VICTIM_REG}",
            headers={"Authorization": f"Bearer {attacker_token}"},
        )
        assert res.status_code == 403
        assert "another student" in res.json()["detail"].lower()

    def test_attacker_cannot_read_victim_receipts_via_idor(self, populated_student_stores):
        attacker_token = generate_signed_session_token(ATTACKER_REG)
        res = client.get(
            f"/api/vtop/receipts?regNo={VICTIM_REG}",
            headers={"X-Session-ID": attacker_token},
        )
        assert res.status_code == 403

    def test_unauthenticated_caller_passing_raw_victim_header_is_rejected(self, populated_student_stores):
        """Unauthenticated caller specifying victim regNo must NOT receive victim records."""
        res = client.get(
            "/api/vtop/profile",
            headers={"X-Reg-No": VICTIM_REG},
        )
        assert res.status_code == 200
        data = res.json()
        # Must return empty, disconnected state, not victim records
        assert data["name"] is None
        assert data["regNo"] is None


class TestTokenIntegrityAndTampering:
    """Verifies cryptographic tamper detection and expiration handling."""

    def test_tampered_token_signature_rejected(self, populated_student_stores):
        valid_token = generate_signed_session_token(ATTACKER_REG)
        # Tamper signature part
        prefix, _ = valid_token.rsplit(".", 1)
        tampered_token = f"{prefix}.forged_signature_12345"

        res = client.get(
            "/api/vtop/profile",
            headers={"X-Session-ID": tampered_token},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["name"] is None
        assert data["regNo"] is None

    def test_expired_token_rejected(self, populated_student_stores):
        # Generate token with negative TTL
        expired_token = generate_signed_session_token(ATTACKER_REG, ttl_seconds=-100)

        res = client.get(
            "/api/vtop/profile",
            headers={"Authorization": f"Bearer {expired_token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["name"] is None
        assert data["regNo"] is None


class TestLegitimateStudentAccess:
    """Verifies that an authenticated student accesses their own records seamlessly."""

    def test_authenticated_student_reads_own_profile(self, populated_student_stores):
        attacker_token = generate_signed_session_token(ATTACKER_REG)
        res = client.get(
            "/api/vtop/profile",
            headers={"Authorization": f"Bearer {attacker_token}"},
        )
        assert res.status_code == 200
        data = res.json()
        assert data["name"] == "ATTACKER STUDENT"
        assert data["regNo"] == ATTACKER_REG

    def test_authenticated_student_reads_own_receipts(self, populated_student_stores):
        attacker_token = generate_signed_session_token(ATTACKER_REG)
        res = client.get(
            "/api/vtop/receipts",
            headers={"X-Session-ID": attacker_token},
        )
        assert res.status_code == 200
        receipts = res.json()
        assert len(receipts) == 1
        assert receipts[0]["receiptNumber"] == "RCPT-100"


class TestAdminAuthorization:
    """Verifies that admin endpoints cannot be bypassed via forged headers."""

    def test_forged_admin_reg_no_header_rejected(self, monkeypatch):
        import app.routers.analytics as analytics_mod
        monkeypatch.setattr(analytics_mod, "CAMPUSOS_ADMIN_REG_NOS", ["21BCE9999"])
        res = client.get(
            "/api/analytics/admin/summary",
            headers={"X-Reg-No": "21BCE9999"},
        )
        assert res.status_code == 401

    def test_authenticated_admin_reg_no_accepted(self, monkeypatch):
        import app.routers.analytics as analytics_mod
        monkeypatch.setattr(analytics_mod, "CAMPUSOS_ADMIN_REG_NOS", ["21BCE9999"])
        admin_token = generate_signed_session_token("21BCE9999")
        # Mock get_analytics_summary to avoid external dependencies
        monkeypatch.setattr(analytics_mod, "get_analytics_summary", lambda: {"totalUsers": 42})
        res = client.get(
            "/api/analytics/admin/summary",
            headers={
                "X-Session-ID": admin_token,
                "X-Reg-No": "21BCE9999",
            },
        )
        assert res.status_code == 200
        assert res.json()["data"]["totalUsers"] == 42


class TestC2ExactRegNoMatching:
    """Verifies that substring or 1-character regNo guesses do not resolve student records."""

    def test_substring_reg_no_returns_empty(self, populated_student_stores):
        from app.storage import load_store
        assert load_store("2")["student"]["name"] is None
        assert load_store("21BCE")["student"]["name"] is None
        assert load_store("x21BCE1234x")["student"]["name"] is None
        assert load_store(VICTIM_REG)["student"]["name"] == "VICTIM STUDENT"

    def test_api_substring_query_returns_empty(self, populated_student_stores):
        res = client.get("/api/vtop/profile?regNo=21BCE")
        assert res.status_code == 200
        assert res.json()["name"] is None


class TestC3UnauthenticatedLogout:
    """Verifies that unauthenticated logout requests cannot delete victim stores or drop all sessions."""

    def test_unauthenticated_logout_does_not_delete_victim_store(self, populated_student_stores):
        from app.storage import load_store, _data_file_for
        victim_file = _data_file_for(VICTIM_REG)
        assert os.path.exists(victim_file)

        res = client.post(f"/api/vtop/logout?regNo={VICTIM_REG}")
        assert res.status_code == 200
        # Victim store file must still exist
        assert os.path.exists(victim_file)
        assert load_store(VICTIM_REG)["student"]["name"] == "VICTIM STUDENT"

    def test_anonymous_logout_does_not_drop_other_sessions(self):
        from app.vtop.client import client_manager
        from app.vtop.session import VTOPSession

        sess = VTOPSession()
        sid = client_manager._put(sess, reg_no="21BCE9999")
        assert sid in client_manager._sessions

        # Anonymous logout with no session ID
        client.post("/api/vtop/logout")
        assert sid in client_manager._sessions
        client_manager._drop(sid)


class TestC4UnauthenticatedMutations:
    """Verifies that unauthenticated requests cannot mutate assignments or disconnect integrations."""

    def test_unauthenticated_assignment_mutation_rejected(self):
        res = client.put(
            "/api/assignments/lms-101/status",
            headers={"X-Reg-No": VICTIM_REG},
            json={"status": "SUBMITTED"},
        )
        assert res.status_code == 401

    def test_unauthenticated_teams_disconnect_rejected(self):
        res = client.post(
            "/api/teams/disconnect",
            headers={"X-Reg-No": VICTIM_REG},
        )
        assert res.status_code == 401

    def test_unauthenticated_lms_disconnect_rejected(self):
        res = client.post(
            "/api/lms/disconnect",
            headers={"X-Reg-No": VICTIM_REG},
        )
        assert res.status_code == 401


class TestC5CorsAllowlist:
    """Verifies that malicious cross-origin preflight requests are rejected."""

    def test_evil_origin_rejected_in_cors(self):
        res = client.options(
            "/api/vtop/profile",
            headers={
                "Origin": "https://evil.example",
                "Access-Control-Request-Method": "GET",
            },
        )
        assert res.headers.get("access-control-allow-origin") != "https://evil.example"


class TestC6SessionTokenForging:
    """Verifies that forged unsigned vtop_ tokens cannot grant authenticated access."""

    def test_forged_unsigned_token_is_not_authenticated(self):
        import base64
        fake_state = {
            "cookies": {"JSESSIONID": "FAKE"},
            "csrf": "FAKE_CSRF",
            "authorized_id": "FAKE_AUTH",
            "is_authenticated": True,
            "username": VICTIM_REG,
        }
        forged_sid = "vtop_" + base64.urlsafe_b64encode(json.dumps(fake_state).encode()).decode()

        from app.vtop.client import client_manager
        handle = client_manager._get(forged_sid)
        assert handle is not None
        assert handle.session.is_authenticated is False
        assert handle.reg_no is None


class TestC7AdminKeyProtection:
    """Verifies that hardcoded admin keys and URL query parameters are rejected."""

    def test_default_key_rejected(self):
        res = client.get(
            "/api/analytics/admin/summary",
            headers={"X-Admin-Key": "campusos_admin_secret"},
        )
        assert res.status_code == 401

    def test_query_param_admin_key_not_accepted(self, monkeypatch):
        import app.routers.analytics as analytics_mod
        monkeypatch.setattr(analytics_mod, "CAMPUSOS_ADMIN_KEY", "valid_secret_key_12345")
        res = client.get("/api/analytics/admin/summary?admin_key=valid_secret_key_12345")
        assert res.status_code == 401

    def test_header_admin_key_accepted(self, monkeypatch):
        import app.routers.analytics as analytics_mod
        monkeypatch.setattr(analytics_mod, "CAMPUSOS_ADMIN_KEY", "valid_secret_key_12345")
        monkeypatch.setattr(analytics_mod, "get_analytics_summary", lambda: {"totalUsers": 10})
        res = client.get(
            "/api/analytics/admin/summary",
            headers={"X-Admin-Key": "valid_secret_key_12345"},
        )
        assert res.status_code == 200


class TestC8TLSVerification:
    """Verifies that TLS verification is enabled with a valid CA bundle."""

    def test_tls_verification_is_enabled(self):
        from app.vtop.session import VTOPSession, get_vtop_ca_bundle
        bundle = get_vtop_ca_bundle()
        assert bundle is not False
        assert os.path.exists(bundle)

        session = VTOPSession()
        assert session.http.verify is not False
        assert session.http.verify == bundle


class TestC10ValidationCredentialSanitization:
    """Verifies that validation errors do not echo submitted passwords or credentials."""

    def test_validation_error_strips_input(self):
        res = client.post("/api/vtop/login", json={"password": "SECRET_PASSWORD_CANARY"})
        assert res.status_code == 422
        body_text = res.text
        assert "SECRET_PASSWORD_CANARY" not in body_text
        for err in res.json().get("errors", []):
            assert "input" not in err
            assert "ctx" not in err


class TestB1ODRecordDaysCalculation:
    """Verifies that OD record day calculation correctly computes date differences."""

    def test_date_difference_calculation(self):
        from app.vtop.parser import calculate_days_from_dates
        assert calculate_days_from_dates("01-Jan-2026", "10-Jan-2026") == 10
        assert calculate_days_from_dates("2026-01-01", "2026-01-31") == 31
        assert calculate_days_from_dates("01-Jan-2026", "03-Jan-2026") == 3
        assert calculate_days_from_dates("01-Jan-2026", "01-Jan-2026") == 1


