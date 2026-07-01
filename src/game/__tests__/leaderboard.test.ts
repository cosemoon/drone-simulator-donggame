import { describe, expect, it } from "vitest";
import {
  LOCAL_LEADERBOARD_MAX_RECORDS_PER_COURSE,
  createLocalLeaderboard,
  sortRaceResults,
} from "../leaderboard";
import { STORAGE_KEYS, createMemoryStorage } from "../storage";
import type { RaceResult } from "../types";

function raceResult(overrides: Partial<RaceResult> = {}): RaceResult {
  const finalMs = overrides.finalMs ?? 10_000;
  const penaltyMs = overrides.penaltyMs ?? 0;
  const elapsedMs = overrides.elapsedMs ?? finalMs - penaltyMs;

  return {
    id: "result-1",
    nickname: "Pilot",
    courseId: "training-arena-01",
    courseVersion: "2026.06.30",
    themeId: "high-contrast",
    hoverAssistEnabled: true,
    maxSpeedMetersPerSecond: 12,
    elapsedMs,
    penaltyMs,
    finalMs,
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

describe("sortRaceResults", () => {
  it("sorts by final time, then completion time, then id", () => {
    const sorted = sortRaceResults([
      raceResult({
        id: "c",
        finalMs: 9_000,
        completedAt: "2026-06-30T00:00:01.000Z",
      }),
      raceResult({
        id: "b",
        finalMs: 9_000,
        completedAt: "2026-06-30T00:00:00.000Z",
      }),
      raceResult({
        id: "a",
        finalMs: 9_000,
        completedAt: "2026-06-30T00:00:00.000Z",
      }),
      raceResult({ id: "slow", finalMs: 12_000 }),
    ]);

    expect(sorted.map((result) => result.id)).toEqual(["a", "b", "c", "slow"]);
  });
});

describe("createLocalLeaderboard", () => {
  it("adds results and reads only the requested course", () => {
    const leaderboard = createLocalLeaderboard(createMemoryStorage());

    leaderboard.addResult(raceResult({ id: "training-1" }));
    leaderboard.addResult(
      raceResult({ id: "advanced-1", courseId: "advanced-course" }),
    );

    expect(
      leaderboard.readResults("training-arena-01").map((result) => result.id),
    ).toEqual(["training-1"]);
    expect(
      leaderboard.readResults("advanced-course").map((result) => result.id),
    ).toEqual(["advanced-1"]);
  });

  it("returns the top N records for a course", () => {
    const leaderboard = createLocalLeaderboard(createMemoryStorage());

    leaderboard.addResult(raceResult({ id: "third", finalMs: 13_000 }));
    leaderboard.addResult(raceResult({ id: "first", finalMs: 11_000 }));
    leaderboard.addResult(raceResult({ id: "second", finalMs: 12_000 }));

    expect(
      leaderboard.topResults("training-arena-01", 2).map((result) => result.id),
    ).toEqual(["first", "second"]);
  });

  it("clamps stored results per course", () => {
    const leaderboard = createLocalLeaderboard(createMemoryStorage());

    for (let index = 0; index < LOCAL_LEADERBOARD_MAX_RECORDS_PER_COURSE + 5; index += 1) {
      leaderboard.addResult(
        raceResult({
          id: `result-${index.toString().padStart(2, "0")}`,
          finalMs: index,
        }),
      );
    }

    const results = leaderboard.readResults("training-arena-01");

    expect(results).toHaveLength(LOCAL_LEADERBOARD_MAX_RECORDS_PER_COURSE);
    expect(results[results.length - 1]?.finalMs).toBe(
      LOCAL_LEADERBOARD_MAX_RECORDS_PER_COURSE - 1,
    );
  });

  it("drops invalid stored entries without crashing", () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.localLeaderboard]: JSON.stringify({
        "training-arena-01": [
          raceResult({ id: "valid" }),
          { id: "bad-time", courseId: "training-arena-01", finalMs: "fast" },
          null,
        ],
      }),
    });
    const leaderboard = createLocalLeaderboard(storage);

    expect(
      leaderboard.readResults("training-arena-01").map((result) => result.id),
    ).toEqual(["valid"]);
  });

  it("drops impossible final time records before they can sort ahead", () => {
    const leaderboard = createLocalLeaderboard(createMemoryStorage());

    leaderboard.addResult(raceResult({ id: "valid", finalMs: 12_000 }));
    leaderboard.addResult(
      raceResult({
        id: "impossible",
        elapsedMs: 10_000,
        penaltyMs: 5_000,
        finalMs: 1,
      }),
    );

    expect(
      leaderboard.topResults("training-arena-01", 5).map((result) => result.id),
    ).toEqual(["valid"]);
  });

  it("drops records with invalid inherited theme ids", () => {
    const leaderboard = createLocalLeaderboard(createMemoryStorage());

    leaderboard.addResult(raceResult({ id: "valid", finalMs: 12_000 }));
    leaderboard.addResult(
      raceResult({
        id: "invalid-theme",
        themeId: "toString" as RaceResult["themeId"],
        finalMs: 8_000,
      }),
    );

    expect(
      leaderboard.topResults("training-arena-01", 5).map((result) => result.id),
    ).toEqual(["valid"]);
  });

  it("recovers from corrupted leaderboard JSON", () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.localLeaderboard]: "{broken",
    });
    const leaderboard = createLocalLeaderboard(storage);

    expect(leaderboard.readResults("training-arena-01")).toEqual([]);
  });

  it("clears local results for one course or all courses", () => {
    const leaderboard = createLocalLeaderboard(createMemoryStorage());

    leaderboard.addResult(raceResult({ id: "training-1" }));
    leaderboard.addResult(
      raceResult({ id: "advanced-1", courseId: "advanced-course" }),
    );

    leaderboard.clearResults("training-arena-01");

    expect(leaderboard.readResults("training-arena-01")).toEqual([]);
    expect(leaderboard.readResults("advanced-course")).toHaveLength(1);

    leaderboard.clearResults();

    expect(leaderboard.readResults("advanced-course")).toEqual([]);
  });
});
