"""
Contract tests for the sync pipeline.

These run the whole assembly against a fake session that serves the HTML
fixtures, so they cover the part no parser test can: that the modules are joined
to each other correctly. The joins are where the old dashboard went wrong — an
attendance figure attached to the wrong course, or a timetable entry given an
invented venue, are both invisible to per-parser tests.

They also pin the failure behaviour: one dead module must not take the rest of
the sync with it, and the report must say what happened.
"""

import pytest

from app.vtop import constants as C
from app.vtop.scraper import (
    EMPTY,
    FAILED,
    OK,
    UNAVAILABLE,
    SyncReport,
    build_registry,
    choose_semester,
    overall_attendance,
    sync,
)
from tests.fixtures import vtop_pages as pages


class FakeSession:
    """
    Serves fixture HTML per endpoint, recording how it was called.

    Also asserts the body-shape contract: the reference is specific about which
    endpoints put ``_csrf`` first and which put it last, so the fake records
    ``csrf_first`` for the tests to check.
    """

    def __init__(self, responses=None, fail=()):
        self.responses = responses if responses is not None else self._defaults()
        self.fail = set(fail)
        self.calls = []

    @staticmethod
    def _defaults():
        return {
            C.SEMESTER_LIST: pages.SEMESTERS,
            C.PROFILE: pages.PROFILE,
            C.TIMETABLE: pages.TIMETABLE_PAGE,
            C.ATTENDANCE: pages.ATTENDANCE,
            C.MARKS: pages.MARKS,
            C.EXAM_SCHEDULE: pages.EXAM_SCHEDULE,
            C.OD: pages.OD_NO_RECORDS,
        }

    def _serve(self, path, **kwargs):
        self.calls.append({"path": path, **kwargs})
        if path in self.fail:
            raise RuntimeError(f"simulated failure for {path}")
        return self.responses.get(path, "<html><body></body></html>")

    def post_menu(self, path, with_win_image=False):
        return self._serve(path, shape="menu", with_win_image=with_win_image)

    def post_semester(self, path, semester_id, csrf_first=True):
        return self._serve(
            path, shape="semester", semester_id=semester_id, csrf_first=csrf_first
        )

    def post_simple(self, path):
        return self._serve(path, shape="simple")

    def call_for(self, path):
        for call in self.calls:
            if call["path"] == path:
                return call
        return None


@pytest.fixture
def result():
    return sync(FakeSession())


# ---------------------------------------------------------------------------
# request contract
# ---------------------------------------------------------------------------


class TestRequestShapes:
    def test_timetable_page_is_requested_exactly_once(self):
        # Courses and grid come from the same response; two requests would be a
        # pointless extra round trip against VTOP.
        session = FakeSession()
        sync(session)
        timetable_calls = [c for c in session.calls if c["path"] == C.TIMETABLE]
        assert len(timetable_calls) == 1

    def test_semester_scoped_endpoints_receive_the_semester_id(self):
        session = FakeSession()
        sync(session)
        for path in (C.TIMETABLE, C.ATTENDANCE, C.MARKS, C.EXAM_SCHEDULE):
            call = session.call_for(path)
            assert call["shape"] == "semester"
            assert call["semester_id"] == "CH20242501"

    def test_menu_endpoints_use_the_menu_body_shape(self):
        session = FakeSession()
        sync(session)
        assert session.call_for(C.SEMESTER_LIST)["shape"] == "menu"
        assert session.call_for(C.PROFILE)["shape"] == "menu"

    def test_csrf_ordering_matches_the_reference(self):
        # Timetable and attendance send _csrf first; marks and exams send it last.
        session = FakeSession()
        sync(session)
        assert session.call_for(C.TIMETABLE)["csrf_first"] is True
        assert session.call_for(C.ATTENDANCE)["csrf_first"] is True
        assert session.call_for(C.MARKS)["csrf_first"] is False
        assert session.call_for(C.EXAM_SCHEDULE)["csrf_first"] is False


# ---------------------------------------------------------------------------
# semester selection
# ---------------------------------------------------------------------------


