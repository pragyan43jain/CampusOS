import React from 'react';
import {
  LayoutDashboard,
  GraduationCap,
  ClipboardList,
  BrainCircuit,
  Menu,
} from 'lucide-react';
import { NavView } from './Sidebar';

interface MobileBottomNavProps {
  activeView: NavView;
  onSelectView: (view: NavView) => void;
  onOpenMore: () => void;
  pendingAssignmentsCount: number;
  criticalAttendanceCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  onSelectView,
  onOpenMore,
  pendingAssignmentsCount,
  criticalAttendanceCount,
}) => {
  const tabs = [
    {
      id: 'dashboard' as NavView,
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'academics' as NavView,
      label: 'Academics',
      icon: GraduationCap,
      badge: criticalAttendanceCount > 0 ? { count: criticalAttendanceCount, alert: true } : undefined,
    },
    {
      id: 'assignments' as NavView,
      label: 'Tasks',
      icon: ClipboardList,
      badge: pendingAssignmentsCount > 0 ? { count: pendingAssignmentsCount, alert: false } : undefined,
    },
    {
      id: 'ai-planner' as NavView,
      label: 'Planner',
      icon: BrainCircuit,
      badge: { count: 'AI', alert: false },
    },
  ];

  return (
    <nav
      className="mobile-bottom-nav"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(64px + env(safe-area-inset-bottom, 12px))',
        paddingBottom: 'env(safe-area-inset-bottom, 12px)',
        backgroundColor: 'rgba(7, 8, 13, 0.94)',
        backdropFilter: 'blur(24px)',
        WebkitBackdropFilter: 'blur(24px)',
        borderTop: '1px solid rgba(255, 255, 255, 0.09)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 50,
        boxShadow: '0 -4px 20px rgba(0, 0, 0, 0.5)',
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeView === tab.id;

        return (
          <button
            key={tab.id}
            onClick={() => onSelectView(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '4px',
              color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
              transition: 'all var(--transition-fast)',
              position: 'relative',
              padding: '6px 0',
            }}
          >
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={20} strokeWidth={isActive ? 2.4 : 1.8} />
              {tab.badge && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-10px',
                    fontSize: '0.62rem',
                    fontWeight: 800,
                    padding: '1px 5px',
                    borderRadius: '9999px',
                    backgroundColor: tab.badge.alert ? 'var(--accent-crimson)' : 'var(--accent-cyan)',
                    color: tab.badge.alert ? '#FFFFFF' : '#07080D',
                    boxShadow: '0 2px 6px rgba(0,0,0,0.4)',
                    fontFamily: 'var(--font-mono)',
                    lineHeight: 1.2,
                  }}
                >
                  {tab.badge.count}
                </span>
              )}
            </div>
            <span
              style={{
                fontSize: '0.72rem',
                fontWeight: isActive ? 700 : 500,
                letterSpacing: '-0.1px',
              }}
            >
              {tab.label}
            </span>
            {isActive && (
              <span
                style={{
                  position: 'absolute',
                  top: 0,
                  width: '32px',
                  height: '2.5px',
                  backgroundColor: 'var(--accent-cyan)',
                  borderRadius: '0 0 4px 4px',
                  boxShadow: '0 0 10px var(--accent-cyan)',
                }}
              />
            )}
          </button>
        );
      })}

      {/* More / Menu Button */}
      <button
        onClick={onOpenMore}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '4px',
          color: 'var(--text-muted)',
          transition: 'all var(--transition-fast)',
          position: 'relative',
          padding: '6px 0',
        }}
      >
        <Menu size={20} strokeWidth={1.8} />
        <span style={{ fontSize: '0.72rem', fontWeight: 500, letterSpacing: '-0.1px' }}>More</span>
      </button>
    </nav>
  );
};
