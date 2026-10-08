---
id: 261008-aerukart-ui-replica
slug: aerukart-ui-replica
date: 2026-10-08
status: complete
---

# Quick Task Summary: Aerukart UI Replica for CampusOS

## Objective
Replicate the entire UI from `https://aerukart.com/` into CampusOS, while strictly keeping all text, academic data structures, dynamic scrapers (VTOP, LMS, Teams), attendance margin calculations, and student features completely unchanged.

## Implemented Changes

1. **Design System & Tokens (`frontend/index.html`, `frontend/src/index.css`)**:
   - Added `Cormorant Garamond` Google font import in `frontend/index.html`.
   - Added font variables `--font-serif: 'Cormorant Garamond', Georgia, serif;`, `--sans`, `--serif`.
   - Setup Aerukart tokens: `--aeruk-bg: #000000;`, `--aeruk-white: #f5f5f2;`, `--aeruk-muted: #afb1b6;`, `--aeruk-blue: #0c477f;`, `--aeruk-cyan: #17c1fe;`, `--aeruk-line: #ffffff0b;`.
   - Updated base dark surfaces to deep obsidian palette: `--bg-primary: #000000;`, `--surface-primary: #080d14;`, `--surface-secondary: #0c1721;`.
   - Implemented Aerukart 12-column backdrop grid (`.site-grid i`), diagonal atmospheric lighting (`.home-glow`, `.story-light`), pill action buttons (`.button`, `.button-blue`), and roll-text micro-interaction (`.roll-text`).
   - Configured `em` to use Cormorant Garamond italic editorial accent.

2. **Hero Stage (`frontend/src/components/ui/hero-ascii.tsx`)**:
   - Re-architected hero into Aerukart's `.hero-stage` with `.home-glow`, `.story-light`, and `.site-grid`.
   - Implemented Aerukart sticky header with brand mark, floating frosted pill navbar (`.main-nav`) with roll-text animations, and glowing pill CTA button.
   - Styled headline with Aerukart typography: `CONNECTED <em>CAMPUS</em>`.
   - Retained user's exact text: "A unified platform for VTOP, Teams, and LMS." and button labels ("VTOP SIGN IN" / "DISCOVER MORE").
   - Framed the campus architectural blueprint inside Aerukart's chrome visualizer frame with 3D mouse parallax and cyan/blue ambient backlight.

3. **Showcase Matrix & Footer (`frontend/src/views/LandingPageView.tsx`)**:
   - Replaced generic cards with Aerukart's editorial `.media-format-row` and `.project-card` layout.
   - Preserved all 4 academic subsystems, formulas, and pill tags.
   - Updated marquee ticker with hairline borders and Aerukart minimalist footer.

4. **In-App Alignment (`Header.tsx`, `DashboardView.tsx`)**:
   - Aligned sync buttons and primary actions with Aerukart `.button.button-blue.button-sm`.
   - Verified that all student features, real-time sync, attendance calculations, marks, exams, and timetable work smoothly.

## Verification
- Frontend test suite: 20 passed, 0 failed.
- Frontend build: Succeeded in 3.44s.
- Backend test suite: 405 passed, 0 failed.
- Production build: `npm run build` completed successfully.
