import json
import os
import tempfile
import pytest
from unittest.mock import patch, MagicMock
from fastapi.testclient import TestClient

from app.main import app
from app.supabase_client import record_login_event, get_login_stats, is_supabase_configured

client = TestClient(app)


def test_login_telemetry_recording_and_stats(tmp_path):
    temp_file = str(tmp_path / "test_login_telemetry.json")
    with patch("app.supabase_client.TELEMETRY_FILE", temp_file):
        # Initial stats should be zero
        stats_initial = get_login_stats()
        assert stats_initial["total_logins"] == 0
        assert stats_initial["unique_students"] == 0

        # Record first login for student 1
        record_login_event(
            reg_no="24BCE1001",
            name="Alice Smith",
            program="B.Tech Computer Science",
            branch="CSE",
            semester="Fall 2026",
            ip_address="192.168.1.10",
            user_agent="Mozilla/5.0",
            status="SUCCESS",
        )

        stats_1 = get_login_stats()
        assert stats_1["total_logins"] == 1
        assert stats_1["unique_students"] == 1
        assert len(stats_1["users_list"]) == 1
        assert stats_1["users_list"][0]["reg_no"] == "24BCE1001"
        assert stats_1["users_list"][0]["name"] == "Alice Smith"
        assert stats_1["users_list"][0]["login_count"] == 1

        # Second login for student 1 (increments total and user login_count, unique remains 1)
        record_login_event(
            reg_no="24BCE1001",
            name="Alice Smith",
            ip_address="192.168.1.11",
            status="SUCCESS",
        )

        stats_2 = get_login_stats()
        assert stats_2["total_logins"] == 2
        assert stats_2["unique_students"] == 1
        assert stats_2["users_list"][0]["login_count"] == 2

        # Login for student 2 (increments both total and unique)
        record_login_event(
            reg_no="24BCE2002",
            name="Bob Jones",
            branch="ECE",
            status="SUCCESS",
        )

        stats_3 = get_login_stats()
        assert stats_3["total_logins"] == 3
        assert stats_3["unique_students"] == 2

        # Failed login attempt (recorded in logins log, but does not increment successful unique count)
        record_login_event(
            reg_no="24BCE9999",
            status="FAILED",
            error_message="Invalid CAPTCHA entered",
        )

        stats_4 = get_login_stats()
        assert stats_4["total_logins"] == 3
        assert stats_4["unique_students"] == 2
        assert len(stats_4["recent_logins"]) == 4


def test_login_stats_api_endpoint(tmp_path):
    temp_file = str(tmp_path / "test_login_telemetry.json")
    with patch("app.supabase_client.TELEMETRY_FILE", temp_file):
        record_login_event(
            reg_no="24BLC1100",
            name="Pragyan Jain",
            branch="CSE",
            status="SUCCESS",
        )

        response = client.get("/api/vtop/login-stats")
        assert response.status_code == 200
        data = response.json()
        assert data["success"] is True
        assert data["total_logins"] == 1
        assert data["unique_students"] == 1
        assert len(data["recent_logins"]) == 1
        assert data["recent_logins"][0]["reg_no"] == "24BLC1100"
