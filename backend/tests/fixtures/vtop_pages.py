"""
HTML fixtures reproducing real VTOP page structure.

These are hand-built to match the markup quirks the parsers must survive:
grouped/absent headers, a leading Invoice column, `<br>`-separated cells,
bgcolor-flagged registered slots, colspan exam-type headings, nested marks
tables, and legitimately-zero values that must not be read as missing.

Kept deliberately small but structurally faithful — the point is to pin the
parsing contract, not to look like a full page.
"""

# ---------------------------------------------------------------------------
# semesters
# ---------------------------------------------------------------------------

SEMESTERS = """
<html><body>
<div>Time Table</div>
<select id="semesterSubId" name="semesterSubId">
  <option value="">-- Choose Semester --</option>
  <option value="CH20242501">Fall Semester 2024-25</option>
  <option value="CH20242502">Winter Semester 2024-25</option>
</select>
</body></html>
"""

SEMESTERS_UNAUTHORIZED = """
<html><body><p>You are not authorized to view this page</p></body></html>
"""

# ---------------------------------------------------------------------------
# profile
# ---------------------------------------------------------------------------

PROFILE = """
<html><body>
<h3>Personal Information</h3>
<table>
  <tr><td>Student Name</td><td>ANANYA SHARMA</td></tr>
  <tr><td>Register Number</td><td>22BCE1234</td></tr>
  <tr><td>Programme</td><td>BTECH</td></tr>
  <tr><td>Branch</td><td>Computer Science and Engineering</td></tr>
  <tr><td>Email</td><td>ANANYA.SHARMA2022@VITSTUDENT.AC.IN</td></tr>
</table>
</body></html>
"""

# ---------------------------------------------------------------------------
# registered courses
# ---------------------------------------------------------------------------

# Note: the Slot/Venue and Faculty/School cells pack two values into one cell
# separated by " - " (this is VTOP's house style — the timetable grid cells use
# the same separator). The venue "AB1-405" and the faculty "JEAN-PAUL MENON"
# contain hyphens of their own that must survive the split. The theory title
# contains a hyphen ("Object-Oriented") that must survive the code/title split.
COURSES = """
<html><body>
<div id="studentDetailsList">
<table>
  <tr>
    <th>Sl.No.</th><th>Course</th><th>L T P J C</th>
    <th>Slot / Venue</th><th>Faculty / School</th>
  </tr>
  <tr>
    <td>1</td>
    <td>CSE1002 - Object-Oriented Programming (Embedded Theory)</td>
    <td>2 0 2 0 4</td>
    <td>A1+TA1 - AB1-405</td>
    <td>RAJESH KUMAR - SCOPE</td>
  </tr>
  <tr>
    <td>2</td>
    <td>CSE1002 - Object-Oriented Programming (Embedded Lab)</td>
    <td>2 0 2 0 4</td>
    <td>L21+L22 - AB2-210</td>
    <td>RAJESH KUMAR - SCOPE</td>
  </tr>
  <tr>
    <td>3</td>
    <td>MAT2002 - Applications of Differential Equations (Theory Only)</td>
    <td>3 0 0 0 3</td>
    <td>B2 - AB1-302</td>
    <td>JEAN-PAUL MENON - SAS</td>
  </tr>
</table>
</div>
</body></html>
"""

# The reference tracks two *independent* Invoice offsets, which means VTOP has
# two distinct invoice layouts. Each needs its own fixture; conflating them
# produces markup that cannot occur.
#
# Layout 1: the header carries an extra "Invoice" column that the data rows do
# NOT, so each row is one cell narrower than the header (heading_offset = -1).
COURSES_INVOICE_HEADER_ONLY = """
<html><body>
<div id="studentDetailsList">
<table>
  <tr>
    <th>Invoice</th><th>Sl.No.</th><th>Course</th><th>L T P J C</th>
    <th>Slot / Venue</th><th>Faculty / School</th>
  </tr>
  <tr>
    <td>1</td>
    <td>CSE1002 - Object-Oriented Programming (Embedded Theory)</td>
    <td>2 0 2 0 4</td>
    <td>A1+TA1 - AB1-405</td>
    <td>RAJESH KUMAR - SCOPE</td>
  </tr>
</table>
</div>
</body></html>
"""

