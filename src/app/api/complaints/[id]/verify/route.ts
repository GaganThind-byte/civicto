import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canViewComplaint } from '@/lib/complaint-access';
import { getComplaintById, updateComplaintPhotoAfter, updateComplaintStatus } from '@/lib/complaint-service';
import { verifyComplaintResolution } from '@/lib/verification';
import { saveUploadedPhoto } from '@/lib/photo-storage';

export async function POST(
  request: Request,
  { params }: { params: { id: string } },
) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
    if (!['ADMIN', 'RESIDENT'].includes(session.user.role)) {
      return NextResponse.json({ error: 'Only residents can verify completed work.' }, { status: 403 });
    }

    let body: any = {};
    let afterPhotoUrl = '';
    let uploadedAfterPhoto: File | null = null;

    const contentType = request.headers.get('content-type') ?? '';
    if (contentType.includes('multipart/form-data')) {
      const formData = await request.formData();
      uploadedAfterPhoto = formData.get('afterPhoto') as File | null;
      body = {
        residentConfirmedFix: formData.get('residentConfirmedFix') === 'true',
        notes: formData.get('notes'),
      };
    } else {
      body = await request.json();
    }

    const complaint = await getComplaintById(params.id);
    if (!complaint) {
      return NextResponse.json({ error: 'Complaint not found.' }, { status: 404 });
    }
    if (session.user.role !== 'ADMIN' && !canViewComplaint(session.user, complaint)) {
      return NextResponse.json({ error: 'You do not have access to this complaint.' }, { status: 403 });
    }
    if (complaint.status !== 'RESOLVED') {
      return NextResponse.json({ error: 'Only resolved complaints can be verified.' }, { status: 409 });
    }

    if (uploadedAfterPhoto && uploadedAfterPhoto.size > 0) {
      const arrayBuffer = await uploadedAfterPhoto.arrayBuffer();
      afterPhotoUrl = await saveUploadedPhoto({
        name: uploadedAfterPhoto.name || 'repair-after.png',
        type: uploadedAfterPhoto.type || 'image/png',
        buffer: Buffer.from(arrayBuffer),
      });
    }

    if (afterPhotoUrl) {
      await updateComplaintPhotoAfter(params.id, afterPhotoUrl);
    }

    const outcome = verifyComplaintResolution({
      currentStatus: complaint.status,
      residentConfirmedFix: body.residentConfirmedFix === true || body.residentConfirmedFix === 'true',
      hasPhotoEvidence: Boolean(afterPhotoUrl || complaint.photoAfterUrl),
      afterPhotoUrl: afterPhotoUrl || complaint.photoAfterUrl,
      notes: String(body.notes ?? '').trim(),
    });

    const updated = await updateComplaintStatus(params.id, outcome.nextStatus);

    if (afterPhotoUrl && outcome.verified && updated) {
      const persisted = await getComplaintById(params.id);
      if (persisted) {
        updated.photoAfterUrl = persisted.photoAfterUrl;
      }
    }

    return NextResponse.json({ complaint: updated, verification: outcome });
  } catch {
    return NextResponse.json({ error: 'Verification request was invalid.' }, { status: 400 });
  }
}
