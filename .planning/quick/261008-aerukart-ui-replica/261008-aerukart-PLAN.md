---
id: 261008-aerukart-ui-replica
slug: aerukart-ui-replica
date: 2026-10-08
description: Replicate the whole UI from https://aerukart.com/ into CampusOS while keeping all text and features strictly unchanged
status: in-progress
---

# Quick Plan: Aerukart UI Replica for CampusOS

## Context
User request:
"https://aerukart.com/ replica the whole ui from this website in my webiste keeping the content unchanged of my webiste the text should be what is ther right now im my website butt the ui should be exactly like the provideed reference"

## Goals
1. Replicate Aerukart (`https://aerukart.com/`) UI design system:
   - Deep obsidian/black theme (`#000`), cyan/blue glow gradients (`--cyan: #17c1fe; --blue: #0c477f`), 12-column hairline grid backdrop (`.site-grid i`).
   - Editorial typography: Absans sans body/headings + Cormorant Garamond italic serif accents inside `<em>` tags.
   - Aerukart navigation: Sticky header with brand mark, floating frosted pill navbar (`.main-nav`), and glowing gradient CTA pill (`.button-blue`).
   - Aerukart hero stage: Ambient lighting (`.home-glow`, `.story-light`), large sans + italic serif headline, rolling text CTA buttons, and chrome visualizer stage framing the campus architectural blueprint.
   - Aerukart showcase cards (`.media-format-row`): Asymmetrical 10-column editorial rows with media cards, tag chips (`.project-tags`), and minimalist metadata with diagonal arrow icons (`↗`).
   - In-app UI alignment: Aerukart card surfaces, buttons, eyebrows, and typography hierarchy across Header, Sidebar, and Dashboard.
2. Maintain 100% of existing CampusOS content, text, data bindings, attendance math, live VTOP/LMS/Teams sync, and routing.

## Tasks

### Task 1: Aerukart Design System Tokens, Typography, and Core Styles in CSS
- **Files**: `frontend/src/index.css`, `frontend/index.html`
- **Action**:
  - Import Cormorant Garamond serif font in `index.html` alongside local Absans.
  - Define Aerukart CSS variables (`--bg`, `--white`, `--muted`, `--blue`, `--cyan`, `--glow-ramp`, `--line`, `--header-height`, `--sans`, `--serif`).
  - Implement `.site-grid`, `.home-glow`, `.story-light`, `.button`, `.button-blue`, `.arrow-icon`, `.project-tags`, and `em` font styling.
  - Add RollText animated hover styles and hairline border treatments.

### Task 2: Replicate Aerukart Hero and Landing Page Layout
- **Files**: `frontend/src/views/LandingPageView.tsx`, `frontend/src/components/ui/hero-ascii.tsx`
- **Action**:
  - Re-architect hero into Aerukart's `.hero-stage` with `.site-grid`, `.home-glow`, and `.hero-copy`.
  - Replicate Aerukart's typography: large sans headline with italic serif emphasis (`<em>CAMPUS</em>`), preserving exact user text ("A unified platform for VTOP, Teams, and LMS.", "VTOP SIGN IN", "EST. 2026", etc.).
  - Position the campus architectural blueprint within Aerukart's chrome visualizer frame with 3D parallax and lighting.
  - Re-style feature cards into Aerukart's `.media-format-row` editorial grid with media framing, pill tags, and diagonal arrow metadata.
  - Update marquee ticker and footer to match Aerukart's minimalist aesthetic.

### Task 3: Align In-App Navigation and Dashboard UI
- **Files**: `frontend/src/components/Header.tsx`, `frontend/src/components/Sidebar.tsx`, `frontend/src/views/DashboardView.tsx`
- **Action**:
  - Restyle Header with Aerukart `.site-header`, floating center `.main-nav` capsule, and `.button-blue` CTA.
  - Restyle Sidebar to match Aerukart dark sidebar styling with hairline borders and pill active states.
  - Restyle Dashboard cards with Aerukart deep surfaces (`#080d14` / `#0c1721`), cyan glow accents, and editorial eyebrows.
  - Verify all student functionality (attendance margins, timetable, marks, exams, LMS status) works flawlessly.

### Task 4: Verification, Test Suite, and Multi-Branch Synchronization
- **Files**: N/A
- **Action**:
  - Run frontend test suite (`npm test`).
  - Run production build (`npm run build`).
  - Run backend test suite (`pytest backend/tests/`).
  - Commit changes cleanly and push to `main`, `update-1.1`, and `update1.1`.
