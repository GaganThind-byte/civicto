export type VerificationRequest = {
  currentStatus: string;
  residentConfirmedFix: boolean;
  hasPhotoEvidence: boolean;
  afterPhotoUrl?: string;
  notes?: string;
};

export type VerificationOutcome = {
  verified: boolean;
  nextStatus: 'VERIFIED' | 'REOPENED';
  reason: string;
};

export function verifyComplaintResolution(input: VerificationRequest): VerificationOutcome {
  if (input.currentStatus !== 'RESOLVED') {
    return {
      verified: false,
      nextStatus: 'REOPENED',
      reason: 'The issue is not in the resolved state yet.',
    };
  }

  if (!input.residentConfirmedFix) {
    return {
      verified: false,
      nextStatus: 'REOPENED',
      reason: 'Resident has not confirmed the fix, so the complaint remains open.',
    };
  }

  const hasAfterPhotoEvidence = input.hasPhotoEvidence || Boolean(input.afterPhotoUrl);

  if (!hasAfterPhotoEvidence) {
    return {
      verified: false,
      nextStatus: 'REOPENED',
      reason: 'After-repair photo evidence is missing to confirm the repair before closure.',
    };
  }

  return {
    verified: true,
    nextStatus: 'VERIFIED',
    reason: input.notes ? `Fix verified by resident with note: ${input.notes}` : 'Fix verified by resident and accepted as complete.',
  };
}
