import { RotateCcw, Trophy } from "lucide-react";
import type { PlayerProfile, RaceResult } from "../game/types";
import { formatPenalty, formatRaceTime } from "./Hud";
import { Leaderboard } from "./Leaderboard";
import { ScoreSubmitPanel } from "./ScoreSubmitPanel";

export interface FinishModalProps {
  open: boolean;
  result: RaceResult | null;
  records: readonly RaceResult[];
  playerProfile: PlayerProfile;
  scoreValue: string;
  submissionStage: string;
  submissionHoverMode: boolean;
  onlineSubmit: {
    status: "idle" | "submitting" | "success" | "error";
    message: string;
  };
  scoreboardEnabled: boolean;
  onPlayerProfileChange: (profile: PlayerProfile) => void;
  onScoreChange: (value: string) => void;
  onSubmitScore: () => void | Promise<void>;
  onRestart: () => void;
}

interface PenaltyLine {
  label: string;
  count: number;
}

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

export function FinishModal({
  open,
  result,
  records,
  playerProfile,
  scoreValue,
  submissionStage,
  submissionHoverMode,
  onlineSubmit,
  scoreboardEnabled,
  onPlayerProfileChange,
  onScoreChange,
  onSubmitScore,
  onRestart,
}: FinishModalProps) {
  if (!open) {
    return null;
  }

  const penaltyLines = createPenaltyLines(result);

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
            <h2 id="finish-modal-title">주행 기록</h2>
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
            <dt>패널티</dt>
            <dd>{result ? formatPenalty(result.penaltyMs) : "+0:00.0"}</dd>
          </div>
        </dl>

        <section className="penalty-breakdown" aria-label="패널티 상세">
          <h3>패널티 상세</h3>
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

        <ScoreSubmitPanel
          title="온라인 점수 제출"
          stage={submissionStage}
          hoverMode={submissionHoverMode}
          scoreValue={scoreValue}
          playerProfile={playerProfile}
          onlineSubmit={onlineSubmit}
          scoreboardEnabled={scoreboardEnabled}
          helperText="원하는 점수를 입력해 온라인 점수판에 제출합니다."
          submitLabel="점수 제출"
          onPlayerProfileChange={onPlayerProfileChange}
          onScoreChange={onScoreChange}
          onSubmitScore={onSubmitScore}
        />

        <button type="button" className="secondary-button" onClick={onRestart}>
          <RotateCcw aria-hidden="true" size={18} />
          다시 시작
        </button>
      </section>
    </div>
  );
}
