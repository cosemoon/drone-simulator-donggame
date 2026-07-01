import { describe, expect, it } from "vitest";
import { shouldBlockGameInput } from "../App";

describe("app input gating", () => {
  it("keeps flight input enabled during normal ready/running states", () => {
    expect(shouldBlockGameInput(false, "ready")).toBe(false);
    expect(shouldBlockGameInput(false, "running")).toBe(false);
  });

  it("blocks flight input while menus or finish results are open", () => {
    expect(shouldBlockGameInput(true, "running")).toBe(true);
    expect(shouldBlockGameInput(false, "finished")).toBe(true);
  });
});
