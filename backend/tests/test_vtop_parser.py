"""
Contract tests for the VTOP parsers.

These assert two things: that we read what VTOP actually said, and that we never
invent what it didn't. The second is the whole point of the rewrite — the
previous parsers filled gaps with plausible fictions, so several tests here exist
purely to assert that a missing value stays None.
"""

import pytest

from app.vtop import constants as C
from app.vtop.parser import (
    course_type_of,
    first_slot,
    parse_attendance,
    parse_courses,
    parse_dean_hod,
    parse_exam_schedule,
    parse_grade_history,
    parse_marks,
    parse_od,
    parse_payments,
    parse_proctor,
    parse_profile,
    parse_receipts,
    parse_semester_grades,
    parse_semesters,
    parse_spotlight,
    parse_timetable_grid,
    to_12h,
    to_24h,
)
from tests.fixtures import vtop_pages as pages



# ---------------------------------------------------------------------------
# helpers
# ---------------------------------------------------------------------------


class TestHelpers:
    def test_first_slot_takes_head_of_plus_list(self):
        assert first_slot("A1+TA1") == "A1"
        assert first_slot("L21+L22") == "L21"
        assert first_slot("B2") == "B2"

    def test_first_slot_handles_missing(self):
        assert first_slot(None) is None
        assert first_slot("") is None

    def test_course_type_classification(self):
        assert course_type_of("Embedded Lab") == C.TYPE_LAB
        assert course_type_of("Embedded Theory") == C.TYPE_THEORY
        assert course_type_of("Theory Only") == C.TYPE_THEORY
        assert course_type_of("Project / Internship") == C.TYPE_PROJECT
        # Anything unrecognised defaults to theory, as in the reference.
        assert course_type_of(None) == C.TYPE_THEORY

    def test_afternoon_times_resolve_to_pm(self):
        # VTOP prints bare times; anything before 08:00 must be PM.
        assert to_24h("02:00") == "14:00"
        assert to_24h("03:40") == "15:40"
        assert to_24h("08:00") == "08:00"
        assert to_24h("11:50") == "11:50"

    def test_time_helpers_reject_junk(self):
        assert to_24h("") is None
        assert to_24h(None) is None
        assert to_24h("-") is None
        assert to_24h("99:99") is None

    def test_display_formatting(self):
        assert to_12h("14:00") == "02:00 PM"
        assert to_12h("08:50") == "08:50 AM"
        assert to_12h("12:00") == "12:00 PM"


# ---------------------------------------------------------------------------
# semesters
# ---------------------------------------------------------------------------


class TestSemesters:
    def test_reads_options_and_skips_placeholder(self):
        result = parse_semesters(pages.SEMESTERS)
        assert result == [
            {"id": "CH20242501", "name": "Fall Semester 2024-25"},
            {"id": "CH20242502", "name": "Winter Semester 2024-25"},
        ]

    def test_unauthorized_yields_nothing(self):
        assert parse_semesters(pages.SEMESTERS_UNAUTHORIZED) == []

    def test_missing_dropdown_yields_nothing(self):
        assert parse_semesters("<html><body>nope</body></html>") == []


# ---------------------------------------------------------------------------
# profile
# ---------------------------------------------------------------------------


class TestProfile:
    def test_reads_labelled_fields(self):
        profile = parse_profile(pages.PROFILE)
        assert profile["name"] == "ANANYA SHARMA"
        assert profile["regNo"] == "22BCE1234"
        assert profile["program"] == "BTECH"
        assert profile["branch"] == "Computer Science and Engineering"
        assert profile["email"] == "ananya.sharma2022@vitstudent.ac.in"

    def test_unrecognised_page_yields_nothing(self):
        assert parse_profile("<html><body>login page</body></html>") == {}


# ---------------------------------------------------------------------------
# courses
# ---------------------------------------------------------------------------


