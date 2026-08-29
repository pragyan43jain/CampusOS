"""
Per-module parsers for VTOP HTML responses.

Every parser here is a deliberate port of the corresponding logic in StudentCC's
VTOPService.java. Where I have knowingly deviated, the deviation is marked with a
`DEVIATION:` comment and justified — those are the only places this file departs
from the reference.

Two rules govern everything below:

* **Never invent a value.** If VTOP didn't say it, the field is ``None``. The
  previous implementation filled blanks with plausible-looking fictions
  (09:00 AM, "AB-2 Room 304", 18/20 attendance) which is worse than an empty
  field, because a student can't tell the difference.

* **Never trust column position.** Columns are located by reading header text.
  VTOP reorders and inserts columns between semesters.
"""

from __future__ import annotations

import logging
import re
from typing import Any, Dict, List, Optional, Tuple

from bs4.element import Tag

from app.vtop import constants as C
from app.vtop.tables import (
    body_says,
    contains,
    discover_columns,
    exactly,
    header_layout,
    norm,
    raw_text,
    soup_of,
    to_float,
    to_int,
    to_text,
    walk_rows,
)

logger = logging.getLogger("vtop.parser")


# ---------------------------------------------------------------------------
# text helpers
# ---------------------------------------------------------------------------


def _inline(text: str) -> str:
    """Drop tabs, turn newlines into spaces. Used where a cell holds one value."""
    return text.replace("\t", "").replace("\r", "").replace("\n", " ")


def _tight(text: str) -> str:
    """
    Drop tabs and newlines entirely, inserting nothing.

    Used for the two-value cells (slot/venue, faculty/school). These hold
    ``"A1+TA1 - AB1-405"``: the separator is a literal hyphen, and the newlines
    present are only source indentation. Substituting a space for them would add
    stray whitespace into the extracted venue.
    """
    return text.replace("\t", "").replace("\r", "").replace("\n", "")


def _split_pair(text: str) -> Tuple[str, Optional[str]]:
    """
    Split a "value - qualifier" VTOP cell into ``(head, tail)``.

    VTOP packs two fields into one cell using ``" - "``: the course table's
    Slot/Venue cell reads ``"A1+TA1 - AB1-405"`` and its Faculty/School cell
    reads ``"RAJESH KUMAR - SCOPE"``.

    DEVIATION from the reference, which splits on a bare ``-`` and rejoins the
    tail with ``" - "``. That mangles any value that legitimately contains a
    hyphen: venue ``"AB1-405"`` comes back as ``"AB1 - 405"``, and a faculty
    named ``"JEAN-PAUL X"`` is truncated to ``"JEAN"``. Splitting on the spaced
    separator is unambiguous, because the hyphens *inside* these values are never
    surrounded by spaces.

    Falls back to the reference's bare-hyphen split so a cell written without the
    surrounding spaces still yields a usable slot list rather than nothing.
    """
    stripped = text.strip()
    if not stripped:
        return "", None

    if " - " in stripped:
        head, tail = stripped.split(" - ", 1)
        return head.strip(), (tail.strip() or None)

    if "-" in stripped:
        head, tail = stripped.split("-", 1)
        return head.strip(), (tail.strip() or None)

    return stripped, None


def first_slot(text: Optional[str]) -> Optional[str]:
    """
    ``"A1+TA1"`` -> ``"A1"``.

    Attendance, marks and exam rows identify their course by the *first* slot
    only; that is the key the course registry is built on.
    """
    if not text:
        return None
    head = text.split("+")[0].strip()
    return head or None


def course_type_of(text: Optional[str]) -> str:
    """
    Classify a VTOP course-type string into our three namespaces.

    VTOP writes things like "Embedded Theory", "Embedded Lab", "Project /
    Internship". Anything that isn't a lab or a project is treated as theory,
    matching the reference.
    """
    lowered = (text or "").lower()
    if "lab" in lowered:
        return C.TYPE_LAB
    if "project" in lowered:
        return C.TYPE_PROJECT
    return C.TYPE_THEORY


_TIME_RE = re.compile(r"^(\d{1,2}):(\d{2})")


def to_24h(value: Optional[str]) -> Optional[str]:
    """
    Normalise a timetable grid time to 24-hour ``HH:MM``.

    VTOP's grid prints bare times with no meridiem: an afternoon 2pm slot appears
    as "02:00". The reference resolves this by assuming no class starts before
    08:00, so anything earlier must be PM. That assumption holds for VIT's
    08:00-19:50 timetable.
    """
    if not value:
        return None
    match = _TIME_RE.match(value.strip())
    if not match:
        return None
    hour, minute = int(match.group(1)), int(match.group(2))
    if hour >= 24 or minute >= 60:
        return None
    if hour < 8:
        hour += 12
    return f"{hour:02d}:{minute:02d}"


def to_12h(value: Optional[str]) -> Optional[str]:
    """Render ``"14:00"`` as ``"02:00 PM"`` for display."""
    if not value:
        return None
    match = _TIME_RE.match(value)
    if not match:
        return None
    hour, minute = int(match.group(1)), int(match.group(2))
    suffix = "AM" if hour < 12 else "PM"
    display_hour = hour % 12 or 12
    return f"{display_hour:02d}:{minute:02d} {suffix}"


# ---------------------------------------------------------------------------
# 1. semester dropdown
# ---------------------------------------------------------------------------


def parse_semesters(html: str) -> List[Dict[str, str]]:
    """
    Read the semester ``<select>`` into ``[{"id": "CH20242501", "name": "..."}]``.

    Options with an empty value are the "-- Choose Semester --" placeholder and
    are skipped. Order is preserved: VTOP lists newest first, and the caller
    treats index 0 as the current semester (the reference does the same — there
    is no date logic available to us).
    """
    if body_says(html, C.UNAUTHORIZED_MARKER):
        logger.warning("[VTOP] Semester page says 'not authorized'")
        return []

    soup = soup_of(html)
    select = soup.find(id="semesterSubId")
    if select is None:
        logger.warning("[VTOP] No #semesterSubId dropdown in response")
        return []

    semesters: List[Dict[str, str]] = []
    for option in select.find_all("option"):
        value = (option.get("value") or "").strip()
        if not value:
            continue
        name = " ".join(raw_text(option).split()).strip()
        semesters.append({"id": value, "name": name or value})

    return semesters


# ---------------------------------------------------------------------------
# 2. profile
# ---------------------------------------------------------------------------

_PROFILE_LABELS: List[Tuple[str, Tuple[str, ...]]] = [
    # (output field, all substrings that must appear in the label cell)
    ("name", ("student", "name")),
    ("regNo", ("register", "number")),
    ("regNo", ("registration", "number")),
    ("program", ("programme",)),
    ("program", ("program",)),
    ("branch", ("branch",)),
    ("school", ("school",)),
    ("email", ("email",)),
    ("batch", ("batch",)),
    ("applicationNumber", ("application", "number")),
]


def parse_profile(html: str) -> Dict[str, Any]:
    """
    Extract profile fields by label/value cell pairing.

    The reference only bothers with the student's name (it gets the registration
    number from #authorizedIDX instead). We read a few more labels because the
    dashboard shows them — but strictly by matching the label cell and taking the
    *next* cell, never by guessing position, and never regex-hunting the whole
    page for something that looks like a registration number.
    """
    if not body_says(html, "personal information", "student name"):
        return {}

    soup = soup_of(html)
    cells = soup.find_all("td")
    profile: Dict[str, Any] = {}

    index = 0
    while index < len(cells) - 1:
        label = norm(raw_text(cells[index]))
        if not label:
            index += 1
            continue

        for field, needles in _PROFILE_LABELS:
            if field in profile:
                continue
            if all(needle in label for needle in needles):
                value = to_text(cells[index + 1])
                if value:
                    profile[field] = value
                break
        index += 1

    if "email" in profile:
        profile["email"] = profile["email"].lower()
    if "regNo" in profile:
        profile["regNo"] = profile["regNo"].upper()

    return profile


