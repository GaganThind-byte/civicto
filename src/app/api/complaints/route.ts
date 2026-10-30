import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { addComplaint, addDuplicateReport, listComplaints } from '@/lib/complaint-service';
import { canViewComplaint } from '@/lib/complaint-access';
import { triageComplaint } from '@/lib/ai-triage';
import { findDuplicateComplaint } from '@/lib/complaint-dedup';
import { triggerComplaintNotification } from '@/lib/notifications';
import { saveUploadedPhoto } from '@/lib/photo-storage';
import { GeminiServiceError, moderateComplaint } from '@/lib/gemini';

const maxPhotoBytes = 5 * 1024 * 1024;

function toDisplayCategory(category: string): string {
  const normalized = category.toLowerCase();

  if (normalized === 'lift-elevator') return 'Lift-Elevator';
  if (normalized === 'civil-masonry') return 'Civil';
  if (normalized === 'hvac') return 'HVAC';

  return normalized
    .split('-')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const complaints = await listComplaints(session.user.id);
  return NextResponse.json({
    complaints: session.user.role === 'RESIDENT'
      ? complaints
      : complaints.filter((complaint) => canViewComplaint(session.user, complaint)),
  });
}

export async function POST(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    if (!['ADMIN', 'RESIDENT'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Only residents can submit complaints.' }, { status: 403 });
    }

    let body: any = {};
    let photoBeforeUrl = '';
    let photoBuffer: Buffer | undefined;
    let uploadedFile: File | null = null;

    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      uploadedFile = (formData.get('photo') as File | null) ?? null;
      body = {
        title: formData.get('title'),
        description: formData.get('description'),
        location: formData.get('location'),
        category: formData.get('category'),
        urgency: formData.get('urgency'),
        imageUrl: formData.get('imageUrl'),
      };
    } else {
      body = await request.json();
    }

    const title = String(body.title ?? '').trim();
    const description = String(body.description ?? '').trim();
    const location = String(body.location ?? '').trim();
    const imageUrl = String(body.imageUrl ?? '').trim();

    if (!title || !description || !location) {
      return NextResponse.json(
        { error: 'title, description, and location are required.' },
        { status: 400 },
      );
    }

    if (uploadedFile && uploadedFile.size > 0) {
      if (!uploadedFile.type.startsWith('image/') || uploadedFile.size > maxPhotoBytes) {
        return NextResponse.json({ error: 'Upload an image smaller than 5 MB.' }, { status: 400 });
      }
      const arrayBuffer = await uploadedFile.arrayBuffer();
      photoBuffer = Buffer.from(arrayBuffer);
    }

    const moderation = await moderateComplaint({
      title,
      description,
      ...(photoBuffer && uploadedFile
        ? { image: { mimeType: uploadedFile.type, data: photoBuffer.toString('base64') } }
        : {}),
    });
    if (moderation.isNuisance) {
      return NextResponse.json(
        { rejected: true, reason: moderation.reason },
        { status: 422 },
      );
    }

    const existingComplaints = await listComplaints();
    const openComplaints = existingComplaints.filter(
      (complaint) => !['RESOLVED', 'VERIFIED', 'CLOSED'].includes(complaint.status),
    );
    const duplicateCheck = findDuplicateComplaint(
      { title, description, category: String(body.category ?? ''), location },
      openComplaints,
    );

    if (duplicateCheck.isDuplicate) {
      const existing = openComplaints.find((complaint) => complaint.id === duplicateCheck.existingId);
      const updated = existing ? await addDuplicateReport(existing.id) : undefined;
      return NextResponse.json(
        {
          duplicate: true,
          similarity: duplicateCheck.similarity,
          reason: duplicateCheck.reason,
          complaint: updated ?? existing,
        },
        { status: 200 },
      );
    }

    if (photoBuffer && uploadedFile) {
      photoBeforeUrl = await saveUploadedPhoto({
        name: uploadedFile.name || 'complaint-before.png',
        type: uploadedFile.type,
        buffer: photoBuffer,
      });
    } else if (imageUrl) {
      photoBeforeUrl = imageUrl;
    }

    const triage = await triageComplaint(imageUrl || photoBeforeUrl, description);
    const category = toDisplayCategory(triage.category);
    const urgency = triage.urgency as 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';

    const complaint = await addComplaint({
      title,
      description,
      category,
      location,
      residentId: session.user.role === 'RESIDENT' ? session.user.id : undefined,
      urgency,
      photoBeforeUrl,
      status: triage.confidence < 0.7 ? 'HUMAN_TRIAGE_QUEUE' : 'SUBMITTED',
    });

    const notification = await triggerComplaintNotification(
      {
        id: complaint.id,
        ticketNumber: complaint.ticketNumber,
        title: complaint.title,
        location: complaint.location,
        urgency: complaint.urgency,
        status: complaint.status,
      },
      'submitted',
    );

    return NextResponse.json({ complaint, triage, notification }, { status: 201 });
  } catch (error) {
    if (error instanceof GeminiServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.statusCode });
    }
    console.error('Complaint submission failed.');
    return NextResponse.json(
      { error: 'Unable to submit this complaint right now.' },
      { status: 500 },
    );
  }
}
