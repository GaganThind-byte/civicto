import { getRecommendedAssignment } from '@/lib/complaint-workflow';
import type { AppRole } from '@/lib/auth';

export type AccessUser = {
  id: string;
  role: AppRole;
  team: string | null;
};

export type AccessibleComplaint = {
  category: string;
  residentId?: string | null;
};

export function canViewComplaint(user: AccessUser, complaint: AccessibleComplaint) {
  if (user.role === 'ADMIN') return true;
  if (user.role === 'STAFF') return Boolean(user.team && user.team === getRecommendedAssignment(complaint.category));
  return complaint.residentId === user.id;
}

export function canManageComplaint(user: AccessUser, complaint: AccessibleComplaint) {
  return user.role === 'ADMIN'
    || (user.role === 'STAFF'
      && Boolean(user.team && user.team === getRecommendedAssignment(complaint.category)));
}