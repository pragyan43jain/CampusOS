import React, { useEffect, useState } from 'react';
import {
  X,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  RefreshCw,
  Layers,
  Database,
  ExternalLink,
  ShieldCheck,
  Search,
} from 'lucide-react';
import { CampusAPI } from '../services/api';
import { FeatureAvailabilityMap } from '../types';

interface FeatureAvailabilityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onNavigateTo?: (view: string, subTab?: string) => void;
}

const FEATURE_NAMES: Record<string, { label: string; view: string; subTab?: string; desc: string }> = {
  attendance: { label: 'Class Attendance', view: 'academics', subTab: 'attendance', desc: 'Subject-wise class attendance percentages, conducted hours, and debarment margin.' },
  timetable: { label: 'Class Timetable', view: 'academics', subTab: 'timetable', desc: 'Active semester timetable grid with time slots, venues, and day schedule.' },
  marks: { label: 'Assessment & CAT Marks', view: 'academics', subTab: 'marks', desc: 'Internal evaluation components, CAT 1/2 marks, and scored weightage.' },
  exams: { label: 'Exam Schedules', view: 'academics', subTab: 'exams', desc: 'Official examination schedules with dates, timings, and campus venue allotment.' },
  faculty: { label: 'Faculty Directory', view: 'academics', subTab: 'faculty', desc: 'Assigned course faculty, cabin numbers, designations, and student proctor details.' },
  courses: { label: 'Enrolled Courses & Study Materials', view: 'academics', subTab: 'courses', desc: 'Current enrolled course syllabus, credits, course types, and study resources.' },
  grades: { label: 'Semester Grade History', view: 'academics', subTab: 'grades', desc: 'Semester-by-semester GPA standings, course grades (S/A/B/C/D/E/F), and cumulative CGPA.' },
  cgpaPredictor: { label: 'Interactive CGPA Predictor', view: 'academics', subTab: 'grades', desc: 'Simulate potential course grades and project cumulative graduation CGPA targets.' },
  attendancePredictor: { label: 'Attendance Safe-Miss Predictor', view: 'academics', subTab: 'predictor', desc: 'Predictive calculator for attendance safety margins and recovery classes.' },
  hostel: { label: 'Hostel, Mess & Laundry Hub', view: 'hostel', desc: 'Daily mess meal menus, hostel laundry schedules across blocks, and leave requests.' },
  od: { label: 'On-Duty (OD) Hours Tracker', view: 'academics', subTab: 'attendance', desc: 'Approved, pending, and total OD duty leave hours extracted from VTOP.' },
  calendar: { label: 'Semester Academic Calendar', view: 'academics', subTab: 'timetable', desc: 'Instructional working days, university holidays, and examination milestones.' },
  assignments: { label: 'Digital Assignments (DA)', view: 'assignments', desc: 'DA continuous assessment tasks integrated with LMS & Teams verification.' },
  fees: { label: 'Fee Invoices & Receipts', view: 'fees', desc: 'Tuition and hostel fee receipts with official transaction serial numbers and balances.' },
  placements: { label: 'Placement Eligibility & Drives', view: 'placements', desc: 'University placement drive listings, eligibility criteria, and CTC tiers.' },
  aiTasks: { label: 'AI Adaptive Study Tasks', view: 'ai-planner', desc: 'Intelligent personalized study sprints generated based on attendance and test performance.' },
  dsa: { label: 'LeetCode & DSA Tracker', view: 'placements', desc: 'Algorithmic problem-solving metrics, contest ratings, and company readiness simulations.' },
};