# ---------------------------------------------------------------------------
# 3. registered courses  ->  the source of truth for the course registry
# ---------------------------------------------------------------------------

# Rule order is faithful to the reference. `course` and `l t p j c` are matched
# by exact equality because "Course" must not swallow "Course Type", and the
# credits header is literally "L T P J C".
_COURSE_RULES = [
    ("course", exactly("course")),
    ("credits", exactly("l t p j c")),
    ("slot_venue", contains("slot")),
    ("faculty", contains("faculty")),
]


def parse_courses(html: str) -> List[Dict[str, Any]]:
    """
    Parse the registered-course table into course records.

    Output per course: ``code``, ``title``, ``type`` (theory/lab/project),
    ``credits``, ``slots`` (list), ``venue``, ``faculty``.

    This table is the *only* place VTOP reliably gives us course code, title,
    venue and faculty together. Attendance, marks and exams are bound back to
    these records via their slot codes, which is why this must run first.
    """
    soup = soup_of(html)
    container = soup.find(id="studentDetailsList")
    if container is None:
        logger.warning("[VTOP] No #studentDetailsList — no registered courses")
        return []

    table = container.find("table")
    if table is None:
        return []

    headings = table.find_all("th")
    if not headings:
        return []

    columns = discover_columns(headings, _COURSE_RULES)
    if "course" not in columns or "slot_venue" not in columns:
        logger.warning("[VTOP] Course table missing Course/Slot columns: %s", columns)
        return []

    cells = table.find_all("td")
    if not cells:
        return []

    # VTOP sometimes prepends an "Invoice" column. When the *header* has it, each
    # row is one cell wider than the header implies (heading_offset shrinks the
    # stride); when the *body* has it, every read shifts one cell right.
    heading_offset = -1 if "invoice" in norm(raw_text(headings[0])) else 0
    cell_offset = 1 if "invoice" in norm(raw_text(cells[0])) else 0
    offset = heading_offset + cell_offset
    stride = len(headings) + heading_offset
    if stride <= 0:
        return []

    required = [name for name in ("course", "slot_venue") if name in columns]
    rows = walk_rows(cells, columns, required, stride, offset)

    courses: List[Dict[str, Any]] = []
    for row in rows:
        raw_course = _inline(raw_text(row["course"])).strip()
        if not raw_course:
            continue

        code = raw_course.split("-")[0].strip()
        if not code:
            continue

        # Title is everything between the first "-" and the trailing "(type)".
        # Re-joining on "-" preserves hyphens inside course titles.
        after_code = "-".join(raw_course.split("-")[1:])
        title = after_code.split("(")[0].strip() or None

        # Course type is the LAST parenthesised chunk, e.g. "(Embedded Lab)".
        type_chunk = raw_course.split("(")[-1] if "(" in raw_course else ""
        ctype = course_type_of(type_chunk)

        credits: Optional[float] = None
        if "credits" in columns and "credits" in row:
            tokens = _inline(raw_text(row["credits"])).strip().split()
            if tokens:
                try:
                    credits = float(tokens[-1])
                except ValueError:
                    credits = None

        slots: List[str] = []
        venue: Optional[str] = None
        slot_text, venue = _split_pair(_tight(raw_text(row["slot_venue"])))
        slots = [s.strip() for s in slot_text.split("+") if s.strip()]

        faculty: Optional[str] = None
        if "faculty" in columns and "faculty" in row:
            # Trailing school code ("- SCOPE") is dropped; we want the person.
            faculty = _split_pair(_tight(raw_text(row["faculty"])))[0] or None

        courses.append(
            {
                "code": code.upper(),
                "title": title,
                "type": ctype,
                "credits": credits,
                "slots": slots,
                "venue": venue,
                "faculty": faculty,
            }
        )

    return courses


# ---------------------------------------------------------------------------
# 4. timetable grid
# ---------------------------------------------------------------------------

_DAY_KEYS = [
    ("SUN", "sunday"),
    ("MON", "monday"),
    ("TUE", "tuesday"),
    ("WED", "wednesday"),
    ("THU", "thursday"),
    ("FRI", "friday"),
    ("SAT", "saturday"),
]
_ALL_DAYS = [key for _, key in _DAY_KEYS]


def _grid_label(text: str) -> Optional[str]:
    """
    Classify a grid cell as a structural label, or None if it holds data.

    DEVIATION: the reference tests only ``content.includes('THEORY')`` etc. We
    additionally require the cell to contain no "-", because a *registered* slot
    cell always looks like "A1 - CSE1002 - ETH - AB1-405 - ALL" and would be
    misread as a label if its venue happened to contain a label substring.
    Unregistered cells hold a bare slot code, which contains no label substring
    either way, so this is strictly safer on real input.
    """
    upper = text.upper()
    if "-" in upper:
        return None

    if "THEORY" in upper:
        return "type:theory"
    if "LAB" in upper:
        return "type:lab"
    if "START" in upper:
        return "key:start"
    if "END" in upper:
        return "key:end"
    for token, day in _DAY_KEYS:
        if token in upper:
            return f"key:{day}"
    if "LUNCH" in upper:
        # Skipped WITHOUT advancing the row cursor, so column alignment survives.
        return "skip"
    return None


def _empty_period() -> Dict[str, Any]:
    period: Dict[str, Any] = {"start_time": None, "end_time": None}
    for day in _ALL_DAYS:
        period[day] = None
    return period


def parse_timetable_grid(html: str) -> Dict[str, List[Dict[str, Any]]]:
    """
    Parse the timetable grid into period rows per course type.

    The grid is transposed: each *row* is a label (Start / End / a weekday) and
    each *column* is a time period. So we can't read it row-by-row — the
    reference walks every cell in document order as a state machine, and we do
    the same.

    Returns ``{"theory": [period, ...], "lab": [period, ...]}`` where a period is
    ``{start_time, end_time, monday..sunday}`` and each day holds the registered
    slot code or ``None``.
    """
    soup = soup_of(html)

    details = soup.find(id="getStudentDetails")
    if details is not None:
        spans = details.find_all("span")
        if spans and "no record(s) found" in norm(raw_text(spans[0])):
            logger.info("[VTOP] Timetable: no records for this semester")
            return {C.TYPE_THEORY: [], C.TYPE_LAB: []}

    grid = soup.find(id="timeTableStyle")
    if grid is None:
        logger.warning("[VTOP] No #timeTableStyle grid in response")
        return {C.TYPE_THEORY: [], C.TYPE_LAB: []}

    result: Dict[str, List[Dict[str, Any]]] = {C.TYPE_THEORY: [], C.TYPE_LAB: []}
    current_type: Optional[str] = None
    current_key: Optional[str] = None
    cursor = 0

    for cell in grid.find_all("td"):
        text = raw_text(cell)
        label = _grid_label(text)

        if label == "skip":
            continue
        if label is not None and label.startswith("type:"):
            current_type = label.split(":", 1)[1]
            cursor = 0
            continue
        if label is not None and label.startswith("key:"):
            current_key = label.split(":", 1)[1]
            continue

        # --- data cell ---
        if current_type is None or current_key is None:
            continue
        bucket = result[current_type]

        if current_key == "start":
            # The Start row *creates* one period per column and leaves the cursor
            # at 0, so the End row can then walk back over them.
            period = _empty_period()
            period["start_time"] = to_24h(text.strip())
            bucket.append(period)
            continue

        if cursor >= len(bucket):
            # More data cells than the Start row declared — the grid is shaped
            # unexpectedly. Stop rather than write into the wrong period.
            continue

        if current_key == "end":
            bucket[cursor]["end_time"] = to_24h(text.strip())
        else:
            bgcolor = (cell.get("bgcolor") or "").strip().lower()
            style = (cell.get("style") or "").strip().lower()
            slot_candidate = text.split("-")[0].strip() or None
            is_label = any(k in text.upper() for k in ("START", "END", "THEORY", "LAB", "LUNCH"))
            if is_label or not slot_candidate:
                bucket[cursor][current_key] = None
            else:
                is_registered = (
                    bgcolor == C.REGISTERED_SLOT_BGCOLOR
                    or bgcolor == "#fc6c85"
                    or "#fc6c85" in style
                    or text.count("-") >= 2
                )
                if is_registered:
                    bucket[cursor][current_key] = slot_candidate
                else:
                    bucket[cursor][current_key] = None

        cursor += 1

    return result


