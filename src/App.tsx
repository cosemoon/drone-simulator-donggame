import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { FinishModal } from "./components/FinishModal";
import {
  GameCanvas,
  type GameCanvasControls,
} from "./components/GameCanvas";
import { Hud } from "./components/Hud";
import { PauseMenu } from "./components/PauseMenu";
import { TouchControls } from "./components/TouchControls";
import { defaultSimulationConfig } from "./game/config";
import { trainingArenaCourse } from "./game/course";
import type { GameSnapshot } from "./game/engine";
import {
  createLocalLeaderboard,
  type LocalLeaderboard,
} from "./game/leaderboard";
import {
  createBrowserStorageAdapter,
  createGameStorage,
  type GameSettings,
  type GameStorage,
  type StorageLike,
} from "./game/storage";
import { gameThemeById } from "./game/themes";
import type { RaceResult, ThemeId } from "./game/types";

interface PersistenceBundle {
  storage: StorageLike;
  gameStorage: GameStorage;
  leaderboard: LocalLeaderboard;
}

type HudStyle = CSSProperties & Record<`--${string}`, string>;

function usePersistenceBundle(): PersistenceBundle {
  const bundleRef = useRef<PersistenceBundle | null>(null);

  if (!bundleRef.current) {
    const storage = createBrowserStorageAdapter();
    bundleRef.current = {
      storage,
      gameStorage: createGameStorage(storage),
      leaderboard: createLocalLeaderboard(storage),
    };
  }

  return bundleRef.current;
}

function createRaceResultFromSnapshot(
  snapshot: GameSnapshot,
  nickname: string,
): RaceResult {
  const completedAt = new Date().toISOString();

  return {
    id: `${trainingArenaCourse.id}-${completedAt}-${Math.round(snapshot.finalMs)}`,
    nickname,
    courseId: trainingArenaCourse.id,
    courseVersion: trainingArenaCourse.version,
    themeId: snapshot.themeId,
    elapsedMs: snapshot.elapsedMs,
    penaltyMs: snapshot.penaltyMs,
    finalMs: snapshot.finalMs,
    collisions: snapshot.collisions,
    wrongGates: snapshot.wrongGates,
    gateClips: snapshot.gateClips,
    resets: snapshot.resets,
    outOfBounds: snapshot.outOfBounds,
    completedAt,
    buildVersion: defaultSimulationConfig.buildVersion,
  };
}

function themeStyle(themeId: ThemeId): HudStyle {
  const theme = gameThemeById[themeId] ?? gameThemeById["high-contrast"];
  const { hud } = theme.colors;

  return {
    "--hud-fg": hud.foreground,
    "--hud-muted": hud.muted,
    "--hud-panel": hud.panel,
    "--hud-panel-border": hud.panelBorder,
    "--hud-accent": hud.accent,
    "--hud-warning": hud.warning,
    "--hud-danger": hud.danger,
    "--hud-positive": hud.positive,
  };
}

export function shouldBlockGameInput(
  pauseMenuOpen: boolean,
  status: GameSnapshot["status"] | null | undefined,
): boolean {
  return pauseMenuOpen || status === "finished";
}

