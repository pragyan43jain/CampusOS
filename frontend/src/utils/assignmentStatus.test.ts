import test, { describe } from 'node:test';
import assert from 'node:assert/strict';
import { isAssignmentDone, isTeamsAssignment, getAssignmentStatusLabel } from './assignmentUtils.ts';

describe('Teams Assignment Status Verification', () => {
  test('identifies Microsoft Teams assignments accurately', () => {
    assert.equal(isTeamsAssignment({ source: 'Teams' }), true);
    assert.equal(isTeamsAssignment({ source: 'TEAMS' }), true);
    assert.equal(isTeamsAssignment({ sourceList: ['Teams', 'LMS'] }), true);
    assert.equal(isTeamsAssignment({ platformName: 'Microsoft Teams' }), true);
    assert.equal(isTeamsAssignment({ id: 'teams-12345' }), true);
    assert.equal(isTeamsAssignment({ teamsSubmissionState: 'submitted' }), true);
    assert.equal(isTeamsAssignment({ source: 'LMS', platformName: 'VIT LMS' }), false);
  });

  test('marks Teams assignment with submitted state as DONE and Turned in', () => {
    const item = {
      id: 'teams-882fb43a-5b59-461a-8a77-cf91dcafff6d',
      source: 'Teams',
      title: 'Digital Assignment 2',
      teamsSubmissionState: 'submitted',
      submissionStatus: 'submitted',
      submittedAt: '2026-10-05T03:15:39.6667521Z',
      status: 'DONE',
      isDone: true,
    };
    assert.equal(isAssignmentDone(item), true);
    assert.equal(getAssignmentStatusLabel(item), 'Turned in');
  });

  test('marks Teams assignment with returned state as DONE and Turned in', () => {
    const item = {
      id: 'teams-acbeabb6-e05f-4af9-89fe-81f26b9fd205',
      source: 'Teams',
      title: 'Lab sheet 5 & 6 Submission Link',
      teamsSubmissionState: 'returned',
      submittedAt: '2026-08-27T05:45:56.4184038Z',
      status: 'DONE',
    };
    assert.equal(isAssignmentDone(item), true);
    assert.equal(getAssignmentStatusLabel(item), 'Turned in');
  });

  test('marks Teams assignment with working state and no submission timestamp as PENDING', () => {
    const item = {
      id: 'teams-working-sample',
      source: 'Teams',
      title: 'Pending Lab Sheet',
      teamsSubmissionState: 'working',
      submissionStatus: 'working',
      submittedAt: null,
      status: 'PENDING',
      isDone: false,
    };
    assert.equal(isAssignmentDone(item), false);
    assert.equal(getAssignmentStatusLabel(item), 'Pending');
  });

  test('marks LMS assignment with Submitted as Submitted (not Turned in)', () => {
    const item = {
      id: 'lms-101',
      source: 'LMS',
      title: 'Moodle Quiz 1',
      status: 'Submitted',
      isDone: true,
    };
    assert.equal(isAssignmentDone(item), true);
    assert.equal(getAssignmentStatusLabel(item), 'Submitted');
  });

  test('marks LMS assignment with Pending as Pending', () => {
    const item = {
      id: 'lms-102',
      source: 'LMS',
      title: 'Moodle Assignment 2',
      status: 'Pending',
      isDone: false,
    };
    assert.equal(isAssignmentDone(item), false);
    assert.equal(getAssignmentStatusLabel(item), 'Pending');
  });
});
