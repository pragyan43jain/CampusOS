import React from 'react';
import { TimetableSlot } from '../types';

interface TimetableSlotCardProps {
  slot: TimetableSlot;
}

export const TimetableSlotCard: React.FC<TimetableSlotCardProps> = ({ slot }) => {
  const attendance = slot.attendance || (slot.attendancePercentage !== undefined && slot.attendancePercentage !== null ? {
    attended: 0,
    total: 0,
    percentage: slot.attendancePercentage,
    safeToMiss: 0,
    needToAttend: 0,
    isCritical: slot.attendancePercentage < 75,
  } : null);

  const isCritical = attendance ? attendance.isCritical : false;
  const isBorderline = attendance && attendance.percentage !== null && attendance.percentage !== undefined
    ? attendance.percentage >= 75 && attendance.percentage < 80
    : false;

  let pillVariant = 'safe';
  if (isCritical) {
    pillVariant = 'critical';
  } else if (isBorderline) {
    pillVariant = 'warning';
  }

  const courseCode = slot.subjectCode || slot.courseCode;
  const courseTitle = slot.subject || slot.courseTitle;
  const slotName = slot.slot || slot.slotName;
  const venueText = slot.room?.fullVenue || slot.venue || 'Academic Block';

  return (
    <div className="timetable-slot-card">
      <div className="slot-time-col">
        <div className="slot-start-time">{slot.startTime}</div>
        <div className="slot-end-time">{slot.endTime}</div>
        <span className="slot-badge-code">{slotName}</span>
      </div>

      <div className="slot-main-info">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', color: 'var(--brand-blue)', fontWeight: 600 }}>
            {courseCode}
          </span>
          {slot.isLab && (
            <span style={{ fontSize: '0.68rem', padding: '1px 6px', background: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', borderRadius: '4px', fontWeight: 700 }}>
              LAB PRACTICAL
            </span>
          )}
        </div>
        <h3 className="slot-course-name">{courseTitle}</h3>
        <div className="slot-meta-row">
          <div className="slot-meta-item">
            <span>📍</span>
            <span>{venueText}</span>
          </div>
          <div className="slot-meta-item">
            <span>👨‍🏫</span>
            <span>{slot.faculty}</span>
          </div>
        </div>
      </div>

      <div className="slot-attendance-col">
        {attendance && attendance.percentage !== null && attendance.percentage !== undefined ? (
          <>
            <div className="attendance-count-line">
              Attendance: <span className="attendance-count-bold">{attendance.attended ?? '-'} / {attendance.total ?? '-'}</span>
              <span className={`attendance-percentage-pill ${pillVariant}`} style={{ marginLeft: '10px' }}>
                {attendance.percentage}%
              </span>
            </div>

            {isCritical ? (
              <div className="attendance-margin-note critical">
                <span>⚠ Below 75%</span>
                <span>• Attend next {attendance.needToAttend} classes to reach 75%</span>
              </div>
            ) : (
              <div className="attendance-margin-note safe">
                {attendance.safeToMiss > 0 ? (
                  <span>Safe to miss: {attendance.safeToMiss} {attendance.safeToMiss === 1 ? 'class' : 'classes'}</span>
                ) : (
                  <span style={{ color: 'var(--warning-amber)' }}>Borderline (0 safe bunks)</span>
                )}
              </div>
            )}
          </>
        ) : (
          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Attendance: VTOP sync required
          </div>
        )}
      </div>
    </div>
  );
};
