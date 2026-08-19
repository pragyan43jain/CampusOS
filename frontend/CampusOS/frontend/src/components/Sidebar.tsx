import React from 'react';
import { ThemeType } from './Header';

export type NavView = 'dashboard' | 'academics' | 'assignments' | 'fees' | 'placements' | 'ai-planner';

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  pendingAssignmentsCount: number;
  criticalAttendanceCount: number;
  currentTheme: ThemeType;
  onSelectTheme: (theme: ThemeType) => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  pendingAssignmentsCount,
  criticalAttendanceCount,
  currentTheme,
  onSelectTheme,
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

        {/* Dedicated Themes Dropdown in Navigation Sidebar */}
        <div style={{ marginTop: '14px', paddingTop: '14px', borderTop: '1px solid var(--border-subtle)' }}>
          <div style={{ padding: '0 12px 8px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.78rem', fontWeight: 700, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
            <span>🎨</span>
            <span>App Theme</span>
          </div>

          <div style={{ padding: '0 8px' }}>
            <select
              value={currentTheme}
              onChange={(e) => onSelectTheme(e.target.value as ThemeType)}
              style={{
                width: '100%',
                background: 'var(--bg-surface-elevated)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-medium)',
                padding: '9px 12px',
                borderRadius: 'var(--radius-md)',
                fontSize: '0.86rem',
                fontWeight: 600,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="baby-pink">🌸 Baby Pink (Light)</option>
              <option value="nordic-blue">❄️ Nordic Blue (Light)</option>
              <option value="mint-sage">🌿 Mint Sage (Light)</option>
              <option value="warm-cream">☕ Warm Cream (Light)</option>
              <option value="midnight-slate">🌌 Midnight Slate (Dark)</option>
            </select>
          </div>
        </div>
      </nav>

      <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          className="btn-outline"
          style={{ width: '100%', justifyContent: 'center' }}
          onClick={() => alert("VTOP SSO Active for Pragyan Jain (22BCE10429)")}
        >
          🔐 Switch Account
        </button>
      </div>
    </aside>
  );
};
