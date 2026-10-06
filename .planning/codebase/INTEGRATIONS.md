---
last_mapped_commit: 89615b09b04b03530042eefc25834df71385d9d0
last_mapped_at: 2026-10-06
---
# External Integrations

**Analysis Date:** 2026-10-06

## APIs & External Services

**University Portals:**
- VTOP Portal (`https://vtopcc.vit.ac.in/vtop`, `vtop.vit.ac.in`) - Primary student portal for timetable, attendance, marks, profile, and exam schedule
  - SDK/Client: `requests.Session` with custom SSL context (`backend/app/vtop/session.py`) and BeautifulSoup4
  - Auth: Scraped JSESSIONID cookie, CSRF token handling, and student credentials (`username`/`password`)
- VIT Moodle LMS (`https://lms.vit.ac.in`) - Course assignment portal and submission status tracking
  - SDK/Client: `requests.Session` (`backend/app/routers/lms.py`)
  - Auth: Student institutional credentials or MoodleSession cookie (`MoodleSession`)
- Microsoft Teams & Education Graph API (`https://graph.microsoft.com`, `https://assignments.onenote.com`) - Teams class assignment sync
  - SDK/Client: Direct REST API via `requests.Session` (`backend/app/routers/teams.py`)
  - Auth: OAuth2 bearer tokens acquired via resource owner password credential flow against Azure AD (`https://login.microsoftonline.com/common/oauth2/token`)

**Coding & Placements:**
- LeetCode GraphQL API (`https://leetcode.com/graphql`) - Real-time DSA problem stats, contest ratings, and company benchmark gap evaluation
  - SDK/Client: HTTP POST with GraphQL query payload via `requests` (`backend/app/routers/leetcode.py`)
  - Auth: Public GraphQL endpoint (no auth required)

**Academic Resources & Campus Utilities:**
- VHelp (`https://www.vhelpcc.com/study-material`) - Scrapes previous year question papers (PYQs) and study notes by course code
  - SDK/Client: BeautifulSoup4 scraper (`backend/app/vtop/study_materials.py`)
  - Auth: Public web scrape
- Unmessify API (`https://kanishka-developer.github.io/unmessify/json/en`) - Hosteller mess menus and schedule data
  - SDK/Client: JSON fetch (`backend/app/vtop/hostel.py`)
  - Auth: Public open JSON data

## Data Storage

**Databases:**
- PostgreSQL (Supabase Managed Cloud)
  - Connection: `SUPABASE_URL` / `VITE_SUPABASE_URL`
  - Client: `@supabase/supabase-js` (frontend: `frontend/src/services/supabaseClient.ts`), `supabase` Python SDK (backend: `backend/app/supabase_client.py`)
  - Schemas: `profiles`, `analytics_events`, `user_courses` tables with Row Level Security (RLS) policies (`supabase/migrations/`)

**File Storage:**
- Local Filesystem / Serverless Ephemeral:
  - Cache and state snapshots stored as JSON in `backend/data/store_{reg_no}.json` and `backend/data/profiles_cache.json` (`backend/app/storage.py`)
  - Event log: `backend/data/analytics_events.jsonl`

**Caching:**
- In-memory TTL Caching:
  - LeetCode API responses cached for 15 minutes (`CACHE_TTL_SECONDS = 900` in `backend/app/routers/leetcode.py`)
  - VTOP active sessions cached in memory registry (`backend/app/vtop/registry.py`)
  - Browser `sessionStorage` and `localStorage` for frontend client state and student profile persistence (`frontend/src/services/defaultData.ts`)

## Authentication & Identity

**Auth Provider:**
- Custom University Credential Relay & HMAC Session Management
  - Implementation: Student logs in with university registration number and VTOP password. Backend validates against live VTOP portal, solves captcha via Tesseract OCR (`backend/app/vtop/ocr.py`), and signs a stateful HMAC SHA-256 session token (`backend/app/auth_crypto.py`).
  - Tokens: Sent in `Authorization: Bearer <token>` or `X-CampusOS-Session` headers.
  - Admin access: Secured via `CAMPUSOS_ADMIN_KEY` header for analytics inspection.

## Monitoring & Observability

**Error Tracking:**
- Custom error handling and structured JSON responses (`backend/app/main.py`)
- Sync report diagnostic endpoint (`GET /api/vtop/sync-report`) for auditing field-by-field scrape completeness.

**Logs:**
- Python standard `logging` with formatted output (`%(asctime)s %(levelname)-7s %(name)s | %(message)s`)
- File log output to `.backend.log` in development
- Login telemetry and sync event audits written to `backend/data/login_telemetry.json`

## CI/CD & Deployment

**Hosting:**
- Frontend: Vercel (`campus-os-pi-three.vercel.app`) / Netlify (`campus-o.netlify.app`)
- Backend: Render Docker web service (`campusos-api.onrender.com`) via `Dockerfile.backend` and `render.yaml`; also runs as Vercel Serverless Function via `api/index.py`

**CI Pipeline:**
- GitHub Actions workflow defined in `.github/workflows/`
- Local automated test runners: `run_backend.sh`, `start_local.sh`, and `pytest backend/tests`

## Environment Configuration

**Required env vars:**
- `PORT`: Web server listen port (default `8000`)
- `CAMPUSOS_SESSION_SECRET`: Secret key for HMAC-SHA256 session token generation and verification
- `CAMPUSOS_ADMIN_KEY`: Admin passkey for `/api/analytics/admin/*`
- `SUPABASE_URL`: Supabase project URL
- `SUPABASE_KEY` / `SUPABASE_ANON_KEY`: Supabase client anon key
- `VITE_SUPABASE_URL`: Frontend Supabase connection URL
- `VITE_SUPABASE_ANON_KEY`: Frontend Supabase anon key
- `VITE_API_URL`: Frontend base URL targeting backend REST API

**Secrets location:**
- Stored in hosting platform environment variable vaults (Render Environment dashboard, Vercel Project Settings, Netlify Site settings)
- Local development configured via `.env` (gitignored, template documented in `.env.example`)

## Webhooks & Callbacks

**Incoming:**
- None (pull-based scraping and REST query architecture)

**Outgoing:**
- None

---

*Integration audit: 2026-10-06*
