"""
Unit tests for unified academic assignments aggregation, duplicate detection, and subject-first dashboard.
"""

import os
import tempfile
from datetime import datetime, timezone

import pytest
from fastapi.testclient import TestClient

from app import storage
from app.main import app
from app.routers.unified_assignments import (
    are_duplicate_assignments,
    merge_assignment_pair,
    compute_relative_deadline,
    build_unified_assignment_dashboard,
)

REAL_STORE = storage.DATA_FILE
storage.DATA_FILE = os.path.join(
    tempfile.mkdtemp(prefix="campusos-unified-test-"), "store.json"
)

client = TestClient(app)


@pytest.fixture(autouse=True)
def isolated_store(tmp_path, monkeypatch):
    temp_file = str(tmp_path / "store.json")
    monkeypatch.setattr(storage, "DATA_FILE", temp_file)
    storage.save_store({
        "authenticated": True,
        "teamsConnected": True,
        "lmsConnected": True,
        "selectedSemester": {"id": "CH20262701", "name": "Fall Semester 2026-27"},
        "teamsAccount": {
            "email": "pragyan@vitstudent.ac.in",
            "matchedSubjects": [{"courseCode": "BCSE302L", "teamName": "BCSE302L - Database Systems"}],
        },
        "lmsAccount": {
            "username": "24BLC1100",
            "matchedSubjects": [{"courseCode": "BCSE302L", "lmsCourseName": "BCSE302L - Database Systems"}],
        },
        "courses": [
            {
                "code": "BCSE302L",
                "title": "Database Systems",
                "faculty": "RISHIKESHAN C A",
                "type": "Theory",
                "slot": "F2+TF2",
            },
            {
                "code": "BCSE308L",
                "title": "Computer Networks",
                "faculty": "JAYA VIGNESH T",
                "type": "Theory",
                "slot": "A2+TA2",
            },
        ],
        "assignments": [],
    })
    yield


class TestDuplicateDetection:
    def test_exact_match_detected(self):
        t = {
            "courseCode": "BCSE302L",
            "title": "Digital Assignment 1 - SQL Queries",
            "dueDate": "2026-08-28",
            "source": "Teams",
        }
        l = {
            "courseCode": "BCSE302L",
            "title": "DA 1: SQL Queries",
            "dueDate": "2026-08-28",
            "source": "LMS",
        }
        assert are_duplicate_assignments(t, l) is True

    def test_different_course_not_duplicate(self):
        t = {"courseCode": "BCSE302L", "title": "Assignment 1", "dueDate": "2026-08-28"}
        l = {"courseCode": "BCSE308L", "title": "Assignment 1", "dueDate": "2026-08-28"}
        assert are_duplicate_assignments(t, l) is False

    def test_different_task_not_duplicate(self):
        t = {"courseCode": "BCSE302L", "title": "Assignment 1: SQL", "dueDate": "2026-08-28"}
        l = {"courseCode": "BCSE302L", "title": "Assignment 2: Normalization", "dueDate": "2026-09-10"}
        assert are_duplicate_assignments(t, l) is False

    def test_merged_assignment_structure(self):
        t = {
            "id": "teams-1",
            "courseCode": "BCSE302L",
            "courseTitle": "Database Systems",
            "title": "Digital Assignment 1 - SQL",
            "dueDate": "2026-08-28",
            "dueTime": "23:59",
            "status": "Pending",
            "platformUrl": "https://teams.microsoft.com/l/entity/1",
        }
        l = {
            "id": "lms-1",
            "courseCode": "BCSE302L",
            "courseTitle": "Database Systems",
            "title": "DA-1: SQL",
            "dueDate": "2026-08-28",
            "dueTime": "23:59",
            "status": "Pending",
            "platformUrl": "https://lms.vit.ac.in/mod/assign/view.php?id=808",
        }
        merged = merge_assignment_pair(t, l)
        assert merged["source"] == "Teams + LMS"
        assert merged["teamsSubmissionUrl"] == "https://teams.microsoft.com/l/entity/1"
        assert merged["lmsSubmissionUrl"] == "https://lms.vit.ac.in/mod/assign/view.php?id=808"


