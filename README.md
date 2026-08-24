# CampusOS 🚀

CampusOS is a high-performance, modern university student operating system engineered for seamless academic tracking, smart attendance margin calculation, live VTOP/LMS/Teams aggregation, placement preparation, and AI-driven study planning.

---

## 🏗 System Architecture

```
VTOP (Chennai/Vellore/AP/Bhopal) ──┐
VIT Moodle LMS ────────────────────┼──> Python FastAPI Engine ──> Normalized Store ──> React + TypeScript (CampusOS)
Microsoft Teams ───────────────────┘       (Live OCR & Scraping)
```

> **Design Principle**: The frontend communicates cleanly with the CampusOS FastAPI Backend (`/api/*`), which directly interfaces with university portals like VTOP (`https://vtopcc.vit.ac.in/vtop/login`), handles session CSRF tokens, solves captchas using Tesseract OCR, parses academic modules, and normalizes student data.

---

## ✨ Core Modules & VTOP Sync Features

1. **VTOP Live Authentication & OCR Engine**:
   - Multi-campus support: VIT Chennai (`vtopcc.vit.ac.in`), VIT Vellore (`vtop.vit.ac.in`), VIT AP, and VIT Bhopal.
   - Real-time Captcha extraction and automatic AI OCR solving with Tesseract.
   - Synchronizes Profile, Cumulative CGPA, Enrolled Courses, Attendance Margins, Timetable Matrix, and Continuous Assessment Marks.

2. **Smart Attendance Engine**:
   - $\ge 75\%$: Computes exact **Safe to miss $N$ classes** using $\lfloor \frac{\text{Attended} - 0.75 \times \text{Total}}{0.75} \rfloor$.
   - $< 75\%$: Flags critical shortage and computes **Attend next $M$ classes** using $\lceil \frac{0.75 \times \text{Total} - \text{Attended}}{0.25} \rceil$.

3. **Normalized VTOP Timetable**:
   - Interactive Mon–Sat week strip selector.
   - Slot cards with room venue (e.g., AB-2 Room 304), faculty name, and attendance status.

4. **Academics & Continuous Assessment Breakdown**:
   - Detailed course breakdown with CAT-1, CAT-2, DA, Quiz scores, and FAT Grade S/A projections.

5. **Unified LMS & Teams Assignments**:
   - Coursework aggregator with priority badges and deadline countdowns.

6. **Fee Tracker & Official Receipts**:
   - Tuition, Hostel & Mess fee breakdown with receipt download simulators.

7. **Placements & DSA Tracker**:
   - Placement eligibility checker (CGPA $\ge 8.00$, 0 arrears) and LeetCode/GFG topic mastery.

8. **AI Study Planner**:
   - Automated priority engine targeting low attendance recovery and upcoming exam prep.

---

## 🚀 How to Run Locally

### 1. Start Backend (FastAPI + VTOP Sync Layer)
```bash
cd CampusOS/backend
pip install -r requirements.txt
python3 -m uvicorn app.main:app --host 127.0.0.1 --port 8000 --reload
```
*Or use the runner script:*
```bash
./run_backend.sh
```

> Bind to `127.0.0.1`, not `0.0.0.0`. The backend holds live VTOP session cookies
> and has no authentication of its own, so exposing it to the network would hand
> your portal session to anyone sharing the wifi.

### 2. Start Frontend (Vite + React + TypeScript)
```bash
cd CampusOS/frontend
npm install
npm run dev
```
Open `http://localhost:5173` in your browser.

---

## ✅ Verifying the VTOP sync

Three layers, cheapest first.

**Parser and pipeline tests** run against saved copies of VTOP's HTML, so they
prove the parsers read that markup correctly. They need nothing but
BeautifulSoup:

```bash
cd CampusOS/backend
python3 tests/run_without_pytest.py     # 163 checks, stdlib only
```

**Route tests** additionally need FastAPI and pytest:

```bash
python3 -m pytest tests/ -q
```

**The live check** is the only one that proves the real portal still behaves the
way the fixtures say it does. Run it by hand:

```bash
python3 smoke_test.py
```

It prompts for your registration number and password (read without echo, used
once, never written to disk), shows the captcha as an image with the OCR guess
pre-filled, then scrapes every module and prints a status table — `ok`, `empty`,
`failed`, or `unavailable` per module — plus the course-binding report and one
sample record each. It does **not** touch your saved data unless you pass
`--save`.

When VTOP changes its markup, a module will flip to `failed` or `empty` and the
script dumps the raw HTML it received, which is what you diff against
`tests/fixtures/vtop_pages.py` to repair the parser.

```bash
python3 smoke_test.py --dump ./vtop-html   # keep every raw response
python3 smoke_test.py --semester CH20242501 --json payload.json
```

### ⚠️ Your synced data is personal — don't commit it

After a successful sync, `backend/data/store.json` contains your name,
registration number, VIT email, CGPA, per-course attendance and your exam seat
allocations. The `--dump` directory holds the raw HTML of your logged-in session.
This repository is public, so `.gitignore` excludes `backend/data/`,
`.backend.log`, `*.old`, `vtop_dump*/` and `.env*`. Before your first push:

```bash
git status --short          # store.json must not appear
git check-ignore -v backend/data/store.json
```

Signing out (`POST /api/vtop/logout`) deletes that file, and overwrites it with
an empty store if the delete is refused — a logout that only *reports* success
would leave your record readable to the next person on the machine.

**Missing data is reported as missing.** `GET /api/vtop/sync-report` and
`GET /api/features` say, per module, whether the value is absent because VTOP had
nothing to give or because the fetch failed. Nothing in the backend substitutes a
plausible-looking value for a real one.
