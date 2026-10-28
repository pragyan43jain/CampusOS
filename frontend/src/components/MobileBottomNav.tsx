import React from 'react';
import {
  Home,
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
      label: 'Home',
      icon: Home,
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
      label: 'Assignments',
      icon: ClipboardList,
      isActive: activeView === 'assignments',
      badge: pendingAssignmentsCount > 0 ? { count: pendingAssignmentsCount, alert: false } : undefined,
    },
    {
      id: 'timetable' as const,
      label: 'Schedule',
      icon: CalendarDays,
      isActive: activeView === 'academics' && academicsSubTab === 'timetable',
    },
  ];

  return (
    <nav
      className="mobile-bottom-nav fixed bottom-0 left-0 right-0 z-50 border-t border-outline-variant/30"
      style={{
        backgroundColor: 'var(--surface-header, var(--surface-primary, #10141c))',
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="mobile-bottom-nav-inner flex items-stretch justify-around px-1 max-w-lg mx-auto">
        {tabs.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.isActive;

          return (
            <button
              key={tab.id}
              onClick={() => onSelectView(tab.id)}
              className={`flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative py-1.5 min-h-[56px] min-w-0 ${
                isActive
                  ? 'text-primary font-bold'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              <div className={`relative flex items-center justify-center w-14 h-7 rounded-full transition-colors ${
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
              <span className="mobile-nav-label text-[9px] tracking-tight font-medium leading-none">
                {tab.label}
              </span>
            </button>
          );
        })}

        {/* More Actions Drawer Trigger */}
        <button
          onClick={onOpenMore}
          className="flex-1 flex flex-col items-center justify-center gap-1 transition-colors relative py-1.5 min-h-[56px] min-w-0 text-on-surface-variant hover:text-on-surface"
        >
          <div className="relative flex items-center justify-center w-14 h-7">
            <Menu size={20} strokeWidth={1.8} />
          </div>
          <span className="mobile-nav-label text-[9px] tracking-tight font-medium leading-none">More</span>
        </button>
      </div>
    </nav>
  );
};
