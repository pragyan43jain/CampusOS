"""
Unit and integration tests for CampusOS Supabase Analytics & Telemetry.
"""

import json
import os
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.supabase_client import (
    clean_registration_number,
    sanitize_metadata,
    track_event,
    upsert_profile,
    get_analytics_summary,
    _compute_summary_from_records,
)
from app.routers.analytics import verify_admin_authorization

client = TestClient(app)


class TestIdentityAndSanitization:
    def test_clean_registration_number(self):
        assert clean_registration_number("21bce1234") == "21BCE1234"
        assert clean_registration_number("  23bce9999  ") == "23BCE9999"
        assert clean_registration_number("Not available") is None
        assert clean_registration_number("Sync Required") is None
        assert clean_registration_number("") is None
        assert clean_registration_number(None) is None

    def test_sanitize_metadata_strips_sensitive_keys(self):
        dirty = {
            "page": "/academics/attendance",
            "password": "supersecretpassword",
            "vtop_pass": "secret",
            "access_token": "jwt.token.here",
            "session_id": "sess-xyz",
            "safe_metric": 42,
            "nested": {
                "auth": "bearer token",
                "normal_field": "hello",
            },
            "array_data": [
                {"cookie": "stale_cookie", "item": "safe"},
            ],
        }
        clean = sanitize_metadata(dirty)
        assert "password" not in clean
        assert "vtop_pass" not in clean
        assert "access_token" not in clean
        assert "session_id" not in clean
        assert clean["safe_metric"] == 42
        assert clean["page"] == "/academics/attendance"
        assert "auth" not in clean["nested"]
        assert clean["nested"]["normal_field"] == "hello"
        assert "cookie" not in clean["array_data"][0]
        assert clean["array_data"][0]["item"] == "safe"


class TestAnalyticsEndpoints:
    def test_track_event_endpoint_anonymous(self):
        res = client.post("/api/analytics/track", json={
            "event": "dashboard_viewed",
            "page": "/dashboard",
            "metadata": {"test": True},
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True

    def test_track_event_endpoint_with_header(self):
        res = client.post(
            "/api/analytics/track",
            json={
                "event": "attendance_viewed",
                "page": "/academics/attendance",
            },
            headers={"X-Reg-No": "21BCE1234"},
        )
        assert res.status_code == 200
        assert res.json()["success"] is True

    def test_track_batch_endpoint(self):
        res = client.post("/api/analytics/batch", json={
            "events": [
                {"event": "timetable_viewed", "page": "/timetable"},
                {"event": "profile_viewed", "page": "/profile"},
            ]
        })
        assert res.status_code == 200
        data = res.json()
        assert data["success"] is True
        assert data["recordedCount"] >= 0

    def test_profile_sync_endpoint(self):
        res = client.post("/api/analytics/profile", json={
            "regNo": "21BCE9999",
            "name": "Test Student",
            "program": "B.Tech",
            "branch": "CSE",
            "cgpa": 9.25,
        })
        assert res.status_code == 200
        assert res.json()["success"] is True


class TestAdminAuthorizationAndMetrics:
    def test_admin_authorization_rejected_without_key(self):
        res = client.get("/api/analytics/admin/summary")
        assert res.status_code == 401

    def test_admin_authorization_accepted_with_key(self, monkeypatch):
        monkeypatch.setenv("CAMPUSOS_ADMIN_KEY", "test_admin_passkey_123")
        import app.routers.analytics as analytics_module
        analytics_module.CAMPUSOS_ADMIN_KEY = "test_admin_passkey_123"

        res = client.get(
            "/api/analytics/admin/summary",
            headers={"X-Admin-Key": "test_admin_passkey_123"},
        )
        assert res.status_code == 200
        payload = res.json()
        assert payload["success"] is True
        assert "totalUsers" in payload["data"]
        assert "activeToday" in payload["data"]
        assert "activeLast7Days" in payload["data"]
        assert "activeLast30Days" in payload["data"]
        assert "featureUsage" in payload["data"]

    def test_admin_authorization_accepted_with_admin_reg(self, monkeypatch):
        monkeypatch.setenv("CAMPUSOS_ADMIN_REG_NOS", "21BCE1234,22BCE5678")
        import app.routers.analytics as analytics_module
        analytics_module.CAMPUSOS_ADMIN_REG_NOS = ["21BCE1234", "22BCE5678"]

        res = client.get(
            "/api/analytics/admin/summary",
            headers={"X-Reg-No": "21BCE1234"},
        )
        assert res.status_code == 200
        assert res.json()["success"] is True

    def test_compute_summary_from_records(self):
        from datetime import datetime, timezone
        now_str = datetime.now(timezone.utc).isoformat()
        profiles = [
            {"reg_no": "21BCE1111", "name": "Student A", "last_active_at": now_str, "created_at": now_str},
            {"reg_no": "21BCE2222", "name": "Student B", "last_active_at": now_str, "created_at": now_str},
        ]
        events = [
            {"reg_no": "21BCE1111", "event_name": "dashboard_viewed", "created_at": now_str},
            {"reg_no": "21BCE1111", "event_name": "attendance_viewed", "created_at": now_str},
            {"reg_no": "21BCE2222", "event_name": "dashboard_viewed", "created_at": now_str},
        ]
        summary = _compute_summary_from_records(profiles, events)
        assert summary["totalUsers"] == 2
        assert summary["activeToday"] == 2
        assert summary["activeLast7Days"] == 2
        assert summary["activeLast30Days"] == 2
        assert summary["newUsersLast7Days"] == 2
        assert len(summary["featureUsage"]) == 2
        dashboard_hit = next(f for f in summary["featureUsage"] if f["event_name"] == "dashboard_viewed")
        assert dashboard_hit["count"] == 2
        assert dashboard_hit["unique_users"] == 2


class TestGracefulDegradation:
    def test_analytics_never_raises_on_invalid_inputs(self):
        # Even with malformed or extreme inputs, track_event must not raise
        result = track_event(None, "   ", metadata=None)
        assert isinstance(result, bool)

        result_prof = upsert_profile({})
        assert result_prof is None