# Layout 2: the header has no Invoice column but every data row leads with an
# invoice cell, so reads shift one cell right (cell_offset = +1). Detection is by
# the literal word "invoice" in that first body cell.
COURSES_INVOICE_BODY_ONLY = """
<html><body>
<div id="studentDetailsList">
<table>
  <tr>
    <th>Sl.No.</th><th>Course</th><th>L T P J C</th>
    <th>Slot / Venue</th><th>Faculty / School</th>
  </tr>
  <tr>
    <td>View Invoice</td>
    <td>1</td>
    <td>CSE1002 - Object-Oriented Programming (Embedded Theory)</td>
    <td>2 0 2 0 4</td>
    <td>A1+TA1 - AB1-405</td>
    <td>RAJESH KUMAR - SCOPE</td>
  </tr>
</table>
</div>
</body></html>
"""

# Defensive case: the separator written without surrounding spaces. We fall back
# to the reference's bare-hyphen split so slots still come through.
COURSES_UNSPACED_SEPARATOR = """
<html><body>
<div id="studentDetailsList">
<table>
  <tr>
    <th>Sl.No.</th><th>Course</th><th>L T P J C</th>
    <th>Slot / Venue</th><th>Faculty / School</th>
  </tr>
  <tr>
    <td>1</td>
    <td>CSE1002 - Object-Oriented Programming (Embedded Theory)</td>
    <td>2 0 2 0 4</td>
    <td>A1+TA1-AB1</td>
    <td>RAJESH KUMAR-SCOPE</td>
  </tr>
</table>
</div>
</body></html>
"""

COURSES_EMPTY = "<html><body><div>No course registered</div></body></html>"

# ---------------------------------------------------------------------------
# timetable grid
# ---------------------------------------------------------------------------

# Transposed grid: rows are Start/End/day labels, columns are periods.
# Registered cells carry bgcolor="#FC6C85"; unregistered hold a bare slot code.
# The 02:00/03:40 lab times must be read as PM (14:00/15:40).
TIMETABLE = """
<html><body>
<div id="getStudentDetails"><span>Timetable for Fall Semester</span></div>
<table id="timeTableStyle">
  <tr><td>THEORY</td><td>Start</td><td>08:00</td><td>09:00</td></tr>
  <tr><td>THEORY</td><td>End</td><td>08:50</td><td>09:50</td></tr>
  <tr>
    <td rowspan="2">MON</td><td>THEORY</td>
    <td bgcolor="#FC6C85">A1 - CSE1002 - ETH - AB1-405 - ALL</td>
    <td>B1</td>
  </tr>
  <tr>
    <td>LAB</td>
    <td>Start</td><td>02:00</td><td>03:00</td>
  </tr>
  <tr><td>LAB</td><td>End</td><td>02:50</td><td>03:40</td></tr>
  <tr>
    <td rowspan="2">TUE</td><td>THEORY</td>
    <td>C1</td>
    <td bgcolor="#FC6C85">B2 - MAT2002 - TH - AB1-302 - ALL</td>
  </tr>
  <tr>
    <td>LAB</td>
    <td bgcolor="#FC6C85">L21 - CSE1002 - ELA - AB2-210 - ALL</td>
    <td>L23</td>
  </tr>
</table>
</body></html>
"""

TIMETABLE_NO_RECORDS = """
<html><body>
<div id="getStudentDetails"><span>No record(s) found</span></div>
</body></html>
"""

# ---------------------------------------------------------------------------
# attendance
# ---------------------------------------------------------------------------

