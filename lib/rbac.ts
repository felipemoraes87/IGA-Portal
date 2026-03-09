import { UserRole } from "@prisma/client";

export const roleHierarchy: Record<UserRole, number> = {
  USER: 1,
  MANAGER: 2,
  ADMIN: 3,
};

export function hasMinimumRole(currentRole: UserRole, minimumRole: UserRole) {
  return roleHierarchy[currentRole] >= roleHierarchy[minimumRole];
}

export function canViewUser(currentRole: UserRole, actorId: string, targetId: string, isManagerOfTarget: boolean) {
  if (currentRole === "ADMIN") return true;
  if (actorId === targetId) return true;
  if (currentRole === "MANAGER" && isManagerOfTarget) return true;
  return false;
}
