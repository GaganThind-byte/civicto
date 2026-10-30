export type TicketStatus =
  | 'SUBMITTED'
  | 'HUMAN_TRIAGE_QUEUE'
  | 'ASSIGNED'
  | 'IN_PROGRESS'
  | 'BLOCKED'
  | 'RESOLVED'
  | 'VERIFIED'
  | 'CLOSED'
  | 'REOPENED'
  | 'ESCALATED';

export type ComplaintUrgency = 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

export type TransitionEvent = {
  from: TicketStatus;
  to: TicketStatus;
  trigger: string;
  notes?: string;
};

export const workflowTransitions: TransitionEvent[] = [
  { from: 'SUBMITTED', to: 'HUMAN_TRIAGE_QUEUE', trigger: 'low_confidence' },
  { from: 'SUBMITTED', to: 'ASSIGNED', trigger: 'ai_classified_and_routed' },
  { from: 'HUMAN_TRIAGE_QUEUE', to: 'ASSIGNED', trigger: 'manual_review_approved' },
  { from: 'ASSIGNED', to: 'IN_PROGRESS', trigger: 'worker_acknowledged' },
  { from: 'ASSIGNED', to: 'ESCALATED', trigger: 'sla_breach' },
  { from: 'IN_PROGRESS', to: 'BLOCKED', trigger: 'waiting_on_parts_or_approval' },
  { from: 'IN_PROGRESS', to: 'RESOLVED', trigger: 'work_complete' },
  { from: 'BLOCKED', to: 'IN_PROGRESS', trigger: 'issue_unblocked' },
  { from: 'RESOLVED', to: 'VERIFIED', trigger: 'reporter_confirms_fix' },
  { from: 'RESOLVED', to: 'REOPENED', trigger: 'reporter_disagrees' },
  { from: 'REOPENED', to: 'ASSIGNED', trigger: 'reassigned' },
  { from: 'VERIFIED', to: 'CLOSED', trigger: 'finalized' },
  { from: 'IN_PROGRESS', to: 'ESCALATED', trigger: 'escalation_required' },
];

export const statusLabels: Record<TicketStatus, string> = {
  SUBMITTED: 'Submitted',
  HUMAN_TRIAGE_QUEUE: 'Human Triage Queue',
  ASSIGNED: 'Assigned',
  IN_PROGRESS: 'In Progress',
  BLOCKED: 'Blocked',
  RESOLVED: 'Resolved',
  VERIFIED: 'Verified',
  CLOSED: 'Closed',
  REOPENED: 'Reopened',
  ESCALATED: 'Escalated',
};

export const urgencySlaMinutes: Record<ComplaintUrgency, number> = {
  LOW: 72 * 60,
  MEDIUM: 24 * 60,
  HIGH: 6 * 60,
  CRITICAL: 2 * 60,
};

export function getAllowedNextStatuses(currentStatus: TicketStatus): TicketStatus[] {
  return workflowTransitions
    .filter((transition) => transition.from === currentStatus)
    .map((transition) => transition.to);
}

export function canTransition(currentStatus: TicketStatus, nextStatus: TicketStatus) {
  return getAllowedNextStatuses(currentStatus).includes(nextStatus);
}

const urgencyOrder: ComplaintUrgency[] = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export function urgencyWithCommunitySupport(
  baseUrgency: ComplaintUrgency,
  voteCount: number,
): ComplaintUrgency {
  const baseIndex = urgencyOrder.indexOf(baseUrgency);
  const supportBoost = Math.floor(Math.max(0, voteCount) / 3);
  return urgencyOrder[Math.min(urgencyOrder.length - 1, baseIndex + supportBoost)];
}

export function buildSlaDeadline(createdAt: Date, urgency: ComplaintUrgency): Date {
  const minutes = urgencySlaMinutes[urgency];
  return new Date(createdAt.getTime() + minutes * 60 * 1000);
}

export type SlaCandidate = {
  id: string;
  status: string;
  urgency: ComplaintUrgency;
  createdAt: string;
};

const excludedSlaStatuses = new Set(['ESCALATED', 'RESOLVED', 'VERIFIED', 'CLOSED']);

export function findOverdueComplaints<T extends SlaCandidate>(
  complaints: T[],
  now = new Date(),
): T[] {
  return complaints.filter((complaint) => {
    if (excludedSlaStatuses.has(complaint.status)) return false;
    const deadline = buildSlaDeadline(new Date(complaint.createdAt), complaint.urgency);
    return deadline.getTime() < now.getTime();
  });
}

export const assignmentRules: Record<string, string> = {
  Plumbing: 'Plumbing Team',
  Electrical: 'Electrical Team',
  'Lift-Elevator': 'Lift Maintenance Team',
  Security: 'Security Desk',
  Civil: 'Civil Works Team',
  HVAC: 'HVAC Team',
  Housekeeping: 'Housekeeping Team',
  General: 'General Service Desk',
};

export function getRecommendedAssignment(category: string): string {
  return assignmentRules[category] ?? assignmentRules.General;
}

export function evaluateSlaStatus(
  createdAt: Date,
  urgency: ComplaintUrgency,
  status: TicketStatus,
): { breached: boolean; nextStatus: TicketStatus | null; reason?: string } {
  const deadline = buildSlaDeadline(createdAt, urgency);
  const now = new Date();
  const breached = now > deadline && !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(status);

  if (!breached) {
    return { breached: false, nextStatus: null };
  }

  return {
    breached: true,
    nextStatus: 'ESCALATED',
    reason: `SLA breach for ${urgency.toLowerCase()} urgency. Escalated to priority review.`,
  };
}

export function deriveTicketStatus(
  currentStatus: TicketStatus,
  urgency: ComplaintUrgency,
  createdAt: Date,
): { status: TicketStatus; reason?: string } {
  const slaCheck = evaluateSlaStatus(createdAt, urgency, currentStatus);

  if (slaCheck.nextStatus) {
    return {
      status: slaCheck.nextStatus,
      reason: slaCheck.reason,
    };
  }

  return { status: currentStatus };
}
