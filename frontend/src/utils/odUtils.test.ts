import test, { describe } from 'node:test';
import assert from 'node:assert';
import { computeUniccODFromAttendance } from './odUtils.ts';

describe('UniCC OD Extraction Algorithm', () => {
  test('extracts On Duty punch records accurately with correct Lab and Theory hours', () => {
    const attendanceData = [
      {
        courseCode: 'BCSE302L',
        courseTitle: 'Database Systems',
        slotName: 'F2+TF2',
        facultyName: 'RISHIKESHAN C A',
        viewLink: [
          { date: '05-Oct-2026', status: 'On Duty' },
          { date: '21-Sep-2026', status: 'Present' },
          { date: '02-Sep-2026', status: 'On Duty' },
        ],
      },
      {
        courseCode: 'BCSE302P',
        courseTitle: 'Database Systems Lab',
        slotName: 'L21+L22',
        facultyName: 'RISHIKESHAN C A',
        viewLink: [
          { date: '15-Sep-2026', status: 'On Duty' },
          { date: '08-Sep-2026', status: 'Present' },
        ],
      },
    ];

    const records = computeUniccODFromAttendance(attendanceData);
    assert.strictEqual(records.length, 3);

    // Theory records (1 hour)
    const theoryRecs = records.filter((r) => r.type === 'TH');
    assert.strictEqual(theoryRecs.length, 2);
    assert.strictEqual(theoryRecs[0].hours, 1);
    assert.strictEqual(theoryRecs[0].subjectCode, 'BCSE302L');

    // Lab records (2 hours)
    const labRecs = records.filter((r) => r.type === 'LAB');
    assert.strictEqual(labRecs.length, 1);
    assert.strictEqual(labRecs[0].hours, 2);
    assert.strictEqual(labRecs[0].subjectCode, 'BCSE302P');

    // Total hours: 1 + 1 + 2 = 4
    const totalHours = records.reduce((sum, r) => sum + r.hours, 0);
    assert.strictEqual(totalHours, 4);
  });

  test('deduplicates duplicate punches on the same date and slot', () => {
    const attendanceData = [
      {
        courseCode: 'BCSE302L',
        courseTitle: 'Database Systems',
        slotName: 'F2+TF2',
        viewLink: [
          { date: '05-Oct-2026', status: 'On Duty' },
          { date: '05-Oct-2026', status: 'On Duty' },
        ],
      },
    ];

    const records = computeUniccODFromAttendance(attendanceData);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].hours, 1);
  });

  test('returns empty array when no On Duty classes exist', () => {
    const attendanceData = [
      {
        courseCode: 'BCSE302L',
        courseTitle: 'Database Systems',
        slotName: 'F2+TF2',
        viewLink: [
          { date: '05-Oct-2026', status: 'Present' },
          { date: '21-Sep-2026', status: 'Absent' },
        ],
      },
    ];

    const records = computeUniccODFromAttendance(attendanceData);
    assert.strictEqual(records.length, 0);
  });

  test('courses with P code but non-L slots are strictly counted as 1 hour', () => {
    const attendanceData = [
      {
        courseCode: 'BSTS301P',
        courseTitle: 'Advanced Competitive Coding - I',
        slotName: 'D2+TD2',
        viewLink: [
          { date: '05-Oct-2026', status: 'On Duty' },
        ],
      },
    ];

    const records = computeUniccODFromAttendance(attendanceData);
    assert.strictEqual(records.length, 1);
    assert.strictEqual(records[0].hours, 1);
    assert.strictEqual(records[0].type, 'TH');
  });
});
