import React, { useEffect, useState, useMemo } from 'react';
import {
  Utensils,
  Shirt,
  Calendar,
  Clock,
  MapPin,
  CheckCircle2,
  RefreshCw,
  Search,
  Coffee,
  Sun,
  Sunset,
  Moon,
  Building,
} from 'lucide-react';
import { CampusAPI } from '../services/api';
import { StudentProfile, HostelInfo, LeaveRecord } from '../types';

interface HostelViewProps {
  student: StudentProfile;
}

type HostelTab = 'mess' | 'laundry' | 'leave';

const MEAL_ICONS = {
  Breakfast: Coffee,
  Lunch: Sun,
  Snacks: Sunset,
  Dinner: Moon,
};

const MEAL_TIMINGS = {
  Breakfast: '07:30 AM – 09:00 AM',
  Lunch: '12:00 PM – 02:00 PM',
  Snacks: '04:30 PM – 05:45 PM',
  Dinner: '07:30 PM – 09:00 PM',
};

const fullToShortDay: Record<string, string> = {
  Monday: 'MON',
  Tuesday: 'TUE',
  Wednesday: 'WED',
  Thursday: 'THU',
  Friday: 'FRI',
  Saturday: 'SAT',
  Sunday: 'SUN',
};

const shortToFullDay: Record<string, string> = Object.fromEntries(
  Object.entries(fullToShortDay).map(([full, short]) => [short, full])
);

const SHORT_DAYS = ['MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT', 'SUN'];

const parseMealItems = (raw: any): { num: string; text: string }[] => {
  if (!raw) return [];
  const str = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw.join('\n') : String(raw);
  const lines = str.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  if (lines.length > 1) {
    return lines.map((line, idx) => {
      const match = line.match(/^(\d+)[\.\)]\s*(.*)$/);
      if (match) {
        return { num: match[1], text: match[2].trim() };
      }
      return { num: String(idx + 1), text: line };
    });
  }

  if (lines.length === 1) {
    const single = lines[0];
    const numbered = single.split(/(?=\b\d+[\.\)]\s*)/).map((s) => s.trim()).filter(Boolean);
    if (numbered.length > 1) {
      return numbered.map((line, idx) => {
        const match = line.match(/^(\d+)[\.\)]\s*(.*)$/);
        if (match) {
          return { num: match[1], text: match[2].trim() };
        }
        return { num: String(idx + 1), text: line };
      });
    }
    return [{ num: '1', text: single }];
  }

  return [];
};

