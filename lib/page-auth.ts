import { redirect } from "next/navigation";
import { getCurrentUser, hasMinimumRoleByUser } from "@/lib/auth";
import { UserRole } from "@prisma/client";

export async function requirePageUser(minimumRole: UserRole = "USER") {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (!hasMinimumRoleByUser(user, minimumRole)) redirect("/");
  return user;
}
