import React from 'react';
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
  const navItems: { id: NavView; label: string; icon: string; badge?: { count: number; alert?: boolean } }[] = [
    { id: 'dashboard', label: 'Dashboard', icon: '⚡' },
    { id: 'vtop-sync', label: 'VTOP Live Hub', icon: '🔄' },
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
          <div style={{ padding: '0 12px 8px 12px', display: 'flex', alignItems: 'center', gap: '8px', fontSize: '0.74rem', fontWeight: 800, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.5px', fontFamily: 'var(--font-mono)' }}>
            <span>⚡</span>
            <span>UI Theme</span>
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
                fontSize: '0.84rem',
                fontWeight: 700,
                outline: 'none',
                cursor: 'pointer',
              }}
            >
              <option value="chaingpt-cyber">⚡ ChainGPT Cyber (Default)</option>
              <option value="chaingpt-matrix">🟢 ChainGPT Matrix (Emerald)</option>
              <option value="chaingpt-solana">🟣 ChainGPT Solana (Violet)</option>
              <option value="midnight-slate">🌌 Midnight Slate (Dark)</option>
              <option value="baby-pink">🌸 Baby Pink (Light)</option>
              <option value="nordic-blue">❄️ Nordic Blue (Light)</option>
            </select>
          </div>
        </div>
      </nav>

      <div style={{ padding: '16px', borderTop: '1px solid var(--border-subtle)', display: 'flex', flexDirection: 'column', gap: '10px' }}>
        <button
          className="btn-primary"
          style={{ width: '100%', justifyContent: 'center', fontWeight: 800, fontSize: '0.84rem' }}
          onClick={onOpenVtopModal}
        >
          ⚡ Connect VTOP
        </button>
      </div>
    </aside>
  );
};
