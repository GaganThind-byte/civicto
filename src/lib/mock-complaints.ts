import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import path from 'path';
import { urgencyWithCommunitySupport } from './complaint-workflow';

export type ComplaintStatus =
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

export type ComplaintRecord = {
  id: string;
  ticketNumber: string;
  title: string;
  description: string;
  category: string;
  status: ComplaintStatus;
  urgency: ComplaintUrgency;
  location: string;
  residentId?: string;
  photoBeforeUrl?: string;
  photoAfterUrl?: string;
  dedupGroupId?: string;
  baseUrgency?: ComplaintUrgency;
  duplicateReports?: number;
  voterIds?: string[];
  voteCount?: number;
  votedByMe?: boolean;
  aiVerificationStatus?: string;
  aiVerificationNotes?: string;
  createdAt: string;
  updatedAt: string;
};

const defaultComplaints: ComplaintRecord[] = [
  {
    id: '1',
    ticketNumber: 'C-1024',
    title: 'Water leakage under sink',
    description: 'Water is dripping continuously from the pipe under the kitchen sink.',
    category: 'Plumbing',
    status: 'ASSIGNED',
    urgency: 'HIGH',
    location: 'Tower B / Flat 402',
    photoBeforeUrl: '/uploads/demo-before.jpg',
    createdAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 45).toISOString(),
  },
  {
    id: '2',
    ticketNumber: 'C-1029',
    title: 'Lift not working',
    description: 'The lift stopped between floors and residents are stuck.',
    category: 'Lift-Elevator',
    status: 'IN_PROGRESS',
    urgency: 'CRITICAL',
    location: 'Tower A / Ground Floor',
    createdAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 90).toISOString(),
  },
  {
    id: '3',
    ticketNumber: 'C-1038',
    title: 'Streetlight failure',
    description: 'The main gate streetlight is not working after sunset.',
    category: 'Electrical',
    status: 'HUMAN_TRIAGE_QUEUE',
    urgency: 'MEDIUM',
    location: 'Main Gate',
    createdAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
    updatedAt: new Date(Date.now() - 1000 * 60 * 140).toISOString(),
  },
];

const dataDir = path.join(process.cwd(), 'data');
const complaintsFile = path.join(dataDir, 'complaints.json');

function ensureStorage() {
  if (!existsSync(dataDir)) {
    mkdirSync(dataDir, { recursive: true });
  }

  if (!existsSync(complaintsFile)) {
    writeFileSync(complaintsFile, JSON.stringify(defaultComplaints, null, 2), 'utf8');
  }
}

export function getStoredComplaints(): ComplaintRecord[] {
  ensureStorage();
  const raw = readFileSync(complaintsFile, 'utf8');
  const parsed = JSON.parse(raw) as ComplaintRecord[];
  return Array.isArray(parsed) ? parsed : defaultComplaints;
}

export function saveComplaints(complaints: ComplaintRecord[]) {
  ensureStorage();
  writeFileSync(complaintsFile, JSON.stringify(complaints, null, 2), 'utf8');
}

export async function listComplaints(): Promise<ComplaintRecord[]> {
  return getStoredComplaints();
}

export async function getComplaintById(id: string): Promise<ComplaintRecord | undefined> {
  return getStoredComplaints().find((complaint) => complaint.id === id);
}

export async function addComplaint(input: {
  title: string;
  description: string;
  category: string;
  location: string;
  urgency?: ComplaintUrgency;
  photoBeforeUrl?: string;
  photoAfterUrl?: string;
  residentId?: string;
  dedupGroupId?: string;
  status?: ComplaintStatus;
}): Promise<ComplaintRecord> {
  const complaints = getStoredComplaints();
  const nextIndex = complaints.length + 1;
  const date = new Date().toISOString();
  const complaint: ComplaintRecord = {
    id: String(Date.now()),
    ticketNumber: `C-${1000 + nextIndex}`,
    title: input.title,
    description: input.description,
    category: input.category,
    status: input.status ?? 'SUBMITTED',
    urgency: input.urgency ?? 'MEDIUM',
    baseUrgency: input.urgency ?? 'MEDIUM',
    location: input.location,
    residentId: input.residentId,
    photoBeforeUrl: input.photoBeforeUrl,
    photoAfterUrl: input.photoAfterUrl,
    dedupGroupId: input.dedupGroupId,
    createdAt: date,
    updatedAt: date,
  };

  complaints.unshift(complaint);
  saveComplaints(complaints);
  return complaint;
}

export async function updateComplaintStatus(
  id: string,
  status: ComplaintStatus,
): Promise<ComplaintRecord | undefined> {
  const complaints = getStoredComplaints();
  const complaint = complaints.find((item) => item.id === id);

  if (!complaint) {
    return undefined;
  }

  complaint.status = status;
  complaint.updatedAt = new Date().toISOString();
  saveComplaints(complaints);
  return complaint;
}

export async function escalateComplaintIfActive(id: string): Promise<ComplaintRecord | undefined> {
  const complaints = getStoredComplaints();
  const complaint = complaints.find((item) => item.id === id);

  if (!complaint || ['ESCALATED', 'RESOLVED', 'VERIFIED', 'CLOSED'].includes(complaint.status)) {
    return undefined;
  }

  complaint.status = 'ESCALATED';
  complaint.updatedAt = new Date().toISOString();
  saveComplaints(complaints);
  return complaint;
}

export async function updateComplaintPhotoAfter(
  id: string,
  photoAfterUrl: string,
): Promise<ComplaintRecord | undefined> {
  const complaints = getStoredComplaints();
  const complaint = complaints.find((item) => item.id === id);

  if (!complaint) {
    return undefined;
  }

  complaint.photoAfterUrl = photoAfterUrl;
  complaint.updatedAt = new Date().toISOString();
  saveComplaints(complaints);
  return complaint;
}

export async function addDuplicateReport(id: string): Promise<ComplaintRecord | undefined> {
  const complaints = getStoredComplaints();
  const complaint = complaints.find((item) => item.id === id);
  if (!complaint) return undefined;

  complaint.duplicateReports = (complaint.duplicateReports ?? 0) + 1;
  complaint.updatedAt = new Date().toISOString();
  saveComplaints(complaints);
  return complaint;
}

export async function upvoteComplaint(id: string, userId: string) {
  const complaints = getStoredComplaints();
  const complaint = complaints.find((item) => item.id === id);
  if (!complaint) return undefined;

  const voterIds = complaint.voterIds ?? [];
  if (!voterIds.includes(userId)) voterIds.push(userId);
  complaint.voterIds = voterIds;
  complaint.voteCount = voterIds.length;
  complaint.baseUrgency ??= complaint.urgency;
  complaint.urgency = urgencyWithCommunitySupport(complaint.baseUrgency, voterIds.length);
  complaint.updatedAt = new Date().toISOString();
  saveComplaints(complaints);
  return { voteCount: voterIds.length, urgency: complaint.urgency };
}

export async function saveRepairReview(
  id: string,
  input: { photoAfterUrl: string; approved: boolean; notes: string },
): Promise<ComplaintRecord | undefined> {
  const complaints = getStoredComplaints();
  const complaint = complaints.find((item) => item.id === id);
  if (!complaint || complaint.status !== 'IN_PROGRESS') return undefined;

  complaint.photoAfterUrl = input.photoAfterUrl;
  complaint.aiVerificationStatus = input.approved ? 'APPROVED' : 'REJECTED';
  complaint.aiVerificationNotes = input.notes;
  if (input.approved) complaint.status = 'RESOLVED';
  complaint.updatedAt = new Date().toISOString();
  saveComplaints(complaints);
  return complaint;
}
