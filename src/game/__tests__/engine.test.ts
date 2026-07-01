import { describe, expect, it } from "vitest";
import {
  resolveCameraModeCommand,
  shouldPenalizeResetForStatus,
} from "../engine";

describe("engine pure helpers", () => {
  it("cycles only between chase and fpv camera modes", () => {
    expect(resolveCameraModeCommand("chase", "cycle")).toBe("fpv");
    expect(resolveCameraModeCommand("fpv", "cycle")).toBe("chase");
    expect(resolveCameraModeCommand("orbit", "cycle")).toBe("fpv");
  });

  it("honors direct camera mode commands while keeping gameplay modes playable", () => {
    expect(resolveCameraModeCommand("chase", "fpv")).toBe("fpv");
    expect(resolveCameraModeCommand("fpv", "chase")).toBe("chase");
    expect(resolveCameraModeCommand("fpv", "none")).toBe("fpv");
    expect(resolveCameraModeCommand("orbit", "none")).toBe("chase");
    expect(resolveCameraModeCommand("chase", "orbit")).toBe("chase");
  });

  it("adds reset penalties only while an active run is in progress", () => {
    expect(shouldPenalizeResetForStatus("running")).toBe(true);
    expect(shouldPenalizeResetForStatus("ready")).toBe(false);
    expect(shouldPenalizeResetForStatus("paused")).toBe(false);
    expect(shouldPenalizeResetForStatus("finished")).toBe(false);
    expect(shouldPenalizeResetForStatus("aborted")).toBe(false);
  });
});
