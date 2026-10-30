import { compare, hash } from 'bcryptjs';
import CredentialsProvider from 'next-auth/providers/credentials';
import type { NextAuthOptions, User } from 'next-auth';
import { getServerSession } from 'next-auth';
import { prisma } from '@/lib/prisma';

export type AppRole = 'ADMIN' | 'STAFF' | 'RESIDENT';

export const roleHome: Record<AppRole, string> = {
  ADMIN: '/admin',
  STAFF: '/staff',
  RESIDENT: '/resident',
};

async function ensureBootstrapAdmin() {
  const email = process.env.INITIAL_ADMIN_EMAIL?.trim().toLowerCase();
  const password = process.env.INITIAL_ADMIN_PASSWORD;
  if (!email || !password || password.length < 12) return;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return;

  try {
    await prisma.user.create({
      data: {
        email,
        name: 'Community administrator',
        passwordHash: await hash(password, 12),
        role: 'ADMIN',
      },
    });
  } catch (error) {
    if (!(error && typeof error === 'object' && 'code' in error && error.code === 'P2002')) {
      throw error;
    }
  }
}

export const authOptions: NextAuthOptions = {
  secret: process.env.NEXTAUTH_SECRET,
  session: { strategy: 'jwt' },
  pages: { signIn: '/login' },
  providers: [
    CredentialsProvider({
      name: 'Civicto account',
      credentials: {
        email: { label: 'Email', type: 'email' },
        password: { label: 'Password', type: 'password' },
      },
      async authorize(credentials) {
        const email = credentials?.email?.trim().toLowerCase();
        const password = credentials?.password;
        if (!email || !password) return null;

        await ensureBootstrapAdmin();
        const user = await prisma.user.findUnique({ where: { email } });
        if (
          !user
          || !['ADMIN', 'STAFF', 'RESIDENT'].includes(user.role)
          || !(await compare(password, user.passwordHash))
        ) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          role: user.role,
          team: user.team,
        } as User;
      },
    }),
  ],
  callbacks: {
    async jwt({ token, user }) {
      if (user) {
        const account = user as User & { role: string; team?: string | null };
        token.sub = account.id;
        token.role = account.role as AppRole;
        token.team = account.team ?? null;
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? '';
        session.user.role = (token.role as AppRole) ?? 'RESIDENT';
        session.user.team = typeof token.team === 'string' ? token.team : null;
      }
      return session;
    },
  },
};

export function getCurrentSession() {
  return getServerSession(authOptions);
}