class TestSemesterSelection:
    SEMS = [{"id": "A", "name": "Fall"}, {"id": "B", "name": "Winter"}]

    def test_defaults_to_the_first_entry(self):
        report = SyncReport()
        assert choose_semester(self.SEMS, None, report)["id"] == "A"
        assert report.warnings == []

    def test_explicit_request_wins(self):
        report = SyncReport()
        assert choose_semester(self.SEMS, "B", report)["id"] == "B"

    def test_unknown_request_falls_back_and_warns(self):
        # Silently syncing a different semester than asked for is how a user ends
        # up trusting last term's attendance.
        report = SyncReport()
        assert choose_semester(self.SEMS, "ZZZ", report)["id"] == "A"
        assert any("ZZZ" in w for w in report.warnings)

    def test_no_semesters_yields_none(self):
        assert choose_semester([], None, SyncReport()) is None

    def test_requested_semester_is_used_for_every_module(self):
        session = FakeSession()
        sync(session, semester_id="CH20242502")
        assert session.call_for(C.ATTENDANCE)["semester_id"] == "CH20242502"


# ---------------------------------------------------------------------------
# the joins
# ---------------------------------------------------------------------------


class TestAttendanceJoin:
    def test_every_row_binds_to_a_registered_course(self, result):
        records = result["attendance"]
        assert len(records) == 3
        assert all(record["resolved"] for record in records)

    def test_theory_and_lab_of_one_course_stay_distinct(self, result):
        theory, lab, _ = result["attendance"]
        assert theory["courseCode"] == lab["courseCode"] == "CSE1002"
        assert theory["courseId"] != lab["courseId"]
        # The venues prove they resolved to different registry entries.
        assert theory["venue"] == "AB1-405"
        assert lab["venue"] == "AB2-210"
        assert theory["attended"] == 26
        assert lab["attended"] == 10

    def test_percentage_is_recomputed_not_copied(self, result):
        # VTOP printed 86 for 26/30; the true value is 86.7.
        theory = result["attendance"][0]
        assert theory["reportedPercentage"] == 86.0
        assert theory["percentage"] == 86.7
        assert theory["hasValidData"] is True

    def test_recompute_disagreement_is_not_warned_when_within_rounding(self, result):
        # 26/30 -> 86.7 vs printed 86.0 is a rounding artefact, not a discrepancy.
        assert not any("attendance: VTOP printed" in w for w in result["syncReport"]["warnings"])

    def test_zero_conducted_course_reports_no_valid_data(self, result):
        maths = result["attendance"][2]
        assert maths["attended"] == 0
        assert maths["total"] == 0
        assert maths["percentage"] is None
        assert maths["hasValidData"] is False
        assert maths["displayPercentage"] == "Not available"

    def test_venue_and_faculty_come_from_the_registry(self, result):
        maths = result["attendance"][2]
        assert maths["venue"] == "AB1-302"
        assert maths["faculty"] == "JEAN-PAUL MENON"


class TestOverallAttendance:
    def test_aggregates_from_counts_not_by_averaging_percentages(self, result):
        # 26+10+0 attended of 30+14+0 conducted = 36/44 = 81.8%.
        # Averaging the three course percentages would give ~52.6%.
        overall = result["student"]["overallAttendance"]
        assert overall["attended"] == 36
        assert overall["total"] == 44
        assert overall["percentage"] == 81.8

    def test_no_records_is_not_valid_data(self):
        overall = overall_attendance([])
        assert overall["hasValidData"] is False
        assert overall["percentage"] is None


