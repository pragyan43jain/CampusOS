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
