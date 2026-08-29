import React, { useState } from 'react';
import {
  GraduationCap,
  BookOpen,
  ExternalLink,
  User,
  FlaskConical,
  Search,
  BookMarked,
} from 'lucide-react';
import { Course } from '../types';
import { getStudyMaterialUrl } from '../services/studyMaterialService';

interface AcademicsViewProps {
  courses: Course[];
}

export const AcademicsView: React.FC<AcademicsViewProps> = ({ courses }) => {
  const [selectedSemester, setSelectedSemester] = useState<string>('FALL2026');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('all');

  const semesters = [
    { id: 'FALL2026', label: 'Fall Semester 2026-27 (Active)', isCurrent: true },
    { id: 'WIN2025', label: 'Winter Semester 2025-26', isCurrent: false },
    { id: 'FALL2025', label: 'Fall Semester 2025-26', isCurrent: false },
  ];

  const semesterCourses = selectedSemester === 'FALL2026' ? courses : [];

  const filteredCourses = semesterCourses.filter((course) => {
    const matchesSearch =
      course.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      course.code.toLowerCase().includes(searchQuery.toLowerCase()) ||
      (course.faculty && course.faculty.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchesType =
      filterType === 'all' ||
      (filterType === 'theory' && (course.type === 'Theory' || !course.type)) ||
      (filterType === 'lab' && course.type === 'Lab') ||
      (filterType === 'embedded' && course.type === 'Embedded');

    return matchesSearch && matchesType;
  });

  const totalCredits = semesterCourses.reduce((sum, c) => sum + (c.credits || 0), 0);

  return (
    <div className="page-container">
      {/* Header Hero Section */}
      <div className="hero-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '16px' }}>
          <div>
            <div className="hero-eyebrow">
              <BookMarked size={13} />
              <span>ACADEMIC CURRICULUM</span>
              <span>•</span>
              <span style={{ color: 'var(--text-muted)' }}>
                {semesterCourses.length} Registered Courses • {totalCredits} Total Credits
              </span>
            </div>
            <h2 className="hero-heading">Academic Courses & Study Hub</h2>
            <p className="hero-desc">
              Course syllabus details, continuous assessment weightage, faculty directory, and direct access to curated study materials.
            </p>
          </div>

          {/* Semester Selector */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', minWidth: '240px' }}>
            <label style={{ fontSize: '0.74rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
              Academic Semester
            </label>
            <select
              value={selectedSemester}
              onChange={(e) => setSelectedSemester(e.target.value)}
              className="input-field"
              style={{ height: '40px' }}
            >
              {semesters.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Filter & Search Bar */}
      <div
        className="card"
        style={{
          padding: '14px 20px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flex: 1, minWidth: '240px' }}>
          <Search size={16} color="var(--text-muted)" />
          <input
            type="text"
            placeholder="Search by course code, title, or faculty..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="input-field"
            style={{ height: '38px', fontSize: '0.84rem' }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '0.78rem', fontWeight: 650, color: 'var(--text-muted)' }}>Type:</span>
          {(['all', 'theory', 'lab', 'embedded'] as const).map((t) => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={`btn btn-sm ${filterType === t ? 'btn-primary' : 'btn-secondary'}`}
              style={{ textTransform: 'capitalize' }}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Course Cards Grid */}
      {filteredCourses.length > 0 ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(360px, 1fr))', gap: '18px' }}>
          {filteredCourses.map((course) => {
            const att = course.attendance;
            const hasAtt = Boolean(
              att &&
              att.attended !== null &&
              att.attended !== undefined &&
              att.total !== null &&
              att.total !== undefined
            );
            const attPct = att?.percentage ?? (hasAtt && att && att.total ? Math.round(((att.attended || 0) / att.total) * 100) : null);
            const isCritical = attPct !== null && attPct < 75;
            const studyUrl = getStudyMaterialUrl({ code: course.code, title: course.title });

            return (
              <div
                key={course.code || course.id}
                className="card"
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  justifyContent: 'space-between',
                  gap: '16px',
                }}
              >
                <div>
                  {/* Top Bar */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '10px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      <span
                        style={{
                          fontFamily: 'var(--font-mono)',
                          fontSize: '0.82rem',
                          fontWeight: 800,
                          color: 'var(--accent-cyan)',
                          background: 'rgba(45, 231, 211, 0.08)',
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-xs)',
                          border: '1px solid rgba(45, 231, 211, 0.2)',
                        }}
                      >
                        {course.code}
                      </span>
                      {course.type && (
                        <span className="status-badge info" style={{ fontSize: '0.70rem' }}>
                          {course.type === 'Lab' ? <FlaskConical size={11} /> : <BookOpen size={11} />}
                          <span>{course.type}</span>
                        </span>
                      )}
                    </div>

                    <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {course.credits} Credits
                    </span>
                  </div>

                  {/* Course Title */}
                  <h3 style={{ fontSize: '1.08rem', fontWeight: 700, color: 'var(--text-primary)', marginTop: '10px' }}>
                    {course.title}
                  </h3>

                  {/* Metadata */}
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '8px', fontSize: '0.80rem', color: 'var(--text-secondary)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                      <User size={13} color="var(--text-muted)" />
                      <span>{course.faculty || 'Instructor unassigned'}</span>
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                      <span>Slot: <b style={{ fontFamily: 'var(--font-mono)' }}>{course.slot || 'N/A'}</b></span>
                      <span>Venue: {course.venue || 'Academic Block'}</span>
                    </div>
                  </div>
                </div>

                {/* Bottom Stats & Actions */}
                <div style={{ borderTop: '1px solid var(--border-secondary)', paddingTop: '14px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
                  {/* Attendance Bar */}
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '6px', fontSize: '0.78rem' }}>
                      <span style={{ color: 'var(--text-muted)' }}>
                        Attendance: <b>{hasAtt && att ? `${att.attended} / ${att.total} classes` : 'Not recorded'}</b>
                      </span>
                      <span className={`status-badge ${isCritical ? 'critical' : 'safe'}`} style={{ padding: '1px 7px', fontSize: '0.72rem' }}>
                        {attPct !== null ? `${attPct}%` : 'N/A'}
                      </span>
                    </div>

                    {attPct !== null && (
                      <div className="progress-track">
                        <div
                          className={`progress-fill ${isCritical ? 'crimson' : 'emerald'}`}
                          style={{ width: `${Math.min(100, Math.max(0, attPct))}%` }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Study Material Action */}
                  <a
                    href={studyUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="btn btn-secondary btn-sm"
                    style={{ width: '100%', gap: '6px' }}
                  >
                    <BookOpen size={14} />
                    <span>Study Material</span>
                    <ExternalLink size={12} style={{ opacity: 0.7 }} />
                  </a>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="empty-state-card card">
          <div className="empty-state-icon-box">
            <GraduationCap size={24} />
          </div>
          <h4 className="empty-state-title">
            {selectedSemester === 'FALL2026' ? 'No Matching Courses Found' : 'No Historic Records for Selected Semester'}
          </h4>
          <p className="empty-state-desc">
            {selectedSemester === 'FALL2026'
              ? 'Try adjusting your search query or filter options above.'
              : 'Previous semester historical course records are archived once the semester grade card is sealed.'}
          </p>
        </div>
      )}
    </div>
  );
};

export default AcademicsView;
