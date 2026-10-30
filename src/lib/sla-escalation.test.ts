import test from 'node:test';
import assert from 'node:assert/strict';
import { findOverdueComplaints } from './complaint-workflow.ts';

test('findOverdueComplaints returns active tickets past their urgency deadline', () => {
  const now = new Date('2026-10-09T12:00:00.000Z');
  const complaints = [
    { id: 'overdue', status: 'ASSIGNED', urgency: 'CRITICAL' as const, createdAt: '2026-10-09T09:00:00.000Z' },
    { id: 'on-time', status: 'ASSIGNED', urgency: 'CRITICAL' as const, createdAt: '2026-10-09T11:00:00.000Z' },
    { id: 'resolved', status: 'RESOLVED', urgency: 'CRITICAL' as const, createdAt: '2026-10-09T08:00:00.000Z' },
    { id: 'already-escalated', status: 'ESCALATED', urgency: 'CRITICAL' as const, createdAt: '2026-10-09T08:00:00.000Z' },
  ];

  assert.deepEqual(findOverdueComplaints(complaints, now).map((complaint) => complaint.id), ['overdue']);
});