# ---------------------------------------------------------------------------
# 5. attendance
# ---------------------------------------------------------------------------

# Order matters: ("course","type") must be tested before ("course","code") and
# ("course","title") so that "Course Type" doesn't fall through to them.
_ATTENDANCE_RULES = [
    ("course_type", contains("course", "type")),
    ("course_code", contains("course", "code")),
    ("course_title", contains("course", "title")),
    ("slot", contains("slot")),
    ("od_attended", lambda t: ("od" in t or "on duty" in t or "on-duty" in t or "leave" in t) and ("attend" in t or "class" in t or "unit" in t or "hr" in t or "hour" in t or t in ("od", "on duty", "on-duty", "od attend", "od attended", "od class", "od classes"))),
    ("attended", lambda t: ("attended" in t or "present" in t) and "od" not in t and "on duty" not in t),
    ("total", lambda t: "total" in t or "conducted" in t or "held" in t),
    ("percentage", lambda t: "percentage" in t or "%" in t),
    ("faculty", contains("faculty")),
]


def parse_attendance(html: str) -> List[Dict[str, Any]]:
    """
    Parse the attendance table.

    Returns raw counts only — ``attended``, ``total``, plus the slot and course
    type used to bind the row to a course. The percentage VTOP prints is read but
    *not* used: the pipeline recomputes it from the counts, because VTOP rounds
    to a whole number and a student making a "can I skip this?" decision needs
    the exact figure.
    """
    if body_says(html, "no record(s) found", "no data found"):
        logger.info("[VTOP] Attendance: no records")
        return []

    soup = soup_of(html)
    table = soup.find(id="getStudentDetails")
    if table is None:
        logger.warning("[VTOP] No #getStudentDetails attendance table")
        return []

    headings, offset, stride = header_layout(table)
    if not headings or stride <= 0:
        return []

    columns = discover_columns(headings, _ATTENDANCE_RULES)
    required = [name for name in ("attended", "total") if name in columns]
    if len(required) < 2:
        logger.warning("[VTOP] Attendance table missing Attended/Total: %s", columns)
        return []

    cells = table.find_all("td")
    rows = walk_rows(cells, columns, required, stride, offset)

    records: List[Dict[str, Any]] = []
    for row in rows:
        attended = to_int(row.get("attended"))
        total = to_int(row.get("total"))
        od_attended = to_int(row.get("od_attended")) or 0
        # A row with no class count is a footer/summary row, not a course.
        if attended is None and total is None:
            continue

        raw_slot = to_text(row.get("slot"))
        records.append(
            {
                "slot": first_slot(raw_slot),
                "slots": raw_slot,
                "courseType": to_text(row.get("course_type")),
                "type": course_type_of(to_text(row.get("course_type"))),
                "courseCode": (to_text(row.get("course_code")) or "").upper() or None,
                "courseTitle": to_text(row.get("course_title")),
                "facultyName": to_text(row.get("faculty")),
                "attended": attended,
                "total": total,
                "odAttended": od_attended,
                # Kept for diagnostics/comparison; the pipeline recomputes it.
                "reportedPercentage": to_float(row.get("percentage")),
            }
        )

    return records


def extract_attendance_od_records(
    html: str,
    attendance_rows: Optional[List[Dict[str, Any]]] = None,
) -> List[Dict[str, Any]]:
    """
    Search the VTOP class attendance page and each subject's attendance table
    for On-Duty (OD) entries, class credits, and detailed lecture logs.
    """
    records: List[Dict[str, Any]] = []
    seen_keys = set()

    if not html:
        return records

    soup = soup_of(html)

    # 1. Inspect attendance rows for course-level OD counts
    for row in (attendance_rows or []):
        od_cnt = row.get("odAttended") or 0
        c_code = (row.get("courseCode") or "COURSE").upper()
        c_title = row.get("courseTitle") or "Course Academic OD"
        slot = row.get("slot") or ""
        fac = row.get("facultyName") or "Academic Office"

        if od_cnt > 0:
            key = f"{c_code}-{slot}-att"
            if key not in seen_keys:
                seen_keys.add(key)
                records.append({
                    "id": f"od-att-{c_code}",
                    "date": "Active Semester",
                    "fromDate": "Semester Sanction",
                    "toDate": "Semester Sanction",
                    "fromTime": None,
                    "toTime": None,
                    "timeRange": None,
                    "subjectCode": c_code,
                    "subjectTitle": c_title,
                    "hours": od_cnt,
                    "days": 1,
                    "slot": slot,
                    "reason": f"Class On-Duty Credit ({c_code})",
                    "status": "Approved",
                    "isApproved": True,
                    "approvedBy": fac,
                })

    # 2. Inspect all tables in HTML for detailed date-wise attendance with status 'On Duty' or 'OD'
    tables = soup.find_all("table")
    for table in tables:
        rows = table.find_all("tr")
        current_course_code = None
        current_course_title = None

        # Check if table has a course heading nearby or in caption
        prev_heading = table.find_previous(["h3", "h4", "h5", "b", "strong", "span"])
        if prev_heading:
            c_match = re.search(r"([A-Z]{3,4}\d{3,4}[A-Z]?)", prev_heading.get_text())
            if c_match:
                current_course_code = c_match.group(1).upper()

        for tr in rows:
            tds = tr.find_all(["td", "th"])
            if not tds:
                continue

            row_text = tr.get_text().strip()
            # Check if row contains 'On Duty' or 'OD' status
            if re.search(r"\b(?:on\s*duty|od\s*approved|od\s*sanctioned|attended\s*od)\b", row_text, re.I):
                # Extract date from cells
                found_date = None
                found_slot = None
                for td in tds:
                    t_text = td.get_text().strip()
                    d_match = re.search(r"(\d{1,2}[-/][A-Za-z0-9]{3,}[-/]\d{2,4})", t_text)
                    if d_match:
                        found_date = d_match.group(1)
                    s_match = re.search(r"\b([A-G][12]\+?T?[A-G]?[12]?|L\d{1,2}(?:\+L\d{1,2})*)\b", t_text)
                    if s_match:
                        found_slot = s_match.group(1)
                    c_code_match = re.search(r"\b([A-Z]{3,4}\d{3,4}[A-Z]?)\b", t_text)
                    if c_code_match and not current_course_code:
                        current_course_code = c_code_match.group(1).upper()

                if found_date:
                    record_key = f"{found_date}-{current_course_code or 'COURSE'}-{found_slot or ''}"
                    if record_key not in seen_keys:
                        seen_keys.add(record_key)
                        records.append({
                            "id": f"od-date-{len(records) + 1}",
                            "date": found_date,
                            "fromDate": found_date,
                            "toDate": found_date,
                            "fromTime": None,
                            "toTime": None,
                            "timeRange": None,
                            "subjectCode": current_course_code or "GENERAL",
                            "subjectTitle": current_course_title or "Subject Class Attendance",
                            "hours": 1,
                            "days": 1,
                            "slot": found_slot or "",
                            "reason": f"Class Attendance On-Duty ({current_course_code or 'Class'})",
                            "status": "Approved",
                            "isApproved": True,
                            "approvedBy": "Course Faculty / VTOP",
                        })

    return records