class TestMarksJoin:
    def test_binds_marks_to_courses(self, result):
        marks = result["marks"]
        assert len(marks) == 2
        assert all(record["resolved"] for record in marks)
        assert marks[0]["courseCode"] == "CSE1002"

    def test_components_are_preserved_verbatim(self, result):
        titles = [c["title"] for c in result["marks"][0]["components"]]
        assert titles == ["CAT-1", "Quiz 1", "CAT-2"]

    def test_totals_count_only_graded_components(self, result):
        # Graded: CAT-1 (12.6 of 15) and Quiz 1 (0 of 10). CAT-2 exists but has no
        # weightage mark yet, so it must not enter the denominator — otherwise a
        # student sees 12.6/40 and thinks they are failing.
        first = result["marks"][0]
        assert first["weightageScored"] == 12.6
        assert first["weightageGraded"] == 25.0

    def test_total_course_weightage_is_reported_separately(self, result):
        # All components including the ungraded CAT-2.
        assert result["marks"][0]["weightageTotal"] == 40.0

    def test_a_zero_mark_counts_as_graded(self, result):
        # Quiz 1 scored a real 0; its 10% must be in the denominator.
        quiz = result["marks"][0]["components"][1]
        assert quiz["weightage"] == 0.0
        assert result["marks"][0]["weightageGraded"] == 25.0

    def test_marks_are_not_forced_into_fixed_buckets(self, result):
        # No cat1/cat2/quiz keys: the component list is the shape.
        assert "cat1" not in result["marks"][0]


class TestTimetableJoin:
    def test_only_registered_cells_become_entries(self, result):
        # The grid also shows B1, C1 and L23, which the student is not registered
        # for; those must not appear.
        slots = {entry["slotName"] for entry in result["timetable"]}
        assert slots == {"A1", "B2", "L21"}

    def test_course_details_come_from_the_registry(self, result):
        monday = next(e for e in result["timetable"] if e["day"] == "MON")
        assert monday["slotName"] == "A1"
        assert monday["courseCode"] == "CSE1002"
        assert monday["courseTitle"] == "Object-Oriented Programming"
        assert monday["venue"] == "AB1-405"
        assert monday["faculty"] == "RAJESH KUMAR"
        assert monday["isLab"] is False

    def test_times_come_from_the_grid_with_pm_resolved(self, result):
        monday = next(e for e in result["timetable"] if e["day"] == "MON")
        assert monday["startTime"] == "08:00"
        assert monday["endTime"] == "08:50"

        lab = next(e for e in result["timetable"] if e["isLab"])
        assert lab["startTime"] == "14:00"
        assert lab["startTime12h"] == "02:00 PM"

    def test_lab_entry_resolves_in_the_lab_namespace(self, result):
        lab = next(e for e in result["timetable"] if e["isLab"])
        assert lab["day"] == "TUE"
        assert lab["slotName"] == "L21"
        assert lab["venue"] == "AB2-210"
        assert lab["type"] == "Lab"

    def test_entries_carry_their_course_attendance(self, result):
        monday = next(e for e in result["timetable"] if e["day"] == "MON")
        assert monday["attendance"]["attended"] == 26
        assert monday["attendance"]["percentage"] == 86.7

    def test_entries_are_ordered_by_day_then_time(self, result):
        order = [(e["day"], e["startTime"]) for e in result["timetable"]]
        assert order == sorted(order, key=lambda dt: (["MON", "TUE"].index(dt[0]), dt[1]))

    def test_every_entry_is_resolved(self, result):
        assert all(entry["resolved"] for entry in result["timetable"])


class TestCourseAssembly:
    def test_one_record_per_registered_course(self, result):
        assert len(result["courses"]) == 3

    def test_course_carries_its_attendance_and_marks(self, result):
        theory = result["courses"][0]
        assert theory["code"] == "CSE1002"
        assert theory["attendance"]["attended"] == 26
        assert [c["title"] for c in theory["marks"]] == ["CAT-1", "Quiz 1", "CAT-2"]

    def test_course_without_marks_has_none_not_empty(self, result):
        # The lab has attendance but no marks row; None says "nothing published",
        # which is different from "published, and it was empty".
        lab = result["courses"][1]
        assert lab["attendance"] is not None
        assert lab["marks"] is None

    def test_slots_are_preserved(self, result):
        assert result["courses"][0]["slots"] == ["A1", "TA1"]
        assert result["courses"][0]["slot"] == "A1+TA1"

    def test_registered_credits_are_summed(self, result):
        assert result["student"]["registeredCredits"] == 11.0

    def test_faculty_is_projected_from_courses(self, result):
        faculty = {f["name"]: f["courses"] for f in result["faculty"]}
        assert faculty["RAJESH KUMAR"] == ["CSE1002"]
        assert faculty["JEAN-PAUL MENON"] == ["MAT2002"]


