import React, { useEffect, useState } from 'react';
import { X, Clock, CheckCircle2, FileText, Calendar } from 'lucide-react';
import { CampusAPI } from '../services/api';
import { ODResponse, Attendance } from '../types';

interface ODHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendance?: Attendance[];
}

export const ODHoursModal: React.FC<ODHoursModalProps> = ({ isOpen, onClose, attendance }) => {
  const [odData, setOdData] = useState<ODResponse | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    const fetchOD = async () => {
      setLoading(true);
      try {
        const data = await CampusAPI.getOD();
        setOdData(data);
      } catch (err) {
        console.warn('[ODHoursModal] Failed to fetch OD data:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchOD();
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = originalOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  // UniCC OD extraction mechanism: extract sanctioned on-duty classes from attendance drill-down logs
  const derivedRecords = React.useMemo(() => {
    if (!attendance || !Array.isArray(attendance)) return [];
    const list: Array<{
      id: string;
      date: string;
      subjectCode: string;
      subjectTitle: string;
      hours: number;
      slot: string;
      type: string;
      reason: string;
      status: string;
      isApproved: boolean;
      approvedBy: string;
    }> = [];

    attendance.forEach((course) => {
      const vlink = (course as any).viewLink;
      const slot = course.slot || (course as any).slots || '';
      const cType = (course.courseType || course.type || '').toUpperCase();
      const isLab = slot.toUpperCase().startsWith('L') || cType.includes('LAB') || (course.courseCode || '').toUpperCase().endsWith('P');
      const hours = isLab ? 2 : 1;
      let hasVlinkOd = false;

      if (vlink && Array.isArray(vlink)) {
        vlink.forEach((day: any) => {
          const status = (day?.status || '').trim();
          if (status.toLowerCase() === 'on duty' || status.toLowerCase() === 'od' || status.toLowerCase() === 'duty') {
            hasVlinkOd = true;
            list.push({
              id: `od-${course.courseCode}-${day.date}`,
              date: day.date,
              subjectCode: course.courseCode,
              subjectTitle: course.courseTitle || course.courseName || course.courseCode,
              hours,
              slot,
              type: isLab ? 'LAB' : 'TH',
              reason: `Class Attendance On-Duty (${course.courseCode})`,
              status: 'Approved',
              isApproved: true,
              approvedBy: course.facultyName || course.faculty || 'Course Faculty / VTOP',
            });
          }
        });
      }

      const odCount = (course as any).odAttended || (course as any).odHours || 0;
      if (!hasVlinkOd && odCount > 0) {
        list.push({
          id: `od-${course.courseCode}-summary`,
          date: 'Active Semester',
          subjectCode: course.courseCode,
          subjectTitle: course.courseTitle || course.courseName || course.courseCode,
          hours: odCount * hours,
          slot,
          type: isLab ? 'LAB' : 'TH',
          reason: `Sanctioned Class On-Duty (${odCount} class${odCount > 1 ? 'es' : ''})`,
          status: 'Approved',
          isApproved: true,
          approvedBy: course.facultyName || course.faculty || 'Course Faculty / VTOP',
        });
      }
    });

    return list.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());
  }, [attendance]);

  if (!isOpen) return null;

  const records = (odData?.records && odData.records.length > 0)
    ? odData.records
    : derivedRecords;
  const approvedHours = odData?.approvedHours ?? (records.reduce((sum, r) => sum + (r.hours || 0), 0));
  const maxHours = odData?.maxHours || 40;

  return (
    <div
      className="modal-backdrop"
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
      }}
      onClick={onClose}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '560px',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--bg-card, #121826)',
          border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
          borderRadius: '16px',
          boxShadow: '0 20px 40px rgba(0, 0, 0, 0.5)',
          overflow: 'hidden',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '18px 24px',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '36px',
                height: '36px',
                borderRadius: '8px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#3b82f6',
              }}
            >
              <Clock size={20} />
            </div>
            <div>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 700 }}>On-Duty (OD) Hours Breakdown</h2>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>
                Official VTOP Approved Duty Leave Records
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="btn btn-ghost btn-icon"
            style={{ padding: '6px', borderRadius: '8px' }}
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Stats Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: '12px',
            padding: '16px 24px',
            backgroundColor: 'rgba(255, 255, 255, 0.02)',
            borderBottom: '1px solid var(--border-color, rgba(255, 255, 255, 0.06))',
          }}
        >
          <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(59, 130, 246, 0.1)' }}>
            <span style={{ fontSize: '0.72rem', color: '#60a5fa', textTransform: 'uppercase', fontWeight: 600 }}>
              Approved OD
            </span>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#3b82f6' }}>{approvedHours} hrs</div>
          </div>

          <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(16, 185, 129, 0.1)' }}>
            <span style={{ fontSize: '0.72rem', color: '#34d399', textTransform: 'uppercase', fontWeight: 600 }}>
              Max OD Quota
            </span>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#10b981' }}>{maxHours} hrs</div>
          </div>

          <div style={{ padding: '10px 14px', borderRadius: '10px', backgroundColor: 'rgba(245, 158, 11, 0.1)' }}>
            <span style={{ fontSize: '0.72rem', color: '#fbbf24', textTransform: 'uppercase', fontWeight: 600 }}>
              Pending OD
            </span>
            <div style={{ fontSize: '1.3rem', fontWeight: 800, color: '#f59e0b' }}>
              {odData?.pendingHours || 0} hrs
            </div>
          </div>
        </div>

        {/* Records List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
              Loading on-duty records from university ledger...
            </div>
          ) : records.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '36px 16px',
                textAlign: 'center',
                color: 'var(--text-muted)',
              }}
            >
              <div
                style={{
                  width: '48px',
                  height: '48px',
                  borderRadius: '12px',
                  backgroundColor: 'rgba(255, 255, 255, 0.05)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: '12px',
                }}
              >
                <FileText size={24} />
              </div>
              <p style={{ margin: 0, fontWeight: 600, color: 'var(--text-primary)' }}>No OD Leave Records</p>
              <p style={{ margin: '4px 0 0', fontSize: '0.85rem' }}>
                You currently have no classes marked as "On Duty" in this academic semester.
              </p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {records.map((rec, idx) => (
                <div
                  key={rec.id || idx}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '10px',
                    backgroundColor: 'rgba(255, 255, 255, 0.03)',
                    border: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    gap: '12px',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div
                      style={{
                        padding: '6px 10px',
                        borderRadius: '8px',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        display: 'flex',
                        flexDirection: 'column',
                        alignItems: 'center',
                        minWidth: '55px',
                      }}
                    >
                      <Calendar size={13} color="#60a5fa" />
                      <span style={{ fontSize: '0.72rem', fontWeight: 700, color: '#60a5fa', marginTop: '2px' }}>
                        {rec.date}
                      </span>
                    </div>

                    <div>
                      <div style={{ fontWeight: 600, fontSize: '0.92rem' }}>
                        {rec.subjectTitle || rec.subjectCode}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '6px' }}>
                        <span>{rec.subjectCode}</span>
                        {rec.slot && <span>• {rec.slot}</span>}
                        {rec.type && <span>• {rec.type}</span>}
                      </div>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    <span
                      style={{
                        padding: '3px 8px',
                        borderRadius: '6px',
                        fontSize: '0.75rem',
                        fontWeight: 700,
                        backgroundColor: 'rgba(16, 185, 129, 0.15)',
                        color: '#10b981',
                      }}
                    >
                      {rec.hours} hr{rec.hours > 1 ? 's' : ''}
                    </span>

                    <span
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '4px',
                        fontSize: '0.75rem',
                        color: '#34d399',
                      }}
                    >
                      <CheckCircle2 size={13} />
                      Approved
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border-color, rgba(255, 255, 255, 0.08))',
            display: 'flex',
            justifyContent: 'flex-end',
          }}
        >
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
