import { Camera, Pause, RotateCcw, Timer } from "lucide-react";
import type { GameSnapshot } from "../game/engine";

export interface HudMetric {
  label: string;
  value: string;
  tone?: "warning" | "danger";
}

export interface HudProps {
  snapshot: GameSnapshot | null;
  errorMessage?: string | null;
  onPause: () => void;
  onReset: () => void;
}

const statusLabels: Record<GameSnapshot["status"], string> = {
  ready: "준비",
  running: "비행",
  paused: "일시정지",
  finished: "완주",
  aborted: "중단",
};

const cameraLabels: Record<GameSnapshot["cameraMode"], string> = {
  chase: "추적",
  fpv: "FPV",
};

export function formatRaceTime(milliseconds: number): string {
  const safeMs = Math.max(0, Math.floor(milliseconds));
  const minutes = Math.floor(safeMs / 60_000);
  const seconds = Math.floor((safeMs % 60_000) / 1_000);
  const tenths = Math.floor((safeMs % 1_000) / 100);

  return `${minutes}:${seconds.toString().padStart(2, "0")}.${tenths}`;
}

export function formatPenalty(milliseconds: number): string {
  return `+${formatRaceTime(milliseconds)}`;
}

export function getHudMetrics(snapshot: GameSnapshot): HudMetric[] {
  return [
    {
      label: "충돌",
      value: String(snapshot.collisions),
      tone: "danger" as const,
    },
    {
      label: "오진입",
      value: String(snapshot.wrongGates),
      tone: "warning" as const,
    },
    {
      label: "게이트 접촉",
      value: String(snapshot.gateClips),
      tone: "warning" as const,
    },
    {
      label: "리셋",
      value: String(snapshot.resets),
      tone: "warning" as const,
    },
    {
      label: "이탈",
      value: String(snapshot.outOfBounds),
      tone: "danger" as const,
    },
  ].filter((metric) => Number(metric.value) > 0);
}

function gateLabel(snapshot: GameSnapshot): string {
  if (snapshot.status === "finished") {
    return `${snapshot.totalGateCount}/${snapshot.totalGateCount}`;
  }

  return `${snapshot.nextGateOrder ?? snapshot.totalGateCount}/${snapshot.totalGateCount}`;
}

export function Hud({
  snapshot,
  errorMessage,
  onPause,
  onReset,
}: HudProps) {
  const canUseActions = Boolean(snapshot && !errorMessage);
  const primaryTime =
    snapshot?.status === "finished"
      ? snapshot.finalMs
      : (snapshot?.elapsedMs ?? 0);
  const metrics = snapshot ? getHudMetrics(snapshot) : [];

  return (
    <header
      className="hud-strip"
      aria-live="polite"
      data-status={snapshot?.status ?? "loading"}
    >
      {errorMessage ? (
        <span className="hud-message">{errorMessage}</span>
      ) : snapshot ? (
        <>
          <span className="hud-status">{statusLabels[snapshot.status]}</span>
          <span className="hud-readout hud-readout--time">
            <Timer aria-hidden="true" size={15} />
            <span className="hud-label">
              {snapshot.status === "finished" ? "최종" : "시간"}
            </span>
            <strong>{formatRaceTime(primaryTime)}</strong>
          </span>
          <span className="hud-readout">
            <span className="hud-label">게이트</span>
            <strong>{gateLabel(snapshot)}</strong>
          </span>
          <span className="hud-readout">
            <span className="hud-label">페널티</span>
            <strong>{formatPenalty(snapshot.penaltyMs)}</strong>
          </span>
          <span className="hud-readout">
            <Camera aria-hidden="true" size={15} />
            <span className="hud-label">카메라</span>
            <strong>{cameraLabels[snapshot.cameraMode]}</strong>
          </span>
          {metrics.map((metric) => (
            <span
              className="hud-readout hud-readout--compact"
              data-tone={metric.tone}
              key={metric.label}
            >
              <span className="hud-label">{metric.label}</span>
              <strong>{metric.value}</strong>
            </span>
          ))}
          {snapshot.contextLost ? (
            <span className="hud-readout" data-tone="warning">
              그래픽 복구 중
            </span>
          ) : null}
        </>
      ) : (
        <span className="hud-message">경기 준비 중</span>
      )}
      <span className="hud-actions">
        <button
          type="button"
          className="icon-button"
          disabled={!canUseActions}
          onClick={onReset}
          title="드론 리셋"
          aria-label="드론 리셋"
        >
          <RotateCcw aria-hidden="true" size={17} />
        </button>
        <button
          type="button"
          className="icon-button"
          disabled={!canUseActions || snapshot?.status === "finished"}
          onClick={onPause}
          title="일시정지"
          aria-label="일시정지 메뉴 열기"
        >
          <Pause aria-hidden="true" size={17} />
        </button>
      </span>
    </header>
  );
}
