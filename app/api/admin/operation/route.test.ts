import { describe, expect, it } from "vitest";

import { buildCurrentByUser, diffAssignments } from "./route";

describe("admin operation helpers", () => {
  it("groups assignments by user", () => {
    const grouped = buildCurrentByUser([
      { id: "a1", userId: "u1" },
      { id: "a2", userId: "u1" },
      { id: "a3", userId: "u2" },
    ]);

    expect(grouped.get("u1")).toEqual(["a1", "a2"]);
    expect(grouped.get("u2")).toEqual(["a3"]);
  });

  it("diffs assignments correctly", () => {
    const expected = new Set(["u1", "u3"]);
    const current = new Map<string, string[]>();
    current.set("u1", ["a1", "a2"]);
    current.set("u2", ["a3"]);

    const { toCreate, toDeleteIds } = diffAssignments(expected, current);

    expect(toCreate).toEqual(["u3"]);
    expect(toDeleteIds).toEqual(["a2", "a3"]);
  });
});
