import React from 'react';
import { motion } from 'framer-motion';
import {
  LayoutDashboard,
  GraduationCap,
  ClipboardList,
  BrainCircuit,
  Menu,
} from 'lucide-react';
import { NavView } from './Sidebar';
import { MobileBridge } from '../services/mobileBridge';

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

  const handleTabClick = (viewId: NavView) => {
    MobileBridge.vibrate('selection');
    onSelectView(viewId);
  };

  const handleMoreClick = () => {
    MobileBridge.vibrate('light');
    onOpenMore();
  };

  return (
    <nav
      className="mobile-bottom-nav"
      aria-label="Mobile Bottom Navigation"
      style={{
        position: 'fixed',
        bottom: 0,
        left: 0,
        right: 0,
        height: 'calc(62px + env(safe-area-inset-bottom, 12px))',
        paddingBottom: 'env(safe-area-inset-bottom, 12px)',
        backgroundColor: 'var(--surface-header)',
        backdropFilter: 'blur(28px)',
        WebkitBackdropFilter: 'blur(28px)',
        borderTop: '1px solid var(--border-card)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        zIndex: 50,
        boxShadow: '0 -4px 24px rgba(0, 0, 0, 0.35)',
        userSelect: 'none',
        WebkitUserSelect: 'none',
      }}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon;
        const isActive = activeView === tab.id;

        return (
          <motion.button
            key={tab.id}
            whileTap={{ scale: 0.92 }}
            onClick={() => handleTabClick(tab.id)}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              gap: '3px',
              color: isActive ? 'var(--accent-cyan)' : 'var(--text-muted)',
              transition: 'color var(--transition-fast)',
              position: 'relative',
              padding: '6px 0',
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              touchAction: 'manipulation',
            }}
          >
            {/* Active Pill Glow Background */}
            {isActive && (
              <motion.div
                layoutId="mobileNavActivePill"
                transition={{ type: 'spring', stiffness: 450, damping: 35 }}
                style={{
                  position: 'absolute',
                  inset: '6px 8px',
                  backgroundColor: 'rgba(45, 231, 211, 0.08)',
                  borderRadius: '12px',
                  zIndex: 0,
                }}
              />
            )}

            <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1 }}>
              <Icon size={21} strokeWidth={isActive ? 2.4 : 1.8} />
              {tab.badge && (
                <span
                  style={{
                    position: 'absolute',
                    top: '-6px',
                    right: '-10px',
                    fontSize: '0.60rem',
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
                zIndex: 1,
              }}
            >
              {tab.label}
            </span>

            {/* Top Indicator Line */}
            {isActive && (
              <motion.span
                layoutId="mobileNavIndicator"
                transition={{ type: 'spring', stiffness: 500, damping: 35 }}
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
          </motion.button>
        );
      })}

      {/* More / Menu Button */}
      <motion.button
        whileTap={{ scale: 0.92 }}
        onClick={handleMoreClick}
        style={{
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          height: '100%',
          gap: '3px',
          color: 'var(--text-muted)',
          transition: 'color var(--transition-fast)',
          position: 'relative',
          padding: '6px 0',
          background: 'transparent',
          border: 'none',
          cursor: 'pointer',
          touchAction: 'manipulation',
        }}
      >
        <Menu size={21} strokeWidth={1.8} />
        <span style={{ fontSize: '0.72rem', fontWeight: 500, letterSpacing: '-0.1px' }}>More</span>
      </motion.button>
    </nav>
  );
};
