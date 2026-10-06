---
last_mapped_commit: 89615b09b04b03530042eefc25834df71385d9d0
last_mapped_at: 2026-10-06
---
# Technology Stack

**Analysis Date:** 2026-10-06

## Languages

**Primary:**
- TypeScript 5.4.5 - Frontend user interface, state management, API services (`frontend/src/`)
- Python 3.11+ / 3.14 (compatible) - Backend API, web scraping, OCR, attendance calculations (`backend/app/`, `api/index.py`)

**Secondary:**
- JavaScript (ES Modules / Node.js) - Root tooling, Netlify serverless wrapper (`netlify/functions/api.js`)
- SQL (PostgreSQL / Supabase) - Database schema migrations, RLS security policies (`supabase/migrations/`)
- CSS3 / Tailwind CSS 3.4.19 - Utility-first UI styling and custom design tokens (`frontend/src/index.css`, `frontend/tailwind.config.js`)
- HTML5 - Single page application host (`frontend/index.html`)

## Runtime

**Environment:**
- Node.js v20+ / v24.20.0 (development & build)
- Python 3.11-slim (Docker container production runtime) / Python 3.14 (local development)

**Package Manager:**
- npm (Node.js) - Frontend dependencies
  - Lockfile: `package-lock.json` and `frontend/package-lock.json` (present)
- pip (Python) - Backend dependencies
  - Lockfile: `backend/requirements.txt` and root `requirements.txt` (present, version-pinned)

## Frameworks

**Core:**
- FastAPI 0.110.0+ - High-performance Python backend REST API framework (`backend/app/main.py`)
- React 18.3.1 - Frontend UI library with functional components and hooks (`frontend/src/App.tsx`)
- Vite 5.3.4 - Modern frontend build tool, dev server, and module bundler (`frontend/vite.config.ts`)

**Testing:**
- pytest 8.0+ - Python backend test runner with fixtures and mock requests (`backend/tests/`)
- node:test (Node.js Native Test Runner) - Frontend utility unit tests (`frontend/src/utils/*.test.ts`)

**Build/Dev:**
- Uvicorn 0.28.0+ - ASGI web server for FastAPI execution (`run_backend.sh`)
- Tailwind CSS 3.4.19 with Autoprefixer and PostCSS - Utility-first styling pipeline (`frontend/postcss.config.js`)
- Docker - Containerized backend deployment runtime (`Dockerfile.backend`)

## Key Dependencies

**Critical:**
- `beautifulsoup4` (>=4.12.0) - HTML parsing for university portals (VTOP, LMS Moodle) (`backend/app/vtop/parser.py`, `backend/app/routers/lms.py`)
- `pytesseract` (>=0.3.10) & `pillow` (>=10.0.0) - Tesseract OCR image preprocessing and captcha solving (`backend/app/vtop/ocr.py`)
- `requests` (>=2.31.0) & `urllib3` (>=2.0.0) - Stateful HTTP sessions with custom SSL CA certificate support for VTOP (`backend/app/vtop/session.py`)
- `pydantic` (>=2.6.0) - Request/response schema validation and data models (`backend/app/vtop/models.py`)
- `framer-motion` (^13.1.1) - Declarative fluid animations across cards, modals, and navigation (`frontend/src/components/`)
- `lucide-react` (^1.34.0) - Icon library for dashboard navigation and status indicators (`frontend/src/components/`)
- `recharts` (^3.10.1) - Responsive data visualization for attendance, grades, and marks (`frontend/src/views/`)
- `@supabase/supabase-js` (^2.116.0) & `supabase` (Python client) - PostgreSQL integration and real-time client (`frontend/src/services/supabaseClient.ts`, `backend/app/supabase_client.py`)

**Infrastructure:**
- `three` (^0.185.1) & `@splinetool/react-spline` (^4.1.0) - 3D canvas rendering and interactive hero visualizer (`frontend/src/components/RobotCanvas.tsx`, `frontend/src/components/ui/splite.tsx`)
- `tailwind-merge` (^3.7.0) & `clsx` (^2.1.1) - Safe Tailwind class composition utility (`frontend/src/lib/utils.ts`)
- `@radix-ui/react-slot` (^1.3.3) - Composable UI primitive for slot patterns (`frontend/src/components/ui/`)

## Configuration

**Environment:**
- Configured via environment variables loaded via runtime or `.env` file (`.env.example` provides canonical blueprint)
- Key variables required:
  - `PORT`: Backend port (default `8000`)
  - `CAMPUSOS_SESSION_SECRET`: HMAC SHA-256 secret for signed session tokens
  - `CAMPUSOS_ADMIN_KEY`: Passkey for `/api/analytics/admin/*` endpoints
  - `SUPABASE_URL` & `SUPABASE_KEY` / `VITE_SUPABASE_URL` & `VITE_SUPABASE_ANON_KEY`: Supabase project access
  - `VITE_API_URL` / `VITE_API_BASE_URL`: Frontend pointer to backend API

**Build:**
- Frontend: `frontend/vite.config.ts`, `frontend/tsconfig.json`, `frontend/tailwind.config.js`
- Root monorepo orchestration: `package.json` (`npm run build` runs frontend build and syncs to `dist/`)
- Vercel: `vercel.json` rewrites `/api/(.*)` to `/api/index.py` and SPA routes to `index.html`
- Render: `render.yaml` defines Docker service specs and Singapore region deployment
- Netlify: `netlify.toml` with `dist` publish directory and redirect rules

## Platform Requirements

**Development:**
- Node.js 18+ and npm 9+
- Python 3.10+ (Python 3.11 recommended for tesseract-ocr binary parity)
- System package `tesseract-ocr` (optional locally; OCR has fallback heuristics or mock fallbacks)
- Local network: default binds to `127.0.0.1:8000` (backend) and `localhost:5173` (frontend)

**Production:**
- Backend: Docker on Render (`Dockerfile.backend`) with Debian `tesseract-ocr` and `libtesseract-dev` installed, or Vercel Serverless Python function (`api/index.py`)
- Frontend: Static CDN hosting on Vercel or Netlify (`dist/`)
- Database: Supabase managed PostgreSQL

---

*Stack analysis: 2026-10-06*