# ---------------------------------------------------------------------------
# 6. marks
# ---------------------------------------------------------------------------

_MARKS_OUTER_RULES = [
    ("course_type", contains("course", "type")),
    ("course_code", contains("course", "code")),
    ("course_title", contains("course", "title")),
    ("slot", contains("slot")),
    ("faculty", contains("faculty")),
]

# Order is critical and NOT alphabetical. "max" is tested before "scored" so that
# "Max. Mark" can't land on the score column, and "%" before ("weightage","mark")
# so that "Weightage %" and "Weightage Mark" stay distinct.
_MARKS_INNER_RULES = [
    ("title", contains("title")),
    ("max_score", contains("max")),
    ("max_weightage", contains("%")),
    ("status", contains("status")),
    ("score", contains("scored")),
    ("weightage", contains("weightage", "mark")),
    ("average", contains("average")),
]


def parse_marks(html: str) -> List[Dict[str, Any]]:
    """
    Parse the continuous-assessment marks page.

    The layout nests a per-course table inside the outer table, so the outer
    ``<tr>`` list also contains every inner row. We therefore walk the outer rows
    with an explicit cursor and jump over each inner table's rows once consumed.

    Returns one record per course with a ``components`` list — every assessment
    VTOP actually reported, with its own max, weightage and average. The old
    implementation forced results into fixed cat1/cat2/da1/quiz buckets with
    hardcoded maxima, which silently mislabelled any course that doesn't use that
    exact scheme.
    """
    if body_says(html, "no data found", "no record(s) found"):
        logger.info("[VTOP] Marks: no data")
        return []

    soup = soup_of(html)
    container = soup.find(id="fixedTableContainer")
    if container is None:
        logger.warning("[VTOP] No #fixedTableContainer marks table")
        return []

    rows = container.find_all("tr")
    if len(rows) < 2:
        return []

    outer_headings = rows[0].find_all("td") or rows[0].find_all("th")
    if not outer_headings:
        return []
    columns = discover_columns(outer_headings, _MARKS_OUTER_RULES)
    if "slot" not in columns:
        logger.warning("[VTOP] Marks table has no Slot column: %s", columns)
        return []

    results: List[Dict[str, Any]] = []
    index = 1

    while index < len(rows):
        course_row = rows[index]
        outer_cells = course_row.find_all("td")

        def outer(field: str) -> Optional[Tag]:
            position = columns.get(field)
            if position is None or position >= len(outer_cells):
                return None
            return outer_cells[position]

        raw_slot = to_text(outer("slot"))
        if raw_slot is None:
            index += 1
            continue

        course_type_text = to_text(outer("course_type"))

        # The next row is a container whose only job is to hold the inner table.
        inner_table = None
        if index + 1 < len(rows):
            inner_table = rows[index + 1].find("table")

        components: List[Dict[str, Any]] = []
        consumed = 0

        if inner_table is not None:
            inner_rows = inner_table.find_all("tr")
            consumed = len(inner_rows)
            components = _parse_mark_components(inner_table)

        results.append(
            {
                "slot": first_slot(raw_slot),
                "slots": raw_slot,
                "courseType": course_type_text,
                "type": course_type_of(course_type_text),
                "courseCode": (to_text(outer("course_code")) or "").upper() or None,
                "courseTitle": to_text(outer("course_title")),
                "facultyName": to_text(outer("faculty")),
                "components": components,
            }
        )

        # Advance past: this course row (1) + the container row (1) + every row
        # the inner table contributed to this flattened list (consumed).
        if inner_table is not None:
            index += 2 + consumed
        else:
            index += 1

    return results


def _parse_mark_components(inner_table: Tag) -> List[Dict[str, Any]]:
    """Parse one course's assessment components from its nested table."""
    inner_rows = inner_table.find_all("tr")
    if len(inner_rows) < 2:
        return []

    inner_headings, offset, stride = header_layout(inner_table)
    if not inner_headings or stride <= 0:
        return []

    columns = discover_columns(inner_headings, _MARKS_INNER_RULES)
    if "title" not in columns:
        return []

    cells = inner_table.find_all("td")
    rows = walk_rows(cells, columns, ["title"], stride, offset)

    components: List[Dict[str, Any]] = []
    for row in rows:
        title = to_text(row.get("title"))
        if not title:
            continue
        # DEVIATION: the reference coerces these with `parseFloat(x) || null`,
        # which turns a legitimately-zero mark into null. A scored mark of 0 is
        # real, actionable data, so we preserve it and use None only for cells
        # that are genuinely blank.
        components.append(
            {
                "title": title,
                "scored": to_float(row.get("score")),
                "max": to_float(row.get("max_score")),
                "weightage": to_float(row.get("weightage")),
                "maxWeightage": to_float(row.get("max_weightage")),
                "average": to_float(row.get("average")),
                "status": to_text(row.get("status")),
            }
        )

    return components


# ---------------------------------------------------------------------------
# 7. exam schedule
# ---------------------------------------------------------------------------

# "date" is tested before ("exam","time") so "Exam Date" can't be taken as the
# timing column.
_EXAM_RULES = [
    ("slot", contains("slot")),
    ("date", contains("date")),
    ("timing", contains("exam", "time")),
    ("venue", contains("venue")),
    ("location", contains("location")),
    ("number", contains("seat", "no")),
]

# How many output keys each discovered column contributes. `timing` yields two
# (start and end), everything else yields one.
_EXAM_KEY_WEIGHT = {
    "slot": 1,
    "date": 1,
    "timing": 2,
    "venue": 1,
    "location": 1,
    "number": 1,
}


def _space_before_first_digit(text: str) -> str:
    """``"CAT1"`` -> ``"CAT 1"``; ``"FAT"`` is unchanged."""
    match = re.search(r"\d", text)
    if not match:
        return text.strip()
    spaced = text[: match.start()] + " " + text[match.start() :]
    return " ".join(spaced.split()).strip()


