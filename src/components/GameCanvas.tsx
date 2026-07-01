import { useEffect, useRef, useState } from "react";
import { GameEngine, type GameSnapshot } from "../game/engine";
import type { VirtualStickCommandInput, VirtualStickOptions } from "../game/input";
import type { CameraMode, ThemeId } from "../game/types";

export interface GameCanvasControls {
  restart(): void;
  reset(): void;
  pause(): void;
  resume(): void;
  setCameraMode(mode: CameraMode): void;
  setThemeId(themeId: ThemeId): void;
  setHoverAssistEnabled(enabled: boolean): void;
  setMaxSpeedMetersPerSecond(value: number): void;
  setInputEnabled(enabled: boolean): void;
  setTouchSticks(
    sticks: VirtualStickCommandInput,
    options?: VirtualStickOptions,
  ): void;
  clearTouchSticks(): void;
}

export interface GameCanvasProps {
  themeId: ThemeId;
  cameraMode: CameraMode;
  hoverAssistEnabled: boolean;
  maxSpeedMetersPerSecond: number;
  inputBlocked?: boolean;
  onSnapshot?: (snapshot: GameSnapshot) => void;
  onControlsReady?: (controls: GameCanvasControls | null) => void;
  onError?: (message: string | null) => void;
}

function controlsFor(engine: GameEngine): GameCanvasControls {
  return {
    restart: () => engine.restart(),
    reset: () => engine.reset(),
    pause: () => engine.pause(),
    resume: () => engine.resume(),
    setCameraMode: (mode) => engine.setCameraMode(mode),
    setThemeId: (themeId) => engine.setThemeId(themeId),
    setHoverAssistEnabled: (enabled) => engine.setHoverAssistEnabled(enabled),
    setMaxSpeedMetersPerSecond: (value) =>
      engine.setMaxSpeedMetersPerSecond(value),
    setInputEnabled: (enabled) => engine.setInputEnabled(enabled),
    setTouchSticks: (sticks, options) => engine.setTouchSticks(sticks, options),
    clearTouchSticks: () => engine.clearTouchSticks(),
  };
}

export function GameCanvas({
  themeId,
  cameraMode,
  hoverAssistEnabled,
  maxSpeedMetersPerSecond,
  inputBlocked = false,
  onSnapshot,
  onControlsReady,
  onError,
}: GameCanvasProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const engineRef = useRef<GameEngine | null>(null);
  const themeIdRef = useRef(themeId);
  const cameraModeRef = useRef(cameraMode);
  const hoverAssistEnabledRef = useRef(hoverAssistEnabled);
  const maxSpeedMetersPerSecondRef = useRef(maxSpeedMetersPerSecond);
  const onSnapshotRef = useRef(onSnapshot);
  const onControlsReadyRef = useRef(onControlsReady);
  const onErrorRef = useRef(onError);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    themeIdRef.current = themeId;
    engineRef.current?.setThemeId(themeId);
  }, [themeId]);

  useEffect(() => {
    cameraModeRef.current = cameraMode;
    engineRef.current?.setCameraMode(cameraMode);
  }, [cameraMode]);

  useEffect(() => {
    hoverAssistEnabledRef.current = hoverAssistEnabled;
    engineRef.current?.setHoverAssistEnabled(hoverAssistEnabled);
  }, [hoverAssistEnabled]);

  useEffect(() => {
    maxSpeedMetersPerSecondRef.current = maxSpeedMetersPerSecond;
    engineRef.current?.setMaxSpeedMetersPerSecond(maxSpeedMetersPerSecond);
  }, [maxSpeedMetersPerSecond]);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  useEffect(() => {
    onControlsReadyRef.current = onControlsReady;
  }, [onControlsReady]);

  useEffect(() => {
    onErrorRef.current = onError;
  }, [onError]);

  useEffect(() => {
    const engine = engineRef.current;

    if (!engine) {
      return;
    }

    engine.setInputEnabled(!inputBlocked);
  }, [inputBlocked]);

  useEffect(() => {
    const container = containerRef.current;

    if (!container) {
      return;
    }

    let unsubscribe = () => {};
    let engine: GameEngine | null = null;

    try {
      setErrorMessage(null);
      onErrorRef.current?.(null);
      engine = new GameEngine(container, {
        themeId: themeIdRef.current,
        cameraMode: cameraModeRef.current,
        hoverAssistEnabled: hoverAssistEnabledRef.current,
        maxSpeedMetersPerSecond: maxSpeedMetersPerSecondRef.current,
      });
      engineRef.current = engine;
      engine.setInputEnabled(!inputBlocked);
      unsubscribe = engine.subscribe((snapshot) => {
        onSnapshotRef.current?.(snapshot);
      });
      onControlsReadyRef.current?.(controlsFor(engine));
      engine.start();
    } catch (error) {
      console.error(error);
      const message = "3D 렌더러를 시작할 수 없습니다.";
      setErrorMessage(message);
      onErrorRef.current?.(message);
      onControlsReadyRef.current?.(null);
    }

    return () => {
      unsubscribe();
      onControlsReadyRef.current?.(null);
      engineRef.current = null;
      engine?.dispose();
    };
  }, []);

  return (
    <>
      <div ref={containerRef} className="game-canvas-host" />
      {errorMessage ? (
        <div className="game-canvas-error" role="alert">
          {errorMessage}
        </div>
      ) : null}
    </>
  );
}