class TestRelativeDeadlines:
    def test_overdue_calculation(self):
        now = datetime(2026, 8, 27, 12, 0, tzinfo=timezone.utc)
        meta = compute_relative_deadline("2026-08-26", "23:59", "Pending", now)
        assert meta["isOverdue"] is True
        assert meta["finalStatus"].upper() == "OVERDUE"
        assert "Overdue" in meta["relativeDeadline"]

    def test_due_today_calculation(self):
        now = datetime(2026, 8, 27, 12, 0, tzinfo=timezone.utc)
        meta = compute_relative_deadline("2026-08-27", "23:59", "Pending", now)
        assert meta["isDueSoon"] is True
        assert "Due today" in meta["relativeDeadline"]

    def test_due_tomorrow_calculation(self):
        now = datetime(2026, 8, 27, 12, 0, tzinfo=timezone.utc)
        meta = compute_relative_deadline("2026-08-28", "23:59", "Pending", now)
        assert meta["isDueSoon"] is True
        assert "Due tomorrow" in meta["relativeDeadline"]


class TestSubjectFirstDashboard:
    def test_dashboard_groups_by_subject(self):
        store = storage.load_store()
        store["assignments"] = [
            {
                "id": "t-1",
                "courseCode": "BCSE302L",
                "courseTitle": "Database Systems",
                "faculty": "RISHIKESHAN C A",
                "title": "DA 1",
                "source": "Teams",
                "dueDate": "2026-08-28",
                "dueTime": "23:59",
                "status": "Pending",
                "platformUrl": "https://teams.microsoft.com/assign/1",
            },
            {
                "id": "l-1",
                "courseCode": "BCSE302L",
                "courseTitle": "Database Systems",
                "faculty": "RISHIKESHAN C A",
                "title": "DA 1",
                "source": "LMS",
                "dueDate": "2026-08-28",
                "dueTime": "23:59",
                "status": "Pending",
                "platformUrl": "https://lms.vit.ac.in/assign/1",
            },
            {
                "id": "t-2",
                "courseCode": "BCSE308L",
                "courseTitle": "Computer Networks",
                "faculty": "JAYA VIGNESH T",
                "title": "Wireshark Lab",
                "source": "Teams",
                "dueDate": "2026-09-02",
                "dueTime": "23:59",
                "status": "Submitted",
                "platformUrl": "https://teams.microsoft.com/assign/2",
            },
        ]
        storage.save_store(store)

        res = client.get("/api/assignments/unified")
        assert res.status_code == 200
        data = res.json()

        # Subject first: top level has subjects list
        subjects = data["subjects"]
        assert len(subjects) == 2

        dbms = next(s for s in subjects if s["courseCode"] == "BCSE302L")
        cn = next(s for s in subjects if s["courseCode"] == "BCSE308L")

        # Duplicate merged: DA 1 from Teams + LMS merged into 1 item
        assert len(dbms["assignments"]) == 1
        assert dbms["assignments"][0]["source"] == "Teams + LMS"
        assert dbms["pendingCount"] == 1

        assert len(cn["assignments"]) == 1
        assert cn["pendingCount"] == 0
        assert cn["submittedCount"] == 1

    def test_dashboard_filters_out_assignments_with_unmatched_professor(self):
        """Assignments from a different professor must be filtered out."""
        store = storage.load_store()
        store["assignments"] = [
            {
                "id": "wrong-prof-1",
                "courseCode": "BCSE302L",
                "courseTitle": "Database Systems",
                "faculty": "Dr. Wrong Professor",
                "title": "Unauthorized Assignment",
                "source": "Teams",
                "dueDate": "2026-08-28",
                "dueTime": "23:59",
                "status": "Pending",
                "platformUrl": "https://teams.microsoft.com/assign/fake",
            }
        ]
        storage.save_store(store)

        res = client.get("/api/assignments/unified")
        assert res.status_code == 200
        data = res.json()
        dbms = next(s for s in data["subjects"] if s["courseCode"] == "BCSE302L")
        # Must be filtered out because professor does not match RISHIKESHAN C A
        assert len(dbms["assignments"]) == 0


    def test_academic_accounts_status_endpoint(self):
        res = client.get("/api/academic-accounts/status")
        assert res.status_code == 200
        data = res.json()
        assert data["teams"]["connected"] is True
        assert data["lms"]["connected"] is True
        assert data["currentSemester"]["name"] == "Fall Semester 2026-27"