class TestCourses:
    def test_parses_all_registered_courses(self):
        courses = parse_courses(pages.COURSES)
        assert len(courses) == 3

    def test_splits_code_and_title_preserving_hyphens(self):
        theory = parse_courses(pages.COURSES)[0]
        assert theory["code"] == "CSE1002"
        # The hyphen inside "Object-Oriented" must survive the code/title split.
        assert theory["title"] == "Object-Oriented Programming"

    def test_distinguishes_theory_from_lab_for_same_course_code(self):
        courses = parse_courses(pages.COURSES)
        theory, lab = courses[0], courses[1]
        assert theory["code"] == lab["code"] == "CSE1002"
        assert theory["type"] == C.TYPE_THEORY
        assert lab["type"] == C.TYPE_LAB
        # Same course, different slots — this is exactly why the registry needs
        # separate namespaces per type.
        assert theory["slots"] == ["A1", "TA1"]
        assert lab["slots"] == ["L21", "L22"]

    def test_reads_credits_from_last_ltpjc_token(self):
        courses = parse_courses(pages.COURSES)
        assert courses[0]["credits"] == 4.0
        assert courses[2]["credits"] == 3.0

    def test_splits_venue_and_faculty_from_paired_cells(self):
        # Slot/Venue and Faculty/School each pack two values into one cell,
        # separated by " - ". Splitting on the spaced separator (not a bare
        # hyphen) is what keeps "AB1-405" from becoming "AB1 - 405".
        theory = parse_courses(pages.COURSES)[0]
        assert theory["venue"] == "AB1-405"
        assert theory["faculty"] == "RAJESH KUMAR"

    def test_hyphenated_faculty_name_is_not_truncated(self):
        # The reference splits on a bare "-" and would return "JEAN" here.
        maths = parse_courses(pages.COURSES)[2]
        assert maths["faculty"] == "JEAN-PAUL MENON"
        assert maths["venue"] == "AB1-302"

    def test_falls_back_to_bare_hyphen_separator(self):
        # If VTOP ever drops the spaces, slots must still parse rather than the
        # whole cell being swallowed into slot[0].
        course = parse_courses(pages.COURSES_UNSPACED_SEPARATOR)[0]
        assert course["slots"] == ["A1", "TA1"]
        assert course["venue"] == "AB1"
        assert course["faculty"] == "RAJESH KUMAR"

    def test_survives_invoice_column_in_header_only(self):
        # Header is one column wider than the data rows: every index shifts left.
        courses = parse_courses(pages.COURSES_INVOICE_HEADER_ONLY)
        assert len(courses) == 1
        assert courses[0]["code"] == "CSE1002"
        assert courses[0]["credits"] == 4.0
        assert courses[0]["slots"] == ["A1", "TA1"]
        assert courses[0]["faculty"] == "RAJESH KUMAR"

    def test_survives_invoice_cell_in_body_only(self):
        # Data rows lead with an invoice cell the header doesn't declare: every
        # index shifts right.
        courses = parse_courses(pages.COURSES_INVOICE_BODY_ONLY)
        assert len(courses) == 1
        assert courses[0]["code"] == "CSE1002"
        assert courses[0]["credits"] == 4.0
        assert courses[0]["slots"] == ["A1", "TA1"]
        assert courses[0]["faculty"] == "RAJESH KUMAR"

    def test_missing_container_yields_nothing(self):
        assert parse_courses(pages.COURSES_EMPTY) == []


# ---------------------------------------------------------------------------
# timetable
# ---------------------------------------------------------------------------


