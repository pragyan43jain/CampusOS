import React from 'react';
import {
  ShieldCheck,
  Award,
  Layers,
  BrainCircuit,
  Percent,
  CheckCircle2,
  ArrowUp,
} from 'lucide-react';
import { ThemeType } from '../components/ThemeSwitcher';
import HeroAscii from '../components/ui/hero-ascii';
import { Spotlight } from '../components/ui/spotlight';

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

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenLogin,
  onEnterApp,
  onSignIn,
  onExplore,
  studentName,
  isLoggedIn,
  currentTheme = 'cyber-dark',
  onSelectTheme,
}) => {
  const handleLogin = onOpenLogin || onSignIn || (() => {});
  const handleEnter = onEnterApp || onExplore || (() => {});

  const marqueeItems = [
    'GDPR & FERPA Compliant Local Extraction',
    '75% Attendance Safe-Margin Calculator',
    'VIT Chennai & Vellore Multi-Campus Support',
    'Unified Microsoft Teams & Moodle LMS Sync',
    'Zero Cloud Credential Storage',
    'Automated AI CAT & FAT Planner',
    'Super Dream & Dream Placement Tier Radar',
  ];

  const handleLearnMore = () => {
    const el = document.getElementById('features');
    if (el) {
      el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: '#000000', color: '#ffffff' }}>
      {/* 1. Fullscreen Hero Ascii Component (Vitruvian Man 3D Animation & Technical UI) */}
      <HeroAscii
        onGetStarted={isLoggedIn ? handleEnter : handleLogin}
        onLearnMore={handleLearnMore}
        isLoggedIn={isLoggedIn}
        studentName={studentName}
        currentTheme={currentTheme}
        onSelectTheme={onSelectTheme}
      />

      {/* 2. Infinite Marquee Ticker Ribbon */}
      <div className="caide-marquee-wrap" style={{ borderTop: '1px solid rgba(255, 255, 255, 0.15)', borderBottom: '1px solid rgba(255, 255, 255, 0.15)', background: '#050505' }}>
        <div className="caide-marquee-track">
          {[...marqueeItems, ...marqueeItems].map((text, idx) => (
            <div key={idx} className="caide-marquee-item" style={{ color: 'rgba(255, 255, 255, 0.8)' }}>
              <CheckCircle2 size={16} />
              <span>{text}</span>
              <div className="caide-marquee-dot"></div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Bento Capability Matrix */}
      <section id="features" style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '80px 32px 60px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '56px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 14px', borderRadius: '9999px', background: 'rgba(255, 255, 255, 0.08)', border: '1px solid rgba(255, 255, 255, 0.2)', marginBottom: '16px' }}>
            <span style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '1px', color: '#ffffff', fontFamily: 'var(--font-mono, monospace)' }}>
              002 // CORE SUBSYSTEMS
            </span>
          </div>
          <h2 style={{ fontSize: '2.6rem', fontWeight: 900, color: '#ffffff', letterSpacing: '-0.5px', fontFamily: 'var(--font-heading, sans-serif)' }}>
            Engineered for Academic Mastery
          </h2>
          <p style={{ fontSize: '1.05rem', color: 'rgba(255, 255, 255, 0.7)', maxWidth: '640px', margin: '12px auto 0 auto', lineHeight: 1.6 }}>
            Consolidated university intelligence eliminating the friction of manual portal logins, missed deadlines, and attendance surprises.
          </p>
        </div>

        {/* Bento Grid (4 Architectural Blocks with Spotlight hover animation) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(100%, 300px), 1fr))', gap: '24px' }}>
          {/* Card 1: 75% Attendance Defense */}
          <div className="caide-layer-card-wrap">
            <Spotlight asChild color="#10B981" size={320}>
              <div className="caide-card-main" style={{ background: '#0a0a0a', borderColor: '#222' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div className="stat-card-icon-wrap" style={{ color: 'var(--accent-emerald)' }}>
                    <Percent size={20} />
                  </div>
                  <span className="status-badge safe">75% Defended</span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                  Mathematical Attendance Defense
                </h3>
                <p style={{ fontSize: '0.90rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.6, marginBottom: '16px' }}>
                  Automated projection of safe leaves, recovery quotas, and debarment warnings calculated dynamically from verified VTOP attendance counts.
                </p>
                <div style={{ padding: '12px 14px', borderRadius: '6px', background: '#121212', border: '1px solid #282828', fontSize: '0.80rem', fontFamily: 'var(--font-mono, monospace)', color: 'var(--accent-cyan)' }}>
                  formula: Math.floor((attended - 0.75 * conducted) / 0.75)
                </div>
              </div>
            </Spotlight>
            <div className="caide-layer-back"></div>
          </div>

          {/* Card 2: Unified Teams & LMS Coursework */}
          <div className="caide-layer-card-wrap" id="integrations">
            <Spotlight asChild color="#4C8DFF" size={320}>
              <div className="caide-card-main" style={{ background: '#0a0a0a', borderColor: '#222' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div className="stat-card-icon-wrap" style={{ color: 'var(--accent-blue)' }}>
                    <Layers size={20} />
                  </div>
                  <span className="status-badge info">Multi-Portal</span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                  Unified Multi-Platform Deadlines
                </h3>
                <p style={{ fontSize: '0.90rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.6, marginBottom: '16px' }}>
                  Single-button global synchronization that aggregates Microsoft Teams assignments, Moodle quizzes, and digital submissions.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="status-badge neutral">Teams Channels</span>
                  <span className="status-badge neutral">Moodle Dropboxes</span>
                  <span className="status-badge neutral">Digital DA1/DA2</span>
                </div>
              </div>
            </Spotlight>
            <div className="caide-layer-back"></div>
          </div>

          {/* Card 3: AI Adaptive Study Planner */}
          <div className="caide-layer-card-wrap" id="baby-ai">
            <Spotlight asChild color="#B575FF" size={320}>
              <div className="caide-card-main" style={{ background: '#0a0a0a', borderColor: '#222' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div className="stat-card-icon-wrap" style={{ color: 'var(--accent-purple)' }}>
                    <BrainCircuit size={20} />
                  </div>
                  <span className="status-badge ai">BABY AI</span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                  Adaptive Recovery &amp; Exam Planner
                </h3>
                <p style={{ fontSize: '0.90rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.6, marginBottom: '16px' }}>
                  AI-generated revision schedules calibrated against your impending CAT 1, CAT 2, and FAT exam dates and internal marks scores.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="status-badge safe">High Priority Recovery</span>
                  <span className="status-badge neutral">Exam Schedule Sync</span>
                </div>
              </div>
            </Spotlight>
            <div className="caide-layer-back"></div>
          </div>

          {/* Card 4: Placements & DSA Tracker */}
          <div className="caide-layer-card-wrap">
            <Spotlight asChild color="#FF7849" size={320}>
              <div className="caide-card-main" style={{ background: '#0a0a0a', borderColor: '#222' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                  <div className="stat-card-icon-wrap" style={{ color: 'var(--accent-orange)' }}>
                    <Award size={20} />
                  </div>
                  <span className="status-badge warning">Super Dream</span>
                </div>
                <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: '#ffffff', marginBottom: '8px' }}>
                  Placement Readiness &amp; Coding Radar
                </h3>
                <p style={{ fontSize: '0.90rem', color: 'rgba(255, 255, 255, 0.7)', lineHeight: 1.6, marginBottom: '16px' }}>
                  Instant qualification status across Super Dream (≥8.00 CGPA) and Dream company cutoffs combined with active LeetCode tracking.
                </p>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  <span className="status-badge safe">0 Active Arrears</span>
                  <span className="status-badge info">LeetCode Sync</span>
                </div>
              </div>
            </Spotlight>
            <div className="caide-layer-back"></div>
          </div>
        </div>
      </section>

      {/* 4. Bottom Footer with Back-to-Top and VTOP Sign-in */}
      <footer
        id="security"
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.15)',
          backgroundColor: '#050505',
          padding: '40px 32px 32px 32px',
          marginTop: 'auto',
        }}
      >
        <div
          style={{
            maxWidth: '1440px',
            margin: '0 auto',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '20px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="brand-icon-box" style={{ width: '28px', height: '28px' }}>
                <ShieldCheck size={16} />
              </div>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: '#ffffff' }}>
                Campus<span className="brand-title-os">OS</span>
              </span>
            </div>
            <p style={{ fontSize: '0.80rem', color: 'rgba(255, 255, 255, 0.5)', margin: 0, fontFamily: 'var(--font-mono, monospace)' }}>
              Autonomous Academic Operating System // Zero Cloud Credential Storage
            </p>
          </div>

          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <button
              onClick={scrollToTop}
              type="button"
              className="px-4 py-2 text-xs font-mono border border-white/20 hover:border-white text-white/80 hover:text-white rounded transition-colors flex items-center gap-1.5"
            >
              <ArrowUp size={12} />
              <span>TOP</span>
            </button>
            <button
              onClick={isLoggedIn ? handleEnter : handleLogin}
              type="button"
              className="px-5 py-2 text-xs font-mono font-bold bg-white text-black hover:bg-neutral-200 transition-colors"
            >
              {isLoggedIn ? 'ENTER DASHBOARD' : 'SIGN IN (VTOP)'}
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
