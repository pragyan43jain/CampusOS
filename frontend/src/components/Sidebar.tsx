import React from 'react';
import {
  LayoutDashboard,
  GraduationCap,
  ClipboardList,
  CreditCard,
  Briefcase,
  BrainCircuit,
  ShieldCheck,
  Zap,
  LogOut,
} from 'lucide-react';

export type NavView = 'dashboard' | 'academics' | 'assignments' | 'fees' | 'placements' | 'ai-planner';

import { ThemeType } from "./Header";

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  pendingAssignmentsCount: number;
  criticalAttendanceCount: number;
  currentTheme?: ThemeType;
  onSelectTheme?: (t: ThemeType) => void;
  onOpenVtopModal?: () => void;
  onOpenLanding?: () => void;
  onLogout?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  pendingAssignmentsCount,
  criticalAttendanceCount,
  onOpenVtopModal,
  onOpenLanding,
  onLogout,
}) => {
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
      {/* Brand Header (Height ~92px) - Clickable to open Landing Page */}
      <div
        className="sidebar-brand-block"
        onClick={onOpenLanding}
        style={{ cursor: onOpenLanding ? 'pointer' : 'default' }}
        title="View 3D Landing Page"
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

      {/* Footer / Connect VTOP & Sign Out Actions */}
      <div className="sidebar-footer-block" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        <button
          className="btn btn-secondary btn-sm"
          style={{ width: '100%' }}
          onClick={onOpenVtopModal}
        >
          <ShieldCheck size={15} color="var(--accent-cyan)" />
          <span>Connect VTOP</span>
        </button>

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
