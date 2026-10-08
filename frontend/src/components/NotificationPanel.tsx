import React, { useState, useEffect, useRef } from 'react';
import {
  CheckCircle2,
  Briefcase,
  GraduationCap,
  Sparkles,
  ShieldCheck,
  X,
  ChevronRight,
} from 'lucide-react';

export type NotificationCategory = 'all' | 'academic' | 'placement' | 'campus' | 'system';

export interface NotificationItem {
  id: string;
  category: 'academic' | 'placement' | 'campus' | 'system';
  title: string;
  description: string;
  time: string;
  isRead: boolean;
  actionView?: string;
  actionSubTab?: string;
}

interface NotificationPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigate?: (view: string, subTab?: string) => void;
  attendanceCount?: number;
  pendingAssignmentsCount?: number;
  lastSyncedTime?: string | null;
}

export const NotificationPanel: React.FC<NotificationPanelProps> = ({
  isOpen,
  onClose,
  onNavigate,
  attendanceCount = 0,
  pendingAssignmentsCount = 0,
  lastSyncedTime,
}) => {
  const panelRef = useRef<HTMLDivElement>(null);
  const [filter, setFilter] = useState<NotificationCategory>('all');

  const initialNotifications: NotificationItem[] = [
    {
      id: 'notif-1',
      category: 'academic',
      title: pendingAssignmentsCount > 0 ? `${pendingAssignmentsCount} Pending Coursework Assignments` : 'Coursework Up to Date',
      description: pendingAssignmentsCount > 0
        ? `You have ${pendingAssignmentsCount} pending assignments across VTOP DA & LMS.`
        : 'All current semester coursework assignments have been marked completed.',
      time: 'Just now',
      isRead: false,
      actionView: 'assignments',
    },
    {
      id: 'notif-2',
      category: 'academic',
      title: attendanceCount > 0 ? `${attendanceCount} Courses Need Attendance Attention` : '75% Attendance Safeguard Healthy',
      description: attendanceCount > 0
        ? 'Some enrolled courses are near or below the 75% attendance threshold.'
        : 'All registered courses meet university canonical attendance standards.',
      time: '1h ago',
      isRead: false,
      actionView: 'academics',
      actionSubTab: 'attendance',
    },
    {
      id: 'notif-3',
      category: 'placement',
      title: 'LeetCode Placement Tracking Ready',
      description: 'Solve curated high-frequency company interview problems to raise your readiness index.',
      time: '3h ago',
      isRead: false,
      actionView: 'placements',
    },
    {
      id: 'notif-4',
      category: 'campus',
      title: 'Academic Calendar & Schedule Verified',
      description: 'Fall Semester 2026-27 instructional days and CAT/FAT exam dates are available.',
      time: '1d ago',
      isRead: true,
      actionView: 'academics',
      actionSubTab: 'calendar',
    },
    {
      id: 'notif-5',
      category: 'system',
      title: 'Zero-Hallucination VTOP Sync Active',
      description: lastSyncedTime ? `Last authenticated sync recorded at ${lastSyncedTime}.` : 'Authenticated directly with VIT Chennai portal.',
      time: '1d ago',
      isRead: true,
      actionView: 'dashboard',
    },
  ];

  const [notifications, setNotifications] = useState<NotificationItem[]>(initialNotifications);

  // Close when clicking outside
  useEffect(() => {
    const handleMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleMouseDown);
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('mousedown', handleMouseDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const markAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
  };

  const markOneAsRead = (id: string) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === id ? { ...n, isRead: true } : n))
    );
  };

  const filteredItems = notifications.filter((n) =>
    filter === 'all' ? true : n.category === filter
  );

  const unreadCount = notifications.filter((n) => !n.isRead).length;

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case 'academic':
        return <GraduationCap size={15} className="text-blue-500" />;
      case 'placement':
        return <Briefcase size={15} className="text-emerald-500" />;
      case 'campus':
        return <Sparkles size={15} className="text-purple-500" />;
      case 'system':
      default:
        return <ShieldCheck size={15} className="text-amber-500" />;
    }
  };

  return (
    <div
      ref={panelRef}
      className="notif-dropdown-panel"
      role="dialog"
      aria-label="Notification Center"
    >
      {/* Header */}
      <div className="notif-header">
        <div className="flex items-center gap-2">
          <span className="notif-title">Notifications</span>
          {unreadCount > 0 && (
            <span className="notif-unread-badge">{unreadCount} new</span>
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {unreadCount > 0 && (
            <button
              type="button"
              onClick={markAllAsRead}
              className="notif-mark-read-btn"
            >
              Mark all read
            </button>
          )}
          <button
            type="button"
            onClick={onClose}
            className="notif-close-btn"
            aria-label="Close notifications"
          >
            <X size={15} />
          </button>
        </div>
      </div>

      {/* Category Pills */}
      <div className="notif-categories-bar">
        {(['all', 'academic', 'placement', 'campus', 'system'] as NotificationCategory[]).map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setFilter(cat)}
            className={`notif-category-pill ${filter === cat ? 'active' : ''}`}
          >
            {cat.charAt(0).toUpperCase() + cat.slice(1)}
          </button>
        ))}
      </div>

      {/* Notifications List */}
      <div className="notif-items-list">
        {filteredItems.length === 0 ? (
          <div className="notif-empty-state">
            <CheckCircle2 size={24} className="text-emerald-500 mb-1 opacity-80" />
            <p className="notif-empty-title">All caught up</p>
            <p className="notif-empty-sub">No notifications in this category.</p>
          </div>
        ) : (
          filteredItems.map((item) => (
            <div
              key={item.id}
              onClick={() => {
                markOneAsRead(item.id);
                if (item.actionView && onNavigate) {
                  onNavigate(item.actionView, item.actionSubTab);
                  onClose();
                }
              }}
              className={`notif-item-card ${!item.isRead ? 'unread' : ''}`}
            >
              <div className="notif-item-icon-wrap">
                {getCategoryIcon(item.category)}
              </div>
              <div className="notif-item-content">
                <div className="flex items-center justify-between gap-2">
                  <span className="notif-item-title">{item.title}</span>
                  <span className="notif-item-time">{item.time}</span>
                </div>
                <p className="notif-item-desc">{item.description}</p>
                {item.actionView && (
                  <div className="notif-item-action-link">
                    <span>View details</span>
                    <ChevronRight size={12} />
                  </div>
                )}
              </div>
              {!item.isRead && <div className="notif-unread-dot" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
};
