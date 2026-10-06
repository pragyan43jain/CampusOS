---
last_mapped_commit: 89615b09b04b03530042eefc25834df71385d9d0
last_mapped_at: 2026-10-06
---
<!-- refreshed: 2026-10-06 -->

# Architecture

**Analysis Date:** 2026-10-06

## System Overview

```text
┌─────────────────────────────────────────────────────────────────────────┐
│                       Frontend UI Layer (React 18)                      │
├─────────────────────┬──────────────────────┬────────────────────────────┤
│   Views & Dashboards│   Interactive Modals │   UI Primitives & 3D       │
│ `frontend/src/views`│`frontend/src/compon.`│`frontend/src/components/ui`│
└──────────┬──────────┴──────────┬───────────┴─────────────┬──────────────┘
           │                     │                         │
           ▼                     ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Frontend Services & State Layer                      │
│ `frontend/src/services/api.ts`  |  `attendanceEngine.ts`                │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │ HTTP REST
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    Backend API Gateway (FastAPI 0.110)                  │
│ `backend/app/main.py` | `api/index.py` | Route Normalizer Middleware    │
├─────────────────────┬──────────────────────┬────────────────────────────┤
│   Auth & Sessions   │   Academics & Sync   │   Assignments & Coding     │
│ `routers/auth.py`   │`routers/academics.py`│ `routers/unified_assign.py`│
└──────────┬──────────┴──────────┬───────────┴─────────────┬──────────────┘
           │                     │                         │
           ▼                     ▼                         ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    VTOP Scraper & Normalization Engine                  │
│ `backend/app/vtop/session.py` (Custom SSL) | `ocr.py` (Tesseract)       │
│ `backend/app/vtop/parser.py` (BeautifulSoup4) | `math_engine.py`        │
│ `backend/app/course_verification.py` (Fuzzy Matcher)                    │
└────────────────────────────────────┬────────────────────────────────────┘
                                     │
                                     ▼
┌─────────────────────────────────────────────────────────────────────────┐
│                    External Providers & Storage Store                   │
│ VTOP (`vtopcc.vit.ac.in`) | LMS (`lms.vit.ac.in`) | MS Teams Graph     │
│ Supabase PostgreSQL       | Local JSON Store (`backend/data/store_*.json│
└─────────────────────────────────────────────────────────────────────────┘
```

## Component Responsibilities

| Component | Responsibility | File |
|-----------|----------------|------|
| `FastAPI Gateway` | Routes HTTP requests, handles CORS allowlist, and normalizes serverless query paths | `backend/app/main.py` |
| `VtopSession` | Manages live cookies, VIT root CA certificate verification, and CSRF tokens | `backend/app/vtop/session.py` |
| `Captcha Engine` | Preprocesses captcha images with PIL and solves text using Tesseract OCR | `backend/app/vtop/ocr.py` |
| `VTOP Parser` | Extracts structured data from raw HTML tables (attendance, marks, timetable) | `backend/app/vtop/parser.py` |
| `Math Engine` | Computes attendance margin equations (safe misses vs. required classes) | `backend/app/vtop/math_engine.py` |
| `Course Verifier`| Matches course codes and normalizes faculty names between VTOP, LMS, and Teams | `backend/app/course_verification.py` |
| `Storage Layer` | Persists and loads student data cache to local JSON files | `backend/app/storage.py` |
| `Unified Assignments` | Consolidates and sorts coursework across VTOP DA, LMS Moodle, and Teams | `backend/app/routers/unified_assignments.py` |
| `LeetCode Service` | Proxies LeetCode GraphQL stats, applies 15-min TTL cache, calculates readiness | `backend/app/routers/leetcode.py` |
| `Frontend API Client`| Dispatches fetch requests with session bearer tokens and error fallbacks | `frontend/src/services/api.ts` |
| `Attendance Engine` | Client-side calculations for hypothetical margin simulations and projections | `frontend/src/services/attendanceEngine.ts` |

## Pattern Overview

**Overall:** Modular Micro-Monorepo with Layered Service-Oriented Backend and Component-Driven Frontend

**Key Characteristics:**
- **Zero Hallucination / Evidence-Based:** Scraped university data is strictly validated against raw DOM structure; missing fields are reported as missing rather than synthesized (`backend/app/vtop/validator.py`).
- **Resilient Fallback Architecture:** Frontend initializes with local offline defaults (`frontend/src/services/defaultData.ts`) and updates seamlessly when live backend sync succeeds.
- **Stateless Gateway with Signed Tokens:** Backend issues HMAC SHA-256 signed session tokens representing student state, enabling secure API interactions without centralized session bloat (`backend/app/auth_crypto.py`).

## Layers

**Presentation Layer (Frontend):**
- Purpose: Student interface featuring modern dark/light bento grids, interactive timetable strips, and attendance calculators.
- Location: `frontend/src/views/`, `frontend/src/components/`
- Contains: React functional components, Framer Motion animations, Lucide icons, Recharts dashboards.
- Depends on: Frontend Services (`frontend/src/services/`)
- Used by: Student web browsers.

**API & Routing Layer (Backend):**
- Purpose: HTTP request routing, input validation, and route normalization.
- Location: `backend/app/routers/`, `backend/app/main.py`
- Contains: FastAPI APIRouters, Pydantic request models, Starlette exception handlers.
- Depends on: VTOP engine, Course Verification, Storage.
- Used by: Frontend client.

**Core Extraction & Domain Logic:**
- Purpose: University portal automation, captcha decoding, HTML parsing, and margin mathematics.
- Location: `backend/app/vtop/`, `backend/app/course_verification.py`
- Contains: Session handling, BeautifulSoup parsing, regex token extractors, math algorithms.
- Depends on: External university HTTP endpoints, Tesseract binary.
- Used by: Backend routers.

**Persistence & Caching Layer:**
- Purpose: Snapshot caching, analytics logging, and long-term storage.
- Location: `backend/app/storage.py`, `backend/app/supabase_client.py`
- Contains: File-based JSON read/write, Supabase client initialization.
- Depends on: Local disk filesystem, Supabase cloud API.
- Used by: Routers.

## Data Flow

### Primary Request Path (VTOP Sync & Attendance Retrieval)

1. User submits login credentials in `VtopLoginModal.tsx` (`frontend/src/components/VtopLoginModal.tsx:45`)
2. Request dispatched to `/api/auth/vtop/login` via `api.ts` (`frontend/src/services/api.ts:88`)
3. `auth.py` retrieves captcha, solves it via `ocr.py`, and posts to `vtopcc.vit.ac.in` (`backend/app/routers/auth.py:65`)
4. Scraper retrieves timetable, attendance, marks HTML via `session.py` (`backend/app/vtop/scraper.py:120`)
5. `parser.py` converts HTML tables into normalized dictionaries (`backend/app/vtop/parser.py:210`)
6. `math_engine.py` applies attendance formulas (`backend/app/vtop/math_engine.py:35`)
7. Data cached in `backend/data/store_{reg_no}.json` and returned to frontend as JSON payload.
8. Frontend stores state in React state and updates Dashboard metrics and cards.

### Secondary Flow: Unified Assignments Sync

1. Student opens Assignments view (`frontend/src/views/AssignmentsView.tsx`)
2. Frontend queries `GET /api/assignments/unified` (`frontend/src/services/api.ts:240`)
3. Backend fetches Digital Assignments from VTOP store, queries LMS Moodle via `lms.py`, and queries MS Teams via `teams.py`
4. `course_verification.py` pairs external coursework with student's official VTOP course list
5. Assignments are merged, assigned priority levels, deduplicated, and sorted by due date (`backend/app/routers/unified_assignments.py:90`)
6. Frontend displays unified card grid with countdown badges.

**State Management:**
- Frontend: Local component state (`useState`), `localStorage` / `sessionStorage` caching, and optimistic UI updates.
- Backend: Ephemeral in-memory session registry (`_ACTIVE_SESSIONS`) with disk-backed cache files (`store_{reg_no}.json`).

## Key Abstractions

**`VtopSession`:**
- Purpose: Encapsulates stateful university portal HTTP session with cookies, CSRF tokens, and custom CA certs.
- Examples: `backend/app/vtop/session.py`
- Pattern: Adapter / Session Facade.

**`VerifiedCourseRecord`:**
- Purpose: Normalized representation of an academic course reconciling conflicting VTOP, LMS, and Teams course names.
- Examples: `backend/app/course_verification.py`
- Pattern: Canonical Data Model.

**`AttendanceCalculations`:**
- Purpose: Pure functional math engine computing safe bunk limits and required recovery classes.
- Examples: `backend/app/vtop/math_engine.py`, `frontend/src/services/attendanceEngine.ts`
- Pattern: Domain Logic Service.

## Entry Points

**Backend Service:**
- Location: `backend/app/main.py`
- Triggers: Uvicorn ASGI server start (`run_backend.sh`)
- Responsibilities: Configures middleware, mounts routers, manages application lifecycle.

**Serverless API Proxy:**
- Location: `api/index.py`
- Triggers: Vercel serverless request routing (`vercel.json`)
- Responsibilities: Injects `backend/` into `sys.path` and forwards request to FastAPI `app`.

**Frontend SPA:**
- Location: `frontend/src/main.tsx`
- Triggers: Browser document load (`index.html`)
- Responsibilities: Mounts React root component into `#root` DOM node with global styles.

