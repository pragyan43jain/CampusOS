---
last_mapped_commit: 89615b09b04b03530042eefc25834df71385d9d0
last_mapped_at: 2026-10-06
---
# Codebase Structure

**Analysis Date:** 2026-10-06

## Directory Layout

```
CampusOS/
├── .planning/                  # Project management, roadmap, and codebase intelligence
│   └── codebase/               # 7 structural codebase analysis documents
├── api/                        # Serverless bridge for Vercel Python runtime
│   └── index.py                # Imports and routes requests to backend FastAPI app
├── backend/                    # Python FastAPI application and scraping engine
│   ├── app/                    # Core backend application code
│   │   ├── routers/            # FastAPI route handlers (auth, academics, leetcode, etc.)
│   │   ├── vtop/               # VTOP portal scraping, OCR, parsers, and math engine
│   │   ├── seed/               # Default student seed data JSON
│   │   ├── auth_crypto.py      # Session token signing and verification
│   │   ├── course_verification.py # Cross-portal course and faculty matching
│   │   ├── main.py             # FastAPI app factory, CORS, and middleware
│   │   ├── storage.py          # Local JSON file storage utilities
│   │   └── supabase_client.py  # Supabase client singleton
│   ├── data/                   # Runtime data cache, login telemetry, analytics events
│   ├── tests/                  # Backend pytest suite and HTML fixtures
│   │   ├── fixtures/           # Saved VTOP HTML fixtures for deterministic testing
│   │   └── run_without_pytest.py # Minimal test runner for stdlib environments
│   └── requirements.txt        # Backend Python dependency definitions
├── frontend/                   # React + TypeScript Vite frontend SPA
│   ├── public/                 # Static assets, manifests, icons, calendar/mess data
│   ├── src/                    # Frontend source code
│   │   ├── assets/             # Bundled image and visual assets
│   │   ├── components/         # Reusable React components and modals
│   │   │   └── ui/             # Generic UI primitives (bento grid, spotlight, cards)
│   │   ├── hooks/              # Custom React hooks (e.g., useLockBodyScroll)
│   │   ├── lib/                # Utility helpers (clsx, tailwind-merge)
│   │   ├── services/           # API clients, attendance engine, default data
│   │   ├── types/              # TypeScript interface and type declarations
│   │   ├── utils/              # Pure utility functions and unit tests
│   │   ├── views/              # Full-page dashboard views and landing page
│   │   ├── App.tsx             # Main view router and application root
│   │   ├── index.css           # Global Tailwind and font styles
│   │   └── main.tsx            # React DOM mounting entry point
│   ├── package.json            # Frontend npm package dependencies
│   ├── tailwind.config.js      # Tailwind CSS configuration
│   └── vite.config.ts          # Vite build and dev server configuration
├── netlify/                    # Netlify deployment configuration and functions
├── supabase/                   # Supabase migrations, configurations, and edge functions
│   └── migrations/             # SQL schema definitions and RLS security policies
├── Dockerfile.backend          # Container definition for Render deployment
├── render.yaml                 # Render cloud deployment blueprint
├── vercel.json                 # Vercel routing rules and Python serverless configuration
├── package.json                # Monorepo root npm orchestration script
└── run_backend.sh              # Local development launcher for FastAPI
```

## Directory Purposes

**`backend/app/routers/`:**
- Purpose: Exposes HTTP endpoints for frontend consumption.
- Contains: FastAPI router modules categorized by functional domain.
- Key files: `auth.py`, `academics.py`, `unified_assignments.py`, `leetcode.py`, `analytics.py`.

**`backend/app/vtop/`:**
- Purpose: Encapsulates all interactions with the university portal.
- Contains: HTTP session managers, captcha OCR resolvers, HTML table parsers, and attendance math algorithms.
- Key files: `session.py`, `scraper.py`, `parser.py`, `ocr.py`, `math_engine.py`.

**`backend/tests/`:**
- Purpose: Validates backend routes, parsers, and security controls.
- Contains: Pytest test cases and saved HTML fixture pages.
- Key files: `test_vtop_parser.py`, `test_math_engine.py`, `test_security_auth.py`, `fixtures/vtop_pages.py`.

