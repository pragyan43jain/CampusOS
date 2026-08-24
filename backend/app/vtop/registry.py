"""
The course registry: how every other module finds out which course a row is about.

This is the load-bearing piece of the whole sync. VTOP's attendance, marks and
exam-schedule tables print a course *code* that is not reliably usable (it is
missing on some pages, abbreviated on others, and identical for a course's theory
and lab components, which are different courses as far as attendance is
concerned). What every one of those tables *does* carry is the slot string.

So the registered-course table is scraped first and turned into slot -> course
maps, and everything else is bound through those maps. Two rules make this safe:

**Namespaces are isolated.** ``A1`` in the lab namespace and ``A1`` in the theory
namespace are different keys, and a lookup never falls back to another namespace.
A course's theory and lab components share a course code but have distinct slots
and distinct attendance; letting a lab row resolve to a theory course is exactly
the class of bug that made the old dashboard show confident wrong numbers.

**A miss returns None, loudly.** Unresolved rows are counted so the sync report
can say "4 attendance rows could not be matched to a course" instead of dropping
them silently. An ambiguous slot (two courses claiming the same key in one
namespace) also resolves to None rather than picking one, because guessing right
half the time is worse than admitting we don't know.
"""

from __future__ import annotations

from collections import Counter
from typing import Any, Dict, Iterable, List, Optional, Set, Tuple

from . import constants as C
from .parser import course_type_of, first_slot

# The three namespaces a slot key can live in.
NAMESPACES = (C.TYPE_THEORY, C.TYPE_LAB, C.TYPE_PROJECT)


def _key(slot: Optional[str]) -> Optional[str]:
    """
    Normalise a slot code for use as a map key.

    Uppercased and stripped. The reference does an exact string match; casing has
    always agreed in practice, so normalising both sides costs nothing and means a
    stray lowercase slot on one page can't silently unmatch every row.
    """
    if not slot:
        return None
    return slot.strip().upper() or None


class CourseRegistry:
    """
    Slot -> course lookup, built from the parsed registered-course table.

    Courses are assigned sequential ids in table order so the rest of the app has
    a stable handle for a course that VTOP itself gives no id for.
    """

    def __init__(self, courses: Iterable[Dict[str, Any]]):
        self.courses: List[Dict[str, Any]] = []
        self.conflicts: List[Dict[str, Any]] = []

        self._slots: Dict[str, Dict[str, Dict[str, Any]]] = {
            namespace: {} for namespace in NAMESPACES
        }
        self._by_code: Dict[Tuple[str, str], Dict[str, Any]] = {}
        self._ambiguous: Dict[str, Set[str]] = {
            namespace: set() for namespace in NAMESPACES
        }
        self._misses: Counter = Counter()

        for index, course in enumerate(courses, start=1):
            record = dict(course)
            record["id"] = index

            namespace = record.get("type")
            if namespace not in self._slots:
                namespace = C.TYPE_THEORY
                record["type"] = namespace

            self.courses.append(record)
            self._index_slots(record, namespace)
            if record.get("code"):
                self._by_code[(record["code"].strip().upper(), namespace)] = record

    def _index_slots(self, record: Dict[str, Any], namespace: str) -> None:
        table = self._slots[namespace]
        for slot in record.get("slots") or []:
            key = _key(slot)
            if key is None:
                continue

            existing = table.get(key)
            if existing is not None and existing["id"] != record["id"]:
                # Two courses claim one slot in one namespace. This should be
                # impossible (it would be a timetable clash), so treat it as a
                # data problem and refuse to resolve the key at all.
                self._ambiguous[namespace].add(key)
                self.conflicts.append(
                    {
                        "slot": key,
                        "type": namespace,
                        "courses": [existing.get("code"), record.get("code")],
                    }
                )
                continue

            table[key] = record

    # -- lookup -------------------------------------------------------------

    def resolve(
        self, slot: Optional[str], course_type: Optional[str], course_code: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Look up a course by an already-isolated slot code, namespace, or course code.

        Returns None — and records a miss — when the slot is unknown or ambiguous.
        """
        namespace = course_type if course_type in self._slots else C.TYPE_THEORY
        key = _key(slot)
        if key is not None and key not in self._ambiguous[namespace]:
            found = self._slots[namespace].get(key)
            if found is not None:
                return found

        if course_code:
            code_key = (course_code.strip().upper(), namespace)
            found = self._by_code.get(code_key) or self._by_code.get((course_code.strip().upper(), C.TYPE_THEORY))
            if found is not None:
                return found

        if key is None:
            self._misses[(namespace, "")] += 1
        else:
            self._misses[(namespace, key)] += 1
        return None

    def resolve_row(
        self, slot_text: Optional[str], type_text: Optional[str], course_code: Optional[str] = None
    ) -> Optional[Dict[str, Any]]:
        """
        Resolve straight from the raw cell text of an attendance/marks/exam row.
        """
        return self.resolve(first_slot(slot_text), course_type_of(type_text), course_code)

    def resolve_grid_slot(
        self, slot: Optional[str], period_type: str
    ) -> Optional[Dict[str, Any]]:
        """
        Resolve a timetable-grid cell's slot code.

        The grid shows secondary slots too (``TA1`` alongside ``A1``), which is
        why every slot of a course is indexed, not just the first.
        """
        return self.resolve(slot, period_type)

    # -- introspection ------------------------------------------------------

    def __len__(self) -> int:
        return len(self.courses)

    def __bool__(self) -> bool:
        return bool(self.courses)

    def slot_count(self, namespace: str) -> int:
        return len(self._slots.get(namespace, {}))

    @property
    def total_credits(self) -> Optional[float]:
        """
        Sum of registered credits, or None when no course reported any.

        None rather than 0.0 so the UI can distinguish "not available" from a
        genuine zero-credit load.
        """
        values = [
            course["credits"]
            for course in self.courses
            if course.get("credits") is not None
        ]
        if not values:
            return None
        return float(sum(values))

    def unmatched(self) -> List[Dict[str, Any]]:
        """Every slot lookup that failed, with a count, for the sync report."""
        return [
            {"type": namespace, "slot": slot or None, "occurrences": count}
            for (namespace, slot), count in sorted(self._misses.items())
        ]

    def report(self) -> Dict[str, Any]:
        """Diagnostics for the sync report shown to the user."""
        return {
            "courseCount": len(self.courses),
            "slotCounts": {
                namespace: self.slot_count(namespace) for namespace in NAMESPACES
            },
            "totalCredits": self.total_credits,
            "unmatched": self.unmatched(),
            "conflicts": self.conflicts,
        }


def build_registry(courses: Iterable[Dict[str, Any]]) -> CourseRegistry:
    return CourseRegistry(courses)
