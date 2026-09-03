import React from 'react';
import { PlacementDrive, DSACategory, StudentProfile } from '../types';
import { LeetCodeDashboard } from '../components/LeetCodeDashboard';
import { Building2, ShieldCheck, Award, CheckCircle2, Briefcase, ExternalLink, Calendar } from 'lucide-react';
import { MetricCard } from '../components/MetricCard';
import { calculatePlacementEligibility } from '../services/placementService';

interface PlacementsViewProps {
  drives: PlacementDrive[];
  dsaTopics: DSACategory[];
  student?: StudentProfile | null;
}

export const PlacementsView: React.FC<PlacementsViewProps> = ({ drives, student }) => {
  const eligibility = calculatePlacementEligibility(student);

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
                {student?.program || 'B.Tech CSE'} • Batch {student?.batch || '2024-2028'}
              </span>
            </div>
            <h2 className="hero-heading">Placements &amp; Career Readiness</h2>
            <p className="hero-desc">
              Institutional placement standing calculated from verified VTOP CGPA, history of standing arrears, and DSA coding readiness.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span
              className={`status-badge ${eligibility.isSuperDreamEligible ? 'safe' : eligibility.isDreamEligible ? 'warning' : eligibility.tier === 'Unavailable' ? 'neutral' : 'safe'}`}
              style={{ padding: '8px 16px', fontSize: '0.86rem' }}
            >
              <ShieldCheck size={15} />
              <span>{eligibility.tierDisplay}</span>
            </span>
          </div>
        </div>
      </div>

      {/* 2. Institutional Standing Metrics */}
      <div className="metrics-stat-grid">
        <MetricCard
          label="Cumulative CGPA"
          value={eligibility.cgpaDisplay}
          subtext={eligibility.statusText}
          icon={<Award size={18} />}
          variant={eligibility.variant === 'crimson' ? 'crimson' : eligibility.isSuperDreamEligible ? 'emerald' : 'blue'}
        />
        <MetricCard
          label="Standing Arrears"
          value={eligibility.standingArrears}
          subtext={eligibility.standingArrears === 0 ? 'Zero active university standing arrears' : eligibility.standingArrearsDisplay}
          icon={<CheckCircle2 size={18} />}
          variant={eligibility.standingArrears === 0 ? 'emerald' : 'crimson'}
        />
        <MetricCard
          label="Placement Tier"
          value={eligibility.tier}
          subtext={eligibility.ctcRange}
          icon={<Briefcase size={18} />}
          variant={eligibility.isSuperDreamEligible ? 'emerald' : eligibility.isDreamEligible ? 'cyan' : 'blue'}
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
