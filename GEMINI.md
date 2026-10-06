<!-- GSD:project-start source:PROJECT.md -->

## Project

**CampusOS**

CampusOS is a high-performance, modern university student operating system engineered for students at Vellore Institute of Technology (VIT). It replaces fragmented portal browsing by integrating live VTOP data, smart 75% attendance margin calculations, LMS and Teams coursework aggregation, placement readiness tracking, and AI study planning into a unified, responsive dashboard.

**Core Value:** Authentic, zero-hallucination synchronization with live university portals that instantly equips students with accurate attendance margins, timetables, and academic records the moment they log in.

### Constraints

- **Security**: Bound to `127.0.0.1:8000` locally to protect active student VTOP session cookies from shared campus Wi-Fi networks; raw student passwords are never persisted to disk.
- **Accuracy**: Attendance formulas must strictly follow the canonical university regulations ($75\%$ threshold).
- **Compatibility**: Must run seamlessly in both local execution (`run_backend.sh` + `npm run dev`) and production cloud environments (Render / Vercel).

<!-- GSD:project-end -->

<!-- GSD:stack-start source:codebase/STACK.md -->

## Technology Stack

## Languages

- TypeScript 5.4.5 - Frontend user interface, state management, API services (`frontend/src/`)
- Python 3.11+ / 3.14 (compatible) - Backend API, web scraping, OCR, attendance calculations (`backend/app/`, `api/index.py`)
- JavaScript (ES Modules / Node.js) - Root tooling, Netlify serverless wrapper (`netlify/functions/api.js`)
- SQL (PostgreSQL / Supabase) - Database schema migrations, RLS security policies (`supabase/migrations/`)
- CSS3 / Tailwind CSS 3.4.19 - Utility-first UI styling and custom design tokens (`frontend/src/index.css`, `frontend/tailwind.config.js`)
- HTML5 - Single page application host (`frontend/index.html`)

## Runtime

- Node.js v20+ / v24.20.0 (development & build)
- Python 3.11-slim (Docker container production runtime) / Python 3.14 (local development)
- npm (Node.js) - Frontend dependencies
- pip (Python) - Backend dependencies

## Frameworks

- FastAPI 0.110.0+ - High-performance Python backend REST API framework (`backend/app/main.py`)
- React 18.3.1 - Frontend UI library with functional components and hooks (`frontend/src/App.tsx`)
- Vite 5.3.4 - Modern frontend build tool, dev server, and module bundler (`frontend/vite.config.ts`)
- pytest 8.0+ - Python backend test runner with fixtures and mock requests (`backend/tests/`)
- node:test (Node.js Native Test Runner) - Frontend utility unit tests (`frontend/src/utils/*.test.ts`)
- Uvicorn 0.28.0+ - ASGI web server for FastAPI execution (`run_backend.sh`)
- Tailwind CSS 3.4.19 with Autoprefixer and PostCSS - Utility-first styling pipeline (`frontend/postcss.config.js`)
- Docker - Containerized backend deployment runtime (`Dockerfile.backend`)

## Key Dependencies

- `beautifulsoup4` (>=4.12.0) - HTML parsing for university portals (VTOP, LMS Moodle) (`backend/app/vtop/parser.py`, `backend/app/routers/lms.py`)
- `pytesseract` (>=0.3.10) & `pillow` (>=10.0.0) - Tesseract OCR image preprocessing and captcha solving (`backend/app/vtop/ocr.py`)
- `requests` (>=2.31.0) & `urllib3` (>=2.0.0) - Stateful HTTP sessions with custom SSL CA certificate support for VTOP (`backend/app/vtop/session.py`)
- `pydantic` (>=2.6.0) - Request/response schema validation and data models (`backend/app/vtop/models.py`)
- `framer-motion` (^13.1.1) - Declarative fluid animations across cards, modals, and navigation (`frontend/src/components/`)
- `lucide-react` (^1.34.0) - Icon library for dashboard navigation and status indicators (`frontend/src/components/`)
- `recharts` (^3.10.1) - Responsive data visualization for attendance, grades, and marks (`frontend/src/views/`)
- `@supabase/supabase-js` (^2.116.0) & `supabase` (Python client) - PostgreSQL integration and real-time client (`frontend/src/services/supabaseClient.ts`, `backend/app/supabase_client.py`)
- `three` (^0.185.1) & `@splinetool/react-spline` (^4.1.0) - 3D canvas rendering and interactive hero visualizer (`frontend/src/components/RobotCanvas.tsx`, `frontend/src/components/ui/splite.tsx`)
- `tailwind-merge` (^3.7.0) & `clsx` (^2.1.1) - Safe Tailwind class composition utility (`frontend/src/lib/utils.ts`)
- `@radix-ui/react-slot` (^1.3.3) - Composable UI primitive for slot patterns (`frontend/src/components/ui/`)

