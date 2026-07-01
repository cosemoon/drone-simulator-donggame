import { Upload } from "lucide-react";
import type { PlayerProfile } from "../game/types";

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

const profileFieldLabels: Record<ProfileField, string> = {
  school: "학교 이름",
  grade: "학년",
  classNumber: "반",
  studentNumber: "번호",
  nickname: "닉네임",
};

function normalizeProfileInput(field: ProfileField, value: string): string {
  const maxLength = profileFieldMaxLength[field];

  if (numericProfileFields.has(field)) {
    return value.replace(/\D+/g, "").slice(0, maxLength);
  }

  return value.slice(0, maxLength);
}

export interface ScoreSubmitPanelProps {
  title: string;
  stage: string;
  hoverMode: boolean;
  scoreValue: string;
  playerProfile: PlayerProfile;
  onlineSubmit: {
    status: "idle" | "submitting" | "success" | "error";
    message: string;
  };
  scoreboardEnabled: boolean;
  helperText: string;
  submitLabel?: string;
  onPlayerProfileChange: (profile: PlayerProfile) => void;
  onScoreChange: (value: string) => void;
  onSubmitScore: () => void | Promise<void>;
}

export function ScoreSubmitPanel({
  title,
  stage,
  hoverMode,
  scoreValue,
  playerProfile,
  onlineSubmit,
  scoreboardEnabled,
  helperText,
  submitLabel = "점수 제출",
  onPlayerProfileChange,
  onScoreChange,
  onSubmitScore,
}: ScoreSubmitPanelProps) {
  const submitDisabled =
    onlineSubmit.status === "submitting" ||
    !scoreboardEnabled ||
    scoreValue.trim().length === 0;

  const updateProfile = (field: ProfileField, value: string) => {
    onPlayerProfileChange({
      ...playerProfile,
      [field]: normalizeProfileInput(field, value),
    });
  };

  return (
    <section className="score-submit-panel" aria-label={title}>
      <div className="panel-heading">
        <h3>{title}</h3>
        <span>{scoreValue || "0"}점</span>
      </div>

      <div className="profile-grid">
        {(Object.keys(profileFieldLabels) as ProfileField[]).map((field) => (
          <label key={field}>
            {profileFieldLabels[field]}
            <input
              value={playerProfile[field]}
              inputMode={numericProfileFields.has(field) ? "numeric" : undefined}
              maxLength={profileFieldMaxLength[field]}
              autoComplete={field === "school" ? "organization" : field === "nickname" ? "nickname" : undefined}
              onChange={(event) => updateProfile(field, event.currentTarget.value)}
            />
          </label>
        ))}
      </div>

      <label className="score-input-row">
        <span>
          <strong>제출 점수</strong>
          <small>0부터 999999까지 입력할 수 있습니다.</small>
        </span>
        <input
          value={scoreValue}
          inputMode="numeric"
          maxLength={6}
          placeholder="예: 8400"
          onChange={(event) =>
            onScoreChange(event.currentTarget.value.replace(/\D+/g, "").slice(0, 6))
          }
        />
      </label>

      <div className="score-submit-summary">
        <span>
          스테이지 <strong>{stage}</strong>
        </span>
        <span>
          호버 모드 <strong>{hoverMode ? "ON" : "OFF"}</strong>
        </span>
        <span>
          점수 <strong>{scoreValue || "0"}</strong>
        </span>
      </div>

      <button
        type="button"
        className="primary-button submit-score-button"
        disabled={submitDisabled}
        onClick={onSubmitScore}
      >
        <Upload aria-hidden="true" size={18} />
        {onlineSubmit.status === "submitting" ? "제출 중" : submitLabel}
      </button>

      <p
        className="submit-state"
        data-tone={onlineSubmit.status === "error" ? "error" : "neutral"}
      >
        {onlineSubmit.message ||
          (scoreboardEnabled
            ? helperText
            : "온라인 점수판 주소 설정 후 제출할 수 있습니다.")}
      </p>
    </section>
  );
}
