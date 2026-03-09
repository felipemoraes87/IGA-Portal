import { describe, expect, it } from "vitest";

import { buildRequestFilters, canManageUser, getSingleRequestPermissionIds, resolvePermissionApproverId } from "./route";

describe("requests route helpers", () => {
  it("allows requesting access for any active organization user", () => {
    const admin = { id: "a", role: "ADMIN" } as never;
    const manager = { id: "m", role: "MANAGER" } as never;
    const user = { id: "u", role: "USER" } as never;
    const targetManaged = { id: "t", managerId: "m" } as never;
    const targetSelf = { id: "u", managerId: null } as never;

    expect(canManageUser(admin, targetManaged)).toBe(true);
    expect(canManageUser(user, targetSelf)).toBe(true);
    expect(canManageUser(manager, targetManaged)).toBe(true);
    expect(canManageUser(manager, { id: "x", managerId: "z" } as never)).toBe(true);
  });

  it("builds filters for user and manager", () => {
    const user = { id: "u1", role: "USER" } as never;
    const manager = { id: "m1", role: "MANAGER" } as never;

    const userFilter = buildRequestFilters(user, "RUNNING", "Slack");
    expect(userFilter.requesterId).toBe("u1");
    expect(userFilter.status).toBe("RUNNING");
    expect(userFilter.permission).toEqual({ system: { name: "Slack" } });

    const managerFilter = buildRequestFilters(manager, "INVALID", null);
    expect(managerFilter.status).toBeUndefined();
    expect(managerFilter.OR).toBeTruthy();
  });

  it("collects single request permission ids", () => {
    expect(
      getSingleRequestPermissionIds({
        requestType: "SINGLE",
        targetUserId: "u1",
        permissionId: "p1",
        permissionIds: ["p2", "p3"],
        justification: "Justificativa valida com tamanho minimo",
      } as never),
    ).toEqual(["p1", "p2", "p3"]);
  });

  it("prioritizes SR owner over System owner when resolving approver", () => {
    expect(
      resolvePermissionApproverId({
        id: "p1",
        name: "sr-admin",
        ownerId: "sr-owner",
        system: { name: "Jira", ownerId: "system-owner" },
      }),
    ).toBe("sr-owner");

    expect(
      resolvePermissionApproverId({
        id: "p2",
        name: "sr-read",
        ownerId: null,
        system: { name: "Jira", ownerId: "system-owner" },
      }),
    ).toBe("system-owner");

    expect(
      resolvePermissionApproverId({
        id: "p3",
        name: "sr-none",
        ownerId: null,
        system: { name: "Jira", ownerId: null },
      }),
    ).toBeNull();
  });
});