def parse_exam_schedule(html: str) -> Dict[str, List[Dict[str, Any]]]:
    """
    Parse the exam schedule, grouped by exam type ("CAT 1", "FAT", ...).

    This page has no container id, and its exam-type headings are ordinary rows
    distinguished only by a ``colspan`` greater than 1. Each such heading row
    contributes exactly one cell to the flattened list, which throws the
    column phase off by one — hence the ``- len(result)`` realignment below,
    mirroring the reference.
    """
    if body_says(html, "not found"):
        logger.info("[VTOP] Exam schedule: nothing found")
        return {}

    soup = soup_of(html)
    all_rows = soup.find_all("tr")
    if not all_rows:
        return {}

    header_cells = all_rows[0].find_all("td")
    header_used_td = bool(header_cells)
    if not header_cells:
        header_cells = all_rows[0].find_all("th")
    if not header_cells:
        return {}

    columns = discover_columns(header_cells, _EXAM_RULES)
    if "date" not in columns and "slot" not in columns:
        logger.warning("[VTOP] Exam table columns unrecognised: %s", columns)
        return {}

    width = len(header_cells)
    cells = soup.find_all("td")

    # Expected number of keys for a complete row, given the columns that actually
    # exist. The reference hardcodes 7; deriving it keeps us correct when VTOP
    # omits a column (e.g. seat number before seats are allotted).
    expected_keys = sum(
        _EXAM_KEY_WEIGHT[name] for name in columns if name in _EXAM_KEY_WEIGHT
    )
    if expected_keys == 0:
        return {}

    result: Dict[str, List[Dict[str, Any]]] = {}
    current_title: Optional[str] = None
    exam: Dict[str, Any] = {}

    position = width if header_used_td else 0
    index = position
    while index < len(cells):
        cell = cells[index]

        try:
            colspan = int(cell.get("colspan") or 1)
        except (TypeError, ValueError):
            colspan = 1

        if colspan > 1:
            raw_title = to_text(cell) or "Exam"
            current_title = _space_before_first_digit(raw_title)
            result.setdefault(current_title, [])
            exam = {}
            index += 1
            continue

        column_index = (index - len(result)) % width

        if column_index == columns.get("slot"):
            # Reference does not re-trim after the split; to_text already
            # normalises whitespace, so this is equivalent and tidier.
            exam["slot"] = first_slot(to_text(cell))
        elif column_index == columns.get("date"):
            value = to_text(cell)
            exam["date"] = value.upper() if value else None
        elif column_index == columns.get("timing"):
            value = to_text(cell)
            parts = value.split("-") if value else []
            if len(parts) == 2:
                exam["start_time"] = parts[0].strip() or None
                exam["end_time"] = parts[1].strip() or None
            else:
                exam["start_time"] = None
                exam["end_time"] = None
        elif column_index == columns.get("venue"):
            exam["venue"] = to_text(cell)
        elif column_index == columns.get("location"):
            exam["seat_location"] = to_text(cell)
        elif column_index == columns.get("number"):
            exam["seat_number"] = to_int(cell)

        if len(exam) >= expected_keys:
            title = current_title or "Exam"
            result.setdefault(title, []).append(exam)
            exam = {}

        index += 1

    return result


# ---------------------------------------------------------------------------
# grade history & cumulative standing (StudentGradeHistory)
# ---------------------------------------------------------------------------


def parse_grade_history(html: str) -> Dict[str, Any]:
    """
    Parse cumulative earned credits and CGPA from examinations/examGradeView/StudentGradeHistory.
    """
    if body_says(html, "not authorized", "no record", "no data"):
        return {"cgpa": None, "creditsEarned": None, "hasValidData": False}

    soup = soup_of(html)
    tables = soup.find_all("table")
    for table in reversed(tables):
        first_row = table.find("tr")
        if not first_row:
            continue
        headings = first_row.find_all(["td", "th"])
        if not headings:
            continue
        header_text = norm(" ".join(raw_text(h) for h in headings))
        if "credits" in header_text or "cgpa" in header_text:
            credits_idx = None
            cgpa_idx = None
            for j, h in enumerate(headings):
                h_norm = norm(raw_text(h))
                if "earned" in h_norm or ("credits" in h_norm and "registered" not in h_norm and "total" not in h_norm):
                    credits_idx = j
                elif "cgpa" in h_norm or "cumulative" in h_norm:
                    cgpa_idx = j

            cells = table.find_all("td")
            n_head = len(headings)
            offset = n_head if first_row.find_all("td") else 0
            cgpa = None
            credits_earned = None
            if cgpa_idx is not None and (cgpa_idx + offset) < len(cells):
                cgpa = to_float(cells[cgpa_idx + offset])
            if credits_idx is not None and (credits_idx + offset) < len(cells):
                credits_earned = to_float(cells[credits_idx + offset])

            if cgpa is not None or credits_earned is not None:
                return {
                    "cgpa": cgpa,
                    "creditsEarned": credits_earned,
                    "hasValidData": True,
                }

    return {"cgpa": None, "creditsEarned": None, "hasValidData": False}


# ---------------------------------------------------------------------------
# per-semester course grades & GPA (doStudentGradeView)
# ---------------------------------------------------------------------------


def parse_semester_grades(html: str) -> Dict[str, Any]:
    """
    Parse course grades ("S", "A", "B", ...) and semester GPA from doStudentGradeView.
    """
    if body_says(html, "no records", "no record", "not found", "not authorized"):
        return {"grades": [], "gpa": None}

    soup = soup_of(html)
    tables = soup.find_all("table")
    if not tables:
        return {"grades": [], "gpa": None}

    table = tables[0]
    header_cells = table.find_all("th")
    header_used_td = False
    if not header_cells:
        first_row = table.find("tr")
        if first_row:
            header_cells = first_row.find_all("td")
            header_used_td = True
    if not header_cells:
        return {"grades": [], "gpa": None}

    _GRADE_RULES: Sequence[ColumnRule] = [
        ("code", contains("code")),
        ("title", contains("title")),
        ("credits", contains("credits")),
        ("grade", contains("grade")),
    ]
    columns = discover_columns(header_cells, _GRADE_RULES)
    if "code" not in columns or "grade" not in columns:
        return {"grades": [], "gpa": None}

    stride = len(header_cells)
    cells = table.find_all("td")
    offset = stride if header_used_td else 0
    grades: List[Dict[str, Any]] = []

    gpa: Optional[float] = None
    gpa_match = re.search(r"GPA\s*:\s*([\d\.]+)", html, re.IGNORECASE)
    if gpa_match:
        try:
            gpa = float(gpa_match.group(1))
        except ValueError:
            pass

    code_idx = columns["code"] + offset
    grade_idx = columns["grade"] + offset
    title_idx = (columns.get("title") + offset) if "title" in columns else None
    credits_idx = (columns.get("credits") + offset) if "credits" in columns else None

    while code_idx < len(cells) and grade_idx < len(cells):
        raw_code = to_text(cells[code_idx])
        raw_grade = to_text(cells[grade_idx])
        if raw_code and raw_grade:
            if "gpa" not in raw_code.lower():
                grades.append({
                    "courseCode": raw_code.split("-")[0].strip(),
                    "courseTitle": to_text(cells[title_idx]) if title_idx and title_idx < len(cells) else None,
                    "credits": to_float(cells[credits_idx]) if credits_idx and credits_idx < len(cells) else None,
                    "grade": raw_grade,
                })
        code_idx += stride
        grade_idx += stride
        if title_idx is not None:
            title_idx += stride
        if credits_idx is not None:
            credits_idx += stride

    return {"grades": grades, "gpa": gpa}


# ---------------------------------------------------------------------------
# payment receipts & dues (p2p/getReceiptsApplno & p2p/Payments)
# ---------------------------------------------------------------------------


_RECEIPT_RULES: Sequence[ColumnRule] = [
    ("date", contains("date")),
    ("receipt", lambda t: "receipt" in t and "date" not in t),
    ("amount", contains("amount")),
    ("description", lambda t: "fee" in t or "particular" in t or "desc" in t or "item" in t),
]


def parse_receipts(html: str) -> List[Dict[str, Any]]:
    """
    Parse official payment receipts from p2p/getReceiptsApplno.
    """
    if body_says(html, "no record", "not found", "not authorized"):
        return []

    soup = soup_of(html)
    tables = soup.find_all("table")
    if not tables:
        return []

    table = tables[0]
    header_cells, offset, stride = header_layout(table)
    if not header_cells:
        return []

    columns = discover_columns(header_cells, _RECEIPT_RULES)
    if "receipt" not in columns and "amount" not in columns:
        return []

    cells = table.find_all("td")
    rows = walk_rows(cells, columns, required=["amount"] if "amount" in columns else ["receipt"], stride=stride, offset=offset)

    receipts: List[Dict[str, Any]] = []
    for idx, row in enumerate(rows):
        receipt_num = to_int(row.get("receipt"))
        amount = to_float(row.get("amount"))
        date = to_text(row.get("date"))
        desc = to_text(row.get("description")) if "description" in row else None

        num_str = str(receipt_num) if receipt_num is not None else f"REC-{idx + 1}"
        amt_val = amount if amount is not None else 0.0

        receipts.append({
            "id": f"receipt-{num_str}",
            "receiptNumber": num_str,
            "amount": amt_val,
            "totalAmount": amt_val,
            "paidAmount": amt_val,
            "pendingAmount": 0,
            "date": date,
            "paymentDate": date,
            "title": desc or f"Official Academic Fee Receipt #{num_str}",
            "category": "Tuition / Academic Fee",
            "status": "Paid",
        })

    return receipts


