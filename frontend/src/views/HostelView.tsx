import React, { useEffect, useState, useMemo } from 'react';
import {
  Shirt,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Search,
  Building,
  ExternalLink,
  ShieldCheck,
  AlertCircle,
  FileText,
  Home,
  Compass,
} from 'lucide-react';
import { CampusAPI } from '../services/api';
import { StudentProfile, HostelInfo, LeaveRecord } from '../types';

interface HostelViewProps {
  student: StudentProfile;
}

type HostelTab = 'leave' | 'laundry';

export const HostelView: React.FC<HostelViewProps> = ({ student }) => {
  const [activeTab, setActiveTab] = useState<HostelTab>('leave');
  const [hostelInfo, setHostelInfo] = useState<HostelInfo>({
    gender: student.gender || 'Male',
    isHosteller: student.isHosteller ?? true,
    blockName: student.blockName || 'A',
    roomNo: student.roomNo || '',
    messInfo: student.messInfo || 'NON VEG',
  });
  const [leaveHistory, setLeaveHistory] = useState<LeaveRecord[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);

  // Leave filters and search
  const [leaveSearch, setLeaveSearch] = useState('');
  const [leaveTypeFilter, setLeaveTypeFilter] = useState<'ALL' | 'APPROVED' | 'CLOSED' | 'OUTING' | 'VACATION'>('ALL');

  // Laundry states
  const [laundryBlock, setLaundryBlock] = useState<string>('A');
  const [laundrySchedule, setLaundrySchedule] = useState<any[]>([]);
  const [loadingLaundry, setLoadingLaundry] = useState(false);
  const [roomFilter, setRoomFilter] = useState('');

  // Keep hostelInfo synced with incoming student profile
  useEffect(() => {
    if (student) {
      setHostelInfo((prev) => ({
        ...prev,
        gender: student.gender || prev.gender,
        isHosteller: student.isHosteller !== undefined ? student.isHosteller : prev.isHosteller,
        blockName: student.blockName || prev.blockName,
        roomNo: student.roomNo || prev.roomNo,
        messInfo: student.messInfo || prev.messInfo,
      }));
      if (student.blockName) {
        const blkMatch = student.blockName.match(/\b([A-Za-z0-9]+)\s*(?:-|Block)/i) || student.blockName.match(/\b([A-Za-z0-9]+)\b/);
        if (blkMatch && blkMatch[1]) {
          setLaundryBlock(blkMatch[1].toUpperCase());
        }
      }
    }
  }, [student]);

  // 1. Fetch hostel profile & leave history
  const loadHostelDetails = async () => {
    setLoadingDetails(true);
    try {
      const data = await CampusAPI.getHostelDetails();
      if (data) {
        if (data.hostelInfo) {
          setHostelInfo((prev) => ({
            ...prev,
            ...data.hostelInfo,
          }));
          if (data.hostelInfo.blockName) {
            const blkMatch = data.hostelInfo.blockName.match(/\b([A-Za-z0-9]+)\s*(?:-|Block)/i) || data.hostelInfo.blockName.match(/\b([A-Za-z0-9]+)\b/);
            if (blkMatch && blkMatch[1]) {
              setLaundryBlock(blkMatch[1].toUpperCase());
            }
          }
        }
        if (data.leaveHistory && data.leaveHistory.length > 0) {
          setLeaveHistory(data.leaveHistory);
        } else {
          try {
            const fbRes = await fetch('/data/hostel.json');
            if (fbRes.ok) {
              const fbData = await fbRes.json();
              if (fbData?.leaveHistory && fbData.leaveHistory.length > 0) {
                setLeaveHistory(fbData.leaveHistory);
              }
            }
          } catch (e) {
            // ignore
          }
        }
      }
    } catch (err) {
      console.warn('[HostelView] Could not load live hostel details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // 2. Fetch laundry schedule
  const loadLaundrySchedule = async () => {
    setLoadingLaundry(true);
    try {
      const list = await CampusAPI.getHostelLaundry(laundryBlock);
      setLaundrySchedule(list || []);
    } catch (err) {
      console.warn('[HostelView] Laundry fetch warning:', err);
    } finally {
      setLoadingLaundry(false);
    }
  };

  useEffect(() => {
    loadHostelDetails();
  }, []);

  useEffect(() => {
    if (activeTab === 'laundry') {
      loadLaundrySchedule();
    }
  }, [laundryBlock, activeTab]);

  // Filtered laundry items
  const filteredLaundry = useMemo(() => {
    if (!roomFilter.trim()) return laundrySchedule;
    const q = roomFilter.toLowerCase().trim();
    return laundrySchedule.filter((item: any) => {
      const room = String(item.RoomNumber || item.RoomNo || item.room || '').toLowerCase();
      const date = String(item.Date || '').toLowerCase();
      return room.includes(q) || date.includes(q);
    });
  }, [laundrySchedule, roomFilter]);

  // Parse date helper
  const parseDate = (dateStr: string) => {
    if (!dateStr) return new Date();
    const parts = dateStr.split(/[-/ ]/);
    if (parts.length === 3) {
      const [day, monthStr, year] = parts;
      const month = new Date(`${monthStr} 1, 2000`).getMonth();
      return new Date(Number(year), isNaN(month) ? 0 : month, parseInt(day, 10));
    }
    return new Date(dateStr);
  };

  // Active leave logic
  const { activeLeave } = useMemo(() => {
    if (!leaveHistory || leaveHistory.length === 0) return { activeLeave: null };
    const now = new Date();
    const activeList = leaveHistory.filter((leave) => {
      const from = parseDate(leave.from);
      const to = parseDate(leave.to);
      const daysSinceEnd = (now.getTime() - to.getTime()) / (1000 * 60 * 60 * 24);
      const statusUpper = (leave.status || '').toUpperCase();
      return (
        (from <= now && now <= to) ||
        from > now ||
        (daysSinceEnd >= 0 && daysSinceEnd <= 3) ||
        statusUpper.includes('APPROVED') ||
        statusUpper.includes('PENDING')
      );
    });

    const active = activeList[0] || leaveHistory[0] || null;
    return { activeLeave: active };
  }, [leaveHistory]);

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s.includes('APPROVED')) return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', border: 'rgba(16, 185, 129, 0.3)', label: 'Approved' };
    if (s.includes('PENDING')) return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', border: 'rgba(245, 158, 11, 0.3)', label: 'Pending' };
    if (s.includes('CLOSED')) return { bg: 'rgba(59, 130, 246, 0.15)', color: '#60a5fa', border: 'rgba(59, 130, 246, 0.3)', label: 'Closed' };
    if (s.includes('CANCEL')) return { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', border: 'rgba(148, 163, 184, 0.3)', label: 'Cancelled' };
    return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', border: 'rgba(239, 68, 68, 0.3)', label: status || 'Unknown' };
  };

  // Filtered leave list
  const filteredLeaveList = useMemo(() => {
    let list = leaveHistory;

    // Filter by category pill
    if (leaveTypeFilter === 'APPROVED') {
      list = list.filter((l) => (l.status || '').toUpperCase().includes('APPROVED'));
    } else if (leaveTypeFilter === 'CLOSED') {
      list = list.filter((l) => (l.status || '').toUpperCase().includes('CLOSED'));
    } else if (leaveTypeFilter === 'OUTING') {
      list = list.filter((l) => (l.leaveType || '').toUpperCase().includes('OUTING'));
    } else if (leaveTypeFilter === 'VACATION') {
      list = list.filter((l) => (l.leaveType || '').toUpperCase().includes('VACATION'));
    }

    // Filter by query
    if (leaveSearch.trim()) {
      const q = leaveSearch.toLowerCase().trim();
      list = list.filter((l) => {
        return (
          (l.leaveId && String(l.leaveId).toLowerCase().includes(q)) ||
          (l.visitPlace && l.visitPlace.toLowerCase().includes(q)) ||
          (l.reason && l.reason.toLowerCase().includes(q)) ||
          (l.leaveType && l.leaveType.toLowerCase().includes(q)) ||
          (l.status && l.status.toLowerCase().includes(q)) ||
          (l.from && l.from.toLowerCase().includes(q)) ||
          (l.to && l.to.toLowerCase().includes(q))
        );
      });
    }

    return list;
  }, [leaveHistory, leaveTypeFilter, leaveSearch]);

  const approvedCount = useMemo(() => {
    return leaveHistory.filter((l) => (l.status || '').toUpperCase().includes('APPROVED')).length;
  }, [leaveHistory]);

  const closedCount = useMemo(() => {
    return leaveHistory.filter((l) => (l.status || '').toUpperCase().includes('CLOSED')).length;
  }, [leaveHistory]);

  const outingCount = useMemo(() => {
    return leaveHistory.filter((l) => (l.leaveType || '').toUpperCase().includes('OUTING')).length;
  }, [leaveHistory]);

  const vacationCount = useMemo(() => {
    return leaveHistory.filter((l) => (l.leaveType || '').toUpperCase().includes('VACATION')).length;
  }, [leaveHistory]);

  return (
    <div className="view-container">
      {/* Header Profile Bar */}
      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: '16px' }}>
          <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
            <div
              style={{
                width: '54px',
                height: '54px',
                borderRadius: '14px',
                backgroundColor: 'rgba(6, 182, 212, 0.15)',
                color: '#06b6d4',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Building size={28} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
                <h1 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700 }}>Hostel &amp; Campus Living</h1>
                <span
                  style={{
                    backgroundColor: hostelInfo.isHosteller ? 'rgba(16, 185, 129, 0.15)' : 'rgba(148, 163, 184, 0.15)',
                    color: hostelInfo.isHosteller ? '#10b981' : '#94a3b8',
                    border: hostelInfo.isHosteller ? '1px solid rgba(16, 185, 129, 0.25)' : '1px solid rgba(148, 163, 184, 0.25)',
                    fontSize: '0.75rem',
                    padding: '3px 10px',
                    borderRadius: '12px',
                    fontWeight: 600,
                  }}
                >
                  {hostelInfo.isHosteller ? 'Hosteller' : 'Day Scholar'}
                </span>
              </div>
              <p style={{ margin: '6px 0 0', fontSize: '0.875rem', color: 'var(--text-muted)' }}>
                Official residential directory &bull; VTOP verified room allotment, sanctioned leave permissions &amp; laundry schedule.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <a
              href="https://vtop.vit.ac.in"
              target="_blank"
              rel="noopener noreferrer"
              className="btn btn-secondary btn-sm"
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <ExternalLink size={14} />
              <span>VTOP Portal</span>
            </a>

            <button
              className="btn btn-secondary btn-sm"
              onClick={() => {
                loadHostelDetails();
                loadLaundrySchedule();
              }}
              disabled={loadingDetails}
              style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
            >
              <RefreshCw size={14} className={loadingDetails ? 'animate-spin' : ''} />
              <span>Sync VTOP Hostel</span>
            </button>
          </div>
        </div>

        {/* Info badges strip */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-color)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Block Allotment</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#38bdf8' }}>{hostelInfo.blockName || 'Block Allotted'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Room Number</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{hostelInfo.roomNo ? `Room ${hostelInfo.roomNo}` : 'Allotted on Arrival'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Mess Enrolled</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#10b981' }}>{hostelInfo.messInfo || 'Special / Veg'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Gender</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{hostelInfo.gender || 'Male'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Sanctioned Leaves</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem', color: '#6366f1' }}>{leaveHistory.length} Recorded</span>
          </div>
        </div>
      </div>

      {/* Sub-Tab Navigation: Leave & Permissions + Laundry Schedule */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          marginBottom: '20px',
          borderBottom: '1px solid var(--border-color)',
          paddingBottom: '4px',
        }}
      >
        <button
          className={`btn ${activeTab === 'leave' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('leave')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px 8px 0 0' }}
        >
          <Calendar size={16} />
          <span>Leave &amp; Permissions</span>
          {leaveHistory.length > 0 && (
            <span
              style={{
                backgroundColor: activeTab === 'leave' ? 'rgba(255,255,255,0.2)' : 'rgba(99, 102, 241, 0.15)',
                color: activeTab === 'leave' ? '#fff' : '#6366f1',
                padding: '1px 6px',
                borderRadius: '10px',
                fontSize: '0.7rem',
                fontWeight: 600,
              }}
            >
              {leaveHistory.length}
            </span>
          )}
        </button>

        <button
          className={`btn ${activeTab === 'laundry' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('laundry')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px 8px 0 0' }}
        >
          <Shirt size={16} />
          <span>Laundry Schedule</span>
        </button>
      </div>

      {/* === TAB 1: LEAVE & PERMISSIONS (PRIMARY VIEW) === */}
      {activeTab === 'leave' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Quick Metrics Bar */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
              gap: '12px',
            }}
          >
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                <ShieldCheck size={16} color="#10b981" />
                <span>Current Residency</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '8px', color: '#10b981' }}>
                {hostelInfo.isHosteller ? 'Active Hosteller' : 'Day Scholar'}
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {hostelInfo.blockName || 'Residential block verified'}
              </div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                <CheckCircle2 size={16} color="#3b82f6" />
                <span>Sanctioned Leaves</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '8px', color: '#60a5fa' }}>
                {approvedCount} Approved
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {closedCount} completed outings &bull; {leaveHistory.length} total applications
              </div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                <Compass size={16} color="#f59e0b" />
                <span>Outings Recorded</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '8px', color: '#fbbf24' }}>
                {outingCount} Passes
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                {vacationCount} semester vacations sanctioned
              </div>
            </div>

            <div className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 600, textTransform: 'uppercase' }}>
                <Home size={16} color="#a855f7" />
                <span>Gate Pass Protocol</span>
              </div>
              <div style={{ fontSize: '1.25rem', fontWeight: 700, marginTop: '8px', color: '#c084fc' }}>
                VTOP Biometric
              </div>
              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '4px' }}>
                Synchronized with hostel gate logs
              </div>
            </div>
          </div>

          {/* Active Leave Section */}
          <div className="card" style={{ padding: '24px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
              <h2 style={{ margin: 0, fontSize: '1.15rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Calendar size={18} color="#6366f1" />
                <span>Latest Sanctioned Leave Pass</span>
              </h2>
            </div>

            {activeLeave ? (
              <div
                style={{
                  padding: '20px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color)',
                  backgroundColor: 'rgba(255, 255, 255, 0.02)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '10px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Application Ref:</span>
                    <span style={{ fontWeight: 700, fontFamily: 'monospace', color: '#fff', fontSize: '0.95rem' }}>#{activeLeave.leaveId}</span>
                    <span
                      style={{
                        padding: '2px 10px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        color: '#818cf8',
                        border: '1px solid rgba(99, 102, 241, 0.25)',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {activeLeave.leaveType || 'OUTING'}
                    </span>
                  </div>

                  {(() => {
                    const badge = getStatusBadge(activeLeave.status);
                    return (
                      <span
                        style={{
                          backgroundColor: badge.bg,
                          color: badge.color,
                          border: `1px solid ${badge.border}`,
                          padding: '3px 12px',
                          borderRadius: '12px',
                          fontSize: '0.8rem',
                          fontWeight: 600,
                        }}
                      >
                        {badge.label}
                      </span>
                    );
                  })()}
                </div>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                    gap: '16px',
                    paddingTop: '12px',
                    borderTop: '1px solid var(--border-color)',
                  }}
                >
                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Destination Place</span>
                    <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px', color: '#fff' }}>
                      <MapPin size={15} color="#38bdf8" />
                      <span>{activeLeave.visitPlace || 'Hometown / Local Area'}</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Departure (From)</span>
                    <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <Clock size={15} color="#10b981" />
                      <span>{activeLeave.from || 'Scheduled departure'}</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Return (To)</span>
                    <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <Clock size={15} color="#f59e0b" />
                      <span>{activeLeave.to || 'Scheduled return'}</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sanction Reason</span>
                    <div style={{ fontWeight: 500, marginTop: '2px', color: '#e2e8f0' }}>
                      {activeLeave.reason || 'Personal visit'}
                    </div>
                  </div>
                </div>

                {activeLeave.remarks && (
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      backgroundColor: 'rgba(0,0,0,0.2)',
                      padding: '10px 14px',
                      borderRadius: '8px',
                      border: '1px solid var(--border-color)',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                    }}
                  >
                    <CheckCircle2 size={14} color="#10b981" />
                    <span>
                      <strong style={{ color: '#fff' }}>Warden / Proctor Remarks:</strong> {activeLeave.remarks}
                    </span>
                  </div>
                )}
              </div>
            ) : (
              <div
                style={{
                  padding: '30px',
                  borderRadius: '12px',
                  border: '1px dashed var(--border-color)',
                  textAlign: 'center',
                  color: 'var(--text-muted)',
                }}
              >
                <CheckCircle2 size={32} color="#10b981" style={{ margin: '0 auto 8px' }} />
                <div style={{ fontWeight: 600, fontSize: '1rem', color: 'var(--text-main)' }}>You are currently on campus</div>
                <p style={{ margin: '4px 0 0', fontSize: '0.825rem' }}>
                  No active or pending leave applications recorded on VTOP.
                </p>
              </div>
            )}
          </div>

          {/* Full Leave History Section */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            <div
              style={{
                padding: '16px 20px',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
              }}
            >
              <div>
                <h3 style={{ margin: 0, fontSize: '1.05rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <FileText size={18} color="#38bdf8" />
                  <span>Sanctioned Leave History</span>
                </h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                  {leaveHistory.length} total leave records synchronized from VTOP
                </span>
              </div>

              {/* Search Bar */}
              <div style={{ position: 'relative', width: '260px', maxWidth: '100%' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Search destination, reason, ID..."
                  value={leaveSearch}
                  onChange={(e) => setLeaveSearch(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '7px 12px 7px 32px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--input-bg, rgba(0,0,0,0.2))',
                    color: 'inherit',
                    fontSize: '0.825rem',
                  }}
                />
              </div>
            </div>

            {/* Filter Pills */}
            <div
              style={{
                padding: '12px 20px',
                backgroundColor: 'rgba(255, 255, 255, 0.01)',
                borderBottom: '1px solid var(--border-color)',
                display: 'flex',
                gap: '8px',
                flexWrap: 'wrap',
                alignItems: 'center',
              }}
            >
              <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Filter:</span>
              {(
                [
                  { key: 'ALL', label: `All (${leaveHistory.length})` },
                  { key: 'APPROVED', label: `Approved (${approvedCount})` },
                  { key: 'CLOSED', label: `Closed (${closedCount})` },
                  { key: 'OUTING', label: `Outings (${outingCount})` },
                  { key: 'VACATION', label: `Vacations (${vacationCount})` },
                ] as const
              ).map((f) => (
                <button
                  key={f.key}
                  className={`btn btn-sm ${leaveTypeFilter === f.key ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setLeaveTypeFilter(f.key)}
                  style={{ fontSize: '0.75rem', padding: '3px 10px', borderRadius: '6px' }}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Table */}
            {filteredLeaveList.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <AlertCircle size={28} style={{ margin: '0 auto 10px', opacity: 0.6 }} />
                <p style={{ margin: 0, fontWeight: 500 }}>No leave records matching "{leaveSearch}"</p>
                <span style={{ fontSize: '0.8rem' }}>Try clearing the search query or adjusting your filter</span>
              </div>
            ) : (
              <div className="table-responsive-wrapper">
                <table className="academic-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '110px' }}>Leave ID</th>
                      <th style={{ width: '140px' }}>Type</th>
                      <th>Destination</th>
                      <th style={{ width: '160px' }}>Departure (From)</th>
                      <th style={{ width: '160px' }}>Return (To)</th>
                      <th>Reason / Remarks</th>
                      <th style={{ width: '120px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLeaveList.map((leave, idx) => {
                      const badge = getStatusBadge(leave.status);
                      return (
                        <tr key={idx}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            <span style={{ color: '#38bdf8' }}>#{leave.leaveId}</span>
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                backgroundColor: 'rgba(255,255,255,0.04)',
                                border: '1px solid var(--border-color)',
                                fontSize: '0.75rem',
                                fontWeight: 500,
                              }}
                            >
                              {leave.leaveType || 'GENERAL'}
                            </span>
                          </td>
                          <td style={{ fontSize: '0.875rem', fontWeight: 500 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <MapPin size={13} color="var(--text-muted)" />
                              <span>{leave.visitPlace || '—'}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.825rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Clock size={12} color="#10b981" />
                              <span>{leave.from}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.825rem', whiteSpace: 'nowrap', color: 'var(--text-muted)' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                              <Clock size={12} color="#f59e0b" />
                              <span>{leave.to}</span>
                            </div>
                          </td>
                          <td style={{ fontSize: '0.825rem', maxWidth: '280px' }}>
                            <div style={{ color: 'var(--text-main)', fontWeight: 500, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                              {leave.reason || '—'}
                            </div>
                            {leave.remarks && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                Remarks: {leave.remarks}
                              </div>
                            )}
                          </td>
                          <td>
                            <span
                              style={{
                                backgroundColor: badge.bg,
                                color: badge.color,
                                border: `1px solid ${badge.border}`,
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                display: 'inline-block',
                              }}
                            >
                              {badge.label}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* === TAB 2: LAUNDRY SCHEDULE === */}
      {activeTab === 'laundry' && (
        <div>
          {/* Block Selector & Room Search */}
          <div
            className="card"
            style={{
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '16px',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexWrap: 'wrap' }}>
              <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>Select Block:</span>
              <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                {(['A', 'B', 'C', 'D', 'D1', 'D2', 'E'] as const).map((blk) => (
                  <button
                    key={blk}
                    className={`btn btn-sm ${laundryBlock === blk ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setLaundryBlock(blk)}
                    style={{ fontSize: '0.8rem', padding: '4px 12px' }}
                  >
                    Block {blk}
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                <span>Data sourced from</span>
                <a
                  href="https://kanishka-developer.github.io/unmessify/"
                  target="_blank"
                  rel="noopener noreferrer"
                  style={{ color: '#3b82f6', textDecoration: 'underline', fontWeight: 600 }}
                >
                  Unmessify
                </a>
              </div>

              <div style={{ position: 'relative', width: '220px' }}>
                <Search
                  size={14}
                  style={{
                    position: 'absolute',
                    left: '10px',
                    top: '50%',
                    transform: 'translateY(-50%)',
                    color: 'var(--text-muted)',
                  }}
                />
                <input
                  type="text"
                  placeholder="Search room or date..."
                  value={roomFilter}
                  onChange={(e) => setRoomFilter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '6px 12px 6px 30px',
                    borderRadius: '8px',
                    border: '1px solid var(--border-color)',
                    backgroundColor: 'var(--input-bg, rgba(0,0,0,0.2))',
                    color: 'inherit',
                    fontSize: '0.825rem',
                  }}
                />
              </div>
            </div>
          </div>

          {/* Schedule Table */}
          <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
            {loadingLaundry ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
                <p>Loading laundry allotments...</p>
              </div>
            ) : filteredLaundry.length === 0 ? (
              <div style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
                No laundry schedule available for Block {laundryBlock} matching your search.
              </div>
            ) : (
              <div className="table-responsive-wrapper">
                <table className="academic-data-table">
                  <thead>
                    <tr>
                      <th style={{ width: '130px' }}>Schedule Date</th>
                      <th style={{ width: '110px' }}>Day</th>
                      <th>Room Numbers Allotted</th>
                      <th style={{ width: '140px' }}>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredLaundry.map((row: any, idx: number) => {
                      const dateStr = String(row.Date || row.date || `Day ${idx + 1}`);
                      const roomStr = String(row.RoomNumber || row.RoomNo || row.rooms || 'Allotted Rooms');
                      const todayNum = new Date().getDate();
                      const isToday = parseInt(row.Date || '0', 10) === todayNum || dateStr.includes(String(todayNum));

                      return (
                        <tr
                          key={idx}
                          style={{
                            backgroundColor: isToday ? 'rgba(234, 179, 8, 0.12)' : undefined,
                            borderLeft: isToday ? '3px solid #eab308' : undefined,
                          }}
                        >
                          <td style={{ fontWeight: 600 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                              <Calendar size={14} color={isToday ? '#eab308' : 'var(--text-muted)'} />
                              <span>{dateStr}</span>
                            </div>
                          </td>
                          <td style={{ color: isToday ? '#eab308' : 'var(--text-muted)', fontSize: '0.85rem', fontWeight: isToday ? 600 : 400 }}>
                            {row.Day || 'Scheduled'}
                          </td>
                          <td style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                            {roomStr}
                          </td>
                          <td>
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '4px',
                                fontSize: '0.75rem',
                                padding: '2px 8px',
                                borderRadius: '10px',
                                backgroundColor: isToday ? 'rgba(234, 179, 8, 0.2)' : 'rgba(255, 255, 255, 0.06)',
                                color: isToday ? '#facc15' : 'var(--text-muted)',
                                fontWeight: 600,
                              }}
                            >
                              {isToday ? <CheckCircle2 size={12} /> : null}
                              {isToday ? 'Today Allotted' : 'Scheduled'}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
