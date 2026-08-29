import React from 'react';
import {
  LayoutDashboard,
  RefreshCw,
  GraduationCap,
  ClipboardList,
  CreditCard,
  Briefcase,
  BrainCircuit,
  Palette,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { ThemeType } from './Header';

export type NavView = 'dashboard' | 'vtop-sync' | 'academics' | 'assignments' | 'fees' | 'placements' | 'ai-planner';

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  pendingAssignmentsCount: number;
  criticalAttendanceCount: number;
  currentTheme: ThemeType;
  onSelectTheme: (theme: ThemeType) => void;
  onOpenVtopModal?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  pendingAssignmentsCount,
  criticalAttendanceCount,
  currentTheme,
  onSelectTheme,
  onOpenVtopModal,
}) => {
  const navItems = [
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
    { id: 'fees' as NavView, label: 'Fees & Receipts', icon: CreditCard },
    { id: 'placements' as NavView, label: 'Placements & DSA', icon: Briefcase },
    { id: 'ai-planner' as NavView, label: 'AI Study Planner', icon: BrainCircuit },
  ];

  return (
    <aside className="app-sidebar">
      {/* Brand Header */}
      <div className="sidebar-brand-block">
        <div className="brand-icon-box">
          <Zap size={20} />
        </div>
        <div className="brand-info">
          <span className="brand-title">CampusOS</span>
          <span className="brand-version-badge">v1.0 • VIT Edition</span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="sidebar-nav" aria-label="Main Navigation">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              className={`nav-link-btn ${isActive ? 'active' : ''}`}
              onClick={() => onSelectView(item.id)}
            >
              <Icon size={18} strokeWidth={isActive ? 2.2 : 1.8} />
              <span>{item.label}</span>
              {item.badge && (
                <span className={`nav-badge-count ${item.badge.alert ? 'alert' : ''}`}>
                  {item.badge.count}
                </span>
              )}
            </button>
          );
        })}

        {/* Integrated Theme Selector */}
        <div style={{ marginTop: '16px', paddingTop: '16px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ padding: '0 10px 8px 10px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.4px' }}>
            <Palette size={13} />
            <span>Theme</span>
          </div>

          <div style={{ padding: '0 4px' }}>
            <select
              value={currentTheme}
              onChange={(e) => onSelectTheme(e.target.value as ThemeType)}
              className="select-dropdown"
              style={{ width: '100%', padding: '8px 12px', fontSize: '0.82rem' }}
            >
              <option value="midnight-slate">Dark Slate (Default)</option>
              <option value="chaingpt-cyber">Cyber Dark (Refined)</option>
              <option value="baby-pink">Rose Blossom (Light)</option>
              <option value="nordic-blue">Nordic Blue (Light)</option>
            </select>
          </div>
        </div>
      </nav>

      {/* Footer / Connect VTOP CTA */}
      <div className="sidebar-footer">
        <button
          className="btn btn-secondary"
          style={{ width: '100%', fontSize: '0.84rem' }}
          onClick={onOpenVtopModal}
        >
          <ShieldCheck size={16} />
          <span>Connect VTOP</span>
        </button>
      </div>
    </aside>
  );
};
