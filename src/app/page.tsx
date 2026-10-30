import { redirect } from 'next/navigation';
import { getCurrentSession, roleHome } from '@/lib/auth';

export default async function HomePage() {
  const session = await getCurrentSession();
  redirect(session ? roleHome[session.user.role] : '/login');
}
