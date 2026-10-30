import { redirect } from 'next/navigation';
import { getCurrentSession, roleHome, type AppRole } from '@/lib/auth';

export async function requireRole(role: AppRole) {
  const session = await getCurrentSession();
  if (!session) redirect('/login');
  if (session.user.role !== role) redirect(roleHome[session.user.role]);
  return {
    ...session,
    user: {
      ...session.user,
      name: session.user.name ?? 'Community member',
      email: session.user.email ?? '',
    },
  };
}