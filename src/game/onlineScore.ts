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

export interface OnlineScoreResponse {
  success: boolean;
  updated: boolean;
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

function parsePositiveInt(value: string, fieldName: string): number {
  const parsed = Number.parseInt(value, 10);

  if (!Number.isInteger(parsed) || parsed <= 0) {
    throw new Error(`${fieldName}을 입력해 주세요.`);
  }

  return parsed;
}

export function createOnlineScorePayload(
  profile: PlayerProfile,
  result: RaceResult,
): OnlineScorePayload {
  const school = profile.school.trim();
  const nickname = profile.nickname.trim();

  if (school.length < 2) {
    throw new Error("학교 이름을 2자 이상 입력해 주세요.");
  }

  if (nickname.length < 2) {
    throw new Error("닉네임을 2자 이상 입력해 주세요.");
  }

  return {
    school,
    grade: parsePositiveInt(profile.grade, "학년"),
    classNumber: parsePositiveInt(profile.classNumber, "반"),
    studentNumber: parsePositiveInt(profile.studentNumber, "번호"),
    nickname,
    stage: result.courseId,
    hoverMode: result.hoverAssistEnabled,
    clearTimeMs: Math.max(0, Math.round(result.finalMs)),
    score: clearTimeMsToScore(result.finalMs),
  };
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
