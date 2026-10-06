# CampusOS

## What This Is

CampusOS is a high-performance, modern university student operating system engineered for students at Vellore Institute of Technology (VIT). It replaces fragmented portal browsing by integrating live VTOP data, smart 75% attendance margin calculations, LMS and Teams coursework aggregation, placement readiness tracking, and AI study planning into a unified, responsive dashboard.

## Core Value

Authentic, zero-hallucination synchronization with live university portals that instantly equips students with accurate attendance margins, timetables, and academic records the moment they log in.

## Requirements

### Validated

- ✓ Live VTOP Scraping & OCR — Automated captcha solving with Tesseract, CSRF handling, and scrapers for profile, attendance, timetable, marks, and exams (`backend/app/vtop/`).
- ✓ Attendance Math Engine — Precise calculation of "Safe to miss $N$ classes" ($\ge 75\%$) and "Must attend $M$ classes" ($< 75\%$) without fabricated numbers (`backend/app/vtop/math_engine.py`).
- ✓ External Academic Integrations — Course assignment sync from VIT Moodle LMS and Microsoft Teams Graph API with fuzzy course code matching (`backend/app/routers/lms.py`, `backend/app/routers/teams.py`).
- ✓ Placement & Coding Hub — LeetCode GraphQL stats caching, contest rating tracking, and target company benchmark matching (`backend/app/routers/leetcode.py`).
- ✓ Responsive Bento UI — React 18 + TypeScript + Tailwind CSS interface featuring interactive timetable strips, modal diagnostics, and dark/light mode (`frontend/src/`).

### Active

- [ ] Clean Login-First Experience — Default unauthenticated state to a clean login/connect landing view; require university credentials before unlocking student dashboard.
- [ ] Automatic Real-Time VTOP Sync on Login — Instantly trigger an end-to-end sync across profile, attendance, timetable, marks, and exams as soon as student credentials and captcha resolve.
- [ ] Elimination of Fake/Mock Data — Purge misleading hardcoded mocks and synthetic profile data from the frontend views; display authentic synced values or graceful loading/unauthenticated states.
- [ ] Persistent Real Session State — Cache authentic VTOP profile and academic data in `localStorage` so returning users see their live data immediately, paired with a one-click "Sync VTOP" refresh action.
- [ ] End-to-End System Health Check — Run a complete diagnostic across FastAPI endpoints, CORS allowlists, route normalizers, and frontend service bindings to guarantee faultless operation.

### Out of Scope

- Modifying university portal state — VTOP, LMS, and Teams are read-only upstream services; CampusOS does not register courses or alter university records.
- Fabricating fallback numbers — If a portal module is unreachable or unallotted, CampusOS displays `None` / "Not available" rather than inventing plausible fake statistics.

## Context

- Brownfield codebase with 400 backend pytest tests passing cleanly and 20 frontend unit tests passing.
- Backend runs FastAPI with custom VIT SSL root certificates (`vit_ca_bundle.pem`) and BeautifulSoup4 HTML parsers.
- Previous frontend implementation relied heavily on a 4,500-line hardcoded mock dataset (`defaultData.ts`) which masked real VTOP sync behavior.
- Deployment targets: Render Docker container (`Dockerfile.backend`) and Vercel Serverless (`api/index.py`), with frontend deployed to static CDN.

## Constraints

- **Security**: Bound to `127.0.0.1:8000` locally to protect active student VTOP session cookies from shared campus Wi-Fi networks; raw student passwords are never persisted to disk.
- **Accuracy**: Attendance formulas must strictly follow the canonical university regulations ($75\%$ threshold).
- **Compatibility**: Must run seamlessly in both local execution (`run_backend.sh` + `npm run dev`) and production cloud environments (Render / Vercel).

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Login-first landing gate | Prevents confusion from viewing placeholder data before authenticating with real university credentials | — Pending |
| Persist real data in localStorage | Provides immediate dashboard responsiveness on page reloads with explicit "Sync VTOP" refresh control | — Pending |
| Zero mock data fallback in production | Ensures students never make attendance or exam decisions based on fabricated values | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-10-06 after initialization*