## Architectural Constraints

- **Threading:** Python backend uses standard async FastAPI event loop. Blocking I/O (VTOP scraping, Tesseract OCR) is run in worker threads or thread pools to avoid stalling the event loop.
- **Global state:** In-memory session registry `_ACTIVE_SESSIONS` (`backend/app/vtop/registry.py`) and LeetCode cache `_CACHE` (`backend/app/routers/leetcode.py`).
- **Circular imports:** Routers import from `app.storage` and `app.vtop.*`, while domain modules remain isolated without importing routers.
- **Network Isolation:** Backend binds to `127.0.0.1` by default in development to prevent exposing active student session cookies over local Wi-Fi.

## Anti-Patterns

### Fabricated Data Fallbacks

**What happens:** Fabricating plausible numbers (e.g., generating fake attendance % or mock marks) when scraping fails.
**Why it's wrong:** Students make real academic decisions (bunking class, exam prep) based on this data; fake data causes attendance shortages or debars.
**Do this instead:** Report missing data explicitly as `None` or flag a scrape error in `sync-report` (`backend/app/vtop/validator.py`).

### Storing Unencrypted Credentials

**What happens:** Writing student passwords to disk or logs.
**Why it's wrong:** Severe security and privacy vulnerability.
**Do this instead:** Discard passwords immediately after session establishment; store only short-lived signed tokens (`backend/app/auth_crypto.py`).

## Error Handling

**Strategy:** Fail-safe isolation per academic module. A failure in scraping exam dates should never break attendance or timetable rendering.

**Patterns:**
- Try/except blocks around each scraper module with fallback to cached disk snapshot.
- Starlette HTTPException handlers returning standard JSON responses `{ "detail": "...", "status_code": ... }`.
- Frontend graceful degradation using cached or default data if backend is unreachable.

## Cross-Cutting Concerns

**Logging:** Standard Python logging hierarchy (`campusos.*`, `vtop.*`) with timestamps and severity levels.
**Validation:** Pydantic models for incoming API payloads and strict regex pattern matchers for course codes and registration numbers.
**Authentication:** Signed HMAC tokens for API endpoints; multi-factor / captcha resolution for upstream portal authentication.

---

*Architecture analysis: 2026-10-06*