def parse_payments(html: str) -> Dict[str, Any]:
    """
    Parse pending fee dues from p2p/Payments.
    """
    if body_says(html, "no payment dues", "no dues", "nil", "no pending"):
        return {"hasDues": False, "totalDue": 0.0, "items": []}

    soup = soup_of(html)
    tables = soup.find_all("table")
    items: List[Dict[str, Any]] = []
    total_due = 0.0

    for table in tables:
        rows = table.find_all("tr")
        if len(rows) > 1:
            for row in rows[1:]:
                cells = row.find_all("td")
                if len(cells) >= 2:
                    desc = to_text(cells[0])
                    amt = to_float(cells[-1])
                    if desc and amt:
                        total_due += amt
                        items.append({
                            "id": f"due-{len(items) + 1}",
                            "title": desc,
                            "amount": amt,
                            "totalAmount": amt,
                            "pendingAmount": amt,
                            "category": "Academic Fee Due",
                            "status": "Pending",
                        })

    has_dues = total_due > 0 or not body_says(html, "no payment dues")
    return {"hasDues": has_dues, "totalDue": round(total_due, 2), "items": items}


# ---------------------------------------------------------------------------
# proctor & dean/hod details (proctor/viewProctorDetails & hrms/viewHodDeanDetails)
# ---------------------------------------------------------------------------


def parse_proctor(html: str) -> Optional[Dict[str, Any]]:
    """
    Parse proctor details from proctor/viewProctorDetails.
    """
    if body_says(html, "not authorized", "no record", "not found"):
        return None

    soup = soup_of(html)
    container = soup.find(id="showDetails") or (soup.find_all("table")[0] if soup.find_all("table") else None)
    if not container:
        return None

    cells = container.find_all("td")
    fields: Dict[str, str] = {}
    i = 0
    while i < len(cells) - 1:
        if cells[i].find("img"):
            i += 1
            continue
        k = to_text(cells[i])
        v = to_text(cells[i + 1])
        if k and v:
            fields[norm(k)] = v
        i += 2

    if not fields:
        return None

    name = None
    email = None
    phone = None
    cabin = None
    designation = None
    school = None

    for k, v in fields.items():
        if "email" in k or "mail" in k:
            email = v
        elif "mobile" in k or "phone" in k or "contact" in k or "intercom" in k:
            phone = v
        elif "cabin" in k or "room" in k or "venue" in k:
            cabin = v
        elif "designation" in k:
            designation = v
        elif "school" in k or "department" in k or "centre" in k:
            school = v
        elif "name" in k or "faculty" in k or "proctor" in k:
            name = v

    return {
        "name": name,
        "email": email,
        "phone": phone,
        "cabin": cabin,
        "designation": designation,
        "school": school,
        "rawFields": fields,
    }


def parse_dean_hod(html: str) -> List[Dict[str, Any]]:
    """
    Parse Dean & HOD details from hrms/viewHodDeanDetails.
    """
    if body_says(html, "not authorized", "no record", "not found"):
        return []

    soup = soup_of(html)
    tables = soup.find_all("table")
    headings = soup.find_all(["h3", "h4", "h2", "strong"])
    staff_list: List[Dict[str, Any]] = []

    for i, table in enumerate(tables):
        title = headings[i].get_text().strip() if i < len(headings) else "Staff"
        role_type = "Dean" if "dean" in title.lower() else ("HOD" if "hod" in title.lower() else title)
        cells = table.find_all("td")
        fields: Dict[str, str] = {}
        j = 0
        while j < len(cells) - 1:
            if cells[j].find("img"):
                j += 1
                continue
            k = to_text(cells[j])
            v = to_text(cells[j + 1])
            if k and v:
                fields[norm(k)] = v
            j += 2

        if fields:
            name = None
            email = None
            phone = None
            cabin = None
            school = None
            for k, v in fields.items():
                if "email" in k:
                    email = v
                elif "mobile" in k or "phone" in k or "intercom" in k:
                    phone = v
                elif "cabin" in k:
                    cabin = v
                elif "school" in k or "department" in k:
                    school = v
                elif "name" in k or "faculty" in k:
                    name = v

            staff_list.append({
                "role": role_type,
                "title": title,
                "name": name,
                "email": email,
                "phone": phone,
                "cabin": cabin,
                "school": school,
                "fields": fields,
            })

    return staff_list


# ---------------------------------------------------------------------------
# spotlight / announcements (home)
# ---------------------------------------------------------------------------


def parse_spotlight(html: str) -> List[Dict[str, Any]]:
    """
    Parse campus spotlight & notices from home.
    """
    if body_says(html, "not authorized"):
        return []

    soup = soup_of(html)
    sheets = soup.find_all(
        class_=lambda c: bool(c and any(cls in {"offcanvas", "spotlight", "box-info"} for cls in c.split()))
    )
    items: List[Dict[str, Any]] = []

    for sheet in sheets:
        header = sheet.find(class_=re.compile(r"offcanvas-header|header|card-header", re.IGNORECASE))
        category = "General Notice"
        if header:
            category_tag = header.find("span") or header.find(["h4", "h5", "h6", "strong"])
            if category_tag:
                category = " ".join(category_tag.get_text().split()).strip()

        body = sheet.find(class_=re.compile(r"offcanvas-body|body|card-body", re.IGNORECASE)) or sheet
        lis = body.find_all("li")
        for li in lis:
            text = _inline(raw_text(li)).strip()
            if not text:
                continue
            a_tag = li.find("a")
            link = None
            if a_tag:
                onclick = a_tag.get("onclick") or ""
                if "'" in onclick:
                    link = onclick.split("'")[1]
                else:
                    link = a_tag.get("href")

            items.append({
                "id": f"spotlight-{len(items) + 1}",
                "category": category,
                "announcement": text,
                "link": link,
            })

    return items


# ---------------------------------------------------------------------------
# 11. on-duty (OD) leaves
# ---------------------------------------------------------------------------

_OD_RULES: Sequence[ColumnRule] = [
    ("app_id", lambda t: "app" in t or "s.no" in t or "sno" in t or "sl.no" in t or "sl no" in t or t in ("sl", "sl.", "s.no.", "s no") or "ref" in t or t == "id" or "req" in t),
    ("date", lambda t: "date" in t and "from" not in t and "to" not in t and "appl" not in t and "entry" not in t),
    ("from_date", lambda t: ("from" in t and "date" in t) or t == "from date" or t == "from"),
    ("to_date", lambda t: ("to" in t and "date" in t) or t == "to date" or t == "to"),
    ("from_time", lambda t: ("from" in t and "time" in t) or t == "start time" or t == "time from" or t == "from session" or "session from" in t),
    ("to_time", lambda t: ("to" in t and "time" in t) or t == "end time" or t == "time to" or t == "to session" or "session to" in t),
    ("time_range", lambda t: "time" in t and "from" not in t and "to" not in t and "table" not in t),
    ("course_code", lambda t: ("course" in t and "code" in t) or ("sub" in t and "code" in t) or t == "course" or t == "subject" or "paper" in t),
    ("course_title", lambda t: ("course" in t and ("title" in t or "name" in t or "desc" in t)) or ("sub" in t and ("title" in t or "name" in t))),
    ("slot", lambda t: "slot" in t or "period" in t or "class" in t),
    ("hours", lambda t: "hour" in t or "duration" in t or "no. of hr" in t or "od hr" in t or "hrs" in t or "credit" in t or "period" in t or "sessions" in t or "units" in t or "classes" in t),
    ("days", lambda t: ("day" in t or "days" in t) and "date" not in t and "today" not in t),
    ("reason", lambda t: "reason" in t or "purpose" in t or "event" in t or "category" in t or "desc" in t or "details" in t or "place" in t or "activity" in t or "nature" in t or "remarks" in t),
    ("status", lambda t: "status" in t or "state" in t or "approval" in t or "recommend" in t or "decision" in t or "action" in t or "sanction" in t),
    ("approved_by", lambda t: "approved" in t or "sanctioned" in t or "faculty" in t or "staff" in t or "authority" in t or "advisor" in t or "hod" in t or "dean" in t or "recommender" in t),
]


