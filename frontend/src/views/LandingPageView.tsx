import React from 'react';
import {
  Shield,
  Zap,
  Clock,
  BookOpen,
  CheckCircle,
  AlertTriangle,
  Sparkles,
  ArrowRight,
  LogIn,
  ChevronRight,
  Brain,
  Code2,
  GraduationCap,
} from 'lucide-react';
import { RobotCanvas } from '../components/RobotCanvas';

interface LandingPageViewProps {
  onOpenLogin: () => void;
  onEnterApp: () => void;
  studentName?: string;
  isLoggedIn?: boolean;
}

export const LandingPageView: React.FC<LandingPageViewProps> = ({
  onOpenLogin,
  onEnterApp,
  isLoggedIn = false,
}) => {

  return (
    <div
      style={{
        minHeight: '100vh',
        backgroundColor: '#07090e',
        color: '#f8fafc',
        fontFamily: "'Inter', system-ui, sans-serif",
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      {/* Background Cybernetic Ambient Glows */}
      <div
        style={{
          position: 'absolute',
          top: '-150px',
          left: '50%',
          transform: 'translateX(-50%)',
          width: '900px',
          height: '550px',
          background: 'radial-gradient(circle, rgba(45, 231, 211, 0.12) 0%, rgba(168, 85, 247, 0.08) 45%, transparent 70%)',
          filter: 'blur(90px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />
      <div
        style={{
          position: 'absolute',
          top: '600px',
          right: '-100px',
          width: '600px',
          height: '600px',
          background: 'radial-gradient(circle, rgba(56, 189, 248, 0.08) 0%, transparent 70%)',
          filter: 'blur(100px)',
          pointerEvents: 'none',
          zIndex: 0,
        }}
      />

      {/* --- Sticky Top Navigation Bar --- */}
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 50,
          backdropFilter: 'blur(20px)',
          backgroundColor: 'rgba(7, 9, 14, 0.82)',
          borderBottom: '1px solid rgba(255, 255, 255, 0.07)',
          padding: '0 32px',
          height: '72px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        {/* Brand Logo */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '12px',
              background: 'linear-gradient(135deg, #2de7d3 0%, #3b82f6 50%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: '0 0 20px rgba(45, 231, 211, 0.35)',
            }}
          >
            <Zap size={22} color="#07090e" strokeWidth={2.6} />
          </div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontWeight: 800, fontSize: '1.2rem', letterSpacing: '-0.02em', color: '#FFFFFF' }}>
                Campus<span style={{ color: '#2de7d3' }}>OS</span>
              </span>
              <span
                style={{
                  fontSize: '0.68rem',
                  fontWeight: 700,
                  padding: '2px 8px',
                  borderRadius: '100px',
                  background: 'rgba(45, 231, 211, 0.12)',
                  color: '#2de7d3',
                  border: '1px solid rgba(45, 231, 211, 0.3)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                v2.0 Core
              </span>
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Academic Operating System</span>
          </div>
        </div>

        {/* Navigation Links */}
        <nav style={{ display: 'flex', alignItems: 'center', gap: '28px' }} className="desktop-nav">
          <a
            href="#problem"
            style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 500, transition: 'color 0.2s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#2de7d3')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            Why CampusOS
          </a>
          <a
            href="#integrations"
            style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 500, transition: 'color 0.2s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#2de7d3')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            Integrations (Teams • LMS • VTOP)
          </a>
          <a
            href="#features"
            style={{ color: '#94a3b8', textDecoration: 'none', fontSize: '0.88rem', fontWeight: 500, transition: 'color 0.2s' }}
            onMouseEnter={(e) => (e.currentTarget.style.color = '#2de7d3')}
            onMouseLeave={(e) => (e.currentTarget.style.color = '#94a3b8')}
          >
            Features & Radar
          </a>
        </nav>

        {/* Top Right Buttons (Login & Launch OS) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          {/* Top Right Login Option */}
          <button
            onClick={onOpenLogin}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 18px',
              borderRadius: '10px',
              backgroundColor: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.12)',
              color: '#f8fafc',
              fontSize: '0.88rem',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(45, 231, 211, 0.1)';
              e.currentTarget.style.borderColor = 'rgba(45, 231, 211, 0.4)';
              e.currentTarget.style.color = '#2de7d3';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.05)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
              e.currentTarget.style.color = '#f8fafc';
            }}
          >
            <LogIn size={16} />
            <span>Sign In</span>
          </button>

          {/* Launch Dashboard Button */}
          <button
            onClick={onEnterApp}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 20px',
              borderRadius: '10px',
              background: 'linear-gradient(135deg, #2de7d3 0%, #38bdf8 100%)',
              border: 'none',
              color: '#07090e',
              fontSize: '0.88rem',
              fontWeight: 700,
              cursor: 'pointer',
              boxShadow: '0 0 20px rgba(45, 231, 211, 0.3)',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.transform = 'translateY(-1px)';
              e.currentTarget.style.boxShadow = '0 0 28px rgba(45, 231, 211, 0.5)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.transform = 'translateY(0)';
              e.currentTarget.style.boxShadow = '0 0 20px rgba(45, 231, 211, 0.3)';
            }}
          >
            <span>{isLoggedIn ? 'Go to Dashboard' : 'Launch OS'}</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </header>

      {/* --- HERO SECTION WITH 3D WEBGL ROBOT COMPANION --- */}
      <section
        style={{
          position: 'relative',
          padding: '60px 32px 100px 32px',
          maxWidth: '1360px',
          margin: '0 auto',
          display: 'grid',
          gridTemplateColumns: '1.15fr 0.85fr',
          gap: '40px',
          alignItems: 'center',
          minHeight: 'calc(88vh - 72px)',
          zIndex: 1,
        }}
      >
        {/* Left Column: Headline, Narrative & Center Login Button */}
        <div>
          {/* Futuristic Eyebrow Badge */}
          <div
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '6px 14px',
              borderRadius: '100px',
              backgroundColor: 'rgba(45, 231, 211, 0.08)',
              border: '1px solid rgba(45, 231, 211, 0.28)',
              marginBottom: '24px',
            }}
          >
            <Sparkles size={15} color="#2de7d3" />
            <span style={{ fontSize: '0.80rem', fontWeight: 700, color: '#2de7d3', letterSpacing: '0.04em' }}>
              UNIFIED ACADEMIC NEURAL INTELLIGENCE
            </span>
          </div>

          {/* Massive Cyberpunk Gradient Headline */}
          <h1
            style={{
              fontSize: 'clamp(2.4rem, 4.2vw, 3.8rem)',
              fontWeight: 850,
              lineHeight: 1.12,
              letterSpacing: '-0.035em',
              margin: '0 0 20px 0',
            }}
          >
            Never Miss an Assignment.{' '}
            <span
              style={{
                background: 'linear-gradient(135deg, #2de7d3 0%, #60a5fa 50%, #c084fc 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                display: 'block',
              }}
            >
              All Your Portals, Unified.
            </span>
          </h1>

          {/* Problem & Value Pitch */}
          <p
            style={{
              fontSize: '1.08rem',
              lineHeight: 1.65,
              color: '#94a3b8',
              margin: '0 0 36px 0',
              maxWidth: '580px',
            }}
          >
            Tired of missing critical 11:59 PM deadlines and juggling 5 separate tabs?
            <strong style={{ color: '#f1f5f9' }}> CampusOS </strong>
            seamlessly connects <span style={{ color: '#60a5fa' }}>Microsoft Teams</span>,{' '}
            <span style={{ color: '#f97316' }}>Moodle LMS</span>, and{' '}
            <span style={{ color: '#2de7d3' }}>VTOP</span> into one automated operating system.
            No more manual checks, no more attendance anxiety.
          </p>

          {/* --- CENTER SCREEN LOGIN BUTTON & CTA SECTION --- */}
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '16px',
              maxWidth: '520px',
              margin: '0 0 40px 0',
            }}
          >
            <div style={{ display: 'flex', gap: '14px', flexWrap: 'wrap' }}>
              {/* Massive Main Login Button */}
              <button
                onClick={onOpenLogin}
                style={{
                  flex: 1,
                  minWidth: '220px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '12px',
                  padding: '16px 28px',
                  borderRadius: '14px',
                  background: 'linear-gradient(135deg, #20e3d0 0%, #38bdf8 50%, #a855f7 100%)',
                  border: 'none',
                  color: '#07090e',
                  fontSize: '1.05rem',
                  fontWeight: 800,
                  cursor: 'pointer',
                  boxShadow: '0 0 35px rgba(45, 231, 211, 0.45)',
                  transition: 'all 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                  e.currentTarget.style.boxShadow = '0 0 45px rgba(45, 231, 211, 0.65)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.transform = 'translateY(0) scale(1)';
                  e.currentTarget.style.boxShadow = '0 0 35px rgba(45, 231, 211, 0.45)';
                }}
              >
                <LogIn size={20} strokeWidth={2.8} />
                <span>Sign In to CampusOS</span>
              </button>

              {/* Secondary Enter App Button */}
              <button
                onClick={onEnterApp}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  padding: '16px 24px',
                  borderRadius: '14px',
                  backgroundColor: 'rgba(255, 255, 255, 0.04)',
                  border: '1px solid rgba(255, 255, 255, 0.12)',
                  color: '#f8fafc',
                  fontSize: '0.98rem',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.08)';
                  e.currentTarget.style.borderColor = '#2de7d3';
                  e.currentTarget.style.color = '#2de7d3';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.backgroundColor = 'rgba(255, 255, 255, 0.04)';
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)';
                  e.currentTarget.style.color = '#f8fafc';
                }}
              >
                <span>Live Dashboard</span>
                <ChevronRight size={18} />
              </button>
            </div>

            <p style={{ fontSize: '0.78rem', color: '#64748b', margin: 0 }}>
              🔒 Zero credentials stored. Direct SSL portal synchronization.
            </p>
          </div>

          {/* Quick Pillar Metric Badges */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: '12px',
              maxWidth: '560px',
            }}
          >
            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
              }}
            >
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2de7d3' }}>3-in-1</div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>Teams + LMS + VTOP</div>
            </div>

            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
              }}
            >
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>75% Safety</div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>Attendance Shield</div>
            </div>

            <div
              style={{
                padding: '14px 16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid rgba(255, 255, 255, 0.07)',
              }}
            >
              <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#c084fc' }}>AI Planner</div>
              <div style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '2px' }}>Automated Radar</div>
            </div>
          </div>
        </div>

        {/* Right Column: Interactive 3D WebGL Robot Canvas with Cursor Tracking */}
        <div
          style={{
            position: 'relative',
            height: '560px',
            width: '100%',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {/* Cybernetic Aura Ring behind Robot */}
          <div
            style={{
              position: 'absolute',
              width: '420px',
              height: '420px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(45, 231, 211, 0.15) 0%, rgba(168, 85, 247, 0.05) 50%, transparent 70%)',
              filter: 'blur(40px)',
              pointerEvents: 'none',
            }}
          />

          {/* Floating Robot Interactive Badge */}
          <div
            style={{
              position: 'absolute',
              top: '20px',
              right: '20px',
              zIndex: 10,
              padding: '6px 12px',
              borderRadius: '8px',
              backgroundColor: 'rgba(7, 9, 14, 0.85)',
              border: '1px solid rgba(45, 231, 211, 0.3)',
              fontSize: '0.72rem',
              color: '#2de7d3',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              backdropFilter: 'blur(10px)',
            }}
          >
            <span
              style={{
                width: '6px',
                height: '6px',
                borderRadius: '50%',
                backgroundColor: '#2de7d3',
                boxShadow: '0 0 8px #2de7d3',
                animation: 'pulse 1.5s infinite',
              }}
            />
            <span>3D WebGL Neural Core • Move Cursor to Interact</span>
          </div>

          {/* WebGL Canvas */}
          <RobotCanvas onInteract={onOpenLogin} />

          {/* Floating Feature Chip 1: Teams Sync */}
          <div
            style={{
              position: 'absolute',
              bottom: '40px',
              left: '10px',
              zIndex: 10,
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(15, 20, 32, 0.85)',
              border: '1px solid rgba(59, 130, 246, 0.35)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa',
              }}
            >
              <BookOpen size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#FFFFFF' }}>Teams & Moodle Live</div>
              <div style={{ fontSize: '0.68rem', color: '#94a3b8' }}>Real-time assignment extraction</div>
            </div>
          </div>

          {/* Floating Feature Chip 2: Attendance Radar */}
          <div
            style={{
              position: 'absolute',
              top: '90px',
              left: '0px',
              zIndex: 10,
              padding: '12px 16px',
              borderRadius: '12px',
              backgroundColor: 'rgba(15, 20, 32, 0.85)',
              border: '1px solid rgba(45, 231, 211, 0.35)',
              backdropFilter: 'blur(12px)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              boxShadow: '0 10px 30px rgba(0, 0, 0, 0.5)',
            }}
          >
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                backgroundColor: 'rgba(45, 231, 211, 0.2)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2de7d3',
              }}
            >
              <Shield size={16} />
            </div>
            <div>
              <div style={{ fontSize: '0.78rem', fontWeight: 700, color: '#FFFFFF' }}>Attendance Radar</div>
              <div style={{ fontSize: '0.68rem', color: '#2de7d3' }}>Active safety calculation</div>
            </div>
          </div>
        </div>
      </section>

      {/* --- SECTION 2: THE PROBLEM VS THE CAMPUSOS SOLUTION --- */}
      <section
        id="problem"
        style={{
          padding: '90px 32px',
          maxWidth: '1280px',
          margin: '0 auto',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 60px auto' }}>
          <div style={{ fontSize: '0.80rem', fontWeight: 700, color: '#2de7d3', letterSpacing: '0.08em', marginBottom: '8px' }}>
            WHY WE BUILT CAMPUSOS
          </div>
          <h2 style={{ fontSize: '2.3rem', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 16px 0' }}>
            The Student Multi-Portal Chaos — Solved.
          </h2>
          <p style={{ fontSize: '1rem', color: '#94a3b8', lineHeight: 1.6 }}>
            Managing college shouldn’t require keeping 10 browser tabs open just to check if you have a quiz tomorrow.
          </p>
        </div>

        {/* Comparison Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: '1fr 1fr',
            gap: '28px',
          }}
        >
          {/* Without CampusOS (The Pain) */}
          <div
            style={{
              padding: '36px',
              borderRadius: '20px',
              backgroundColor: 'rgba(239, 68, 68, 0.03)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#f87171',
                fontWeight: 700,
                fontSize: '1rem',
                marginBottom: '20px',
              }}
            >
              <AlertTriangle size={20} />
              <span>Without CampusOS: Fragmented Chaos</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ color: '#f87171', fontWeight: 700 }}>✕</span>
                <div>
                  <strong style={{ color: '#f1f5f9', fontSize: '0.92rem' }}>Missed 11:59 PM Deadlines:</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
                    Assignments posted in deep Teams channels or LMS forums get lost until it's too late.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ color: '#f87171', fontWeight: 700 }}>✕</span>
                <div>
                  <strong style={{ color: '#f1f5f9', fontSize: '0.92rem' }}>Constant Tab Switching:</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
                    Logging in separately to VTOP, Microsoft Teams, and Moodle every single morning.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ color: '#f87171', fontWeight: 700 }}>✕</span>
                <div>
                  <strong style={{ color: '#f1f5f9', fontSize: '0.92rem' }}>Attendance Guesswork:</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
                    No clue how many classes you can afford to miss before dropping below the 75% threshold.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* With CampusOS (The Superpower) */}
          <div
            style={{
              padding: '36px',
              borderRadius: '20px',
              backgroundColor: 'rgba(45, 231, 211, 0.04)',
              border: '1px solid rgba(45, 231, 211, 0.35)',
              position: 'relative',
              overflow: 'hidden',
              boxShadow: '0 0 40px rgba(45, 231, 211, 0.08)',
            }}
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                color: '#2de7d3',
                fontWeight: 700,
                fontSize: '1rem',
                marginBottom: '20px',
              }}
            >
              <CheckCircle size={20} />
              <span>With CampusOS: Autonomous Academic Command</span>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ color: '#2de7d3', fontWeight: 700 }}>✓</span>
                <div>
                  <strong style={{ color: '#f1f5f9', fontSize: '0.92rem' }}>Unified Deadline Radar:</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
                    Every pending lab record, assignment, and quiz consolidated into a single live urgency countdown.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ color: '#2de7d3', fontWeight: 700 }}>✓</span>
                <div>
                  <strong style={{ color: '#f1f5f9', fontSize: '0.92rem' }}>One-Click Multi-Sync:</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
                    Automated background scraping with zero credential persistence. Sync once and stay ahead.
                  </p>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                <span style={{ color: '#2de7d3', fontWeight: 700 }}>✓</span>
                <div>
                  <strong style={{ color: '#f1f5f9', fontSize: '0.92rem' }}>Live Attendance Safety Calculations:</strong>
                  <p style={{ margin: '4px 0 0 0', fontSize: '0.84rem', color: '#94a3b8' }}>
                    Instant mathematical projection of safe leaves and required attendance recovery for every course.
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* --- SECTION 3: MULTI-PLATFORM INTEGRATIONS SHOWCASE --- */}
      <section
        id="integrations"
        style={{
          padding: '90px 32px',
          maxWidth: '1280px',
          margin: '0 auto',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 60px auto' }}>
          <div style={{ fontSize: '0.80rem', fontWeight: 700, color: '#38bdf8', letterSpacing: '0.08em', marginBottom: '8px' }}>
            DIRECT PLATFORM CONNECTORS
          </div>
          <h2 style={{ fontSize: '2.3rem', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 16px 0' }}>
            Connected to the Engines You Use Daily
          </h2>
          <p style={{ fontSize: '1rem', color: '#94a3b8' }}>
            CampusOS bridges the gap between fragmented university systems through automated background sync.
          </p>
        </div>

        {/* 3 Integration Cards */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '24px',
          }}
        >
          {/* Card 1: VTOP */}
          <div
            style={{
              padding: '32px 28px',
              borderRadius: '18px',
              backgroundColor: 'rgba(15, 20, 32, 0.65)',
              border: '1px solid rgba(45, 231, 211, 0.25)',
              backdropFilter: 'blur(10px)',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(45, 231, 211, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#2de7d3',
                marginBottom: '20px',
              }}
            >
              <Zap size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 10px 0' }}>VTOP Academic Portal</h3>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              Direct automated extraction of weekly timetable, theory/lab attendance, marks ledger, exam schedule, and academic profile.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(45, 231, 211, 0.1)', color: '#2de7d3' }}>
                Timetable Grid
              </span>
              <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(45, 231, 211, 0.1)', color: '#2de7d3' }}>
                Attendance
              </span>
              <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(45, 231, 211, 0.1)', color: '#2de7d3' }}>
                Exam Schedules
              </span>
            </div>
          </div>

          {/* Card 2: Microsoft Teams */}
          <div
            style={{
              padding: '32px 28px',
              borderRadius: '18px',
              backgroundColor: 'rgba(15, 20, 32, 0.65)',
              border: '1px solid rgba(96, 165, 250, 0.25)',
              backdropFilter: 'blur(10px)',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(96, 165, 250, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#60a5fa',
                marginBottom: '20px',
              }}
            >
              <BookOpen size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 10px 0' }}>Microsoft Teams</h3>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              Scans all active course teams and classroom channels to aggregate homework assignments, project deadlines, and submissions.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa' }}>
                Class Assignments
              </span>
              <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa' }}>
                Channel Updates
              </span>
              <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(96, 165, 250, 0.1)', color: '#60a5fa' }}>
                Due Timers
              </span>
            </div>
          </div>

          {/* Card 3: Moodle LMS */}
          <div
            style={{
              padding: '32px 28px',
              borderRadius: '18px',
              backgroundColor: 'rgba(15, 20, 32, 0.65)',
              border: '1px solid rgba(249, 115, 22, 0.25)',
              backdropFilter: 'blur(10px)',
              position: 'relative',
            }}
          >
            <div
              style={{
                width: '48px',
                height: '48px',
                borderRadius: '12px',
                backgroundColor: 'rgba(249, 115, 22, 0.12)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#f97316',
                marginBottom: '20px',
              }}
            >
              <GraduationCap size={24} />
            </div>
            <h3 style={{ fontSize: '1.25rem', fontWeight: 700, margin: '0 0 10px 0' }}>Moodle LMS</h3>
            <p style={{ fontSize: '0.88rem', color: '#94a3b8', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              Extracts online course quizzes, lab reports, assessment rubrics, and submission dropboxes directly into your planner.
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '6px' }}>
              <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(249, 115, 22, 0.1)', color: '#f97316' }}>
                LMS Quizzes
              </span>
              <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(249, 115, 22, 0.1)', color: '#f97316' }}>
                Lab Uploads
              </span>
              <span style={{ fontSize: '0.72rem', padding: '3px 8px', borderRadius: '6px', background: 'rgba(249, 115, 22, 0.1)', color: '#f97316' }}>
                Course Resources
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* --- SECTION 4: BENTO FEATURE MATRIX --- */}
      <section
        id="features"
        style={{
          padding: '90px 32px',
          maxWidth: '1280px',
          margin: '0 auto',
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: '720px', margin: '0 auto 60px auto' }}>
          <div style={{ fontSize: '0.80rem', fontWeight: 700, color: '#c084fc', letterSpacing: '0.08em', marginBottom: '8px' }}>
            ENGINE SPECIFICATIONS
          </div>
          <h2 style={{ fontSize: '2.3rem', fontWeight: 800, letterSpacing: '-0.03em', margin: '0 0 16px 0' }}>
            Designed for Peak Student Productivity
          </h2>
          <p style={{ fontSize: '1rem', color: '#94a3b8' }}>
            Engineered with deep mathematical tracking, dark-mode cyberpunk ergonomics, and automated workflows.
          </p>
        </div>

        {/* Bento Grid */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(12, 1fr)',
            gap: '24px',
          }}
        >
          {/* Bento Item 1: Attendance Shield & Safe Bunk Margins (8 cols) */}
          <div
            style={{
              gridColumn: 'span 8',
              padding: '36px',
              borderRadius: '20px',
              backgroundColor: 'rgba(15, 20, 32, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              position: 'relative',
              overflow: 'hidden',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#2de7d3', marginBottom: '14px' }}>
              <Shield size={22} />
              <span style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Real-Time Attendance Safety Engine
              </span>
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 12px 0' }}>
              Never drop below 75%. Safe Bunk Margins Calculated Automatically.
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.6, maxWidth: '580px', margin: '0 0 24px 0' }}>
              CampusOS calculates exact safe bunks remaining and mandatory classes to attend for recovery across all registered theory and laboratory components.
            </p>

            {/* Visual Mini Tracker */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '14px',
                padding: '16px',
                borderRadius: '12px',
                backgroundColor: 'rgba(0, 0, 0, 0.3)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
              }}
            >
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Target Safety Threshold</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#2de7d3' }}>75.0%</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Real-Time Tracking</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#38bdf8' }}>All Registered Courses</div>
              </div>
              <div>
                <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Status Audit</div>
                <div style={{ fontSize: '1.25rem', fontWeight: 800, color: '#4ade80' }}>All Clear ✓</div>
              </div>
            </div>
          </div>

          {/* Bento Item 2: AI Study Planner (4 cols) */}
          <div
            style={{
              gridColumn: 'span 4',
              padding: '36px',
              borderRadius: '20px',
              backgroundColor: 'rgba(15, 20, 32, 0.7)',
              border: '1px solid rgba(168, 85, 247, 0.25)',
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'space-between',
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#c084fc', marginBottom: '14px' }}>
                <Brain size={22} />
                <span style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  AI Study Copilot
                </span>
              </div>
              <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 12px 0' }}>
                Smart Task Prioritization
              </h3>
              <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.6 }}>
                AI analyzes your deadlines, exam schedules, and timetable free slots to generate an optimal daily study roadmap.
              </p>
            </div>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '16px' }}>
              <span style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                ⚡ Auto-Generated Tasks
              </span>
              <span style={{ fontSize: '0.74rem', padding: '4px 10px', borderRadius: '6px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc' }}>
                🎯 Priority Matrix
              </span>
            </div>
          </div>

          {/* Bento Item 3: Placements & LeetCode (4 cols) */}
          <div
            style={{
              gridColumn: 'span 4',
              padding: '36px',
              borderRadius: '20px',
              backgroundColor: 'rgba(15, 20, 32, 0.7)',
              border: '1px solid rgba(56, 189, 248, 0.25)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#38bdf8', marginBottom: '14px' }}>
              <Code2 size={22} />
              <span style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Placements & DSA
              </span>
            </div>
            <h3 style={{ fontSize: '1.3rem', fontWeight: 800, margin: '0 0 12px 0' }}>
              Career Readiness Ledger
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.88rem', lineHeight: 1.6 }}>
              Check drive eligibility by CGPA cutoff, track your LeetCode problem solves, and monitor placement company drives.
            </p>
          </div>

          {/* Bento Item 4: Multi-Portal Deadline Radar (8 cols) */}
          <div
            style={{
              gridColumn: 'span 8',
              padding: '36px',
              borderRadius: '20px',
              backgroundColor: 'rgba(15, 20, 32, 0.7)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', color: '#f59e0b', marginBottom: '14px' }}>
              <Clock size={22} />
              <span style={{ fontWeight: 700, fontSize: '0.85rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Unified Deadline Radar
              </span>
            </div>
            <h3 style={{ fontSize: '1.5rem', fontWeight: 800, margin: '0 0 12px 0' }}>
              One Single Feed for Every Pending Homework & Quiz
            </h3>
            <p style={{ color: '#94a3b8', fontSize: '0.92rem', lineHeight: 1.6, margin: '0 0 20px 0' }}>
              Aggregated directly from your registered Microsoft Teams classrooms and LMS courses. Complete tasks with one click.
            </p>
            <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
              <span style={{ fontSize: '0.80rem', padding: '6px 12px', borderRadius: '8px', background: 'rgba(239, 68, 68, 0.15)', color: '#f87171', fontWeight: 600 }}>
                🔴 Due Today: 2 Submissions
              </span>
              <span style={{ fontSize: '0.80rem', padding: '6px 12px', borderRadius: '8px', background: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24', fontWeight: 600 }}>
                🟡 Due This Week: 5 Tasks
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* --- SECTION 5: FINAL CALL TO ACTION --- */}
      <section
        style={{
          padding: '100px 32px 140px 32px',
          maxWidth: '1000px',
          margin: '0 auto',
          textAlign: 'center',
          position: 'relative',
        }}
      >
        {/* Glow in background */}
        <div
          style={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: '600px',
            height: '350px',
            background: 'radial-gradient(circle, rgba(45, 231, 211, 0.2) 0%, rgba(168, 85, 247, 0.1) 50%, transparent 70%)',
            filter: 'blur(70px)',
            pointerEvents: 'none',
          }}
        />

        <div
          style={{
            position: 'relative',
            zIndex: 1,
            padding: '60px 40px',
            borderRadius: '28px',
            backgroundColor: 'rgba(15, 20, 32, 0.8)',
            border: '1px solid rgba(45, 231, 211, 0.35)',
            boxShadow: '0 0 60px rgba(45, 231, 211, 0.15)',
            backdropFilter: 'blur(20px)',
          }}
        >
          <div
            style={{
              width: '60px',
              height: '60px',
              borderRadius: '16px',
              background: 'linear-gradient(135deg, #2de7d3 0%, #3b82f6 50%, #a855f7 100%)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 24px auto',
              boxShadow: '0 0 30px rgba(45, 231, 211, 0.5)',
            }}
          >
            <Zap size={32} color="#07090e" strokeWidth={2.8} />
          </div>

          <h2
            style={{
              fontSize: 'clamp(2rem, 3.5vw, 2.8rem)',
              fontWeight: 850,
              letterSpacing: '-0.03em',
              margin: '0 0 16px 0',
            }}
          >
            Ready to Take Control of Your Academic Life?
          </h2>

          <p
            style={{
              fontSize: '1.05rem',
              color: '#94a3b8',
              maxWidth: '560px',
              margin: '0 auto 36px auto',
              lineHeight: 1.6,
            }}
          >
            Sign in with your university credentials and sync your entire semester in under 10 seconds.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: '16px', flexWrap: 'wrap' }}>
            <button
              onClick={onOpenLogin}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '10px',
                padding: '16px 36px',
                borderRadius: '14px',
                background: 'linear-gradient(135deg, #20e3d0 0%, #38bdf8 50%, #a855f7 100%)',
                border: 'none',
                color: '#07090e',
                fontSize: '1.05rem',
                fontWeight: 800,
                cursor: 'pointer',
                boxShadow: '0 0 35px rgba(45, 231, 211, 0.45)',
                transition: 'all 0.25s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px) scale(1.02)';
                e.currentTarget.style.boxShadow = '0 0 50px rgba(45, 231, 211, 0.7)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0) scale(1)';
                e.currentTarget.style.boxShadow = '0 0 35px rgba(45, 231, 211, 0.45)';
              }}
            >
              <LogIn size={20} strokeWidth={2.8} />
              <span>Sign In with VTOP</span>
            </button>

            <button
              onClick={onEnterApp}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '16px 28px',
                borderRadius: '14px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                color: '#f8fafc',
                fontSize: '1rem',
                fontWeight: 600,
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#2de7d3';
                e.currentTarget.style.color = '#2de7d3';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                e.currentTarget.style.color = '#f8fafc';
              }}
            >
              <span>Explore Workspace</span>
              <ArrowRight size={18} />
            </button>
          </div>
        </div>
      </section>

      {/* --- FOOTER --- */}
      <footer
        style={{
          borderTop: '1px solid rgba(255, 255, 255, 0.06)',
          padding: '40px 32px',
          textAlign: 'center',
          fontSize: '0.82rem',
          color: '#64748b',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', marginBottom: '8px' }}>
          <Zap size={16} color="#2de7d3" />
          <span style={{ fontWeight: 700, color: '#f1f5f9' }}>CampusOS v2.0 Academic Operating System</span>
        </div>
        <p style={{ margin: 0 }}>
          Designed for university students. End-to-end multi-platform integration (VTOP • MS Teams • Moodle LMS).
        </p>
      </footer>
    </div>
  );
};
