import React, { useEffect } from 'react';
import { X } from 'lucide-react';
import { CalendarView } from './CalendarView';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

interface CalendarModalProps {
  isOpen: boolean;
  onClose: () => void;
  exams?: any;
  attendance?: any[];
  calendars?: any;
  calendarType?: string;
  handleCalendarFetch?: (type: string) => void | Promise<void>;
}

export const CalendarModal: React.FC<CalendarModalProps> = ({
  isOpen,
  onClose,
  exams,
  attendance,
  calendars,
  calendarType = "ALL",
  handleCalendarFetch,
}) => {
  useLockBodyScroll(isOpen);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="modal-backdrop overscroll-contain"
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        backdropFilter: 'blur(6px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        overscrollBehavior: 'contain',
      }}
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className="card overscroll-contain"
        onWheel={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '1100px',
          maxHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-card, #121826)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
          padding: '20px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '4px' }}>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            style={{ padding: '6px', borderRadius: '8px' }}
            aria-label="Close dialog"
          >
            <X size={20} />
          </button>
        </div>

        <div style={{ flex: 1, overflowY: 'auto', paddingRight: '4px' }}>
          <CalendarView
            calendars={calendars}
            calendarType={calendarType}
            handleCalendarFetch={handleCalendarFetch}
            exams={exams}
            attendance={attendance}
          />
        </div>
      </div>
    </div>
  );
};