def parse_time_duration(start_str: Optional[str], end_str: Optional[str]) -> Optional[float]:
    """
    Compute duration in hours between two time strings like '08:00 AM' and '11:00 AM'
    or '08:30' and '11:30' or '14:00' and '16:00'.
    """
    if not start_str or not end_str:
        return None
    try:
        def to_minutes(t_str: str) -> Optional[int]:
            t_str = t_str.strip()
            match_12 = re.search(r"(\d{1,2})[:.](\d{2})(?:\s*([APap][Mm]))?", t_str)
            if not match_12:
                match_hr = re.search(r"(\d{1,2})(?:\s*([APap][Mm]))", t_str)
                if match_hr:
                    hr = int(match_hr.group(1))
                    meridiem = (match_hr.group(2) or "").upper()
                    if meridiem == "PM" and hr < 12:
                        hr += 12
                    elif meridiem == "AM" and hr == 12:
                        hr = 0
                    return hr * 60
                return None
            hr = int(match_12.group(1))
            mn = int(match_12.group(2))
            meridiem = (match_12.group(3) or "").upper()
            if meridiem == "PM" and hr < 12:
                hr += 12
            elif meridiem == "AM" and hr == 12:
                hr = 0
            return hr * 60 + mn

        start_min = to_minutes(start_str)
        end_min = to_minutes(end_str)
        if start_min is not None and end_min is not None:
            if end_min < start_min:
                if end_min + 720 > start_min:
                    end_min += 720
            diff = (end_min - start_min) / 60.0
            if 0 < diff <= 24:
                return round(diff, 1)
    except Exception:
        pass
    return None


def parse_time_range_duration(time_str: Optional[str]) -> Optional[float]:
    """Extract and compute duration from a range string like '08:00 AM - 11:00 AM' or '08:30 to 11:30'."""
    if not time_str:
        return None
    parts = re.split(r"\s*(?:-|to|–|—)\s*", time_str.strip(), maxsplit=1)
    if len(parts) == 2:
        return parse_time_duration(parts[0], parts[1])
    return None


def parse_slots_count(slot_str: Optional[str]) -> Optional[int]:
    """Count academic slots (e.g. 'A1+TA1' -> 2, 'L1+L2+L3' -> 3, 'B2' -> 1)."""
    if not slot_str:
        return None
    tokens = [s.strip() for s in re.split(r"[\s+,;/]+", slot_str) if s.strip()]
    slot_tokens = [t for t in tokens if re.match(r"^[A-Za-z]+\d+$", t) or t in ("V1", "V2", "ETH", "EPJ")]
    if slot_tokens:
        return len(slot_tokens)
    return len(tokens) if tokens else None


def convert_days_to_hours(days: Optional[float]) -> Optional[int]:
    """In VIT institutional regulations, 1 full day of OD = 6 academic class hours."""
    if days is not None and days > 0:
        return int(round(days * 6))
    return None


def calculate_days_from_dates(from_date: Optional[str], to_date: Optional[str]) -> Optional[int]:
    """Calculate the number of calendar/academic days spanned by fromDate and toDate."""
    if not from_date or not to_date or from_date == to_date:
        return 1
    for fmt in ("%d-%b-%Y", "%d-%B-%Y", "%Y-%m-%d", "%d/%m/%Y", "%d-%m-%Y"):
        try:
            d1 = datetime.strptime(from_date.strip(), fmt)
            d2 = datetime.strptime(to_date.strip(), fmt)
            diff = (d2 - d1).days + 1
            if 0 < diff <= 60:
                return diff
        except Exception:
            continue
    return 1


