---
last_mapped_commit: 89615b09b04b03530042eefc25834df71385d9d0
last_mapped_at: 2026-10-06
---
# Testing Patterns

**Analysis Date:** 2026-10-06

## Test Framework

**Runner:**
- Backend: `pytest` 8.0+ (and lightweight stdlib runner `backend/tests/run_without_pytest.py`)
- Frontend: Node.js native test runner (`node --test --experimental-strip-types`)

**Assertion Library:**
- Backend: Python native `assert` statements
- Frontend: Node.js native `node:assert`

**Run Commands:**

```bash
pytest backend/tests -q                 # Run all backend tests (400 tests)
npm --prefix frontend test              # Run frontend unit tests
python3 backend/smoke_test.py           # Smoke test for API payloads
```

## Test File Organization

**Location:**
- Backend: Centralized in `backend/tests/`
- Frontend: Co-located with utility functions in `frontend/src/utils/`

**Naming:**
- Backend: `test_<module>.py` (e.g., `test_vtop_parser.py`, `test_math_engine.py`, `test_security_auth.py`)
- Frontend: `<module>.test.ts` (e.g., `greeting.test.ts`, `assignmentSorting.test.ts`, `assignmentStatus.test.ts`)

**Structure:**

```
backend/tests/
├── fixtures/
│   ├── __init__.py
│   └── vtop_pages.py                  # Raw HTML responses captured from university portals
├── test_analytics.py
├── test_course_verification.py
├── test_endpoints.py
├── test_lms.py
├── test_math_engine.py
├── test_parser.py
├── test_security_auth.py
├── test_storage.py
├── test_teams.py
├── test_unified_assignments.py
├── test_validator.py
├── test_vtop_calendar.py
├── test_vtop_parser.py
├── test_vtop_registry.py
└── test_vtop_scraper.py
```

## Test Structure

**Backend Suite Organization:**

```python
import pytest
from app.vtop.math_engine import compute_safe_misses, compute_classes_to_attend

class TestAttendanceMath:
    def test_safe_misses_above_75_percent(self):
        # 16 attended out of 20 = 80%
        # (16 - 0.75 * 20) / 0.75 = (16 - 15) / 0.75 = 1.33 -> 1 safe miss
        assert compute_safe_misses(16, 20) == 1

    def test_classes_to_attend_below_75_percent(self):
        # 14 attended out of 20 = 70%
        # (0.75 * 20 - 14) / 0.25 = 1 / 0.25 = 4 classes needed
        assert compute_classes_to_attend(14, 20) == 4
```

**Frontend Suite Organization:**

```typescript
import { test, describe } from 'node:test';
import assert from 'node:assert';
import { getPeriodGreeting } from './greeting.ts';

describe('Greeting Utility - Time Period Determination', () => {
  test('correctly classifies morning hours (05:00 - 11:59)', () => {
    const greeting = getPeriodGreeting(9);
    assert.strictEqual(greeting.period, 'morning');
  });
});
```

**Patterns:**
- **Fixture-based DOM testing:** Parsers run against pre-captured, realistic HTML strings in `backend/tests/fixtures/vtop_pages.py` without requiring live university network access.
- **Assertion on absence:** Dedicated contract tests verifying that unavailable data remains `None` and is never fabricated.

## Mocking

**Framework:**
- `unittest.mock.patch` / `monkeypatch` in pytest; `TestClient` from `fastapi.testclient`.

**Patterns:**

```python
def test_mock_network_call(monkeypatch):
    def fake_get(*args, **kwargs):
        class FakeResponse:
            status_code = 200
            text = "<html>...</html>"
        return FakeResponse()

    monkeypatch.setattr("requests.Session.get", fake_get)
```

**What to Mock:**
- Live network requests to university portals (`vtopcc.vit.ac.in`, `lms.vit.ac.in`, `graph.microsoft.com`).
- Tesseract OCR binary execution when testing logic layers above OCR.

**What NOT to Mock:**
- Pure logic functions: math engine, date sorting, regex extractors, and HTML parsers.

## Fixtures and Factories

**Test Data:**
- Real VTOP HTML pages saved in Python string constants inside `backend/tests/fixtures/vtop_pages.py`:
  - `PROFILE_PAGE_HTML`
  - `TIMETABLE_PAGE_HTML`
  - `ATTENDANCE_PAGE_HTML`
  - `MARKS_PAGE_HTML`
  - `EXAM_SCHEDULE_HTML`

**Location:**
- `backend/tests/fixtures/vtop_pages.py`
- Seed JSON student files: `backend/app/seed/store_24BLC1100.json`

## Coverage

**Requirements:**
- High test coverage on all mathematical functions (`math_engine.py`) and table parsers (`parser.py`).
- No enforced percentage gate, but 400 backend tests and 20 frontend tests must pass in CI.

**View Coverage:**

```bash
pytest backend/tests --cov=app
```

## Test Types

**Unit Tests:**
- Math calculations, date parsers, greeting algorithms, course code normalizers.

**Integration Tests:**
- FastAPI endpoint tests using Starlette `TestClient` to verify auth headers, token verification, and JSON response structure.

**E2E Tests:**
- Live end-to-end scraper test script: `backend/scripts/run_live_e2e_test.py` (run manually with real credentials when validating portal schema changes).

## Common Patterns

**Async Testing:**
- Standard FastAPI `TestClient` handles async endpoints synchronously in tests without needing explicit async loop management.

**Error Testing:**
- Verify error statuses and message envelopes:

```python
def test_unauthorized_access(client):
    response = client.get("/api/vtop/student", headers={"Authorization": "Bearer invalid"})
    assert response.status_code == 401
```

---

*Testing analysis: 2026-10-06*
