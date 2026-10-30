import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getComplaintById, upvoteComplaint } from '@/lib/complaint-service';

export async function POST(
  _: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (session.user.role !== 'RESIDENT') {
    return NextResponse.json({ error: 'Only residents can support community complaints.' }, { status: 403 });
  }

  const complaint = await getComplaintById(params.id);
  if (!complaint) return NextResponse.json({ error: 'Complaint not found.' }, { status: 404 });
  if (['RESOLVED', 'VERIFIED', 'CLOSED'].includes(complaint.status)) {
    return NextResponse.json({ error: 'Completed complaints can no longer receive votes.' }, { status: 409 });
  }

  const result = await upvoteComplaint(params.id, session.user.id);
  return NextResponse.json({ ...result, voted: true });
}
