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

    def test_manual_status_preserved_in_unified_dashboard(self):
        """When manualAssignmentStatus records an assignment as done, the unified dashboard must show it as DONE."""
        store = storage.load_store()
        store["assignments"] = [
            {
                "id": "lms-assign-1",
                "courseCode": "BCSE302L",
                "courseTitle": "Database Systems",
                "faculty": "RISHIKESHAN C A",
                "postedBy": "RISHIKESHAN C A",
                "title": "Lab Worksheet 1",
                "source": "LMS",
                "dueDate": "2026-09-20",
                "dueTime": "23:59",
                "status": "Pending",
                "verifiedCourseMatchId": "BCSE302L",
            }
        ]
        store["manualAssignmentStatus"] = {
            "lms-assign-1": True,
        }
        storage.save_store(store)

        res = client.get("/api/assignments/unified")
        assert res.status_code == 200
        data = res.json()
        dbms = next(s for s in data["subjects"] if s["courseCode"] == "BCSE302L")
        assert len(dbms["assignments"]) == 1
        assign = dbms["assignments"][0]
        assert assign["isDone"] is True
        assert assign["displayStatus"] == "DONE"
        assert dbms["pendingCount"] == 0
        assert dbms["submittedCount"] == 1

    def test_update_assignment_status_persists_manual_status(self):
        """PUT /api/assignments/{id}/status updates manual status map and works for unified IDs."""
        store = storage.load_store()
        store["assignments"] = [
            {
                "id": "teams-comp-1",
                "courseCode": "BCSE302L",
                "title": "Quiz 1",
                "status": "Pending",
            }
        ]
        storage.save_store(store)

        # Call endpoint for unified ID
        res = client.put("/api/assignments/unified-teams-comp-1-lms-comp-2/status", json={"status": "Submitted"})
        assert res.status_code == 200
        data = res.json()
        assert data["isDone"] is True
        assert data["displayStatus"] == "DONE"

        # Verify storage was updated with manualAssignmentStatus
        updated_store = storage.load_store()
        assert "manualAssignmentStatus" in updated_store
        assert updated_store["manualAssignmentStatus"]["unified-teams-comp-1-lms-comp-2"] is True
        assert updated_store["manualAssignmentStatus"]["teams-comp-1"] is True
        assert updated_store["manualAssignmentStatus"]["lms-comp-2"] is True


