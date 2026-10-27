import React from 'react';
import { MapPin, User, Clock, FlaskConical, BookOpen, AlertTriangle, CheckCircle2 } from 'lucide-react';
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

  let badgeVariant = 'safe';
  if (isCritical) {
    badgeVariant = 'critical';
  } else if (isBorderline) {
    badgeVariant = 'warning';
  }

  const courseCode = slot.subjectCode || slot.courseCode;
  const courseTitle = slot.subject || slot.courseTitle;
  const slotName = slot.slot || slot.slotName;
  const venueText = slot.room?.fullVenue || slot.venue || 'Academic Block';
  const facultyName = slot.faculty || slot.facultyName || 'Course Faculty';

  return (
    <div
      className="timetable-slot-card card-hover p-3.5 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 sm:gap-4 rounded-lg transition-all"
      style={{
        backgroundColor: 'var(--surface-input)',
        border: '1px solid var(--border-card)',
      }}
    >
      {/* Time & Slot Indicator */}
      <div className="flex items-center justify-between sm:justify-start gap-3 w-full sm:w-auto shrink-0">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.96rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            <Clock size={14} color="var(--accent-cyan)" />
            <span>{slot.startTime}</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '20px' }}>
            until {slot.endTime}
          </span>
        </div>

        <div
          style={{
            padding: '3px 9px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--surface-secondary)',
            border: '1px solid var(--border-medium)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem',
            fontWeight: 800,
            color: 'var(--accent-cyan)',
          }}
        >
          {slotName}
        </div>
      </div>

      {/* Main Course Info */}
      <div className="flex-1 min-w-0 w-full flex flex-col gap-1">
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.82rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--accent-cyan)' }}>
            {courseCode}
          </span>
          {slot.isLab ? (
            <span className="status-badge warning" style={{ fontSize: '0.72rem' }}>
              <FlaskConical size={11} />
              <span>Lab Practical</span>
            </span>
          ) : (
            <span className="status-badge neutral" style={{ fontSize: '0.72rem' }}>
              <BookOpen size={11} />
              <span>Theory Lecture</span>
            </span>
          )}
        </div>

        <h4 style={{ fontSize: '1.02rem', fontWeight: 700, color: 'var(--text-primary)', margin: 0, wordBreak: 'break-word' }}>
          {courseTitle}
        </h4>

        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', fontSize: '0.80rem', color: 'var(--text-secondary)', marginTop: '2px', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <MapPin size={13} color="var(--text-muted)" />
            <span>{venueText}</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
            <User size={13} color="var(--text-muted)" />
            <span>{facultyName}</span>
          </div>
        </div>
      </div>

      {/* Attendance Metrics Block */}
      <div className="w-full sm:w-auto flex flex-col sm:items-end justify-between sm:justify-center gap-1.5 pt-2 sm:pt-0 border-t sm:border-t-0 border-outline-variant/15 shrink-0">
        {attendance && attendance.percentage !== null && attendance.percentage !== undefined ? (
          <>
            <div className="flex items-center justify-between sm:justify-end gap-2 w-full sm:w-auto">
              <span style={{ fontSize: '0.80rem', color: 'var(--text-muted)' }}>
                {attendance.attended ?? '-'} / {attendance.total ?? '-'} attended
              </span>
              <span className={`status-badge ${badgeVariant}`} style={{ fontSize: '0.80rem', padding: '2px 8px' }}>
                {isCritical && <AlertTriangle size={12} />}
                {!isCritical && <CheckCircle2 size={12} />}
                <span>{attendance.percentage}%</span>
              </span>
            </div>

            {isCritical ? (
              <span style={{ fontSize: '0.74rem', color: 'var(--accent-crimson)', fontWeight: 600 }}>
                Attend next {attendance.needToAttend} classes for 75%
              </span>
            ) : (
              <span style={{ fontSize: '0.74rem', color: 'var(--accent-emerald)', fontWeight: 600 }}>
                {attendance.safeToMiss > 0 ? `${attendance.safeToMiss} safe classes available` : 'Borderline attendance'}
              </span>
            )}
          </>
        ) : (
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>
            Attendance: VTOP sync required
          </span>
        )}
      </div>
    </div>
  );
};
