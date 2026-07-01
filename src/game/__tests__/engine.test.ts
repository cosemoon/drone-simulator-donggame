import { describe, expect, it } from "vitest";
import {
  createRuntimeSimulationConfig,
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

  it("maps speed and acceleration options into the runtime simulation config", () => {
    const config = createRuntimeSimulationConfig({
      hoverAssistEnabled: false,
      maxSpeedMetersPerSecond: 7,
      accelerationMetersPerSecondSquared: 9,
    });

    expect(config.hoverAssistEnabled).toBe(false);
    expect(config.drone.maxSpeedMetersPerSecond).toBe(7);
    expect(config.assist.horizontalControlAcceleration).toBe(9);
  });
});
