import { RoleDashboard } from '@/components/role-dashboard';
import { requireRole } from '@/lib/require-role';

export default async function AdminPage() {
  const session = await requireRole('ADMIN');
  return <RoleDashboard user={session.user} />;
}