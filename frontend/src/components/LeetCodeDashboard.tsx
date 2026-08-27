import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Award,
  TrendingUp,
  Target,
  CheckCircle2,
  AlertTriangle,
  Download,
  ExternalLink,
  Flame,
  Search,
  Building2,
  Sparkles,
  ShieldCheck,
  Code2,
  RefreshCw,
  UserCheck
} from 'lucide-react';

export interface LeetCodeProfile {
  username: string;
  realName: string;
  avatar: string;
  ranking: number | string;
  reputation: number;
  badges: Array<{ id: string; displayName: string; icon: string }>;
  solved: { Easy: number; Medium: number; Hard: number; All: number };
  platformTotals: { Easy?: number; Medium?: number; Hard?: number; All?: number };
  contest: {
    attended: number;
    rating: number;
    globalRanking: number | string;
    topPercentage: string | null;
    badge: string | null;
    history: Array<{ title: string; date: string; rating: number; rank: number }>;
  };
  topicMastery: Array<{ topic: string; count: number }>;
  weakSpots: Array<{ topic: string; solved: number; recommended: number; gap: number; message: string }>;
  actionPlan: string[];
  readiness: { finalScore: number; tier: string; tierColor: string; description: string };
  companySimulations: Array<{
    id: string;
    name: string;
    matchScore: number;
    benchmark: { minMedium: number; minHard: number; minTotal: number; minRating: number };
    mediumGap: number;
    hardGap: number;
    totalGap: number;
  }>;
}