class TestTimetableGrid:
    def test_reads_theory_period_times(self):
        grid = parse_timetable_grid(pages.TIMETABLE)
        theory = grid[C.TYPE_THEORY]
        assert len(theory) == 2
        assert theory[0]["start_time"] == "08:00"
        assert theory[0]["end_time"] == "08:50"
        assert theory[1]["start_time"] == "09:00"
        assert theory[1]["end_time"] == "09:50"

    def test_lab_afternoon_times_are_pm(self):
        grid = parse_timetable_grid(pages.TIMETABLE)
        lab = grid[C.TYPE_LAB]
        assert lab[0]["start_time"] == "14:00"
        assert lab[0]["end_time"] == "14:50"
        assert lab[1]["start_time"] == "15:00"
        assert lab[1]["end_time"] == "15:40"

    def test_only_bgcolor_flagged_cells_count_as_registered(self):
        grid = parse_timetable_grid(pages.TIMETABLE)
        theory = grid[C.TYPE_THEORY]
        # Monday period 0 is registered (#FC6C85) -> slot code A1.
        assert theory[0]["monday"] == "A1"
        # Monday period 1 shows "B1" but is NOT flagged -> not registered.
        assert theory[1]["monday"] is None

    def test_registered_cell_yields_slot_code_only(self):
        grid = parse_timetable_grid(pages.TIMETABLE)
        # Cell text is "B2 - MAT2002 - TH - AB1-302 - ALL"; we take only "B2".
        # Course/venue come from the registry, never from this cell.
        assert grid[C.TYPE_THEORY][1]["tuesday"] == "B2"

    def test_lab_slots_land_in_lab_namespace(self):
        grid = parse_timetable_grid(pages.TIMETABLE)
        assert grid[C.TYPE_LAB][0]["tuesday"] == "L21"
        assert grid[C.TYPE_LAB][1]["tuesday"] is None

    def test_days_without_classes_are_none_not_absent(self):
        grid = parse_timetable_grid(pages.TIMETABLE)
        period = grid[C.TYPE_THEORY][0]
        for day in ("sunday", "wednesday", "thursday", "friday", "saturday"):
            assert period[day] is None

    def test_no_records_yields_empty_buckets(self):
        grid = parse_timetable_grid(pages.TIMETABLE_NO_RECORDS)
        assert grid == {C.TYPE_THEORY: [], C.TYPE_LAB: []}


# ---------------------------------------------------------------------------
# attendance
# ---------------------------------------------------------------------------


class TestAttendance:
    def test_reads_every_course_row(self):
        records = parse_attendance(pages.ATTENDANCE)
        assert len(records) == 3

    def test_reads_labelled_counts_not_guessed_integers(self):
        # The old parser took min/max of the last two integers in the row, which
        # broke as soon as a percentage column was present. These are read by
        # header name instead.
        first = parse_attendance(pages.ATTENDANCE)[0]
        assert first["attended"] == 26
        assert first["total"] == 30

    def test_binds_by_first_slot_and_type(self):
        theory, lab, _ = parse_attendance(pages.ATTENDANCE)
        assert (theory["slot"], theory["type"]) == ("A1", C.TYPE_THEORY)
        assert (lab["slot"], lab["type"]) == ("L21", C.TYPE_LAB)

    def test_zero_of_zero_is_preserved_not_dropped(self):
        # A course with no classes conducted yet is real data, not missing data.
        third = parse_attendance(pages.ATTENDANCE)[2]
        assert third["attended"] == 0
        assert third["total"] == 0

    def test_reported_percentage_kept_separate_from_computed(self):
        # We record what VTOP printed but the pipeline recomputes the real value;
        # the field name must make that distinction obvious.
        first = parse_attendance(pages.ATTENDANCE)[0]
        assert first["reportedPercentage"] == 86.0
        assert "attendancePercentage" not in first

    def test_no_records_yields_empty(self):
        assert parse_attendance(pages.ATTENDANCE_NO_RECORDS) == []


# ---------------------------------------------------------------------------
# marks
# ---------------------------------------------------------------------------


