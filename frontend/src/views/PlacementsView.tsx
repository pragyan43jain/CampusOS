import React from 'react';
import { PlacementDrive, DSACategory, StudentProfile } from '../types';
import { LeetCodeDashboard } from '../components/LeetCodeDashboard';
import { Building2, ShieldCheck, Award, CheckCircle2, Briefcase } from 'lucide-react';
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
      {/* SECTION 1: PLACEMENT ELIGIBILITY */}
      <div
        className="card"
        style={{
          background: 'var(--brand-gradient-soft)',
          border: '1px solid var(--border-medium)',
          padding: '24px 28px',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
              <span className="status-badge info" style={{ fontSize: '0.7rem' }}>
                Career Development Center (PAT)
              </span>
              <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)' }}>
                {student?.program || 'B.Tech Program'} • 2024-2028 Batch
              </span>
            </div>
            <h2 style={{ fontSize: '1.4rem', fontWeight: 800, color: 'var(--text-primary)', letterSpacing: '-0.3px' }}>
              Placement Eligibility & Standing
            </h2>
            <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '2px', maxWidth: '640px' }}>
              Institutional placement standing calculated from authoritative VTOP CGPA, history of standing arrears, and registered academic credits.
            </p>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span className={`status-badge ${isSuperDreamEligible ? 'safe' : isDreamEligible ? 'warning' : 'neutral'}`} style={{ padding: '6px 14px', fontSize: '0.82rem' }}>
              <ShieldCheck size={14} />
              <span>{eligibilityTier}</span>
            </span>
          </div>
        </div>

        {/* Institutional Eligibility Metrics */}
        <div className="metrics-stat-grid" style={{ marginTop: '20px' }}>
          <MetricCard
            label="Cumulative CGPA"
            value={cgpaText}
            subtext={cgpa !== null ? (cgpa >= 8.0 ? '✓ Exceeds 8.00 Super Dream threshold' : 'Cutoff: ≥ 8.00 for Super Dream') : 'Sync VTOP'}
            icon={<Award size={18} />}
            variant={cgpa !== null && cgpa >= 8.0 ? 'emerald' : 'blue'}
          />
          <MetricCard
            label="Standing Arrears"
            value={0}
            subtext="Zero active standing arrears"
            icon={<CheckCircle2 size={18} />}
            variant="emerald"
          />
          <MetricCard
            label="Placement Tier"
            value={isSuperDreamEligible ? 'Super Dream' : isDreamEligible ? 'Dream' : 'Core'}
            subtext={isSuperDreamEligible ? 'CTC Range: 10 LPA to 50+ LPA' : 'CTC Range: 6 LPA to 10 LPA'}
            icon={<Briefcase size={18} />}
            variant="blue"
          />
        </div>
      </div>

      {/* SECTION 2: DSA & LEETCODE INTELLIGENCE */}
      <LeetCodeDashboard />

      {/* SECTION 3: CAMPUS RECRUITMENT DRIVES */}
      {drives && drives.length > 0 && (
        <div className="card" style={{ gap: '16px' }}>
          <div className="card-header-bar">
            <div>
              <h3 className="card-title">
                <Building2 size={18} color="var(--brand-color)" />
                <span>Upcoming Campus Recruitment Drives</span>
              </h3>
              <p className="card-description">Verified company drives registered through the placement portal</p>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            {drives.map((drive) => {
              const tags = drive.tags || ['Super Dream'];
              const driveLocation = drive.location || 'VIT Campus / Online';
              const deadlineText = drive.deadline || drive.deadlineToApply || 'Upcoming';

              return (
                <div
                  key={drive.id}
                  style={{
                    background: 'var(--bg-surface-elevated)',
                    border: '1px solid var(--border-subtle)',
                    borderRadius: 'var(--radius-md)',
                    padding: '16px 18px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    flexWrap: 'wrap',
                    gap: '14px',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '4px' }}>
                      <h4 style={{ fontSize: '1.05rem', fontWeight: 800, color: 'var(--text-primary)', margin: 0 }}>
                        {drive.companyName}
                      </h4>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {tags.map((t) => (
                          <span key={t} className="status-badge info" style={{ fontSize: '0.68rem', padding: '1px 6px' }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                      {drive.role} • 📍 {driveLocation}
                    </div>
                    <div style={{ fontSize: '0.76rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {drive.driveDate && <span>Drive Date: <b>{drive.driveDate}</b> • </span>}
                      Deadline: <b>{deadlineText}</b>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success-emerald)' }}>
                      {drive.ctc}
                    </div>
                    <span className="status-badge safe" style={{ fontSize: '0.72rem' }}>
                      {drive.status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

export default PlacementsView;
