import { hash } from 'bcryptjs';
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { assignmentRules } from '@/lib/complaint-workflow';

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true, team: true, createdAt: true },
    orderBy: { createdAt: 'desc' },
  });
  return NextResponse.json({ users });
}

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  if (!session) return NextResponse.json({ error: 'Sign in required.' }, { status: 401 });
  if (session.user.role !== 'ADMIN') return NextResponse.json({ error: 'Admin access required.' }, { status: 403 });

  try {
    const body = await request.json();
    const name = String(body.name ?? '').trim();
    const email = String(body.email ?? '').trim().toLowerCase();
    const password = String(body.password ?? '');
    const role = String(body.role ?? '');
    const team = String(body.team ?? '').trim();
    const validTeams = Object.values(assignmentRules);

    if (!name || !/^\S+@\S+\.\S+$/.test(email) || password.length < 12) {
      return NextResponse.json({ error: 'Enter a name, valid email, and password of at least 12 characters.' }, { status: 400 });
    }
    if (!['STAFF', 'RESIDENT'].includes(role)) {
      return NextResponse.json({ error: 'Choose a staff or resident role.' }, { status: 400 });
    }
    if (role === 'STAFF' && !validTeams.includes(team)) {
      return NextResponse.json({ error: 'Choose a valid maintenance team for staff.' }, { status: 400 });
    }

    const user = await prisma.user.create({
      data: {
        name,
        email,
        role,
        team: role === 'STAFF' ? team : null,
        passwordHash: await hash(password, 12),
      },
      select: { id: true, name: true, email: true, role: true, team: true, createdAt: true },
    });

    return NextResponse.json({ user }, { status: 201 });
  } catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'P2002') {
      return NextResponse.json({ error: 'An account with this email already exists.' }, { status: 409 });
    }
    return NextResponse.json({ error: 'Unable to create account.' }, { status: 400 });
  }
}