# Header uses <th>, so header cells are absent from the td list (offset 0).
# The third course has 0 attended of 0 conducted — a real state early in a
# semester that must not be silently dropped or turned into None.
ATTENDANCE = """
<html><body>
<table id="getStudentDetails">
  <tr>
    <th>Sl.No.</th><th>Course Code</th><th>Course Title</th><th>Course Type</th>
    <th>Faculty</th><th>Slot</th><th>Attended Classes</th>
    <th>Total Classes</th><th>Attendance Percentage</th>
  </tr>
  <tr>
    <td>1</td><td>CSE1002</td><td>Object-Oriented Programming</td>
    <td>Embedded Theory</td><td>RAJESH KUMAR</td><td>A1+TA1</td>
    <td>26</td><td>30</td><td>86</td>
  </tr>
  <tr>
    <td>2</td><td>CSE1002</td><td>Object-Oriented Programming</td>
    <td>Embedded Lab</td><td>RAJESH KUMAR</td><td>L21+L22</td>
    <td>10</td><td>14</td><td>71</td>
  </tr>
  <tr>
    <td>3</td><td>MAT2002</td><td>Applications of Differential Equations</td>
    <td>Theory Only</td><td>JEAN-PAUL MENON</td><td>B2</td>
    <td>0</td><td>0</td><td>0</td>
  </tr>
</table>
</body></html>
"""

ATTENDANCE_NO_RECORDS = """
<html><body><table id="getStudentDetails"><tr><td>No record(s) found</td></tr></table></body></html>
"""

# ---------------------------------------------------------------------------
# marks
# ---------------------------------------------------------------------------

# Outer header uses <td>. Each course row is followed by a container row whose
# single cell holds a nested per-component table (also <td> headers).
# CAT-2 is unattempted (blank cells); Quiz 1 scored a real 0.
MARKS = """
<html><body>
<div id="fixedTableContainer">
<table>
  <tr>
    <td>Sl.No.</td><td>Course Code</td><td>Course Title</td>
    <td>Course Type</td><td>Faculty</td><td>Slot</td>
  </tr>
  <tr>
    <td>1</td><td>CSE1002</td><td>Object-Oriented Programming</td>
    <td>Embedded Theory</td><td>RAJESH KUMAR</td><td>A1+TA1</td>
  </tr>
  <tr>
    <td colspan="6">
      <table>
        <tr>
          <td>Sl.No.</td><td>Mark Title</td><td>Max. Mark</td>
          <td>Weightage %</td><td>Status</td><td>Scored Mark</td>
          <td>Weightage Mark</td><td>Average Mark</td>
        </tr>
        <tr>
          <td>1</td><td>CAT-1</td><td>50</td><td>15</td>
          <td>Present</td><td>42</td><td>12.6</td><td>31.4</td>
        </tr>
        <tr>
          <td>2</td><td>Quiz 1</td><td>10</td><td>10</td>
          <td>Present</td><td>0</td><td>0</td><td>6.2</td>
        </tr>
        <tr>
          <td>3</td><td>CAT-2</td><td>50</td><td>15</td>
          <td></td><td></td><td></td><td></td>
        </tr>
      </table>
    </td>
  </tr>
  <tr>
    <td>2</td><td>MAT2002</td><td>Applications of Differential Equations</td>
    <td>Theory Only</td><td>PRIYA MENON</td><td>B2</td>
  </tr>
  <tr>
    <td colspan="6">
      <table>
        <tr>
          <td>Sl.No.</td><td>Mark Title</td><td>Max. Mark</td>
          <td>Weightage %</td><td>Status</td><td>Scored Mark</td>
          <td>Weightage Mark</td><td>Average Mark</td>
        </tr>
        <tr>
          <td>1</td><td>CAT-1</td><td>50</td><td>15</td>
          <td>Present</td><td>38</td><td>11.4</td><td>29.8</td>
        </tr>
      </table>
    </td>
  </tr>
</table>
</div>
</body></html>
"""

MARKS_NO_DATA = "<html><body><p>No Data Found</p></body></html>"

# ---------------------------------------------------------------------------
# exam schedule
# ---------------------------------------------------------------------------

