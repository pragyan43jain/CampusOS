# Roadmap: CampusOS

## Overview

Restore complete end-to-end functionality to CampusOS: enforce an authentic login-first gateway, trigger automated VTOP synchronization immediately upon authentication, eliminate all fake/mock student data, persist verified student state in `localStorage` with a manual refresh control, and verify system reliability with end-to-end diagnostics.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3, 4): Planned milestone work
- Decimal phases: Urgent insertions

- [ ] **Phase 1: Authentication Gate & Session Persistence** - Gate dashboard behind login, handle VTOP authentication with captcha OCR, and persist session in `localStorage`.
- [ ] **Phase 2: Immediate Auto-Sync on Login & Refresh Pipeline** - Automatically trigger full VTOP sync upon login, show live sync progress, and provide manual "Sync VTOP" refresh.
- [ ] **Phase 3: Fake Data Purge & Authentic Data Rendering** - Remove hardcoded mock data, handle empty/missing states gracefully, and render real attendance margins and timetables.
- [ ] **Phase 4: Full System Diagnostic & Verification** - Comprehensive test execution, API route validation, CORS check, and end-to-end user flow verification.

## Phase Details

### Phase 1: Authentication Gate & Session Persistence
**Goal**: Gate application views behind authentic university authentication, ensure VTOP login with automated captcha OCR functions reliably, and persist student credentials/session in `localStorage`.
**Mode**: mvp
**Depends on**: Nothing (first phase)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, AUTH-04
**Success Criteria** (what must be TRUE):
  1. Unauthenticated users land on a clean login/connect screen; all dashboard views are inaccessible until authenticated.
  2. Submitting valid registration number, password, and campus selection solves captcha and logs into VTOP.
  3. Authenticated session token and student identity persist in `localStorage` across page reloads and tab restarts.
  4. Logging out flushes the cached session and immediately returns the student to the login screen.
**Plans**: 2 plans

Plans:
- [ ] 01-01: Implement clean landing/login gating in `frontend/src/App.tsx` and secure session token persistence in `localStorage`.
- [ ] 01-02: Validate and harden backend `/api/auth/vtop/login` captcha OCR flow and session verification endpoints.

### Phase 2: Immediate Auto-Sync on Login & Refresh Pipeline
**Goal**: Wire the login flow to trigger an immediate, automated VTOP sync of profile, timetable, attendance, marks, and exams, with real-time UI status and a manual refresh button.
**Mode**: mvp
**Depends on**: Phase 1
**Requirements**: SYNC-01, SYNC-02, SYNC-03
**Success Criteria** (what must be TRUE):
  1. Login success directly triggers an end-to-end VTOP sync without requiring additional clicks.
  2. UI displays real-time syncing indicator, last-synced timestamp, and graceful error alerts if the portal is slow.
  3. Header / sidebar provides a responsive "Sync VTOP" button that re-fetches live university data on demand.
**Plans**: 2 plans

Plans:
- [ ] 02-01: Connect frontend auth state to trigger automated full sync and surface sync indicators/timestamps.
- [ ] 02-02: Implement on-demand manual "Sync VTOP" refresh action and backend sync status reporting.

### Phase 3: Fake Data Purge & Authentic Data Rendering
**Goal**: Decouple the monolithic mock dataset (`defaultData.ts`) from active views, rendering authentic student VTOP records across Timetable, Attendance, Academics, and Dashboard with exact margin calculations and clean empty states for missing fields.
**Mode**: mvp
**Depends on**: Phase 2
**Requirements**: DATA-01, DATA-02, DATA-03
**Success Criteria** (what must be TRUE):
  1. All views (Dashboard, Academics, Timetable, Assignments) display live synced student data instead of hardcoded mock records.
  2. Unallotted or missing portal fields render clean empty placeholders (`--` or "Not available") without fabricating fictional numbers.
  3. Attendance cards display exact mathematical margins ($\ge 75\%$ safe misses vs. $< 75\%$ required classes) based on live records.
**Plans**: 2 plans

Plans:
- [ ] 03-01: Decouple mock constants from Dashboard and Academics views, replacing them with dynamic synced store bindings.
- [ ] 03-02: Enforce zero-hallucination empty states and verify live margin math in attendance and timetable slot cards.

### Phase 4: Full System Diagnostic & Verification
**Goal**: Perform complete system health check covering FastAPI backend routes, CORS policies, route normalization, frontend build integrity, and live user flow.
**Mode**: mvp
**Depends on**: Phase 3
**Requirements**: SYS-01, SYS-02
**Success Criteria** (what must be TRUE):
  1. Backend test suite (400 tests) and health check endpoint pass with zero errors.
  2. Frontend build completes with zero TypeScript or bundler errors (`npm run build`).
  3. Complete user workflow (landing -> login -> auto-sync -> dashboard data rendering -> manual refresh -> logout) is verified end-to-end.
**Plans**: 1 plan

Plans:
- [ ] 04-01: Run full automated backend/frontend test suite, execute route health audit, and verify E2E user workflow.

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Authentication Gate & Session Persistence | 0/2 | Not started | - |
| 2. Immediate Auto-Sync on Login & Refresh Pipeline | 0/2 | Not started | - |
| 3. Fake Data Purge & Authentic Data Rendering | 0/2 | Not started | - |
| 4. Full System Diagnostic & Verification | 0/1 | Not started | - |
