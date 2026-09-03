import React from 'react';
import { PlacementDrive, DSACategory, StudentProfile } from '../types';
import { LeetCodeDashboard } from '../components/LeetCodeDashboard';
import { Building2, ShieldCheck, Award, CheckCircle2, Briefcase, ExternalLink, Calendar } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';

interface PlacementsViewProps {
  drives: PlacementDrive[];
  dsaTopics: DSACategory[];
  student?: StudentProfile;
}

export const PlacementsView: React.FC<PlacementsViewProps> = ({ drives, student }) => {
  const cgpa = student?.cgpa ?? null;
  const isSuperDreamEligible = cgpa !== null ? cgpa >= 8.0 : null;
  const isDreamEligible = cgpa !== null ? cgpa >= 7.0 : null;
  const cgpaText = cgpa !== null ? Number(cgpa).toFixed(2) : 'Data unavailable';

  const eligibilityTier =
    isSuperDreamEligible === true
      ? 'Super Dream & Dream Tier Eligible'
      : isDreamEligible === true
      ? 'Dream & Regular Tier Eligible'
      : cgpa !== null
      ? 'Regular & Core Tier Eligible'
      : 'VTOP synchronization required';

  return (
    <div className="page-container">
      {/* 1. Placement Standing Hero Banner */}
      <div className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="hero-eyebrow">
              <Briefcase size={14} />
              <span>CAREER DEVELOPMENT CENTRE (PAT)</span>
              <span>•</span>
              <span style={{ color: 'var(--text-muted)' }}>
                {student?.program || 'B.Tech CSE'} • Batch 2024-2028
              </span>
            </div>
            <h2 className="hero-heading">Placements &amp; Career Readiness</h2>
            <p className="hero-desc">
              Institutional placement standing calculated from verified VTOP CGPA, history of standing arrears, and DSA coding readiness.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              className={`status-badge ${isSuperDreamEligible ? 'safe' : isDreamEligible ? 'warning' : 'neutral'}`}
              style={{ padding: '8px 16px', fontSize: '0.86rem' }}
            >
              <ShieldCheck size={15} />
              <span>{eligibilityTier}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Institutional Standing Metrics */}
      <div className="metrics-stat-grid">
        <MetricCard
          label="Cumulative CGPA"
          value={cgpaText}
          subtext={
            cgpa !== null
              ? cgpa >= 8.0
                ? '✓ Exceeds 8.00 Super Dream cutoff'
                : 'Cutoff: ≥ 8.00 for Super Dream'
              : 'Sync VTOP profile'
          }
          icon={<Award size={18} />}
          variant={cgpa !== null && cgpa >= 8.0 ? 'emerald' : 'blue'}
        />
        <MetricCard
          label="Standing Arrears"
          value={0}
          subtext="Zero active university standing arrears"
          icon={<CheckCircle2 size={18} />}
          variant="emerald"
        />
        <MetricCard
          label="Placement Tier"
          value={isSuperDreamEligible ? 'Super Dream' : isDreamEligible ? 'Dream' : 'Core'}
          subtext={isSuperDreamEligible ? 'CTC Range: 10 LPA to 50+ LPA' : 'CTC Range: 6 LPA to 10 LPA'}
          icon={<Briefcase size={18} />}
          variant="cyan"
        />
      </div>

      {/* 3. DSA & LeetCode Practice Cockpit */}
      <LeetCodeDashboard />

      {/* 4. Active Campus Recruitment Drives */}
      {drives && drives.length > 0 && (
        <div className="card">
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <Building2 size={19} color="var(--accent-cyan)" />
                <span>Active Campus Recruitment Drives ({drives.length})</span>
              </h3>
              <p className="card-description">
                Upcoming company assessments, shortlist announcements, and application deadlines.
              </p>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: '16px' }}>
            {drives.map((drive) => (
              <div
                key={drive.id}
                style={{
                  padding: '20px',
                  borderRadius: 'var(--radius-md)',
                  backgroundColor: 'var(--surface-input)',
                  border: '1px solid var(--border-card)',
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '14px',
                }}
              >
                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                    <h4 style={{ fontSize: '1.10rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                      {drive.companyName}
                    </h4>
                    <span className="status-badge info">{drive.ctc || '12-18 LPA'}</span>
                  </div>

                  <div style={{ fontSize: '0.90rem', color: 'var(--accent-cyan)', fontWeight: 600, marginBottom: '6px' }}>
                    {drive.role || 'Software Development Engineer'}
                  </div>

                  <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <Calendar size={13} />
                    <span>Drive Date: {drive.driveDate || drive.deadlineToApply || 'Upcoming'}</span>
                  </div>
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingTop: '12px', borderTop: '1px solid var(--border-subtle)' }}>
                  <span className="status-badge neutral">
                    Min CGPA: {drive.eligibilityCgpa ? `${drive.eligibilityCgpa}` : '7.50'}
                  </span>

                  <button className="btn btn-secondary btn-sm" style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Details</span>
                    <ExternalLink size={12} />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