function App() {
  const { gameStorage, leaderboard } = usePersistenceBundle();
  const controlsRef = useRef<GameCanvasControls | null>(null);
  const previousStatusRef = useRef<GameSnapshot["status"] | null>(null);
  const [settings, setSettings] = useState<GameSettings>(() =>
    gameStorage.loadSettings(),
  );
  const [nickname] = useState(() => gameStorage.loadNickname());
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false);
  const [latestResult, setLatestResult] = useState<RaceResult | null>(null);
  const [records, setRecords] = useState<RaceResult[]>(() =>
    leaderboard.topResults(trainingArenaCourse.id, 5),
  );

  const rootStyle = useMemo(
    () => themeStyle(settings.themeId),
    [settings.themeId],
  );

  const updateSettings = useCallback(
    (patch: Partial<GameSettings>) => {
      setSettings((current) => {
        const next = { ...current, ...patch };
        gameStorage.saveSettings(next);
        return next;
      });
    },
    [gameStorage],
  );

  const handleControlsReady = useCallback(
    (controls: GameCanvasControls | null) => {
      controlsRef.current = controls;
      controls?.setThemeId(settings.themeId);
      controls?.setCameraMode(settings.cameraMode);
      controls?.setHoverAssistEnabled(settings.hoverAssistEnabled);
    },
    [settings.cameraMode, settings.hoverAssistEnabled, settings.themeId],
  );

  const refreshRecords = useCallback(() => {
    setRecords(leaderboard.topResults(trainingArenaCourse.id, 5));
  }, [leaderboard]);

  const handleSnapshot = useCallback(
    (nextSnapshot: GameSnapshot) => {
      setSnapshot(nextSnapshot);

      if (nextSnapshot.cameraMode !== settings.cameraMode) {
        updateSettings({ cameraMode: nextSnapshot.cameraMode });
      }

      if (
        nextSnapshot.status === "finished" &&
        previousStatusRef.current !== "finished"
      ) {
        const result = createRaceResultFromSnapshot(nextSnapshot, nickname);
        const nextRecords = leaderboard.addResult(result).slice(0, 5);
        setLatestResult(result);
        setRecords(nextRecords);
        setPauseMenuOpen(false);
      }

      if (
        nextSnapshot.status !== "finished" &&
        previousStatusRef.current === "finished"
      ) {
        setLatestResult(null);
        refreshRecords();
      }

      if (nextSnapshot.status === "paused") {
        setPauseMenuOpen(true);
      }

      previousStatusRef.current = nextSnapshot.status;
    },
    [leaderboard, nickname, refreshRecords, settings.cameraMode, updateSettings],
  );

  const openPauseMenu = useCallback(() => {
    controlsRef.current?.pause();
    setPauseMenuOpen(true);
  }, []);

  const resumeGame = useCallback(() => {
    setPauseMenuOpen(false);
    controlsRef.current?.resume();
  }, []);

  const restartGame = useCallback(() => {
    setPauseMenuOpen(false);
    setLatestResult(null);
    previousStatusRef.current = null;
    controlsRef.current?.restart();
    refreshRecords();
  }, [refreshRecords]);

  const resetDrone = useCallback(() => {
    controlsRef.current?.reset();
  }, []);

  const changeTheme = useCallback(
    (themeId: ThemeId) => {
      updateSettings({ themeId });
      controlsRef.current?.setThemeId(themeId);
    },
    [updateSettings],
  );

  const changeCameraMode = useCallback(
    (cameraMode: GameSettings["cameraMode"]) => {
      updateSettings({ cameraMode });
      controlsRef.current?.setCameraMode(cameraMode);
    },
    [updateSettings],
  );

  const changeHoverAssist = useCallback(
    (hoverAssistEnabled: boolean) => {
      updateSettings({ hoverAssistEnabled });
      controlsRef.current?.setHoverAssistEnabled(hoverAssistEnabled);
    },
    [updateSettings],
  );

  const inputBlocked = shouldBlockGameInput(pauseMenuOpen, snapshot?.status);

  const touchEnabled =
    settings.touchControlsEnabled &&
    !inputBlocked &&
    !errorMessage;

  const clearTouchControls = useCallback(() => {
    controlsRef.current?.clearTouchSticks();
  }, []);

  const handleTouchChange = useCallback((sticks: Parameters<GameCanvasControls["setTouchSticks"]>[0]) => {
    controlsRef.current?.setTouchSticks(sticks);
  }, []);

  useEffect(() => {
    controlsRef.current?.setInputEnabled(!inputBlocked);
  }, [inputBlocked]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.code !== "Escape" && event.code !== "KeyP") {
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (pauseMenuOpen) {
        resumeGame();
        return;
      }

      if (snapshot?.status !== "finished") {
        openPauseMenu();
      }
    };

    window.addEventListener("keydown", handleKeyDown, { capture: true });

    return () => {
      window.removeEventListener("keydown", handleKeyDown, { capture: true });
    };
  }, [openPauseMenu, pauseMenuOpen, resumeGame, snapshot?.status]);

  return (
    <main
      className="game-shell"
      style={rootStyle}
      data-theme={settings.themeId}
      aria-label="3D 드론 타임어택 훈련장"
    >
      <GameCanvas
        themeId={settings.themeId}
        cameraMode={settings.cameraMode}
        hoverAssistEnabled={settings.hoverAssistEnabled}
        inputBlocked={inputBlocked}
        onSnapshot={handleSnapshot}
        onControlsReady={handleControlsReady}
        onError={setErrorMessage}
      />
      <Hud
        snapshot={snapshot}
        errorMessage={errorMessage}
        onPause={openPauseMenu}
        onReset={resetDrone}
      />
      <TouchControls
        enabled={touchEnabled}
        onChange={handleTouchChange}
        onRelease={clearTouchControls}
      />
      <PauseMenu
        open={pauseMenuOpen && snapshot?.status !== "finished"}
        snapshot={snapshot}
        themeId={settings.themeId}
        cameraMode={settings.cameraMode}
        hoverAssistEnabled={settings.hoverAssistEnabled}
        onThemeChange={changeTheme}
        onCameraModeChange={changeCameraMode}
        onHoverAssistChange={changeHoverAssist}
        onResume={resumeGame}
        onRestart={restartGame}
      />
      <FinishModal
        open={snapshot?.status === "finished"}
        result={latestResult}
        records={records}
        onRestart={restartGame}
      />
    </main>
  );
}

export default App;
