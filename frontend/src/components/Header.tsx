import React, { useState } from 'react';
import {
  RefreshCw,
  Smartphone,
  CheckCircle2,
  Menu,
  X,
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
}

export const Header: React.FC<HeaderProps> = ({
  student,
  activeView,
  onOpenVtopModal,
  syncing,
  onToggleMobileMenu,
}) => {
  const [showAppModal, setShowAppModal] = useState<boolean>(false);

  const studentName = student?.name || 'Not Connected';
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
      case 'vtop-sync':
        return 'VTOP Live Hub';
      case 'academics':
        return 'Academics';
      case 'assignments':
        return 'Assignments';
      case 'fees':
        return 'Fees & Receipts';
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
        <div className="header-meta" style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="btn-outline btn-sm"
              style={{ display: 'none', padding: '6px' }}
              aria-label="Toggle Navigation"
            >
              <Menu size={18} />
            </button>
          )}
          <div>
            <h1 className="header-page-title">{formatViewTitle(activeView)}</h1>
            <p className="header-subtitle">
              {studentProgram} • {studentSemester}
            </p>
          </div>
        </div>

        <div className="header-actions-group">
          {/* Mobile App Download Action */}
          <button
            className="btn btn-outline btn-sm"
            onClick={() => setShowAppModal(true)}
            title="Download CampusOS Mobile App"
          >
            <Smartphone size={15} />
            <span>Mobile App</span>
          </button>

          {/* Sync VTOP Button */}
          <button
            className="btn btn-primary btn-sm"
            onClick={onOpenVtopModal}
            disabled={syncing}
            title="Authenticate or synchronize with live VTOP portal"
          >
            <RefreshCw size={14} className={syncing ? 'animate-spin' : ''} />
            <span>{syncing ? 'Syncing...' : 'Sync VTOP'}</span>
          </button>

          {/* User Profile Pill */}
          <div
            className="user-profile-pill"
            onClick={onOpenVtopModal}
            title="Click to manage VTOP session & credentials"
          >
            <div className="user-avatar-circle">{avatarInitials}</div>
            <div className="user-text-info">
              <span className="user-display-name">{studentName}</span>
              <span className="user-reg-code">{studentRegNo}</span>
            </div>
          </div>
        </div>
      </header>

      {/* App Coming Soon Modal */}
      {showAppModal && (
        <div className="modal-backdrop-overlay" onClick={() => setShowAppModal(false)}>
          <div className="modal-dialog-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '440px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div className="brand-icon-box" style={{ width: '42px', height: '42px' }}>
                <Smartphone size={20} />
              </div>
              <button
                onClick={() => setShowAppModal(false)}
                className="btn btn-ghost btn-sm"
                style={{ padding: '4px', color: 'var(--text-muted)' }}
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
              <p style={{ fontSize: '0.86rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Native mobile builds for iOS and Android featuring offline timetable widgets, real-time attendance alerts, and automated LMS assignment sync.
              </p>
            </div>

            <div style={{ background: 'var(--bg-surface-elevated)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.88rem', fontWeight: 700, color: 'var(--brand-color)' }}>
                <CheckCircle2 size={16} />
                <span>Beta Testing in Progress</span>
              </div>
              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                Direct APK and TestFlight builds will be accessible for all registered students.
              </p>
            </div>

            <button
              onClick={() => setShowAppModal(false)}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              Got it
            </button>
          </div>
        </div>
      )}
    </>
  );
};
