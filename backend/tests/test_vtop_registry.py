"""
Contract tests for the course registry.

The registry is what stops attendance, marks and exam rows being attached to the
wrong course. These tests pin the two guarantees that matter: namespaces never
leak into one another, and an unresolvable row surfaces as None-plus-a-count
rather than a plausible guess.
"""

import pytest

from app.vtop import constants as C
from app.vtop.parser import parse_attendance, parse_courses, parse_timetable_grid
from app.vtop.registry import CourseRegistry, build_registry
from tests.fixtures import vtop_pages as pages


def _registry() -> CourseRegistry:
    return build_registry(parse_courses(pages.COURSES))


class TestConstruction:
    def test_assigns_sequential_ids_in_table_order(self):
        registry = _registry()
        assert [course["id"] for course in registry.courses] == [1, 2, 3]

    def test_indexes_every_slot_of_a_course_not_just_the_first(self):
        # The timetable grid shows secondary slots, so TA1 must resolve too.
        registry = _registry()
        primary = registry.resolve("A1", C.TYPE_THEORY)
        secondary = registry.resolve("TA1", C.TYPE_THEORY)
        assert primary is not None
        assert secondary is not None
        assert primary["id"] == secondary["id"]

    def test_slot_counts_per_namespace(self):
        registry = _registry()
        # theory: A1, TA1, B2 -- lab: L21, L22 -- project: none
        assert registry.slot_count(C.TYPE_THEORY) == 3
        assert registry.slot_count(C.TYPE_LAB) == 2
        assert registry.slot_count(C.TYPE_PROJECT) == 0

    def test_total_credits_sums_registered_load(self):
        # 4 (theory) + 4 (lab) + 3 = 11
        assert _registry().total_credits == 11.0

    def test_total_credits_is_none_when_nothing_reported(self):
        # None, not 0.0 — "we don't know" is different from "no credits".
        registry = build_registry([{"code": "X", "type": C.TYPE_THEORY, "slots": ["A1"]}])
        assert registry.total_credits is None

    def test_empty_registry_is_falsy(self):
        assert not build_registry([])
        assert len(build_registry([])) == 0


class TestNamespaceIsolation:
    def test_same_code_theory_and_lab_are_separate_courses(self):
        registry = _registry()
        theory = registry.resolve("A1", C.TYPE_THEORY)
        lab = registry.resolve("L21", C.TYPE_LAB)
        assert theory["code"] == lab["code"] == "CSE1002"
        assert theory["id"] != lab["id"]
        assert theory["venue"] == "AB1-405"
        assert lab["venue"] == "AB2-210"

    def test_lab_slot_does_not_resolve_in_theory_namespace(self):
        # No cross-namespace fallback: this is the bug class the registry exists
        # to prevent.
        assert _registry().resolve("L21", C.TYPE_THEORY) is None

    def test_theory_slot_does_not_resolve_in_lab_namespace(self):
        assert _registry().resolve("A1", C.TYPE_LAB) is None

    def test_unknown_course_type_is_treated_as_theory(self):
        registry = _registry()
        assert registry.resolve("A1", "something-else")["code"] == "CSE1002"


class TestMissHandling:
    def test_unknown_slot_returns_none(self):
        assert _registry().resolve("Z9", C.TYPE_THEORY) is None

    def test_missing_slot_returns_none(self):
        registry = _registry()
        assert registry.resolve(None, C.TYPE_THEORY) is None
        assert registry.resolve("", C.TYPE_THEORY) is None

    def test_misses_are_counted_for_the_sync_report(self):
        registry = _registry()
        registry.resolve("Z9", C.TYPE_THEORY)
        registry.resolve("Z9", C.TYPE_THEORY)
        registry.resolve("Y8", C.TYPE_LAB)
        unmatched = {(row["type"], row["slot"]): row["occurrences"] for row in registry.unmatched()}
        assert unmatched[(C.TYPE_THEORY, "Z9")] == 2
        assert unmatched[(C.TYPE_LAB, "Y8")] == 1

    def test_successful_lookups_are_not_counted_as_misses(self):
        registry = _registry()
        registry.resolve("A1", C.TYPE_THEORY)
        assert registry.unmatched() == []

    def test_slot_lookup_is_case_insensitive(self):
        assert _registry().resolve("a1", C.TYPE_THEORY)["code"] == "CSE1002"


