import { describe, expect, it } from "vitest";
import { inferRequestApproverScope, resolvePrimaryApproverForPermission } from "./approval-delegation";

describe("approval delegation helpers", () => {
  it("resolves primary approver with SR owner priority", () => {
    expect(
      resolvePrimaryApproverForPermission({
        ownerId: "sr-owner",
        systemId: "sys-1",
        system: { ownerId: "system-owner" },
      }),
    ).toEqual({ approverId: "sr-owner", scope: "SR_OWNER" });

    expect(
      resolvePrimaryApproverForPermission({
        ownerId: null,
        systemId: "sys-1",
        system: { ownerId: "system-owner" },
      }),
    ).toEqual({ approverId: "system-owner", scope: "SYSTEM_OWNER" });
  });

  it("infers scope from stored request approver", () => {
    expect(
      inferRequestApproverScope({
        approverId: "sr-owner",
        permissionId: "perm-1",
        permission: {
          ownerId: "sr-owner",
          systemId: "sys-1",
          system: { ownerId: "system-owner" },
        },
      }),
    ).toBe("SR_OWNER");

    expect(
      inferRequestApproverScope({
        approverId: "system-owner",
        permissionId: "perm-1",
        permission: {
          ownerId: null,
          systemId: "sys-1",
          system: { ownerId: "system-owner" },
        },
      }),
    ).toBe("SYSTEM_OWNER");

    expect(
      inferRequestApproverScope({
        approverId: "manager-user",
        permissionId: "perm-1",
        permission: {
          ownerId: null,
          systemId: "sys-1",
          system: { ownerId: null },
        },
      }),
    ).toBe("MANAGER");
  });
});
