# CampusOS 🚀

CampusOS is a high-performance, modern university student operating system engineered for seamless academic tracking, smart attendance margin calculation, normalized VTOP/LMS/Teams aggregation, placement preparation, and AI-driven study planning.

---

## 🏗 System Architecture

```
VTOP ──────┐
LMS ───────┼──> Integration Layer ──> Normalized Data ──> PostgreSQL
Teams ─────┘
                    ▲
                    │
            Spring Boot API
                    ▲
                    │
           React + TypeScript (CampusOS)
```

> **Design Principle**: The frontend never talks directly to VTOP, LMS, or Microsoft Teams. It interacts exclusively with our backend API (currently simulated via the isolated `src/services/api.ts` mock layer).

---

## ✨ Features Implemented in Version 1.0

1. **Smart Attendance Engine**:
   - $\ge 75\%$: Computes exact **Safe to miss $N$ classes** using $\lfloor \frac{\text{Attended} - 0.75 \times \text{Total}}{0.75} \rfloor$.
   - $< 75\%$: Flags critical shortage and computes **Attend next $M$ classes** using $\lceil \frac{0.75 \times \text{Total} - \text{Attended}}{0.25} \rceil$.
   - Live **+ Present / - Bunk simulation** directly in the timetable slots.
2. **Normalized VTOP Timetable**:
   - Interactive Mon–Sat week strip selector.
   - Slot cards with room venue (e.g., AB-2 Room 304), faculty name, and attendance status.
3. **Academics & Marks Breakdown**:
   - Detailed course list with CAT-1, CAT-2, DA, Quiz scores, and FAT Grade S/A projections.
4. **Unified LMS & Teams Assignments**:
   - Coursework aggregator with priority badges and deadline countdowns.
5. **Fee Tracker & Official Receipts**:
   - Tuition, Hostel & Mess fee breakdown with receipt download simulators.
6. **Placements & DSA Tracker**:
   - Placement eligibility checker (CGPA $\ge 8.00$, 0 arrears) and LeetCode/GFG topic mastery.
7. **AI Study Planner**:
   - Automated priority engine targeting low attendance recovery and upcoming exam prep.

---

## 🚀 How to Run Locally

### Option A: Instant Zero-Dependency Browser Preview (via Python)
```bash
cd CampusOS
python3 -m http.server 3000
```
Open `http://localhost:3000` in your browser.

### Option B: Vite + React + TypeScript Development
```bash
cd CampusOS/frontend
npm install
npm run dev
```

---

## 🔗 Connecting to your GitHub Repository

To push this repository to your GitHub profile ([github.com/pragyan43jain](https://github.com/pragyan43jain)):

1. Create a new empty repository on GitHub named `CampusOS`.
2. Run the following commands in your terminal:
```bash
cd /home/pragyan/.gemini/antigravity/scratch/CampusOS
git init
git add .
git commit -m "feat: Initial CampusOS v1.0 frontend with VTOP mock engine & attendance calculator"
git branch -M main
git remote add origin https://github.com/pragyan43jain/CampusOS.git
git push -u origin main
```
