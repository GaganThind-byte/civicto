import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildSlaDeadline,
  deriveTicketStatus,
  evaluateSlaStatus,
  getRecommendedAssignment,
  urgencyWithCommunitySupport,
  urgencySlaMinutes,
  type ComplaintUrgency,
} from './complaint-workflow.ts';

test('getRecommendedAssignment routes categories to correct teams', () => {
  assert.equal(getRecommendedAssignment('Plumbing'), 'Plumbing Team');
  assert.equal(getRecommendedAssignment('Electrical'), 'Electrical Team');
  assert.equal(getRecommendedAssignment('Unknown'), 'General Service Desk');
});

test('buildSlaDeadline creates correct urgency deadlines', () => {
  const createdAt = new Date('2026-01-01T00:00:00Z');
  const criticalDeadline = buildSlaDeadline(createdAt, 'CRITICAL');
  const expectedMinutes = urgencySlaMinutes.CRITICAL * 60 * 1000;

  assert.equal(criticalDeadline.getTime(), createdAt.getTime() + expectedMinutes);
});

test('evaluateSlaStatus escalates overdue critical tickets', () => {
  const createdAt = new Date(Date.now() - 1000 * 60 * 60 * 3);
  const result = evaluateSlaStatus(createdAt, 'CRITICAL' as ComplaintUrgency, 'ASSIGNED');

  assert.equal(result.breached, true);
  assert.equal(result.nextStatus, 'ESCALATED');
});

test('deriveTicketStatus keeps healthy tickets in place', () => {
  const now = new Date();
  const result = deriveTicketStatus('ASSIGNED', 'MEDIUM', new Date(now.getTime() - 1000 * 60 * 5));

  assert.equal(result.status, 'ASSIGNED');
});

test('community support raises urgency every three votes without exceeding critical', () => {
  assert.equal(urgencyWithCommunitySupport('LOW', 2), 'LOW');
  assert.equal(urgencyWithCommunitySupport('LOW', 3), 'MEDIUM');
  assert.equal(urgencyWithCommunitySupport('HIGH', 3), 'CRITICAL');
  assert.equal(urgencyWithCommunitySupport('CRITICAL', 30), 'CRITICAL');
});
