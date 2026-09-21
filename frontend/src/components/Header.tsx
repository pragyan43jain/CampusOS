import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Smartphone,
  CheckCircle2,
  Menu,
  X,
  LogOut,
  Download,
} from 'lucide-react';
import { StudentProfile } from '../types';
import { ThemeSwitcher, THEMES, ThemeType, ThemeOption } from './ThemeSwitcher';
import { MobileBridge, usePWAInstallPrompt } from '../services/mobileBridge';

export { THEMES, ThemeSwitcher };
export type { ThemeType, ThemeOption };

interface HeaderProps {
  student: StudentProfile;
  activeView: string;
  currentTheme?: ThemeType;
  onSelectTheme?: (t: ThemeType) => void;
  onRefresh?: () => void;
  onSync?: () => void;
  onOpenVtopModal: () => void;
  syncing: boolean;
  onToggleMobileMenu?: () => void;
  onLogout?: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  student,
  activeView,
  currentTheme = 'cyber-dark',
  onSelectTheme,
  onSync,
  onOpenVtopModal,
  syncing,
  onToggleMobileMenu,
  onLogout,
}) => {
  const [showAppModal, setShowAppModal] = useState<boolean>(false);
  const { promptInstall, subscribeInstallState } = usePWAInstallPrompt();
  const [canInstall, setCanInstall] = useState<boolean>(false);
  const isStandalone = MobileBridge.isStandalone();

  useEffect(() => {
    const unsub = subscribeInstallState((val) => setCanInstall(val));
    return unsub;
  }, [subscribeInstallState]);

  const formatTitleCase = (val: string): string => {
    if (!val) return '';
    const clean = val.trim();
    if (!clean) return '';
    const first = clean.split(' ')[0];
    if (/\d/.test(first)) {
      return first.toUpperCase();
    }
    return first.charAt(0).toUpperCase() + first.slice(1).toLowerCase();
  };

  const savedUser = typeof window !== 'undefined' ? localStorage.getItem('campus_vtop_username') : '';
  const rawStudentName = (student?.name && student.name !== 'Student' && student.name !== 'Not connected')
    ? student.name
    : (student?.regNo && student.regNo !== 'Not available'
        ? student.regNo
        : (savedUser || 'Student'));

  const studentDisplayName = formatTitleCase(rawStudentName) || 'Student';
  const studentRegNo = student?.regNo || (savedUser && /\d/.test(savedUser) ? savedUser.toUpperCase() : 'Sync Required');
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

  const handleSyncClick = () => {
    MobileBridge.vibrate('light');
    if (onSync) onSync();
    else onOpenVtopModal();
  };

  const handleProfileClick = () => {
    MobileBridge.vibrate('light');
    onOpenVtopModal();
  };

  return (
    <>
      <header className="app-header">
        <div className="header-left-block">
          {onToggleMobileMenu && (
            <button
              onClick={() => {
                MobileBridge.vibrate('light');
                onToggleMobileMenu();
              }}
              className="mobile-hamburger-btn btn btn-ghost btn-sm"
              aria-label="Open Actions Drawer"
            >
              <Menu size={20} />
            </button>
          )}
          <div className="header-title-group">
            <h1 className="header-page-title">{formatViewTitle(activeView)}</h1>
            <div className="header-context-meta">
              <span className="header-context-program">{studentProgram}</span>
              <span className="header-context-separator">•</span>
              <span className="header-context-sem">{studentSemester}</span>
            </div>
          </div>
        </div>

        <div className="header-right-actions">
          {/* Mobile App Button (Quick Install/Info) */}
          {!isStandalone && canInstall && (
            <button
              className="btn btn-secondary btn-sm mobile-app-install-header-btn"
              onClick={async () => {
                MobileBridge.vibrate('medium');
                const installed = await promptInstall();
                if (installed) MobileBridge.vibrate('success');
              }}
              title="Install CampusOS on your mobile device"
              style={{
                height: '34px',
                padding: '0 10px',
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                color: 'var(--accent-cyan)',
                borderColor: 'rgba(45, 231, 211, 0.4)',
              }}
            >
              <Download size={14} />
              <span className="desktop-only-inline" style={{ fontSize: '0.78rem', fontWeight: 700 }}>Install App</span>
            </button>
          )}

          {/* Direct Live Sync Button */}
          <button
            className="btn btn-primary header-sync-btn"
            onClick={handleSyncClick}
            disabled={syncing}
            title={syncing ? "Synchronizing academic data..." : "Sync latest grades, attendance, timetable & assignments directly"}
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            <span className="sync-btn-label">{syncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Theme Switcher Button & Dropdown */}
          {onSelectTheme && (
            <ThemeSwitcher
              currentTheme={currentTheme}
              onSelectTheme={onSelectTheme}
            />
          )}

          <div className="header-divider desktop-only-inline" />

          {/* User Profile Capsule */}
          <div
            className="user-profile-capsule"
            onClick={handleProfileClick}
            title="Manage VTOP Portal Session & Credentials"
          >
            <div className="user-avatar-circle">{avatarInitials}</div>
            <div className="user-profile-text-block">
              <span className="user-profile-name">
                {studentDisplayName}
              </span>
              <span className="user-profile-reg">
                {studentRegNo}
              </span>
            </div>
          </div>

          {/* Sign Out Button (Desktop Only) */}
          {onLogout && (
            <button
              className="header-logout-btn desktop-only-inline"
              onClick={() => {
                MobileBridge.vibrate('medium');
                onLogout();
              }}
              title="Sign out of current session"
              aria-label="Sign out"
            >
              <LogOut size={14} />
            </button>
          )}
        </div>
      </header>

      {/* App Info & Install Modal */}
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
              <span className="status-badge safe" style={{ marginBottom: '8px' }}>
                Mobile Application Ready
              </span>
              <h2 style={{ fontSize: '1.25rem', fontWeight: 800, color: 'var(--text-primary)' }}>
                CampusOS Mobile
              </h2>
              <p style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', marginTop: '4px' }}>
                Complete student cockpit powered by Capacitor native Android packaging and PWA offline installation.
              </p>
            </div>

            <div style={{ background: 'var(--surface-input)', border: '1px solid var(--border-secondary)', borderRadius: 'var(--radius-md)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.86rem', fontWeight: 700, color: 'var(--accent-cyan)' }}>
                <CheckCircle2 size={16} />
                <span>Native Capacitor &amp; PWA Activated</span>
              </div>
              <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
                Install directly to your home screen or build native Android APKs using the configured Capacitor Android shell.
              </p>
            </div>

            {canInstall && (
              <button
                onClick={async () => {
                  MobileBridge.vibrate('medium');
                  await promptInstall();
                  setShowAppModal(false);
                }}
                className="btn btn-primary"
                style={{ width: '100%' }}
              >
                <Download size={16} />
                <span>Install CampusOS App</span>
              </button>
            )}

            <button
              onClick={() => setShowAppModal(false)}
              className="btn btn-secondary"
              style={{ width: '100%' }}
            >
              <span>Close</span>
            </button>
          </div>
        </div>
      )}
    </>
  );
};
