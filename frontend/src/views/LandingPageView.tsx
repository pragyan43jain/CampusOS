import React from 'react';
import { motion } from 'framer-motion';
import {
  ShieldCheck,
  Award,
  Layers,
  BrainCircuit,
  Percent,
  CheckCircle2,
  ArrowUp,
  ArrowUpRight,
} from 'lucide-react';
import { ThemeType } from '../components/ThemeSwitcher';
import HeroAscii from '../components/ui/hero-ascii';
import { RollText } from '../components/ui/RollText';

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
    <div className="relative min-h-screen flex flex-col bg-black text-[#f5f5f2] selection:bg-[#17c1fe] selection:text-black">
      {/* 1. Aerukart Hero Stage Component with 3D Chrome Sculpture & RollText */}
      <HeroAscii
        onGetStarted={isLoggedIn ? handleEnter : handleLogin}
        onLearnMore={handleLearnMore}
        isLoggedIn={isLoggedIn}
        studentName={studentName}
        currentTheme={currentTheme}
        onSelectTheme={onSelectTheme}
      />

      {/* 2. Aerukart Infinite Marquee Ticker Ribbon */}
      <div 
        className="caide-marquee-wrap relative z-10" 
        style={{ 
          borderTop: '1px solid rgba(255, 255, 255, 0.08)', 
          borderBottom: '1px solid rgba(255, 255, 255, 0.08)', 
          background: '#04060a' 
        }}
      >
        <div className="caide-marquee-track py-3">
          {[...marqueeItems, ...marqueeItems].map((text, idx) => (
            <div key={idx} className="caide-marquee-item flex items-center gap-2 text-white/70 font-mono text-xs tracking-wider">
              <CheckCircle2 size={14} className="text-[#17c1fe]" />
              <span>{text}</span>
              <div className="caide-marquee-dot bg-white/30 w-1.5 h-1.5 rounded-full mx-3"></div>
            </div>
          ))}
        </div>
      </div>

      {/* 3. Aerukart Showcase Matrix (Core Subsystems) */}
      <section id="features" className="section-pad max-w-[1440px] w-full mx-auto px-6 lg:px-16 relative">
        {/* Subtle Section Glow */}
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 w-[700px] h-[350px] bg-[#17c1fe]/[0.05] blur-3xl pointer-events-none rounded-full" />

        <motion.div 
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: '-60px' }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          className="text-center max-w-3xl mx-auto mb-16"
        >
          <p className="eyebrow">
            002 // CORE SUBSYSTEMS
          </p>
          <h2 className="text-3xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-white mb-4">
            Engineered for <em>Academic Mastery</em>
          </h2>
          <p className="text-base sm:text-lg text-[#afb1b6] leading-relaxed max-w-2xl mx-auto">
            Consolidated university intelligence eliminating the friction of manual portal logins, missed deadlines, and attendance surprises.
          </p>
        </motion.div>

        {/* Aerukart Media Format Grid: Row 1 */}
        <div className="media-format-row">
          {/* Card 1: 75% Attendance Defense */}
          <motion.div 
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="media-format-cell col-span-10 lg:col-span-5"
          >
            <div className="project-card group">
              <div className="project-image">
                <ul className="project-tags">
                  <li>75% Defended</li>
                  <li>VTOP Verified</li>
                </ul>

                <div className="w-full flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#10b981]/15 border border-[#10b981]/30 flex items-center justify-center text-[#10b981] mb-4 shadow-[0_0_30px_rgba(16,185,129,0.2)]">
                    <Percent size={28} />
                  </div>
                  <div className="w-full max-w-sm px-4 py-2.5 rounded-lg bg-black/60 border border-white/10 text-xs font-mono text-[#17c1fe] tracking-wide">
                    formula: Math.floor((attended - 0.75 * conducted) / 0.75)
                  </div>
                </div>
              </div>

              <div className="project-meta">
                <div className="project-meta-header">
                  <h3>
                    Mathematical Attendance Defense
                    <ArrowUpRight size={18} className="arrow-icon text-white/50 group-hover:text-[#17c1fe]" />
                  </h3>
                  <span className="text-xs font-mono text-[#10b981] font-semibold">SAFE MARGIN</span>
                </div>
                <p>
                  Automated projection of safe leaves, recovery quotas, and debarment warnings calculated dynamically from verified VTOP attendance counts.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Card 2: Unified Multi-Platform Deadlines */}
          <motion.div 
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.7, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="media-format-cell col-span-10 lg:col-span-5" 
            id="integrations"
          >
            <div className="project-card group">
              <div className="project-image">
                <ul className="project-tags">
                  <li>Multi-Portal</li>
                  <li>Real-Time Sync</li>
                </ul>

                <div className="w-full flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#4C8DFF]/15 border border-[#4C8DFF]/30 flex items-center justify-center text-[#4C8DFF] mb-4 shadow-[0_0_30px_rgba(76,141,255,0.2)]">
                    <Layers size={28} />
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center">
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/15 text-[11px] font-mono text-white/80">
                      Teams Channels
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/15 text-[11px] font-mono text-white/80">
                      Moodle Dropboxes
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/15 text-[11px] font-mono text-white/80">
                      Digital DA1/DA2
                    </span>
                  </div>
                </div>
              </div>

              <div className="project-meta">
                <div className="project-meta-header">
                  <h3>
                    Unified Multi-Platform Deadlines
                    <ArrowUpRight size={18} className="arrow-icon text-white/50 group-hover:text-[#17c1fe]" />
                  </h3>
                  <span className="text-xs font-mono text-[#4C8DFF] font-semibold">AUTOMATED</span>
                </div>
                <p>
                  Single-button global synchronization that aggregates Microsoft Teams assignments, Moodle quizzes, and digital submissions.
                </p>
              </div>
            </div>
          </motion.div>
        </div>

        {/* Aerukart Media Format Grid: Row 2 */}
        <div className="media-format-row">
          {/* Card 3: Adaptive Recovery & Exam Planner */}
          <motion.div 
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.7, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
            className="media-format-cell col-span-10 lg:col-span-5" 
            id="baby-ai"
          >
            <div className="project-card group">
              <div className="project-image">
                <ul className="project-tags">
                  <li>BABY AI</li>
                  <li>Adaptive Schedule</li>
                </ul>

                <div className="w-full flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#B575FF]/15 border border-[#B575FF]/30 flex items-center justify-center text-[#B575FF] mb-4 shadow-[0_0_30px_rgba(181,117,255,0.2)]">
                    <BrainCircuit size={28} />
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center">
                    <span className="px-3 py-1 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 text-[11px] font-mono text-[#10b981]">
                      High Priority Recovery
                    </span>
                    <span className="px-3 py-1 rounded-full bg-white/5 border border-white/15 text-[11px] font-mono text-white/80">
                      Exam Schedule Sync
                    </span>
                  </div>
                </div>
              </div>

              <div className="project-meta">
                <div className="project-meta-header">
                  <h3>
                    Adaptive Recovery &amp; Exam Planner
                    <ArrowUpRight size={18} className="arrow-icon text-white/50 group-hover:text-[#17c1fe]" />
                  </h3>
                  <span className="text-xs font-mono text-[#B575FF] font-semibold">CAT 1 &amp; FAT</span>
                </div>
                <p>
                  AI-generated revision schedules calibrated against your impending CAT 1, CAT 2, and FAT exam dates and internal marks scores.
                </p>
              </div>
            </div>
          </motion.div>

          {/* Card 4: Placement Readiness & Coding Radar */}
          <motion.div 
            initial={{ opacity: 0, y: 35 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, margin: '-40px' }}
            transition={{ duration: 0.7, delay: 0.22, ease: [0.16, 1, 0.3, 1] }}
            className="media-format-cell col-span-10 lg:col-span-5"
          >
            <div className="project-card group">
              <div className="project-image">
                <ul className="project-tags">
                  <li>Super Dream</li>
                  <li>LeetCode Sync</li>
                </ul>

                <div className="w-full flex flex-col items-center justify-center p-6 text-center">
                  <div className="w-16 h-16 rounded-2xl bg-[#FF7849]/15 border border-[#FF7849]/30 flex items-center justify-center text-[#FF7849] mb-4 shadow-[0_0_30px_rgba(255,120,73,0.2)]">
                    <Award size={28} />
                  </div>
                  <div className="flex gap-2 flex-wrap justify-center">
                    <span className="px-3 py-1 rounded-full bg-[#10b981]/15 border border-[#10b981]/30 text-[11px] font-mono text-[#10b981]">
                      0 Active Arrears
                    </span>
                    <span className="px-3 py-1 rounded-full bg-[#17c1fe]/15 border border-[#17c1fe]/30 text-[11px] font-mono text-[#17c1fe]">
                      ≥8.00 CGPA
                    </span>
                  </div>
                </div>
              </div>

              <div className="project-meta">
                <div className="project-meta-header">
                  <h3>
                    Placement Readiness &amp; Coding Radar
                    <ArrowUpRight size={18} className="arrow-icon text-white/50 group-hover:text-[#17c1fe]" />
                  </h3>
                  <span className="text-xs font-mono text-[#FF7849] font-semibold">TIER RADAR</span>
                </div>
                <p>
                  Instant qualification status across Super Dream (≥8.00 CGPA) and Dream company cutoffs combined with active LeetCode tracking.
                </p>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* 4. Aerukart Minimalist Footer */}
      <footer
        id="security"
        className="relative z-10 border-t border-white/10 bg-black py-12 px-6 lg:px-16 mt-auto"
      >
        <div className="max-w-[1440px] mx-auto flex flex-col md:flex-row items-center justify-between gap-8">
          <div className="flex flex-col gap-2 text-center md:text-left">
            <div className="flex items-center justify-center md:justify-start gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-white/10 border border-white/15 flex items-center justify-center text-[#17c1fe]">
                <ShieldCheck size={16} />
              </div>
              <span className="font-mono text-lg font-bold tracking-wider text-white italic transform -skew-x-12">
                CampusOS
              </span>
            </div>
            <p className="text-xs font-mono text-white/50 max-w-md">
              Autonomous Academic Operating System // Zero Cloud Credential Storage
            </p>
          </div>

          <div className="flex items-center gap-4">
            <button
              onClick={scrollToTop}
              type="button"
              className="button button-sm text-xs font-mono"
            >
              <ArrowUp size={12} />
              <RollText text="TOP" />
            </button>

            <button
              onClick={isLoggedIn ? handleEnter : handleLogin}
              type="button"
              className="button button-blue button-sm text-xs font-mono font-semibold"
            >
              <RollText text={isLoggedIn ? 'ENTER DASHBOARD' : 'SIGN IN (VTOP)'} />
              <ArrowUpRight size={14} className="arrow-icon" />
            </button>
          </div>
        </div>
      </footer>
    </div>
  );
};
