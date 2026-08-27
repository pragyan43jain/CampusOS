"""
VTOP endpoint constants for VIT Chennai.

Every path here was verified against StudentCC's VTOPService.java
(github.com/Salmanmalvasi/StudentCC), which is the authoritative reference
implementation for VTOP scraping. Do not "correct" these paths from memory —
several look wrong but are exactly what the portal expects (e.g. the `Chn`
suffix on the timetable menu endpoint, and `doStudentMarkView` rather than
`StudentMarkView`).

All module paths are relative to BASE_URL.
"""

CAMPUS = "chennai"
BASE_URL = "https://vtopcc.vit.ac.in/vtop"

# ---------------------------------------------------------------------------
# Pre-login / auth
# ---------------------------------------------------------------------------
# StudentCC hits these as absolute paths under /vtop/, not as relative AJAX.
LOGIN_PAGE = "login"
PRELOGIN_SETUP = "prelogin/setup"
LOGIN_SUBMIT = "login"
CONTENT_PAGE = "content"

# Marker that proves authentication succeeded. StudentCC detects login success
# purely by searching the response body for this string — there is no redirect
# or status code to rely on.
AUTH_MARKER = "authorizedIDX"

# Present in the response when VTOP rejects the WebView/client user agent.
UNAUTHORIZED_MARKER = "not authorized"

# ---------------------------------------------------------------------------
# Module endpoints
# ---------------------------------------------------------------------------
# Semester dropdown. The `Chn` suffix is Chennai-specific.
SEMESTER_LIST = "academics/common/StudentTimeTableChn"

# Serves double duty: the registered-course table (#studentDetailsList) and
# the timetable grid (#timeTableStyle) both come from this one endpoint.
TIMETABLE = "processViewTimeTable"

ATTENDANCE = "processViewStudentAttendance"
MARKS = "examinations/doStudentMarkView"
EXAM_SCHEDULE = "examinations/doSearchExamScheduleForStudent"

# Cumulative earned credits + CGPA (single summary row).
GRADE_HISTORY = "examinations/examGradeView/StudentGradeHistory"

# Per-semester course grades + GPA.
SEMESTER_GRADES = "examinations/examGradeView/doStudentGradeView"

PROFILE = "studentsRecord/StudentProfileAllView"
PROCTOR = "proctor/viewProctorDetails"
HOD_DEAN = "hrms/viewHodDeanDetails"
PAYMENTS = "p2p/Payments"
RECEIPTS = "p2p/getReceiptsApplno"
SPOTLIGHT = "home"
OD = "academics/common/StudentODView"
OD_ALT = "examinations/StudentODView"
OD_MENU = "students/viewStudentODDetails"

# Maximum sanctioned OD hours allowed per semester by institutional policy.
OD_MAX_HOURS = 40

# All candidate endpoints probed in sequence for On-Duty (OD) data.
# Covers both general and Chennai-specific (Chn) endpoints.
OD_CANDIDATES = [
    ("academics/common/StudentODView", "semester", True),
    ("academics/common/StudentODViewChn", "semester", True),
    ("academics/common/StudentODChn", "semester", True),
    ("academics/common/StudentODView", "menu", True),
    ("academics/common/StudentODViewChn", "menu", True),
    ("academics/common/doStudentODView", "semester", True),
    ("academics/common/doStudentODViewChn", "semester", True),
    ("students/viewStudentODDetails", "menu", True),
    ("students/viewStudentODDetailsChn", "menu", True),
    ("students/viewStudentODDetails", "semester", True),
    ("students/viewStudentODDetailsChn", "semester", True),
    ("students/viewStudentOD", "menu", True),
    ("students/viewStudentODChn", "menu", True),
    ("students/viewStudentODHistory", "menu", True),
    ("students/viewStudentODHistoryChn", "menu", True),
    ("students/StudentODView", "menu", True),
    ("students/StudentODViewChn", "menu", True),
    ("leave/viewStudentODDetails", "menu", True),
    ("leave/viewStudentODDetailsChn", "menu", True),
    ("leave/viewStudentODHistory", "menu", True),
    ("leave/viewStudentODHistoryChn", "menu", True),
    ("leave/StudentODView", "menu", True),
    ("leave/StudentODViewChn", "menu", True),
    ("leave/StudentODView", "semester", True),
    ("leave/StudentODViewChn", "semester", True),
    ("leave/StudentOD", "menu", True),
    ("leave/StudentODChn", "menu", True),
    ("leave/doStudentLeaveView", "semester", True),
    ("leave/doStudentLeaveViewChn", "semester", True),
    ("leave/viewStudentLeaveHistory", "menu", True),
    ("leave/viewStudentLeaveHistoryChn", "menu", True),
    ("leave/StudentLeaveView", "menu", True),
    ("leave/StudentLeaveViewChn", "menu", True),
    ("academics/common/StudentAttendanceODView", "semester", True),
    ("academics/common/StudentAttendanceODChn", "semester", True),
    ("examinations/StudentODView", "semester", False),
    ("examinations/StudentODViewChn", "semester", False),
    ("examinations/examGradeView/StudentODView", "semester", False),
    ("examinations/examGradeView/StudentODViewChn", "semester", False),
    ("examinations/doStudentODView", "semester", False),
    ("examinations/doStudentODViewChn", "semester", False),
]

# ---------------------------------------------------------------------------
# Parsing constants
# ---------------------------------------------------------------------------
# A timetable cell is a *registered* slot only if its bgcolor attribute is
# exactly this. Unregistered/free periods use a different colour.
REGISTERED_SLOT_BGCOLOR = "#fc6c85"

# Course type namespaces. Attendance/marks/exam rows are bound back to a course
# by (first slot code, course type), so these must stay separate.
TYPE_THEORY = "theory"
TYPE_LAB = "lab"
TYPE_PROJECT = "project"

# Institutional attendance threshold at VIT.
MIN_ATTENDANCE_PCT = 75.0

# StudentCC sends this literally — it sits inside a single-quoted JS string and
# the Razor expression is never evaluated. Reproduced byte-for-byte so our
# requests match the reference client exactly.
NOCACHE_LITERAL = "@(new Date().getTime())"

DEFAULT_USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
)
