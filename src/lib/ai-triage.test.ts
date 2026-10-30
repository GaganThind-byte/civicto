import test from 'node:test';
import assert from 'node:assert/strict';
import { triageComplaint } from './ai-triage.ts';

test('triageComplaint identifies plumbing leaks as high urgency', async () => {
  const result = await triageComplaint(
    'https://example.com/photo.jpg',
    'Water is leaking under the kitchen sink and there is standing water on the floor.'
  );

  assert.equal(result.category, 'plumbing');
  assert.equal(result.urgency, 'HIGH');
  assert.ok(result.confidence > 0.6);
});

test('triageComplaint identifies electrical issues as critical', async () => {
  const result = await triageComplaint(
    'https://example.com/electrical.jpg',
    'The main switchboard is sparking and the hallway lights are flickering.'
  );

  assert.equal(result.category, 'electrical');
  assert.equal(result.urgency, 'CRITICAL');
});

test('triageComplaint falls back to low urgency when there is little detail', async () => {
  const result = await triageComplaint('', '');

  assert.equal(result.category, 'housekeeping');
  assert.equal(result.urgency, 'LOW');
  assert.equal(result.is_nuisance_or_spam, false);
});