class TestVtopLmsFacultyMatchingDashboard:
    """
    Tests the VTOP + LMS Faculty Matching and Assignment Association flow.
    Ensures ONLY LMS assignments belonging to faculty members actually associated
    with the student's enrolled VTOP subjects are shown.
    """

    def test_example_flow_from_user_specification(self):
        """
        VTOP:
          Data Structures -> Dr. Sharma
          Operating Systems -> Dr. Kumar
        LMS:
          Dr. Sharma -> Assignment 1
          Dr. Kumar -> Assignment 2
          Dr. Patel -> Assignment 3
        CampusOS must show:
          Data Structures: [Assignment 1]
          Operating Systems: [Assignment 2]
          Assignment 3 should NOT appear anywhere!
        """
        store = storage.load_store()
        store["courses"] = [
            {
                "code": "BCSE202L",
                "title": "Data Structures",
                "faculty": "Dr. Sharma",
                "type": "Theory",
            },
            {
                "code": "BCSE301L",
                "title": "Operating Systems",
                "faculty": "Dr. Kumar",
                "type": "Theory",
            },
        ]
        store["assignments"] = [
            {
                "id": "lms-assign-1",
                "title": "Assignment 1",
                "source": "LMS",
                "faculty": "Dr. Sharma",
                "postedBy": "Dr. Sharma",
                "dueDate": "2026-09-30",
                "status": "Pending",
            },
            {
                "id": "lms-assign-2",
                "title": "Assignment 2",
                "source": "LMS",
                "faculty": "Dr. Kumar",
                "postedBy": "Dr. Kumar",
                "dueDate": "2026-10-05",
                "status": "Pending",
            },
            {
                "id": "lms-assign-3",
                "title": "Assignment 3",
                "source": "LMS",
                "faculty": "Dr. Patel",
                "postedBy": "Dr. Patel",
                "dueDate": "2026-10-10",
                "status": "Pending",
            },
        ]
        storage.save_store(store)

        res = client.get("/api/assignments/unified")
        assert res.status_code == 200
        data = res.json()

        subjects = data["subjects"]
        ds_subj = next((s for s in subjects if s["courseCode"] == "BCSE202L"), None)
        os_subj = next((s for s in subjects if s["courseCode"] == "BCSE301L"), None)

        assert ds_subj is not None
        assert os_subj is not None

        # Data Structures must have Assignment 1
        assert len(ds_subj["assignments"]) == 1
        assert ds_subj["assignments"][0]["title"] == "Assignment 1"
        assert ds_subj["assignments"][0]["faculty"] == "Dr. Sharma"

        # Operating Systems must have Assignment 2
        assert len(os_subj["assignments"]) == 1
        assert os_subj["assignments"][0]["title"] == "Assignment 2"
        assert os_subj["assignments"][0]["faculty"] == "Dr. Kumar"

        # Assignment 3 (Dr. Patel) must NOT appear in any subject
        all_assigned_titles = [
            a["title"]
            for s in subjects
            for a in s["assignments"]
        ]
        assert "Assignment 3" not in all_assigned_titles

        # Assignment 3 must NOT appear in unmatched assignments
        unmatched_titles = [a["title"] for a in data.get("unmatchedAssignments", [])]
        assert "Assignment 3" not in unmatched_titles

        # Total assignments must strictly be 2 (Assignment 1 and 2)
        assert data["totalAssignments"] == 2

    def test_unmatched_faculty_lms_assignments_dropped_completely(self):
        """When an LMS assignment belongs to an unassociated professor, it is dropped."""
        store = storage.load_store()
        store["courses"] = [
            {
                "code": "BMAT201L",
                "title": "Complex Variables and Linear Algebra",
                "faculty": "Prof. S. Geetha",
            }
        ]
        store["assignments"] = [
            {
                "id": "lms-cv-1",
                "title": "Linear Algebra Problem Set",
                "source": "LMS",
                "postedBy": "Geetha S",
                "faculty": "Geetha S",
            },
            {
                "id": "lms-unrelated",
                "title": "Thermodynamics Quiz",
                "source": "LMS",
                "postedBy": "Dr. R. Sundaram",
                "faculty": "Dr. R. Sundaram",
            },
        ]
        storage.save_store(store)

        res = client.get("/api/assignments/unified")
        assert res.status_code == 200
        data = res.json()

        cv_subj = next(s for s in data["subjects"] if s["courseCode"] == "BMAT201L")
        assert len(cv_subj["assignments"]) == 1
        assert cv_subj["assignments"][0]["title"] == "Linear Algebra Problem Set"
        assert data["totalAssignments"] == 1
        assert len(data.get("unmatchedAssignments", [])) == 0

    def test_empty_state_when_no_faculty_matches(self):
        """When zero LMS assignments match enrolled faculty, total assignments is 0."""
        store = storage.load_store()
        store["courses"] = [
            {
                "code": "BCSE202L",
                "title": "Data Structures",
                "faculty": "Dr. Sharma",
            }
        ]
        store["assignments"] = [
            {
                "id": "lms-other",
                "title": "Assignment 99",
                "source": "LMS",
                "postedBy": "Dr. Patel",
                "faculty": "Dr. Patel",
            }
        ]
        storage.save_store(store)

        res = client.get("/api/assignments/unified")
        assert res.status_code == 200
        data = res.json()

        assert data["totalAssignments"] == 0
        ds_subj = next(s for s in data["subjects"] if s["courseCode"] == "BCSE202L")
        assert len(ds_subj["assignments"]) == 0
        assert len(data.get("unmatchedAssignments", [])) == 0


