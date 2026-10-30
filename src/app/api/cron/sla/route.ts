import { timingSafeEqual } from 'crypto';
import { NextResponse } from 'next/server';
import { escalateComplaintIfActive, listComplaints } from '@/lib/complaint-service';
import { findOverdueComplaints, getRecommendedAssignment } from '@/lib/complaint-workflow';
import { triggerComplaintNotification } from '@/lib/notifications';

export const runtime = 'nodejs';

function hasValidCronSecret(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization = request.headers.get('authorization') ?? '';
  if (!secret || !authorization.startsWith('Bearer ')) return false;

  const expected = Buffer.from(secret);
  const supplied = Buffer.from(authorization.slice('Bearer '.length));
  return expected.length === supplied.length && timingSafeEqual(expected, supplied);
}

async function runSlaEscalation(request: Request) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'CRON_SECRET is not configured.' }, { status: 503 });
  }
  if (!hasValidCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized.' }, { status: 401 });
  }

  const complaints = await listComplaints();
  const overdue = findOverdueComplaints(complaints);
  const escalated: Array<{ ticketNumber: string; notificationDelivered: boolean }> = [];

  for (const complaint of overdue) {
    const updated = await escalateComplaintIfActive(complaint.id);
    if (!updated) continue;

    const notification = await triggerComplaintNotification(
      {
        id: updated.id,
        ticketNumber: updated.ticketNumber,
        title: updated.title,
        location: updated.location,
        category: updated.category,
        assignedTeam: getRecommendedAssignment(updated.category),
        urgency: updated.urgency,
        status: updated.status,
      },
      'escalated',
    );

    escalated.push({
      ticketNumber: updated.ticketNumber,
      notificationDelivered: notification.delivered,
    });
  }

  return NextResponse.json({ scanned: complaints.length, escalated });
}

export const GET = runSlaEscalation;
export const POST = runSlaEscalation;