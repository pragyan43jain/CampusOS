import React from 'react';
import { Course } from '../types';

interface AcademicsViewProps {
  courses: Course[];
}

export const AcademicsView: React.FC<AcademicsViewProps> = ({ courses }) => {
  return (
    <div className="page-content">
      <div className="section-header">
        <div>
          <h2 style={{ fontSize: '1.25rem', fontWeight: 700 }}>Semester 4 Course Registrations</h2>
          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
            Direct synchronization from VTOP with marks, thresholds, and FAT grade requirements.
          </p>
        </div>
      </div>

      <div className="courses-grid">
        {courses.map((course) => {
          const { attendance } = course;
          const isCritical = attendance.isCritical;

          return (
            <div key={course.id} className="course-card">
              <div className="course-header">
                <div>
                  <span className="course-code-tag">{course.code}</span>
                  <h3 className="course-title">{course.title}</h3>
                  <span className="course-faculty">👨‍🏫 {course.faculty}</span>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)' }}>Slot: <b>{course.slot}</b></span>
                  <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', marginTop: '2px' }}>
                    {course.credits} Credits • {course.type}
                  </div>
                </div>
              </div>

              {/* Attendance Bar */}
              <div style={{ background: 'rgba(0,0,0,0.2)', padding: '14px 16px', borderRadius: 'var(--radius-md)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
                  <span style={{ fontSize: '0.84rem', color: 'var(--text-secondary)' }}>
                    VTOP Attendance: <b>{attendance.attended} / {attendance.total} classes</b>
                  </span>
                  <span className={`attendance-percentage-pill ${isCritical ? 'critical' : attendance.percentage < 80 ? 'warning' : 'safe'}`}>
                    {attendance.percentage}%
                  </span>
                </div>

                <div className="progress-track" style={{ marginBottom: '10px' }}>
                  <div
                    className={`progress-fill ${isCritical ? 'crimson' : attendance.percentage < 80 ? 'amber' : 'emerald'}`}
                    style={{ width: `${attendance.percentage}%` }}
                  />
                </div>

                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  {isCritical ? (
                    <span style={{ fontSize: '0.8rem', color: 'var(--danger-crimson)', fontWeight: 700 }}>
                      ⚠ Shortage Below 75%: Attend next {attendance.needToAttend} classes to reach 75%
                    </span>
                  ) : (
                    <span style={{ fontSize: '0.8rem', color: 'var(--success-emerald)', fontWeight: 600 }}>
                      ✓ Safe to miss: {attendance.safeToMiss} {attendance.safeToMiss === 1 ? 'class' : 'classes'}
                    </span>
                  )}
                </div>
              </div>

              {/* Marks & Assessment Breakdown */}
              {course.marks && (
                <div>
                  <span style={{ fontSize: '0.82rem', fontWeight: 600, color: 'var(--text-secondary)' }}>
                    Continuous Assessments & Projections
                  </span>
                  <table className="marks-breakdown-table">
                    <thead>
                      <tr>
                        <th>Assessment</th>
                        <th>Scored</th>
                        <th>Max</th>
                        <th>Weightage</th>
                      </tr>
                    </thead>
                    <tbody>
                      {course.marks.cat1 && (
                        <tr>
                          <td>CAT-1</td>
                          <td><b>{course.marks.cat1.scored}</b></td>
                          <td>{course.marks.cat1.max}</td>
                          <td>{course.marks.cat1.weightage}%</td>
                        </tr>
                      )}
                      {course.marks.cat2 && (
                        <tr>
                          <td>CAT-2</td>
                          <td><b>{course.marks.cat2.scored}</b></td>
                          <td>{course.marks.cat2.max}</td>
                          <td>{course.marks.cat2.weightage}%</td>
                        </tr>
                      )}
                      {course.marks.da1 && (
                        <tr>
                          <td>Digital Assignment 1</td>
                          <td><b>{course.marks.da1.scored}</b></td>
                          <td>{course.marks.da1.max}</td>
                          <td>{course.marks.da1.weightage}%</td>
                        </tr>
                      )}
                      {course.marks.quiz && (
                        <tr>
                          <td>Online Quiz</td>
                          <td><b>{course.marks.quiz.scored}</b></td>
                          <td>{course.marks.quiz.max}</td>
                          <td>{course.marks.quiz.weightage}%</td>
                        </tr>
                      )}
                    </tbody>
                  </table>

                  {course.marks.fatProjected && (
                    <div style={{ marginTop: '10px', fontSize: '0.78rem', color: 'var(--text-muted)', background: 'rgba(255,255,255,0.03)', padding: '6px 10px', borderRadius: '6px' }}>
                      Target for <b>S Grade</b>: Scored internal + FAT ≥ {course.marks.fatProjected.minNeededForS}%
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};
