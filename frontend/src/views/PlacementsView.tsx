import React from 'react';
import { PlacementDrive, DSACategory, StudentProfile } from '../types';

interface PlacementsViewProps {
  drives: PlacementDrive[];
  dsaTopics: DSACategory[];
  student?: StudentProfile;
}

export const PlacementsView: React.FC<PlacementsViewProps> = ({ drives, dsaTopics, student }) => {
  const totalSolved = dsaTopics.reduce((acc, t) => acc + t.solved, 0);
  const totalProblems = dsaTopics.reduce((acc, t) => acc + t.total, 0);

  const cgpa = student?.cgpa ?? null;
  const isSuperDreamEligible = cgpa !== null ? cgpa >= 8.0 : true;
  const cgpaText = cgpa !== null ? Number(cgpa).toFixed(2) : "Sync VTOP to check";

  return (
    <div className="page-content">
      {/* Placement Readiness Banner */}
      <div style={{ background: 'linear-gradient(135deg, #111622 0%, #1a2233 100%)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-lg)', padding: '24px 28px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
        <div>
          <span style={{ fontSize: '0.75rem', fontWeight: 700, letterSpacing: '0.5px', color: 'var(--brand-blue)', textTransform: 'uppercase' }}>
            Campus Placement Portal 2026 Batch • {student?.program || 'Engineering'}
          </span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '4px' }}>
            Placement Eligibility: {isSuperDreamEligible ? '100% Eligible (Super Dream & Dream)' : 'Eligible for Core & Dream Drives'}
          </h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
            Authoritative VTOP CGPA: <b>{cgpaText}</b> (Cutoff: ≥ 8.00) • Standing Arrears: <b>0</b> • Total Solved DSA: <b>{totalSolved} / {totalProblems}</b>
          </p>
        </div>

        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: '2rem', fontWeight: 800, color: 'var(--success-emerald)' }}>
            🔥 42 Days
          </div>
          <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Daily DSA Problem Streak</span>
        </div>
      </div>

      {/* DSA Topic Mastery Grid */}
      <div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>DSA Topic Breakdown (LeetCode / Codeforces)</h3>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '16px' }}>
          {dsaTopics.map((topic, idx) => {
            const topicName = topic.name || topic.category || `Topic ${idx + 1}`;
            const percent = topic.total > 0 ? Math.round((topic.solved / topic.total) * 100) : 0;
            return (
              <div key={topicName} className="course-card" style={{ padding: '18px 20px' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h4 style={{ fontSize: '0.95rem', fontWeight: 700 }}>{topicName}</h4>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--brand-blue)' }}>
                    {topic.solved} / {topic.total} ({percent}%)
                  </span>
                </div>

                <div className="progress-track" style={{ margin: '10px 0' }}>
                  <div className="progress-fill emerald" style={{ width: `${percent}%` }} />
                </div>

                <div style={{ display: 'flex', gap: '12px', fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                  <span>Easy: <b style={{ color: 'var(--success-emerald)' }}>{topic.easy}</b></span>
                  <span>Med: <b style={{ color: 'var(--warning-amber)' }}>{topic.medium}</b></span>
                  <span>Hard: <b style={{ color: 'var(--danger-crimson)' }}>{topic.hard}</b></span>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Upcoming Placement Drives */}
      <div>
        <h3 style={{ fontSize: '1.15rem', fontWeight: 700, marginBottom: '16px' }}>Upcoming Campus Recruitment Drives</h3>
        <div className="assignments-container">
          {drives.map((drive) => {
            const tags = drive.tags || ['Super Dream'];
            const driveLocation = drive.location || 'VIT Campus / Online';
            const deadlineText = drive.deadline || drive.deadlineToApply || 'Upcoming';

            return (
              <div key={drive.id} className="assignment-item-card">
                <div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '6px' }}>
                    <h4 style={{ fontSize: '1.15rem', fontWeight: 800 }}>{drive.companyName}</h4>
                    <div style={{ display: 'flex', gap: '4px' }}>
                      {tags.map((t) => (
                        <span key={t} style={{ fontSize: '0.68rem', padding: '2px 6px', background: 'rgba(56, 189, 248, 0.1)', color: 'var(--brand-blue)', borderRadius: '4px', fontWeight: 600 }}>
                          {t}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div style={{ fontSize: '0.92rem', color: 'var(--text-secondary)' }}>
                    {drive.role} • 📍 {driveLocation}
                  </div>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                    {drive.driveDate && <>Drive Date: <b>{drive.driveDate}</b> • </>}Registration Deadline: <b>{deadlineText}</b>
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
    </div>
  );
};

export default PlacementsView;
