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
  createOnlineScorePayload,
  normalizeScoreboardBaseUrl,
  submitOnlineScore,
} from "./game/onlineScore";
import {
  sanitizeMaxSpeed,
  createBrowserStorageAdapter,
  createGameStorage,
  type GameSettings,
  type GameStorage,
  type StorageLike,
} from "./game/storage";
import { gameThemeById } from "./game/themes";
import type { PlayerProfile, RaceResult, ThemeId } from "./game/types";

interface PersistenceBundle {
  storage: StorageLike;
  gameStorage: GameStorage;
  leaderboard: LocalLeaderboard;
}

type HudStyle = CSSProperties & Record<`--${string}`, string>;

type OnlineSubmitStatus = "idle" | "submitting" | "success" | "error";

interface OnlineSubmitState {
  status: OnlineSubmitStatus;
  message: string;
}

const initialOnlineSubmitState: OnlineSubmitState = {
  status: "idle",
  message: "",
};

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
  profile: PlayerProfile,
  settings: GameSettings,
): RaceResult {
  const completedAt = new Date().toISOString();
  const nickname = profile.nickname.trim() || "Pilot";

  return {
    id: `${trainingArenaCourse.id}-${completedAt}-${Math.round(snapshot.finalMs)}`,
    nickname,
    courseId: trainingArenaCourse.id,
    courseVersion: trainingArenaCourse.version,
    themeId: snapshot.themeId,
    hoverAssistEnabled: settings.hoverAssistEnabled,
    maxSpeedMetersPerSecond: settings.maxSpeedMetersPerSecond,
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
  const scoreboardBaseUrl = useMemo(
    () => normalizeScoreboardBaseUrl(import.meta.env.VITE_SCOREBOARD_API_BASE_URL),
    [],
  );
  const [settings, setSettings] = useState<GameSettings>(() =>
    gameStorage.loadSettings(),
  );
  const [playerProfile, setPlayerProfile] = useState<PlayerProfile>(() =>
    gameStorage.loadPlayerProfile(),
  );
  const [snapshot, setSnapshot] = useState<GameSnapshot | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pauseMenuOpen, setPauseMenuOpen] = useState(false);
  const [latestResult, setLatestResult] = useState<RaceResult | null>(null);
  const [onlineSubmit, setOnlineSubmit] = useState<OnlineSubmitState>(
    initialOnlineSubmitState,
  );
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
      controls?.setMaxSpeedMetersPerSecond(settings.maxSpeedMetersPerSecond);
    },
    [
      settings.cameraMode,
      settings.hoverAssistEnabled,
      settings.maxSpeedMetersPerSecond,
      settings.themeId,
    ],
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
        const result = createRaceResultFromSnapshot(
          nextSnapshot,
          playerProfile,
          settings,
        );
        const nextRecords = leaderboard.addResult(result).slice(0, 5);
        setLatestResult(result);
        setRecords(nextRecords);
        setOnlineSubmit(initialOnlineSubmitState);
        setPauseMenuOpen(false);
      }

      if (
        nextSnapshot.status !== "finished" &&
        previousStatusRef.current === "finished"
      ) {
        setLatestResult(null);
        setOnlineSubmit(initialOnlineSubmitState);
        refreshRecords();
      }

      if (nextSnapshot.status === "paused") {
        setPauseMenuOpen(true);
      }

      previousStatusRef.current = nextSnapshot.status;
    },
    [
      leaderboard,
      playerProfile,
      refreshRecords,
      settings,
      updateSettings,
    ],
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
    setOnlineSubmit(initialOnlineSubmitState);
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

  const changeMaxSpeed = useCallback(
    (maxSpeedMetersPerSecond: number) => {
      const sanitized = sanitizeMaxSpeed(maxSpeedMetersPerSecond);
      updateSettings({ maxSpeedMetersPerSecond: sanitized });
      controlsRef.current?.setMaxSpeedMetersPerSecond(sanitized);
    },
    [updateSettings],
  );

  const handlePlayerProfileChange = useCallback(
    (profile: PlayerProfile) => {
      setPlayerProfile(profile);
      gameStorage.savePlayerProfile(profile);
      setOnlineSubmit(initialOnlineSubmitState);
    },
    [gameStorage],
  );

  const submitBestScore = useCallback(async () => {
    const bestResult = records[0] ?? latestResult;

    if (!bestResult) {
      setOnlineSubmit({
        status: "error",
        message: "제출할 완주 기록이 없습니다.",
      });
      return;
    }

    if (!scoreboardBaseUrl) {
      setOnlineSubmit({
        status: "error",
        message: "온라인 점수판 주소가 아직 설정되지 않았습니다.",
      });
      return;
    }

    try {
      const payload = createOnlineScorePayload(playerProfile, bestResult);
      setOnlineSubmit({ status: "submitting", message: "최고 기록 제출 중..." });
      const response = await submitOnlineScore(scoreboardBaseUrl, payload);
      setOnlineSubmit({
        status: "success",
        message: response.updated
          ? "온라인 점수판에 최고 기록을 저장했습니다."
          : "온라인 점수판의 기존 최고 기록이 더 좋습니다.",
      });
    } catch (error) {
      setOnlineSubmit({
        status: "error",
        message:
          error instanceof Error
            ? error.message
            : "온라인 점수 제출에 실패했습니다.",
      });
    }
  }, [latestResult, playerProfile, records, scoreboardBaseUrl]);

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
        maxSpeedMetersPerSecond={settings.maxSpeedMetersPerSecond}
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
        maxSpeedMetersPerSecond={settings.maxSpeedMetersPerSecond}
        onThemeChange={changeTheme}
        onCameraModeChange={changeCameraMode}
        onHoverAssistChange={changeHoverAssist}
        onMaxSpeedChange={changeMaxSpeed}
        onResume={resumeGame}
        onRestart={restartGame}
      />
      <FinishModal
        open={snapshot?.status === "finished"}
        result={latestResult}
        records={records}
        playerProfile={playerProfile}
        onlineSubmit={onlineSubmit}
        scoreboardEnabled={Boolean(scoreboardBaseUrl)}
        onPlayerProfileChange={handlePlayerProfileChange}
        onSubmitBestScore={submitBestScore}
        onRestart={restartGame}
      />
    </main>
  );
}

export default App;
