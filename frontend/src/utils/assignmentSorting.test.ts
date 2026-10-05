import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { parseAssignmentDate } from './assignmentUtils.ts';

describe('Assignment Sorting & Date Parsing', () => {
  it('correctly parses ISO sortKey timestamps', () => {
    const a = { sortKey: '2026-10-05T23:59:00+05:30' };
    const ts = parseAssignmentDate(a);
    assert.ok(ts > 0);
    assert.equal(new Date(ts).getFullYear(), 2026);
  });

  it('ignores placeholder 9999 sortKey and falls back to dueDate', () => {
    const a = { sortKey: '9999-99-99T99:99:99', dueDate: '2026-10-04' };
    const ts = parseAssignmentDate(a);
    assert.ok(ts > 0);
    const d = new Date(ts);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 9); // October (0-indexed 9)
    assert.equal(d.getDate(), 4);
  });

  it('correctly parses DD-MM-YYYY dates', () => {
    const a = { dueDate: '25-09-2026' };
    const ts = parseAssignmentDate(a);
    assert.ok(ts > 0);
    const d = new Date(ts);
    assert.equal(d.getFullYear(), 2026);
    assert.equal(d.getMonth(), 8); // September (0-indexed 8)
    assert.equal(d.getDate(), 25);
  });

  it('gracefully handles missing, TBA, or continuous evaluation dates with 0', () => {
    assert.equal(parseAssignmentDate(null), 0);
    assert.equal(parseAssignmentDate({ dueDate: 'TBA' }), 0);
    assert.equal(parseAssignmentDate({ dueDate: 'Continuous Evaluation' }), 0);
    assert.equal(parseAssignmentDate({}), 0);
  });

  it('sorts assignments strictly in latest to oldest order', () => {
    const items = [
      { id: '1', title: 'Lab sheet 1 & 2', dueDate: '2026-07-22' },
      { id: '2', title: 'Digital Assignment 2', dueDate: '2026-10-05' },
      { id: '3', title: 'Expt 7b', dueDate: '2026-09-29' },
      { id: '4', title: 'Lab sheet 9 & 10', dueDate: '2026-10-04' },
      { id: '5', title: 'Module-3 Exercises', dueDate: '2026-08-07' },
      { id: '6', title: 'No Date Task', dueDate: 'TBA' },
    ];

    const sorted = [...items].sort((a, b) => {
      const tA = parseAssignmentDate(a);
      const tB = parseAssignmentDate(b);
      if (tA > 0 && tB === 0) return -1;
      if (tA === 0 && tB > 0) return 1;
      if (tB !== tA) return tB - tA;
      return a.title.localeCompare(b.title);
    });

    const titles = sorted.map((x) => x.title);
    assert.deepEqual(titles, [
      'Digital Assignment 2', // 2026-10-05
      'Lab sheet 9 & 10',     // 2026-10-04
      'Expt 7b',              // 2026-09-29
      'Module-3 Exercises',   // 2026-08-07
      'Lab sheet 1 & 2',      // 2026-07-22
      'No Date Task',         // TBA (last)
    ]);
  });
});
