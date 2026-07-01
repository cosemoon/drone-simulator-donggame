import { sortRaceResults } from "../game/leaderboard";
import type { RaceResult, ThemeId } from "../game/types";
import { formatPenalty, formatRaceTime } from "./Hud";

export interface LeaderboardRow {
  id: string;
  rank: number;
  nickname: string;
  finalTime: string;
  penaltyTime: string;
  themeLabel: string;
  courseLabel: string;
  completedAt: string;
}

export interface LeaderboardProps {
  records: readonly RaceResult[];
  latestId?: string | null;
  limit?: number;
  title?: string;
}

const themeLabels: Record<ThemeId, string> = {
  "clean-sim": "A. 클린 시뮬레이터",
  "neon-night": "B. 네온 나이트",
  "high-contrast": "C. 하이 콘트라스트",
};

function formatCompletedAt(value: string): string {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "날짜 없음";
  }

  return new Intl.DateTimeFormat("ko-KR", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

export function createLeaderboardRows(
  records: readonly RaceResult[],
  limit = 5,
): LeaderboardRow[] {
  return sortRaceResults(records)
    .slice(0, Math.max(0, Math.floor(limit)))
    .map((record, index) => ({
      id: record.id,
      rank: index + 1,
      nickname: record.nickname,
      finalTime: formatRaceTime(record.finalMs),
      penaltyTime: formatPenalty(record.penaltyMs),
      themeLabel: themeLabels[record.themeId],
      courseLabel: `${record.courseId} v${record.courseVersion}`,
      completedAt: formatCompletedAt(record.completedAt),
    }));
}

export function Leaderboard({
  records,
  latestId = null,
  limit = 5,
  title = "로컬 기록",
}: LeaderboardProps) {
  const rows = createLeaderboardRows(records, limit);

  return (
    <section className="leaderboard-panel" aria-label={title}>
      <div className="panel-heading">
        <h2>{title}</h2>
        <span>{rows.length}개</span>
      </div>
      {rows.length === 0 ? (
        <p className="leaderboard-empty">아직 저장된 기록이 없습니다.</p>
      ) : (
        <ol className="leaderboard-list">
          {rows.map((row) => (
            <li
              className="leaderboard-row"
              data-latest={row.id === latestId ? "true" : "false"}
              key={row.id}
            >
              <span className="leaderboard-rank">{row.rank}</span>
              <span className="leaderboard-driver">
                <strong>{row.nickname}</strong>
                <small>{row.themeLabel}</small>
              </span>
              <span className="leaderboard-time">
                <strong>{row.finalTime}</strong>
                <small>페널티 {row.penaltyTime}</small>
              </span>
              <span className="leaderboard-meta">
                <small>{row.courseLabel}</small>
                <small>{row.completedAt}</small>
              </span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
