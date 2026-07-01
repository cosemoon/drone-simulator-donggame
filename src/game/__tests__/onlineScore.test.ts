import { describe, expect, it } from "vitest";
import {
  clearTimeMsToScore,
  createOnlineScorePayload,
  normalizeScoreboardBaseUrl,
} from "../onlineScore";
import type { PlayerProfile, RaceResult } from "../types";

function profile(overrides: Partial<PlayerProfile> = {}): PlayerProfile {
  return {
    school: "하늘초",
    grade: "5",
    classNumber: "2",
    studentNumber: "14",
    nickname: "민준",
    ...overrides,
  };
}

function result(overrides: Partial<RaceResult> = {}): RaceResult {
  return {
    id: "record-1",
    nickname: "민준",
    courseId: "training-arena-01",
    courseVersion: "2026.06",
    themeId: "clean-sim",
    hoverAssistEnabled: true,
    maxSpeedMetersPerSecond: 12,
    elapsedMs: 60_000,
    penaltyMs: 1_250,
    finalMs: 61_250,
    collisions: 0,
    wrongGates: 0,
    gateClips: 0,
    resets: 0,
    outOfBounds: 0,
    completedAt: "2026-07-01T00:00:00.000Z",
    buildVersion: "test",
    ...overrides,
  };
}

describe("online score helpers", () => {
  it("turns shorter clear times into higher bounded scores", () => {
    expect(clearTimeMsToScore(61_250)).toBe(938_749);
    expect(clearTimeMsToScore(-100)).toBe(999_999);
    expect(clearTimeMsToScore(2_000_000)).toBe(0);
  });

  it("builds the public scoreboard payload from profile and the best result", () => {
    expect(createOnlineScorePayload(profile(), result())).toEqual({
      school: "하늘초",
      grade: 5,
      classNumber: 2,
      studentNumber: 14,
      nickname: "민준",
      stage: "training-arena-01",
      hoverMode: true,
      clearTimeMs: 61_250,
      score: 938_749,
    });
  });

  it("normalizes optional scoreboard URLs without leaking secrets into clients", () => {
    expect(normalizeScoreboardBaseUrl(" https://scores.example/ ")).toBe(
      "https://scores.example",
    );
    expect(normalizeScoreboardBaseUrl("")).toBeNull();
    expect(normalizeScoreboardBaseUrl("not a url")).toBeNull();
  });
});
