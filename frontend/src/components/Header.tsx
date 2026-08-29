import React, { useState } from 'react';
import { StudentProfile } from '../types';

export type ThemeType = 'chaingpt-cyber' | 'chaingpt-matrix' | 'chaingpt-solana' | 'midnight-slate' | 'baby-pink' | 'nordic-blue';

interface HeaderProps {
  student: StudentProfile;
  activeView: string;
  onRefresh?: () => void;
  onOpenVtopModal: () => void;
  syncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({
  student,
  activeView,
  onOpenVtopModal,
  syncing,
}) => {
  const [showAppModal, setShowAppModal] = useState<boolean>(false);

  const studentName = student?.name || 'Not Connected';
  const studentRegNo = student?.regNo || 'Sync VTOP';
  const studentProgram = student?.program || 'VIT Chennai';
  const studentSemester = student?.semester || 'N/A';
  const isAuth = Boolean(student?.regNo && student.regNo !== 'Not available');
  const avatarInitials = student?.name
    ? student.name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'OS';

  return (
    <>
      <header className="top-header">
        <div className="header-left" style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
          <div className="header-title-block">
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <h1 style={{ textTransform: 'capitalize' }}>{activeView.replace('-', ' ')}</h1>
              <span className="badge-chaingpt" style={{ fontSize: '0.68rem', padding: '2px 8px' }}>
                <span className="pulse-dot" />
                {isAuth ? 'VTOP SYNC v2.0' : 'OFFLINE'}
              </span>
            </div>
            <p>{studentProgram} • Semester {studentSemester}</p>
          </div>
        </div>

        <div className="header-right">
          {/* Download App Button */}
          <button
            className="btn-outline"
            onClick={() => setShowAppModal(true)}
            title="Download CampusOS Mobile App"
            style={{ borderColor: 'var(--border-medium)', fontSize: '0.82rem' }}
          >
            <span>📲</span>
            <span>App</span>
          </button>

          {/* VTOP Sync Modal / Force Refresh Button */}
          <button
            className="btn-primary"
            onClick={onOpenVtopModal}
            disabled={syncing}
            title="Login or sync with VTOP portal"
            style={{ fontSize: '0.82rem', padding: '8px 16px' }}
          >
            <span style={{ display: 'inline-block', transform: syncing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s ease' }}>
              ⚡
            </span>
            {syncing ? 'Syncing...' : 'Sync VTOP'}
          </button>

          {/* User Profile */}
          <div
            className="user-profile-badge"
            onClick={onOpenVtopModal}
            style={{ cursor: 'pointer' }}
            title="Click to manage VTOP session"
          >
            <div className="user-avatar">
              {avatarInitials}
            </div>
            <div className="user-details">
              <span className="user-name">{studentName}</span>
              <span className="user-reg">{studentRegNo}</span>
            </div>
          </div>
        </div>
      </header>

      {/* App Coming Soon Modal */}
      {showAppModal && (
        <div className="modal-backdrop" onClick={() => setShowAppModal(false)}>
          <div className="login-card" onClick={(e) => e.stopPropagation()} style={{ textAlign: 'center', alignItems: 'center' }}>
            <div className="brand-logo-badge" style={{ width: '56px', height: '56px', fontSize: '1.6rem', margin: '0 auto' }}>
              📲
            </div>

            <div>
              <span style={{ fontSize: '0.75rem', fontWeight: 800, padding: '4px 10px', background: 'var(--brand-bg)', color: 'var(--brand-color)', borderRadius: 'var(--radius-full)', textTransform: 'uppercase' }}>
                Under Development
              </span>
              <h2 style={{ fontSize: '1.4rem', fontWeight: 800, marginTop: '10px' }}>CampusOS Mobile App</h2>
              <p style={{ fontSize: '0.9rem', color: 'var(--text-secondary)', marginTop: '6px' }}>
                The native iOS and Android mobile app is currently in build testing.
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '16px 20px', width: '100%', display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div style={{ fontSize: '1.1rem', fontWeight: 800, color: 'var(--brand-color)' }}>
                🚀 Coming Soon
              </div>
              <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                Featuring offline timetable widgets, real-time attendance notification alerts, and automated LMS assignment sync.
              </p>

              <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginTop: '6px' }}>
                <div style={{ padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 700 }}>
                  🍏 iOS App Store
                </div>
                <div style={{ padding: '6px 12px', background: 'var(--bg-surface)', border: '1px solid var(--border-medium)', borderRadius: 'var(--radius-sm)', fontSize: '0.8rem', fontWeight: 700 }}>
                  🤖 Google Play
                </div>
              </div>
            </div>

            <button
              className="btn-primary"
              style={{ width: '100%', justifyContent: 'center', padding: '10px' }}
              onClick={() => setShowAppModal(false)}
            >
              Got it!
            </button>
          </div>
        </div>
      )}
    </>
  );
};
