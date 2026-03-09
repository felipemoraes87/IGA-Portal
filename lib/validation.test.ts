import { describe, expect, it } from "vitest";

import { loginSchema, requestSchema } from "./validation";

describe("validation schemas", () => {
  it("validates login email", () => {
    expect(loginSchema.safeParse({ email: "user@iga.local" }).success).toBe(true);
    expect(loginSchema.safeParse({ email: "invalid" }).success).toBe(false);
  });

  it("requires permission on SINGLE requests", () => {
    const result = requestSchema.safeParse({
      requestType: "SINGLE",
      targetUserId: "u1",
      justification: "Justificativa valida com tamanho minimo.",
    });
    expect(result.success).toBe(false);
  });

  it("accepts SINGLE with permissionIds", () => {
    const result = requestSchema.safeParse({
      requestType: "SINGLE",
      targetUserId: "u1",
      permissionIds: ["p1"],
      justification: "Justificativa valida com tamanho minimo.",
    });
    expect(result.success).toBe(true);
  });

  it("requires mirrorFromUserId on MIRROR requests", () => {
    const result = requestSchema.safeParse({
      requestType: "MIRROR",
      targetUserId: "u1",
      justification: "Justificativa valida com tamanho minimo.",
    });
    expect(result.success).toBe(false);
  });
});
