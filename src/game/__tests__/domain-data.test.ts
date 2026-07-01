import { describe, expect, it } from "vitest";
import {
  defaultSimulationConfig,
  gameThemes,
  trainingArenaCourse,
} from "../index";

describe("training arena course", () => {
  it("uses the v1 course id, version, and eight ordered gates", () => {
    const gateIds = trainingArenaCourse.gates.map((gate) => gate.id);
    const gateOrders = trainingArenaCourse.gates.map((gate) => gate.order);
    const finalGate =
      trainingArenaCourse.gates[trainingArenaCourse.gates.length - 1];

    expect(trainingArenaCourse.id).toBe("training-arena-01");
    expect(trainingArenaCourse.version).toBe("2026.06.30");
    expect(trainingArenaCourse.gates).toHaveLength(8);
    expect(new Set(gateIds).size).toBe(gateIds.length);
    expect(gateOrders).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(finalGate?.order).toBe(8);
    expect(finalGate?.label).toBe("결승 게이트");
    expect(finalGate?.normal).toEqual(expect.any(Array));
    expect(finalGate?.radius).toBeGreaterThan(0);
  });

  it("defines start and finish metadata tied to the course", () => {
    const finalGate =
      trainingArenaCourse.gates[trainingArenaCourse.gates.length - 1];

    expect(trainingArenaCourse.start.name).toBe("훈련 출발");
    expect(trainingArenaCourse.finish.type).toBe("gate");
    expect(trainingArenaCourse.finish.gateId).toBe(finalGate?.id);
  });
});

describe("game themes", () => {
  it("uses unique theme ids and includes the three v1 choices", () => {
    const themeIds = gameThemes.map((theme) => theme.id);

    expect(new Set(themeIds).size).toBe(themeIds.length);
    expect(themeIds).toEqual(["clean-sim", "neon-night", "high-contrast"]);
  });
});

describe("default simulation config", () => {
  it("matches the v1 course metadata and default penalties", () => {
    const { penalties } = defaultSimulationConfig;

    expect(defaultSimulationConfig.courseId).toBe(trainingArenaCourse.id);
    expect(defaultSimulationConfig.courseVersion).toBe(
      trainingArenaCourse.version,
    );
    expect(penalties.collisionMs).toBe(2_000);
    expect(penalties.missedGateMs).toBe(5_000);
    expect(penalties.resetMs).toBe(3_000);
    expect(penalties.missedGateMs).toBeGreaterThan(penalties.gateClipMs);
    expect(penalties.gateClipMs).toBeGreaterThan(0);
    expect(penalties.outOfBoundsMs).toBeGreaterThan(0);
    expect(penalties.maxRecoverableCollisions).toBeGreaterThan(0);
    expect(defaultSimulationConfig.assist.strength).toBeGreaterThan(0);
    expect(defaultSimulationConfig.assist.strength).toBeLessThanOrEqual(1);
  });
});
