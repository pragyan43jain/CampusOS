# Quick Task Plan: Fix Sequential VTOP Scraping, Captcha Exact Case, and Instant Fresh Sync Rendering

## Objective
Prevent VTOP session drops caused by concurrent CSRF collisions in ThreadPoolExecutor, ensure single-attempt CAPTCHA login by preserving exact character case, and guarantee the UI immediately receives and displays fresh VTOP data upon login and sync.

## Root Cause Analysis
1. **Concurrent CSRF Collisions in `scraper.sync`**:
   VTOP CC uses Spring Security with rotating session CSRF tokens. Submitting 13 parallel requests to `ThreadPoolExecutor(max_workers=8)` using the same `VTOPSession` causes concurrent requests to send stale CSRF tokens. VTOP server detects CSRF mismatch and redirects to `/vtop/login`. The scraper encounters the login page, triggers `_check_authenticated_response`, raises `VTOPAuthError` (code 111), drops the newly created session, and aborts the sync. As a result, fresh data was never saved to disk, leaving outdated September 29 data in `store_{reg}.json`.
2. **Forced Uppercase in `session.login`**:
   In `backend/app/vtop/session.py`, `clean_captcha = (captcha or "").strip().upper()` converts all captchas to uppercase. Captchas containing lowercase characters (e.g., `jT68YZ`) were converted to `JT68YZ`, causing VTOP to reject the input with "Invalid CAPTCHA entered" even when the user entered the correct characters.
3. **Redundant Handshake in `fetch_captcha`**:
   In `fetch_captcha`, a fallback called `self._get(C.LOGIN_PAGE)` which fetched a new login page and updated `self.csrf` without updating the cached captcha image, creating an out-of-sync pair.
4. **UI Fresh Data Application**:
   When `handleLoginSuccess` and `handleHeaderSync` received fresh data in `frontend/src/App.tsx`, calling `loadAllData()` afterwards risked re-fetching stale disk store before write operations settled. Fresh data from `vtopResult.data` must be directly rendered and preserved in React state.

## Tasks
1. **`backend/app/vtop/session.py`**:
   - Preserve exact case in `clean_captcha = (captcha or "").strip()`.
   - Prevent redundant GET in `fetch_captcha()` that overwrites CSRF token.
   - Wrap `_post` and `_absorb` with thread-safe lock to protect rotating CSRF and session cookies.
2. **`backend/app/vtop/scraper.py`**:
   - Replace concurrent `ThreadPoolExecutor` calls in `sync()` with safe sequential fetching:
     1) Semesters & semester selection
     2) Profile
     3) Timetable page (`courses` + `timetableGrid`)
     4) Attendance page (`attendance_rows`)
     5) Marks page (`marks_rows`)
     6) Exam page (`exams`)
     7) Grade history (`gradeHistory`)
     8) Semester grades (`semesterGrades`)
     9) Receipts & payments
     10) Academic calendar & spotlight
   - Replace parallel attendance row detail fetching with safe sequential fetching that never aborts main sync on optional drill-down errors.
3. **`frontend/src/App.tsx`**:
   - In `handleLoginSuccess`: Apply `d` directly to state, store in `localStorage`, update `CampusAPI.setActiveStudent(studentObj)`, and ensure the dashboard immediately reflects the fresh data.
   - In `handleHeaderSync`: Validate `vtopResult.success`; if false, trigger login modal with notice; if true, apply fresh `vtopResult.data` directly to all React states.
4. **Verification**:
   - Run backend test suite (`pytest backend/tests/`).
   - Run frontend unit tests (`npm --prefix frontend test`).
   - Run frontend production build (`npm --prefix frontend run build`).
