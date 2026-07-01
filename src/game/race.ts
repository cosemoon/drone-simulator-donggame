import { defaultSimulationConfig } from "./config";
import { crossedGatePlane } from "./gateMath";
import type {
  Course,
  Gate,
  PenaltyConfig,
  RaceResult,
  ThemeId,
  Vector3Tuple,
} from "./types";

export type RaceStatus = "ready" | "running" | "paused" | "finished" | "aborted";

export type RacePenaltyReason =
  | "collision"
  | "gate-clip"
  | "missed-gate"
  | "reset"
  | "out-of-bounds";

export interface RacePenalty {
  reason: RacePenaltyReason;
  penaltyMs: number;
  atMs: number;
  gateId?: string;
  expectedGateId?: string;
}

export interface RaceState {
  status: RaceStatus;
  courseId: string;
  courseVersion: string;
  elapsedMs: number;
  penaltyMs: number;
  finalMs: number;
  collisions: number;
  wrongGates: number;
  gateClips: number;
  resets: number;
  outOfBounds: number;
  clearedGateIds: readonly string[];
  nextGateId: string | null;
  nextGateOrder: number | null;
  startedAt: number | null;
  pausedAt: number | null;
  finishedAt: number | null;
  lastAdvancedAt: number | null;
  penaltyConfig: PenaltyConfig;
  penalties: readonly RacePenalty[];
}

export interface CreateRaceStateOptions {
  penaltyConfig?: PenaltyConfig;
}

export interface RaceResultInjection {
  id?: string;
  nickname?: string;
  completedAt?: string;
  buildVersion?: string;
  courseVersion?: string;
  themeId: ThemeId;
  hoverAssistEnabled?: boolean;
  maxSpeedMetersPerSecond?: number;
}

function sortByGateOrder(a: Gate, b: Gate): number {
  return a.order - b.order || a.id.localeCompare(b.id);
}

export function getRequiredGates(course: Course): Gate[] {
  return course.gates.filter((gate) => gate.required).sort(sortByGateOrder);
}

function withFinalMs(state: RaceState): RaceState {
  return {
    ...state,
    finalMs: state.elapsedMs + state.penaltyMs,
  };
}

function nextRequiredGate(course: Course, clearedGateIds: readonly string[]): Gate | null {
  const cleared = new Set(clearedGateIds);
  return getRequiredGates(course).find((gate) => !cleared.has(gate.id)) ?? null;
}

function withNextGate(state: RaceState, course: Course): RaceState {
  const nextGate = nextRequiredGate(course, state.clearedGateIds);

  return {
    ...state,
    nextGateId: nextGate?.id ?? null,
    nextGateOrder: nextGate?.order ?? null,
  };
}

function areRequiredGatesCleared(course: Course, state: RaceState): boolean {
  const cleared = new Set(state.clearedGateIds);
  return getRequiredGates(course).every((gate) => cleared.has(gate.id));
}

function isFinishGate(course: Course, gateId: string): boolean {
  return course.finish.type === "gate" && course.finish.gateId === gateId;
}

function normalizedTick(previousTick: number, tickMs: number): number {
  return Math.max(previousTick, tickMs);
}

export function createRaceState(
  course: Course,
  options: CreateRaceStateOptions = {},
): RaceState {
  const penaltyConfig = options.penaltyConfig ?? defaultSimulationConfig.penalties;
  const firstGate = getRequiredGates(course)[0] ?? null;

  return {
    status: "ready",
    courseId: course.id,
    courseVersion: course.version,
    elapsedMs: 0,
    penaltyMs: 0,
    finalMs: 0,
    collisions: 0,
    wrongGates: 0,
    gateClips: 0,
    resets: 0,
    outOfBounds: 0,
    clearedGateIds: [],
    nextGateId: firstGate?.id ?? null,
    nextGateOrder: firstGate?.order ?? null,
    startedAt: null,
    pausedAt: null,
    finishedAt: null,
    lastAdvancedAt: null,
    penaltyConfig,
    penalties: [],
  };
}

