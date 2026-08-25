"""
Router tests: what the HTTP layer serves in each of its two states.

Requires FastAPI and pytest (``python -m pytest tests/test_endpoints.py``); the
stdlib runner in ``run_without_pytest.py`` covers the parser/registry/pipeline
modules, which need nothing but bs4.

The payload used here is not hand-written — it is the output of a real
``scraper.sync()`` over the HTML fixtures, via the same ``FakeSession`` the
pipeline tests use. That means these tests fail if the routes and the pipeline
disagree about a key name, which a hand-written payload would hide.

Every test redirects the store to a temp file. Without that, running the suite
would overwrite the developer's own synced VTOP data.
"""

import pytest
from fastapi.testclient import TestClient

from app import storage
from app.main import app
from app.vtop.scraper import sync
from tests.test_vtop_scraper import FakeSession

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_store(tmp_path, monkeypatch):
    """Point the store at a temp file for the duration of each test."""
    monkeypatch.setattr(storage, "DATA_FILE", str(tmp_path / "store.json"))
    yield


@pytest.fixture
def synced():
    """A store holding a successful sync over the fixtures."""
    payload = sync(FakeSession())
    storage.save_store(
        {
            **payload,
            "authenticated": True,
            "message": "Synced with VTOP.",
            "lastSynced": payload["student"]["lastSynced"],
        }
    )
    return payload


# ---------------------------------------------------------------------------
# disconnected: nothing has ever synced
# ---------------------------------------------------------------------------


class TestDisconnected:
    def test_status_reports_not_authenticated(self):
        body = client.get("/api/vtop/status").json()
        assert body["authenticated"] is False
        assert body["lastSynced"] is None

    def test_profile_fields_are_null_not_placeholder_strings(self):
        # The old default returned "Not connected" / "Not available", which the UI
        # then rendered as though it were the student's name and branch.
        body = client.get("/api/vtop/profile").json()
        assert body["name"] is None
        assert body["regNo"] is None
        assert body["branch"] is None

    def test_cgpa_does_not_invent_a_credit_requirement(self):
        # Previously hardcoded to 160, which fed a meaningless progress bar.
        body = client.get("/api/vtop/cgpa").json()
        assert body["totalCreditsRequired"] is None
        assert body["currentCgpa"] is None
        assert body["hasValidData"] is False

    def test_od_is_unavailable_not_twelve_hours_used(self):
        # The old route defaulted to usedHours 12 / remainingHours 28 for everyone.
        body = client.get("/api/vtop/od").json()
        assert body["hasValidData"] is False
        assert body["usedHours"] is None
        assert body["remainingHours"] is None
        assert body["maxHours"] == 40

    def test_legacy_od_route_agrees(self):
        assert client.get("/api/od").json()["usedHours"] is None

    def test_collections_are_empty(self):
        assert client.get("/api/vtop/attendance").json() == []
        assert client.get("/api/vtop/marks").json() == []
        assert client.get("/api/vtop/timetable").json() == []
        assert client.get("/api/vtop/faculty").json() == []
        assert client.get("/api/vtop/exams").json() == {}

    def test_sync_without_a_session_fails_and_says_why(self):
        body = client.post("/api/vtop/sync").json()
        assert body["success"] is False
        assert body["retryable"] is True
        assert "expired" in body["message"].lower()

    def test_login_without_a_captcha_session_is_rejected(self):
        body = client.post(
            "/api/vtop/login", json={"username": "22BCE1234", "password": "x"}
        ).json()
        assert body["success"] is False
        assert "captcha" in body["message"].lower()

    def test_root_does_not_claim_an_active_integration(self):
        body = client.get("/").json()
        assert body["vtopConnected"] is False


# ---------------------------------------------------------------------------
# connected: a sync has succeeded
# ---------------------------------------------------------------------------