class TestMarks:
    def test_finds_both_courses_despite_nested_tables(self):
        # The nested per-course tables put their rows into the outer tr list too;
        # getting this wrong makes the parser skip or double-count courses.
        results = parse_marks(pages.MARKS)
        assert len(results) == 2
        assert results[0]["slot"] == "A1"
        assert results[1]["slot"] == "B2"

    def test_reads_every_component_not_fixed_buckets(self):
        first = parse_marks(pages.MARKS)[0]
        titles = [component["title"] for component in first["components"]]
        assert titles == ["CAT-1", "Quiz 1", "CAT-2"]

    def test_component_fields_map_to_correct_columns(self):
        cat1 = parse_marks(pages.MARKS)[0]["components"][0]
        assert cat1["scored"] == 42.0
        assert cat1["max"] == 50.0
        assert cat1["maxWeightage"] == 15.0
        assert cat1["weightage"] == 12.6
        assert cat1["average"] == 31.4
        assert cat1["status"] == "Present"

    def test_real_zero_score_is_not_turned_into_none(self):
        # Deliberate deviation from the reference, which coerces 0 -> null.
        # A zero on a quiz is information the student needs to see.
        quiz = parse_marks(pages.MARKS)[0]["components"][1]
        assert quiz["scored"] == 0.0
        assert quiz["weightage"] == 0.0

    def test_unattempted_component_has_none_not_zero(self):
        # CAT-2 hasn't happened: max/weightage are known, score is not.
        cat2 = parse_marks(pages.MARKS)[0]["components"][2]
        assert cat2["max"] == 50.0
        assert cat2["scored"] is None
        assert cat2["status"] is None

    def test_second_course_components_are_not_leaked_into_first(self):
        results = parse_marks(pages.MARKS)
        assert len(results[0]["components"]) == 3
        assert len(results[1]["components"]) == 1
        assert results[1]["components"][0]["scored"] == 38.0

    def test_no_data_yields_empty(self):
        assert parse_marks(pages.MARKS_NO_DATA) == []


# ---------------------------------------------------------------------------
# exam schedule
# ---------------------------------------------------------------------------


class TestExamSchedule:
    def test_groups_by_exam_type_with_spaced_titles(self):
        result = parse_exam_schedule(pages.EXAM_SCHEDULE)
        assert set(result) == {"CAT 1", "FAT"}

    def test_colspan_headings_do_not_shift_columns(self):
        # Each exam-type heading contributes one cell to the flat list; without
        # realignment every subsequent field reads from the wrong column.
        cat1 = parse_exam_schedule(pages.EXAM_SCHEDULE)["CAT 1"]
        assert len(cat1) == 2
        assert cat1[0]["slot"] == "A1"
        assert cat1[0]["date"] == "12-MAR-2025"
        assert cat1[0]["start_time"] == "09:30"
        assert cat1[0]["end_time"] == "11:00"
        assert cat1[0]["venue"] == "AB1-405"
        assert cat1[0]["seat_location"] == "Row 3"
        assert cat1[0]["seat_number"] == 27

    def test_alignment_holds_for_second_row_in_section(self):
        cat1 = parse_exam_schedule(pages.EXAM_SCHEDULE)["CAT 1"]
        assert cat1[1]["slot"] == "B2"
        assert cat1[1]["date"] == "14-MAR-2025"
        assert cat1[1]["seat_number"] == 8

    def test_alignment_survives_a_second_colspan_heading(self):
        fat = parse_exam_schedule(pages.EXAM_SCHEDULE)["FAT"]
        assert len(fat) == 1
        assert fat[0]["slot"] == "A1"
        assert fat[0]["date"] == "28-MAY-2025"

    def test_hyphen_placeholders_become_none(self):
        # FAT venues/seats aren't allotted yet. The old parser turned these into
        # "AB-2 402" and "09:30 AM - 11:00 AM" out of thin air.
        fat = parse_exam_schedule(pages.EXAM_SCHEDULE)["FAT"][0]
        assert fat["venue"] is None
        assert fat["seat_location"] is None
        assert fat["seat_number"] is None
        assert fat["start_time"] is None
        assert fat["end_time"] is None

    def test_empty_schedule_yields_nothing(self):
        assert parse_exam_schedule(pages.EXAM_SCHEDULE_EMPTY) == {}


# ---------------------------------------------------------------------------
# global no-fabrication guard
# ---------------------------------------------------------------------------


