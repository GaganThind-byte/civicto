import { NextResponse } from 'next/server';
import { triageComplaint } from '@/lib/ai-triage';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const description = String(body.description ?? '').trim();
    const imageUrl = String(body.imageUrl ?? '').trim();

    if (!description && !imageUrl) {
      return NextResponse.json(
        { error: 'description or imageUrl is required.' },
        { status: 400 },
      );
    }

    const triage = await triageComplaint(imageUrl, description);
    return NextResponse.json({ triage });
  } catch {
    return NextResponse.json(
      { error: 'Unable to triage the complaint.' },
      { status: 400 },
    );
  }
}