# Exam-type headings are rows with colspan>1. FAT rows have no venue/seat yet and
# use hyphen placeholders, which must become None rather than "-".
EXAM_SCHEDULE = """
<html><body>
<table>
  <tr>
    <td>Sl.No.</td><td>Course Code</td><td>Course Title</td><td>Slot</td>
    <td>Exam Date</td><td>Exam Time</td><td>Venue</td>
    <td>Seat Location</td><td>Seat No.</td>
  </tr>
  <tr><td colspan="9">CAT1</td></tr>
  <tr>
    <td>1</td><td>CSE1002</td><td>Object-Oriented Programming</td><td>A1+TA1</td>
    <td>12-Mar-2025</td><td>09:30 - 11:00</td><td>AB1-405</td>
    <td>Row 3</td><td>27</td>
  </tr>
  <tr>
    <td>2</td><td>MAT2002</td><td>Applications of Differential Equations</td><td>B2</td>
    <td>14-Mar-2025</td><td>14:00 - 15:30</td><td>AB2-210</td>
    <td>Row 1</td><td>8</td>
  </tr>
  <tr><td colspan="9">FAT</td></tr>
  <tr>
    <td>1</td><td>CSE1002</td><td>Object-Oriented Programming</td><td>A1+TA1</td>
    <td>28-May-2025</td><td>-</td><td>-</td>
    <td>-</td><td>-</td>
  </tr>
</table>
</body></html>
"""

EXAM_SCHEDULE_EMPTY = "<html><body><p>Record Not Found</p></body></html>"


# ---------------------------------------------------------------------------
# composed pages
# ---------------------------------------------------------------------------


def merge(*fixtures: str) -> str:
    """
    Splice several fixture bodies into one document.

    Used to reproduce the fact that ``processViewTimeTable`` returns the
    registered-course table and the timetable grid in a *single* response.
    Composing it from the existing fixtures means the merged page can never drift
    out of sync with the individual ones.
    """
    bodies = [
        page.split("<body>", 1)[1].rsplit("</body>", 1)[0] for page in fixtures
    ]
    return "<html><body>" + "".join(bodies) + "</body></html>"


# What VTOP actually sends back for processViewTimeTable.
TIMETABLE_PAGE = merge(COURSES, TIMETABLE)


# ---------------------------------------------------------------------------
# grade history (StudentGradeHistory)
# ---------------------------------------------------------------------------

GRADE_HISTORY = """
<html><body>
<table>
  <tr>
    <td>Credits Registered</td>
    <td>Credits Earned</td>
    <td>CGPA</td>
  </tr>
  <tr>
    <td>84.0</td>
    <td>84.0</td>
    <td>8.85</td>
  </tr>
</table>
</body></html>
"""

# ---------------------------------------------------------------------------
# semester grades (doStudentGradeView)
# ---------------------------------------------------------------------------

SEMESTER_GRADES = """
<html><body>
<table>
  <tr>
    <th>Course Code</th>
    <th>Course Title</th>
    <th>Credits</th>
    <th>Grade</th>
  </tr>
  <tr>
    <td>CSE1002</td>
    <td>Object-Oriented Programming</td>
    <td>4.0</td>
    <td>S</td>
  </tr>
  <tr>
    <td>MAT2002</td>
    <td>Applications of Differential Equations</td>
    <td>3.0</td>
    <td>A</td>
  </tr>
  <tr>
    <td colspan="4">GPA : 9.20</td>
  </tr>
</table>
</body></html>
"""

# ---------------------------------------------------------------------------
# payment receipts & dues (getReceiptsApplno & Payments)
# ---------------------------------------------------------------------------

RECEIPTS = """
<html><body>
<table>
  <tr>
    <th>Receipt No</th>
    <th>Receipt Date</th>
    <th>Amount</th>
    <th>Fee Description</th>
  </tr>
  <tr>
    <td>10098234</td>
    <td>15-Jul-2024</td>
    <td>198000.00</td>
    <td>Annual Tuition & Academic Fee 2024-25</td>
  </tr>
  <tr>
    <td>10098235</td>
    <td>15-Jul-2024</td>
    <td>45000.00</td>
    <td>Special Laboratory & Infrastructure Fee</td>
  </tr>
</table>
</body></html>
"""

