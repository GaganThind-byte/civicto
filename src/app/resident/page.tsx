import { RoleDashboard } from '@/components/role-dashboard';
import { requireRole } from '@/lib/require-role';

export default async function ResidentPage() {
  const session = await requireRole('RESIDENT');
  return <RoleDashboard user={session.user} />;
}