**`frontend/src/views/`:**
- Purpose: Primary application views switchable via sidebar navigation.
- Contains: High-level view components.
- Key files: `DashboardView.tsx`, `AcademicsView.tsx`, `AssignmentsView.tsx`, `PlacementsView.tsx`, `FeesView.tsx`, `AIPlannerView.tsx`.

**`frontend/src/components/`:**
- Purpose: UI components, interactive modals, and dashboards.
- Contains: Dialogs, card containers, schedule strips, navigation bars.
- Key files: `VtopLoginModal.tsx`, `TimetableSlotCard.tsx`, `Sidebar.tsx`, `Header.tsx`.

**`frontend/src/services/`:**
- Purpose: State management, API integration, and business calculations.
- Contains: REST fetchers, offline defaults, attendance margin math.
- Key files: `api.ts`, `attendanceEngine.ts`, `defaultData.ts`.

## Key File Locations

**Entry Points:**
- `backend/app/main.py`: FastAPI app instance and HTTP middleware pipeline.
- `api/index.py`: Serverless shim for Vercel deployment.
- `frontend/src/main.tsx`: React application DOM mount point.
- `frontend/src/App.tsx`: Top-level component orchestrating views and authentication state.

**Configuration:**
- `.env.example`: Reference environment variable documentation.
- `frontend/vite.config.ts`: Frontend bundler configuration.
- `frontend/tailwind.config.js`: Tailwind design tokens, colors, and animations.
- `render.yaml` & `Dockerfile.backend`: Render cloud deployment manifest.
- `vercel.json`: Vercel proxy rewrite rules and function timeouts.

**Core Logic:**
- `backend/app/vtop/math_engine.py`: Canonical 75% attendance margin formulas.
- `backend/app/course_verification.py`: Cross-platform LMS/Teams/VTOP fuzzy reconciliation.
- `frontend/src/services/attendanceEngine.ts`: Client-side predictive attendance simulator.

**Testing:**
- `backend/tests/`: 400+ Python unit and integration tests.
- `frontend/src/utils/*.test.ts`: Frontend greeting, assignment sorting, and status unit tests.

## Naming Conventions

**Files:**
- React components and views: PascalCase (`TimetableSlotCard.tsx`, `DashboardView.tsx`)
- TypeScript services, utilities, and hooks: camelCase (`attendanceEngine.ts`, `useLockBodyScroll.ts`)
- Python modules: snake_case (`math_engine.py`, `unified_assignments.py`)
- Python test files: `test_*.py` (`test_vtop_parser.py`)
- TypeScript test files: `*.test.ts` (`assignmentSorting.test.ts`)

**Directories:**
- Frontend: lowercase (`components`, `services`, `views`, `utils`)
- Backend: lowercase snake_case (`app`, `routers`, `vtop`, `tests`)

## Where to Add New Code

**New Feature (e.g., Campus Bus Tracker):**
- Primary backend code: New router `backend/app/routers/bus.py`, registered in `backend/app/main.py`.
- Primary frontend code: New view `frontend/src/views/BusTrackerView.tsx`.
- Backend tests: `backend/tests/test_bus.py`.
- Frontend tests: `frontend/src/utils/busUtils.test.ts`.

**New Component/Modal:**
- Implementation: `frontend/src/components/BusScheduleModal.tsx` or `frontend/src/components/ui/` for generic widgets.
- Types: `frontend/src/types/index.ts`.

**Utilities:**
- Shared frontend helpers: `frontend/src/utils/`
- Shared backend helpers: `backend/app/` or appropriate subpackage (`vtop/`)

## Special Directories

**`backend/data/`:**
- Purpose: Stores local JSON caches and telemetry logs.
- Generated: Yes (at runtime during user logins and scrapes).
- Committed: Seed caches present (`profiles_cache.json`, sample student stores); runtime analytics files should remain gitignored.

**`dist/`:**
- Purpose: Compiled frontend static production output.
- Generated: Yes (`npm run build`).
- Committed: No (in `.gitignore`).

**`supabase/migrations/`:**
- Purpose: Database DDL versions.
- Generated: No (developer-written).
- Committed: Yes.

---

*Structure analysis: 2026-10-06*
