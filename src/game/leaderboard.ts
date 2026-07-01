import { gameThemeById } from "./themes";
import {
  STORAGE_KEYS,
  createStorageAdapter,
  readJsonValue,
  writeJsonValue,
} from "./storage";
import type { StorageLike } from "./storage";
import type { RaceResult, ThemeId } from "./types";

export const LOCAL_LEADERBOARD_MAX_RECORDS_PER_COURSE = 50;

type LeaderboardStore = Record<string, RaceResult[]>;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(gameThemeById, value)
  );
}

function isFiniteNonNegativeNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0;
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isInteger(value) && Number(value) >= 0;
}

function completedAtMs(result: RaceResult): number {
  const timestamp = Date.parse(result.completedAt);
  return Number.isFinite(timestamp) ? timestamp : Number.MAX_SAFE_INTEGER;
}

export function sortRaceResults(
  results: readonly RaceResult[],
): RaceResult[] {
  return [...results].sort(
    (a, b) =>
      a.finalMs - b.finalMs ||
      completedAtMs(a) - completedAtMs(b) ||
      a.id.localeCompare(b.id),
  );
}

export function sanitizeRaceResult(value: unknown): RaceResult | null {
  if (!isRecord(value)) {
    return null;
  }

  if (
    !isNonEmptyString(value.id) ||
    !isNonEmptyString(value.nickname) ||
    !isNonEmptyString(value.courseId) ||
    !isNonEmptyString(value.courseVersion) ||
    !isThemeId(value.themeId) ||
    !isFiniteNonNegativeNumber(value.elapsedMs) ||
    !isFiniteNonNegativeNumber(value.penaltyMs) ||
    !isFiniteNonNegativeNumber(value.finalMs) ||
    value.finalMs !== value.elapsedMs + value.penaltyMs ||
    !isNonNegativeInteger(value.collisions) ||
    !isNonNegativeInteger(value.wrongGates) ||
    !isNonNegativeInteger(value.gateClips) ||
    !isNonNegativeInteger(value.resets) ||
    !isNonNegativeInteger(value.outOfBounds) ||
    !isNonEmptyString(value.completedAt) ||
    !Number.isFinite(Date.parse(value.completedAt)) ||
    !isNonEmptyString(value.buildVersion)
  ) {
    return null;
  }

  return {
    id: value.id.trim(),
    nickname: value.nickname.trim(),
    courseId: value.courseId.trim(),
    courseVersion: value.courseVersion.trim(),
    themeId: value.themeId,
    elapsedMs: value.elapsedMs,
    penaltyMs: value.penaltyMs,
    finalMs: value.finalMs,
    collisions: value.collisions,
    wrongGates: value.wrongGates,
    gateClips: value.gateClips,
    resets: value.resets,
    outOfBounds: value.outOfBounds,
    completedAt: value.completedAt,
    buildVersion: value.buildVersion.trim(),
  };
}

function clampResults(
  results: readonly RaceResult[],
  maxRecordsPerCourse: number,
): RaceResult[] {
  return sortRaceResults(results).slice(0, maxRecordsPerCourse);
}

function sanitizeLeaderboardStore(
  value: unknown,
  maxRecordsPerCourse: number,
): LeaderboardStore {
  if (!isRecord(value)) {
    return {};
  }

  const store: LeaderboardStore = {};

  for (const entries of Object.values(value)) {
    if (!Array.isArray(entries)) {
      continue;
    }

    for (const entry of entries) {
      const result = sanitizeRaceResult(entry);

      if (!result) {
        continue;
      }

      const courseResults = store[result.courseId] ?? [];
      store[result.courseId] = clampResults(
        [...courseResults, result],
        maxRecordsPerCourse,
      );
    }
  }

  return store;
}

function readLeaderboardStore(
  storage: StorageLike,
  maxRecordsPerCourse: number,
): LeaderboardStore {
  return sanitizeLeaderboardStore(
    readJsonValue(storage, STORAGE_KEYS.localLeaderboard),
    maxRecordsPerCourse,
  );
}

function writeLeaderboardStore(
  storage: StorageLike,
  store: LeaderboardStore,
  maxRecordsPerCourse: number,
): void {
  const sanitizedStore = sanitizeLeaderboardStore(store, maxRecordsPerCourse);
  writeJsonValue(storage, STORAGE_KEYS.localLeaderboard, sanitizedStore);
}

function normalizeLimit(limit: number): number {
  if (!Number.isFinite(limit)) {
    return 0;
  }

  return Math.max(0, Math.floor(limit));
}

export interface LocalLeaderboard {
  addResult(result: RaceResult): RaceResult[];
  readResults(courseId: string): RaceResult[];
  clearResults(courseId?: string): void;
  topResults(courseId: string, limit?: number): RaceResult[];
}

export function createLocalLeaderboard(
  storage: StorageLike = createStorageAdapter(),
  options: { maxRecordsPerCourse?: number } = {},
): LocalLeaderboard {
  const maxRecordsPerCourse =
    options.maxRecordsPerCourse ?? LOCAL_LEADERBOARD_MAX_RECORDS_PER_COURSE;

  const readResults = (courseId: string): RaceResult[] => {
    const store = readLeaderboardStore(storage, maxRecordsPerCourse);
    return clampResults(store[courseId] ?? [], maxRecordsPerCourse);
  };

  return {
    addResult(result) {
      const sanitizedResult = sanitizeRaceResult(result);

      if (!sanitizedResult) {
        return [];
      }

      const store = readLeaderboardStore(storage, maxRecordsPerCourse);
      const nextResults = clampResults(
        [...(store[sanitizedResult.courseId] ?? []), sanitizedResult],
        maxRecordsPerCourse,
      );

      writeLeaderboardStore(
        storage,
        { ...store, [sanitizedResult.courseId]: nextResults },
        maxRecordsPerCourse,
      );

      return nextResults;
    },
    readResults,
    clearResults(courseId) {
      if (!courseId) {
        storage.removeItem(STORAGE_KEYS.localLeaderboard);
        return;
      }

      const store = readLeaderboardStore(storage, maxRecordsPerCourse);
      const { [courseId]: _removed, ...remainingStore } = store;
      writeLeaderboardStore(storage, remainingStore, maxRecordsPerCourse);
    },
    topResults(courseId, limit = 10) {
      return readResults(courseId).slice(0, normalizeLimit(limit));
    },
  };
}

export function addLocalRaceResult(
  result: RaceResult,
  storage: StorageLike = createStorageAdapter(),
): RaceResult[] {
  return createLocalLeaderboard(storage).addResult(result);
}

export function readLocalRaceResults(
  courseId: string,
  storage: StorageLike = createStorageAdapter(),
): RaceResult[] {
  return createLocalLeaderboard(storage).readResults(courseId);
}

export function clearLocalRaceResults(
  courseId?: string,
  storage: StorageLike = createStorageAdapter(),
): void {
  createLocalLeaderboard(storage).clearResults(courseId);
}

export function getTopLocalRaceResults(
  courseId: string,
  limit = 10,
  storage: StorageLike = createStorageAdapter(),
): RaceResult[] {
  return createLocalLeaderboard(storage).topResults(courseId, limit);
}
