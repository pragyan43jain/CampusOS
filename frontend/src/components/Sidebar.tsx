import React from 'react';
import {
  LayoutDashboard,
  RefreshCw,
  GraduationCap,
  ClipboardList,
  CreditCard,
  Briefcase,
  BrainCircuit,
  ShieldCheck,
  Zap,
} from 'lucide-react';

export type NavView = 'dashboard' | 'vtop-sync' | 'academics' | 'assignments' | 'fees' | 'placements' | 'ai-planner';

import { ThemeType } from "./Header";

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  pendingAssignmentsCount: number;
  criticalAttendanceCount: number;
  currentTheme?: ThemeType;
  onSelectTheme?: (t: ThemeType) => void;
  onOpenVtopModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  pendingAssignmentsCount,
  criticalAttendanceCount,
  onOpenVtopModal,
}) => {
  const mainNavItems = [
    { id: 'dashboard' as NavView, label: 'Dashboard', icon: LayoutDashboard },
    { id: 'vtop-sync' as NavView, label: 'VTOP Live Hub', icon: RefreshCw },
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
      {/* Brand Header (Height ~92px) */}
      <div className="sidebar-brand-block">
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

      {/* Footer / Connect VTOP Action */}
      <div className="sidebar-footer-block">
        <button
          className="btn btn-secondary btn-sm"
          style={{ width: '100%' }}
          onClick={onOpenVtopModal}
        >
          <ShieldCheck size={15} color="var(--accent-cyan)" />
          <span>Connect VTOP</span>
        </button>
      </div>
    </aside>
  );
};
