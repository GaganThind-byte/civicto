import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canManageComplaint } from '@/lib/complaint-access';
import { getComplaintById, updateComplaintStatus } from '@/lib/complaint-service';
import { canTransition, getRecommendedAssignment, statusLabels, type TicketStatus } from '@/lib/complaint-workflow';
import { triggerComplaintNotification, type NotificationEvent } from '@/lib/notifications';

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const body = await request.json();
  const nextStatus = String(body.status ?? '').trim();

  if (!Object.prototype.hasOwnProperty.call(statusLabels, nextStatus)) {
    return NextResponse.json({ error: 'Choose a valid complaint status.' }, { status: 400 });
  }
  if (nextStatus === 'RESOLVED' || nextStatus === 'VERIFIED') {
    return NextResponse.json(
      { error: 'Repair completion requires an AI-reviewed after-photo; verification is completed by the resident.' },
      { status: 409 },
    );
  }

  const complaint = await getComplaintById(params.id);

  if (!complaint) {
    return NextResponse.json({ error: 'Complaint not found.' }, { status: 404 });
  }

  if (!canManageComplaint(session.user, complaint)) {
    return NextResponse.json({ error: 'This ticket belongs to another team.' }, { status: 403 });
  }
  if (session.user.role !== 'ADMIN' && !canTransition(complaint.status, nextStatus as TicketStatus)) {
    return NextResponse.json({ error: `Cannot move a ${complaint.status} ticket to ${nextStatus}.` }, { status: 409 });
  }

  const updated = await updateComplaintStatus(params.id, nextStatus as TicketStatus);
  const notificationEvent: NotificationEvent | undefined = nextStatus === 'ASSIGNED'
    ? 'assigned'
    : nextStatus === 'ESCALATED'
      ? 'escalated'
      : undefined;
  const notification = notificationEvent
    ? await triggerComplaintNotification(
      {
        id: updated?.id ?? complaint.id,
        ticketNumber: updated?.ticketNumber ?? complaint.ticketNumber,
        title: updated?.title ?? complaint.title,
        location: updated?.location ?? complaint.location,
        category: updated?.category ?? complaint.category,
        assignedTeam: getRecommendedAssignment(updated?.category ?? complaint.category),
        urgency: updated?.urgency ?? complaint.urgency,
        status: updated?.status ?? complaint.status,
      },
      notificationEvent,
    )
    : null;

  return NextResponse.json({ complaint: updated, notification });
}
