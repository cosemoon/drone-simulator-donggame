import * as THREE from "three";
import { updateCameraRig, type PlayableCameraMode } from "./camera";
import { defaultSimulationConfig } from "./config";
import { trainingArenaCourse } from "./course";
import {
  createDroneFlightState,
  isOutOfBounds,
  resetDroneState,
  stepFlight,
  type DroneFlightState,
} from "./flight";
import {
  createInputSystem,
  KEYBOARD_INPUT_BINDINGS,
  type VirtualStickCommandInput,
  type VirtualStickOptions,
} from "./input";
import {
  addOutOfBoundsPenalty,
  addResetPenalty,
  createRaceState,
  passGateByPosition,
  pauseRace,
  resumeRace,
  startRace,
  type RaceState,
  type RaceStatus,
} from "./race";
import { createTrainingArenaScene, type TrainingArenaScene } from "./scene";
import { gameThemeById } from "./themes";
import type {
  CameraMode,
  Course,
  GameTheme,
  InputCommand,
  SimulationConfig,
  ThemeId,
  Vector3Tuple,
} from "./types";

export { resolveCameraModeCommand } from "./camera";
import { normalizeCameraMode, resolveCameraModeCommand } from "./camera";

export interface GameSnapshot {
  status: RaceStatus;
  elapsedMs: number;
  penaltyMs: number;
  finalMs: number;
  nextGateId: string | null;
  nextGateOrder: number | null;
  clearedGateCount: number;
  totalGateCount: number;
  cameraMode: PlayableCameraMode;
  themeId: ThemeId;
  collisions: number;
  wrongGates: number;
  gateClips: number;
  resets: number;
  outOfBounds: number;
  position: Vector3Tuple;
  velocity: Vector3Tuple;
  contextLost: boolean;
}

export interface GameEngineOptions {
  course?: Course;
  themeId?: ThemeId;
  cameraMode?: CameraMode;
  hoverAssistEnabled?: boolean;
  maxSpeedMetersPerSecond?: number;
  snapshotIntervalMs?: number;
}

export type GameSnapshotListener = (snapshot: GameSnapshot) => void;

const SNAPSHOT_INTERVAL_MS = 160;
const MAX_FRAME_DELTA_MS = 100;
const GAME_KEY_CODES = new Set<string>(
  Object.values(KEYBOARD_INPUT_BINDINGS).flatMap((codes) => [...codes]),
);

function cloneVector(vector: Vector3Tuple): Vector3Tuple {
  return [vector[0], vector[1], vector[2]];
}

function isFlightCommandActive(command: InputCommand): boolean {
  return (
    Math.abs(command.throttle) > 0 ||
    Math.abs(command.yaw) > 0 ||
    Math.abs(command.pitch) > 0 ||
    Math.abs(command.roll) > 0 ||
    command.brake
  );
}

function activeThemeFor(themeId: ThemeId): GameTheme {
  return gameThemeById[themeId] ?? gameThemeById[defaultSimulationConfig.defaultThemeId];
}

function isEditableTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }

  return (
    target.isContentEditable ||
    target.tagName === "INPUT" ||
    target.tagName === "TEXTAREA" ||
    target.tagName === "SELECT"
  );
}

export function shouldPenalizeResetForStatus(status: RaceStatus): boolean {
  return status === "running";
}

export class GameEngine {
  private readonly container: HTMLElement;
  private readonly course: Course;
  private theme: GameTheme;
  private readonly snapshotIntervalMs: number;
  private simulationConfig: SimulationConfig;
  private readonly renderer: THREE.WebGLRenderer;
  private readonly camera: THREE.PerspectiveCamera;
  private arena: TrainingArenaScene;
  private readonly input = createInputSystem();
  private readonly listeners = new Set<GameSnapshotListener>();
  private readonly resizeObserver?: ResizeObserver;
  private droneState: DroneFlightState;
  private raceState: RaceState;
  private cameraMode: PlayableCameraMode;
  private frameId: number | null = null;
  private running = false;
  private disposed = false;
  private lastFrameMs = 0;
  private accumulatorMs = 0;
  private simulationClockMs = 0;
  private lastSnapshotMs = Number.NEGATIVE_INFINITY;
  private contextLost = false;
  private inputEnabled = true;

