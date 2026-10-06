---
last_mapped_commit: 89615b09b04b03530042eefc25834df71385d9d0
last_mapped_at: 2026-10-06
---
# Coding Conventions

**Analysis Date:** 2026-10-06

## Naming Patterns

**Files:**
- React components and views: PascalCase (`VtopLoginModal.tsx`, `DashboardView.tsx`)
- TypeScript utilities and services: camelCase (`attendanceEngine.ts`, `assignmentSorting.ts`)
- TypeScript test files: `*.test.ts` (`greeting.test.ts`)
- Python modules and packages: snake_case (`math_engine.py`, `course_verification.py`)
- Python test files: `test_*.py` (`test_vtop_parser.py`, `test_math_engine.py`)

**Functions:**
- TypeScript: camelCase (`calculateAttendanceStats`, `formatRelativeDueDate`, `getPeriodGreeting`)
- React components: PascalCase (`TimetableSlotCard`, `MetricCard`)
- Python: snake_case (`compute_safe_misses`, `parse_attendance`, `resolve_student_reg`)

**Variables:**
- TypeScript: camelCase (`selectedDay`, `activeSemester`, `studentProfile`)
- Python: snake_case (`session_id`, `current_reg`, `student_store`)
- Constants: UPPER_SNAKE_CASE (`CACHE_TTL_SECONDS`, `BASE_URL`, `COMPANY_BENCHMARKS`, `ALLOWED_ORIGINS`)

**Types:**
- TypeScript interfaces and types: PascalCase (`Student`, `CourseRecord`, `AttendanceStats`, `DayOfWeek`)
- Python Pydantic models: PascalCase (`StudentCredentials`, `SyncReport`, `VerifiedCourseRecord`)

## Code Style

**Formatting:**
- TypeScript/React: 2-space indentation, semicolons enabled, double or single quotes consistently applied.
- Python: PEP 8 compliant, 4-space indentation, `black`/`ruff` style conventions.

**Linting:**
- TypeScript: TypeScript strict compiler checks (`tsc --noEmit` in `frontend/package.json` build step).
- Python: Pydantic v2 strict type validation on API inputs, standard type hints with `typing`.

## Import Organization

**Order (TypeScript):**
1. Standard React & core libraries (`react`, `react-dom`)
2. Third-party UI & icon dependencies (`lucide-react`, `framer-motion`, `recharts`)
3. Internal services and utilities (`../services/api`, `../lib/utils`)
4. Internal components and modals (`../components/Header`, `../components/TimetableSlotCard`)
5. Type definitions (`../types`)

**Order (Python):**
1. Standard library imports (`os`, `sys`, `re`, `logging`, `datetime`, `typing`)
2. Third-party dependencies (`fastapi`, `pydantic`, `bs4`, `requests`)
3. Internal application packages (`from app.storage import ...`, `from app.vtop import constants as C`)

**Path Aliases:**
- Standard relative imports (`../../`, `./`) used across frontend components and backend modules.

## Error Handling

**Patterns:**
- Backend:
  - Do NOT invent fake data on scraping errors; return `None` or explicitly flag omissions.
  - Raise `fastapi.HTTPException(status_code=..., detail=...)` for client-visible API failures.
  - Safe fallbacks wrapped in try/except blocks to isolate individual module scrape failures from bringing down the entire payload.
- Frontend:
  - API service functions catch network/server exceptions, log errors via `console.error`, and return sensible fallback structures (e.g., cached store or default data).
  - Modal inputs display localized error alerts directly in the modal UI.

## Logging

**Framework:**
- Backend: Python standard library `logging.getLogger("campusos.*")` with structured log format:
  `logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(name)s | %(message)s")`
- Frontend: `console.warn` / `console.error` for failed API calls and fallback activations.

**Patterns:**
- Log info on incoming auth attempts (hiding passwords), sync completions, and OCR solver timings.
- Log warnings on malformed university portal HTML or missing table headers.

## Comments

**When to Comment:**
- Explain non-obvious scraping edge cases (e.g., VTOP session CSRF extraction, dynamic token cookies).
- Document mathematical derivations for attendance margin formulas ($\ge 75\%$ vs $< 75\%$).
- Architecture notes at the top of router and parser files explaining module intent.

**JSDoc/TSDoc:**
- Used for complex calculation utilities and public API client functions in `frontend/src/services/`.

## Function Design

**Size:**
- Single responsibility functions. Complex HTML parsing is broken into granular helper functions per section (`parse_attendance`, `parse_timetable_grid`, `parse_marks`).

**Parameters:**
- Python: Explicit type annotations on all function parameters (`def parse_attendance(html: str) -> List[Dict[str, Any]]:`).
- TypeScript: Typed props interfaces for React components (`interface TimetableSlotCardProps { slot: Slot; day: DayOfWeek; }`).

**Return Values:**
- Strongly typed returns. Missing values default to `None` (Python) or `null` / `undefined` (TypeScript).

## Module Design

**Exports:**
- React components use default exports or named exports.
- Services and utilities use named exports (`export const fetchStudentData = ...`).
- Python modules expose clear public functions and classes, with internal helpers prefixed with `_`.

**Barrel Files:**
- Centralized types exported via `frontend/src/types/index.ts`.
- Component-level barrel files are avoided in favor of direct component imports to optimize tree-shaking.

---

*Convention analysis: 2026-10-06*
