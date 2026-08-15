import React from 'react';
import { StudentProfile } from '../types';

export type ThemeType = 'midnight-slate' | 'baby-pink' | 'nordic-blue' | 'mint-sage' | 'warm-cream';

interface HeaderProps {
  student: StudentProfile;
  activeView: string;
  onRefresh: () => void;
  syncing: boolean;
  isMobileMode: boolean;
  onToggleMobileMode: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  student,
  activeView,
  onRefresh,
  syncing,
  isMobileMode,
  onToggleMobileMode,
}) => {
  return (
    <header className="top-header">
      <div className="header-left">
        <div className="header-title-block">
          <h1 style={{ textTransform: 'capitalize' }}>{activeView.replace('-', ' ')}</h1>
          <p>{student.program} • Semester {student.semester}</p>
        </div>
      </div>

      <div className="header-right">
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