class TestStudentHeader:
    def test_profile_fields_pass_through(self, result):
        student = result["student"]
        assert student["name"] == "ANANYA SHARMA"
        assert student["regNo"] == "22BCE1234"
        assert student["branch"] == "Computer Science and Engineering"

    def test_semester_is_recorded(self, result):
        assert result["student"]["semester"] == "Fall Semester 2024-25"
        assert result["student"]["semesterId"] == "CH20242501"

    def test_unavailable_fields_are_none_not_plausible_numbers(self, result):
        # These were previously defaulted to invented values.
        student = result["student"]
        assert student["cgpa"] is None
        assert student["rank"] is None
        assert student["creditsEarned"] is None


class TestExams:
    def test_exams_are_grouped_by_type(self, result):
        assert set(result["exams"]) == {"CAT 1", "FAT"}
        assert len(result["exams"]["CAT 1"]) == 2

    def test_unallotted_exam_details_stay_none(self, result):
        fat = result["exams"]["FAT"][0]
        assert fat["date"] == "28-MAY-2025"
        assert fat["venue"] is None
        assert fat["seat_number"] is None


# ---------------------------------------------------------------------------
# failure isolation
# ---------------------------------------------------------------------------


class TestModuleIsolation:
    def test_marks_failure_does_not_lose_attendance(self):
        result = sync(FakeSession(fail=[C.MARKS]))
        assert result["marks"] == []
        assert len(result["attendance"]) == 3
        assert result["syncReport"]["modules"]["marks"]["status"] == FAILED
        assert result["syncReport"]["modules"]["attendance"]["status"] == OK

    def test_failure_message_is_captured(self):
        result = sync(FakeSession(fail=[C.MARKS]))
        message = result["syncReport"]["modules"]["marks"]["message"]
        assert "RuntimeError" in message
        assert C.MARKS in message

    def test_report_is_not_ok_when_a_module_failed(self):
        result = sync(FakeSession(fail=[C.ATTENDANCE]))
        assert result["syncReport"]["ok"] is False
        assert result["syncReport"]["failed"] == ["attendance"]

    def test_report_is_ok_on_a_clean_run(self, result):
        assert result["syncReport"]["ok"] is True
        assert result["syncReport"]["failed"] == []

    def test_timetable_page_failure_marks_both_dependents_failed(self):
        result = sync(FakeSession(fail=[C.TIMETABLE]))
        modules = result["syncReport"]["modules"]
        assert modules["courses"]["status"] == FAILED
        assert modules["timetableGrid"]["status"] == FAILED
        assert result["courses"] == []
        assert result["timetable"] == []

    def test_unbound_rows_survive_a_missing_registry(self):
        # With no course table, attendance still has real numbers — they just
        # can't be enriched. Losing them entirely would be worse.
        result = sync(FakeSession(fail=[C.TIMETABLE]))
        records = result["attendance"]
        assert len(records) == 3
        assert all(record["resolved"] is False for record in records)
        assert records[0]["attended"] == 26
        # And the page's own course code is kept rather than left blank.
        assert records[0]["courseCode"] == "CSE1002"
        assert records[0]["venue"] is None

    def test_unresolved_rows_are_reported(self):
        result = sync(FakeSession(fail=[C.TIMETABLE]))
        assert any(
            "could not be matched" in warning
            for warning in result["syncReport"]["warnings"]
        )

    def test_empty_module_is_distinguished_from_failed(self):
        session = FakeSession()
        session.responses[C.ATTENDANCE] = pages.ATTENDANCE_NO_RECORDS
        result = sync(session)
        assert result["syncReport"]["modules"]["attendance"]["status"] == EMPTY
        assert result["syncReport"]["ok"] is True

    def test_no_semester_dropdown_skips_scoped_modules_with_a_warning(self):
        session = FakeSession()
        session.responses[C.SEMESTER_LIST] = pages.SEMESTERS_UNAUTHORIZED
        result = sync(session)
        assert result["selectedSemester"] is None
        assert result["attendance"] == []
        assert any("No semester" in w for w in result["syncReport"]["warnings"])
        # Profile is not semester-scoped, so it still comes through.
        assert result["student"]["name"] == "ANANYA SHARMA"