def parse_od(html: str) -> Dict[str, Any]:
    """
    Parse student On-Duty (OD) records and calculate total approved hours.
    Differentiates explicit states:
    - success_with_records
    - success_with_no_records
    - parser_failed
    - source_unavailable
    - authentication_required
    """
    logger.info("[VTOP OD Parser] Parsing OD HTML payload (length: %d)", len(html) if html else 0)

    if not html or not html.strip():
        return {
            "state": "source_unavailable",
            "hasValidData": False,
            "usedHours": None,
            "odHours": None,
            "totalOdHours": None,
            "approvedHours": 0,
            "pendingHours": 0,
            "rejectedHours": 0,
            "maxHours": C.OD_MAX_HOURS,
            "maxOdHours": C.OD_MAX_HOURS,
            "remainingHours": None,
            "percentageUsed": None,
            "records": [],
            "odRecords": [],
            "message": "OD source unavailable from VTOP portal.",
        }

    if body_says(html, "not authorized", "session expired", "please login"):
        return {
            "state": "authentication_required",
            "hasValidData": False,
            "usedHours": None,
            "odHours": None,
            "totalOdHours": None,
            "approvedHours": 0,
            "pendingHours": 0,
            "rejectedHours": 0,
            "maxHours": C.OD_MAX_HOURS,
            "maxOdHours": C.OD_MAX_HOURS,
            "remainingHours": None,
            "percentageUsed": None,
            "records": [],
            "odRecords": [],
            "message": "Authentication required to view On-Duty records.",
        }

    # Detect institutional limit from text if printed on page
    max_hours = C.OD_MAX_HOURS
    limit_match = re.search(r"(?:max|permissible|allowed|limit)[^\d]{1,20}(\d{1,3})\s*(?:hr|hour)", html, re.IGNORECASE)
    if limit_match:
        try:
            max_hours = int(limit_match.group(1))
        except ValueError:
            max_hours = C.OD_MAX_HOURS

    # Explicit "no records found" marker
    if body_says(html, "no record(s) found", "no record found", "no data found", "no od applied", "nil", "no details found", "no on-duty records", "no leave history"):
        logger.info("[VTOP OD Parser] Explicit no records marker detected on VTOP page.")
        return {
            "state": "success_with_no_records",
            "hasValidData": True,
            "usedHours": 0,
            "odHours": 0,
            "totalOdHours": 0,
            "approvedHours": 0,
            "pendingHours": 0,
            "rejectedHours": 0,
            "maxHours": max_hours,
            "maxOdHours": max_hours,
            "remainingHours": max_hours,
            "percentageUsed": 0.0,
            "records": [],
            "odRecords": [],
            "message": "No sanctioned On-Duty leave records found on VTOP for this semester.",
        }

    soup = soup_of(html)
    tables = soup.find_all("table")
    if not tables:
        return {
            "state": "source_unavailable",
            "hasValidData": False,
            "usedHours": None,
            "odHours": None,
            "totalOdHours": None,
            "approvedHours": 0,
            "pendingHours": 0,
            "rejectedHours": 0,
            "maxHours": max_hours,
            "maxOdHours": max_hours,
            "remainingHours": None,
            "percentageUsed": None,
            "records": [],
            "odRecords": [],
            "message": "No OD table found in VTOP response.",
        }

    # Find the table that matches OD headers
    selected_table = None
    selected_columns: Dict[str, int] = {}
    selected_headings: List[Tag] = []
    selected_offset = 0
    selected_stride = 0

    for table in tables:
        headings, offset, stride = header_layout(table)
        if not headings or stride <= 0:
            continue
        columns = discover_columns(headings, _OD_RULES)
        # Check if table looks like an OD table (at least 2 matching columns or key OD fields)
        if len(columns) >= 2 or any(k in columns for k in ("hours", "status", "date", "reason", "course_code", "from_date")):
            selected_table = table
            selected_columns = columns
            selected_headings = headings
            selected_offset = offset
            selected_stride = stride
            break

    if selected_table is None:
        first_table = tables[0]
        headings, offset, stride = header_layout(first_table)
        if headings and stride > 0:
            selected_table = first_table
            selected_columns = discover_columns(headings, _OD_RULES)
            selected_headings = headings
            selected_offset = offset
            selected_stride = stride

    if selected_table is None:
        return {
            "state": "parser_failed",
            "hasValidData": False,
            "usedHours": None,
            "odHours": None,
            "totalOdHours": None,
            "approvedHours": 0,
            "pendingHours": 0,
            "rejectedHours": 0,
            "maxHours": max_hours,
            "maxOdHours": max_hours,
            "remainingHours": None,
            "percentageUsed": None,
            "records": [],
            "odRecords": [],
            "message": "Unable to parse OD data from VTOP: header layout could not be resolved.",
        }

    # Extract rows: try walk_rows first, then fallback to tr-level iteration
    cells = selected_table.find_all("td")
    required = [k for k in ("hours", "status", "date", "course_code", "reason", "from_date") if k in selected_columns]
    if not required and selected_columns:
        required = list(selected_columns.keys())[:1]

    rows = walk_rows(cells, selected_columns, required=required, stride=selected_stride, offset=selected_offset)

    if not rows:
        # Fall back to row-by-row TR parsing
        tr_rows = selected_table.find_all("tr")
        for tr in tr_rows:
            tds = tr.find_all("td")
            if not tds:
                continue
            # Check if row is a "no records" placeholder
            row_text = tr.get_text().lower()
            if any(p in row_text for p in ("no record", "no data", "nil", "no details")):
                continue
            row_dict: Dict[str, Tag] = {}
            for name, col_idx in selected_columns.items():
                if 0 <= col_idx < len(tds):
                    row_dict[name] = tds[col_idx]
            if row_dict:
                rows.append(row_dict)

    if not rows:
        logger.info("[VTOP OD Parser] Table headers found with 0 data rows -> verified empty state.")
        return {
            "state": "success_with_no_records",
            "hasValidData": True,
            "usedHours": 0,
            "odHours": 0,
            "totalOdHours": 0,
            "approvedHours": 0,
            "pendingHours": 0,
            "rejectedHours": 0,
            "maxHours": max_hours,
            "maxOdHours": max_hours,
            "remainingHours": max_hours,
            "percentageUsed": 0.0,
            "records": [],
            "odRecords": [],
            "message": "No sanctioned On-Duty leave records found on VTOP for this semester.",
        }

    records: List[Dict[str, Any]] = []
    approved_hours = 0
    pending_hours = 0
    rejected_hours = 0

    for idx, row in enumerate(rows):
        date_str = to_text(row.get("date")) or to_text(row.get("from_date")) or "Recorded Date"
        from_date = to_text(row.get("from_date")) or date_str
        to_date = to_text(row.get("to_date")) or date_str
        from_time = to_text(row.get("from_time"))
        to_time = to_text(row.get("to_time"))
        time_range = to_text(row.get("time_range"))
        course_code = to_text(row.get("course_code")) or "GENERAL"
        course_title = to_text(row.get("course_title")) or "On-Duty Academic Leave"
        reason = to_text(row.get("reason")) or "Sanctioned Institutional OD"
        slot_text = to_text(row.get("slot"))
        approved_by = to_text(row.get("approved_by"))

        # Calculate duration accurately
        dur_from_times = None
        if from_time and to_time:
            dur_from_times = parse_time_duration(from_time, to_time)
        if dur_from_times is None and time_range:
            dur_from_times = parse_time_range_duration(time_range)

        explicit_hours = to_float(row.get("hours"))
        if explicit_hours is None and row.get("hours"):
            h_match = re.search(r"(\d+(?:\.\d+)?)\s*(?:hr|hour|period)?", to_text(row.get("hours")) or "")
            if h_match:
                try:
                    explicit_hours = float(h_match.group(1))
                except ValueError:
                    pass

        slots_count = parse_slots_count(slot_text)
        days_val = to_float(row.get("days"))
        if days_val is None and from_date and to_date and from_date != to_date:
            days_val = float(calculate_days_from_dates(from_date, to_date) or 1)

        if dur_from_times is not None and dur_from_times > 0:
            calc_hours = int(round(dur_from_times))
        elif explicit_hours is not None and explicit_hours > 0:
            calc_hours = int(round(explicit_hours))
        elif slots_count is not None and slots_count > 0:
            calc_hours = slots_count
        elif days_val is not None and days_val > 0:
            calc_hours = convert_days_to_hours(days_val) or 6
        else:
            calc_hours = 1

        raw_status = (to_text(row.get("status")) or "Approved").strip()
        status_lower = raw_status.lower()

        is_rejected = any(s in status_lower for s in ("reject", "decline", "cancel", "disapprove", "not approve", "denied"))
        is_pending = any(s in status_lower for s in ("pending", "wait", "applied", "in progress", "under review"))
        is_approved = any(s in status_lower for s in ("approve", "sanction", "accept", "grant", "avail", "recommend", "verif", "confirm", "process", "forward", "valid", "present", "success")) or (not is_rejected and not is_pending)

        if is_approved:
            norm_status = "Approved"
            approved_hours += calc_hours
        elif is_rejected:
            norm_status = "Rejected"
            rejected_hours += calc_hours
        else:
            norm_status = "Pending"
            pending_hours += calc_hours

        records.append({
            "id": to_text(row.get("app_id")) or f"od-{idx + 1}",
            "date": date_str,
            "fromDate": from_date,
            "toDate": to_date,
            "fromTime": from_time,
            "toTime": to_time,
            "timeRange": time_range,
            "subjectCode": course_code.upper(),
            "subjectTitle": course_title,
            "hours": calc_hours,
            "days": int(days_val) if days_val else 1,
            "reason": reason,
            "status": norm_status,
            "isApproved": is_approved,
            "slot": slot_text,
            "approvedBy": approved_by,
            "rawFields": {k: to_text(v) for k, v in row.items()},
        })

    remaining = max(0, max_hours - approved_hours)
    percentage = round((approved_hours / float(max_hours)) * 100.0, 1)

    result = {
        "state": "success_with_records" if records else "success_with_no_records",
        "hasValidData": True,
        "usedHours": approved_hours,
        "odHours": approved_hours,
        "totalOdHours": approved_hours,
        "approvedHours": approved_hours,
        "pendingHours": pending_hours,
        "rejectedHours": rejected_hours,
        "maxHours": max_hours,
        "maxOdHours": max_hours,
        "remainingHours": remaining,
        "percentageUsed": percentage,
        "records": records,
        "odRecords": records,
        "message": f"Successfully parsed {len(records)} OD record(s). ({approved_hours}h approved)",
    }
    logger.info("[VTOP OD Parser] Finished parsing: state=%s, approvedHours=%d, totalRecords=%d", result["state"], approved_hours, len(records))
    return result



