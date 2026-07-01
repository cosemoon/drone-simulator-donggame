import { describe, expect, it } from "vitest";
import { defaultSimulationConfig } from "../config";
import {
  addCollision,
  addGateClip,
  addOutOfBoundsPenalty,
  addResetPenalty,
  advanceRaceTime,
  createRaceState,
  finishRace,
  passGate,
  passGateByPosition,
  pauseRace,
  resumeRace,
  startRace,
  toRaceResult,
} from "../race";
import type { Course, Gate } from "../types";

const gate = (id: string, order: number): Gate => ({
  id,
  order,
  label: `Gate ${order}`,
  position: [order, 2, order * 4],
  rotation: [0, 0, 0],
  normal: [0, 0, 1],
  radius: 3,
  dimensions: {
    width: 4,
    height: 3,
    depth: 0.35,
  },
  required: true,
});

const timeAttackCourse: Course = {
  id: "test-course",
  version: "test-course-version",
  label: "Test Course",
  description: "Small deterministic race course for state tests.",
  themeId: "high-contrast",
  start: {
    name: "Start",
    position: [0, 1, -4],
    rotation: [0, 0, 0],
    padRadius: 2,
  },
  finish: {
    name: "Finish",
    type: "gate",
    gateId: "gate-3",
    position: [3, 2, 12],
    rotation: [0, 0, 0],
    width: 5,
  },
  bounds: {
    min: [-10, 0, -10],
    max: [10, 10, 20],
  },
  gates: [gate("gate-1", 1), gate("gate-2", 2), gate("gate-3", 3)],
};

const finishLineCourse: Course = {
  ...timeAttackCourse,
  id: "finish-line-course",
  finish: {
    name: "Finish Line",
    type: "line",
    position: [4, 2, 18],
    rotation: [0, 0, 0],
    width: 6,
  },
  gates: [gate("gate-1", 1), gate("gate-2", 2)],
};

describe("race state timing", () => {
  it("starts ready at elapsed zero and advances running elapsed time", () => {
    let state = createRaceState(timeAttackCourse);

    expect(state.status).toBe("ready");
    expect(state.elapsedMs).toBe(0);
    expect(state.finalMs).toBe(0);
    expect(state.nextGateId).toBe("gate-1");
    expect(state.nextGateOrder).toBe(1);
    expect(state.startedAt).toBeNull();

    state = startRace(state, 1_000);
    state = advanceRaceTime(state, 1_250);

    expect(state.status).toBe("running");
    expect(state.startedAt).toBe(1_000);
    expect(state.elapsedMs).toBe(250);
    expect(state.finalMs).toBe(250);
  });

  it("does not advance elapsed time while paused", () => {
    let state = createRaceState(timeAttackCourse);

    state = startRace(state, 1_000);
    state = advanceRaceTime(state, 1_300);
    state = pauseRace(state, 1_500);
    state = advanceRaceTime(state, 3_000);

    expect(state.status).toBe("paused");
    expect(state.elapsedMs).toBe(500);

    state = resumeRace(state, 4_000);
    state = advanceRaceTime(state, 4_500);

    expect(state.status).toBe("running");
    expect(state.elapsedMs).toBe(1_000);
  });
});

describe("race gate ordering", () => {
  it("advances through required gates in order", () => {
    let state = startRace(createRaceState(timeAttackCourse), 0);

    state = passGate(state, timeAttackCourse, "gate-1", 100);

    expect(state.clearedGateIds).toEqual(["gate-1"]);
    expect(state.nextGateId).toBe("gate-2");
    expect(state.nextGateOrder).toBe(2);

    state = passGate(state, timeAttackCourse, "gate-2", 200);

    expect(state.clearedGateIds).toEqual(["gate-1", "gate-2"]);
    expect(state.nextGateId).toBe("gate-3");
    expect(state.nextGateOrder).toBe(3);
    expect(state.status).toBe("running");
  });

  it("adds a missed-gate penalty and does not advance for out-of-order gates", () => {
    let state = startRace(createRaceState(timeAttackCourse), 0);

    state = passGate(state, timeAttackCourse, "gate-2", 250);

    expect(state.wrongGates).toBe(1);
    expect(state.clearedGateIds).toEqual([]);
    expect(state.nextGateId).toBe("gate-1");
    expect(state.nextGateOrder).toBe(1);
    expect(state.penaltyMs).toBe(
      defaultSimulationConfig.penalties.missedGateMs,
    );
    expect(state.penalties).toEqual([
      expect.objectContaining({
        reason: "missed-gate",
        gateId: "gate-2",
        penaltyMs: defaultSimulationConfig.penalties.missedGateMs,
      }),
    ]);
  });

  it("passes only the expected gate after a directional position crossing", () => {
    let state = startRace(createRaceState(timeAttackCourse), 0);

    state = passGateByPosition(
      state,
      timeAttackCourse,
      [1, 2, 3],
      [1, 2, 5],
      100,
    );

    expect(state.clearedGateIds).toEqual(["gate-1"]);
    expect(state.nextGateId).toBe("gate-2");

    state = passGateByPosition(
      state,
      timeAttackCourse,
      [2, 2, 9],
      [2, 2, 7],
      200,
    );
    state = passGateByPosition(
      state,
      timeAttackCourse,
      [8, 2, 7],
      [8, 2, 9],
      300,
    );

    expect(state.clearedGateIds).toEqual(["gate-1"]);
    expect(state.nextGateId).toBe("gate-2");
  });

  it("does not finish before all required gates are cleared", () => {
    let state = startRace(createRaceState(finishLineCourse), 0);

    state = passGate(state, finishLineCourse, "gate-1", 100);
    state = finishRace(state, finishLineCourse, 500);

    expect(state.status).toBe("running");
    expect(state.finishedAt).toBeNull();
    expect(state.elapsedMs).toBe(500);
  });
});

