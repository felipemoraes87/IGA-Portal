import { NextResponse } from "next/server";
import { hasMinimumRoleByUser, requireAuth, authErrorResponse } from "@/lib/auth";
import { db } from "@/lib/db";
import { toFriendlyLabel } from "@/lib/utils";

type SearchItem = {
  id: string;
  type: "USER" | "BR" | "SYSTEM" | "SR";
  label: string;
  subLabel: string;
  href: string;
};

function normalizeQuery(raw: string | null) {
  return (raw || "").trim();
}

export async function GET(request: Request) {
  try {
    const user = await requireAuth();
    const { searchParams } = new URL(request.url);
    const query = normalizeQuery(searchParams.get("q"));

    if (query.length < 2) {
      return NextResponse.json({ data: [] as SearchItem[] });
    }

    const isAdmin = hasMinimumRoleByUser(user, "ADMIN");
    const isManager = hasMinimumRoleByUser(user, "MANAGER");
    const contains = { contains: query, mode: "insensitive" as const };

    const [users, ownedBrRows, systems, permissions] = await Promise.all([
      db.user.findMany({
        where: isAdmin
          ? {
              active: true,
              OR: [{ name: contains }, { email: contains }],
            }
          : isManager
            ? {
                active: true,
                OR: [{ id: user.id }, { managerId: user.id }],
                AND: [{ OR: [{ name: contains }, { email: contains }] }],
              }
            : {
                active: true,
                id: user.id,
                OR: [{ name: contains }, { email: contains }],
              },
        select: {
          id: true,
          name: true,
          email: true,
        },
        orderBy: { name: "asc" },
        take: 8,
      }),
      isAdmin
        ? db.businessRole.findMany({
            where: {
              OR: [{ name: contains }, { id: contains }],
            },
            select: {
              id: true,
              name: true,
            },
            orderBy: { name: "asc" },
            take: 8,
          })
        : db.orchestratorBusinessRole.findMany({
            where: {
              ownerId: user.id,
              isCurrent: { equals: "true", mode: "insensitive" },
              OR: [{ name: contains }, { id: contains }, { technicalId: contains }],
              id: { not: null },
            },
            select: {
              id: true,
              name: true,
              technicalId: true,
            },
            distinct: ["id"],
            orderBy: { name: "asc" },
            take: 8,
          }),
      db.system.findMany({
        where: isAdmin
          ? {
              OR: [{ name: contains }, { id: contains }],
            }
          : {
              ownerId: user.id,
              OR: [{ name: contains }, { id: contains }],
            },
        select: {
          id: true,
          name: true,
          criticality: true,
        },
        orderBy: { name: "asc" },
        take: 8,
      }),
      db.permission.findMany({
        where: isAdmin
          ? {
              OR: [{ name: contains }, { description: contains }, { system: { name: contains } }],
            }
          : {
              OR: [{ ownerId: user.id }, { system: { ownerId: user.id } }],
              AND: [{ OR: [{ name: contains }, { description: contains }, { system: { name: contains } }] }],
            },
        include: {
          system: {
            select: { id: true, name: true },
          },
        },
        orderBy: { name: "asc" },
        take: 8,
      }),
    ]);

    const brItems = isAdmin
      ? ownedBrRows.map((br) => ({
          id: br.id,
          type: "BR" as const,
          label: toFriendlyLabel(br.name, "Sem nome"),
          subLabel: `Business Role`,
          href: `/admin/business-roles?q=${encodeURIComponent(query)}`,
        }))
      : ownedBrRows.map((br) => ({
          id: br.id || "",
          type: "BR" as const,
          label: toFriendlyLabel(br.name, "Sem nome"),
          subLabel: `Technical ID: ${toFriendlyLabel(br.technicalId, "-")}`,
          href: `/my-brs/${encodeURIComponent(br.id || "")}`,
        }));

    const data: SearchItem[] = [
      ...users.map((item) => ({
        id: item.id,
        type: "USER" as const,
        label: toFriendlyLabel(item.name, item.email),
        subLabel: item.email,
        href: isAdmin ? `/admin/users?q=${encodeURIComponent(item.email)}` : isManager ? "/manager/team" : "/",
      })),
      ...brItems.filter((item) => Boolean(item.id)),
      ...systems.map((item) => ({
        id: item.id,
        type: "SYSTEM" as const,
        label: toFriendlyLabel(item.name, item.id),
        subLabel: `Criticidade: ${item.criticality}`,
        href: isAdmin ? `/admin/systems?q=${encodeURIComponent(item.name)}` : `/my-systems/${encodeURIComponent(item.id)}`,
      })),
      ...permissions.map((item) => ({
        id: item.id,
        type: "SR" as const,
        label: toFriendlyLabel(item.name, item.id),
        subLabel: `${toFriendlyLabel(item.system.name, item.system.id)} - ${toFriendlyLabel(item.description, "Sem descricao")}`,
        href: isAdmin ? `/admin/system-roles?q=${encodeURIComponent(item.name)}` : `/my-srs/${encodeURIComponent(item.id)}`,
      })),
    ];

    return NextResponse.json({ data });
  } catch (error) {
    return authErrorResponse(error);
  }
}

