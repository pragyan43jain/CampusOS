"""
Storage round-trip, and the guard against stale data posing as a sync.

The version guard is the point of this file. A store.json left over from the
original build holds a filled-in student (cgpa 8.85, totalCreditsRequired 160,
"Academic Block 1" rooms) and an ``exams`` *list* where the current pipeline
writes a mapping. Served as-is, /profile would report a CGPA while /status
correctly reported "not connected" — a dashboard that is confidently wrong, which
is the failure the rewrite exists to remove.

Runs under the stdlib runner (``python3 tests/run_without_pytest.py test_storage``)
as well as real pytest; it needs neither FastAPI nor bs4.
"""

import json
import os
import tempfile

import pytest

from app import storage

# ---------------------------------------------------------------------------
# Isolation, applied at import time — deliberately not left to a fixture.
#
# This file previously relied solely on an ``autouse`` fixture to redirect
# ``storage.DATA_FILE``. The stdlib runner in this directory silently ignored
# ``autouse``, so the fixture never ran, all thirteen tests wrote to the real
# ``backend/data/store.json``, and the corrupt-file test destroyed it.
#
# So isolation now happens the moment this module is imported. An import cannot
# be "not supported" by a runner the way a fixture flag can, which means the real
# store is out of reach before a single test body executes. The autouse fixture
# below still runs under both runners and gives each test a fresh directory; it is
# now a convenience, not the thing standing between a test run and your data.
# ---------------------------------------------------------------------------

REAL_STORE = storage.DATA_FILE
storage.DATA_FILE = os.path.join(
    tempfile.mkdtemp(prefix="campusos-store-guard-"), "store.json"
)
GUARD_STORE = storage.DATA_FILE


def _require_isolation() -> None:
    """Refuse to touch the real store, whatever went wrong upstream."""
    if os.path.abspath(storage.DATA_FILE) == os.path.abspath(REAL_STORE):
        raise AssertionError(
            "refusing to run: storage.DATA_FILE points at the real store "
            f"({REAL_STORE}). These tests write and delete that file."
        )


@pytest.fixture(autouse=True)
def isolated_store(tmp_path, monkeypatch):
    """Give each test its own empty store directory."""
    monkeypatch.setattr(storage, "DATA_FILE", str(tmp_path / "store.json"))
    _require_isolation()
    yield


def _write_raw(payload) -> None:
    """Write store.json directly, bypassing save_store's version stamp."""
    _require_isolation()
    os.makedirs(os.path.dirname(storage.DATA_FILE), exist_ok=True)
    with open(storage.DATA_FILE, "w", encoding="utf-8") as handle:
        json.dump(payload, handle)


class TestIsolation:
    """The safety net itself, since a silent failure here costs real data."""

    def test_the_real_store_path_is_never_the_target(self):
        assert os.path.abspath(storage.DATA_FILE) != os.path.abspath(REAL_STORE)

    def test_the_guard_raises_if_isolation_is_lost(self):
        original = storage.DATA_FILE
        storage.DATA_FILE = REAL_STORE
        try:
            with pytest.raises(AssertionError, match="refusing to run"):
                _write_raw({"authenticated": True})
        finally:
            storage.DATA_FILE = original

    def test_the_autouse_fixture_actually_applied(self):
        # The check that would have caught the data loss. If autouse is ignored,
        # DATA_FILE is still the import-time guard path, so comparing against
        # GUARD_STORE proves the fixture ran — and it does so without depending on
        # how a particular runner names its temp directories, which a check for
        # pytest's or the shim's prefix would.
        assert storage.DATA_FILE != GUARD_STORE
        assert storage.DATA_FILE != REAL_STORE


class TestEmptyStore:
    def test_absent_file_yields_the_shaped_empty_payload(self):
        store = storage.load_store()
        assert store["authenticated"] is False
        assert store["student"]["name"] is None
        assert store["exams"] == {}

    def test_empty_store_invents_no_credit_requirement(self):
        # Previously 160, which drove a progress bar that meant nothing.
        assert storage.empty_store()["student"]["totalCreditsRequired"] is None

    def test_empty_store_is_stamped_with_the_current_version(self):
        assert storage.empty_store()["storeVersion"] == storage.STORE_VERSION


