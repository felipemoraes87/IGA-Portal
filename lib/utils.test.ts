import { describe, expect, it } from "vitest";

import { cn, toFriendlyLabel } from "./utils";

describe("utils", () => {
  it("merges tailwind classes with override", () => {
    expect(cn("px-2", "px-4")).toBe("px-4");
  });

  it("returns fallback when value is empty", () => {
    expect(toFriendlyLabel("   ")).toBe("-");
    expect(toFriendlyLabel(undefined, "N/A")).toBe("N/A");
  });

  it("removes trailing bracketed id", () => {
    expect(toFriendlyLabel("Acesso Admin [ID-123]")).toBe("Acesso Admin");
  });
});
