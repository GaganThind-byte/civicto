import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canManageComplaint } from '@/lib/complaint-access';
import { getComplaintById, saveRepairReview } from '@/lib/complaint-service';
import { GeminiServiceError, reviewRepairPhoto } from '@/lib/gemini';
import { triggerComplaintNotification } from '@/lib/notifications';
import { saveUploadedPhoto } from '@/lib/photo-storage';

const maxPhotoBytes = 5 * 1024 * 1024;

export const runtime = 'nodejs';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (!['ADMIN', 'STAFF'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Only maintenance staff can submit repair evidence.' }, { status: 403 });
  }

  const complaint = await getComplaintById(params.id);
  if (!complaint) return NextResponse.json({ error: 'Complaint not found.' }, { status: 404 });
  if (!canManageComplaint(session.user, complaint)) {
    return NextResponse.json({ error: 'This ticket belongs to another team.' }, { status: 403 });
  }
  if (complaint.status !== 'IN_PROGRESS') {
    return NextResponse.json({ error: 'Move the complaint to In Progress before submitting repair evidence.' }, { status: 409 });
  }

  const formData = await request.formData();
  const file = formData.get('afterPhoto');
  if (!(file instanceof File) || file.size === 0) {
    return NextResponse.json({ error: 'Add an after-repair photo for AI review.' }, { status: 400 });
  }
  if (!file.type.startsWith('image/') || file.size > maxPhotoBytes) {
    return NextResponse.json({ error: 'Upload an image smaller than 5 MB.' }, { status: 400 });
  }

  try {
    const photoBuffer = Buffer.from(await file.arrayBuffer());
    const review = await reviewRepairPhoto({
      title: complaint.title,
      description: complaint.description,
      image: { mimeType: file.type, data: photoBuffer.toString('base64') },
    });
    const photoAfterUrl = await saveUploadedPhoto({
      name: file.name || 'repair-after.png',
      type: file.type,
      buffer: photoBuffer,
    });
    const updated = await saveRepairReview(params.id, {
      photoAfterUrl,
      approved: review.approved,
      notes: review.reason,
    });

    if (!updated) {
      return NextResponse.json({ error: 'The complaint changed before the review could be saved. Refresh and try again.' }, { status: 409 });
    }

    const notification = review.approved
      ? await triggerComplaintNotification(
        {
          id: updated.id,
          ticketNumber: updated.ticketNumber,
          title: updated.title,
          location: updated.location,
          category: updated.category,
          urgency: updated.urgency,
          status: updated.status,
        },
        'resolved',
      )
      : null;

    return NextResponse.json({ complaint: updated, review, notification });
  } catch (error) {
    if (error instanceof GeminiServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Repair photo review failed.');
    return NextResponse.json({ error: 'Unable to review this repair photo right now.' }, { status: 500 });
  }
}