describe("race penalties and results", () => {
  it("finishes on the finish gate after required gates and creates result math", () => {
    let state = startRace(createRaceState(timeAttackCourse), 0);

    state = passGate(state, timeAttackCourse, "gate-1", 500);
    state = addCollision(state, 750);
    state = addGateClip(state, "gate-1", 900);
    state = passGate(state, timeAttackCourse, "gate-2", 1_500);
    state = addOutOfBoundsPenalty(state, 1_750);
    state = passGate(state, timeAttackCourse, "gate-3", 2_000);

    const expectedPenaltyMs =
      defaultSimulationConfig.penalties.collisionMs +
      defaultSimulationConfig.penalties.gateClipMs +
      defaultSimulationConfig.penalties.outOfBoundsMs;

    expect(state.status).toBe("finished");
    expect(state.finishedAt).toBe(2_000);
    expect(state.elapsedMs).toBe(2_000);
    expect(state.penaltyMs).toBe(expectedPenaltyMs);
    expect(state.finalMs).toBe(2_000 + expectedPenaltyMs);

    const result = toRaceResult(state, {
      id: "result-1",
      nickname: "Ace",
      themeId: "neon-night",
      courseVersion: timeAttackCourse.version,
      completedAt: "2026-06-30T00:00:00.000Z",
      buildVersion: "test-build",
    });

    expect(result).toEqual({
      id: "result-1",
      nickname: "Ace",
      courseId: "test-course",
      courseVersion: "test-course-version",
      themeId: "neon-night",
      hoverAssistEnabled: true,
      maxSpeedMetersPerSecond: defaultSimulationConfig.drone.maxSpeedMetersPerSecond,
      elapsedMs: 2_000,
      penaltyMs: expectedPenaltyMs,
      finalMs: 2_000 + expectedPenaltyMs,
      collisions: 1,
      wrongGates: 0,
      gateClips: 1,
      resets: 0,
      outOfBounds: 1,
      completedAt: "2026-06-30T00:00:00.000Z",
      buildVersion: "test-build",
    });
  });

  it("can create a race result with default optional metadata", () => {
    let state = startRace(createRaceState(timeAttackCourse), 0);

    state = passGate(state, timeAttackCourse, "gate-1", 100);
    state = passGate(state, timeAttackCourse, "gate-2", 200);
    state = passGate(state, timeAttackCourse, "gate-3", 300);

    const result = toRaceResult(state, {
      themeId: "clean-sim",
    });

    expect(result.id).toContain("test-course");
    expect(result.nickname).toBe("Pilot");
    expect(result.courseVersion).toBe(timeAttackCourse.version);
    expect(result.buildVersion).toBe(defaultSimulationConfig.buildVersion);
    expect(Number.isFinite(Date.parse(result.completedAt))).toBe(true);
  });

  it("adds collision, gate clip, and out-of-bounds penalties from config", () => {
    let state = startRace(createRaceState(timeAttackCourse), 0);

    state = addCollision(state, 100);
    state = addGateClip(state, "gate-1", 200);
    state = addOutOfBoundsPenalty(state, 300);

    expect(state.collisions).toBe(1);
    expect(state.gateClips).toBe(1);
    expect(state.outOfBounds).toBe(1);
    expect(state.penaltyMs).toBe(
      defaultSimulationConfig.penalties.collisionMs +
        defaultSimulationConfig.penalties.gateClipMs +
        defaultSimulationConfig.penalties.outOfBoundsMs,
    );
  });

  it("adds reset penalties from config", () => {
    let state = startRace(createRaceState(timeAttackCourse), 0);

    state = addResetPenalty(state, 250);

    expect(state.resets).toBe(1);
    expect(state.penaltyMs).toBe(defaultSimulationConfig.penalties.resetMs);
    expect(state.penalties).toEqual([
      expect.objectContaining({
        reason: "reset",
        penaltyMs: defaultSimulationConfig.penalties.resetMs,
      }),
    ]);
  });
});