class TestSynced:
    def test_profile_serves_the_scraped_student(self, synced):
        body = client.get("/api/vtop/profile").json()
        assert body["regNo"] == "22BCE1234"
        assert body["name"] == "ANANYA SHARMA"

    def test_attendance_survives_the_round_trip(self, synced):
        body = client.get("/api/vtop/attendance").json()
        assert len(body) == 3
        assert body[0]["courseCode"] == "CSE1002"
        assert body[0]["percentage"] == 86.7

    def test_marks_keep_their_component_list(self, synced):
        body = client.get("/api/vtop/marks").json()
        assert [c["title"] for c in body[0]["components"]] == [
            "CAT-1",
            "Quiz 1",
            "CAT-2",
        ]

    def test_exams_stay_grouped_by_type(self, synced):
        body = client.get("/api/vtop/exams").json()
        assert set(body) == {"CAT 1", "FAT"}

    def test_timetable_venues_come_through_verbatim(self, synced):
        body = client.get("/api/vtop/timetable").json()
        monday = next(e for e in body if e["day"] == "MON")
        assert monday["venue"] == "AB1-405"

    def test_status_reflects_the_sync(self, synced):
        body = client.get("/api/vtop/status").json()
        assert body["authenticated"] is True
        assert body["syncOk"] is True
        assert body["failedModules"] == []

    def test_sync_report_is_exposed(self, synced):
        body = client.get("/api/vtop/sync-report").json()
        assert body["syncReport"]["modules"]["attendance"]["status"] == "ok"
        assert body["registry"]["courseCount"] == 3

    def test_semesters_route_reports_the_selection(self, synced):
        body = client.get("/api/vtop/semesters").json()
        assert body["selected"]["id"] == "CH20242501"
        assert len(body["semesters"]) == 2

    def test_cgpa_still_null_but_registered_credits_are_real(self, synced):
        # Grade history is not scraped yet, so CGPA stays None even when synced.
        body = client.get("/api/vtop/cgpa").json()
        assert body["currentCgpa"] is None
        assert body["registeredCredits"] == 11.0

    def test_od_is_authoritative_after_a_successful_sync(self, synced):
        body = client.get("/api/vtop/od").json()
        assert body["hasValidData"] is True
        assert body["maxHours"] == 40
        assert body["maxOdHours"] == 40
        assert body["odHours"] == 0
        assert body["totalOdHours"] == 0
        assert body["usedHours"] == 0
        assert body["remainingHours"] == 40
        assert body["records"] == []
        assert body["odRecords"] == []
        # Legacy route agrees
        legacy_body = client.get("/api/od").json()
        assert legacy_body["hasValidData"] is True
        assert legacy_body["odHours"] == 0

    def test_features_route_separates_synced_from_unsourced(self, synced):
        body = client.get("/api/features").json()
        assert body["attendance"]["source"] == "vtop"
        assert body["attendance"]["available"] is True
        assert body["attendance"]["count"] == 3
        # OD is available and sourced from VTOP when synced
        assert body["od"]["source"] == "vtop"
        assert body["od"]["available"] is True
        # Sections with no source say so rather than looking like empty data.
        assert body["fees"]["source"] is None
        assert body["fees"]["available"] is False
        assert "not synced yet" in body["fees"]["message"].lower()

    def test_logout_clears_the_store(self, synced):
        assert client.post("/api/vtop/logout").json()["success"] is True
        assert client.get("/api/vtop/status").json()["authenticated"] is False
        assert client.get("/api/vtop/profile").json()["regNo"] is None


class TestFailedModuleIsVisibleOverHttp:
    def test_failed_module_is_named_in_status(self):
        payload = sync(FakeSession(fail=["examinations/doStudentMarkView"]))
        storage.save_store({**payload, "authenticated": True})
        body = client.get("/api/vtop/status").json()
        assert body["syncOk"] is False
        assert body["failedModules"] == ["marks"]

    def test_failed_module_is_distinguishable_from_empty(self):
        payload = sync(FakeSession(fail=["examinations/doStudentMarkView"]))
        storage.save_store({**payload, "authenticated": True})
        features = client.get("/api/features").json()
        # Both are count 0 over HTTP; only `status` tells them apart.
        assert features["marks"]["count"] == 0
        assert features["marks"]["status"] == "failed"
        assert features["attendance"]["status"] == "ok"


class TestNewVTOPAndHostelEndpoints:
    def test_new_routes_respond(self):
        assert isinstance(client.get("/api/receipts").json(), list)
        assert isinstance(client.get("/api/dues").json(), dict)
        assert isinstance(client.get("/api/spotlight").json(), list)
        assert isinstance(client.get("/api/vtop/receipts").json(), list)
        assert isinstance(client.get("/api/vtop/dues").json(), dict)
        assert isinstance(client.get("/api/vtop/spotlight").json(), list)
        assert isinstance(client.get("/api/vtop/dean-hod").json(), list)
        assert isinstance(client.get("/api/vtop/assignments").json(), list)
        # Hostel endpoints
        mess = client.get("/api/hostel/mess?type=M-N").json()
        assert isinstance(mess, list)
        laundry = client.get("/api/hostel/laundry?block=A").json()
        assert isinstance(laundry, list)


class TestStudyMaterialsEndpoint:
    def test_database_systems_resolves_correct_url(self):
        res = client.get("/api/study-materials?code=BCSE302L").json()
        assert res["available"] is True
        assert res["url"] == "https://www.vhelpcc.com/study-material"

    def test_database_systems_lab_resolves_correct_url(self):
        res = client.get("/api/study-materials?code=BCSE302P").json()
        assert res["available"] is True
        assert res["url"] == "https://www.vhelpcc.com/study-material"

    def test_computer_networks_resolves_correct_url(self):
        res = client.get("/api/study-materials?code=BCSE308L").json()
        assert res["available"] is True
        assert res["url"] == "https://www.vhelpcc.com/study-material"

    def test_computer_networks_lab_resolves_correct_url(self):
        res = client.get("/api/study-materials?code=BCSE308P").json()
        assert res["available"] is True
        assert res["url"] == "https://www.vhelpcc.com/study-material"

    def test_all_courses_resolve_to_study_material_hub(self):
        res = client.get("/api/study-materials?code=BSSC101N").json()
        assert res["available"] is True
        assert res["url"] == "https://www.vhelpcc.com/study-material"
