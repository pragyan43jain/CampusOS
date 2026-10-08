import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { RollText } from './RollText';

export interface HeroAsciiProps {
  onGetStarted?: () => void;
  onLearnMore?: () => void;
  isLoggedIn?: boolean;
  studentName?: string;
  currentTheme?: string;
  onSelectTheme?: (theme: any) => void;
}

export default function Home({
  onGetStarted,
  onLearnMore,
  isLoggedIn,
  studentName,
}: HeroAsciiProps = {}) {
  const [mouseOffset, setMouseOffset] = useState({ x: 0, y: 0 });

  const handleMouseMove = (e: React.MouseEvent<HTMLElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width - 0.5) * 2;
    const y = ((e.clientY - rect.top) / rect.height - 0.5) * 2;
    setMouseOffset({ x, y });
  };

  const handleMouseLeave = () => {
    setMouseOffset({ x: 0, y: 0 });
  };

  const handleStart = () => {
    if (onGetStarted) {
      onGetStarted();
    } else {
      const el = document.getElementById('features');
      if (el) el.scrollIntoView({ behavior: 'smooth' });
    }
  };

  const handleLearn = () => {
    if (onLearnMore) {
      onLearnMore();
    } else {
      const el = document.getElementById('features');
      if (el) {
        el.scrollIntoView({ behavior: 'smooth' });
      }
    }
  };

  const buttonLabel = isLoggedIn
    ? (studentName ? `ENTER AS ${studentName.split(' ')[0].toUpperCase()}` : 'ENTER DASHBOARD')
    : 'VTOP SIGN IN';

  return (
    <section 
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      className="hero relative min-h-screen overflow-hidden bg-black text-white select-none flex flex-col justify-between"
      aria-labelledby="hero-title"
    >
      {/* Aerukart Atmospheric Ambient Lighting */}
      <div aria-hidden="true" className="home-glow"></div>
      <div aria-hidden="true" className="story-light"></div>

      {/* Aerukart 12-Column Backdrop Grid */}
      <div aria-hidden="true" className="site-grid">
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
        <i></i>
      </div>

      {/* Aerukart Sticky / Fixed Top Header Bar */}
      <header className="site-header">
        {/* Left: Brand Mark */}
        <div className="flex items-center gap-3">
          <a href="/" className="flex items-center gap-2 text-white no-underline group">
            <span className="font-mono text-xl lg:text-2xl font-bold tracking-wider italic transform -skew-x-12 transition-colors group-hover:text-[#17c1fe]">
              CampusOS
            </span>
            <div className="h-3 w-px bg-white/20"></div>
            <span className="text-white/50 text-[10px] font-mono tracking-widest">EST. 2026</span>
          </a>
        </div>

        {/* Center: Aerukart Floating Frosted Nav Capsule */}
        <nav className="main-nav hidden md:inline-flex" aria-label="Main Navigation">
          <a href="#features" onClick={(e) => { e.preventDefault(); handleLearn(); }}>
            <RollText text="Subsystems" />
          </a>
          <a href="#features" onClick={(e) => { e.preventDefault(); handleLearn(); }}>
            <RollText text="Attendance 75%" />
          </a>
          <a href="#features" onClick={(e) => { e.preventDefault(); handleLearn(); }}>
            <RollText text="Deadlines" />
          </a>
          <a href="#features" onClick={(e) => { e.preventDefault(); handleLearn(); }}>
            <RollText text="Placements" />
          </a>
          <a href="#features" onClick={(e) => { e.preventDefault(); handleLearn(); }}>
            <RollText text="Security" />
          </a>
        </nav>

        {/* Right: CTA Button & Coordinates */}
        <div className="flex items-center justify-end gap-4">
          <div className="hidden xl:flex items-center gap-2 text-[10px] font-mono text-white/50">
            <span>LAT: 12.8406° N</span>
            <div className="w-1 h-1 bg-white/30 rounded-full"></div>
            <span>LONG: 80.1534° E</span>
          </div>

          <button
            onClick={handleStart}
            type="button"
            className="button button-blue button-sm header-cta"
          >
            <RollText text={buttonLabel} />
            <svg
              className="arrow-icon"
              viewBox="0 0 24 24"
              width="14"
              height="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              aria-hidden="true"
            >
              <path d="M7 17L17 7M17 7H7M17 7V17" />
            </svg>
          </button>
        </div>
      </header>

      {/* Main Hero Content: Left Copy + Right Visualizer Stage */}
      <div className="relative z-10 flex-1 flex items-center px-6 lg:px-16 max-w-[1440px] w-full mx-auto py-12 lg:py-0">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center w-full">
          {/* Left Hero Copy */}
          <div className="lg:col-span-6 flex flex-col gap-6 text-left">
            {/* Aerukart Eyebrow */}
            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="flex items-center gap-3"
            >
              <span className="eyebrow" style={{ margin: 0 }}>
                001 // CONNECTED CAMPUS
              </span>
              <div className="h-px w-12 bg-white/20"></div>
            </motion.div>

            {/* Aerukart Headline with Serif Italic em */}
            <div className="overflow-hidden">
              <motion.h1
                id="hero-title"
                initial={{ y: 55, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.85, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
                className="text-4xl sm:text-6xl lg:text-7xl font-bold tracking-tight text-white leading-[1.05]"
                style={{ fontFamily: 'var(--font-sans)' }}
              >
                <span className="block font-mono tracking-wider">CONNECTED</span>
                <span className="block mt-1 font-mono tracking-wider">
                  <em>CAMPUS</em>
                </span>
              </motion.h1>
            </div>

            {/* Subtitle strictly maintaining user text */}
            <motion.p
              initial={{ y: 25, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.75, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
              className="text-base sm:text-lg text-[#afb1b6] max-w-lg leading-relaxed font-mono opacity-90"
            >
              A unified platform for VTOP, Teams, and LMS.
            </motion.p>

            {/* Aerukart Action Pill Buttons */}
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ duration: 0.7, delay: 0.34, ease: [0.16, 1, 0.3, 1] }}
              className="flex flex-wrap items-center gap-4 pt-2"
            >
              <button
                onClick={handleStart}
                type="button"
                className="button button-blue"
              >
                <RollText text={buttonLabel} />
                <svg
                  className="arrow-icon"
                  viewBox="0 0 24 24"
                  width="16"
                  height="16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  aria-hidden="true"
                >
                  <path d="M7 17L17 7H7M17 7V17" />
                </svg>
              </button>

              <button
                onClick={handleLearn}
                type="button"
                className="button"
              >
                <RollText text="DISCOVER MORE" />
              </button>
            </motion.div>

            {/* Technical Sub-line */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.8, delay: 0.46 }}
              className="flex items-center gap-3 pt-2 text-white/40 text-xs font-mono"
            >
              <span>00</span>
              <div className="w-8 h-px bg-white/30"></div>
              <span>CAMPUSOS.SYSTEM // ZERO CLOUD CREDENTIALS</span>
            </motion.div>
          </div>

          {/* Right Visualizer Stage (Authentic Aerukart Chrome 3D Sculpture & Holographic Telemetry) */}
          <div className="lg:col-span-6 flex items-center justify-center relative">
            <motion.div
              initial={{ opacity: 0, scale: 0.88 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 1.1, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
              className="relative w-full max-w-[620px] aspect-[1.25/1] flex items-center justify-center"
              style={{
                perspective: '1200px',
              }}
            >
              {/* Aerukart Ambient Radial Light Behind Chrome Object */}
              <div 
                className="absolute w-[440px] h-[440px] rounded-full pointer-events-none"
                style={{
                  background: 'radial-gradient(circle at 50% 50%, rgba(23, 193, 254, 0.24) 0%, rgba(12, 71, 127, 0.14) 45%, transparent 75%)',
                  filter: 'blur(35px)',
                }}
              />

              {/* Holographic Subtle Telemetry Outer Ring */}
              <svg 
                className="absolute w-[460px] h-[460px] pointer-events-none opacity-30 animate-[spin_80s_linear_infinite]"
                viewBox="0 0 460 460"
                fill="none"
              >
                <circle cx="230" cy="230" r="220" stroke="#17c1fe" strokeWidth="1" strokeDasharray="4 8" />
                <circle cx="230" cy="230" r="190" stroke="rgba(255,255,255,0.15)" strokeWidth="0.8" />
                <circle cx="230" cy="230" r="160" stroke="#17c1fe" strokeWidth="1" strokeDasharray="2 12" />
                <line x1="230" y1="0" x2="230" y2="460" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
                <line x1="0" y1="230" x2="460" y2="230" stroke="rgba(255,255,255,0.08)" strokeWidth="0.5" />
              </svg>

              {/* 3D Interactive Tilting Chrome Object */}
              <div
                className="relative w-full h-full flex items-center justify-center transition-transform duration-200 ease-out chrome-float"
                style={{
                  transform: `rotateY(${mouseOffset.x * 9}deg) rotateX(${-mouseOffset.y * 9}deg) translate3d(${mouseOffset.x * 14}px, ${mouseOffset.y * 14}px, 0)`,
                  transformStyle: 'preserve-3d',
                }}
              >
                {/* Authentic Aerukart Chrome Sculpture (100% Alpha Transparent, No Black Box) */}
                <img
                  src="/assets/chrome.png"
                  alt="CampusOS Chrome Sculpture"
                  className="w-[92%] h-[92%] object-contain pointer-events-none select-none filter drop-shadow-[0_20px_50px_rgba(23,193,254,0.22)]"
                  draggable={false}
                />
              </div>

              {/* Floating Technical HUD Chips */}
              <div className="absolute bottom-4 left-6 px-3 py-1.5 rounded-full bg-black/60 border border-white/15 backdrop-blur-md text-[10px] font-mono text-white/70 flex items-center gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-[#17c1fe] animate-pulse"></span>
                <span>SEC // 001 • CAMPUS.ARCH</span>
              </div>

              <div className="absolute top-6 right-6 px-3 py-1.5 rounded-full bg-black/60 border border-white/15 backdrop-blur-md text-[10px] font-mono text-[#17c1fe] flex items-center gap-1.5">
                <span>COORD // 12.8406° N</span>
              </div>
            </motion.div>
          </div>
        </div>
      </div>

      {/* Bottom Technical Status Bar */}
      <footer className="border-t border-white/10 bg-black/80 backdrop-blur-md z-20 py-3 px-6 lg:px-16">
        <div className="max-w-[1440px] mx-auto flex items-center justify-between text-[9px] lg:text-[11px] font-mono text-white/50">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#17c1fe] rounded-full animate-pulse"></span>
              © CAMPUSOS.SYSTEM
            </span>
            <span className="hidden sm:inline">V1.0.0</span>
          </div>

          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 bg-[#10b981] rounded-full"></span>
              <span>CAMPUSOS ACTIVE</span>
            </div>
            <div className="h-3 w-px bg-white/20"></div>
            <span>FRAME: ∞</span>
          </div>
        </div>
      </footer>
    </section>
  );
}

export { Home as HeroAscii };
