import { RotateCcw, Trophy } from "lucide-react";
import type { RaceResult } from "../game/types";
import { formatPenalty, formatRaceTime } from "./Hud";
import { Leaderboard } from "./Leaderboard";

export interface FinishModalProps {
  open: boolean;
  result: RaceResult | null;
  records: readonly RaceResult[];
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
    { label: "오진입", count: result.wrongGates },
    { label: "게이트 접촉", count: result.gateClips },
    { label: "리셋", count: result.resets },
    { label: "코스 이탈", count: result.outOfBounds },
  ].filter((line) => line.count > 0);
}

export function FinishModal({
  open,
  result,
  records,
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

        <button type="button" className="primary-button" onClick={onRestart}>
          <RotateCcw aria-hidden="true" size={18} />
          다시 시작
        </button>
      </section>
    </div>
  );
}