export function startRace(state: RaceState, tickMs = 0): RaceState {
  if (state.status !== "ready") {
    return state;
  }

  return withFinalMs({
    ...state,
    status: "running",
    startedAt: tickMs,
    pausedAt: null,
    lastAdvancedAt: tickMs,
  });
}

export function advanceRaceTime(state: RaceState, tickMs: number): RaceState {
  if (state.status !== "running" || state.lastAdvancedAt === null) {
    return state;
  }

  const nextTick = normalizedTick(state.lastAdvancedAt, tickMs);

  return withFinalMs({
    ...state,
    elapsedMs: state.elapsedMs + nextTick - state.lastAdvancedAt,
    lastAdvancedAt: nextTick,
  });
}

export function pauseRace(state: RaceState, tickMs: number): RaceState {
  if (state.status !== "running") {
    return state;
  }

  const advanced = advanceRaceTime(state, tickMs);

  return withFinalMs({
    ...advanced,
    status: "paused",
    pausedAt: advanced.lastAdvancedAt,
    lastAdvancedAt: null,
  });
}

export function resumeRace(state: RaceState, tickMs: number): RaceState {
  if (state.status !== "paused") {
    return state;
  }

  return withFinalMs({
    ...state,
    status: "running",
    pausedAt: null,
    lastAdvancedAt: tickMs,
  });
}

function addRacePenalty(
  state: RaceState,
  tickMs: number,
  reason: RacePenaltyReason,
  penaltyMs: number,
  updateCounts: (state: RaceState) => Partial<RaceState>,
  details: Omit<RacePenalty, "reason" | "penaltyMs" | "atMs"> = {},
): RaceState {
  const advanced = advanceRaceTime(state, tickMs);

  if (advanced.status !== "running") {
    return advanced;
  }

  const atMs = advanced.lastAdvancedAt ?? tickMs;

  return withFinalMs({
    ...advanced,
    ...updateCounts(advanced),
    penaltyMs: advanced.penaltyMs + penaltyMs,
    penalties: [
      ...advanced.penalties,
      {
        reason,
        penaltyMs,
        atMs,
        ...details,
      },
    ],
  });
}

export function addCollision(state: RaceState, tickMs: number): RaceState {
  return addRacePenalty(
    state,
    tickMs,
    "collision",
    state.penaltyConfig.collisionMs,
    (advanced) => ({ collisions: advanced.collisions + 1 }),
  );
}

export function addGateClip(
  state: RaceState,
  gateId: string,
  tickMs: number,
): RaceState {
  return addRacePenalty(
    state,
    tickMs,
    "gate-clip",
    state.penaltyConfig.gateClipMs,
    (advanced) => ({ gateClips: advanced.gateClips + 1 }),
    { gateId },
  );
}

export function addResetPenalty(state: RaceState, tickMs: number): RaceState {
  return addRacePenalty(
    state,
    tickMs,
    "reset",
    state.penaltyConfig.resetMs,
    (advanced) => ({ resets: advanced.resets + 1 }),
  );
}

export function addOutOfBoundsPenalty(
  state: RaceState,
  tickMs: number,
): RaceState {
  return addRacePenalty(
    state,
    tickMs,
    "out-of-bounds",
    state.penaltyConfig.outOfBoundsMs,
    (advanced) => ({ outOfBounds: advanced.outOfBounds + 1 }),
  );
}

function addMissedGatePenalty(
  state: RaceState,
  gateId: string,
  expectedGateId: string,
  tickMs: number,
): RaceState {
  return addRacePenalty(
    state,
    tickMs,
    "missed-gate",
    state.penaltyConfig.missedGateMs,
    (advanced) => ({ wrongGates: advanced.wrongGates + 1 }),
    { gateId, expectedGateId },
  );
}