  constructor(container: HTMLElement, options: GameEngineOptions = {}) {
    this.container = container;
    this.course = options.course ?? trainingArenaCourse;
    this.theme = activeThemeFor(options.themeId ?? this.course.themeId);
    this.simulationConfig = {
      ...defaultSimulationConfig,
      drone: {
        ...defaultSimulationConfig.drone,
        maxSpeedMetersPerSecond:
          options.maxSpeedMetersPerSecond ??
          defaultSimulationConfig.drone.maxSpeedMetersPerSecond,
      },
      hoverAssistEnabled:
        options.hoverAssistEnabled ?? defaultSimulationConfig.hoverAssistEnabled,
    };
    this.snapshotIntervalMs = options.snapshotIntervalMs ?? SNAPSHOT_INTERVAL_MS;
    this.cameraMode = normalizeCameraMode(options.cameraMode ?? "chase");
    this.droneState = createDroneFlightState(
      this.course.start.position,
      this.course.start.rotation,
    );
    this.raceState = createRaceState(this.course);
    this.camera = new THREE.PerspectiveCamera(70, 1, 0.1, 220);
    this.renderer = this.createRenderer();
    this.arena = createTrainingArenaScene(this.course, this.theme);

    this.container.appendChild(this.renderer.domElement);
    this.syncDroneMesh();
    this.syncGateVisuals();
    this.resize();
    this.bindEvents();

    if (typeof ResizeObserver !== "undefined") {
      this.resizeObserver = new ResizeObserver(this.resize);
      this.resizeObserver.observe(this.container);
    }
  }

  start(): void {
    if (this.running || this.disposed) {
      return;
    }

    this.running = true;
    this.lastFrameMs = performance.now();
    this.frameId = requestAnimationFrame(this.tick);
    this.emitSnapshot(true);
  }

  stop(): void {
    this.running = false;

    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }

