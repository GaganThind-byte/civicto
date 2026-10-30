import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { canViewComplaint } from '@/lib/complaint-access';
import { getComplaintById } from '@/lib/complaint-service';

export async function GET(
  _: Request,
  { params }: { params: { id: string } },
) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });

  const complaint = await getComplaintById(params.id);

  if (!complaint) {
    return NextResponse.json({ error: 'Complaint not found.' }, { status: 404 });
  }

  if (!canViewComplaint(session.user, complaint)) {
    return NextResponse.json({ error: 'You do not have access to this complaint.' }, { status: 403 });
  }

  return NextResponse.json({ complaint });
}
