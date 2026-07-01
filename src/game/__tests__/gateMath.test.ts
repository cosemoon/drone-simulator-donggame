import { describe, expect, it } from "vitest";
import { crossedGatePlane, signedGateDistance } from "../gateMath";
import type { Gate } from "../types";

const gate: Gate = {
  id: "gate-1",
  order: 1,
  label: "Gate 1",
  position: [0, 0, 0],
  rotation: [0, 0, 0],
  normal: [0, 0, 1],
  radius: 3,
  dimensions: {
    width: 10,
    height: 10,
    depth: 0.35,
  },
  required: true,
};

describe("gate plane math", () => {
  it("computes signed distance from the gate plane", () => {
    expect(signedGateDistance(gate, [0, 0, -2])).toBeLessThan(0);
    expect(signedGateDistance(gate, [0, 0, 2])).toBeGreaterThan(0);
  });

  it("accepts back-to-front crossings within the gate radius", () => {
    expect(crossedGatePlane(gate, [0, 0, -2], [0, 0, 2])).toBe(true);
  });

  it("rejects crossings outside the gate radius", () => {
    const narrowGate = {
      ...gate,
      radius: 2,
    };

    expect(crossedGatePlane(narrowGate, [2.5, 0, -2], [2.5, 0, 2])).toBe(
      false,
    );
  });

  it("rejects backward crossings", () => {
    expect(crossedGatePlane(gate, [0, 0, 2], [0, 0, -2])).toBe(false);
  });
});
