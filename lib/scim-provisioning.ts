import { Prisma, PrismaClient, User } from "@prisma/client";
import { db } from "@/lib/db";
import { ParsedScimGroup, ParsedScimUserPayload, resolveEffectiveRole, resolveRolesFromGroupsAndReports } from "@/lib/scim";

type DbClient = PrismaClient | Prisma.TransactionClient;

async function currentGroups(tx: DbClient, userId: string) {
  return tx.userScimGroup.findMany({
    where: { userId },
    select: { value: true, display: true },
  });
}

async function hasDirectReports(tx: DbClient, userId: string) {
  const count = await tx.user.count({
    where: {
      managerId: userId,
      active: true,
    },
  });
  return count > 0;
}

export async function recomputeRoleForUser(tx: DbClient, userId: string) {
  const [groups, directReports] = await Promise.all([currentGroups(tx, userId), hasDirectReports(tx, userId)]);
  const roles = resolveRolesFromGroupsAndReports(groups, directReports);
  const role = resolveEffectiveRole(roles);
  await tx.userRoleAssignment.deleteMany({ where: { userId } });
  await tx.userRoleAssignment.createMany({
    data: roles.map((item) => ({ userId, role: item })),
    skipDuplicates: true,
  });
  return tx.user.update({
    where: { id: userId },
    data: { role },
  });
}

export async function recomputeRoleByUserId(userId: string) {
  const updated = await db.$transaction((tx) => recomputeRoleForUser(tx, userId));
  return updated.role;
}

function toSyntheticEmail(externalId: string) {
  return `${externalId}@scim.local`.toLowerCase();
}

async function resolveManagerId(tx: DbClient, managerExternalId?: string | null) {
  if (managerExternalId === undefined) return undefined;
  if (managerExternalId === null) return null;
  const manager = await tx.user.findUnique({
    where: { externalId: managerExternalId },
    select: { id: true },
  });
  return manager?.id ?? null;
}

async function upsertGroups(tx: DbClient, userId: string, groups: ParsedScimGroup[] | undefined) {
  if (groups === undefined) return;
  await tx.userScimGroup.deleteMany({ where: { userId } });
  if (!groups.length) return;
  await tx.userScimGroup.createMany({
    data: groups.map((group) => ({
      userId,
      value: group.value,
      display: group.display ?? null,
    })),
    skipDuplicates: true,
  });
}

async function logProvisioning(tx: DbClient, userId: string, operation: string, payload: unknown) {
  await tx.userProvisioningEvent.create({
    data: {
      userId,
      operation,
      rawPayload: payload as Prisma.InputJsonValue,
    },
  });
}

async function findUserForProvisioning(tx: DbClient, payload: ParsedScimUserPayload) {
  if (payload.externalId) {
    const byExternalId = await tx.user.findUnique({ where: { externalId: payload.externalId } });
    if (byExternalId) return byExternalId;
  }

  const byEmail = await tx.user.findUnique({ where: { email: payload.email } });
  if (byEmail) return byEmail;
  return null;
}

type UpsertInput = {
  payload: ParsedScimUserPayload;
  operation: string;
  rawPayload: unknown;
};

export async function upsertUserFromScim(input: UpsertInput) {
  const { payload, operation, rawPayload } = input;

  return db.$transaction(async (tx) => {
    const existing = await findUserForProvisioning(tx, payload);
    const previousManagerId = existing?.managerId ?? null;
    const managerId = await resolveManagerId(tx, payload.managerExternalId);

    const user = existing
      ? await tx.user.update({
          where: { id: existing.id },
          data: {
            externalId: payload.externalId,
            email: payload.email || toSyntheticEmail(payload.externalId),
            name: payload.displayName,
            active: payload.active,
            ...(managerId !== undefined ? { managerId } : {}),
          },
        })
      : await tx.user.create({
          data: {
            externalId: payload.externalId,
            email: payload.email || toSyntheticEmail(payload.externalId),
            name: payload.displayName,
            active: payload.active,
            managerId: managerId ?? null,
          },
        });

    await upsertGroups(tx, user.id, payload.groups);
    await recomputeRoleForUser(tx, user.id);

    if (previousManagerId && previousManagerId !== user.id) {
      await recomputeRoleForUser(tx, previousManagerId);
    }
    if (user.managerId && user.managerId !== user.id) {
      await recomputeRoleForUser(tx, user.managerId);
    }

    await logProvisioning(tx, user.id, operation, rawPayload);
    const resolved = await tx.user.findUniqueOrThrow({
      where: { id: user.id },
      include: { scimGroups: true },
    });
    return { user: resolved, created: !existing };
  });
}

export async function softDeleteUserFromScim(user: User, rawPayload: unknown) {
  return db.$transaction(async (tx) => {
    await tx.userRoleAssignment.deleteMany({
      where: { userId: user.id },
    });
    await tx.userRoleAssignment.create({
      data: {
        userId: user.id,
        role: "USER",
      },
    });

    const updated = await tx.user.update({
      where: { id: user.id },
      data: {
        active: false,
        role: "USER",
      },
    });

    if (updated.managerId) {
      await recomputeRoleForUser(tx, updated.managerId);
    }

    await logProvisioning(tx, updated.id, "DELETE", rawPayload);
    return updated;
  });
}

export async function findUserByScimId(scimId: string) {
  return db.user.findFirst({
    where: {
      OR: [{ id: scimId }, { externalId: scimId }],
    },
    include: {
      scimGroups: true,
    },
  });
}
