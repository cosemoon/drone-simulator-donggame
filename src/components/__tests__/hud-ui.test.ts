import { describe, expect, it } from "vitest";
import { formatRaceTime, getHudMetrics } from "../Hud";
import { createLeaderboardRows } from "../Leaderboard";
import { normalizeTouchStickPoint } from "../TouchControls";
import type { GameSnapshot } from "../../game/engine";
import type { RaceResult } from "../../game/types";

function snapshot(overrides: Partial<GameSnapshot> = {}): GameSnapshot {
  return {
    status: "running",
    elapsedMs: 61_240,
    penaltyMs: 3_000,
    finalMs: 64_240,
    nextGateId: "ta-gate-02",
    nextGateOrder: 2,
    clearedGateCount: 1,
    totalGateCount: 8,
    cameraMode: "chase",
    themeId: "clean-sim",
    collisions: 0,
    wrongGates: 0,
    gateClips: 0,
    resets: 0,
    outOfBounds: 0,
    position: [0, 2, 0],
    velocity: [0, 0, 0],
    contextLost: false,
    ...overrides,
  };
}

function result(overrides: Partial<RaceResult> = {}): RaceResult {
  return {
    id: "record-1",
    nickname: "Pilot",
    courseId: "training-arena-01",
    courseVersion: "2026.06",
    themeId: "clean-sim",
    elapsedMs: 60_000,
    penaltyMs: 1_000,
    finalMs: 61_000,
    collisions: 0,
    wrongGates: 0,
    gateClips: 0,
    resets: 0,
    outOfBounds: 0,
    completedAt: "2026-06-30T00:00:00.000Z",
    buildVersion: "test",
    ...overrides,
  };
}

describe("HUD UI helpers", () => {
  it("formats race time with minutes, seconds, and tenths", () => {
    expect(formatRaceTime(0)).toBe("0:00.0");
    expect(formatRaceTime(65_432)).toBe("1:05.4");
    expect(formatRaceTime(-50)).toBe("0:00.0");
  });

  it("shows only nonzero incident counters in the compact HUD metrics", () => {
    const metrics = getHudMetrics(
      snapshot({ collisions: 2, wrongGates: 0, resets: 1 }),
    );

    expect(metrics.map((metric) => metric.label)).toEqual([
      "충돌",
      "리셋",
    ]);
    expect(metrics.map((metric) => metric.value)).toEqual(["2", "1"]);
  });
});

describe("leaderboard rows", () => {
  it("sorts local records and maps Korean display metadata", () => {
    const rows = createLeaderboardRows([
      result({ id: "slow", nickname: "느림", finalMs: 70_000, elapsedMs: 70_000 }),
      result({
        id: "fast",
        nickname: "빠름",
        themeId: "neon-night",
        finalMs: 55_500,
        elapsedMs: 54_500,
        penaltyMs: 1_000,
      }),
    ]);

    expect(rows.map((row) => row.id)).toEqual(["fast", "slow"]);
    expect(rows[0]).toMatchObject({
      rank: 1,
      nickname: "빠름",
      finalTime: "0:55.5",
      penaltyTime: "+0:01.0",
      themeLabel: "B. 네온 나이트",
      courseLabel: "training-arena-01 v2026.06",
    });
  });
});

describe("touch controls", () => {
  it("normalizes pointer positions around the stick center and clamps to unit range", () => {
    const rect = { left: 100, top: 50, width: 120, height: 120 };

    expect(normalizeTouchStickPoint(160, 110, rect)).toEqual({ x: 0, y: 0 });
    expect(normalizeTouchStickPoint(220, 50, rect)).toEqual({ x: 1, y: 1 });
    expect(normalizeTouchStickPoint(20, 230, rect)).toEqual({ x: -1, y: -1 });
  });
});
