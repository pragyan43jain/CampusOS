import React from 'react';
import { StudentProfile } from '../types';

interface HeaderProps {
  student: StudentProfile;
  activeView: string;
  onRefresh: () => void;
  syncing: boolean;
}

export const Header: React.FC<HeaderProps> = ({ student, activeView, onRefresh, syncing }) => {
  return (
    <header className="top-header">
      <div className="header-left">
        <div className="header-title-block">
          <h1 style={{ textTransform: 'capitalize' }}>{activeView.replace('-', ' ')}</h1>
          <p>{student.program} • Semester {student.semester}</p>
        </div>
      </div>

      <div className="header-right">
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

        <button className="icon-button" title="Notifications">
          🔔
          <span className="badge-dot" />
        </button>

        <div className="user-profile-badge">
          <div className="user-avatar">
            {student.name.split(' ').map(n => n[0]).join('')}
          </div>
          <div className="user-details">
            <span className="user-name">{student.name}</span>
            <span className="user-reg">{student.regNo}</span>
          </div>
        </div>
      </div>
    </header>
  );
};
