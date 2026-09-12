import React, { useState } from 'react';
import {
  LayoutDashboard,
  GraduationCap,
  ClipboardList,
  CreditCard,
  Briefcase,
  BrainCircuit,
  Zap,
  LogOut,
  Palette,
  Check,
} from 'lucide-react';

export type NavView = 'dashboard' | 'academics' | 'assignments' | 'fees' | 'placements' | 'ai-planner';

import { ThemeType, THEMES } from "./Header";

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  pendingAssignmentsCount: number;
  criticalAttendanceCount: number;
  currentTheme?: ThemeType;
  onSelectTheme?: (t: ThemeType) => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  pendingAssignmentsCount,
  criticalAttendanceCount,
  currentTheme = 'cyber-dark',
  onSelectTheme,
  onLogout,
}) => {
  const [showThemePicker, setShowThemePicker] = useState<boolean>(false);
  const activeThemeObj = THEMES.find(
    (t) => t.id === currentTheme || (t.id === 'cyber-dark' && currentTheme === 'midnight-slate')
  ) || THEMES[0];

  const mainNavItems = [
    { id: 'dashboard' as NavView, label: 'Dashboard', icon: LayoutDashboard },
    {
      id: 'academics' as NavView,
      label: 'Academics',
      icon: GraduationCap,
      badge: criticalAttendanceCount > 0 ? { count: criticalAttendanceCount, alert: true } : undefined,
    },
    {
      id: 'assignments' as NavView,
      label: 'Assignments',
      icon: ClipboardList,
      badge: pendingAssignmentsCount > 0 ? { count: pendingAssignmentsCount, alert: false } : undefined,
    },
    { id: 'fees' as NavView, label: 'Fees & Ledger', icon: CreditCard },
    { id: 'placements' as NavView, label: 'Placements & DSA', icon: Briefcase },
  ];

  const intelligenceNavItems = [
    { id: 'ai-planner' as NavView, label: 'AI Study Planner', icon: BrainCircuit, badge: { count: 'AI', alert: false } },
  ];

  return (
    <aside className="app-sidebar">
      {/* Brand Header */}
      <div
        className="sidebar-brand-block"
        onClick={() => onSelectView('dashboard')}
        style={{ cursor: 'pointer' }}
        title="Go to Dashboard"
      >
        <div className="brand-icon-box">
          <Zap size={19} />
        </div>
        <div className="brand-info">
          <span className="brand-title">
            Campus<span className="brand-title-os">OS</span>
          </span>
          <span className="brand-subtitle">Academic OS • VIT</span>
        </div>
      </div>

      {/* Navigation List */}
      <nav className="sidebar-nav-list" aria-label="Main Navigation">
        <div className="sidebar-section-header">Core Academic</div>
        {mainNavItems.map((item) => {
          const isActive = activeView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectView(item.id)}
            >
              <div className="nav-item-left">
                <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className={`nav-badge-pill ${item.badge.alert ? 'alert' : ''}`}>
                  {item.badge.count}
                </span>
              )}
            </button>
          );
        })}

        <div className="sidebar-section-header">Intelligence</div>
        {intelligenceNavItems.map((item) => {
          const isActive = activeView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-item-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectView(item.id)}
            >
              <div className="nav-item-left">
                <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span className="nav-badge-pill" style={{ color: 'var(--accent-purple)', background: 'rgba(139, 92, 246, 0.15)' }}>
                  {item.badge.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      {/* Footer / Theme Switcher & Sign Out Action */}
      <div className="sidebar-footer-block" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {onSelectTheme && (
          <div style={{ position: 'relative' }}>
            <button
              className="btn btn-secondary btn-sm"
              style={{
                width: '100%',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '0 12px',
                height: '36px',
              }}
              onClick={() => setShowThemePicker(!showThemePicker)}
              title="Switch CampusOS Theme"
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Palette size={14} color="var(--accent-cyan)" />
                <span style={{ fontSize: '0.80rem', fontWeight: 600 }}>Theme</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <span style={{ fontSize: '0.74rem', color: 'var(--text-muted)' }}>
                  {activeThemeObj.label.split(' ')[0]}
                </span>
                <div
                  className="theme-swatch-badge"
                  style={{
                    width: '13px',
                    height: '13px',
                    borderWidth: '1px',
                    backgroundColor: activeThemeObj.previewBg,
                  }}
                >
                  <div
                    className="theme-swatch-accent-dot"
                    style={{
                      width: '5px',
                      height: '5px',
                      backgroundColor: activeThemeObj.previewAccent,
                    }}
                  />
                </div>
              </div>
            </button>

            {showThemePicker && (
              <div
                className="theme-dropdown-glass"
                style={{
                  bottom: 'calc(100% + 8px)',
                  top: 'auto',
                  left: 0,
                  right: 'auto',
                  width: '270px',
                }}
              >
                <div className="theme-dropdown-header">
                  <span>Themes & Fonts</span>
                  <span style={{ fontSize: '0.66rem', fontFamily: 'var(--font-mono)' }}>6 Options</span>
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
                        style={{ padding: '7px 10px', gap: '8px' }}
                        onClick={() => {
                          onSelectTheme(th.id);
                          setShowThemePicker(false);
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              width: '26px',
                              height: '26px',
                              borderRadius: '6px',
                              backgroundColor: th.previewBg,
                              border: `1px solid ${isSelected ? th.previewAccent : 'rgba(128,128,128,0.3)'}`,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                              fontFamily: th.fontFamily,
                              fontSize: '11px',
                              fontWeight: 800,
                              color: th.previewText,
                            }}
                          >
                            Aa
                          </div>
                          <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0, lineHeight: 1.2 }}>
                            <span style={{ fontFamily: th.fontFamily, fontSize: '0.80rem', fontWeight: 650, color: 'var(--text-primary)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                              {th.label}
                            </span>
                            <span style={{ fontSize: '0.68rem', color: 'var(--accent-cyan)' }}>
                              {th.fontName}
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

        {onLogout && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
            onClick={onLogout}
            title="Sign out of current session"
          >
            <LogOut size={14} />
            <span>Sign Out</span>
          </button>
        )}
      </div>
    </aside>
  );
};
