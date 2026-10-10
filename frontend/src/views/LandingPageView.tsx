import React, { useState, useEffect } from 'react';
import {
  GraduationCap,
  ShieldCheck,
  TrendingUp,
  Play,
  ArrowRight,
  CheckCircle2,
  XCircle,
  Calendar,
  BarChart2,
  Brain,
  Lock,
  Compass,
  FileText,
  Building,
  Users,
  Sun,
  Moon,
  Info,
  Sparkles,
  KeyRound,
} from 'lucide-react';
import { ThemeType } from '../components/ThemeSwitcher';

interface LandingPageViewProps {
  onOpenLogin?: () => void;
  onEnterApp?: () => void;
  onSignIn?: () => void;
  onExplore?: () => void;
  studentName?: string;
  isLoggedIn?: boolean;
  authStatus?: { authenticated: boolean; studentName?: string; regNo?: string };
  currentTheme?: ThemeType;
  onSelectTheme?: (theme: ThemeType) => void;
}

interface SimulatedCourse {
  code: string;
  title: string;
  slot: string;
  attended: number;
  conducted: number;
  initialSafeLeaves: number;
}

const INITIAL_COURSES: SimulatedCourse[] = [
  {
    code: 'CSE3002',
    title: 'Internet of Things Distributed Systems',
    slot: 'E1+TE1 • SJT-418',
    attended: 31,
    conducted: 34,
    initialSafeLeaves: 7,
  },
  {
    code: 'MAT2001',
    title: 'Statistics & Probability for Engineers',
    slot: 'B1+TB1 • TT-314',
    attended: 38,
    conducted: 40,
    initialSafeLeaves: 10,
  },
  {
    code: 'CSE2005',
    title: 'Operating Systems Kernels & Concurrency',
    slot: 'A1+TA1 • MB-201',
    attended: 26,
    conducted: 32,
    initialSafeLeaves: 2,
  },
  {
    code: 'HUM1021',
    title: 'Ethics in Algorithmic Governance',
    slot: 'C1 • CDMM-102',
    attended: 23,
    conducted: 24,
    initialSafeLeaves: 5,
  },
];

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenLogin,
  onEnterApp,
  onSignIn,
  onExplore,
  studentName: _studentName,
  isLoggedIn,
  currentTheme = 'editorial-dark',
  onSelectTheme,
}) => {
  const [simulatedMisses, setSimulatedMisses] = useState<number>(0);

  const handleLogin = onOpenLogin || onSignIn || (() => {});
  const handleEnter = onEnterApp || onExplore || (() => {});

  const isLight =
    currentTheme === 'editorial-light' ||
    currentTheme === 'paper-light' ||
    currentTheme === 'nordic-frost';

  const toggleTheme = () => {
    if (!onSelectTheme) return;
    if (isLight) {
      onSelectTheme('editorial-dark');
    } else {
      onSelectTheme('editorial-light');
    }
  };

  // Keyboard shortcut listener for CMD/CTRL + K to simulate miss
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setSimulatedMisses((prev) => (prev >= 4 ? 0 : prev + 1));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // Compute live simulated courses based on simulated misses
  const courseCalculations = INITIAL_COURSES.map((course) => {
    const totalConducted = course.conducted + simulatedMisses;
    const attended = course.attended;
    const percentage = Math.round((attended / totalConducted) * 1000) / 10;
    // Canonical safe leaves formula: floor((attended - 0.75 * conducted) / 0.75)
    const rawBuffer = Math.floor((attended - 0.75 * totalConducted) / 0.75);
    const safeLeaves = Math.max(0, rawBuffer);

    let status = 'Optimal';
    let statusBg = 'bg-secondary-container/60 text-on-secondary-container';
    if (percentage < 75) {
      status = 'Debarred';
      statusBg = 'bg-error-container text-on-error-container';
    } else if (safeLeaves === 0) {
      status = 'Critical Edge';
      statusBg = 'bg-error-container text-on-error-container';
    } else if (safeLeaves <= 2) {
      status = 'Watch Margin';
      statusBg = 'bg-tertiary-fixed text-on-tertiary-fixed';
    } else if (safeLeaves <= 7) {
      status = 'Resilient';
      statusBg = 'bg-secondary-container/60 text-on-secondary-container';
    }

    return {
      ...course,
      totalConducted,
      percentage,
      safeLeaves,
      status,
      statusBg,
    };
  });

  const aggregateAttended = courseCalculations.reduce((acc, c) => acc + c.attended, 0);
  const aggregateConducted = courseCalculations.reduce((acc, c) => acc + c.totalConducted, 0);
  const aggregatePercentage = (Math.round((aggregateAttended / aggregateConducted) * 1000) / 10).toFixed(1);

  return (
    <div className="w-full min-h-screen bg-surface font-body-md text-body-md text-on-surface antialiased selection:bg-primary-container selection:text-on-primary-container">
      {/* =========================================================================
          1. INSTITUTIONAL FIXED HEADER
          ========================================================================= */}
      <header className="fixed top-0 left-0 right-0 z-50 bg-surface/90 backdrop-blur-xl border-b border-outline-variant/30 shadow-[0_1px_8px_rgba(0,0,0,0.04)]">
        <div className="h-16 w-full max-w-[1440px] mx-auto px-4 md:px-8 flex items-center justify-between">
          {/* Logo & Product Meta */}
          <div className="flex items-center gap-6">
            <a
              href="#overview"
              className="flex items-center gap-2 text-decoration-none group"
              onClick={(e) => {
                e.preventDefault();
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
            >
              <img
                src="/logo.png"
                alt="CampusOS - Unified platform"
                className="h-8 w-auto object-contain max-w-[180px]"
              />
              <span className="px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant font-label-sm text-[10px] uppercase tracking-wider hidden sm:inline-block">
                v4.2 Core
              </span>
            </a>

            {/* Nav Links */}
            <nav className="hidden xl:flex items-center gap-4 text-xs font-label-md">
              <a
                href="#overview"
                className="px-2 py-1 transition-colors text-primary font-semibold"
              >
                Product
              </a>
              <a
                href="#attendance"
                className="text-on-surface-variant hover:text-on-surface px-2 py-1 transition-colors"
              >
                Attendance Engine
              </a>
              <a
                href="#grading"
                className="text-on-surface-variant hover:text-on-surface px-2 py-1 transition-colors"
              >
                Marks & Grading
              </a>
              <a
                href="#study-hub"
                className="text-on-surface-variant hover:text-on-surface px-2 py-1 transition-colors"
              >
                AI Study Hub
              </a>
              <a
                href="#security"
                className="text-on-surface-variant hover:text-on-surface px-2 py-1 transition-colors"
              >
                Security & VTOP Sync
              </a>
              <a
                href="#architecture"
                className="text-on-surface-variant hover:text-on-surface px-2 py-1 transition-colors"
              >
                Architecture
              </a>
            </nav>
          </div>

          {/* Action Header Controls */}
          <div className="flex items-center gap-3">
            {/* Theme Toggle Button */}
            {onSelectTheme && (
              <button
                onClick={toggleTheme}
                className="p-2 rounded bg-surface-container-low text-on-surface-variant hover:text-on-surface hover:bg-surface-container transition-colors"
                title={isLight ? 'Switch to Dark Mode' : 'Switch to Light Mode'}
                aria-label="Toggle Theme"
              >
                {isLight ? <Moon size={16} /> : <Sun size={16} />}
              </button>
            )}

            {isLoggedIn ? (
              <button
                onClick={handleEnter}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded bg-primary text-on-primary hover:bg-primary-container font-label-md text-xs font-semibold transition-all shadow-sm"
              >
                <span>Enter Dashboard</span>
                <ArrowRight size={14} />
              </button>
            ) : (
              <>
                <button
                  onClick={handleLogin}
                  className="hidden sm:inline-flex items-center justify-center px-3.5 py-1.5 rounded bg-surface-container-low text-on-surface hover:bg-surface-container font-label-md text-xs font-medium transition-colors border border-outline-variant/30"
                >
                  Student Login
                </button>
                <button
                  onClick={handleEnter}
                  className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded bg-primary text-on-primary hover:bg-primary-container font-label-md text-xs font-semibold transition-all shadow-sm"
                >
                  <span>Launch CampusOS</span>
                  <ArrowRight size={14} />
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      <main className="w-full pt-16 bg-surface min-h-screen">
        {/* =========================================================================
            2. TOP TECHNICAL STATUS BEACON BAR
            ========================================================================= */}
        <section className="w-full bg-surface-container-low border-b border-outline-variant/20">
          <div className="max-w-[1440px] mx-auto px-4 md:px-8 py-1.5 flex flex-wrap items-center justify-between gap-2 text-on-surface-variant font-label-sm text-[11px]">
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 font-semibold text-primary">
                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-ping" />
                VTOP SYNCHRONIZATION KERNEL 4.2.1-RELEASE
              </span>
              <span className="hidden md:inline text-outline-variant">•</span>
              <span className="hidden md:inline text-on-surface-variant">
                Zero Cloud Passwords • Cryptographic Session Bridge
              </span>
            </div>
            <div className="flex items-center gap-3 font-tabular-data">
              <span className="hidden sm:inline text-on-surface-variant">
                Network Latency: 12ms (Direct Socket)
              </span>
              <span className="px-2 py-0.5 rounded bg-surface-container text-on-surface font-label-sm text-[10px] uppercase font-semibold">
                Campus Node: Active
              </span>
            </div>
          </div>
        </section>

        {/* =========================================================================
            3. HERO SECTION WITH EDITORIAL PRECISION
            ========================================================================= */}
        <section id="overview" className="w-full bg-surface relative overflow-hidden pt-12 pb-16 md:pt-16 md:pb-24">
          {/* Subtle Architectural Background Grid */}
          <div className="absolute inset-0 pointer-events-none opacity-[0.035] bg-[radial-gradient(#0a3481_1px,transparent_1px)] [background-size:24px_24px]" />
          <div className="absolute -top-32 right-1/4 w-[540px] h-[540px] bg-secondary-container/20 rounded-full blur-3xl pointer-events-none" />

          <div className="max-w-[1440px] mx-auto px-4 md:px-8 relative z-10 flex flex-col items-center text-center">
            {/* Overline Pill Badge */}
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded bg-surface-container text-primary font-label-sm text-[11px] tracking-widest uppercase mb-4 shadow-sm border border-outline-variant/30">
              <ShieldCheck size={14} className="text-primary" />
              <span>CAMPUSOS V4.2 • THE NEXT GENERATION ACADEMIC SUITE • 100% CLIENT-SIDE VTOP SYNC</span>
            </div>

            {/* Main Headline */}
            <h1 className="font-display-lg text-3xl sm:text-5xl lg:text-6xl text-on-surface tracking-tight max-w-4xl text-balance font-semibold mb-4 leading-tight">
              Master your academics with mathematical precision.
            </h1>

            {/* Subheadline */}
            <p className="font-body-lg text-base sm:text-lg text-on-surface-variant max-w-2xl text-balance mb-8">
              Automated 75% attendance margin forecasting, continuous assessment relative GPA modeling, and timetable-aware deep work sprints — unified into one calm, private campus workspace.
            </p>

            {/* Primary Action Cluster */}
            <div className="flex flex-wrap items-center justify-center gap-3 mb-8">
              <button
                onClick={isLoggedIn ? handleEnter : handleLogin}
                className="inline-flex items-center gap-2 px-6 py-3 rounded bg-primary text-on-primary hover:bg-primary-container font-label-lg text-sm font-semibold transition-all shadow-md group"
              >
                <span>{isLoggedIn ? 'Launch CampusOS Cockpit' : 'Launch CampusOS'}</span>
                <ArrowRight size={16} className="group-hover:translate-x-0.5 transition-transform" />
              </button>

              <button
                onClick={handleEnter}
                className="inline-flex items-center gap-2 px-5 py-3 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-lg text-sm font-medium transition-colors border border-outline-variant/30"
              >
                <Play size={16} className="text-secondary" />
                <span>Explore Live Sandbox</span>
                <span className="ml-1 px-1.5 py-0.5 rounded bg-surface-container-highest text-on-surface-variant font-label-sm text-[11px] tracking-wider font-mono">
                  ⌘ + K
                </span>
              </button>
            </div>

            {/* Zero Credentials Trust Telemetry */}
            <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-on-surface-variant font-body-sm text-xs pb-10">
              <div className="flex items-center gap-1.5">
                <Lock size={14} className="text-primary" />
                <span>Zero credentials stored on cloud</span>
              </div>
              <span className="text-outline-variant">•</span>
              <div className="flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-primary" />
                <span>99.98% Debarment Safety Record</span>
              </div>
              <span className="text-outline-variant">•</span>
              <div className="flex items-center gap-1.5">
                <Sparkles size={14} className="text-primary" />
                <span>4.9 / 5 Peer Index Rating</span>
              </div>
            </div>

            {/* =========================================================================
                WORKSPACE MOCKUP TERMINAL (HIGH PRECISION EDITORIAL)
                ========================================================================= */}
            <div className="w-full max-w-5xl rounded-xl bg-surface-container-lowest p-4 md:p-6 shadow-xl border border-outline-variant/30 text-left relative">
              {/* Window Bar */}
              <div className="flex items-center justify-between pb-4 mb-4 border-b border-outline-variant/20 bg-surface-container-lowest">
                <div className="flex items-center gap-2">
                  <div className="w-3 h-3 rounded-full bg-surface-container-highest" />
                  <div className="w-3 h-3 rounded-full bg-surface-container-highest" />
                  <div className="w-3 h-3 rounded-full bg-surface-container-highest" />
                  <span className="ml-3 font-label-sm text-[11px] text-on-surface-variant tracking-wider uppercase font-semibold">
                    ACADEMIC TERMINAL • WINTER SEMESTER 2024–25
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-secondary-container/40 text-on-secondary-container font-tabular-data text-[11px] font-semibold">
                    Live Sync: 14s ago
                  </span>
                  <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                </div>
              </div>

              {/* 4-Card Telemetry Row */}
              <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mb-4">
                {/* Projected CGPA */}
                <div className="p-4 rounded bg-surface-container-low flex flex-col justify-between border border-outline-variant/20">
                  <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-[11px]">
                    <span>PROJECTED CGPA</span>
                    <TrendingUp size={16} className="text-primary" />
                  </div>
                  <div className="my-2">
                    <span className="font-metric-display text-3xl font-semibold text-on-surface tracking-tight font-tabular-data">
                      8.84
                    </span>
                    <span className="font-label-sm text-xs text-primary font-semibold ml-1.5 font-tabular-data">
                      +0.14
                    </span>
                  </div>
                  <div className="font-body-sm text-xs text-on-surface-variant">
                    Top 4.2% in Computer Science Cohort
                  </div>
                </div>

                {/* Overall Attendance */}
                <div className="p-4 rounded bg-surface-container-low flex flex-col justify-between border border-outline-variant/20">
                  <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-[11px]">
                    <span>OVERALL ATTENDANCE</span>
                    <ShieldCheck size={16} className="text-primary" />
                  </div>
                  <div className="my-2">
                    <span className="font-metric-display text-3xl font-semibold text-on-surface tracking-tight font-tabular-data">
                      {aggregatePercentage}%
                    </span>
                  </div>
                  <div className="font-body-sm text-xs text-primary font-medium">
                    0 Courses below 75% Cutoff
                  </div>
                </div>

                {/* Upcoming Engagement */}
                <div className="p-4 rounded bg-surface-container-low flex flex-col justify-between md:col-span-2 border border-outline-variant/20">
                  <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-[11px]">
                    <span>UPCOMING ENGAGEMENT (IN 35 MIN)</span>
                    <span className="px-2 py-0.5 rounded bg-primary text-on-primary font-label-sm text-[10px] font-medium">
                      Slot E1+TE1
                    </span>
                  </div>
                  <div className="my-2 flex items-baseline justify-between gap-2 flex-wrap">
                    <div>
                      <h4 className="font-headline-sm text-base text-on-surface font-semibold">
                        CSE3002: I.O.T. Distributed Architecture
                      </h4>
                      <p className="font-body-sm text-xs text-on-surface-variant">
                        Venue: SJT-418 • Prof. Dr. S. Ramanathan
                      </p>
                    </div>
                    <div className="text-right">
                      <span className="inline-block px-2 py-1 rounded bg-secondary-container/50 text-on-secondary-container font-label-sm text-[11px] font-semibold">
                        Buffer: +{courseCalculations[0].safeLeaves} Classes Safe
                      </span>
                    </div>
                  </div>
                  {/* Dynamic Progress Bar */}
                  <div className="w-full bg-surface-container-highest rounded-full h-1.5 overflow-hidden">
                    <div
                      className="bg-primary h-1.5 rounded-full transition-all duration-300"
                      style={{ width: `${Math.min(100, courseCalculations[0].percentage)}%` }}
                    />
                  </div>
                </div>
              </div>

              {/* Enrolled Course Portfolio & Headroom Matrix */}
              <div className="rounded bg-surface-container-low p-4 border border-outline-variant/20">
                <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-3 border-b border-outline-variant/20">
                  <div>
                    <h3 className="font-headline-sm text-base text-on-surface font-semibold">
                      Enrolled Course Portfolio & Headroom Matrix
                    </h3>
                    <p className="font-body-sm text-xs text-on-surface-variant">
                      Real-time attendance projection modeled against university 75% cutoff threshold.
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="font-label-sm text-[11px] text-on-surface-variant uppercase hidden sm:inline">
                      Margin Stress Simulation:
                    </span>
                    <button
                      onClick={() => setSimulatedMisses((prev) => prev + 1)}
                      className="px-2.5 py-1 rounded bg-surface-container text-on-surface hover:bg-surface-container-high font-label-sm text-xs font-semibold transition-colors border border-outline-variant/30 flex items-center gap-1"
                    >
                      <span>-1 Miss Simulated</span>
                      {simulatedMisses > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-primary text-on-primary text-[10px]">
                          +{simulatedMisses}
                        </span>
                      )}
                    </button>
                    {simulatedMisses > 0 && (
                      <button
                        onClick={() => setSimulatedMisses(0)}
                        className="px-2.5 py-1 rounded bg-surface-container-highest text-on-surface hover:bg-surface-dim font-label-sm text-xs font-semibold transition-colors"
                      >
                        Reset Baseline
                      </button>
                    )}
                  </div>
                </div>

                {/* Academic Table */}
                <div className="overflow-x-auto">
                  <table className="w-full text-left font-body-sm text-xs">
                    <thead>
                      <tr className="text-on-surface-variant font-label-sm text-[11px] uppercase bg-surface-container">
                        <th className="py-2.5 px-3">Course Code & Nomenclature</th>
                        <th className="py-2.5 px-3">Slot / Venue</th>
                        <th className="py-2.5 px-3 text-right">Attended / Total</th>
                        <th className="py-2.5 px-3 text-right">Rate</th>
                        <th className="py-2.5 px-3 text-right">Leaves Buffer (Safe)</th>
                        <th className="py-2.5 px-3 text-center">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-outline-variant/10">
                      {courseCalculations.map((course, i) => (
                        <tr key={i} className="hover:bg-surface-container-highest/60 transition-colors">
                          <td className="py-3 px-3">
                            <span className="font-semibold text-on-surface font-headline-sm text-sm block">
                              {course.code}
                            </span>
                            <span className="text-on-surface-variant font-body-sm text-xs">
                              {course.title}
                            </span>
                          </td>
                          <td className="py-3 px-3 font-tabular-data text-on-surface-variant">
                            {course.slot}
                          </td>
                          <td className="py-3 px-3 text-right font-tabular-data font-semibold text-on-surface">
                            {course.attended} / {course.totalConducted}
                          </td>
                          <td className="py-3 px-3 text-right font-tabular-data font-semibold text-on-surface">
                            {course.percentage}%
                          </td>
                          <td className="py-3 px-3 text-right font-tabular-data font-semibold text-primary">
                            +{course.safeLeaves} Classes
                          </td>
                          <td className="py-3 px-3 text-center">
                            <span className={`px-2 py-0.5 rounded font-label-sm text-[10px] font-semibold ${course.statusBg}`}>
                              {course.status}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                {/* Bottom Summary Indicator */}
                <div className="mt-3 pt-3 border-t border-outline-variant/20 flex flex-wrap items-center justify-between gap-2 text-on-surface-variant font-label-md text-xs">
                  <span className="flex items-center gap-1.5">
                    <Info size={14} className="text-primary" />
                    Algorithm includes approved OD (On-Duty) slips and 4 institutional symposium holidays.
                  </span>
                  <span className="font-tabular-data font-medium text-on-surface">
                    Aggregated Semester Attendance: {aggregatePercentage}% (Threshold Target: 75.0%)
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section Divider */}
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 w-full">
          <div className="h-px bg-outline-variant/20 w-full" />
        </div>

        {/* =========================================================================
            4. CORE CAPABILITIES MATRIX (THE 4 PILLARS)
            ========================================================================= */}
        <section id="attendance" className="w-full bg-surface py-16 md:py-24">
          <div className="max-w-[1440px] mx-auto px-4 md:px-8">
            {/* Section Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between mb-12 gap-4">
              <div>
                <span className="font-label-sm text-xs text-primary font-semibold uppercase tracking-wider block mb-1">
                  CORE MATHEMATICAL SUBSYSTEMS
                </span>
                <h2 className="font-headline-xl text-2xl sm:text-4xl text-on-surface font-semibold tracking-tight">
                  Engineered around the structural reality of VIT / University life.
                </h2>
              </div>
              <p className="font-body-md text-sm sm:text-base text-on-surface-variant max-w-md">
                Every algorithm is tailored to institutional course structures, credit weighting, faculty attendance habits, and bell-curve dynamics.
              </p>
            </div>

            {/* Feature Grid: 4 Bento Columns */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {/* Pillar 1: Attendance Safety Engine */}
              <div className="rounded-lg bg-surface-container-lowest p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow border border-outline-variant/30">
                <div>
                  <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center text-primary mb-4">
                    <Calendar size={20} />
                  </div>
                  <h3 className="font-headline-md text-lg text-on-surface font-semibold mb-2">
                    Attendance Safety Engine
                  </h3>
                  <p className="font-body-md text-sm text-on-surface-variant mb-6">
                    Never calculate leaves on notebook margins again. Dynamic vectors project semester-end attendance headroom, factoring in official On-Duty (OD) allocations and gazetted holidays.
                  </p>
                </div>
                {/* Mini Interactive Widget */}
                <div className="rounded bg-surface-container-low p-3 border border-outline-variant/20">
                  <div className="flex items-center justify-between font-label-sm text-xs mb-1.5">
                    <span className="text-on-surface font-semibold">CSE2005 (OS)</span>
                    <span className="text-primary font-semibold font-tabular-data">Safe Buffer: +2</span>
                  </div>
                  <div className="w-full bg-surface-container-highest rounded-full h-1.5 mb-2">
                    <div className="bg-primary h-1.5 rounded-full" style={{ width: '81.3%' }} />
                  </div>
                  <div className="flex items-center justify-between text-on-surface-variant font-label-sm text-[10px]">
                    <span>Current: 81.3%</span>
                    <span className="font-semibold text-on-surface">Min: 75.0%</span>
                  </div>
                </div>
              </div>

              {/* Pillar 2: Relative Grade Ledger */}
              <div id="grading" className="rounded-lg bg-surface-container-lowest p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow border border-outline-variant/30">
                <div>
                  <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center text-primary mb-4">
                    <BarChart2 size={20} />
                  </div>
                  <h3 className="font-headline-md text-lg text-on-surface font-semibold mb-2">
                    Relative Grade Ledger
                  </h3>
                  <p className="font-body-md text-sm text-on-surface-variant mb-6">
                    Gain transparent visibility over CAT-1, CAT-2, DA marks, and FAT projections. Models cohort bell curves, standard deviation marks, and faculty historical distributions.
                  </p>
                </div>
                {/* Mini Grading Breakdown Widget */}
                <div className="rounded bg-surface-container-low p-3 space-y-1.5 border border-outline-variant/20">
                  <div className="flex justify-between items-center font-label-sm text-xs">
                    <span className="text-on-surface-variant">CAT-1 (Max 50)</span>
                    <span className="font-tabular-data font-semibold text-on-surface">46.5 / 50 (μ = 38.2)</span>
                  </div>
                  <div className="flex justify-between items-center font-label-sm text-xs">
                    <span className="text-on-surface-variant">CAT-2 (Max 50)</span>
                    <span className="font-tabular-data font-semibold text-on-surface">44.0 / 50 (μ = 36.1)</span>
                  </div>
                  <div className="flex justify-between items-center font-label-sm text-xs pt-1 bg-surface-container rounded px-1.5">
                    <span className="text-primary font-semibold">Predicted Grade</span>
                    <span className="font-headline-sm text-primary font-semibold">S Grade (98th %tile)</span>
                  </div>
                </div>
              </div>

              {/* Pillar 3: Timetable AI Study Hub */}
              <div id="study-hub" className="rounded-lg bg-surface-container-lowest p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow border border-outline-variant/30">
                <div>
                  <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center text-primary mb-4">
                    <Brain size={20} />
                  </div>
                  <h3 className="font-headline-md text-lg text-on-surface font-semibold mb-2">
                    Timetable AI Study Hub
                  </h3>
                  <p className="font-body-md text-sm text-on-surface-variant mb-6">
                    Detects idle timetable gaps between lectures (e.g. SJT to TT transitions) and automatically schedules high-focus Pomodoro deep-work sprints mapped to upcoming assignments.
                  </p>
                </div>
                {/* Mini Free Slot Widget */}
                <div className="rounded bg-surface-container-low p-3 border border-outline-variant/20">
                  <div className="flex items-center gap-1.5 text-primary font-label-sm text-xs font-semibold mb-1">
                    <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                    90-MIN FREE GAP DETECTED
                  </div>
                  <div className="font-body-sm text-xs text-on-surface font-medium mb-2">
                    11:45 AM - 01:15 PM • Central Library Pod 4
                  </div>
                  <button
                    onClick={handleEnter}
                    className="w-full py-1 rounded bg-surface-container hover:bg-surface-container-high text-on-surface font-label-sm text-xs font-semibold transition-colors"
                  >
                    Queue 45m DSA Sprint
                  </button>
                </div>
              </div>

              {/* Pillar 4: Zero-Knowledge Vault */}
              <div id="security" className="rounded-lg bg-surface-container-lowest p-6 flex flex-col justify-between shadow-sm hover:shadow-md transition-shadow border border-outline-variant/30">
                <div>
                  <div className="w-10 h-10 rounded bg-surface-container flex items-center justify-center text-primary mb-4">
                    <Lock size={20} />
                  </div>
                  <h3 className="font-headline-md text-lg text-on-surface font-semibold mb-2">
                    Zero-Knowledge Vault
                  </h3>
                  <p className="font-body-md text-sm text-on-surface-variant mb-6">
                    Your registration numbers, passwords, and academic transcripts never touch our or any third-party cloud. Every byte parses in your local browser sandbox via memory streams.
                  </p>
                </div>
                {/* Mini Security Status Widget */}
                <div className="rounded bg-surface-container-low p-3 border border-outline-variant/20">
                  <div className="flex items-center gap-2 mb-1.5">
                    <ShieldCheck size={16} className="text-primary" />
                    <span className="font-label-sm text-xs font-semibold text-on-surface">
                      Client-Side Sandbox Verified
                    </span>
                  </div>
                  <div className="font-body-sm text-xs text-on-surface-variant">
                    End-to-End browser session tokens. Zero telemetry attestation. Fully audit-ready code.
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section Divider */}
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 w-full">
          <div className="h-px bg-outline-variant/20 w-full" />
        </div>

        {/* =========================================================================
            5. DEEP DIVE COMPARATIVE SHOWCASE
            ========================================================================= */}
        <section className="w-full bg-surface-container-low py-16 md:py-24">
          <div className="max-w-[1440px] mx-auto px-4 md:px-8">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
              {/* Left Column: Visual Contrast */}
              <div className="lg:col-span-6 flex flex-col gap-4">
                {/* Old Portal Card */}
                <div className="rounded-lg bg-surface-container-lowest p-6 shadow-sm border border-outline-variant/30">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-outline-variant/20">
                    <span className="font-label-sm text-xs uppercase tracking-wider text-error font-semibold flex items-center gap-1.5">
                      <XCircle size={16} />
                      Legacy University Portal Confusion
                    </span>
                    <span className="font-label-sm text-xs text-on-surface-variant">Typical Intranet Pain</span>
                  </div>
                  <div className="p-3 rounded bg-surface-container font-tabular-data text-xs text-on-surface-variant space-y-1">
                    <div>"Total: 34 | Attended: 26 | Percentage: 76.47%"</div>
                    <div className="text-error font-semibold">
                      Unknown: How many classes until 75% cutoff? Will lab cancelations trigger debarment? No forward projections.
                    </div>
                  </div>
                </div>

                {/* CampusOS Clarity Card */}
                <div className="rounded-lg bg-surface-container-lowest p-6 shadow-md border border-outline-variant/30">
                  <div className="flex items-center justify-between pb-3 mb-3 border-b border-outline-variant/20">
                    <span className="font-label-sm text-xs uppercase tracking-wider text-primary font-semibold flex items-center gap-1.5">
                      <CheckCircle2 size={16} />
                      CampusOS Mathematical Clarity
                    </span>
                    <span className="font-label-sm text-xs text-primary font-semibold">Predictive Safety Buffer</span>
                  </div>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h4 className="font-headline-sm text-sm font-semibold text-on-surface">
                          CSE2005 Operating Systems
                        </h4>
                        <p className="font-body-sm text-xs text-on-surface-variant">
                          Faculty: Prof. K. Venkatesh • Theory + Lab Embedded
                        </p>
                      </div>
                      <span className="px-2.5 py-1 rounded bg-secondary-container/60 text-on-secondary-container font-label-md text-xs font-semibold">
                        +2 Classes Margin
                      </span>
                    </div>

                    {/* Visual Range Indicator with 75% marker */}
                    <div className="space-y-1">
                      <div className="flex justify-between font-label-sm text-[10px] text-on-surface-variant">
                        <span>Current: 81.25%</span>
                        <span className="font-semibold text-error">75.00% Absolute Cutoff</span>
                        <span>100% Target</span>
                      </div>
                      <div className="relative w-full h-3 bg-surface-container rounded-full overflow-hidden">
                        {/* Cutoff Danger Band */}
                        <div className="absolute left-0 top-0 bottom-0 w-[75%] bg-error/15" />
                        {/* Safe Attended Bar */}
                        <div className="absolute left-0 top-0 bottom-0 w-[81.25%] bg-primary" />
                        {/* 75% Cutoff Marker */}
                        <div className="absolute left-[75%] top-0 bottom-0 w-0.5 bg-error z-10" />
                      </div>
                    </div>

                    <div className="p-3 rounded bg-surface-container-low text-on-surface font-body-sm text-xs flex items-start gap-2 border border-outline-variant/20">
                      <Sparkles size={16} className="text-primary shrink-0 mt-0.5" />
                      <span>
                        You can safely miss <strong>2 more lecture hours</strong> before reaching debarment threshold. OD approval pending (+1 class headroom expected).
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Right Column: Campus Intelligence Architecture */}
              <div className="lg:col-span-6 flex flex-col gap-4">
                <span className="font-label-sm text-xs text-primary font-semibold uppercase tracking-wider">
                  CAMPUS INTELLIGENCE ARCHITECTURE
                </span>
                <h2 className="font-headline-xl text-2xl sm:text-4xl text-on-surface font-semibold tracking-tight">
                  Designed for the intense cadence of engineering semesters.
                </h2>
                <p className="font-body-lg text-sm sm:text-base text-on-surface-variant">
                  From last-minute classroom migrations to tight continuous assessments, CampusOS removes the mental math so you can concentrate purely on learning and building.
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-2">
                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 font-headline-sm text-sm text-on-surface font-semibold">
                      <Compass size={18} className="text-primary" />
                      <span>Venue & Slot Navigation</span>
                    </div>
                    <p className="font-body-sm text-xs text-on-surface-variant">
                      Instant mapping between SJT, TT, MB, and CDMM buildings with calculated transit corridors between back-to-back hours.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 font-headline-sm text-sm text-on-surface font-semibold">
                      <FileText size={18} className="text-primary" />
                      <span>CAT & FAT Timetable Sync</span>
                    </div>
                    <p className="font-body-sm text-xs text-on-surface-variant">
                      Auto-generates personal study milestones directly from parsed exam hall ticket schedules.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 font-headline-sm text-sm text-on-surface font-semibold">
                      <Building size={18} className="text-primary" />
                      <span>Library Pod Space Monitor</span>
                    </div>
                    <p className="font-body-sm text-xs text-on-surface-variant">
                      Real-time occupancy status for quiet study annexes, departmental labs, and 24/7 reading halls.
                    </p>
                  </div>

                  <div className="flex flex-col gap-1">
                    <div className="flex items-center gap-2 font-headline-sm text-sm text-on-surface font-semibold">
                      <Users size={18} className="text-primary" />
                      <span>Faculty Cabin Directory</span>
                    </div>
                    <p className="font-body-sm text-xs text-on-surface-variant">
                      Direct lookup for professor office locations, consulting hours, and official email routing without portal hunting.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section Divider */}
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 w-full">
          <div className="h-px bg-outline-variant/20 w-full" />
        </div>

        {/* =========================================================================
            6. UNIFIED PLATFORM FOR VTOP | TEAMS | LMS
            ========================================================================= */}
        <section className="w-full bg-surface py-16 md:py-24">
          <div className="max-w-[1440px] mx-auto px-4 md:px-8">
            <div className="text-center max-w-2xl mx-auto mb-12">
              <span className="font-label-sm text-xs text-primary font-semibold uppercase tracking-wider block mb-1">
                SEAMLESS CROSS-PORTAL INTEGRATION
              </span>
              <h2 className="font-headline-xl text-2xl sm:text-4xl text-on-surface font-semibold tracking-tight mb-2">
                UNIFIED PLATFORM FOR VTOP | TEAMS | LMS
              </h2>
              <p className="font-body-md text-sm sm:text-base text-on-surface-variant">
                Stop logging into three different broken portals. CampusOS unifies attendance, Microsoft Teams coursework, and Moodle LMS submissions into one single flow.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-6 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded bg-primary/10 text-primary flex items-center justify-center mb-3">
                    <GraduationCap size={18} />
                  </div>
                  <h3 className="font-headline-md text-base font-semibold text-on-surface mb-1">
                    VTOP Institutional Bridge
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed">
                    Zero-hallucination DOM parsing of official marks, faculty cabin locations, exams, and attendance. Session verification stays completely local.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs font-label-sm text-primary">
                  <span>Direct Browser Session</span>
                  <CheckCircle2 size={14} />
                </div>
              </div>

              <div className="p-6 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded bg-secondary-container/60 text-secondary flex items-center justify-center mb-3">
                    <Users size={18} />
                  </div>
                  <h3 className="font-headline-md text-base font-semibold text-on-surface mb-1">
                    Microsoft Teams Classrooms
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed">
                    Automated coursework discovery across all enrolled class channels. Sync due dates, assignment rubrics, and submission verification directly.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs font-label-sm text-secondary">
                  <span>Graph API Normalization</span>
                  <CheckCircle2 size={14} />
                </div>
              </div>

              <div className="p-6 rounded-xl bg-surface-container-lowest border border-outline-variant/30 shadow-sm flex flex-col justify-between">
                <div>
                  <div className="w-9 h-9 rounded bg-tertiary-fixed text-tertiary-fixed-dim flex items-center justify-center mb-3">
                    <FileText size={18} />
                  </div>
                  <h3 className="font-headline-md text-base font-semibold text-on-surface mb-1">
                    Moodle LMS Coursework Hub
                  </h3>
                  <p className="font-body-sm text-xs text-on-surface-variant leading-relaxed">
                    Continuous monitoring of weekly lab assignments, quiz windows, and uploaded reference PDFs without session expiries or timeouts.
                  </p>
                </div>
                <div className="mt-4 pt-3 border-t border-outline-variant/20 flex items-center justify-between text-xs font-label-sm text-tertiary">
                  <span>Automated Polling Bridge</span>
                  <CheckCircle2 size={14} />
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Section Divider */}
        <div className="max-w-[1440px] mx-auto px-4 md:px-8 w-full">
          <div className="h-px bg-outline-variant/20 w-full" />
        </div>

        {/* =========================================================================
            7. ARCHITECTURE & PRIVACY COMPARISON MATRIX
            ========================================================================= */}
        <section id="architecture" className="w-full bg-surface-container-low py-16 md:py-24">
          <div className="max-w-[1440px] mx-auto px-4 md:px-8">
            <div className="text-center max-w-2xl mx-auto mb-10">
              <span className="font-label-sm text-xs text-primary font-semibold uppercase tracking-wider block mb-1">
                ARCHITECTURAL INTEGRITY
              </span>
              <h2 className="font-headline-xl text-2xl sm:text-4xl text-on-surface font-semibold tracking-tight">
                How CampusOS compares against typical methods.
              </h2>
            </div>

            {/* Comparison Matrix Table */}
            <div className="rounded-lg bg-surface-container-lowest shadow-sm overflow-hidden border border-outline-variant/30">
              <div className="overflow-x-auto">
                <table className="w-full text-left font-body-sm text-xs">
                  <thead>
                    <tr className="bg-surface-container text-on-surface font-label-md text-xs">
                      <th className="py-3.5 px-4 font-semibold">Capability / Architecture</th>
                      <th className="py-3.5 px-4 text-on-surface-variant">Default University Portal</th>
                      <th className="py-3.5 px-4 text-on-surface-variant">Manual Excel Spreadsheets</th>
                      <th className="py-3.5 px-4 bg-secondary-container/30 text-primary font-semibold">
                        CampusOS Platform
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-outline-variant/15">
                    <tr>
                      <td className="py-3 px-4 font-semibold text-on-surface">Automatic Timetable & Slot Parsing</td>
                      <td className="py-3 px-4 text-on-surface-variant">Basic static HTML view</td>
                      <td className="py-3 px-4 text-on-surface-variant">Requires manual copy-pasting</td>
                      <td className="py-3 px-4 bg-secondary-container/10 font-semibold text-primary">
                        Instant automated sync via DOM parser
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-on-surface">Predictive 75% Attendance Margins</td>
                      <td className="py-3 px-4 text-on-surface-variant">None (Only past raw percentage)</td>
                      <td className="py-3 px-4 text-on-surface-variant">Complex customized formula formulas</td>
                      <td className="py-3 px-4 bg-secondary-container/10 font-semibold text-primary">
                        Automated buffer counts with OD inputs
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-on-surface">Relative Class GPA Distribution Curves</td>
                      <td className="py-3 px-4 text-on-surface-variant">Hidden until final grade publication</td>
                      <td className="py-3 px-4 text-on-surface-variant">Infeasible without cohort dataset</td>
                      <td className="py-3 px-4 bg-secondary-container/10 font-semibold text-primary">
                        Cohort statistical bell-curve estimation
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-on-surface">Speed & Offline Resilience</td>
                      <td className="py-3 px-4 text-on-surface-variant">8s - 15s server response time</td>
                      <td className="py-3 px-4 text-on-surface-variant">Fast, but siloed</td>
                      <td className="py-3 px-4 bg-secondary-container/10 font-semibold text-primary">
                        Instant 0ms memory cache execution
                      </td>
                    </tr>
                    <tr>
                      <td className="py-3 px-4 font-semibold text-on-surface">Privacy & Credential Isolation</td>
                      <td className="py-3 px-4 text-on-surface-variant">Subject to portal session drops</td>
                      <td className="py-3 px-4 text-on-surface-variant">Local files</td>
                      <td className="py-3 px-4 bg-secondary-container/10 font-semibold text-primary">
                        Zero cloud storage; AES browser memory tokens
                      </td>
                    </tr>
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </section>

        {/* =========================================================================
            8. HIGH-CONVERTING CLOSING CALL-TO-ACTION BLOCK
            ========================================================================= */}
        <section className="w-full bg-surface py-16 md:py-24">
          <div className="max-w-[1440px] mx-auto px-4 md:px-8">
            <div className="rounded-xl bg-primary text-on-primary p-8 md:p-14 text-center relative overflow-hidden shadow-xl">
              {/* Subtle Glow Accent */}
              <div className="absolute -bottom-24 -right-24 w-96 h-96 bg-primary-container rounded-full blur-3xl pointer-events-none opacity-60" />

              <div className="relative z-10 max-w-3xl mx-auto flex flex-col items-center">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-on-primary/10 text-on-primary font-label-sm text-xs tracking-wider uppercase mb-3 font-semibold">
                  SECURE STUDENT INITIATIVE • VERSION 4.2 LIVE
                </span>
                <h2 className="font-headline-xl text-2xl sm:text-4xl text-on-primary font-semibold tracking-tight mb-3">
                  Reclaim absolute control over your semester.
                </h2>
                <p className="font-body-lg text-sm sm:text-base text-on-primary/80 mb-8 text-balance">
                  Join thousands of university scholars tracking courses, continuous evaluations, and attendance without anxiety or institutional downtime.
                </p>

                <div className="flex flex-wrap items-center justify-center gap-3 mb-4">
                  <button
                    onClick={isLoggedIn ? handleEnter : handleLogin}
                    className="inline-flex items-center gap-2 px-6 py-3 rounded bg-surface text-primary hover:bg-surface-container font-label-lg text-sm font-semibold transition-all shadow-md"
                  >
                    <span>{isLoggedIn ? 'Enter CampusOS Cockpit' : 'Launch CampusOS Web App'}</span>
                    <ArrowRight size={16} />
                  </button>

                  <button
                    onClick={handleEnter}
                    className="inline-flex items-center gap-2 px-5 py-3 rounded bg-on-primary/15 hover:bg-on-primary/25 text-on-primary font-label-lg text-sm font-medium transition-colors border border-on-primary/20"
                  >
                    <KeyRound size={16} />
                    <span>Inspect Security & Zero-Telemetry Audit</span>
                  </button>
                </div>

                <div className="font-body-sm text-xs text-on-primary/70">
                  Works smoothly on all desktop browsers. Zero server proxying. No institutional admin approval necessary.
                </div>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* =========================================================================
          9. INSTITUTIONAL EDITORIAL FOOTER
          ========================================================================= */}
      <footer id="about" className="w-full bg-surface-container-low border-t border-outline-variant/30">
        <div className="w-full max-w-[1440px] mx-auto px-4 md:px-8 pt-12 pb-8">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-8 pb-12">
            <div className="lg:col-span-2 flex flex-col gap-3">
              <div className="flex items-center gap-2">
                <img
                  src="/logo.png"
                  alt="CampusOS - Unified platform"
                  className="h-7 w-auto object-contain max-w-[160px]"
                />
                <span className="font-label-sm text-[10px] px-1.5 py-0.5 rounded bg-surface-container-high text-on-surface-variant">
                  v4.2
                </span>
              </div>
              <p className="font-body-sm text-xs text-on-surface-variant max-w-sm leading-relaxed">
                High-precision computational academic operating environment engineered for institutional rigor, predictive attendance modeling, and continuous evaluation tracking.
              </p>
              <div className="flex items-center gap-2 pt-1">
                <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                <span className="font-tabular-data text-xs text-on-surface-variant">
                  Systems Operational • VTOP Direct Sync Live
                </span>
              </div>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
                Capabilities
              </span>
              <nav className="flex flex-col gap-1.5 text-xs text-on-surface-variant">
                <a href="#attendance" className="hover:text-on-surface transition-colors">
                  75% Cutoff Projections
                </a>
                <a href="#grading" className="hover:text-on-surface transition-colors">
                  Continuous Evaluation Matrix
                </a>
                <a href="#study-hub" className="hover:text-on-surface transition-colors">
                  Synthesized Curriculum AI
                </a>
                <a href="#security" className="hover:text-on-surface transition-colors">
                  Zero-Knowledge VTOP Bridge
                </a>
              </nav>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
                Architecture
              </span>
              <nav className="flex flex-col gap-1.5 text-xs text-on-surface-variant">
                <a href="#security" className="hover:text-on-surface transition-colors">
                  Cryptographic Vaults
                </a>
                <a href="#architecture" className="hover:text-on-surface transition-colors">
                  Student Privacy Charter
                </a>
                <a href="#overview" className="hover:text-on-surface transition-colors">
                  Sync Protocol Telemetry
                </a>
                <a href="#architecture" className="hover:text-on-surface transition-colors">
                  Zero-Telemetry Attestation
                </a>
              </nav>
            </div>

            <div className="flex flex-col gap-2.5">
              <span className="font-label-sm text-[11px] uppercase tracking-wider text-on-surface-variant font-semibold">
                Governance
              </span>
              <nav className="flex flex-col gap-1.5 text-xs text-on-surface-variant">
                <a href="#about" className="hover:text-on-surface transition-colors">
                  Academic Council
                </a>
                <a href="#about" className="hover:text-on-surface transition-colors">
                  Institutional Deployment
                </a>
                <a href="#about" className="hover:text-on-surface transition-colors">
                  Compliance & Terms
                </a>
                <button
                  onClick={handleLogin}
                  className="text-left text-primary hover:underline transition-colors"
                >
                  Terminal Gateway
                </button>
              </nav>
            </div>
          </div>

          <div className="pt-6 border-t border-outline-variant/20 flex flex-col md:flex-row items-center justify-between gap-3 text-xs text-on-surface-variant">
            <div className="flex items-center gap-2">
              <span>© 2025 CampusOS Academic Operating Environment.</span>
              <span className="font-label-sm text-[10px] px-1.5 py-0.5 rounded bg-surface-container text-on-surface-variant">
                Open-Audit Core
              </span>
            </div>
            <div className="flex items-center gap-3">
              <span>End-to-end encrypted client-side execution</span>
              <span>•</span>
              <span>Autonomous University Platform</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};
