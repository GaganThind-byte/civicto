import test from 'node:test';
import assert from 'node:assert/strict';
import { verifyComplaintResolution } from './verification.ts';

test('verifyComplaintResolution accepts confirmed issues with photo proof', () => {
  const result = verifyComplaintResolution({
    currentStatus: 'RESOLVED',
    residentConfirmedFix: true,
    hasPhotoEvidence: true,
    notes: 'Works perfectly now.',
  });

  assert.equal(result.verified, true);
  assert.equal(result.nextStatus, 'VERIFIED');
});

test('verifyComplaintResolution reopens complaints without confirmation', () => {
  const result = verifyComplaintResolution({
    currentStatus: 'RESOLVED',
    residentConfirmedFix: false,
    hasPhotoEvidence: true,
  });

  assert.equal(result.verified, false);
  assert.equal(result.nextStatus, 'REOPENED');
});

test('verifyComplaintResolution requires after-repair photo proof before final closure', () => {
  const result = verifyComplaintResolution({
    currentStatus: 'RESOLVED',
    residentConfirmedFix: true,
    hasPhotoEvidence: false,
  });

  assert.equal(result.verified, false);
  assert.equal(result.nextStatus, 'REOPENED');
  assert.match(result.reason, /After-repair photo evidence/i);
});
