import React, { useState } from 'react';
import {
  RefreshCw,
  Smartphone,
  CheckCircle2,
  Menu,
  X,
  LogOut,
} from 'lucide-react';
import { StudentProfile } from '../types';

export type ThemeType = 'midnight-slate' | 'chaingpt-cyber' | 'baby-pink' | 'nordic-blue';

interface HeaderProps {
  student: StudentProfile;
  activeView: string;
  onRefresh?: () => void;
  onOpenVtopModal: () => void;
  syncing: boolean;
  onToggleMobileMenu?: () => void;
  onOpenLanding?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  student,
  activeView,
  onOpenVtopModal,
  syncing,
  onToggleMobileMenu,
  onOpenLanding,
  onLogout,
}) => {
  const [showAppModal, setShowAppModal] = useState<boolean>(false);

  const studentName = student?.name || 'Student';
  const studentRegNo = student?.regNo || 'Sync Required';
  const studentProgram = student?.program || 'VIT Chennai';
  const studentSemester = student?.semester ? `Semester ${student.semester}` : 'Fall Semester 2026-27';

  const avatarInitials = student?.name
    ? student.name
        .split(' ')
        .filter(Boolean)
        .map((n) => n[0])
        .slice(0, 2)
        .join('')
        .toUpperCase()
    : 'OS';

  const formatViewTitle = (view: string) => {
    switch (view) {
      case 'dashboard':
        return 'Dashboard';
      case 'academics':
        return 'Academics';
      case 'assignments':
        return 'Assignments';
      case 'fees':
        return 'Fees & Ledger';
      case 'placements':
        return 'Placements & DSA';
      case 'ai-planner':
        return 'AI Study Planner';
      default:
        return view.replace('-', ' ');
    }
  };

  return (
    <>
      <header className="app-header">
        <div className="header-left-block">
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            {onToggleMobileMenu && (
              <button
                onClick={onToggleMobileMenu}
                className="mobile-hamburger-btn btn btn-ghost btn-sm"
                aria-label="Open Actions Drawer"
              >
                <Menu size={20} />
              </button>
            )}
            <h1 className="header-page-title">{formatViewTitle(activeView)}</h1>
          </div>
          <div className="header-context-meta">
            <span>{studentProgram}</span>
            <span>•</span>
            <span>{studentSemester}</span>
          </div>
        </div>

        <div className="header-right-actions">
          {/* Landing Page Button (Desktop Only) */}
          {onOpenLanding && (
            <button
              className="btn btn-secondary btn-sm desktop-only-btn"
              onClick={onOpenLanding}
              title="View 3D Landing Page"
            >
              <span>Landing</span>
            </button>
          )}

          {/* Sync VTOP Primary Action Button */}
          <button
            className="btn btn-primary btn-sm header-sync-btn"
            onClick={onOpenVtopModal}
            disabled={syncing}
            title="Authenticate or synchronize with live VTOP portal"
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            <span className="sync-btn-label">{syncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* User Profile Capsule */}
          <div
            className="user-profile-capsule"
            onClick={onOpenVtopModal}
            style={{ cursor: 'pointer' }}
            title="Click to manage VTOP session & credentials"
          >
            <div className="user-avatar-circle">{avatarInitials}</div>
            <div className="user-profile-text-block" style={{ display: 'flex', flexDirection: 'column', lineHeight: 1.1 }}>
              <span style={{ fontSize: '0.80rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                {studentName.split(' ')[0]}
              </span>
              <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', color: 'var(--text-muted)' }}>
                {studentRegNo}
              </span>
            </div>
          </div>

          {/* Sign Out Button (Desktop Only) */}
          {onLogout && (
            <button
              className="btn btn-secondary btn-sm desktop-only-btn"
              onClick={onLogout}
              title="Sign out of current session"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <LogOut size={13} />
              <span>Sign Out</span>
            </button>
          )}
        </div>
      </header>

      {/* App Coming Soon Modal */}
      {showAppModal && (
        <div className="modal-backdrop" onClick={() => setShowAppModal(false)}>
          <div className="modal-content-glass" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div className="modal-header-row">
              <div className="brand-icon-box" style={{ width: '38px', height: '38px' }}>
                <Smartphone size={18} />
              </div>
              <button
                onClick={() => setShowAppModal(false)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px' }}
              >
                <X size={18} />
              </button>
            </div>

            <div>
              <span className="status-badge info" style={{ marginBottom: '8px' }}>
                Development Preview
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                CampusOS Mobile App
              </h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Native mobile builds for iOS and Android featuring offline timetable widgets, real-time attendance safety alerts, and automated LMS assignment sync.
              </p>
            </div>

            <div style={{ background: 'var(--surface-input)', border: '1px solid var(--border-secondary)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                <CheckCircle2 size={16} />
                <span>Beta Testing in Progress</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Register for early TestFlight and APK access via student portal notification.
              </p>
            </div>

            <button
              onClick={() => setShowAppModal(false)}
              className="btn btn-primary"
              style={{ width: '100%' }}
            >
              <span>Got it</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
