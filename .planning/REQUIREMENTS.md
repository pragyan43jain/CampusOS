# Requirements: CampusOS

**Defined:** 2026-10-06  
**Core Value:** Authentic, zero-hallucination synchronization with live university portals that instantly equips students with accurate attendance margins, timetables, and academic records the moment they log in.

## v1 Requirements

### Authentication & Session

- [ ] **AUTH-01**: User lands on an unauthenticated landing/login screen by default; dashboard views are gated behind student login.
- [ ] **AUTH-02**: User can authenticate with registration number, password, and campus selection with automated captcha resolution.
- [ ] **AUTH-03**: User session token and real synced profile data persist in `localStorage` across page refreshes and browser tab restarts.
- [ ] **AUTH-04**: User can log out, clearing active session tokens, local cache, and returning to the landing view.

### VTOP Sync & Data Pipeline

- [ ] **SYNC-01**: Successful login immediately and automatically triggers an end-to-end sync across profile, attendance, timetable, marks, and exams.
- [ ] **SYNC-02**: User can trigger an on-demand "Sync VTOP" refresh button from the dashboard to re-query the university portal.
- [ ] **SYNC-03**: Dashboard displays clear real-time sync status indicators (syncing spinner, error messages, and last-synced timestamp).

### Data Integrity & Mock Removal

- [ ] **DATA-01**: Hardcoded fake student profiles and static test data (`defaultData.ts`) are decoupled from primary views so only authentic synced data renders.
- [ ] **DATA-02**: Unallotted or missing portal fields render clean empty/fallback states (`--` or "Not available") without fabricating fictional numbers.
- [ ] **DATA-03**: Timetable slots, course marks, and attendance stats compute real margins based strictly on live university records.

### System Health & Diagnostics

- [ ] **SYS-01**: Backend API health check endpoint and test suite pass completely, ensuring route normalization, CORS allowlists, and error handling are robust.
- [ ] **SYS-02**: Frontend build and runtime checks confirm error-free component rendering, clean network requests, and zero uncaught runtime exceptions.

## v2 Requirements

### Push Notifications & Alerts

- **NOTF-01**: Browser push notifications for upcoming classes and critical attendance warnings (<75%).
- **NOTF-02**: Automated alerts when new Continuous Assessment test marks or FAT exam grades are uploaded to VTOP.

### Offline Mode & Export

- **OFFL-01**: Offline timetable view using service worker caching.
- **OFFL-02**: Export timetable to `.ics` calendar format.

## Out of Scope

| Feature | Reason |
|---------|--------|
| Modifying university portal data | VTOP, LMS, and Teams are read-only upstream university portals. |
| Fabricating missing marks or attendance | Strict zero-hallucination principle; real student decisions depend on authentic data. |
| Automatic grade recalculation tampering | Grades and CGPA projections follow official VIT university credit rules only. |

## Traceability

| Requirement | Phase | Status |
|-------------|-------|--------|
| AUTH-01 | Phase 1 | Pending |
| AUTH-02 | Phase 1 | Pending |
| AUTH-03 | Phase 1 | Pending |
| AUTH-04 | Phase 1 | Pending |
| SYNC-01 | Phase 2 | Pending |
| SYNC-02 | Phase 2 | Pending |
| SYNC-03 | Phase 2 | Pending |
| DATA-01 | Phase 3 | Pending |
| DATA-02 | Phase 3 | Pending |
| DATA-03 | Phase 3 | Pending |
| SYS-01 | Phase 4 | Pending |
| SYS-02 | Phase 4 | Pending |

**Coverage:**
- v1 requirements: 12 total
- Mapped to phases: 12
- Unmapped: 0 ✓

---
*Requirements defined: 2026-10-06*  
*Last updated: 2026-10-06 after initial definition*
