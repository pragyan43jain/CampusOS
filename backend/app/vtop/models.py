"""
Response schemas for the VTOP API.

These mirror what ``app/vtop/scraper.sync()`` produces, field for field. They
exist for two reasons: to give ``/docs`` an accurate contract, and to make an
accidental shape change visible.

Three rules hold throughout, and they are the whole point of this file:

1. **Every data field is Optional and defaults to None.** No ``"Not available"``,
   no ``0``, no ``160``. A placeholder string in a data field is indistinguishable
   from a value once it reaches the UI, and that is precisely how the previous
   build ended up displaying invented figures.
2. **``extra="allow"``.** These models are documentation, not filters. If the
   pipeline gains a field before the schema does, FastAPI must pass it through
   rather than silently drop it — dropping a field the frontend relies on is a
   much worse failure than an out-of-date doc.
3. **Missing versus empty are different types.** ``None`` means "VTOP never told
   us"; an empty list or ``hasValidData: False`` means "we asked and there was
   nothing". The routers preserve that distinction and so must these.
"""

from typing import Any, Dict, List, Optional

from pydantic import BaseModel, ConfigDict


class _Open(BaseModel):
    """Base allowing unmodelled keys through. See rule 2 above."""

    model_config = ConfigDict(extra="allow")


# ---------------------------------------------------------------------------
# shared value objects
# ---------------------------------------------------------------------------


class AttendanceMetrics(_Open):
    """
    Output of ``math_engine.calculate_attendance_metrics``.

    ``hasValidData`` is the field to branch on. When it is False every numeric
    field here is None and ``displayPercentage`` is the literal string
    "Not available" — that string is a *display* value, deliberately kept out of
    the numeric fields.
    """

    attended: Optional[int] = None
    total: Optional[int] = None
    rawPercentage: Optional[float] = None
    percentage: Optional[float] = None
    displayPercentage: Optional[str] = None
    safeToMiss: Optional[int] = None
    needToAttend: Optional[int] = None
    isCritical: bool = False
    status: Optional[str] = None
    hasValidData: bool = False


class MarkComponent(_Open):
    """
    One assessment component exactly as VTOP named it.

    ``title`` is verbatim portal text ("CAT-1", "Quiz 1", "Lab Assessment 3") and
    is not normalised into a fixed set — see ``scraper.build_marks``.
    """

    title: Optional[str] = None
    maxMark: Optional[float] = None
    maxWeightage: Optional[float] = None
    status: Optional[str] = None
    scored: Optional[float] = None
    weightage: Optional[float] = None
    average: Optional[float] = None


class SemesterOption(_Open):
    id: Optional[str] = None
    name: Optional[str] = None


# ---------------------------------------------------------------------------
# modules
# ---------------------------------------------------------------------------


class StudentModel(_Open):
    """
    The dashboard header.

    ``cgpa``, ``creditsEarned``, ``totalCreditsRequired`` and ``rank`` stay None
    until a verified source exists for them: the grade-history module is not wired
    up yet, and VTOP does not publish rank at all. They were previously defaulted
    to plausible numbers.
    """

    name: Optional[str] = None
    regNo: Optional[str] = None
    email: Optional[str] = None
    program: Optional[str] = None
    branch: Optional[str] = None
    semester: Optional[str] = None
    semesterId: Optional[str] = None
    batch: Optional[str] = None
    cgpa: Optional[float] = None
    creditsEarned: Optional[float] = None
    totalCreditsRequired: Optional[float] = None
    registeredCredits: Optional[float] = None
    rank: Optional[int] = None
    overallAttendance: Optional[AttendanceMetrics] = None
    semesterGpa: List[Dict[str, Any]] = []
    lastSynced: Optional[str] = None


class AttendanceRecord(AttendanceMetrics):
    """
    Per-course attendance. Inherits the recomputed metrics.

    ``reportedPercentage`` is what VTOP printed and is for diagnostics only;
    ``percentage`` is derived from attended/total. They disagree routinely because
    VTOP rounds, and a mismatch beyond a point of rounding raises a sync warning.

    ``resolved`` is False when the row could not be bound to a registered course,
    in which case ``venue``/``credits`` are None but the counts are still real.
    """

    id: Optional[str] = None
    courseId: Optional[int] = None
    courseCode: Optional[str] = None
    courseTitle: Optional[str] = None
    courseType: Optional[str] = None
    type: Optional[str] = None
    slot: Optional[str] = None
    slots: Optional[str] = None
    venue: Optional[str] = None
    faculty: Optional[str] = None
    credits: Optional[float] = None
    resolved: bool = False
    reportedPercentage: Optional[float] = None


class MarksRecord(_Open):
    """
    Per-course marks as a component list, not fixed buckets.

    ``weightageScored``/``weightageGraded`` are the running total over components
    that have actually been graded. ``weightageTotal`` covers every component
    including ungraded ones, and is a separate field so it cannot be mistaken for
    the denominator — using it as one makes a student on 12.6/25 look like 12.6/40.
    """

    id: Optional[str] = None
    courseId: Optional[int] = None
    courseCode: Optional[str] = None
    courseTitle: Optional[str] = None
    courseType: Optional[str] = None
    type: Optional[str] = None
    slot: Optional[str] = None
    faculty: Optional[str] = None
    resolved: bool = False
    components: List[MarkComponent] = []
    weightageScored: Optional[float] = None
    weightageGraded: Optional[float] = None
    weightageTotal: Optional[float] = None