class TestAmbiguity:
    DUPLICATED = [
        {"code": "AAA1001", "type": C.TYPE_THEORY, "slots": ["A1"], "credits": 3.0},
        {"code": "BBB2002", "type": C.TYPE_THEORY, "slots": ["A1"], "credits": 3.0},
    ]

    def test_conflicting_slot_refuses_to_resolve(self):
        # Picking either course would be a coin flip; None is the honest answer.
        registry = build_registry(self.DUPLICATED)
        assert registry.resolve("A1", C.TYPE_THEORY) is None

    def test_conflict_is_recorded(self):
        registry = build_registry(self.DUPLICATED)
        assert len(registry.conflicts) == 1
        conflict = registry.conflicts[0]
        assert conflict["slot"] == "A1"
        assert conflict["type"] == C.TYPE_THEORY
        assert set(conflict["courses"]) == {"AAA1001", "BBB2002"}

    def test_same_slot_in_different_namespaces_is_not_a_conflict(self):
        registry = build_registry(
            [
                {"code": "AAA1001", "type": C.TYPE_THEORY, "slots": ["A1"]},
                {"code": "AAA1001", "type": C.TYPE_LAB, "slots": ["A1"]},
            ]
        )
        assert registry.conflicts == []
        assert registry.resolve("A1", C.TYPE_THEORY)["type"] == C.TYPE_THEORY
        assert registry.resolve("A1", C.TYPE_LAB)["type"] == C.TYPE_LAB


class TestRowBinding:
    def test_binds_real_attendance_rows_to_the_right_courses(self):
        # End-to-end on the fixtures: this is the join the whole dashboard rests on.
        # The parser already isolates the first slot and classifies the type, so
        # the pipeline uses resolve() directly.
        registry = _registry()
        records = parse_attendance(pages.ATTENDANCE)
        resolved = [registry.resolve(r["slot"], r["type"]) for r in records]

        assert [course["id"] for course in resolved] == [1, 2, 3]
        assert resolved[0]["type"] == C.TYPE_THEORY
        assert resolved[1]["type"] == C.TYPE_LAB
        assert resolved[0]["venue"] == "AB1-405"
        assert resolved[1]["venue"] == "AB2-210"

    def test_resolve_row_accepts_raw_cell_text(self):
        # resolve_row is the convenience path for un-normalised text, applying
        # both conventions itself: first-slot-only and type classification.
        registry = _registry()
        records = parse_attendance(pages.ATTENDANCE)
        raw = [registry.resolve_row(r["slots"], r["courseType"]) for r in records]
        assert [course["id"] for course in raw] == [1, 2, 3]

    def test_resolve_row_takes_only_the_first_slot(self):
        # Attendance prints "A1+TA1"; the course key is "A1".
        registry = _registry()
        assert registry.resolve_row("A1+TA1", "Embedded Theory")["id"] == 1

    def test_resolve_row_classifies_type_text(self):
        registry = _registry()
        assert registry.resolve_row("L21+L22", "Embedded Lab")["type"] == C.TYPE_LAB
        assert registry.resolve_row("B2", "Theory Only")["type"] == C.TYPE_THEORY

    def test_binds_grid_cells_including_secondary_slots(self):
        registry = _registry()
        grid = parse_timetable_grid(pages.TIMETABLE)
        monday = grid[C.TYPE_THEORY][0]["monday"]
        course = registry.resolve_grid_slot(monday, C.TYPE_THEORY)
        assert course["code"] == "CSE1002"
        assert course["faculty"] == "RAJESH KUMAR"

    def test_grid_lab_slot_resolves_in_lab_namespace(self):
        registry = _registry()
        grid = parse_timetable_grid(pages.TIMETABLE)
        tuesday_lab = grid[C.TYPE_LAB][0]["tuesday"]
        course = registry.resolve_grid_slot(tuesday_lab, C.TYPE_LAB)
        assert course["venue"] == "AB2-210"


class TestReport:
    def test_report_summarises_state(self):
        registry = _registry()
        registry.resolve("Z9", C.TYPE_THEORY)
        report = registry.report()
        assert report["courseCount"] == 3
        assert report["slotCounts"][C.TYPE_LAB] == 2
        assert report["totalCredits"] == 11.0
        assert report["conflicts"] == []
        assert report["unmatched"][0]["slot"] == "Z9"