## Configuration

- Configured via environment variables loaded via runtime or `.env` file (`.env.example` provides canonical blueprint)
- Key variables required:
- Frontend: `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/tailwind.config.js`
- Root monorepo orchestration: `package.json` (`npm run build` runs frontend build and syncs to `dist/`)
- Vercel: `vercel.json` rewrites `/api/(.*)` to `/api/index.py` and SPA routes to `index.html`
- Render: `render.yaml` defines Docker service specs and Singapore region deployment
- Netlify: `netlify.toml` with `dist` publish directory and redirect rules

## Platform Requirements

- Node.js 18+ and npm 9+
- Python 3.10+ (Python 3.11 recommended for tesseract-ocr binary parity)
- System package `tesseract-ocr` (optional locally; OCR has fallback heuristics or mock fallbacks)
- Local network: default binds to `127.0.0.1:8000` (backend) and `localhost:5173` (frontend)
- Backend: Docker on Render (`Dockerfile.backend`) with Debian `tesseract-ocr` and `libtesseract-dev` installed, or Vercel Serverless Python function (`api/index.py`)
- Frontend: Static CDN hosting on Vercel or Netlify (`dist/`)
- Database: Supabase managed PostgreSQL

<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->

## Conventions

## Naming Patterns

- React components and views: PascalCase (`VtopLoginModal.tsx`, `DashboardView.tsx`)
- TypeScript utilities and services: camelCase (`attendanceEngine.ts`, `assignmentSorting.ts`)
- TypeScript test files: `*.test.ts` (`greeting.test.ts`)
- Python modules and packages: snake_case (`math_engine.py`, `course_verification.py`)
- Python test files: `test_*.py` (`test_vtop_parser.py`, `test_math_engine.py`)
- TypeScript: camelCase (`calculateAttendanceStats`, `formatRelativeDueDate`, `getPeriodGreeting`)
- React components: PascalCase (`TimetableSlotCard`, `MetricCard`)
- Python: snake_case (`compute_safe_misses`, `parse_attendance`, `resolve_student_reg`)
- TypeScript: camelCase (`selectedDay`, `activeSemester`, `studentProfile`)
- Python: snake_case (`session_id`, `current_reg`, `student_store`)
- Constants: UPPER_SNAKE_CASE (`CACHE_TTL_SECONDS`, `BASE_URL`, `COMPANY_BENCHMARKS`, `ALLOWED_ORIGINS`)
- TypeScript interfaces and types: PascalCase (`Student`, `CourseRecord`, `AttendanceStats`, `DayOfWeek`)
- Python Pydantic models: PascalCase (`StudentCredentials`, `SyncReport`, `VerifiedCourseRecord`)

## Code Style

- TypeScript/React: 2-space indentation, semicolons enabled, double or single quotes consistently applied.
- Python: PEP 8 compliant, 4-space indentation, `black`/`ruff` style conventions.
- TypeScript: TypeScript strict compiler checks (`tsc --noEmit` in `frontend/package.json` build step).
- Python: Pydantic v2 strict type validation on API inputs, standard type hints with `typing`.

## Import Organization

- Standard relative imports (`../../`, `./`) used across frontend components and backend modules.

## Error Handling

- Backend:
- Frontend:

## Logging

- Backend: Python standard library `logging.getLogger("campusos.*")` with structured log format:
- Frontend: `console.warn` / `console.error` for failed API calls and fallback activations.
- Log info on incoming auth attempts (hiding passwords), sync completions, and OCR solver timings.
- Log warnings on malformed university portal HTML or missing table headers.

## Comments

- Explain non-obvious scraping edge cases (e.g., VTOP session CSRF extraction, dynamic token cookies).
- Document mathematical derivations for attendance margin formulas ($\ge 75\%$ vs $< 75\%$).
- Architecture notes at the top of router and parser files explaining module intent.
- Used for complex calculation utilities and public API client functions in `frontend/src/services/`.

## Function Design

- Single responsibility functions. Complex HTML parsing is broken into granular helper functions per section (`parse_attendance`, `parse_timetable_grid`, `parse_marks`).
- Python: Explicit type annotations on all function parameters (`def parse_attendance(html: str) -> List[Dict[str, Any]]:`).
- TypeScript: Typed props interfaces for React components (`interface TimetableSlotCardProps { slot: Slot; day: DayOfWeek; }`).
- Strongly typed returns. Missing values default to `None` (Python) or `null` / `undefined` (TypeScript).

