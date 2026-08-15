import React from 'react';
import { StudentProfile } from '../types';

export type ThemeType = 'midnight-slate' | 'baby-pink' | 'nordic-blue' | 'mint-sage' | 'warm-cream';

interface HeaderProps {
  student: StudentProfile;
  activeView: string;
  onRefresh: () => void;
  syncing: boolean;
  currentTheme: ThemeType;
  onSelectTheme: (theme: ThemeType) => void;
  isMobileMode: boolean;
  onToggleMobileMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  student,
  activeView,
  onRefresh,
  syncing,
  currentTheme,
  onSelectTheme,
  isMobileMode,
  onToggleMobileMode,
}) => {
  const themes: { id: ThemeType; name: string; color: string }[] = [
    { id: 'baby-pink', name: 'Baby Pink (Light)', color: '#f43f5e' },
    { id: 'nordic-blue', name: 'Nordic Blue (Light)', color: '#0284c7' },
    { id: 'mint-sage', name: 'Mint Sage (Light)', color: '#059669' },
    { id: 'warm-cream', name: 'Warm Cream (Light)', color: '#d97706' },
    { id: 'midnight-slate', name: 'Midnight (Dark)', color: '#0f172a' },
  ];

  return (
    <header className="top-header">
      <div className="header-left">
        <div className="header-title-block">
          <h1 style={{ textTransform: 'capitalize' }}>{activeView.replace('-', ' ')}</h1>
          <p>{student.program} • Semester {student.semester}</p>
        </div>
      </div>

      <div className="header-right">
        {/* Quick 1-Click Theme Palette Swatch Bar */}
        <div className="theme-switcher-box" title="Select Theme Color">
          <span style={{ fontSize: '0.75rem', fontWeight: 700, marginRight: '4px', color: 'var(--text-muted)' }}>🎨</span>
          {themes.map(t => (
            <button
              key={t.id}
              className={`theme-swatch-btn ${currentTheme === t.id ? 'active' : ''}`}
              style={{ backgroundColor: t.color }}
              onClick={() => onSelectTheme(t.id)}
              title={`Switch Theme: ${t.name}`}
            />
          ))}
        </div>

        {/* Mobile/Desktop Frame Toggle */}
        <button
          className="btn-outline"
          onClick={onToggleMobileMode}
          title="Toggle Mobile Phone / Desktop Cockpit View"
        >
          {isMobileMode ? '💻 Desktop View' : '📱 App View'}
        </button>

        {/* Sync Button */}
        <button
          className="btn-outline"
          onClick={onRefresh}
          disabled={syncing}
          title="Force sync data with VTOP"
        >
          <span style={{ display: 'inline-block', transform: syncing ? 'rotate(180deg)' : 'none', transition: 'transform 0.4s ease' }}>
            🔄
          </span>
          {syncing ? 'Syncing...' : 'Sync VTOP'}
        </button>

        {/* User Profile */}
        <div className="user-profile-badge">
          <div className="user-avatar">
            {student.name.split(' ').map(n => n[0]).join('')}
          </div>
          {!isMobileMode && (
            <div className="user-details">
              <span className="user-name">{student.name}</span>
              <span className="user-reg">{student.regNo}</span>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
