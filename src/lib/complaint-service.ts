import { prisma } from '@/lib/prisma';
import {
  addComplaint as addMockComplaint,
  escalateComplaintIfActive as escalateMockComplaintIfActive,
  listComplaints as listMockComplaints,
  updateComplaintStatus as updateMockComplaintStatus,
  addDuplicateReport as addMockDuplicateReport,
  upvoteComplaint as upvoteMockComplaint,
  saveRepairReview as saveMockRepairReview,
  type ComplaintStatus,
  type ComplaintUrgency,
} from '@/lib/mock-complaints';
import { urgencyWithCommunitySupport } from '@/lib/complaint-workflow';

const databaseEnabled = Boolean(process.env.DATABASE_URL && !process.env.DATABASE_URL.includes('your_'));

type ComplaintRow = {
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
  duplicateReports: number;
  voteCount: number;
  votedByMe: boolean;
  aiVerificationStatus?: string;
  aiVerificationNotes?: string;
  createdAt: string;
  updatedAt: string;
};

function normalizeTicket(ticket: any): ComplaintRow {
  return {
    id: ticket.id,
    ticketNumber: ticket.ticketNumber,
    title: ticket.title ?? 'Untitled complaint',
    description: ticket.description,
    category: ticket.category ?? 'General',
    status: ticket.status,
    urgency: ticket.urgency,
    location: ticket.location ?? 'General',
    residentId: ticket.residentId ?? undefined,
    photoBeforeUrl: ticket.photoBeforeUrl ?? undefined,
    photoAfterUrl: ticket.photoAfterUrl ?? undefined,
    dedupGroupId: ticket.dedupGroupId ?? undefined,
    baseUrgency: ticket.baseUrgency ?? undefined,
    duplicateReports: ticket.duplicateReports ?? 0,
    voteCount: ticket.votes?.length ?? ticket.voteCount ?? 0,
    votedByMe: Boolean(ticket.votes?.some((vote: { userId: string }) => vote.userId === ticket.viewerId)
      ?? ticket.votedByMe),
    aiVerificationStatus: ticket.aiVerificationStatus ?? undefined,
    aiVerificationNotes: ticket.aiVerificationNotes ?? undefined,
    createdAt: ticket.createdAt ? new Date(ticket.createdAt).toISOString() : new Date().toISOString(),
    updatedAt: ticket.updatedAt ? new Date(ticket.updatedAt).toISOString() : new Date().toISOString(),
  };
}

async function ensureDefaultSeed(): Promise<{ propertyId: string; unitId: string }> {
  const property = await prisma.property.upsert({
    where: { id: 'default-property' },
    update: {},
    create: {
      id: 'default-property',
      name: 'Default Society',
      address: 'Local Demo',
    },
  });

  const unit = await prisma.unit.upsert({
    where: { id: 'default-unit' },
    update: {},
    create: {
      id: 'default-unit',
      propertyId: property.id,
      name: 'General Unit',
    },
  });

  return { propertyId: property.id, unitId: unit.id };
}

export async function listComplaints(viewerId?: string) {
  if (!databaseEnabled) {
    const complaints = await listMockComplaints();
    return complaints.map((complaint) => ({
      ...complaint,
      duplicateReports: complaint.duplicateReports ?? 0,
      voteCount: complaint.voterIds?.length ?? complaint.voteCount ?? 0,
      votedByMe: Boolean(viewerId && complaint.voterIds?.includes(viewerId)),
    }));
  }

  const tickets = await prisma.ticket.findMany({
    orderBy: { createdAt: 'desc' },
    include: { votes: { select: { userId: true } } },
  });

  return tickets.map((ticket) => normalizeTicket({ ...ticket, viewerId }));
}

export async function getComplaintById(id: string) {
  if (!databaseEnabled) {
    const complaint = (await import('@/lib/mock-complaints')).getComplaintById(id);
    return complaint;
  }

  const ticket = await prisma.ticket.findUnique({ where: { id } });
  return ticket ? normalizeTicket(ticket) : undefined;
}