class TestNoFabricatedValues:
    """
    Regression guard against the specific fictions the old parsers emitted.
    If any of these strings reappear anywhere in parsed output, accuracy has
    regressed.
    """

    FORBIDDEN = [
        "09:00 AM",
        "09:50 AM",
        "02:00 PM",
        "AB-2 • Room 304",
        "AB-2 402",
        "Academic Block",
        "Not assigned",
        "Assigned upon entry",
        "Sep 10, 2026",
        "Course CSE1002",
    ]

    def _assert_clean(self, blob):
        rendered = repr(blob)
        for forbidden in self.FORBIDDEN:
            assert forbidden not in rendered, f"fabricated value leaked: {forbidden}"

    def test_courses_output_is_clean(self):
        self._assert_clean(parse_courses(pages.COURSES))

    def test_timetable_output_is_clean(self):
        self._assert_clean(parse_timetable_grid(pages.TIMETABLE))

    def test_attendance_output_is_clean(self):
        self._assert_clean(parse_attendance(pages.ATTENDANCE))

    def test_marks_output_is_clean(self):
        self._assert_clean(parse_marks(pages.MARKS))

    def test_exam_output_is_clean(self):
        self._assert_clean(parse_exam_schedule(pages.EXAM_SCHEDULE))


# ---------------------------------------------------------------------------
# grade history tests
# ---------------------------------------------------------------------------


class TestGradeHistory:
    def test_parses_cgpa_and_credits_earned(self):
        res = parse_grade_history(pages.GRADE_HISTORY)
        assert res["hasValidData"] is True
        assert res["cgpa"] == 8.85
        assert res["creditsEarned"] == 84.0

    def test_unauthorized_yields_none(self):
        res = parse_grade_history("<html><body>Not authorized</body></html>")
        assert res["hasValidData"] is False
        assert res["cgpa"] is None
        assert res["creditsEarned"] is None


# ---------------------------------------------------------------------------
# semester grades tests
# ---------------------------------------------------------------------------


class TestSemesterGrades:
    def test_parses_grades_and_semester_gpa(self):
        res = parse_semester_grades(pages.SEMESTER_GRADES)
        assert res["gpa"] == 9.20
        assert len(res["grades"]) == 2
        assert res["grades"][0]["courseCode"] == "CSE1002"
        assert res["grades"][0]["grade"] == "S"
        assert res["grades"][0]["credits"] == 4.0
        assert res["grades"][1]["courseCode"] == "MAT2002"
        assert res["grades"][1]["grade"] == "A"
        assert res["grades"][1]["credits"] == 3.0

    def test_empty_yields_empty_list(self):
        res = parse_semester_grades("<html><body>No Records Found</body></html>")
        assert res["grades"] == []
        assert res["gpa"] is None


# ---------------------------------------------------------------------------
# payment receipts & dues tests
# ---------------------------------------------------------------------------


class TestReceiptsAndPayments:
    def test_parses_receipts(self):
        receipts = parse_receipts(pages.RECEIPTS)
        assert len(receipts) == 2
        assert receipts[0]["receiptNumber"] == "10098234"
        assert receipts[0]["amount"] == 198000.0
        assert receipts[0]["status"] == "Paid"
        assert receipts[1]["receiptNumber"] == "10098235"
        assert receipts[1]["amount"] == 45000.0

    def test_parses_no_dues(self):
        dues = parse_payments(pages.PAYMENTS_NO_DUES)
        assert dues["hasDues"] is False
        assert dues["totalDue"] == 0.0
        assert dues["items"] == []

    def test_parses_with_dues(self):
        dues = parse_payments(pages.PAYMENTS_WITH_DUES)
        assert dues["hasDues"] is True
        assert dues["totalDue"] == 1000.0
        assert len(dues["items"]) == 1


# ---------------------------------------------------------------------------
# proctor & dean/hod tests
# ---------------------------------------------------------------------------


class TestProctorAndStaff:
    def test_parses_proctor_details(self):
        proctor = parse_proctor(pages.PROCTOR)
        assert proctor is not None
        assert proctor["name"] == "DR. SURESH RAMAN"
        assert proctor["email"] == "suresh.raman@vit.ac.in"
        assert proctor["phone"] == "9876543210"
        assert proctor["cabin"] == "AB1-502-A"
        assert proctor["designation"] == "Associate Professor Grade 2"

    def test_parses_dean_and_hod(self):
        staff = parse_dean_hod(pages.DEAN_HOD)
        assert len(staff) == 2
        dean = staff[0]
        assert dean["role"] == "Dean"
        assert dean["name"] == "DR. VAIDHYANATHAN M"
        assert dean["email"] == "dean.scope@vit.ac.in"
        assert dean["cabin"] == "AB1-601"
        hod = staff[1]
        assert hod["role"] == "HOD"
        assert hod["name"] == "DR. MEENAKSHI S"


