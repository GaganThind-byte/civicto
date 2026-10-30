import test from 'node:test';
import assert from 'node:assert/strict';
import { findDuplicateComplaint } from './complaint-dedup.ts';

test('findDuplicateComplaint flags repeated water leak reports as duplicates', () => {
  const duplicate = findDuplicateComplaint(
    {
      title: 'Kitchen sink leak',
      description: 'Water is leaking under the sink again.',
      category: 'Plumbing',
      location: 'Tower B / Flat 402',
    },
    [
      {
        id: '1',
        title: 'Water leak under kitchen sink',
        description: 'Water is dripping from the pipe under the sink.',
        category: 'Plumbing',
        location: 'Tower B / Flat 402',
      },
    ],
  );

  assert.equal(duplicate.isDuplicate, true);
  assert.ok(duplicate.similarity >= 0.35);
});

test('findDuplicateComplaint does not flag unrelated issues as duplicates', () => {
  const duplicate = findDuplicateComplaint(
    {
      title: 'Lift door jam',
      description: 'The lift door closes slowly and jams on the third floor.',
      category: 'Lift-Elevator',
      location: 'Tower A',
    },
    [
      {
        id: '2',
        title: 'Streetlight failure',
        description: 'The main gate light is not working after sunset.',
        category: 'Electrical',
        location: 'Main Gate',
      },
    ],
  );

  assert.equal(duplicate.isDuplicate, false);
});
