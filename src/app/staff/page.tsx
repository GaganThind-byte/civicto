import { RoleDashboard } from '@/components/role-dashboard';
import { requireRole } from '@/lib/require-role';

export default async function StaffPage() {
  const session = await requireRole('STAFF');
  return <RoleDashboard user={session.user} />;
}