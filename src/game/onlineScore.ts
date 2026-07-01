import type { PlayerProfile, RaceResult } from "./types";

export interface OnlineScorePayload {
  school: string;
  grade: number;
  classNumber: number;
  studentNumber: number;
  nickname: string;
  stage: string;
  hoverMode: boolean;
  clearTimeMs: number;
  score: number;
}

export interface ManualOnlineScoreInput {
  stage: string | number;
  hoverMode: boolean;
  score: string | number;
}

export interface OnlineScoreResponse {
  success: boolean;
  updated: boolean;
  accepted?: boolean;
  retryAfterSeconds?: number;
  item?: unknown;
  error?: string;
}

const MAX_SCORE = 999_999;

export const DEFAULT_SCOREBOARD_BASE_URL =
  "https://drone-simulator-donggame-online-scoreboard.pages.dev";

export function clearTimeMsToScore(clearTimeMs: number): number {
  const safeTime = Number.isFinite(clearTimeMs)
    ? Math.max(0, Math.round(clearTimeMs))
    : MAX_SCORE;

  return Math.max(0, MAX_SCORE - safeTime);
}

export function scoreToClearTimeMs(score: number): number {
  const safeScore = Number.isFinite(score)
    ? Math.min(MAX_SCORE, Math.max(0, Math.round(score)))
    : 0;

  return MAX_SCORE - safeScore;
}

export function courseIdToStageNumber(courseId: string): string {
  const matches = courseId.match(/\d+/g);
  const lastNumber = matches ? matches[matches.length - 1] : undefined;
  const parsed = Number.parseInt(lastNumber ?? "1", 10);

  return Number.isInteger(parsed) && parsed > 0 ? String(parsed) : "1";
}

function parsePositiveInt(value: string, fieldName: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName}을 입력해 주세요.`);
  }

  return parsed;
}

function parseNaturalStage(value: string | number): string {
  const parsed =
    typeof value === "number" ? value : Number.parseInt(String(value), 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error("스테이지는 1 이상의 자연수여야 합니다.");
  }

  return String(parsed);
}

function parseScore(value: string | number): number {
  const parsed = typeof value === "number" ? value : Number(String(value).trim());

  if (!Number.isInteger(parsed) || parsed < 0 || parsed > MAX_SCORE) {
    throw new Error("점수는 0부터 999999까지의 정수여야 합니다.");
  }

  return parsed;
}

function normalizedProfile(profile: PlayerProfile) {
  const school = profile.school.trim();
  const nickname = profile.nickname.trim();

  if (school.length < 2) {
    throw new Error("학교 이름을 2글자 이상 입력해 주세요.");
  }

  if (nickname.length < 2) {
    throw new Error("닉네임을 2글자 이상 입력해 주세요.");
  }

  return {
    school,
    grade: parsePositiveInt(profile.grade, "학년"),
    classNumber: parsePositiveInt(profile.classNumber, "반"),
    studentNumber: parsePositiveInt(profile.studentNumber, "번호"),
    nickname,
  };
}

export function createManualOnlineScorePayload(
  profile: PlayerProfile,
  input: ManualOnlineScoreInput,
): OnlineScorePayload {
  const normalized = normalizedProfile(profile);
  const score = parseScore(input.score);

  return {
    ...normalized,
    stage: parseNaturalStage(input.stage),
    hoverMode: input.hoverMode,
    clearTimeMs: scoreToClearTimeMs(score),
    score,
  };
}

export function createOnlineScorePayload(
  profile: PlayerProfile,
  result: RaceResult,
): OnlineScorePayload {
  return createManualOnlineScorePayload(profile, {
    stage: courseIdToStageNumber(result.courseId),
    hoverMode: result.hoverAssistEnabled,
    score: clearTimeMsToScore(result.finalMs),
  });
}

export function normalizeScoreboardBaseUrl(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value.trim());

    if (
      url.protocol !== "https:" &&
      url.hostname !== "localhost" &&
      url.hostname !== "127.0.0.1"
    ) {
      return null;
    }

    return url.origin;
  } catch {
    return null;
  }
}

export function resolveScoreboardBaseUrl(value: string | undefined): string {
  return normalizeScoreboardBaseUrl(value) ?? DEFAULT_SCOREBOARD_BASE_URL;
}

export async function submitOnlineScore(
  baseUrl: string,
  payload: OnlineScorePayload,
): Promise<OnlineScoreResponse> {
  const response = await fetch(`${baseUrl}/api/submit-score`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      accept: "application/json",
    },
    body: JSON.stringify(payload),
  });
  const data = (await response.json().catch(() => ({}))) as OnlineScoreResponse;

  if (!response.ok) {
    throw new Error(data.error ?? `점수 제출 실패 (${response.status})`);
  }

  return data;
}
