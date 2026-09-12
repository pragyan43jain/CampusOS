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
  fontName: string;
  fontFamily: string;
  tag: string;
  description: string;
  previewBg: string;
  previewCard: string;
  previewAccent: string;
  previewSecondary: string;
  previewText: string;
  badge?: string;
  isLight?: boolean;
}

export const THEMES: ThemeOption[] = [
  {
    id: 'cyber-dark',
    label: 'Cyber Obsidian',
    fontName: 'Space Grotesk',
    fontFamily: "'Space Grotesk', sans-serif",
    tag: 'Tech Grotesque',
    description: 'Deep pitch void with high-contrast text & neon cyan accents',
    previewBg: '#07080D',
    previewCard: '#10121C',
    previewAccent: '#2DE7D3',
    previewSecondary: '#4C8DFF',
    previewText: '#FFFFFF',
    badge: 'Default',
  },
  {
    id: 'midnight-sapphire',
    label: 'Midnight Sapphire',
    fontName: 'Plus Jakarta Sans',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    tag: 'Oceanic Geometric',
    description: 'Oceanic space navy with sky blue & electric indigo glow',
    previewBg: '#060B18',
    previewCard: '#0F1A36',
    previewAccent: '#38BDF8',
    previewSecondary: '#6366F1',
    previewText: '#BAE6FD',
    badge: 'Popular',
  },
  {
    id: 'emerald-forest',
    label: 'Emerald Forest',
    fontName: 'DM Sans',
    fontFamily: "'DM Sans', sans-serif",
    tag: 'Focus Slate',
    description: 'Restorative jade slate with vibrant mint emerald accents',
    previewBg: '#040E0A',
    previewCard: '#0D221A',
    previewAccent: '#10B981',
    previewSecondary: '#06B6D4',
    previewText: '#A7F3D0',
    badge: 'Focus',
  },
  {
    id: 'sunset-amber',
    label: 'Warm Espresso',
    fontName: 'Outfit',
    fontFamily: "'Outfit', sans-serif",
    tag: 'Off-White & Dark Roast',
    description: 'Dark roast espresso with warm off-white cream text & amber gold',
    previewBg: '#131110',
    previewCard: '#211D1A',
    previewAccent: '#F59E0B',
    previewSecondary: '#FB923C',
    previewText: '#FDFBF7',
    badge: 'Warm',
  },
  {
    id: 'nordic-frost',
    label: 'Nordic Frost',
    fontName: 'Inter',
    fontFamily: "'Inter', sans-serif",
    tag: 'Surgical Minimal',
    description: 'Surgical arctic slate with clean ice cyan & polar blue',
    previewBg: '#0F141C',
    previewCard: '#1C2533',
    previewAccent: '#88C0D0',
    previewSecondary: '#81A1C1',
    previewText: '#E2E8F0',
    badge: 'Minimal',
  },
  {
    id: 'paper-light',
    label: 'Sober Warm Paper',
    fontName: 'Plus Jakarta Sans',
    fontFamily: "'Plus Jakarta Sans', sans-serif",
    tag: 'Off-White Linen & Ink',
    description: 'Sober off-white linen canvas with bold, high-contrast charcoal ink',
    previewBg: '#F5F3ED',
    previewCard: '#FFFFFF',
    previewAccent: '#0284C7',
    previewSecondary: '#2563EB',
    previewText: '#1C1917',
    badge: 'Sober Light',
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
              <span className="header-context-program">{studentProgram}</span>
              <span className="header-context-separator">•</span>
              <span className="header-context-sem">{studentSemester}</span>
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
                <div className="theme-dropdown-glass" style={{ width: '340px' }}>
                  <div className="theme-dropdown-header">
                    <span style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <Palette size={13} color="var(--accent-cyan)" />
                      <span>THEMES & FONTS</span>
                    </span>
                    <span style={{ fontSize: '0.68rem', fontFamily: 'var(--font-mono)', opacity: 0.8 }}>
                      6 STYLES
                    </span>
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
                          style={{
                            padding: '10px 12px',
                            gap: '12px',
                            borderWidth: '1px',
                            borderColor: isSelected ? 'var(--border-highlight)' : 'transparent',
                          }}
                          onClick={() => {
                            onSelectTheme(th.id);
                            setShowThemeDropdown(false);
                          }}
                        >
                          <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px', flex: 1 }}>
                            {/* Font & Palette Visual Box */}
                            <div
                              style={{
                                width: '38px',
                                height: '38px',
                                borderRadius: '8px',
                                backgroundColor: th.previewBg,
                                border: `1px solid ${isSelected ? th.previewAccent : 'rgba(128,128,128,0.25)'}`,
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                position: 'relative',
                                overflow: 'hidden',
                                boxShadow: '0 2px 8px rgba(0,0,0,0.20)',
                              }}
                            >
                              <span
                                style={{
                                  fontFamily: th.fontFamily,
                                  fontSize: '15px',
                                  fontWeight: 800,
                                  color: th.previewText,
                                  lineHeight: 1,
                                }}
                              >
                                Aa
                              </span>
                              <div
                                style={{
                                  position: 'absolute',
                                  bottom: 0,
                                  left: 0,
                                  right: 0,
                                  height: '3px',
                                  backgroundColor: th.previewAccent,
                                }}
                              />
                            </div>

                            {/* Details: Title, Font Tag, Description */}
                            <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 0, textAlign: 'left' }}>
                              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                                <span
                                  style={{
                                    fontFamily: th.fontFamily,
                                    fontSize: '0.84rem',
                                    fontWeight: 750,
                                    color: 'var(--text-primary)',
                                    letterSpacing: '-0.2px',
                                  }}
                                >
                                  {th.label}
                                </span>
                                {th.badge && (
                                  <span
                                    style={{
                                      fontSize: '0.63rem',
                                      padding: '1px 6px',
                                      borderRadius: '4px',
                                      background: isSelected ? 'var(--accent-cyan)' : 'var(--surface-hover)',
                                      color: isSelected ? 'var(--text-inverse)' : 'var(--text-muted)',
                                      fontWeight: 700,
                                      whiteSpace: 'nowrap',
                                    }}
                                  >
                                    {th.badge}
                                  </span>
                                )}
                              </div>

                              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                                <span
                                  style={{
                                    fontFamily: th.fontFamily,
                                    fontSize: '0.70rem',
                                    fontWeight: 650,
                                    color: 'var(--accent-cyan)',
                                  }}
                                >
                                  {th.fontName}
                                </span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>•</span>
                                <span style={{ fontSize: '0.68rem', color: 'var(--text-muted)' }}>{th.tag}</span>
                              </div>

                              <span
                                style={{
                                  fontSize: '0.69rem',
                                  color: 'var(--text-secondary)',
                                  marginTop: '2px',
                                  lineHeight: 1.25,
                                  whiteSpace: 'normal',
                                }}
                              >
                                {th.description}
                              </span>

                              {/* 4-Color Swatch Strip */}
                              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '5px' }}>
                                {[th.previewBg, th.previewCard, th.previewAccent, th.previewText].map((c, i) => (
                                  <div
                                    key={i}
                                    style={{
                                      width: '9px',
                                      height: '9px',
                                      borderRadius: '50%',
                                      backgroundColor: c,
                                      border: '1px solid rgba(128,128,128,0.35)',
                                    }}
                                  />
                                ))}
                              </div>
                            </div>
                          </div>

                          {isSelected && (
                            <div style={{ flexShrink: 0, paddingLeft: '4px' }}>
                              <Check size={16} color="var(--accent-cyan)" strokeWidth={2.5} />
                            </div>
                          )}
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
