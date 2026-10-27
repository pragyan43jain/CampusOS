import test from 'node:test';
import assert from 'node:assert/strict';
import { analyzeCalendar } from './calendarService.ts';

test('unknown calendar dates are not reported as holidays or working days', () => {
  const { result } = analyzeCalendar({ month: 'OCTOBER', year: 2026, days: [] });
  assert.equal(result.summary.working, 0);
  assert.equal(result.summary.holiday, 0);
  assert.equal(result.summary.other, 31);
});

test('calendar classifications follow fetched events', () => {
  const { result } = analyzeCalendar({ month: 'OCTOBER', year: 2026, days: [
    { date: 1, events: [{ type: 'Instructional Day', text: 'Instructional Day' }] },
    { date: 2, events: [{ type: 'Holiday', text: 'Holiday' }] },
  ] });
  assert.equal(result.summary.working, 1);
  assert.equal(result.summary.holiday, 1);
  assert.equal(result.summary.other, 29);
});


test('numeric months do not become years', () => {
  const { result } = analyzeCalendar({ month: 10, year: 2026, days: [] });
  assert.equal(result.year, 2026);
  assert.equal(result.days[0].weekday, 'Thu');
});

test('CAT II does not also match CAT I and term end exams are not holidays', () => {
  const { result, importantEvents } = analyzeCalendar({ month: 'OCTOBER 2026', days: [
    { date: 12, events: [{ type: 'Exam', text: 'CAT-II' }] },
    { date: 13, events: [{ type: 'Exam', text: 'Term End Examination' }] },
  ] });
  assert.deepEqual([...importantEvents.values()].map(event => event.event), ['CAT II']);
  assert.equal(result.summary.holiday, 0);
});
