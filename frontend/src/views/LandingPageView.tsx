import React from 'react';
import {
  ShieldCheck,
  Award,
  Layers,
  Sparkles,
  ArrowRight,
  BrainCircuit,
  Percent,
  CheckCircle2,
  Lock,
  Clock,
} from 'lucide-react';
import { RobotCanvas } from '../components/RobotCanvas';

interface LandingPageViewProps {
  onOpenLogin?: () => void;
  onEnterApp?: () => void;
  onSignIn?: () => void;
  onExplore?: () => void;
  studentName?: string;
  isLoggedIn?: boolean;
  authStatus?: { authenticated: boolean; studentName?: string; regNo?: string };
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenLogin,
  onEnterApp,
  onSignIn,
  onExplore,
  studentName: _studentName,
  isLoggedIn: _isLoggedIn,
  authStatus: _authStatus,
}) => {
  const handleLogin = onOpenLogin || onSignIn || (() => {});
  const handleEnter = onEnterApp || onExplore || (() => {});

  const marqueeItems = [
    'GDPR & FERPA Compliant Local Extraction',
    '75% Attendance Safe-Bunk Calculator',
    'VIT Chennai & Vellore Multi-Campus Support',
    'Unified Microsoft Teams & Moodle LMS Sync',
    'Zero Cloud Credential Storage',
    'Automated AI CAT & FAT Planner',
    'Super Dream & Dream Placement Tier Radar',
  ];

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', backgroundColor: 'var(--bg-primary)' }}>
      {/* 1. Caide-Style Header Navigation Bar */}
      <header
        style={{
          height: '74px',
          borderBottom: '1px solid var(--border-card)',
          backgroundColor: 'rgba(7, 8, 13, 0.85)',
          backdropFilter: 'blur(20px)',
          position: 'sticky',
          top: 0,
          zIndex: 50,
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div
          style={{
            maxWidth: '1440px',
            width: '100%',
            margin: '0 auto',
            padding: '0 32px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          {/* Logo Brand Block */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div className="brand-icon-box" style={{ width: '38px', height: '38px' }}>
              <ShieldCheck size={20} />
            </div>
            <div>
              <span style={{ fontSize: '1.25rem', fontWeight: 850, letterSpacing: '-0.3px', color: 'var(--text-primary)' }}>
                Campus<span className="brand-title-os">OS</span>
              </span>
            </div>
          </div>

          {/* Center Navigation Links (with underline animation) */}
          <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }}>
            <a href="#features" className="underline-link">Features</a>
            <a href="#integrations" className="underline-link">Integrations</a>
            <a href="#baby-ai" className="underline-link">BABY Copilot</a>
            <a href="#security" className="underline-link">Privacy &amp; Security</a>
          </nav>

          {/* Action CTAs */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <button onClick={handleLogin} className="btn btn-primary btn-sm">
              <span>Sign In (VTOP)</span>
              <ArrowRight size={14} />
            </button>
            <button onClick={handleEnter} className="btn btn-secondary btn-sm">
              <span>Explore Demo</span>
            </button>
          </div>
        </div>
      </header>

      {/* 2. Hero Section (2-Column Layout) */}
      <section style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '60px 32px 40px 32px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: '48px', alignItems: 'center' }}>
          {/* Left Column: Heading, Subtitle & CTAs */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', width: 'fit-content', padding: '6px 14px', borderRadius: 'var(--radius-full)', background: 'rgba(45, 231, 211, 0.08)', border: '1px solid rgba(45, 231, 211, 0.25)' }}>
              <Sparkles size={14} color="var(--accent-cyan)" />
              <span style={{ fontSize: '0.80rem', fontWeight: 700, color: 'var(--accent-cyan)', letterSpacing: '0.4px', textTransform: 'uppercase' }}>
                University Academic Operating System
              </span>
            </div>

            <h1
              style={{
                fontSize: 'clamp(2.5rem, 4.5vw, 4rem)',
                fontWeight: 900,
                color: 'var(--text-primary)',
                letterSpacing: '-1px',
                lineHeight: 1.15,
                margin: 0,
              }}
            >
              Master Your Campus Routine{' '}
              <span
                style={{
                  background: 'linear-gradient(135deg, #2DE7D3 0%, #B575FF 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                Without Breaking a Sweat
              </span>
            </h1>

            <p style={{ fontSize: '1.05rem', color: 'var(--text-secondary)', lineHeight: 1.65, maxWidth: '580px', margin: 0 }}>
              CampusOS connects directly to VTOP, Microsoft Teams, and Moodle LMS to automate your 75% attendance defense, coursework deadlines, continuous assessments, and placement targets in one high-performance interface.
            </p>

            {/* CTA Button Group */}
            <div style={{ display: 'flex', gap: '14px', alignItems: 'center', flexWrap: 'wrap', marginTop: '8px' }}>
              <button
                onClick={handleLogin}
                className="btn btn-primary btn-lg"
                style={{ display: 'flex', alignItems: 'center', gap: '10px' }}
              >
                <span>Connect VTOP Account</span>
                <ArrowRight size={16} />
              </button>

              <button
                onClick={handleEnter}
                className="btn btn-secondary btn-lg"
              >
                Live Academic Radar
              </button>
            </div>

            {/* Security Guarantee Text */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.82rem', color: 'var(--text-muted)', marginTop: '4px' }}>
              <Lock size={14} color="var(--accent-emerald)" />
              <span>Zero-Storage Architecture: Credentials and session cookies never touch external cloud servers.</span>
            </div>
          </div>

          {/* Right Column: 3D Cursor-Tracking BABY Robot + Floating Notifications + Introduction */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '20px' }}>
            {/* Robot Stage with Floating Notifications */}
            <div
              style={{
                position: 'relative',
                width: '100%',
                maxWidth: '460px',
                height: '380px',
                borderRadius: 'var(--radius-hero)',
                background: 'radial-gradient(circle at center, rgba(45, 231, 211, 0.12) 0%, rgba(16, 18, 28, 0.85) 75%)',
                border: '1px solid var(--border-medium)',
                boxShadow: 'var(--shadow-elevated)',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                overflow: 'hidden',
              }}
            >
              {/* Floating Caide Notification Pill (Top Right) */}
              <div
                className="caide-notification-pill"
                style={{ position: 'absolute', top: '16px', right: '16px', zIndex: 10, pointerEvents: 'none' }}
              >
                <div className="caide-notif-icon-box" style={{ color: 'var(--accent-emerald)' }}>
                  <Percent size={16} />
                </div>
                <div>
                  <div className="caide-notif-title">Attendance Safe Buffer</div>
                  <div className="caide-notif-desc">+3 Bunks Available (84.2%)</div>
                </div>
              </div>

              {/* Interactive 3D Cursor-Following Robot Canvas */}
              <div style={{ width: '100%', height: '100%', position: 'relative', zIndex: 2 }}>
                <RobotCanvas />
              </div>

              {/* Floating Caide Notification Pill (Bottom Left) */}
              <div
                className="caide-notification-pill"
                style={{ position: 'absolute', bottom: '16px', left: '16px', zIndex: 10, pointerEvents: 'none' }}
              >
                <div className="caide-notif-icon-box" style={{ color: 'var(--accent-orange)' }}>
                  <Clock size={16} />
                </div>
                <div>
                  <div className="caide-notif-title">Assignment Due Tonight</div>
                  <div className="caide-notif-desc">Moodle LMS • 11:59 PM</div>
                </div>
              </div>
            </div>

            {/* BABY PERSONAL INTRODUCTION BLOCK (Strictly Below Robot) */}
            <div
              className="caide-layer-card-wrap"
              style={{ width: '100%', maxWidth: '460px' }}
              id="baby-ai"
            >
              <div className="caide-card-main" style={{ padding: '20px 24px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '6px' }}>
                  <span className="status-badge ai" style={{ fontSize: '0.74rem' }}>
                    BABY Autonomous Copilot
                  </span>
                </div>
                <h3 style={{ fontSize: '1.20rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px', margin: '0 0 6px 0' }}>
                  Hi, I’m BABY.
                </h3>
                <p style={{ fontSize: '0.90rem', color: 'var(--text-secondary)', lineHeight: 1.55, margin: 0 }}>
                  I’ll plan and fix your academic routines, compute attendance thresholds, and help you prepare for super dream placements.
                </p>
              </div>
              <div className="caide-layer-back"></div>
            </div>
          </div>
        </div>
      </section>

      {/* 3. Caide Infinite Marquee Ticker Ribbon */}
      <div className="caide-marquee-wrap">
        <div className="caide-marquee-track">
          {[...marqueeItems, ...marqueeItems].map((text, idx) => (
            <div key={idx} className="caide-marquee-item">
              <CheckCircle2 size={16} />
              <span>{text}</span>
              <div className="caide-marquee-dot"></div>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Caide Bento Capability Matrix */}
      <section id="features" style={{ maxWidth: '1440px', width: '100%', margin: '0 auto', padding: '60px 32px' }}>
        <div style={{ textAlign: 'center', marginBottom: '48px' }}>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: '8px', padding: '4px 12px', borderRadius: 'var(--radius-full)', background: 'rgba(255, 255, 255, 0.06)', border: '1px solid var(--border-subtle)', marginBottom: '12px' }}>
            <span style={{ fontSize: '0.76rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.6px', color: 'var(--accent-cyan)' }}>
              Engineered for University Excellence
            </span>
          </div>
          <h2 style={{ fontSize: '2.4rem', fontWeight: 900, color: 'var(--text-primary)', letterSpacing: '-0.5px' }}>
            Everything You Need in One Unified Radar
          </h2>
          <p style={{ fontSize: '1rem', color: 'var(--text-secondary)', maxWidth: '640px', margin: '8px auto 0 auto' }}>
            Consolidated intelligence eliminating the need to log into multiple fragmented portals each morning.
          </p>
        </div>

        {/* Bento Grid (4 Architectural Blocks) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '24px' }}>
          {/* Card 1: 75% Attendance Defense */}
          <div className="caide-layer-card-wrap">
            <div className="caide-card-main">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div className="stat-card-icon-wrap" style={{ color: 'var(--accent-emerald)' }}>
                  <Percent size={20} />
                </div>
                <span className="status-badge safe">75% Defended</span>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Mathematical Attendance Defense
              </h3>
              <p style={{ fontSize: '0.90rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                Automated projection of safe leaves, recovery quotas, and debarment warnings calculated dynamically from verified VTOP attendance counts.
              </p>
              <div style={{ padding: '12px 14px', borderRadius: 'var(--radius-sm)', background: 'var(--surface-input)', border: '1px solid var(--border-subtle)', fontSize: '0.80rem', fontFamily: 'var(--font-mono)', color: 'var(--accent-cyan)' }}>
                formula: Math.floor((attended - 0.75 * conducted) / 0.75)
              </div>
            </div>
            <div className="caide-layer-back"></div>
          </div>

          {/* Card 2: Unified Teams & LMS Coursework */}
          <div className="caide-layer-card-wrap" id="integrations">
            <div className="caide-card-main">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div className="stat-card-icon-wrap" style={{ color: 'var(--accent-blue)' }}>
                  <Layers size={20} />
                </div>
                <span className="status-badge info">Multi-Portal</span>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Unified Multi-Platform Deadlines
              </h3>
              <p style={{ fontSize: '0.90rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                Single-button global synchronization that aggregates Microsoft Teams assignments, Moodle quizzes, and digital submissions.
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className="status-badge neutral">Teams Channels</span>
                <span className="status-badge neutral">Moodle Dropboxes</span>
                <span className="status-badge neutral">Digital DA1/DA2</span>
              </div>
            </div>
            <div className="caide-layer-back"></div>
          </div>

          {/* Card 3: AI Adaptive Study Planner */}
          <div className="caide-layer-card-wrap">
            <div className="caide-card-main">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div className="stat-card-icon-wrap" style={{ color: 'var(--accent-purple)' }}>
                  <BrainCircuit size={20} />
                </div>
                <span className="status-badge ai">BABY AI</span>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Adaptive Recovery &amp; Exam Planner
              </h3>
              <p style={{ fontSize: '0.90rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                AI-generated revision schedules calibrated against your impending CAT 1, CAT 2, and FAT exam dates and internal marks scores.
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className="status-badge safe">High Priority Recovery</span>
                <span className="status-badge neutral">Exam Schedule Sync</span>
              </div>
            </div>
            <div className="caide-layer-back"></div>
          </div>

          {/* Card 4: Placements & DSA Tracker */}
          <div className="caide-layer-card-wrap">
            <div className="caide-card-main">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div className="stat-card-icon-wrap" style={{ color: 'var(--accent-orange)' }}>
                  <Award size={20} />
                </div>
                <span className="status-badge warning">Super Dream</span>
              </div>
              <h3 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)', marginBottom: '8px' }}>
                Placement Readiness &amp; Coding Radar
              </h3>
              <p style={{ fontSize: '0.90rem', color: 'var(--text-secondary)', lineHeight: 1.6, marginBottom: '16px' }}>
                Instant qualification status across Super Dream (≥8.00 CGPA) and Dream company cutoffs combined with active LeetCode tracking.
              </p>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                <span className="status-badge safe">0 Active Arrears</span>
                <span className="status-badge info">LeetCode Sync</span>
              </div>
            </div>
            <div className="caide-layer-back"></div>
          </div>
        </div>
      </section>

      {/* 5. Modern Caide Footer */}
      <footer
        id="security"
        style={{
          borderTop: '1px solid var(--border-card)',
          backgroundColor: 'var(--surface-primary)',
          padding: '48px 32px 36px 32px',
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
            gap: '24px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <div className="brand-icon-box" style={{ width: '28px', height: '28px' }}>
                <ShieldCheck size={16} />
              </div>
              <span style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                Campus<span className="brand-title-os">OS</span>
              </span>
            </div>
            <p style={{ fontSize: '0.80rem', color: 'var(--text-muted)', margin: 0 }}>
              Autonomous Academic Operating System for VIT University Students.
            </p>
          </div>

          <div style={{ display: 'flex', gap: '24px', alignItems: 'center' }}>
            <span style={{ fontSize: '0.80rem', color: 'var(--text-muted)' }}>
              © 2026 CampusOS. All systems operational.
            </span>
            <button onClick={handleLogin} className="btn btn-primary btn-sm">
              Sign In to VTOP
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