class TestRoundTrip:
    def test_saved_payload_reads_back_intact(self):
        storage.save_store({"authenticated": True, "student": {"regNo": "22BCE1234"}})
        store = storage.load_store()
        assert store["authenticated"] is True
        assert store["student"]["regNo"] == "22BCE1234"

    def test_save_stamps_the_version_even_if_the_caller_omits_it(self):
        storage.save_store({"authenticated": True})
        assert storage.load_store()["storeVersion"] == storage.STORE_VERSION

    def test_clear_returns_to_the_empty_state(self):
        storage.save_store({"authenticated": True})
        storage.clear_store()
        assert storage.load_store()["authenticated"] is False


class TestClearStore:
    """
    Logout has to actually clear the data, including when deletion fails.

    A read-only mount, a synced folder, or Windows holding the file open all make
    ``os.remove`` raise. The old implementation logged that and returned, so
    /vtop/logout answered "logged out" with the whole academic record still on
    disk and served on the next request.
    """

    def test_clear_removes_the_file_when_it_can(self):
        storage.save_store({"authenticated": True})
        storage.clear_store()
        assert not os.path.exists(storage.DATA_FILE)

    def test_clear_on_a_missing_file_is_a_no_op(self):
        storage.clear_store()  # must not raise
        assert storage.load_store()["authenticated"] is False

    def test_undeletable_file_is_overwritten_not_left_alone(self, monkeypatch):
        storage.save_store(
            {"authenticated": True, "student": {"regNo": "24BLC1100", "cgpa": 8.81}}
        )

        def refuse(_path):
            raise PermissionError("Operation not permitted")

        monkeypatch.setattr(os, "remove", refuse)
        storage.clear_store()

        # The file may still exist, but it must no longer hold the student's data.
        after = storage.load_store()
        assert after["authenticated"] is False
        assert after["student"]["regNo"] is None
        assert after["student"]["cgpa"] is None
        with open(storage.DATA_FILE, encoding="utf-8") as handle:
            assert "24BLC1100" not in handle.read()


class TestVersionGuard:
    def test_v1_store_from_the_old_build_is_not_served(self):
        _write_raw(
            {
                "student": {
                    "name": "Pragyan Jain",
                    "regNo": "24BLC1100",
                    "cgpa": 8.85,
                    "totalCreditsRequired": 160,
                },
                "exams": [],  # v1 shape: a list, not a mapping
            }
        )
        store = storage.load_store()
        assert store["student"]["name"] is None
        assert store["student"]["cgpa"] is None
        assert store["authenticated"] is False

    def test_v1_exams_list_cannot_reach_a_consumer_as_a_list(self):
        # A list here would break every `.items()` call downstream.
        _write_raw({"exams": [{"examType": "CAT 1"}]})
        assert storage.load_store()["exams"] == {}

    def test_the_retired_store_is_kept_not_deleted(self):
        _write_raw({"student": {"cgpa": 8.85}})
        storage.load_store()
        assert os.path.exists(f"{storage.DATA_FILE}.old")
        with open(f"{storage.DATA_FILE}.old", encoding="utf-8") as handle:
            assert json.load(handle)["student"]["cgpa"] == 8.85

    def test_a_newer_store_is_also_refused(self):
        # Downgrading should not read a shape this code does not understand.
        _write_raw({"storeVersion": storage.STORE_VERSION + 1, "authenticated": True})
        assert storage.load_store()["authenticated"] is False

    def test_a_current_store_survives_reload(self):
        storage.save_store({"authenticated": True, "student": {"regNo": "22BCE1234"}})
        assert storage.load_store()["student"]["regNo"] == "22BCE1234"
        # Still there on a second read: loading must not retire a valid store.
        assert storage.load_store()["authenticated"] is True


class TestCorruptFile:
    def test_truncated_json_reads_as_disconnected(self):
        os.makedirs(os.path.dirname(storage.DATA_FILE), exist_ok=True)
        with open(storage.DATA_FILE, "w", encoding="utf-8") as handle:
            handle.write('{"student": {"regNo":')
        assert storage.load_store()["authenticated"] is False

    def test_a_json_list_is_rejected(self):
        _write_raw([1, 2, 3])
        assert storage.load_store()["authenticated"] is False