// Circular progress ring sub-component
const CircularProgressRing: React.FC<{
  percentage: number;
  color: string;
  label: string;
  solved: number;
  total: number;
  size?: number;
}> = ({ percentage, color, label, solved, total, size = 110 }) => {
  const strokeWidth = 8;
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const strokeDashoffset = circumference - (Math.min(100, Math.max(0, percentage)) / 100) * circumference;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', textAlign: 'center' }}>
      <div style={{ position: 'relative', width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke="var(--bg-surface-elevated)"
            strokeWidth={strokeWidth}
            fill="transparent"
          />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={strokeWidth}
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            strokeLinecap="round"
            fill="transparent"
            style={{ transition: 'stroke-dashoffset 0.8s ease-in-out' }}
          />
        </svg>
        <div
          style={{
            position: 'absolute',
            inset: 0,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <span style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--text-primary)', lineHeight: 1 }}>
            {solved}
          </span>
          <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)', marginTop: '2px' }}>
            /{total}
          </span>
        </div>
      </div>
      <span style={{ fontSize: '0.82rem', fontWeight: 700, color, marginTop: '8px' }}>
        {label}
      </span>
      <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
        {Math.round(percentage)}% Solved
      </span>
    </div>
  );
};

export const LeetCodeDashboard: React.FC = () => {
  const [searchInput, setSearchInput] = useState('');
  const [profile, setProfile] = useState<LeetCodeProfile | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedCompanyId, setSelectedCompanyId] = useState<string>('google');
  const [exporting, setExporting] = useState(false);

  const fetchProfile = async (targetHandle: string) => {
    if (!targetHandle.trim()) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch(`/api/leetcode/profile?user=${encodeURIComponent(targetHandle.trim())}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.detail || data.error || 'Failed to fetch LeetCode profile');
      }

      setProfile(data);
      localStorage.setItem('campusos_leetcode_username', data.username);

      if (data.companySimulations && data.companySimulations.length > 0) {
        setSelectedCompanyId(data.companySimulations[0].id);
      }
    } catch (err: any) {
      setError(err.message || 'Could not connect to LeetCode API service.');
      setProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProfile(searchInput);
  };

  // On mount, load previously searched profile if present in localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('campusos_leetcode_username');
    if (savedUser) {
      setSearchInput(savedUser);
      fetchProfile(savedUser);
    }
  }, []);

  // Export Placement Resume Card as High-Res PNG via HTML5 Canvas
  const handleExportResumeCard = () => {
    if (!profile) return;
    setExporting(true);

    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1200;
      canvas.height = 640;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;

      // Dark background gradient for exported credential
      const bgGrad = ctx.createLinearGradient(0, 0, 1200, 640);
      bgGrad.addColorStop(0, '#090d16');
      bgGrad.addColorStop(1, '#0f172a');
      ctx.fillStyle = bgGrad;
      ctx.fillRect(0, 0, 1200, 640);

      // Accent border
      ctx.strokeStyle = '#1e293b';
      ctx.lineWidth = 4;
      ctx.strokeRect(20, 20, 1160, 600);

      // Glowing Badge Pill
      ctx.fillStyle = 'rgba(56, 189, 248, 0.15)';
      ctx.fillRect(60, 60, 310, 42);
      ctx.fillStyle = '#38bdf8';
      ctx.font = 'bold 18px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('⚡ CAMPUSOS DSA CREDENTIAL', 80, 87);

      // Name & Handle
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 36px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(profile.realName, 60, 160);

      ctx.fillStyle = '#94a3b8';
      ctx.font = '22px "JetBrains Mono", monospace';
      ctx.fillText(`leetcode.com/u/${profile.username}`, 60, 200);

      // Score Dial Box
      ctx.fillStyle = '#1e293b';
      ctx.fillRect(780, 60, 360, 170);
      ctx.fillStyle = profile.readiness.tierColor;
      ctx.font = 'bold 64px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`${profile.readiness.finalScore}%`, 810, 140);
      ctx.fillStyle = '#e2e8f0';
      ctx.font = 'bold 17px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(profile.readiness.tier, 810, 185);

      // Metrics Grid
      const metrics = [
        { label: 'Total Solved', val: `${profile.solved.All}` },
        { label: 'Medium Problems', val: `${profile.solved.Medium}` },
        { label: 'Hard Problems', val: `${profile.solved.Hard}` },
        { label: 'Contest Rating', val: `${profile.contest.rating > 0 ? profile.contest.rating : 'Unrated'}` }
      ];

      metrics.forEach((m, idx) => {
        const x = 60 + idx * 275;
        ctx.fillStyle = '#111827';
        ctx.fillRect(x, 260, 250, 120);
        ctx.strokeStyle = '#1f2937';
        ctx.strokeRect(x, 260, 250, 120);

        ctx.fillStyle = '#94a3b8';
        ctx.font = '15px "Plus Jakarta Sans", sans-serif';
        ctx.fillText(m.label, x + 20, 300);

        ctx.fillStyle = '#38bdf8';
        ctx.font = 'bold 36px "JetBrains Mono", monospace';
        ctx.fillText(m.val, x + 20, 350);
      });

      // Top Topics
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 22px "Plus Jakarta Sans", sans-serif';
      ctx.fillText('Core Algorithmic Proficiencies:', 60, 440);

      const topFour = profile.topicMastery.slice(0, 4).map(t => `${t.topic} (${t.count})`).join('   •   ');
      ctx.fillStyle = '#10b981';
      ctx.font = '20px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(topFour || 'General Algorithmic Problem Solving', 60, 480);

      // Footer
      ctx.fillStyle = '#64748b';
      ctx.font = '15px "Plus Jakarta Sans", sans-serif';
      ctx.fillText(`Verified CampusOS Placement Engine • ${new Date().toLocaleDateString('en-US', { dateStyle: 'long' })}`, 60, 560);

      // Trigger Download
      const link = document.createElement('a');
      link.download = `Placement-DSA-Card-${profile.username}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } finally {
      setExporting(false);
    }
  };

  const selectedCompany = profile?.companySimulations?.find(c => c.id === selectedCompanyId);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* 1. TOP HEADER & SEARCH INPUT */}
      <div
        style={{
          background: 'var(--card-banner-bg)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          padding: '24px 28px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '4px 12px',
                background: 'var(--brand-bg)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 'var(--radius-full)',
                color: 'var(--brand-color)',
                fontSize: '0.75rem',
                fontWeight: 700,
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                marginBottom: '8px',
              }}
            >
              <Sparkles size={14} />
              LeetCode Integration & Placement Engine
            </div>
            <h2 style={{ fontSize: '1.6rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
              DSA & Placement Intelligence Cockpit
            </h2>
            <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
              Live GraphQL Analytics, Weak Spot Auditing, & Target Company Gap Engine
            </p>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '8px', width: '100%', maxWidth: '440px' }}>
            <div style={{ position: 'relative', flex: 1 }}>
              <Search
                size={16}
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: 'var(--text-muted)',
                }}
              />
              <input
                type="text"
                placeholder="Enter LeetCode username or profile URL..."
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 14px 10px 36px',
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  color: 'var(--text-primary)',
                  fontSize: '0.88rem',
                  outline: 'none',
                  boxSizing: 'border-box',
                }}
              />
            </div>
            <button
              type="submit"
              disabled={loading || !searchInput.trim()}
              className="btn-primary"
              style={{
                padding: '10px 18px',
                border: 'none',
                borderRadius: 'var(--radius-md)',
                fontWeight: 800,
                fontSize: '0.85rem',
                cursor: loading || !searchInput.trim() ? 'not-allowed' : 'pointer',
                opacity: !searchInput.trim() ? 0.7 : 1,
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? <RefreshCw size={15} style={{ animation: 'spin 1s linear infinite' }} /> : 'Analyze'}
            </button>
          </form>
        </div>
      </div>

      {/* Error alert */}
      <AnimatePresence>
        {error && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              padding: '14px 18px',
              background: 'var(--danger-bg)',
              border: '1px solid var(--danger-border)',
              borderRadius: 'var(--radius-md)',
              color: 'var(--danger-crimson)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px',
              fontSize: '0.88rem',
            }}
          >
            <AlertTriangle size={20} color="var(--danger-crimson)" />
            <div>
              <b>Error:</b> {error}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading Skeleton */}
      {loading && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '16px' }}>
          <div style={{ height: '180px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-lg)', animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: '180px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-lg)', animation: 'pulse 1.5s infinite' }} />
          <div style={{ height: '180px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-lg)', animation: 'pulse 1.5s infinite' }} />
        </div>
      )}

      {/* Initial Empty State when no profile is searched yet */}
      {!loading && !profile && !error && (
        <div
          style={{
            background: 'var(--bg-surface)',
            border: '1px dashed var(--border-medium)',
            borderRadius: 'var(--radius-lg)',
            padding: '50px 30px',
            textAlign: 'center',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '14px',
          }}
        >
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: '50%',
              background: 'var(--brand-bg)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--brand-color)',
            }}
          >
            <UserCheck size={28} />
          </div>
          <h3 style={{ fontSize: '1.25rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
            Connect Your LeetCode Profile
          </h3>
          <p style={{ fontSize: '0.88rem', color: 'var(--text-secondary)', maxWidth: '520px', margin: 0, lineHeight: 1.5 }}>
            Enter your LeetCode username or profile link above to analyze your verified problem statistics, topic mastery matrix, and placement readiness score.
          </p>
        </div>
      )}

      {/* Main Profile Analytics View */}
      {!loading && profile && (
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}
        >
          {/* HERO BANNER & GAMIFICATION */}
          <div
            style={{
              background: 'var(--card-banner-bg)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px 28px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '20px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
              <div style={{ position: 'relative' }}>
                <img
                  src={profile.avatar}
                  alt={profile.username}
                  style={{
                    width: '74px',
                    height: '74px',
                    borderRadius: '16px',
                    objectFit: 'cover',
                    border: '2px solid var(--border-medium)',
                    boxShadow: '0 4px 12px rgba(0,0,0,0.1)',
                  }}
                />
                <div
                  style={{
                    position: 'absolute',
                    bottom: '-6px',
                    right: '-6px',
                    padding: '2px 6px',
                    background: 'var(--success-emerald)',
                    color: '#ffffff',
                    fontSize: '0.62rem',
                    fontWeight: 900,
                    borderRadius: 'var(--radius-full)',
                    letterSpacing: '0.5px',
                  }}
                >
                  LIVE
                </div>
              </div>

              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <h3 style={{ fontSize: '1.45rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    {profile.realName}
                  </h3>
                  <a
                    href={`https://leetcode.com/u/${profile.username}`}
                    target="_blank"
                    rel="noreferrer"
                    style={{
                      color: 'var(--brand-color)',
                      textDecoration: 'none',
                      fontSize: '0.85rem',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                    }}
                  >
                    @{profile.username}
                    <ExternalLink size={13} />
                  </a>
                </div>

                <div style={{ display: 'flex', gap: '10px', marginTop: '8px', flexWrap: 'wrap' }}>
                  <span
                    style={{
                      padding: '4px 10px',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Award size={14} color="var(--warning-amber)" />
                    Global Rank: <b>#{typeof profile.ranking === 'number' ? profile.ranking.toLocaleString() : profile.ranking}</b>
                  </span>

                  <span
                    style={{
                      padding: '4px 10px',
                      background: 'var(--bg-surface-elevated)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-sm)',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      color: 'var(--text-secondary)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '5px',
                    }}
                  >
                    <Flame size={14} color="var(--warning-amber)" />
                    Reputation: <b>{profile.reputation}</b>
                  </span>

                  {profile.contest.badge && (
                    <span
                      style={{
                        padding: '4px 10px',
                        background: 'var(--brand-bg)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.78rem',
                        fontWeight: 700,
                        color: 'var(--brand-color)',
                      }}
                    >
                      🏅 {profile.contest.badge}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Placement Readiness Pill & Resume Card Exporter */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '20px' }}>
              <div style={{ textAlign: 'right' }}>
                <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                  Placement Readiness
                </span>
                <div style={{ fontSize: '2.4rem', fontWeight: 900, color: profile.readiness.tierColor, lineHeight: 1, marginTop: '2px' }}>
                  {profile.readiness.finalScore}%
                </div>
                <span
                  style={{
                    display: 'inline-block',
                    padding: '3px 10px',
                    background: `${profile.readiness.tierColor}18`,
                    border: `1px solid ${profile.readiness.tierColor}40`,
                    color: profile.readiness.tierColor,
                    fontSize: '0.75rem',
                    fontWeight: 800,
                    borderRadius: 'var(--radius-full)',
                    marginTop: '4px',
                  }}
                >
                  {profile.readiness.tier}
                </span>
              </div>

              <button
                onClick={handleExportResumeCard}
                disabled={exporting}
                className="btn-outline"
                style={{
                  padding: '12px 18px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 700,
                  fontSize: '0.85rem',
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                }}
                title="Generate Placement DSA Resume Card"
              >
                <Download size={16} />
                <span>Export Resume Card</span>
              </button>
            </div>
          </div>

          {/* PROBLEM BREAKDOWN WITH CIRCULAR PROGRESS GAUGES & CONTEST ANALYTICS */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* Solved Problem Breakdown Rings */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Code2 size={18} color="var(--brand-color)" />
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Solved Problem Breakdown
                  </h4>
                </div>
                <span
                  style={{
                    padding: '4px 10px',
                    background: 'var(--brand-bg)',
                    color: 'var(--brand-color)',
                    borderRadius: 'var(--radius-full)',
                    fontSize: '0.78rem',
                    fontWeight: 800,
                  }}
                >
                  Total: {profile.solved.All} Solved
                </span>
              </div>

              {/* Three Radial Rings: Easy, Medium, Hard */}
              <div style={{ display: 'flex', justifyContent: 'space-around', alignItems: 'center', padding: '10px 0' }}>
                <CircularProgressRing
                  percentage={(profile.solved.Easy / (profile.platformTotals.Easy || 960)) * 100}
                  color="var(--success-emerald)"
                  label="Easy"
                  solved={profile.solved.Easy}
                  total={profile.platformTotals.Easy || 960}
                />
                <CircularProgressRing
                  percentage={(profile.solved.Medium / (profile.platformTotals.Medium || 2100)) * 100}
                  color="var(--warning-amber)"
                  label="Medium"
                  solved={profile.solved.Medium}
                  total={profile.platformTotals.Medium || 2100}
                />
                <CircularProgressRing
                  percentage={(profile.solved.Hard / (profile.platformTotals.Hard || 960)) * 100}
                  color="var(--danger-crimson)"
                  label="Hard"
                  solved={profile.solved.Hard}
                  total={profile.platformTotals.Hard || 960}
                />
              </div>

              <div
                style={{
                  marginTop: '20px',
                  paddingTop: '16px',
                  borderTop: '1px solid var(--border-subtle)',
                  display: 'flex',
                  justifyContent: 'space-between',
                  fontSize: '0.8rem',
                  color: 'var(--text-secondary)',
                }}
              >
                <span>
                  Medium + Hard Ratio: <b style={{ color: 'var(--text-primary)' }}>{profile.solved.All > 0 ? Math.round(((profile.solved.Medium + profile.solved.Hard) / profile.solved.All) * 100) : 0}%</b>
                </span>
                <span>
                  Tier-1 Benchmark: <b style={{ color: 'var(--success-emerald)' }}>≥ 60% Optimal</b>
                </span>
              </div>
            </div>

            {/* Contest Performance & Rating Panel (Real Verified Metrics) */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <TrendingUp size={18} color="var(--brand-color)" />
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Contest Performance & Standing
                  </h4>
                </div>

                {profile.contest.topPercentage && (
                  <span
                    style={{
                      padding: '3px 10px',
                      background: 'var(--brand-bg)',
                      border: '1px solid var(--border-subtle)',
                      borderRadius: 'var(--radius-full)',
                      fontSize: '0.75rem',
                      fontWeight: 800,
                      color: 'var(--brand-color)',
                    }}
                  >
                    Top {profile.contest.topPercentage}% Globally
                  </span>
                )}
              </div>

              {/* Verified Contest Metrics Grid */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: '12px', margin: 'auto 0' }}>
                <div
                  style={{
                    padding: '16px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Contest Rating
                  </span>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: profile.contest.rating > 0 ? 'var(--brand-color)' : 'var(--text-muted)', marginTop: '4px' }}>
                    {profile.contest.rating > 0 ? profile.contest.rating : 'Unrated'}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    {profile.contest.rating > 0 ? 'Official LeetCode Rating' : 'No rated contest attended'}
                  </span>
                </div>

                <div
                  style={{
                    padding: '16px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Contests Attended
                  </span>
                  <div style={{ fontSize: '1.8rem', fontWeight: 900, color: 'var(--text-primary)', marginTop: '4px' }}>
                    {profile.contest.attended}
                  </div>
                  <span style={{ fontSize: '0.7rem', color: 'var(--text-secondary)' }}>
                    Weekly / Biweekly
                  </span>
                </div>

                <div
                  style={{
                    padding: '16px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Global Contest Rank
                  </span>
                  <div style={{ fontSize: '1.3rem', fontWeight: 800, color: 'var(--text-primary)', marginTop: '6px' }}>
                    {typeof profile.contest.globalRanking === 'number'
                      ? `#${profile.contest.globalRanking.toLocaleString()}`
                      : profile.contest.globalRanking}
                  </div>
                </div>

                <div
                  style={{
                    padding: '16px',
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    textAlign: 'center',
                  }}
                >
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 700 }}>
                    Contest Tier Badge
                  </span>
                  <div style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--brand-color)', marginTop: '6px' }}>
                    {profile.contest.badge || 'Standard Contender'}
                  </div>
                </div>
              </div>

              <div
                style={{
                  marginTop: '16px',
                  paddingTop: '12px',
                  borderTop: '1px solid var(--border-subtle)',
                  fontSize: '0.78rem',
                  color: 'var(--text-secondary)',
                  display: 'flex',
                  justifyContent: 'space-between',
                }}
              >
                <span>Status: <b style={{ color: profile.contest.rating >= 1800 ? 'var(--success-emerald)' : 'var(--brand-color)' }}>{profile.contest.rating >= 1800 ? 'Tier-1 Competitive' : 'Active Learner'}</b></span>
                <span>Verified via LeetCode GraphQL</span>
              </div>
            </div>
          </div>

          {/* AI DSA ROADMAP & WEAKNESS ANALYZER */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {/* Topic Mastery Grid */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <ShieldCheck size={18} color="var(--success-emerald)" />
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>Topic Mastery Matrix</h4>
                </div>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Verified Tag Problem Counts</span>
              </div>

              {profile.topicMastery.length > 0 ? (
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))', gap: '10px' }}>
                  {profile.topicMastery.map((item) => (
                    <div
                      key={item.topic}
                      style={{
                        padding: '10px 12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                      }}
                    >
                      <span style={{ fontSize: '0.78rem', fontWeight: 600, color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '90px' }}>
                        {item.topic}
                      </span>
                      <span
                        style={{
                          fontSize: '0.78rem',
                          fontWeight: 800,
                          color: 'var(--brand-color)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        {item.count}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                  No tagged problem topics available for this profile.
                </p>
              )}
            </div>

            {/* Weak Spot Audit & Dynamic Action Plan */}
            <div
              style={{
                background: 'var(--bg-surface)',
                border: '1px solid var(--border-medium)',
                borderRadius: 'var(--radius-lg)',
                padding: '24px',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '14px' }}>
                  <AlertTriangle size={18} color="var(--warning-amber)" />
                  <h4 style={{ fontSize: '1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>AI Weak Spot Audit</h4>
                </div>

                {/* Weak Spot Alerts */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginBottom: '20px' }}>
                  {profile.weakSpots.length > 0 ? (
                    profile.weakSpots.map((ws, i) => (
                      <div
                        key={i}
                        style={{
                          padding: '10px 14px',
                          background: 'var(--warning-bg)',
                          border: '1px solid var(--warning-border)',
                          borderRadius: 'var(--radius-sm)',
                          fontSize: '0.78rem',
                          color: 'var(--text-primary)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                        }}
                      >
                        <span>⚠️</span>
                        <span>
                          <b style={{ color: 'var(--warning-amber)' }}>{ws.topic}</b>: Solved {ws.solved}/{ws.recommended} recommended ({ws.gap} more needed for Tier-1 coding rounds).
                        </span>
                      </div>
                    ))
                  ) : (
                    <div
                      style={{
                        padding: '10px 14px',
                        background: 'var(--success-bg)',
                        border: '1px solid var(--success-border)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.78rem',
                        color: 'var(--success-emerald)',
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                      }}
                    >
                      <CheckCircle2 size={16} color="var(--success-emerald)" />
                      <span>All core placement algorithmic areas exceed standard hiring bars.</span>
                    </div>
                  )}
                </div>

                {/* 3-Step Dynamic Action Plan */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '10px' }}>
                  <Target size={16} color="var(--brand-color)" />
                  <span style={{ fontSize: '0.75rem', fontWeight: 800, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    Quick 3-Step Action Plan
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {profile.actionPlan.map((step, idx) => (
                    <div
                      key={idx}
                      style={{
                        padding: '8px 12px',
                        background: 'var(--bg-surface-elevated)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-sm)',
                        fontSize: '0.78rem',
                        color: 'var(--text-primary)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: '8px',
                      }}
                    >
                      <span
                        style={{
                          width: '18px',
                          height: '18px',
                          borderRadius: '50%',
                          background: 'var(--brand-bg)',
                          color: 'var(--brand-color)',
                          fontSize: '0.7rem',
                          fontWeight: 800,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          flexShrink: 0,
                        }}
                      >
                        {idx + 1}
                      </span>
                      <span>{step}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* COMPANY TARGET SIMULATOR */}
          <div
            style={{
              background: 'var(--card-banner-bg)',
              border: '1px solid var(--border-medium)',
              borderRadius: 'var(--radius-lg)',
              padding: '24px 28px',
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px', marginBottom: '20px' }}>
              <div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <Building2 size={18} color="var(--brand-color)" />
                  <h4 style={{ fontSize: '1.1rem', fontWeight: 800, margin: 0, color: 'var(--text-primary)' }}>
                    Target Company Hiring Bar Simulator
                  </h4>
                </div>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '2px', margin: 0 }}>
                  Benchmarked against successful offers at top tier-1 product organizations
                </p>
              </div>

              {/* Company Buttons */}
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {profile.companySimulations.map((c) => {
                  const isSelected = selectedCompanyId === c.id;
                  return (
                    <button
                      key={c.id}
                      onClick={() => setSelectedCompanyId(c.id)}
                      style={{
                        padding: '6px 14px',
                        background: isSelected ? 'var(--brand-color)' : 'var(--bg-surface-elevated)',
                        color: isSelected ? 'var(--btn-primary-text)' : 'var(--text-secondary)',
                        border: isSelected ? 'none' : '1px solid var(--border-subtle)',
                        borderRadius: 'var(--radius-md)',
                        fontSize: '0.78rem',
                        fontWeight: 800,
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                      }}
                    >
                      {c.name}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Selected Company Gap Analytics */}
            {selectedCompany && (
              <div
                style={{
                  background: 'var(--bg-surface)',
                  border: '1px solid var(--border-medium)',
                  borderRadius: 'var(--radius-md)',
                  padding: '20px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
                  gap: '20px',
                  alignItems: 'center',
                }}
              >
                {/* Match percentage gauge */}
                <div style={{ textAlign: 'center', borderRight: '1px solid var(--border-subtle)', paddingRight: '16px' }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
                    {selectedCompany.name} Match Index
                  </span>
                  <div style={{ fontSize: '2.8rem', fontWeight: 900, color: 'var(--brand-color)', lineHeight: 1, margin: '8px 0' }}>
                    {selectedCompany.matchScore}%
                  </div>
                  <div className="progress-track" style={{ height: '8px', maxWidth: '180px', margin: '0 auto' }}>
                    <div
                      className="progress-fill emerald"
                      style={{ width: `${selectedCompany.matchScore}%`, background: 'var(--brand-color)' }}
                    />
                  </div>
                  <span style={{ fontSize: '0.72rem', color: 'var(--text-secondary)', display: 'block', marginTop: '6px' }}>
                    {selectedCompany.matchScore >= 80 ? '🔥 Prime Candidate for Interviews' : '⚡ Complete gaps below before applying'}
                  </span>
                </div>

                {/* Medium Problems Gap */}
                <div style={{ padding: '12px 16px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Medium Problems</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>
                    {profile.solved.Medium} / {selectedCompany.benchmark.minMedium}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: selectedCompany.mediumGap > 0 ? 'var(--warning-amber)' : 'var(--success-emerald)', fontWeight: 700 }}>
                    {selectedCompany.mediumGap > 0 ? `-${selectedCompany.mediumGap} needed` : '✓ Benchmark Met'}
                  </span>
                </div>

                {/* Hard Problems Gap */}
                <div style={{ padding: '12px 16px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Hard Problems</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>
                    {profile.solved.Hard} / {selectedCompany.benchmark.minHard}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: selectedCompany.hardGap > 0 ? 'var(--danger-crimson)' : 'var(--success-emerald)', fontWeight: 700 }}>
                    {selectedCompany.hardGap > 0 ? `-${selectedCompany.hardGap} needed` : '✓ Benchmark Met'}
                  </span>
                </div>

                {/* Contest Rating Gap */}
                <div style={{ padding: '12px 16px', background: 'var(--bg-surface-elevated)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--border-subtle)' }}>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Target Contest Rating</span>
                  <div style={{ fontSize: '1.2rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>
                    {profile.contest.rating > 0 ? profile.contest.rating : 'Unrated'} / {selectedCompany.benchmark.minRating}
                  </div>
                  <span style={{ fontSize: '0.75rem', color: profile.contest.rating >= selectedCompany.benchmark.minRating ? 'var(--success-emerald)' : 'var(--brand-color)', fontWeight: 700 }}>
                    {profile.contest.rating >= selectedCompany.benchmark.minRating
                      ? '✓ Rating Met'
                      : `-${Math.max(0, selectedCompany.benchmark.minRating - (profile.contest.rating || 0))} pts recommended`}
                  </span>
                </div>
              </div>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
};

export default LeetCodeDashboard;