export const HostelView: React.FC<HostelViewProps> = ({ student }) => {
  const [activeTab, setActiveTab] = useState<HostelTab>('mess');
  const [hostelInfo, setHostelInfo] = useState<HostelInfo>({
    gender: student.gender || 'Male',
    isHosteller: student.isHosteller ?? true,
    blockName: student.blockName || 'A',
    roomNo: student.roomNo || '',
    messInfo: student.messInfo || 'NON VEG',
  });
  const [leaveHistory, setLeaveHistory] = useState<LeaveRecord[]>([]);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [showLeaveHistory, setShowLeaveHistory] = useState(false);

  // Mess states
  const [messGender, setMessGender] = useState<'Male' | 'Female'>('Male');
  const [messCategory, setMessCategory] = useState<'Veg' | 'Non Veg' | 'Special'>('Non Veg');
  const [selectedDay, setSelectedDay] = useState<string>(
    new Date().toLocaleDateString('en-US', { weekday: 'long' })
  );
  const [messMenu, setMessMenu] = useState<any[]>([]);
  const [loadingMess, setLoadingMess] = useState(false);

  // Laundry states
  const [laundryBlock, setLaundryBlock] = useState<string>('A');
  const [laundrySchedule, setLaundrySchedule] = useState<any[]>([]);
  const [loadingLaundry, setLoadingLaundry] = useState(false);
  const [roomFilter, setRoomFilter] = useState('');

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
          if (data.hostelInfo.gender) {
            const g = data.hostelInfo.gender.toUpperCase().includes('FEMALE') ? 'Female' : 'Male';
            setMessGender(g);
          }
          if (data.hostelInfo.blockName) {
            setLaundryBlock(data.hostelInfo.blockName.split(' ')[0] || 'A');
          }
          if (data.hostelInfo.messInfo) {
            const m = data.hostelInfo.messInfo.toUpperCase();
            if (m.includes('NON')) setMessCategory('Non Veg');
            else if (m.includes('SPECIAL') || m.includes('FOOD')) setMessCategory('Special');
            else setMessCategory('Veg');
          }
        }
        if (data.leaveHistory && data.leaveHistory.length > 0) {
          setLeaveHistory(data.leaveHistory);
        }
      }
    } catch (err) {
      console.warn('[HostelView] Could not load live hostel details:', err);
    } finally {
      setLoadingDetails(false);
    }
  };

  // 2. Fetch mess menu
  const loadMessMenu = async () => {
    setLoadingMess(true);
    const code = `${messGender === 'Male' ? 'M' : 'W'}-${messCategory === 'Non Veg' ? 'N' : messCategory === 'Veg' ? 'V' : 'S'}`;
    try {
      const list = await CampusAPI.getHostelMess(code);
      setMessMenu(list || []);
    } catch (err) {
      console.warn('[HostelView] Mess menu fetch warning:', err);
    } finally {
      setLoadingMess(false);
    }
  };

  // 3. Fetch laundry schedule
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
    loadMessMenu();
  }, [messGender, messCategory]);

  useEffect(() => {
    loadLaundrySchedule();
  }, [laundryBlock]);

  // Current day's mess meal item
  const currentDayMenu = useMemo(() => {
    if (!messMenu || messMenu.length === 0) return null;
    const match = messMenu.find(
      (m: any) => (m.Day || '').toLowerCase() === selectedDay.toLowerCase()
    );
    return match || messMenu[0] || null;
  }, [messMenu, selectedDay]);

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
  const { activeLeave, pastLeaves } = useMemo(() => {
    if (!leaveHistory || leaveHistory.length === 0) return { activeLeave: null, pastLeaves: [] };
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
    const past = leaveHistory.filter((l) => l !== active);
    return { activeLeave: active, pastLeaves: past };
  }, [leaveHistory]);

  const getStatusBadge = (status: string) => {
    const s = (status || '').toUpperCase();
    if (s.includes('APPROVED')) return { bg: 'rgba(16, 185, 129, 0.15)', color: '#10b981', label: 'Approved' };
    if (s.includes('PENDING')) return { bg: 'rgba(245, 158, 11, 0.15)', color: '#f59e0b', label: 'Pending' };
    if (s.includes('CLOSED')) return { bg: 'rgba(59, 130, 246, 0.15)', color: '#3b82f6', label: 'Closed' };
    if (s.includes('CANCEL')) return { bg: 'rgba(148, 163, 184, 0.15)', color: '#94a3b8', label: 'Cancelled' };
    return { bg: 'rgba(239, 68, 68, 0.15)', color: '#ef4444', label: status || 'Unknown' };
  };

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
                backgroundColor: 'rgba(99, 102, 241, 0.15)',
                color: '#6366f1',
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
                Authoritative residential directory &bull; VTOP verified dining, laundry allotments, and sanctioned leave management.
              </p>
            </div>
          </div>

          <button
            className="btn btn-secondary btn-sm"
            onClick={() => {
              loadHostelDetails();
              loadMessMenu();
              loadLaundrySchedule();
            }}
            disabled={loadingDetails}
            style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
          >
            <RefreshCw size={14} className={loadingDetails ? 'animate-spin' : ''} />
            <span>Sync Hostel Data</span>
          </button>
        </div>

        {/* Info badges strip */}
        <div
          style={{
            marginTop: '20px',
            paddingTop: '16px',
            borderTop: '1px solid var(--border-color)',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
            gap: '12px',
          }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Block</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>Block {hostelInfo.blockName || 'A'}</span>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
            <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Room Number</span>
            <span style={{ fontWeight: 600, fontSize: '0.95rem' }}>{hostelInfo.roomNo || 'Allotted on Arrival'}</span>
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

      {/* Sub-Tab Navigation */}
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
          className={`btn ${activeTab === 'mess' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('mess')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px 8px 0 0' }}
        >
          <Utensils size={16} />
          <span>Mess Menu</span>
        </button>

        <button
          className={`btn ${activeTab === 'laundry' ? 'btn-primary' : 'btn-ghost'}`}
          onClick={() => setActiveTab('laundry')}
          style={{ display: 'flex', alignItems: 'center', gap: '8px', borderRadius: '8px 8px 0 0' }}
        >
          <Shirt size={16} />
          <span>Laundry Schedule</span>
        </button>

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
      </div>

      {/* === TAB 1: MESS MENU === */}
      {activeTab === 'mess' && (
        <div>
          {/* Filter Bar */}
          <div
            className="card"
            style={{
              padding: '16px 20px',
              marginBottom: '20px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
            }}
          >
            {/* Gender and Category options */}
            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', alignItems: 'center' }}>
              <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                <button
                  className={`btn btn-sm ${messGender === 'Male' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMessGender('Male')}
                  style={{ borderRadius: 0, fontSize: '0.8rem' }}
                >
                  Men's Mess
                </button>
                <button
                  className={`btn btn-sm ${messGender === 'Female' ? 'btn-primary' : 'btn-ghost'}`}
                  onClick={() => setMessGender('Female')}
                  style={{ borderRadius: 0, fontSize: '0.8rem' }}
                >
                  Women's Mess
                </button>
              </div>

              <div style={{ display: 'flex', borderRadius: '8px', overflow: 'hidden', border: '1px solid var(--border-color)' }}>
                {(['Veg', 'Non Veg', 'Special'] as const).map((cat) => (
                  <button
                    key={cat}
                    className={`btn btn-sm ${messCategory === cat ? 'btn-primary' : 'btn-ghost'}`}
                    onClick={() => setMessCategory(cat)}
                    style={{ borderRadius: 0, fontSize: '0.8rem' }}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

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
              <span>&bull; VITC Campus</span>
            </div>
          </div>

          {/* Day of Week Selector */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(7, 1fr)',
              gap: '8px',
              marginBottom: '24px',
              overflowX: 'auto',
            }}
          >
            {SHORT_DAYS.map((short) => {
              const full = shortToFullDay[short];
              const isSelected = selectedDay.toLowerCase() === full.toLowerCase();
              const isToday = new Date().toLocaleDateString('en-US', { weekday: 'long' }).toLowerCase() === full.toLowerCase();

              return (
                <button
                  key={short}
                  className="card"
                  onClick={() => setSelectedDay(full)}
                  style={{
                    padding: '12px 8px',
                    textAlign: 'center',
                    cursor: 'pointer',
                    border: isSelected ? '2px solid #3b82f6' : '1px solid var(--border-color)',
                    backgroundColor: isSelected ? 'rgba(59, 130, 246, 0.12)' : 'var(--card-bg)',
                    position: 'relative',
                    transition: 'all 0.2s',
                  }}
                >
                  {isToday && (
                    <span
                      style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        width: '6px',
                        height: '6px',
                        borderRadius: '50%',
                        backgroundColor: '#10b981',
                      }}
                      title="Today"
                    />
                  )}
                  <div style={{ fontSize: '0.8rem', color: isSelected ? '#3b82f6' : 'var(--text-muted)', fontWeight: 700 }}>
                    {short}
                  </div>
                  <div style={{ fontSize: '0.85rem', fontWeight: 600, marginTop: '2px' }}>
                    {full}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Meals of the Day Grid */}
          {loadingMess ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 12px' }} />
              <p>Loading meal schedule...</p>
            </div>
          ) : !currentDayMenu ? (
            <div className="card" style={{ padding: '40px', textAlign: 'center', color: 'var(--text-muted)' }}>
              No menu published for {selectedDay}.
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '20px' }}>
              {(['Breakfast', 'Lunch', 'Snacks', 'Dinner'] as const).map((meal) => {
                const IconComponent = MEAL_ICONS[meal];
                const rawItems = currentDayMenu[meal] || '';
                const itemsList = parseMealItems(rawItems);

                return (
                  <div
                    key={meal}
                    className="card"
                    style={{
                      padding: '20px',
                      display: 'flex',
                      flexDirection: 'column',
                      borderLeft: `4px solid ${
                        meal === 'Breakfast'
                          ? '#f59e0b'
                          : meal === 'Lunch'
                          ? '#10b981'
                          : meal === 'Snacks'
                          ? '#ec4899'
                          : '#6366f1'
                      }`,
                    }}
                  >
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <IconComponent size={20} color="var(--text-main)" />
                        <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 600 }}>{meal}</h3>
                      </div>
                      <span
                        style={{
                          fontSize: '0.75rem',
                          color: 'var(--text-muted)',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '4px',
                        }}
                      >
                        <Clock size={12} />
                        {MEAL_TIMINGS[meal]}
                      </span>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1 }}>
                      {itemsList.length === 0 ? (
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                          Standard menu scheduled
                        </span>
                      ) : (
                        itemsList.map((item, idx) => (
                          <div
                            key={idx}
                            style={{
                              display: 'flex',
                              alignItems: 'flex-start',
                              gap: '10px',
                              fontSize: '0.875rem',
                              padding: '8px 10px',
                              borderRadius: '8px',
                              backgroundColor: 'rgba(255, 255, 255, 0.02)',
                              border: '1px solid var(--border-color)',
                              lineHeight: 1.4,
                            }}
                          >
                            <span
                              style={{
                                minWidth: '22px',
                                height: '22px',
                                borderRadius: '6px',
                                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                                color: '#60a5fa',
                                fontSize: '0.75rem',
                                fontWeight: 700,
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'center',
                                flexShrink: 0,
                                marginTop: '1px',
                              }}
                            >
                              {item.num}
                            </span>
                            <span style={{ fontWeight: 500, color: 'var(--text-main)' }}>{item.text}</span>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
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
                {(['A', 'B', 'C', 'D1', 'D2', 'E'] as const).map((blk) => (
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

      {/* === TAB 3: LEAVE & PERMISSIONS === */}
      {activeTab === 'leave' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
          {/* Active Leave Section */}
          <div className="card" style={{ padding: '24px' }}>
            <h2 style={{ margin: '0 0 16px', fontSize: '1.15rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Calendar size={18} color="#6366f1" />
              <span>Current Leave Status</span>
            </h2>

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
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Leave Application:</span>
                    <span style={{ fontWeight: 600, fontFamily: 'monospace' }}>#{activeLeave.leaveId}</span>
                    <span
                      style={{
                        padding: '2px 8px',
                        borderRadius: '6px',
                        backgroundColor: 'rgba(99, 102, 241, 0.15)',
                        color: '#6366f1',
                        fontSize: '0.75rem',
                        fontWeight: 600,
                      }}
                    >
                      {activeLeave.leaveType || 'Weekend Outing'}
                    </span>
                  </div>

                  {(() => {
                    const badge = getStatusBadge(activeLeave.status);
                    return (
                      <span
                        style={{
                          backgroundColor: badge.bg,
                          color: badge.color,
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
                    <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <MapPin size={14} color="var(--text-muted)" />
                      <span>{activeLeave.visitPlace || 'Hometown / Local Guardian'}</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Departure (From)</span>
                    <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <Clock size={14} color="var(--text-muted)" />
                      <span>{activeLeave.from || 'Scheduled departure'}</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Return (To)</span>
                    <div style={{ fontWeight: 500, display: 'flex', alignItems: 'center', gap: '6px', marginTop: '2px' }}>
                      <Clock size={14} color="var(--text-muted)" />
                      <span>{activeLeave.to || 'Scheduled return'}</span>
                    </div>
                  </div>

                  <div>
                    <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Sanction Reason</span>
                    <div style={{ fontWeight: 500, marginTop: '2px' }}>
                      {activeLeave.reason || 'Personal visit'}
                    </div>
                  </div>
                </div>

                {activeLeave.remarks && (
                  <div
                    style={{
                      fontSize: '0.8rem',
                      color: 'var(--text-muted)',
                      backgroundColor: 'rgba(0,0,0,0.15)',
                      padding: '8px 12px',
                      borderRadius: '8px',
                    }}
                  >
                    <strong>Warden / Proctor Remarks:</strong> {activeLeave.remarks}
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

          {/* Toggle Leave History Button */}
          {pastLeaves.length > 0 && (
            <div style={{ textAlign: 'center', margin: '4px 0' }}>
              <button
                className="btn btn-secondary"
                onClick={() => setShowLeaveHistory((prev) => !prev)}
                style={{ padding: '8px 24px', fontWeight: 600 }}
              >
                {showLeaveHistory ? 'Hide Leave History' : `Show Leave History (${pastLeaves.length})`}
              </button>
            </div>
          )}

          {/* Leave History Table (Collapsible) */}
          {showLeaveHistory && pastLeaves.length > 0 && (
            <div className="card" style={{ padding: 0, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid var(--border-color)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Previous Leave History</h3>
                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{pastLeaves.length} prior sanctioned records</span>
              </div>

              <div className="table-responsive-wrapper">
                <table className="academic-data-table">
                  <thead>
                    <tr>
                      <th>Leave ID</th>
                      <th>Type</th>
                      <th>Destination</th>
                      <th>From Date</th>
                      <th>To Date</th>
                      <th>Reason</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pastLeaves.map((leave, idx) => {
                      const badge = getStatusBadge(leave.status);
                      return (
                        <tr key={idx}>
                          <td style={{ fontFamily: 'monospace', fontWeight: 600 }}>
                            #{leave.leaveId}
                          </td>
                          <td style={{ fontSize: '0.85rem' }}>{leave.leaveType || 'General'}</td>
                          <td style={{ fontSize: '0.85rem' }}>{leave.visitPlace || '—'}</td>
                          <td style={{ fontSize: '0.825rem', whiteSpace: 'nowrap' }}>{leave.from}</td>
                          <td style={{ fontSize: '0.825rem', whiteSpace: 'nowrap' }}>{leave.to}</td>
                          <td style={{ fontSize: '0.825rem', maxWidth: '240px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                            {leave.reason || '—'}
                          </td>
                          <td>
                            <span
                              style={{
                                backgroundColor: badge.bg,
                                color: badge.color,
                                padding: '2px 8px',
                                borderRadius: '10px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
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
            </div>
          )}
        </div>
      )}
    </div>
  );
};
