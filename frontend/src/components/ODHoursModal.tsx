import React, { useEffect, useState } from 'react';
import { X, Clock, CheckCircle2, FileText, Calendar, RefreshCw } from 'lucide-react';
import { CampusAPI } from '../services/api';
import { ODResponse, Attendance } from '../types';
import { useLockBodyScroll } from '../hooks/useLockBodyScroll';

interface ODHoursModalProps {
  isOpen: boolean;
  onClose: () => void;
  attendance?: Attendance[];
}

export const ODHoursModal: React.FC<ODHoursModalProps> = ({ isOpen, onClose }) => {
  useLockBodyScroll(isOpen);
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

  const handleRefresh = async () => {
    setLoading(true);
    try {
      const data = await CampusAPI.refreshOD();
      setOdData(data);
    } catch (err) {
      console.warn('[ODHoursModal] Failed to refresh OD from VTOP:', err);
    } finally {
      setLoading(false);
    }
  };

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

  const records = odData?.records || [];
  const approvedHours = odData?.approvedHours ?? odData?.usedHours ?? (records.reduce((sum, r) => sum + (r.hours || 0), 0));
  const maxHours = odData?.maxHours || 40;

  const parseDate = (d?: string) => {
    if (!d) return 0;
    const clean = String(d).trim();
    const parsed = Date.parse(clean);
    if (!isNaN(parsed)) return parsed;
    const parts = clean.split(/[-/ ]/);
    if (parts.length === 3) {
      const day = parseInt(parts[0], 10);
      let month = 0;
      let year = parseInt(parts[2], 10);
      if (year < 100) year += 2000;
      const monthPart = parts[1].toUpperCase();
      const MONTHS: Record<string, number> = {
        JAN: 0, FEB: 1, MAR: 2, APR: 3, MAY: 4, JUN: 5,
        JUL: 6, AUG: 7, SEP: 8, OCT: 9, NOV: 10, DEC: 11
      };
      if (MONTHS[monthPart.slice(0, 3)] !== undefined) {
        month = MONTHS[monthPart.slice(0, 3)];
      } else if (!isNaN(parseInt(monthPart, 10))) {
        month = parseInt(monthPart, 10) - 1;
      }
      return new Date(year, month, isNaN(day) ? 1 : day).getTime();
    }
    return 0;
  };

  const sortedRecords = [...records].sort(
    (a, b) => parseDate(b.date || (b as any).fromDate) - parseDate(a.date || (a as any).fromDate)
  );

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
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              onClick={handleRefresh}
              disabled={loading}
              className="btn btn-ghost"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                fontSize: '0.8rem',
                padding: '6px 12px',
                borderRadius: '8px',
                backgroundColor: 'rgba(255, 255, 255, 0.05)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-color, rgba(255, 255, 255, 0.1))',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}
              title="Sync OD Hours from VTOP"
            >
              <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
              <span>{loading ? 'Syncing...' : 'Sync VTOP'}</span>
            </button>
            <button
              onClick={onClose}
              className="btn btn-ghost btn-icon"
              style={{ padding: '6px', borderRadius: '8px' }}
              aria-label="Close dialog"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Stats Row */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(2, 1fr)',
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
        </div>

        {/* Records List */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '16px 24px' }}>
          {loading ? (
            <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-muted)' }}>
              Loading on-duty records from university ledger...
            </div>
          ) : sortedRecords.length === 0 ? (
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
              {sortedRecords.map((rec, idx) => (
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
                        {rec.subjectTitle || (rec as any).courseTitle || rec.subjectCode || (rec as any).courseCode}
                      </div>
                      <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                        <span>{(rec as any).courseCode || rec.subjectCode}</span>
                        {rec.slot && <span>• {rec.slot}</span>}
                        {((rec as any).reason || rec.type || (rec as any).category) && <span>• {(rec as any).reason || rec.type || (rec as any).category}</span>}
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
