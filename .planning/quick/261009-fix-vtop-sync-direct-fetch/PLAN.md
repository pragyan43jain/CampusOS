# Quick Task: Fix Direct VTOP Sync & Sequential Scrape Without Hardcoding

## Objective
Ensure student data is authentically fetched and synchronized directly from VTOP (vtopcc.vit.ac.in) without any hardcoded data or fallbacks, fixing the session-dropping CSRF collisions and captcha case alterations that prevented live data from being synced.

## Root Cause Analysis
1. **Parallel Request Race Conditions in `scraper.sync`**:
   Commit `d31adf4` used `ThreadPoolExecutor(max_workers=8)` across 12 endpoints using a single `VTOPSession`. VTOP CC (Apache Tomcat / Spring Security) rotates the `_csrf` token on each request. Parallel requests sent the same stale CSRF token simultaneously; VTOP rejected them with 403 / redirect to login, triggering `_check_authenticated_response` to raise `VTOPAuthError` ("Your VTOP session has expired"), which dropped the session and aborted the sync.
2. **Forced Captcha Uppercasing**:
   In `backend/app/vtop/session.py`, `clean_captcha = (captcha or "").strip().upper()` forced all captchas to uppercase. Captchas containing lowercase characters were altered and rejected by VTOP with "Incorrect captcha".
3. **Empty Semester Dropdown Skips All Scrapes**:
   In `scraper.py`, `choose_semester` returned `None` if `semesters` was empty, ignoring requested semester IDs and skipping timetable, courses, attendance, marks, and exams completely.
4. **Missing Fallbacks in `fetch_semesters`**:
   Only checked `SEMESTER_LIST` (`StudentTimeTableChn`). If that single page didn't load, no alternative semester dropdowns were probed.
5. **Missing `Authorization` Header Handling**:
   Several GET endpoints in `auth.py` and `academics.py` omitted `authorization: Optional[str] = Header(None)`, which could lead to unauthenticated empty stores when session tokens are passed in `Authorization`.

## Implementation Tasks
1. **`backend/app/vtop/session.py`**:
   - Preserve exact captcha case: `clean_captcha = (captcha or "").strip()`.
   - Ensure thread-safe locking in `_get` and `_post`.
   - Refine cookie serialization and restoration.
2. **`backend/app/vtop/scraper.py`**:
   - Restore safe sequential scraping with fresh CSRF token for each module:
     1) Semesters & robust fallback selection
     2) Profile
     3) Grade history (CGPA + credits)
     4) Timetable page (`courses` + `timetableGrid` from single request)
     5) Attendance page (`processViewStudentAttendance`)
     6) Marks page (`examinations/doStudentMarkView`)
     7) Exam schedule (`examinations/doSearchExamScheduleForStudent`)
     8) Semester grades (`examinations/examGradeView/doStudentGradeView`)
     9) Proctor details (`proctor/viewProctorDetails`)
     10) Receipts & payments
     11) OD hours and records
     12) Spotlight and hostel info
   - Update `choose_semester` to use requested semester when provided, falling back to first dropdown or None.
   - Update `fetch_semesters` to probe alternative semester menu endpoints if `StudentTimeTableChn` is empty.
   - Remove parallel workers from attendance row details; run sequentially and handle exceptions gracefully.
3. **`backend/app/vtop/client.py`**:
   - Handle partial sync gracefully without dropping authenticated session when semester dropdown is empty if courses were retrieved.
4. **`backend/app/routers/auth.py` & `backend/app/routers/academics.py`**:
   - Accept `authorization: Optional[str] = Header(None)` on all GET routes and pass to `resolve_student_reg`.
5. **Frontend State & Verification**:
   - Verified frontend immediately renders authentic live VTOP payload.
   - Ran full test suites:
     - Python backend: `pytest backend/tests/` passed 405/405 tests.
     - Frontend unit tests: `npm --prefix frontend test` passed 20/20 tests.
     - Production bundle: `npm --prefix frontend run build` compiled cleanly.
     - Live portal handshake: `client_manager.issue_captcha()` verified against `vtopcc.vit.ac.in` in ~1s.

## Verdict
Status: Complete. VTOP synchronization executes sequentially, safely managing Spring Security CSRF tokens, maintaining zero mock/hardcoded data, and ensuring live student data flows directly from the university portal to the student dashboard.