class TestOnDutyIsAuthoritative:
    def test_od_is_authoritative_from_vtop(self):
        responses = {
            C.SEMESTER_LIST: pages.SEMESTERS,
            C.PROFILE: pages.PROFILE,
            C.TIMETABLE: pages.TIMETABLE_PAGE,
            C.ATTENDANCE: pages.ATTENDANCE,
            C.MARKS: pages.MARKS,
            C.EXAM_SCHEDULE: pages.EXAM_SCHEDULE,
            C.OD: pages.OD_PAGE,
        }
        res = sync(FakeSession(responses=responses))
        assert res["syncReport"]["modules"]["od"]["status"] == OK
        assert res["od"]["hasValidData"] is True
        assert res["od"]["usedHours"] == 3
        assert res["od"]["remainingHours"] == 37
        assert len(res["od"]["records"]) == 2

    def test_od_defaults_to_zero_when_no_records(self, result):
        assert result["od"]["hasValidData"] is True
        assert result["od"]["usedHours"] == 0
        assert result["od"]["remainingHours"] == 40



class TestNoFabricatedValues:
    FORBIDDEN = [
        "AB-2 • Room 304",
        "AB-2 402",
        "Academic Block",
        "Not assigned",
        "Assigned upon entry",
        "Sep 10, 2026",
        "Course CSE1002",
        "AB1 - 405",
    ]

    def test_full_payload_contains_no_known_fictions(self, result):
        rendered = repr(result)
        for forbidden in self.FORBIDDEN:
            assert forbidden not in rendered, f"fabricated value leaked: {forbidden}"

    def test_failed_sync_does_not_backfill(self):
        result = sync(FakeSession(fail=[C.TIMETABLE, C.MARKS, C.EXAM_SCHEDULE]))
        assert result["courses"] == []
        assert result["timetable"] == []
        assert result["marks"] == []
        assert result["exams"] == {}
        assert result["student"]["registeredCredits"] is None


class TestFullVTOPModulesSync:
    def test_sync_with_all_vtop_modules(self):
        responses = {
            C.SEMESTER_LIST: pages.SEMESTERS,
            C.PROFILE: pages.PROFILE,
            C.TIMETABLE: pages.TIMETABLE_PAGE,
            C.ATTENDANCE: pages.ATTENDANCE,
            C.MARKS: pages.MARKS,
            C.EXAM_SCHEDULE: pages.EXAM_SCHEDULE,
            C.GRADE_HISTORY: pages.GRADE_HISTORY,
            C.SEMESTER_GRADES: pages.SEMESTER_GRADES,
            C.RECEIPTS: pages.RECEIPTS,
            C.PAYMENTS: pages.PAYMENTS_WITH_DUES,
            C.PROCTOR: pages.PROCTOR,
            C.HOD_DEAN: pages.DEAN_HOD,
            C.SPOTLIGHT: pages.SPOTLIGHT,
            C.OD: pages.OD_PAGE,
        }
        res = sync(FakeSession(responses=responses))
        # CGPA and credits
        assert res["student"]["cgpa"] == 8.85
        assert res["student"]["creditsEarned"] == 84.0
        assert res["student"]["semesterGpa"][0]["gpa"] == 9.20
        # Proctor in student & faculty
        assert res["student"]["proctor"]["name"] == "DR. SURESH RAMAN"
        assert any(f["isProctor"] for f in res["faculty"])
        # Course grades
        assert res["courses"][0]["grade"] == "S"
        # Receipts and dues
        assert len(res["receipts"]) == 2
        assert res["dues"]["hasDues"] is True
        assert len(res["fees"]) == 3  # 2 receipts + 1 due
        # Spotlight
        assert len(res["spotlight"]) == 3
        # On-Duty
        assert res["od"]["hasValidData"] is True
        assert res["od"]["usedHours"] == 3
        assert res["od"]["remainingHours"] == 37
        # Assignments
        assert len(res["assignments"]) > 0
        # AI Tasks
        assert len(res["aiTasks"]) > 0