PAYMENTS_NO_DUES = """
<html><body>
<div>No Payment Dues found for this student.</div>
</body></html>
"""

PAYMENTS_WITH_DUES = """
<html><body>
<table>
  <tr>
    <td>Particulars</td>
    <td>Due Amount</td>
  </tr>
  <tr>
    <td>Late Registration Fee</td>
    <td>1000.00</td>
  </tr>
</table>
</body></html>
"""

# ---------------------------------------------------------------------------
# proctor (viewProctorDetails)
# ---------------------------------------------------------------------------

PROCTOR = """
<html><body>
<div id="showDetails">
  <table>
    <tr>
      <td>Faculty Name</td>
      <td>DR. SURESH RAMAN</td>
    </tr>
    <tr>
      <td>Faculty Email</td>
      <td>suresh.raman@vit.ac.in</td>
    </tr>
    <tr>
      <td>Mobile Number</td>
      <td>9876543210</td>
    </tr>
    <tr>
      <td>Cabin Number</td>
      <td>AB1-502-A</td>
    </tr>
    <tr>
      <td>Designation</td>
      <td>Associate Professor Grade 2</td>
    </tr>
    <tr>
      <td>School</td>
      <td>School of Computer Science and Engineering</td>
    </tr>
  </table>
</div>
</body></html>
"""

# ---------------------------------------------------------------------------
# dean & hod (viewHodDeanDetails)
# ---------------------------------------------------------------------------

DEAN_HOD = """
<html><body>
<h3>Dean</h3>
<table>
  <tr>
    <td>Faculty Name</td>
    <td>DR. VAIDHYANATHAN M</td>
  </tr>
  <tr>
    <td>Email</td>
    <td>dean.scope@vit.ac.in</td>
  </tr>
  <tr>
    <td>Cabin</td>
    <td>AB1-601</td>
  </tr>
</table>
<h3>HOD</h3>
<table>
  <tr>
    <td>Faculty Name</td>
    <td>DR. MEENAKSHI S</td>
  </tr>
  <tr>
    <td>Email</td>
    <td>hod.cse@vit.ac.in</td>
  </tr>
  <tr>
    <td>Cabin</td>
    <td>AB1-602</td>
  </tr>
</table>
</body></html>
"""

# ---------------------------------------------------------------------------
# spotlight / announcements (home)
# ---------------------------------------------------------------------------

SPOTLIGHT = """
<html><body>
<div class="offcanvas">
  <div class="offcanvas-header">
    <span>Academics</span>
  </div>
  <div class="offcanvas-body">
    <ul>
      <li><a href="https://vtopcc.vit.ac.in/circulars/cat1.pdf">CAT-1 Schedule Announced for Fall 2024-25</a></li>
      <li>Registration for Special Supplementary Examinations is now open.</li>
    </ul>
  </div>
</div>
<div class="offcanvas">
  <div class="offcanvas-header">
    <span>Co-Curricular & Events</span>
  </div>
  <div class="offcanvas-body">
    <ul>
      <li><a onclick="window.open('https://vtopcc.vit.ac.in/events/techno.pdf')">TechnoVIT 2025 Call for Submissions</a></li>
    </ul>
  </div>
</div>
</body></html>
"""

# ---------------------------------------------------------------------------
# on-duty (OD)
# ---------------------------------------------------------------------------

OD_PAGE = """
<html><body>
<table>
  <tr>
    <th>Sl.No</th>
    <th>Date</th>
    <th>Course Code</th>
    <th>Course Title</th>
    <th>Slot</th>
    <th>Hours</th>
    <th>Reason</th>
    <th>Status</th>
    <th>Approved By</th>
  </tr>
  <tr>
    <td>1</td>
    <td>12-Oct-2024</td>
    <td>CSE1002</td>
    <td>Object-Oriented Programming</td>
    <td>A1</td>
    <td>2</td>
    <td>Smart India Hackathon 2024</td>
    <td>Approved</td>
    <td>DR. RAJESH KUMAR</td>
  </tr>
  <tr>
    <td>2</td>
    <td>20-Nov-2024</td>
    <td>MAT2002</td>
    <td>Differential Equations</td>
    <td>B2</td>
    <td>1</td>
    <td>IEEE Conference Presentation</td>
    <td>Approved</td>
    <td>DR. JEAN-PAUL MENON</td>
  </tr>
</table>
</body></html>
"""