class TimetableEntry(_Open):
    """
    One scheduled class.

    ``venue`` and ``faculty`` come from the registered-course table via the slot
    registry, never from the grid cell text and never synthesised.
    """

    id: Optional[str] = None
    day: Optional[str] = None
    slotName: Optional[str] = None
    startTime: Optional[str] = None
    endTime: Optional[str] = None
    startTime12h: Optional[str] = None
    endTime12h: Optional[str] = None
    courseId: Optional[int] = None
    courseCode: Optional[str] = None
    courseTitle: Optional[str] = None
    venue: Optional[str] = None
    faculty: Optional[str] = None
    credits: Optional[float] = None
    isLab: bool = False
    type: Optional[str] = None
    resolved: bool = False
    attendance: Optional[AttendanceRecord] = None


class CourseRecord(_Open):
    """
    A registered course with its attendance and marks attached.

    ``marks: None`` means no marks row was published for this course, which is not
    the same as an empty component list.
    """

    id: Optional[str] = None
    code: Optional[str] = None
    title: Optional[str] = None
    type: Optional[str] = None
    typeKey: Optional[str] = None
    slot: Optional[str] = None
    slots: List[str] = []
    venue: Optional[str] = None
    faculty: Optional[str] = None
    credits: Optional[float] = None
    attendance: Optional[AttendanceRecord] = None
    marks: Optional[List[MarkComponent]] = None


class ExamEntry(_Open):
    """
    One exam, keyed as the parser emits it (snake_case here, unlike the rest of
    the payload — these come straight off the page).

    Venue and seat stay None until VTOP allots them; it prints "-" in the interim,
    which is not a location.

    Note the absent course code: the exam page prints one, but the reference
    implementation does not read it, so entries currently identify their course by
    ``slot`` alone. Tracked as a known gap rather than filled in by guessing.
    """

    slot: Optional[str] = None
    date: Optional[str] = None
    start_time: Optional[str] = None
    end_time: Optional[str] = None
    venue: Optional[str] = None
    seat_location: Optional[str] = None
    seat_number: Optional[int] = None


class FacultyEntry(_Open):
    """
    Derived from the course table — the only page listing the student's own
    faculty. Not a separate VTOP module, so there is no email or cabin here.
    """

    name: Optional[str] = None
    courses: List[str] = []
    venue: Optional[str] = None


class ODModel(_Open):
    """
    On-duty hours.

    Permanently ``hasValidData: False`` for now: no VTOP endpoint for OD has been
    verified against the reference implementation, so nothing is scraped. The old
    build hardcoded 12 used of 40. See the extension point in ``scraper.sync``.
    """

    usedHours: Optional[int] = None
    maxHours: int = 40
    remainingHours: Optional[int] = None
    percentageUsed: Optional[float] = None
    hasValidData: bool = False
    records: List[Dict[str, Any]] = []


# ---------------------------------------------------------------------------
# sync reporting
# ---------------------------------------------------------------------------


class ModuleStatus(_Open):
    """
    Per-module outcome. ``status`` is one of ok / empty / failed / unavailable.

    The empty-versus-failed split is the one that matters: "you have no exams
    scheduled" and "we could not read your exams" look identical on a dashboard
    unless the API distinguishes them.
    """

    status: Optional[str] = None
    count: Optional[int] = None
    message: Optional[str] = None


class SyncReportModel(_Open):
    ok: bool = False
    modules: Dict[str, ModuleStatus] = {}
    failed: List[str] = []
    warnings: List[str] = []


class RegistryReportModel(_Open):
    """Diagnostics for the slot→course binding that joins the modules together."""

    courseCount: int = 0
    slotCounts: Dict[str, int] = {}
    totalCredits: Optional[float] = None
    conflicts: List[Dict[str, Any]] = []
    unmatched: List[Dict[str, Any]] = []


class SyncPayload(_Open):
    """The full store payload — what ``/sync`` returns and what is persisted."""

    authenticated: bool = False
    message: Optional[str] = None
    student: Optional[StudentModel] = None
    semesters: List[SemesterOption] = []
    selectedSemester: Optional[SemesterOption] = None
    courses: List[CourseRecord] = []
    timetable: List[TimetableEntry] = []
    attendance: List[AttendanceRecord] = []
    marks: List[MarksRecord] = []
    # Grouped by exam type ("CAT 1", "FAT", ...) as VTOP groups them.
    exams: Dict[str, List[ExamEntry]] = {}
    faculty: List[FacultyEntry] = []
    od: Optional[ODModel] = None
    registry: Optional[RegistryReportModel] = None
    syncReport: Optional[SyncReportModel] = None
    lastSynced: Optional[str] = None


# ---------------------------------------------------------------------------
# request/response envelopes
# ---------------------------------------------------------------------------


class LoginRequest(BaseModel):
    """
    Sign-in request.

    ``sessionId`` is required in practice even though it is typed Optional: the
    captcha belongs to the session that issued it, so a login without one cannot
    succeed. It is Optional only so the API can return a clear message instead of
    a 422.
    """

    username: str
    password: str
    sessionId: Optional[str] = None
    captcha: Optional[str] = None
    semesterId: Optional[str] = None


class CaptchaResponse(_Open):
    success: bool = False
    sessionId: Optional[str] = None
    captchaKind: Optional[str] = None
    captchaImage: Optional[str] = None
    solvedCaptcha: Optional[str] = None
    message: Optional[str] = None
    code: Optional[int] = None


class SyncResponse(_Open):
    """
    Envelope for login and sync.

    ``success: True`` with a non-empty ``syncReport.failed`` is a normal outcome: a
    partial sync is still worth returning, with the report saying what is missing.
    ``retryable`` tells the client whether trying again could plausibly work
    (expired captcha) or not (wrong password).
    """

    success: bool = False
    message: Optional[str] = None
    sessionId: Optional[str] = None
    code: Optional[int] = None
    retryable: bool = False
    data: Optional[SyncPayload] = None
    syncReport: Optional[SyncReportModel] = None
    warnings: List[str] = []
    lastSynced: Optional[str] = None