    this.input.clear();
  }

  dispose(): void {
    if (this.disposed) {
      return;
    }

    this.stop();
    this.disposed = true;
    this.unbindEvents();
    this.resizeObserver?.disconnect();
    this.arena.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
    this.listeners.clear();
  }

  subscribe(listener: GameSnapshotListener): () => void {
    this.listeners.add(listener);
    listener(this.createSnapshot());

    return () => {
      this.listeners.delete(listener);
    };
  }

  getSnapshot(): GameSnapshot {
    return this.createSnapshot();
  }

  restart(): void {
    this.clearInput();
    this.raceState = createRaceState(this.course);
    this.simulationClockMs = 0;
    this.accumulatorMs = 0;
    this.resetDrone(false);
    this.emitSnapshot(true);
  }

  pause(): void {
    if (this.raceState.status !== "running") {
      this.clearInput();
      this.emitSnapshot(true);
      return;
    }

    this.raceState = pauseRace(this.raceState, this.simulationClockMs);
    this.clearInput();
    this.emitSnapshot(true);
  }

  resume(): void {
    if (this.raceState.status !== "paused") {
      this.emitSnapshot(true);
      return;
    }

    this.raceState = resumeRace(this.raceState, this.simulationClockMs);
    this.emitSnapshot(true);
  }

  setCameraMode(mode: CameraMode): void {
    this.cameraMode = normalizeCameraMode(mode);
    this.emitSnapshot(true);
  }

  setThemeId(themeId: ThemeId): void {
    const nextTheme = activeThemeFor(themeId);

    if (nextTheme.id === this.theme.id) {
      return;
    }

    const previousArena = this.arena;
    this.theme = nextTheme;
    this.arena = createTrainingArenaScene(this.course, this.theme);
    previousArena.dispose();
    this.renderer.setClearColor(this.theme.colors.scene.background, 1);
    this.syncDroneMesh();
    this.syncGateVisuals();
    this.resize();
    this.emitSnapshot(true);
  }

  setHoverAssistEnabled(enabled: boolean): void {
    if (this.simulationConfig.hoverAssistEnabled === enabled) {
      return;
    }

    this.simulationConfig = {
      ...this.simulationConfig,
      hoverAssistEnabled: enabled,
    };
    this.emitSnapshot(true);
  }

  setMaxSpeedMetersPerSecond(value: number): void {
    const maxSpeedMetersPerSecond = Number.isFinite(value)
      ? Math.max(0, value)
      : defaultSimulationConfig.drone.maxSpeedMetersPerSecond;

    if (
      this.simulationConfig.drone.maxSpeedMetersPerSecond ===
      maxSpeedMetersPerSecond
    ) {
      return;
    }

    this.simulationConfig = {
      ...this.simulationConfig,
      drone: {
        ...this.simulationConfig.drone,
        maxSpeedMetersPerSecond,
      },
    };
    this.emitSnapshot(true);
  }

  setInputEnabled(enabled: boolean): void {
    this.inputEnabled = enabled;

    if (!enabled) {
      this.clearInput();
    }
  }

  setTouchSticks(
    sticks: VirtualStickCommandInput,
    options?: VirtualStickOptions,
  ): void {
    if (!this.inputEnabled) {
      this.input.clearTouchSticks();
      return;
    }

    this.input.setTouchSticks(sticks, options);
  }

  clearTouchSticks(): void {
    this.input.clearTouchSticks();
  }

  reset(): void {
    this.resetDrone(shouldPenalizeResetForStatus(this.raceState.status));
    this.emitSnapshot(true);
  }

  private createRenderer(): THREE.WebGLRenderer {
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });

    renderer.domElement.className = "game-renderer";
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(this.theme.colors.scene.background, 1);
    renderer.domElement.addEventListener("webglcontextlost", this.handleContextLost, false);
    renderer.domElement.addEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
      false,
    );

    return renderer;
  }

  private bindEvents(): void {
    window.addEventListener("keydown", this.handleKeyDown, { passive: false });
    window.addEventListener("keyup", this.handleKeyUp, { passive: false });
    window.addEventListener("blur", this.clearInput);
    window.addEventListener("resize", this.resize);
    document.addEventListener("visibilitychange", this.handleVisibilityChange);
  }

  private unbindEvents(): void {
    window.removeEventListener("keydown", this.handleKeyDown);
    window.removeEventListener("keyup", this.handleKeyUp);
    window.removeEventListener("blur", this.clearInput);
    window.removeEventListener("resize", this.resize);
    document.removeEventListener("visibilitychange", this.handleVisibilityChange);
    this.renderer.domElement.removeEventListener("webglcontextlost", this.handleContextLost);
    this.renderer.domElement.removeEventListener(
      "webglcontextrestored",
      this.handleContextRestored,
    );
  }

  private readonly handleKeyDown = (event: KeyboardEvent): void => {
    if (this.disposed || isEditableTarget(event.target)) {
      return;
    }

    if (!this.inputEnabled) {
      if (GAME_KEY_CODES.has(event.code)) {
        event.preventDefault();
      }

      return;
    }

    if (GAME_KEY_CODES.has(event.code)) {
      event.preventDefault();
    }

    this.input.keyboard.keyDown(event);
  };

  private readonly handleKeyUp = (event: KeyboardEvent): void => {
    if (this.disposed || isEditableTarget(event.target)) {
      return;
    }

    if (!this.inputEnabled) {
      if (GAME_KEY_CODES.has(event.code)) {
        event.preventDefault();
      }

      return;
    }

    if (GAME_KEY_CODES.has(event.code)) {
      event.preventDefault();
    }

    this.input.keyboard.keyUp(event);
  };

  private readonly clearInput = (): void => {
    this.input.clear();
  };

  private readonly handleVisibilityChange = (): void => {
    if (document.hidden) {
      this.clearInput();
    }
  };

  private readonly handleContextLost = (event: Event): void => {
    event.preventDefault();
    this.contextLost = true;
    this.clearInput();
    this.emitSnapshot(true);
  };

  private readonly handleContextRestored = (): void => {
    this.contextLost = false;
    this.resize();
    this.emitSnapshot(true);
  };

  private readonly resize = (): void => {
    const rect = this.container.getBoundingClientRect();
    const width = Math.max(1, Math.floor(rect.width || this.container.clientWidth || 1));
    const height = Math.max(1, Math.floor(rect.height || this.container.clientHeight || 1));

    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(width, height, false);
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  };

  private readonly tick = (nowMs: number): void => {
    if (!this.running || this.disposed) {
      return;
    }

    const deltaMs = Math.min(MAX_FRAME_DELTA_MS, Math.max(0, nowMs - this.lastFrameMs));
    this.lastFrameMs = nowMs;

    if (!this.contextLost) {
      this.accumulatorMs += deltaMs;

      while (this.accumulatorMs >= this.simulationConfig.fixedDeltaMs) {
        this.step(this.simulationConfig.fixedDeltaMs);
        this.accumulatorMs -= this.simulationConfig.fixedDeltaMs;
      }

      this.render();
      this.emitSnapshot(nowMs - this.lastSnapshotMs >= this.snapshotIntervalMs, nowMs);
    }

    this.frameId = requestAnimationFrame(this.tick);
  };

  private step(deltaMs: number): void {
    this.simulationClockMs += deltaMs;

    const command = this.input.getCommand();

    this.handleOneShotCommands(command);

    if (
      this.raceState.status === "paused" ||
      this.raceState.status === "finished" ||
      this.raceState.status === "aborted"
    ) {
      return;
    }

    if (this.raceState.status === "ready" && isFlightCommandActive(command)) {
      this.raceState = startRace(this.raceState, this.simulationClockMs);
    }

    if (this.raceState.status !== "running") {
      return;
    }

    const previousPosition = cloneVector(this.droneState.position);
    this.droneState = stepFlight(
      this.droneState,
      command,
      this.simulationConfig,
      deltaMs / 1000,
      this.simulationClockMs / 1000,
    );

    if (isOutOfBounds(this.droneState.position, this.course.bounds)) {
      this.raceState = addOutOfBoundsPenalty(this.raceState, this.simulationClockMs);
      this.resetDrone(false);
    } else {
      this.raceState = passGateByPosition(
        this.raceState,
        this.course,
        previousPosition,
        this.droneState.position,
        this.simulationClockMs,
      );
    }

    this.syncDroneMesh();
    this.syncGateVisuals();
  }

  private handleOneShotCommands(command: InputCommand): void {
    if (command.camera !== "none") {
      this.cameraMode = resolveCameraModeCommand(this.cameraMode, command.camera);
      this.input.consumeOneShotActions(["camera"]);
      this.emitSnapshot(true);
    }

    if (command.pause) {
      if (this.raceState.status === "running") {
        this.raceState = pauseRace(this.raceState, this.simulationClockMs);
      } else if (this.raceState.status === "paused") {
        this.raceState = resumeRace(this.raceState, this.simulationClockMs);
      }

      this.input.consumeOneShotActions(["pause"]);
      this.emitSnapshot(true);
    }

    if (command.reset) {
      this.resetDrone(shouldPenalizeResetForStatus(this.raceState.status));
      this.input.consumeOneShotActions(["reset"]);
      this.emitSnapshot(true);
    }
  }

  private resetDrone(addPenalty: boolean): void {
    if (addPenalty) {
      this.raceState = addResetPenalty(this.raceState, this.simulationClockMs);
    }

    this.droneState = resetDroneState(
      this.droneState,
      this.course.start.position,
      this.course.start.rotation,
    );
    this.syncDroneMesh();
    this.syncGateVisuals();
  }

  private syncDroneMesh(): void {
    const { position, rotation } = this.droneState;

    this.arena.drone.position.set(position[0], position[1], position[2]);
    this.arena.drone.rotation.set(rotation[0], rotation[1], rotation[2], "YXZ");
  }

  private syncGateVisuals(): void {
    const cleared = new Set(this.raceState.clearedGateIds);

    for (const gate of this.course.gates) {
      this.arena.setGateState(
        gate.id,
        cleared.has(gate.id)
          ? "cleared"
          : gate.id === this.raceState.nextGateId
            ? "active"
            : "idle",
      );
    }
  }

  private render(): void {
    const nextGate =
      this.course.gates.find((gate) => gate.id === this.raceState.nextGateId) ?? null;

    updateCameraRig(this.camera, this.droneState, this.cameraMode, {
      nextGate,
      smoothing: 1,
    });
    this.renderer.render(this.arena.scene, this.camera);
  }

  private createSnapshot(): GameSnapshot {
    return {
      status: this.raceState.status,
      elapsedMs: this.raceState.elapsedMs,
      penaltyMs: this.raceState.penaltyMs,
      finalMs: this.raceState.finalMs,
      nextGateId: this.raceState.nextGateId,
      nextGateOrder: this.raceState.nextGateOrder,
      clearedGateCount: this.raceState.clearedGateIds.length,
      totalGateCount: this.course.gates.filter((gate) => gate.required).length,
      cameraMode: this.cameraMode,
      themeId: this.theme.id,
      collisions: this.raceState.collisions,
      wrongGates: this.raceState.wrongGates,
      gateClips: this.raceState.gateClips,
      resets: this.raceState.resets,
      outOfBounds: this.raceState.outOfBounds,
      position: cloneVector(this.droneState.position),
      velocity: cloneVector(this.droneState.velocity),
      contextLost: this.contextLost,
    };
  }

  private emitSnapshot(force = false, nowMs = performance.now()): void {
    if (!force && nowMs - this.lastSnapshotMs < this.snapshotIntervalMs) {
      return;
    }

    this.lastSnapshotMs = nowMs;
    const snapshot = this.createSnapshot();

    for (const listener of this.listeners) {
      listener(snapshot);
    }
  }
}
