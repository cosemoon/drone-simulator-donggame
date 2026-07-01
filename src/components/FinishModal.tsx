import { RotateCcw, Trophy, Upload } from "lucide-react";
import type { PlayerProfile, RaceResult } from "../game/types";
import { formatPenalty, formatRaceTime } from "./Hud";
import { Leaderboard } from "./Leaderboard";

export interface FinishModalProps {
  open: boolean;
  result: RaceResult | null;
  records: readonly RaceResult[];
  playerProfile: PlayerProfile;
  onlineSubmit: {
    status: "idle" | "submitting" | "success" | "error";
    message: string;
  };
  scoreboardEnabled: boolean;
  onPlayerProfileChange: (profile: PlayerProfile) => void;
  onSubmitBestScore: () => void | Promise<void>;
  onRestart: () => void;
}

interface PenaltyLine {
  label: string;
  count: number;
}

type ProfileField = keyof PlayerProfile;

const numericProfileFields = new Set<ProfileField>([
  "grade",
  "classNumber",
  "studentNumber",
]);

const profileFieldMaxLength: Record<ProfileField, number> = {
  school: 30,
  grade: 2,
  classNumber: 2,
  studentNumber: 3,
  nickname: 20,
};

function createPenaltyLines(result: RaceResult | null): PenaltyLine[] {
  if (!result) {
    return [];
  }

  return [
    { label: "충돌", count: result.collisions },
    { label: "순서 오류", count: result.wrongGates },
    { label: "게이트 접촉", count: result.gateClips },
    { label: "리셋", count: result.resets },
    { label: "코스 이탈", count: result.outOfBounds },
  ].filter((line) => line.count > 0);
}

function normalizeProfileInput(field: ProfileField, value: string): string {
  const maxLength = profileFieldMaxLength[field];

  if (numericProfileFields.has(field)) {
    return value.replace(/\D+/g, "").slice(0, maxLength);
  }

  return value.slice(0, maxLength);
}

export function FinishModal({
  open,
  result,
  records,
  playerProfile,
  onlineSubmit,
  scoreboardEnabled,
  onPlayerProfileChange,
  onSubmitBestScore,
  onRestart,
}: FinishModalProps) {
  if (!open) {
    return null;
  }

  const penaltyLines = createPenaltyLines(result);
  const bestResult = records[0] ?? result;
  const submitDisabled =
    !bestResult || onlineSubmit.status === "submitting" || !scoreboardEnabled;

  const updateProfile = (field: ProfileField, value: string) => {
    onPlayerProfileChange({
      ...playerProfile,
      [field]: normalizeProfileInput(field, value),
    });
  };

  return (
    <div className="menu-scrim" role="presentation">
      <section
        className="finish-modal panel-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="finish-modal-title"
      >
        <div className="finish-summary">
          <Trophy aria-hidden="true" size={26} />
          <div>
            <p className="panel-kicker">레이스 완료</p>
            <h2 id="finish-modal-title">완주 기록</h2>
          </div>
        </div>

        <dl className="finish-stats">
          <div>
            <dt>최종</dt>
            <dd>{result ? formatRaceTime(result.finalMs) : "0:00.0"}</dd>
          </div>
          <div>
            <dt>비행</dt>
            <dd>{result ? formatRaceTime(result.elapsedMs) : "0:00.0"}</dd>
          </div>
          <div>
            <dt>페널티</dt>
            <dd>{result ? formatPenalty(result.penaltyMs) : "+0:00.0"}</dd>
          </div>
        </dl>

        <section className="penalty-breakdown" aria-label="페널티 상세">
          <h3>페널티 상세</h3>
          {penaltyLines.length === 0 ? (
            <p>감점 없이 통과했습니다.</p>
          ) : (
            <ul>
              {penaltyLines.map((line) => (
                <li key={line.label}>
                  <span>{line.label}</span>
                  <strong>{line.count}</strong>
                </li>
              ))}
            </ul>
          )}
        </section>

        <Leaderboard records={records} latestId={result?.id} limit={5} />

        <section className="score-submit-panel" aria-label="온라인 최고점 제출">
          <div className="panel-heading">
            <h3>온라인 최고점 제출</h3>
            <span>{bestResult ? formatRaceTime(bestResult.finalMs) : "기록 없음"}</span>
          </div>

          <div className="profile-grid">
            <label>
              학교 이름
              <input
                value={playerProfile.school}
                maxLength={profileFieldMaxLength.school}
                autoComplete="organization"
                onChange={(event) => updateProfile("school", event.currentTarget.value)}
              />
            </label>
            <label>
              학년
              <input
                value={playerProfile.grade}
                inputMode="numeric"
                maxLength={profileFieldMaxLength.grade}
                onChange={(event) => updateProfile("grade", event.currentTarget.value)}
              />
            </label>
            <label>
              반
              <input
                value={playerProfile.classNumber}
                inputMode="numeric"
                maxLength={profileFieldMaxLength.classNumber}
                onChange={(event) =>
                  updateProfile("classNumber", event.currentTarget.value)
                }
              />
            </label>
            <label>
              번호
              <input
                value={playerProfile.studentNumber}
                inputMode="numeric"
                maxLength={profileFieldMaxLength.studentNumber}
                onChange={(event) =>
                  updateProfile("studentNumber", event.currentTarget.value)
                }
              />
            </label>
            <label>
              닉네임
              <input
                value={playerProfile.nickname}
                maxLength={profileFieldMaxLength.nickname}
                autoComplete="nickname"
                onChange={(event) => updateProfile("nickname", event.currentTarget.value)}
              />
            </label>
          </div>

          <div className="score-submit-summary">
            <span>
              스테이지 <strong>{bestResult?.courseId ?? "-"}</strong>
            </span>
            <span>
              호버 모드 <strong>{bestResult?.hoverAssistEnabled ? "ON" : "OFF"}</strong>
            </span>
            <span>
              클리어 시간{" "}
              <strong>
                {bestResult ? formatRaceTime(bestResult.finalMs) : "0:00.0"}
              </strong>
            </span>
          </div>

          <button
            type="button"
            className="primary-button submit-score-button"
            disabled={submitDisabled}
            onClick={onSubmitBestScore}
          >
            <Upload aria-hidden="true" size={18} />
            {onlineSubmit.status === "submitting" ? "제출 중" : "최고점 제출"}
          </button>

          <p
            className="submit-state"
            data-tone={onlineSubmit.status === "error" ? "error" : "neutral"}
          >
            {onlineSubmit.message ||
              (scoreboardEnabled
                ? "버튼을 누를 때만 온라인 점수판에 제출됩니다."
                : "온라인 점수판 주소 설정 후 제출할 수 있습니다.")}
          </p>
        </section>

        <button type="button" className="secondary-button" onClick={onRestart}>
          <RotateCcw aria-hidden="true" size={18} />
          다시 시작
        </button>
      </section>
    </div>
  );
}