export function passGate(
  state: RaceState,
  course: Course,
  gateId: string,
  tickMs: number,
): RaceState {
  let advanced = advanceRaceTime(state, tickMs);

  if (advanced.status !== "running") {
    return advanced;
  }

  const gate = course.gates.find((candidate) => candidate.id === gateId);

  if (!gate) {
    return advanced;
  }

  if (areRequiredGatesCleared(course, advanced)) {
    return isFinishGate(course, gate.id)
      ? finishRace(advanced, course, tickMs)
      : advanced;
  }

  const expectedGate = nextRequiredGate(course, advanced.clearedGateIds);

  if (!expectedGate || !gate.required) {
    return advanced;
  }

  if (gate.id !== expectedGate.id) {
    return addMissedGatePenalty(advanced, gate.id, expectedGate.id, tickMs);
  }

  advanced = withNextGate(
    withFinalMs({
      ...advanced,
      clearedGateIds: [...advanced.clearedGateIds, gate.id],
    }),
    course,
  );

  if (isFinishGate(course, gate.id) && areRequiredGatesCleared(course, advanced)) {
    return finishRace(advanced, course, tickMs);
  }

  return advanced;
}

export function passGateByPosition(
  state: RaceState,
  course: Course,
  previousPosition: Vector3Tuple,
  currentPosition: Vector3Tuple,
  tickMs: number,
): RaceState {
  if (state.status !== "running") {
    return state;
  }

  const expectedGate = nextRequiredGate(course, state.clearedGateIds);

  if (!expectedGate) {
    return advanceRaceTime(state, tickMs);
  }

  if (crossedGatePlane(expectedGate, previousPosition, currentPosition)) {
    return passGate(state, course, expectedGate.id, tickMs);
  }

  const wrongGate = getRequiredGates(course).find(
    (gate) =>
      gate.id !== expectedGate.id &&
      !state.clearedGateIds.includes(gate.id) &&
      crossedGatePlane(gate, previousPosition, currentPosition),
  );

  if (wrongGate) {
    return passGate(state, course, wrongGate.id, tickMs);
  }

  return advanceRaceTime(state, tickMs);
}

export function finishRace(
  state: RaceState,
  course: Course,
  tickMs: number,
): RaceState {
  const advanced = advanceRaceTime(state, tickMs);

  if (advanced.status !== "running" || !areRequiredGatesCleared(course, advanced)) {
    return advanced;
  }

  const finishedAt = advanced.lastAdvancedAt ?? tickMs;

  return withFinalMs({
    ...advanced,
    status: "finished",
    finishedAt,
    pausedAt: null,
    lastAdvancedAt: null,
    nextGateId: null,
    nextGateOrder: null,
  });
}

export function cancelRace(state: RaceState, tickMs: number): RaceState {
  const advanced = advanceRaceTime(state, tickMs);

  if (advanced.status === "finished" || advanced.status === "aborted") {
    return advanced;
  }

  return withFinalMs({
    ...advanced,
    status: "aborted",
    pausedAt: null,
    finishedAt: advanced.lastAdvancedAt ?? tickMs,
    lastAdvancedAt: null,
  });
}

function defaultResultId(state: RaceState): string {
  return `${state.courseId}-${state.finishedAt ?? state.finalMs}`;
}

export function toRaceResult(
  state: RaceState,
  injection: RaceResultInjection,
): RaceResult {
  if (state.status !== "finished") {
    throw new Error("Cannot create a race result before the race is finished.");
  }

  const nickname = injection.nickname?.trim() || "Pilot";

  return {
    id: injection.id ?? defaultResultId(state),
    nickname,
    courseId: state.courseId,
    courseVersion: injection.courseVersion ?? state.courseVersion,
    themeId: injection.themeId,
    hoverAssistEnabled:
      injection.hoverAssistEnabled ?? defaultSimulationConfig.hoverAssistEnabled,
    maxSpeedMetersPerSecond:
      injection.maxSpeedMetersPerSecond ??
      defaultSimulationConfig.drone.maxSpeedMetersPerSecond,
    elapsedMs: state.elapsedMs,
    penaltyMs: state.penaltyMs,
    finalMs: state.finalMs,
    collisions: state.collisions,
    wrongGates: state.wrongGates,
    gateClips: state.gateClips,
    resets: state.resets,
    outOfBounds: state.outOfBounds,
    completedAt: injection.completedAt ?? new Date(0).toISOString(),
    buildVersion: injection.buildVersion ?? defaultSimulationConfig.buildVersion,
  };
}
