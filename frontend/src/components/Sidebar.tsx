import React, { useState, useEffect } from 'react';
import {
  LayoutDashboard,
  GraduationCap,
  ClipboardList,
  CreditCard,
  Code2,
  BrainCircuit,
  Zap,
  LogOut,
  ShieldCheck,
  Layers,
  ChevronDown,
  User,
  Percent,
  CalendarDays,
  Calendar,
  Award,
  FileText,
  BookOpen,
} from 'lucide-react';
import { AcademicsSubTab } from '../views/AcademicsView';

export type NavView = 'dashboard' | 'academics' | 'assignments' | 'fees' | 'placements' | 'ai-planner';

interface SidebarProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  pendingAssignmentsCount: number;
  criticalAttendanceCount: number;
  academicsSubTab?: AcademicsSubTab;
  onSelectAcademicsSubTab?: (subTab: AcademicsSubTab) => void;
  onLogout?: () => void;
  onOpenAdmin?: () => void;
  onOpenFeatures?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  activeView,
  onSelectView,
  pendingAssignmentsCount,
  criticalAttendanceCount,
  academicsSubTab = 'profile',
  onSelectAcademicsSubTab,
  onLogout,
  onOpenAdmin,
  onOpenFeatures,
}) => {
  const [isAcademicsOpen, setIsAcademicsOpen] = useState<boolean>(activeView === 'academics');

  useEffect(() => {
    if (activeView === 'academics') {
      setIsAcademicsOpen(true);
    }
  }, [activeView]);

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
    { id: 'placements' as NavView, label: 'LeetCode', icon: Code2 },
  ];

  const intelligenceNavItems = [
    { id: 'ai-planner' as NavView, label: 'AI Study Planner', icon: BrainCircuit, badge: { count: 'AI', alert: false } },
  ];

  const academicsSubItems: { id: AcademicsSubTab; label: string; icon: any }[] = [
    { id: 'profile', label: 'Profile', icon: User },
    { id: 'attendance', label: 'Attendance', icon: Percent },
    { id: 'calendar', label: 'Academic Calendar', icon: CalendarDays },
    { id: 'timetable', label: 'Timetable', icon: Calendar },
    { id: 'marks', label: 'Marks', icon: Award },
    { id: 'exams', label: 'Exams', icon: FileText },
    { id: 'grades', label: 'All Grades & CGPA', icon: BookOpen },
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

          if (item.id === 'academics') {
            return (
              <div key={item.id} className="sidebar-nav-group">
                <button
                  className={`nav-item-btn ${isActive ? 'active' : ''}`}
                  onClick={() => {
                    if (activeView !== 'academics') {
                      onSelectView('academics');
                      setIsAcademicsOpen(true);
                    } else {
                      setIsAcademicsOpen(!isAcademicsOpen);
                    }
                  }}
                  title="Academics"
                >
                  <div className="nav-item-left">
                    <Icon size={17} strokeWidth={isActive ? 2.2 : 1.8} />
                    <span>{item.label}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    {item.badge && (
                      <span className={`nav-badge-pill ${item.badge.alert ? 'alert' : ''}`}>
                        {item.badge.count}
                      </span>
                    )}
                    <ChevronDown
                      size={14}
                      style={{
                        transform: isAcademicsOpen ? 'rotate(180deg)' : 'rotate(0deg)',
                        transition: 'transform 0.2s ease',
                        color: isActive ? 'var(--text-primary)' : 'var(--text-muted)',
                      }}
                    />
                  </div>
                </button>
                {isAcademicsOpen && (
                  <div className="sidebar-subnav-list">
                    {academicsSubItems.map((sub) => {
                      const isSubActive = activeView === 'academics' && academicsSubTab === sub.id;
                      const SubIcon = sub.icon;
                      return (
                        <button
                          key={sub.id}
                          type="button"
                          className={`nav-subitem-btn ${isSubActive ? 'active' : ''}`}
                          onClick={(e) => {
                            e.stopPropagation();
                            if (activeView !== 'academics') {
                              onSelectView('academics');
                            }
                            onSelectAcademicsSubTab?.(sub.id);
                          }}
                        >
                          <SubIcon size={14} strokeWidth={isSubActive ? 2.2 : 1.7} />
                          <span>{sub.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          }

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

      {/* Footer / Sign Out Action */}
      <div className="sidebar-footer-block" style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {onOpenFeatures && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.75rem' }}
            onClick={onOpenFeatures}
            title="View Real-Time Feature & Data Availability"
          >
            <Layers size={14} color="#60a5fa" />
            <span>Feature Readiness</span>
          </button>
        )}

        {onOpenAdmin && (
          <button
            className="btn btn-ghost btn-sm"
            style={{ width: '100%', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', fontSize: '0.75rem' }}
            onClick={onOpenAdmin}
            title="Open Admin Analytics (Ctrl+Shift+A)"
          >
            <ShieldCheck size={14} />
            <span>Admin Telemetry</span>
          </button>
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
