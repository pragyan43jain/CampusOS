import React from 'react';
import {
  LayoutDashboard,
  ShieldCheck,
  ClipboardList,
  CalendarDays,
  Menu,
} from 'lucide-react';
import { NavView } from './Sidebar';
import { AcademicsSubTab } from '../views/AcademicsView';

export type MobileNavTabId = 'dashboard' | 'attendance' | 'assignments' | 'timetable';

interface MobileBottomNavProps {
  activeView: NavView;
  academicsSubTab?: AcademicsSubTab;
  onSelectView: (tab: MobileNavTabId | NavView) => void;
  onOpenMore: () => void;
  pendingAssignmentsCount: number;
  criticalAttendanceCount: number;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeView,
  academicsSubTab,
  onSelectView,
  onOpenMore,
  pendingAssignmentsCount,
  criticalAttendanceCount,
}) => {
  const tabs = [
    {
      id: 'dashboard' as const,
      label: 'Dashboard',
      icon: LayoutDashboard,
      isActive: activeView === 'dashboard',
    },
    {
      id: 'attendance' as const,
      label: 'Attendance',
      icon: ShieldCheck,
      isActive: activeView === 'academics' && academicsSubTab === 'attendance',
      badge: criticalAttendanceCount > 0 ? { count: criticalAttendanceCount, alert: true } : undefined,
    },
    {
      id: 'assignments' as const,
      label: 'Tasks',
      icon: ClipboardList,
      isActive: activeView === 'assignments',
      badge: pendingAssignmentsCount > 0 ? { count: pendingAssignmentsCount, alert: false } : undefined,
    },
    {
      id: 'timetable' as const,
      label: 'Timetable',
      icon: CalendarDays,
      isActive: activeView === 'academics' && academicsSubTab === 'timetable',
    },
  ];

  return (
    <nav
      className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 border-t border-outline-variant/30 shadow-[0_-2px_16px_rgba(0,0,0,0.35)]"
      style={{
        backgroundColor: 'var(--surface-header, var(--surface-primary, #10141c))',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        paddingBottom: 'env(safe-area-inset-bottom, 8px)',
        height: 'calc(62px + env(safe-area-inset-bottom, 8px))',
      }}
    >
      <div className="flex items-center justify-around h-[62px] px-1 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.isActive;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectView(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center h-full gap-0.5 transition-all relative py-1 min-h-[44px] min-w-[44px] ${
                isActive
                  ? 'text-primary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <div className={`relative flex items-center justify-center px-3.5 py-1 rounded-full transition-all ${
                isActive ? 'bg-primary/20 text-primary' : ''
              }`}>
                <Icon size={20} strokeWidth={isActive ? 2.5 : 1.8} />
                {tab.badge && (
                  <span
                    className={`absolute -top-1 -right-1 text-[9px] font-bold px-1.5 py-0.2 rounded-full font-mono shadow-sm ${
                      tab.badge.alert
                        ? 'bg-error text-on-error'
                        : 'bg-primary text-on-primary'
                    }`}
                  >
                    {tab.badge.count}
                  </span>
                )}
              </div>
              <span className="text-[10px] tracking-tight font-medium leading-none">
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* More Actions Drawer Trigger */}
        <button
          onClick={onOpenMore}
          className="flex-1 flex flex-col items-center justify-center h-full gap-0.5 transition-all relative py-1 min-h-[44px] min-w-[44px] text-on-surface-variant hover:text-on-surface"
        >
          <div className="relative flex items-center justify-center px-3.5 py-1">
            <Menu size={20} strokeWidth={1.8} />
          </div>
          <span className="text-[10px] tracking-tight font-medium leading-none">More</span>
        </button>
      </div>
    </nav>
  );
};