## Module Design

- React components use default exports or named exports.
- Services and utilities use named exports (`export const fetchStudentData = ...`).
- Python modules expose clear public functions and classes, with internal helpers prefixed with `_`.
- Centralized types exported via `frontend/src/types/index.ts`.
- Component-level barrel files are avoided in favor of direct component imports to optimize tree-shaking.

<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->

## Architecture

## System Overview

```text

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

- **Zero Hallucination / Evidence-Based:** Scraped university data is strictly validated against raw DOM structure; missing fields are reported as missing rather than synthesized (`backend/app/vtop/validator.py`).
- **Resilient Fallback Architecture:** Frontend initializes with local offline defaults (`frontend/src/services/defaultData.ts`) and updates seamlessly when live backend sync succeeds.
- **Stateless Gateway with Signed Tokens:** Backend issues HMAC SHA-256 signed session tokens representing student state, enabling secure API interactions without centralized session bloat (`backend/app/auth_crypto.py`).

## Layers

- Purpose: Student interface featuring modern dark/light bento grids, interactive timetable strips, and attendance calculators.
- Location: `frontend/src/views/`, `frontend/src/components/`
- Contains: React functional components, Framer Motion animations, Lucide icons, Recharts dashboards.
- Depends on: Frontend Services (`frontend/src/services/`)
- Used by: Student web browsers.
- Purpose: HTTP request routing, input validation, and route normalization.
- Location: `backend/app/routers/`, `backend/app/main.py`
- Contains: FastAPI APIRouters, Pydantic request models, Starlette exception handlers.
- Depends on: VTOP engine, Course Verification, Storage.
- Used by: Frontend client.
- Purpose: University portal automation, captcha decoding, HTML parsing, and margin mathematics.
- Location: `backend/app/vtop/`, `backend/app/course_verification.py`
- Contains: Session handling, BeautifulSoup parsing, regex token extractors, math algorithms.
- Depends on: External university HTTP endpoints, Tesseract binary.
- Used by: Backend routers.
- Purpose: Snapshot caching, analytics logging, and long-term storage.
- Location: `backend/app/storage.py`, `backend/app/supabase_client.py`
- Contains: File-based JSON read/write, Supabase client initialization.
- Depends on: Local disk filesystem, Supabase cloud API.
- Used by: Routers.

## Data Flow

### Primary Request Path (VTOP Sync & Attendance Retrieval)

### Secondary Flow: Unified Assignments Sync

- Frontend: Local component state (`useState`), `localStorage` / `sessionStorage` caching, and optimistic UI updates.
- Backend: Ephemeral in-memory session registry (`_ACTIVE_SESSIONS`) with disk-backed cache files (`store_{reg_no}.json`).

## Key Abstractions

- Purpose: Encapsulates stateful university portal HTTP session with cookies, CSRF tokens, and custom CA certs.
- Examples: `backend/app/vtop/session.py`
- Pattern: Adapter / Session Facade.
- Purpose: Normalized representation of an academic course reconciling conflicting VTOP, LMS, and Teams course names.
- Examples: `backend/app/course_verification.py`
- Pattern: Canonical Data Model.
- Purpose: Pure functional math engine computing safe bunk limits and required recovery classes.
- Examples: `backend/app/vtop/math_engine.py`, `frontend/src/services/attendanceEngine.ts`
- Pattern: Domain Logic Service.

## Entry Points

- Location: `backend/app/main.py`
- Triggers: Uvicorn ASGI server start (`run_backend.sh`)
- Responsibilities: Configures middleware, mounts routers, manages application lifecycle.
- Location: `api/index.py`
- Triggers: Vercel serverless request routing (`vercel.json`)
- Responsibilities: Injects `backend/` into `sys.path` and forwards request to FastAPI `app`.
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

### Storing Unencrypted Credentials

## Error Handling

- Try/except blocks around each scraper module with fallback to cached disk snapshot.
- Starlette HTTPException handlers returning standard JSON responses `{ "detail": "...", "status_code": ... }`.
- Frontend graceful degradation using cached or default data if backend is unreachable.

## Cross-Cutting Concerns

<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->

## Project Skills

No project skills found. Add skills to any of: `.agents/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->

## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-fast` for a trivial task inline, with no subagents and no PLAN.md
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->

<!-- GSD:profile-start -->

## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