# ---------------------------------------------------------------------------
# spotlight tests
# ---------------------------------------------------------------------------


class TestSpotlight:
    def test_parses_announcements(self):
        items = parse_spotlight(pages.SPOTLIGHT)
        assert len(items) == 3
        assert items[0]["category"] == "Academics"
        assert "CAT-1 Schedule Announced" in items[0]["announcement"]
        assert items[0]["link"] == "https://vtopcc.vit.ac.in/circulars/cat1.pdf"
        assert items[2]["category"] == "Co-Curricular & Events"
        assert items[2]["link"] == "https://vtopcc.vit.ac.in/events/techno.pdf"


# ---------------------------------------------------------------------------
# on-duty (OD) tests
# ---------------------------------------------------------------------------


class TestOnDuty:
    def test_parses_od_records_and_calculates_hours(self):
        od = parse_od(pages.OD_PAGE)
        assert od["hasValidData"] is True
        assert od["usedHours"] == 3
        assert od["odHours"] == 3
        assert od["totalOdHours"] == 3
        assert od["approvedHours"] == 3
        assert od["maxHours"] == 40
        assert od["remainingHours"] == 37
        assert od["percentageUsed"] == round((3 / 40.0) * 100, 1)
        assert len(od["records"]) == 2
        assert len(od["odRecords"]) == 2
        assert od["records"][0]["subjectCode"] == "CSE1002"
        assert od["records"][0]["hours"] == 2
        assert od["records"][0]["reason"] == "Smart India Hackathon 2024"
        assert od["records"][0]["status"] == "Approved"

    def test_handles_no_od_records(self):
        od = parse_od(pages.OD_NO_RECORDS)
        assert od["hasValidData"] is True
        assert od["usedHours"] == 0
        assert od["odHours"] == 0
        assert od["totalOdHours"] == 0
        assert od["remainingHours"] == 40
        assert od["percentageUsed"] == 0.0
        assert od["records"] == []
        assert od["odRecords"] == []
        assert od["state"] == "success_with_no_records"

    def test_calculates_duration_from_start_and_end_times(self):
        od = parse_od(pages.OD_PAGE_WITH_TIMES)
        assert od["hasValidData"] is True
        assert od["approvedHours"] == 6  # 3 hours (08:00 AM - 11:00 AM) + 3 hours (02:00 PM - 05:00 PM)
        assert od["usedHours"] == 6
        assert len(od["records"]) == 2
        assert od["records"][0]["hours"] == 3
        assert od["records"][0]["fromTime"] == "08:00 AM"
        assert od["records"][0]["toTime"] == "11:00 AM"
        assert od["records"][1]["hours"] == 3

    def test_converts_days_to_hours(self):
        od = parse_od(pages.OD_PAGE_WITH_DAYS)
        assert od["hasValidData"] is True
        assert len(od["records"]) == 1
        assert od["records"][0]["hours"] == 12  # 2 days * 6 hours
        assert od["approvedHours"] == 12
        assert od["usedHours"] == 12

    def test_calculates_hours_from_slots(self):
        od = parse_od(pages.OD_PAGE_WITH_SLOTS)
        assert od["hasValidData"] is True
        assert len(od["records"]) == 2
        assert od["records"][0]["hours"] == 2  # A1+TA1 = 2 slots
        assert od["records"][1]["hours"] == 3  # L31+L32+L33 = 3 slots
        assert od["approvedHours"] == 5
        assert od["usedHours"] == 5

    def test_handles_mixed_approval_statuses(self):
        od = parse_od(pages.OD_PAGE_MIXED_STATUS)
        assert od["hasValidData"] is True
        assert od["approvedHours"] == 3
        assert od["pendingHours"] == 2
        assert od["rejectedHours"] == 4
        assert od["usedHours"] == 3  # Only approved counts towards used
        assert len(od["records"]) == 3



