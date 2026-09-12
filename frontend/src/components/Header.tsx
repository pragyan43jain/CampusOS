import React, { useState, useEffect } from 'react';
import {
  RefreshCw,
  Smartphone,
  CheckCircle2,
  Menu,
  X,
  LogOut,
  Palette,
  Check,
} from 'lucide-react';
import { StudentProfile } from '../types';

export type ThemeType =
  | 'cyber-dark'
  | 'midnight-sapphire'
  | 'emerald-forest'
  | 'sunset-amber'
  | 'nordic-frost'
  | 'paper-light'
  | 'midnight-slate'
  | 'chaingpt-cyber'
  | 'baby-pink'
  | 'nordic-blue';

export interface ThemeOption {
  id: ThemeType;
  label: string;
  description: string;
  previewBg: string;
  previewCard: string;
  previewAccent: string;
  previewSecondary: string;
  badge?: string;
  isLight?: boolean;
}

export const THEMES: ThemeOption[] = [
  {
    id: 'cyber-dark',
    label: 'Cyber Obsidian',
    description: 'Deep pitch black with neon cyan and electric blue accents',
    previewBg: '#07080D',
    previewCard: '#10121C',
    previewAccent: '#2DE7D3',
    previewSecondary: '#4C8DFF',
    badge: 'Default',
  },
  {
    id: 'midnight-sapphire',
    label: 'Midnight Sapphire',
    description: 'Oceanic deep navy with vibrant sky blue and indigo tones',
    previewBg: '#060B18',
    previewCard: '#0F1A36',
    previewAccent: '#38BDF8',
    previewSecondary: '#6366F1',
    badge: 'Popular',
  },
  {
    id: 'emerald-forest',
    label: 'Emerald Forest',
    description: 'Cognitive focus deep forest slate with restorative emerald green',
    previewBg: '#040E0A',
    previewCard: '#0D221A',
    previewAccent: '#10B981',
    previewSecondary: '#06B6D4',
    badge: 'Focus',
  },
  {
    id: 'sunset-amber',
    label: 'Sunset Amber',
    description: 'Warm twilight violet with glowing amber gold and synthwave rose',
    previewBg: '#0E0916',
    previewCard: '#1D142E',
    previewAccent: '#F59E0B',
    previewSecondary: '#EC4899',
    badge: 'Warm',
  },
  {
    id: 'nordic-frost',
    label: 'Nordic Frost',
    description: 'Arctic dark slate with clean ice cyan and polar blue',
    previewBg: '#0F141C',
    previewCard: '#1C2533',
    previewAccent: '#88C0D0',
    previewSecondary: '#81A1C1',
    badge: 'Minimal',
  },
  {
    id: 'paper-light',
    label: 'Paper Daylight',
    description: 'Crisp, clean high-contrast daylight mode for study halls',
    previewBg: '#F8FAFC',
    previewCard: '#FFFFFF',
    previewAccent: '#0284C7',
    previewSecondary: '#2563EB',
    badge: 'Light',
    isLight: true,
  },
];

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
  const [showThemeDropdown, setShowThemeDropdown] = useState<boolean>(false);

  useEffect(() => {
    if (!showThemeDropdown) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setShowThemeDropdown(false);
    };
    const handleClickOutside = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.theme-menu-container')) {
        setShowThemeDropdown(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showThemeDropdown]);

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

  const activeThemeObj = THEMES.find(
    (t) => t.id === currentTheme || (t.id === 'cyber-dark' && currentTheme === 'midnight-slate')
  ) || THEMES[0];

  return (
    <>
      <header className="app-header">
        <div className="header-left-block">
          {onToggleMobileMenu && (
            <button
              onClick={onToggleMobileMenu}
              className="mobile-hamburger-btn btn btn-ghost btn-sm"
              aria-label="Open Actions Drawer"
            >
              <Menu size={20} />
            </button>
          )}
          <div className="header-title-group">
            <h1 className="header-page-title">{formatViewTitle(activeView)}</h1>
            <div className="header-context-meta">
              <span>{studentProgram}</span>
              <span>•</span>
              <span>{studentSemester}</span>
            </div>
          </div>
        </div>

        <div className="header-right-actions">
          {/* Direct Live Sync Button */}
          <button
            className="btn btn-primary header-sync-btn"
            onClick={onSync || onOpenVtopModal}
            disabled={syncing}
            title={syncing ? "Synchronizing academic data..." : "Sync latest grades, attendance, timetable & assignments directly"}
          >
            <RefreshCw size={13} className={syncing ? 'animate-spin' : ''} />
            <span className="sync-btn-label">{syncing ? 'Syncing...' : 'Sync'}</span>
          </button>

          {/* Theme Switcher Button & Dropdown */}
          {onSelectTheme && (
            <div className="theme-menu-container">
              <button
                className="theme-toggle-btn"
                onClick={() => setShowThemeDropdown(!showThemeDropdown)}
                title="Customize UI Theme & Palette"
                aria-label="Toggle Theme Menu"
              >
                <Palette size={14} color="var(--accent-cyan)" />
                <span className="theme-btn-label desktop-only-inline">Theme</span>
                <div
                  className="theme-swatch-badge"
                  style={{
                    width: '14px',
                    height: '14px',
                    borderWidth: '1px',
                    backgroundColor: activeThemeObj.previewBg,
                  }}
                >
                  <div
                    className="theme-swatch-accent-dot"
                    style={{
                      width: '6px',
                      height: '6px',
                      backgroundColor: activeThemeObj.previewAccent,
                    }}
                  />
                </div>
              </button>

              {showThemeDropdown && (
                <div className="theme-dropdown-glass">
                  <div className="theme-dropdown-header">
                    <span>Display Themes</span>
                    <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)' }}>6 PALETTES</span>
                  </div>
                  <div className="theme-menu-list">
                    {THEMES.map((th) => {
                      const isSelected =
                        currentTheme === th.id ||
                        (th.id === 'cyber-dark' && currentTheme === 'midnight-slate');
                      return (
                        <button
                          key={th.id}
                          className={`theme-menu-item ${isSelected ? 'active' : ''}`}
                          onClick={() => {
                            onSelectTheme(th.id);
                            setShowThemeDropdown(false);
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                              className="theme-swatch-badge"
                              style={{ backgroundColor: th.previewBg }}
                            >
                              <div
                                className="theme-swatch-accent-dot"
                                style={{ backgroundColor: th.previewAccent }}
                              />
                            </div>
                            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', lineHeight: 1.15 }}>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                                <span style={{ fontSize: '0.82rem', fontWeight: 700, color: 'var(--text-primary)' }}>
                                  {th.label}
                                </span>
                                {th.badge && (
                                  <span
                                    style={{
                                      fontSize: '0.65rem',
                                      padding: '1px 5px',
                                      borderRadius: '4px',
                                      background: isSelected ? 'var(--accent-cyan)' : 'var(--surface-hover)',
                                      color: isSelected ? 'var(--text-inverse)' : 'var(--text-muted)',
                                      fontWeight: 700,
                                    }}
                                  >
                                    {th.badge}
                                  </span>
                                )}
                              </div>
                              <span style={{ fontSize: '0.70rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                                {th.description}
                              </span>
                            </div>
                          </div>
                          {isSelected && <Check size={14} color="var(--accent-cyan)" strokeWidth={2.5} />}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          <div className="header-divider desktop-only-inline" />

          {/* User Profile Capsule */}
          <div
            className="user-profile-capsule"
            onClick={onOpenVtopModal}
            title="Manage VTOP Portal Session & Credentials"
          >
            <div className="user-avatar-circle">{avatarInitials}</div>
            <div className="user-profile-text-block">
              <span className="user-profile-name">
                {studentName.split(' ')[0]}
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
              onClick={onLogout}
              title="Sign out of current session"
              aria-label="Sign out"
            >
              <LogOut size={14} />
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