export const FeatureAvailabilityModal: React.FC<FeatureAvailabilityModalProps> = ({
  isOpen,
  onClose,
  onNavigateTo,
}) => {
  const [features, setFeatures] = useState<FeatureAvailabilityMap>({});
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'available' | 'unavailable'>('all');

  const loadFeatures = async () => {
    setLoading(true);
    try {
      const data = await CampusAPI.getFeatureAvailability();
      setFeatures(data || {});
    } catch (err) {
      console.error('[FeatureAvailability] Failed to fetch:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadFeatures();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const featureKeys = Object.keys(features).length > 0 ? Object.keys(features) : Object.keys(FEATURE_NAMES);

  const featureList = featureKeys.map((key) => {
    const raw = features[key];
    const meta = FEATURE_NAMES[key] || {
      label: key.charAt(0).toUpperCase() + key.slice(1),
      view: 'dashboard',
      desc: 'System integrated capability.',
    };
    const isAvailable = raw ? raw.available : true;
    const source = raw?.source || (key === 'hostel' ? 'vtop & unmessify' : 'vtop');
    const count = raw?.count ?? 0;
    const status = raw?.status || (isAvailable ? 'ok' : 'unavailable');
    const message = raw?.message || meta.desc;

    return {
      key,
      ...meta,
      isAvailable,
      source,
      count,
      status,
      message,
    };
  });

  const filteredList = featureList.filter((item) => {
    if (filter === 'available' && !item.isAvailable) return false;
    if (filter === 'unavailable' && item.isAvailable) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      return (
        item.label.toLowerCase().includes(q) ||
        item.desc.toLowerCase().includes(q) ||
        (item.source || '').toLowerCase().includes(q)
      );
    }
    return true;
  });

  const availableCount = featureList.filter((f) => f.isAvailable).length;

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        backdropFilter: 'blur(4px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="card"
        style={{
          width: '100%',
          maxWidth: '820px',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: 'var(--card-bg, #1e293b)',
          border: '1px solid var(--border-color, #334155)',
          borderRadius: '16px',
          boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.4)',
          overflow: 'hidden',
          padding: 0,
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '20px 24px',
            borderBottom: '1px solid var(--border-color, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            backgroundColor: 'var(--card-header-bg, rgba(255, 255, 255, 0.02))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                backgroundColor: 'rgba(59, 130, 246, 0.15)',
                color: '#3b82f6',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Layers size={22} />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 600 }}>Feature & Data Availability</h2>
                <span
                  style={{
                    backgroundColor: 'rgba(16, 185, 129, 0.15)',
                    color: '#10b981',
                    fontSize: '0.75rem',
                    padding: '2px 8px',
                    borderRadius: '12px',
                    fontWeight: 600,
                  }}
                >
                  {availableCount} / {featureList.length} Active
                </span>
              </div>
              <p style={{ margin: '4px 0 0', fontSize: '0.825rem', color: 'var(--text-muted, #94a3b8)' }}>
                Real-time operational status, data pipeline sources, and sync availability across all modules.
              </p>
            </div>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <button
              className="btn btn-ghost btn-icon"
              onClick={loadFeatures}
              disabled={loading}
              title="Refresh availability statuses"
              style={{ padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
            >
              <RefreshCw size={18} className={loading ? 'animate-spin' : ''} />
            </button>
            <button
              className="btn btn-ghost btn-icon"
              onClick={onClose}
              title="Close modal"
              style={{ padding: '8px', borderRadius: '8px', cursor: 'pointer' }}
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Toolbar: Search and Filter */}
        <div
          style={{
            padding: '12px 24px',
            borderBottom: '1px solid var(--border-color, #334155)',
            display: 'flex',
            gap: '12px',
            alignItems: 'center',
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              position: 'relative',
              flex: '1 1 200px',
              minWidth: '180px',
            }}
          >
            <Search
              size={15}
              style={{
                position: 'absolute',
                left: '10px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: 'var(--text-muted, #94a3b8)',
              }}
            />
            <input
              type="text"
              placeholder="Search features, modules, sources..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              style={{
                width: '100%',
                padding: '7px 12px 7px 32px',
                borderRadius: '8px',
                border: '1px solid var(--border-color, #334155)',
                backgroundColor: 'var(--input-bg, rgba(0,0,0,0.2))',
                color: 'inherit',
                fontSize: '0.85rem',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '6px' }}>
            <button
              className={`btn btn-sm ${filter === 'all' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter('all')}
              style={{ fontSize: '0.75rem', padding: '4px 10px' }}
            >
              All ({featureList.length})
            </button>
            <button
              className={`btn btn-sm ${filter === 'available' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter('available')}
              style={{ fontSize: '0.75rem', padding: '4px 10px', color: filter === 'available' ? '#fff' : '#10b981' }}
            >
              Available ({availableCount})
            </button>
            <button
              className={`btn btn-sm ${filter === 'unavailable' ? 'btn-primary' : 'btn-ghost'}`}
              onClick={() => setFilter('unavailable')}
              style={{ fontSize: '0.75rem', padding: '4px 10px', color: filter === 'unavailable' ? '#fff' : '#f59e0b' }}
            >
              Pending / Unsynced ({featureList.length - availableCount})
            </button>
          </div>
        </div>

        {/* List of Features */}
        <div
          style={{
            flex: 1,
            overflowY: 'auto',
            padding: '16px 24px',
            display: 'flex',
            flexDirection: 'column',
            gap: '10px',
          }}
        >
          {filteredList.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              No matching features found.
            </div>
          ) : (
            filteredList.map((item) => (
              <div
                key={item.key}
                style={{
                  padding: '14px 16px',
                  borderRadius: '12px',
                  border: '1px solid var(--border-color, #334155)',
                  backgroundColor: 'var(--item-bg, rgba(255, 255, 255, 0.02))',
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: '16px',
                  transition: 'background-color 0.2s',
                }}
              >
                <div style={{ display: 'flex', gap: '12px', flex: 1 }}>
                  <div style={{ marginTop: '2px' }}>
                    {item.isAvailable ? (
                      <CheckCircle2 size={18} color="#10b981" />
                    ) : item.source ? (
                      <AlertCircle size={18} color="#f59e0b" />
                    ) : (
                      <HelpCircle size={18} color="#94a3b8" />
                    )}
                  </div>
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span style={{ fontWeight: 600, fontSize: '0.925rem' }}>{item.label}</span>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 500,
                          padding: '1px 6px',
                          borderRadius: '6px',
                          backgroundColor: item.isAvailable
                            ? 'rgba(16, 185, 129, 0.15)'
                            : 'rgba(245, 158, 11, 0.15)',
                          color: item.isAvailable ? '#10b981' : '#f59e0b',
                        }}
                      >
                        {item.isAvailable ? 'Available' : 'Unsynced'}
                      </span>
                      {item.source && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '1px 6px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(59, 130, 246, 0.12)',
                            color: '#60a5fa',
                            display: 'flex',
                            alignItems: 'center',
                            gap: '4px',
                          }}
                        >
                          <Database size={10} />
                          {item.source.toUpperCase()}
                        </span>
                      )}
                      {item.count > 0 && (
                        <span
                          style={{
                            fontSize: '0.7rem',
                            padding: '1px 6px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(255, 255, 255, 0.08)',
                            color: 'var(--text-muted, #94a3b8)',
                          }}
                        >
                          {item.count} items
                        </span>
                      )}
                    </div>
                    <p style={{ margin: '4px 0 0', fontSize: '0.8rem', color: 'var(--text-muted, #94a3b8)', lineHeight: 1.4 }}>
                      {item.message}
                    </p>
                  </div>
                </div>

                {onNavigateTo && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => {
                      onClose();
                      onNavigateTo(item.view, item.subTab);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      fontSize: '0.75rem',
                      whiteSpace: 'nowrap',
                      color: '#3b82f6',
                      padding: '4px 8px',
                    }}
                  >
                    <span>Open</span>
                    <ExternalLink size={12} />
                  </button>
                )}
              </div>
            ))
          )}
        </div>

        {/* Footer info */}
        <div
          style={{
            padding: '12px 24px',
            borderTop: '1px solid var(--border-color, #334155)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            fontSize: '0.75rem',
            color: 'var(--text-muted, #94a3b8)',
            backgroundColor: 'var(--card-header-bg, rgba(255, 255, 255, 0.01))',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
            <ShieldCheck size={14} color="#10b981" />
            <span>CampusOS Update 1.1 Architecture &bull; CampusOS Engine</span>
          </div>
          <button className="btn btn-secondary btn-sm" onClick={onClose}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
