---
id: 261008-fix-vtop-sync-fresh-data
slug: fix-vtop-sync-fresh-data
date: 2026-10-08
description: Fix VTOP sync freshness and session expiry, and completely polish the landing UI and animations to authentically match aerukart.com
status: in-progress
---

# Quick Plan: Fix VTOP Sync Freshness and Replicate Aerukart Animations & UI

## Context
1. User reported: `/home/pragyan/Pictures/Screenshots/Screenshot_20261008_143338.png data is not upto date`
   - VTOP sync was giving false-positive "Synced Successfully" toasts on expired sessions without updating React state.
2. User reported: `/home/pragyan/Pictures/Screenshots/Screenshot_20261008_145120.png this dosent look good please follow the reference properly put animations and proper ui`
   - The hero section had an opaque black rectangular bounding box around a static 2D blueprint image.
   - It lacked fluid animations, RollText wave effects, interactive 3D parallax, and authentic Aerukart visual fidelity.

## Tasks

### Task 1: Strict Session Validation and Fresh Data Handling in Backend & Frontend
- **Files**:
  - `backend/app/vtop/session.py`
  - `backend/app/vtop/scraper.py`
  - `backend/app/vtop/client.py`
  - `backend/app/storage.py`
  - `frontend/src/App.tsx`
- **Action**:
  - Backend: Detect login page on authenticated requests (`post_menu`, `post_semester`) and raise `VTOPAuthError` with `CODE_SESSION_EXPIRED` (111).
  - Backend: In `scraper.sync`, check authentication and bubble `VTOPAuthError` if semester/profile cannot be fetched due to session expiry.
  - Backend: In `client.py`, never create a fake session with `is_authenticated=True` in `_get` when cookies are missing. In `_run_sync`, fail if core modules fail with auth errors.
  - Backend: In `storage.py`, preserve verified student data from disk rather than overwriting with empty arrays. Restore `store_24BLC1100.json` with the full verified student record from `store_5196BLC1100.json`.
  - Frontend: In `App.tsx` (`handleHeaderSync`, `handleLoginSuccess`, `initAuthAndRouting`), unwrap `const d = (res as any)?.data || res;`. If `vtopResult.success === false`, show login modal notice and trigger toast `'VTOP Session Expired — Please Sign In to Refresh'`, never `'Synced Successfully'`. When successful, update all React states and storage directly with unwrapped payload.

### Task 2: Authentic Aerukart Hero Visualizer, RollText, and Fluid Animations
- **Files**:
  - `frontend/public/assets/chrome.png` (authentic RGBA transparent asset from aerukart.com)
  - `frontend/src/components/ui/RollText.tsx` (reusable letter-by-letter wave roll animation)
  - `frontend/src/components/ui/hero-ascii.tsx` (Aerukart hero stage with 3D tilt, floating physics, entrance animations)
  - `frontend/src/views/LandingPageView.tsx` (Framer motion scroll reveals, feature card micro-interactions)
  - `frontend/src/index.css` (RollText CSS module, chrome float keyframes, glow improvements)
- **Action**:
  - Replace opaque rectangular blueprint with the authentic Aerukart chrome visualizer (`/assets/chrome.png`) on an RGBA transparent canvas with radial cyan glow and cybernetic telemetry HUD ring.
  - Implement interactive 3D mouse parallax and smooth idle floating animation (`@keyframes aerukChromeFloat`).
  - Implement authentic cascading RollText wave animation across all nav links and buttons (`transition-delay: calc(index * 18ms)`).
  - Add staggered Framer Motion entrance animations for headline ("CONNECTED", "*CAMPUS*"), eyebrow, subtitle, and CTA buttons.
  - Polish cards in showcase grid with smooth scroll reveals (`whileInView`) and hover glow effects.

### Task 3: Verification, Full Test Suite, and Multi-Branch Synchronization
- **Files**:
  - `backend/tests/`
  - Git branches: `main`, `update-1.1`, `update1.1`
- **Action**:
  - Run backend pytest suite (all 405 tests pass).
  - Run frontend test suite (all 20 tests pass).
  - Run production build (`npm --prefix frontend run build`).
  - Commit cleanly and push across all 3 git branches (`main`, `update-1.1`, `update1.1`).
