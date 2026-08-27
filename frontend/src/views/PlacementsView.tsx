import React from 'react';
import { PlacementDrive, DSACategory, StudentProfile } from '../types';
import { LeetCodeDashboard } from '../components/LeetCodeDashboard';
import { Building2, ShieldCheck } from 'lucide-react';

interface PlacementsViewProps {
  drives: PlacementDrive[];
  dsaTopics: DSACategory[];
  student?: StudentProfile;
}

export const PlacementsView: React.FC<PlacementsViewProps> = ({ drives, student }) => {
  const cgpa = student?.cgpa ?? null;
  const isSuperDreamEligible = cgpa !== null ? cgpa >= 8.0 : null;
  const cgpaText = cgpa !== null ? Number(cgpa).toFixed(2) : "Sync VTOP to check";

  return (
    <div className="page-content" style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
      {/* VTOP Authoritative Institutional Eligibility Header */}
      <div
        style={{
          background: 'var(--card-banner-bg)',
          border: '1px solid var(--border-medium)',
          borderRadius: 'var(--radius-lg)',
          padding: '22px 26px',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          boxShadow: '0 4px 20px rgba(0,0,0,0.04)',
        }}
      >
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--brand-color)', textTransform: 'uppercase' }}>
            Campus Placement & Career Development • {student?.program || 'Engineering'}
          </span>
          <h2 style={{ fontSize: '1.35rem', fontWeight: 800, marginTop: '4px', color: 'var(--text-primary)' }}>
            Placement Standing:{' '}
            {isSuperDreamEligible === true
              ? 'Eligible for Super Dream & Dream Drives'
              : isSuperDreamEligible === false
              ? 'Eligible for Core & Dream Drives'
              : 'Sync VTOP to compute tier eligibility'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px', margin: 0 }}>
            Authoritative VTOP CGPA: <b style={{ color: 'var(--text-primary)' }}>{cgpaText}</b> (Cutoff: ≥ 8.00 for Super Dream) • Standing Arrears: <b style={{ color: 'var(--text-primary)' }}>0</b>
          </p>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <ShieldCheck size={20} color={isSuperDreamEligible ? 'var(--success-emerald)' : 'var(--brand-color)'} />
          <span
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              background: isSuperDreamEligible ? 'var(--success-bg)' : 'var(--brand-bg)',
              border: `1px solid ${isSuperDreamEligible ? 'var(--success-border)' : 'var(--border-subtle)'}`,
              color: isSuperDreamEligible ? 'var(--success-emerald)' : 'var(--brand-color)',
              fontSize: '0.82rem',
              fontWeight: 800,
            }}
          >
            {isSuperDreamEligible ? 'Super Dream Qualified' : 'Active Profile'}
          </span>
        </div>
      </div>

      {/* Primary Feature: LeetCode Live Integration Cockpit */}
      <LeetCodeDashboard />

      {/* Campus Recruitment Drives (Only shown if drives exist from portal) */}
      {drives && drives.length > 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Building2 size={18} color="var(--brand-color)" />
            <h3 style={{ fontSize: '1.15rem', fontWeight: 700, margin: 0, color: 'var(--text-primary)' }}>
              Upcoming Campus Recruitment Drives
            </h3>
          </div>
          <div className="assignments-container">
            {drives.map((drive) => {
              const tags = drive.tags || ['Super Dream'];
              const driveLocation = drive.location || 'VIT Campus / Online';
              const deadlineText = drive.deadline || drive.deadlineToApply || 'Upcoming';

              return (
                <div key={drive.id} className="assignment-item-card">
                  <div>
                    <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                      <h4 style={{ fontSize: '1.15rem', fontWeight: 800, color: 'var(--text-primary)' }}>{drive.companyName}</h4>
                      <div style={{ display: 'flex', gap: '4px' }}>
                        {tags.map((t) => (
                          <span key={t} style={{ fontSize: '0.68rem', padding: '2px 6px', background: 'var(--brand-bg)', color: 'var(--brand-color)', borderRadius: '4px', fontWeight: 600 }}>
                            {t}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                      {drive.role} • 📍 {driveLocation}
                    </div>
                    <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                      {drive.driveDate && <>Drive Date: <b style={{ color: 'var(--text-primary)' }}>{drive.driveDate}</b> • </>}Registration Deadline: <b style={{ color: 'var(--text-primary)' }}>{deadlineText}</b>
                    </div>
                  </div>

                  <div style={{ textAlign: 'right', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '8px' }}>
                    <div style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--success-emerald)' }}>
                      {drive.ctc}
                    </div>
                    <span className="attendance-percentage-pill safe">
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
