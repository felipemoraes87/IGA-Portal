import { describe, expect, it } from "vitest";

import { canViewUser, hasMinimumRole } from "./rbac";

describe("rbac", () => {
  it("checks minimum role hierarchy", () => {
    expect(hasMinimumRole("ADMIN", "MANAGER")).toBe(true);
    expect(hasMinimumRole("MANAGER", "ADMIN")).toBe(false);
  });

  it("allows admin to view any user", () => {
    expect(canViewUser("ADMIN", "a", "b", false)).toBe(true);
  });

  it("allows actor to view itself", () => {
    expect(canViewUser("USER", "a", "a", false)).toBe(true);
  });

  it("allows manager to view managed target", () => {
    expect(canViewUser("MANAGER", "mgr", "usr", true)).toBe(true);
    expect(canViewUser("MANAGER", "mgr", "usr", false)).toBe(false);
  });
});
