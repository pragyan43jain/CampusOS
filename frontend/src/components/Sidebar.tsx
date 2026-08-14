import React from 'react';

export type NavView = 'dashboard' | 'academics' | 'assignments' | 'fees' | 'placements' | 'ai-planner';

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  pendingAssignmentsCount: number;
  criticalAttendanceCount: number;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  pendingAssignmentsCount,
  criticalAttendanceCount,
}) => {
  const navItems: { id: NavView; label: string; icon: string; badge?: { count: number; alert?: boolean } }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '⚡' },
    { 
      id: 'academics', 
      label: 'Academics', 
      icon: '📚',
      badge: criticalAttendanceCount > 0 ? { count: criticalAttendanceCount, alert: true } : undefined
    },
    { 
      id: 'assignments', 
      label: 'Assignments', 
      icon: '📝', 
      badge: pendingAssignmentsCount > 0 ? { count: pendingAssignmentsCount } : undefined 
    },
    { id: 'fees', label: 'Fees & Receipts', icon: '💳' },
    { id: 'placements', label: 'Placements & DSA', icon: '🎯' },
    { id: 'ai-planner', label: 'AI Study Planner', icon: '🧠' },
  ];

  return (
    <aside className="sidebar">
      <div className="sidebar-header">
        <div className="brand-logo-badge">C</div>
        <div>
          <span className="brand-title">CampusOS</span>
          <span className="brand-version">v1.0</span>
        </div>
      </div>

      <nav className="sidebar-nav">
        {navItems.map((item) => {
          const isActive = activeView === item.id;
          return (
            <button
              key={item.id}
              className={`nav-item ${isActive ? 'active' : ''}`}
              onClick={() => onSelectView(item.id)}
            >
              <span>{item.icon}</span>
              <span>{item.label}</span>
              {item.badge && (
                <span className={`nav-badge ${item.badge.alert ? 'alert' : ''}`}>
                  {item.badge.count}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="sidebar-footer">
        <div className="sync-status-indicator">
          <div className="pulse-dot" />
          <span>VTOP Integration Active</span>
        </div>
      </div>
    </aside>
  );
};