OD_NO_RECORDS = """
<html><body>
<table>
  <tr><td>No record(s) found</td></tr>
</table>
</body></html>
"""

OD_PAGE_WITH_TIMES = """
<html><body>
<table>
  <tr>
    <th>S.No</th>
    <th>Date</th>
    <th>Start Time</th>
    <th>End Time</th>
    <th>Course Code</th>
    <th>Course Title</th>
    <th>Purpose</th>
    <th>Status</th>
    <th>Sanctioned Authority</th>
  </tr>
  <tr>
    <td>1</td>
    <td>15-Sep-2024</td>
    <td>08:00 AM</td>
    <td>11:00 AM</td>
    <td>CSE2001</td>
    <td>Computer Architecture</td>
    <td>ACM ICPC Regional Round</td>
    <td>Approved</td>
    <td>Dean SCSE</td>
  </tr>
  <tr>
    <td>2</td>
    <td>18-Oct-2024</td>
    <td>02:00 PM</td>
    <td>05:00 PM</td>
    <td>ECE1002</td>
    <td>Semiconductor Devices</td>
    <td>Robotics Workshop Demonstration</td>
    <td>Approved</td>
    <td>HOD SENSE</td>
  </tr>
</table>
</body></html>
"""

OD_PAGE_WITH_DAYS = """
<html><body>
<table>
  <tr>
    <th>Sl.No</th>
    <th>From Date</th>
    <th>To Date</th>
    <th>Days</th>
    <th>Course Code</th>
    <th>Reason</th>
    <th>Approval Status</th>
  </tr>
  <tr>
    <td>1</td>
    <td>10-Nov-2024</td>
    <td>11-Nov-2024</td>
    <td>2</td>
    <td>CSE3002</td>
    <td>National Hackathon Finals</td>
    <td>Approved</td>
  </tr>
</table>
</body></html>
"""

OD_PAGE_WITH_SLOTS = """
<html><body>
<table>
  <tr>
    <th>Sl.No</th>
    <th>Date</th>
    <th>Course</th>
    <th>Slot</th>
    <th>Reason</th>
    <th>Status</th>
  </tr>
  <tr>
    <td>1</td>
    <td>05-Dec-2024</td>
    <td>MAT2001</td>
    <td>A1+TA1</td>
    <td>Inter-University Debate Competition</td>
    <td>Approved</td>
  </tr>
  <tr>
    <td>2</td>
    <td>08-Dec-2024</td>
    <td>PHY1001</td>
    <td>L31+L32+L33</td>
    <td>Physics Lab Exhibition</td>
    <td>Approved</td>
  </tr>
</table>
</body></html>
"""

OD_PAGE_MIXED_STATUS = """
<html><body>
<table>
  <tr>
    <th>S.No</th>
    <th>Date</th>
    <th>Course</th>
    <th>Hours</th>
    <th>Reason</th>
    <th>Status</th>
  </tr>
  <tr>
    <td>1</td>
    <td>01-Oct-2024</td>
    <td>CSE1001</td>
    <td>3</td>
    <td>Technical Symposium</td>
    <td>Approved</td>
  </tr>
  <tr>
    <td>2</td>
    <td>05-Oct-2024</td>
    <td>CSE1002</td>
    <td>2</td>
    <td>Cultural Fest Auditions</td>
    <td>Pending</td>
  </tr>
  <tr>
    <td>3</td>
    <td>10-Oct-2024</td>
    <td>MAT1001</td>
    <td>4</td>
    <td>Personal Leave Request</td>
    <td>Rejected</td>
  </tr>
</table>
</body></html>
"""


