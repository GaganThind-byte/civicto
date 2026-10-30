import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function POST(request: Request) {
  if (!process.env.NEXTAUTH_SECRET) {
    return NextResponse.json(
      { error: 'Authentication is not configured yet. Add NEXTAUTH_SECRET to .env and restart the app.' },
      { status: 503 },
    );
  }

  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');

    if (!name || !/^\S+@\S+\.\S+$/.test(email)) {
      return NextResponse.json({ error: 'Enter your name and a valid email address.' }, { status: 400 });
    }
    if (password.length < 12) {
      return NextResponse.json({ error: 'Use a password with at least 12 characters.' }, { status: 400 });
    }

    await prisma.user.create({
      data: {
        name,
        email,
        passwordHash: await hash(password, 12),
        role: 'RESIDENT',
      },
    });

    return NextResponse.json({ created: true }, { status: 201 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Unable to create your account right now.' }, { status: 400 });
  }
}