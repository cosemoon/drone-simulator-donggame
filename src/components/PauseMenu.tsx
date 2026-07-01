import { Play, RotateCcw } from "lucide-react";
import type { GameSnapshot } from "../game/engine";
import {
  MAX_MAX_SPEED_METERS_PER_SECOND,
  MIN_MAX_SPEED_METERS_PER_SECOND,
} from "../game/storage";
import type { CameraMode, ThemeId } from "../game/types";

export interface PauseMenuProps {
  open: boolean;
  snapshot: GameSnapshot | null;
  themeId: ThemeId;
  cameraMode: CameraMode;
  hoverAssistEnabled: boolean;
  maxSpeedMetersPerSecond: number;
  onThemeChange: (themeId: ThemeId) => void;
  onCameraModeChange: (cameraMode: CameraMode) => void;
  onHoverAssistChange: (enabled: boolean) => void;
  onMaxSpeedChange: (value: number) => void;
  onResume: () => void;
  onRestart: () => void;
}

const themeOptions = [
  { id: "clean-sim", label: "A", detail: "클린 시뮬레이션" },
  { id: "neon-night", label: "B", detail: "네온 나이트" },
  { id: "high-contrast", label: "C", detail: "하이 콘트라스트" },
] as const satisfies readonly {
  id: ThemeId;
  label: string;
  detail: string;
}[];

const cameraOptions = [
  { id: "chase", label: "추적" },
  { id: "fpv", label: "FPV" },
] as const satisfies readonly { id: CameraMode; label: string }[];

export function PauseMenu({
  open,
  snapshot,
  themeId,
  cameraMode,
  hoverAssistEnabled,
  maxSpeedMetersPerSecond,
  onThemeChange,
  onCameraModeChange,
  onHoverAssistChange,
  onMaxSpeedChange,
  onResume,
  onRestart,
}: PauseMenuProps) {
  if (!open) {
    return null;
  }

  const roundedMaxSpeed = Math.round(maxSpeedMetersPerSecond);

  return (
    <div className="menu-scrim" role="presentation">
      <section
        className="pause-menu panel-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="pause-menu-title"
      >
        <div className="panel-heading">
          <div>
            <p className="panel-kicker">비행 설정</p>
            <h2 id="pause-menu-title">일시정지</h2>
          </div>
          <span className="menu-state">
            {snapshot?.status === "paused" ? "정지됨" : "메뉴"}
          </span>
        </div>

        <fieldset className="control-group">
          <legend>테마</legend>
          <div className="segmented-control segmented-control--themes">
            {themeOptions.map((theme) => (
              <button
                type="button"
                key={theme.id}
                className="segment-button"
                aria-pressed={themeId === theme.id}
                onClick={() => onThemeChange(theme.id)}
              >
                <strong>{theme.label}</strong>
                <span>{theme.detail}</span>
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="control-group">
          <legend>카메라</legend>
          <div className="segmented-control">
            {cameraOptions.map((camera) => (
              <button
                type="button"
                key={camera.id}
                className="segment-button"
                aria-pressed={cameraMode === camera.id}
                onClick={() => onCameraModeChange(camera.id)}
              >
                {camera.label}
              </button>
            ))}
          </div>
        </fieldset>

        <fieldset className="control-group">
          <legend>비행 보조</legend>
          <label className="toggle-row">
            <span>
              <strong>호버 모드</strong>
              <small>중립 스로틀에서 고도를 유지합니다.</small>
            </span>
            <input
              type="checkbox"
              checked={hoverAssistEnabled}
              onChange={(event) => onHoverAssistChange(event.currentTarget.checked)}
            />
          </label>
          <label className="range-row">
            <span>
              <strong>최대 속도</strong>
              <small>{roundedMaxSpeed} m/s</small>
            </span>
            <input
              type="range"
              min={MIN_MAX_SPEED_METERS_PER_SECOND}
              max={MAX_MAX_SPEED_METERS_PER_SECOND}
              step="1"
              value={roundedMaxSpeed}
              onChange={(event) => onMaxSpeedChange(Number(event.currentTarget.value))}
            />
            <input
              type="number"
              min={MIN_MAX_SPEED_METERS_PER_SECOND}
              max={MAX_MAX_SPEED_METERS_PER_SECOND}
              step="1"
              value={roundedMaxSpeed}
              aria-label="최대 속도"
              onChange={(event) => onMaxSpeedChange(Number(event.currentTarget.value))}
            />
          </label>
        </fieldset>

        <div className="menu-actions">
          <button type="button" className="primary-button" onClick={onResume}>
            <Play aria-hidden="true" size={18} />
            계속하기
          </button>
          <button type="button" className="secondary-button" onClick={onRestart}>
            <RotateCcw aria-hidden="true" size={18} />
            다시 시작
          </button>
        </div>
      </section>
    </div>
  );
}
