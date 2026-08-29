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
      className="card"
      style={{
        padding: '18px 22px',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: '16px',
        transition: 'all var(--transition-fast)',
      }}
    >
      {/* Time & Slot Indicator */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px', minWidth: '160px' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.95rem', fontWeight: 800, color: 'var(--text-primary)' }}>
            <Clock size={14} color="var(--brand-color)" />
            <span>{slot.startTime}</span>
          </div>
          <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginLeft: '20px' }}>
            until {slot.endTime}
          </span>
        </div>

        <div
          style={{
            padding: '4px 10px',
            borderRadius: 'var(--radius-sm)',
            background: 'var(--bg-surface-elevated)',
            border: '1px solid var(--border-medium)',
            fontFamily: 'var(--font-mono)',
            fontSize: '0.78rem',
            fontWeight: 800,
            color: 'var(--brand-color)',
          }}
        >
          {slotName}
        </div>
      </div>

      {/* Main Course Info */}
      <div style={{ flex: 1, minWidth: '240px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <span style={{ fontSize: '0.8rem', fontFamily: 'var(--font-mono)', fontWeight: 800, color: 'var(--brand-color)' }}>
            {courseCode}
          </span>
          {slot.isLab ? (
            <span className="status-badge amber" style={{ fontSize: '0.7rem' }}>
              <FlaskConical size={11} />
              <span>Lab Practical</span>
            </span>
          ) : (
            <span className="status-badge neutral" style={{ fontSize: '0.7rem' }}>
              <BookOpen size={11} />
              <span>Theory Lecture</span>
            </span>
          )}
        </div>

        <h4 style={{ fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-primary)' }}>
          {courseTitle}
        </h4>

        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', fontSize: '0.8rem', color: 'var(--text-secondary)', marginTop: '2px', flexWrap: 'wrap' }}>
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
      <div style={{ minWidth: '180px', display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
        {attendance && attendance.percentage !== null && attendance.percentage !== undefined ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                {attendance.attended ?? '-'} / {attendance.total ?? '-'} attended
              </span>
              <span className={`status-badge ${badgeVariant}`} style={{ fontSize: '0.82rem', padding: '3px 10px' }}>
                {isCritical && <AlertTriangle size={12} />}
                {!isCritical && <CheckCircle2 size={12} />}
                <span>{attendance.percentage}%</span>
              </span>
            </div>

            {isCritical ? (
              <span style={{ fontSize: '0.74rem', color: 'var(--danger-crimson)', fontWeight: 600 }}>
                Attend next {attendance.needToAttend} classes for 75%
              </span>
            ) : (
              <span style={{ fontSize: '0.74rem', color: 'var(--success-emerald)', fontWeight: 600 }}>
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