export async function addComplaint(input: {
  title: string;
  description: string;
  category: string;
  location: string;
  urgency?: ComplaintUrgency;
  status?: ComplaintStatus;
  residentId?: string;
  photoBeforeUrl?: string;
  photoAfterUrl?: string;
  dedupGroupId?: string;
}) {
  if (!databaseEnabled) {
    return addMockComplaint(input);
  }

  const { propertyId, unitId } = await ensureDefaultSeed();
  const ticket = await prisma.ticket.create({
    data: {
      title: input.title,
      location: input.location,
      ticketNumber: `C-${Date.now().toString().slice(-4)}`,
      propertyId,
      unitId,
      description: input.description,
      category: input.category,
      urgency: (input.urgency ?? 'MEDIUM') as any,
      baseUrgency: input.urgency ?? 'MEDIUM',
      status: (input.status ?? 'SUBMITTED') as any,
      residentId: input.residentId,
      dedupGroupId: input.dedupGroupId ?? undefined,
      photoBeforeUrl: input.photoBeforeUrl ?? '',
      photoAfterUrl: input.photoAfterUrl ?? undefined,
    },
  });

  return normalizeTicket(ticket);
}

export async function updateComplaintStatus(id: string, status: ComplaintStatus) {
  if (!databaseEnabled) {
    return updateMockComplaintStatus(id, status);
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data: { status: status as any },
  });

  return normalizeTicket(ticket);
}

export async function escalateComplaintIfActive(id: string) {
  if (!databaseEnabled) {
    return escalateMockComplaintIfActive(id);
  }

  const result = await prisma.ticket.updateMany({
    where: {
      id,
      status: { notIn: ['ESCALATED', 'RESOLVED', 'VERIFIED', 'CLOSED'] },
    },
    data: { status: 'ESCALATED' },
  });

  if (result.count === 0) return undefined;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  return ticket ? normalizeTicket(ticket) : undefined;
}

export async function updateComplaintPhotoAfter(id: string, photoAfterUrl: string) {
  if (!databaseEnabled) {
    const { updateComplaintPhotoAfter: updateMockPhotoAfter } = await import('@/lib/mock-complaints');
    return updateMockPhotoAfter(id, photoAfterUrl);
  }

  const ticket = await prisma.ticket.update({
    where: { id },
    data: { photoAfterUrl },
  });

  return normalizeTicket(ticket);
}

export async function addDuplicateReport(id: string) {
  if (!databaseEnabled) return addMockDuplicateReport(id);

  const ticket = await prisma.ticket.update({
    where: { id },
    data: { duplicateReports: { increment: 1 } },
  });
  return normalizeTicket(ticket);
}

export async function upvoteComplaint(id: string, userId: string) {
  if (!databaseEnabled) return upvoteMockComplaint(id, userId);

  return prisma.$transaction(async (transaction) => {
    await transaction.ticketVote.upsert({
      where: { ticketId_userId: { ticketId: id, userId } },
      create: { ticketId: id, userId },
      update: {},
    });

    const [voteCount, ticket] = await Promise.all([
      transaction.ticketVote.count({ where: { ticketId: id } }),
      transaction.ticket.findUniqueOrThrow({
        where: { id },
        select: { urgency: true, baseUrgency: true },
      }),
    ]);
    const baseUrgency = (ticket.baseUrgency ?? ticket.urgency) as ComplaintUrgency;
    const urgency = urgencyWithCommunitySupport(baseUrgency, voteCount);
    await transaction.ticket.update({
      where: { id },
      data: { baseUrgency, urgency },
    });
    return { voteCount, urgency };
  });
}

export async function saveRepairReview(
  id: string,
  input: { photoAfterUrl: string; approved: boolean; notes: string },
) {
  if (!databaseEnabled) return saveMockRepairReview(id, input);

  const result = await prisma.ticket.updateMany({
    where: { id, status: 'IN_PROGRESS' },
    data: {
      photoAfterUrl: input.photoAfterUrl,
      aiVerificationStatus: input.approved ? 'APPROVED' : 'REJECTED',
      aiVerificationNotes: input.notes,
      ...(input.approved ? { status: 'RESOLVED' } : {}),
    },
  });
  if (result.count === 0) return undefined;
  const ticket = await prisma.ticket.findUnique({ where: { id } });
  return ticket ? normalizeTicket(ticket) : undefined;
}
