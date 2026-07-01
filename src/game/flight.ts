import { defaultSimulationConfig } from "./config";
import {
  addVector,
  clamp,
  clampUnit,
  damp,
  finiteNumber,
  moveToward,
  sanitizeVector,
  scaleVector,
  wrapRadians,
} from "./math";
import type {
  AssistConfig,
  CourseBounds,
  DroneConfig,
  InputCommand,
  SimulationConfig,
  Vector3Tuple,
  WindConfig,
} from "./types";

export interface FlightSimulationConfig
  extends Pick<
    SimulationConfig,
    "gravity" | "drone" | "assist" | "wind" | "hoverAssistEnabled"
  > {}

export interface DroneFlightState {
  position: Vector3Tuple;
  velocity: Vector3Tuple;
  rotation: Vector3Tuple;
  angularVelocity: Vector3Tuple;
  lastStablePosition: Vector3Tuple;
  resetPosition: Vector3Tuple;
}

export type DroneRotationInput = Vector3Tuple | number;

const DEG_TO_RAD = Math.PI / 180;
const MAX_DELTA_SECONDS = 0.25;
const NEUTRAL_INPUT_DEAD_ZONE = 0.03;
const MIN_MASS_KG = 0.01;
const MIN_ALTITUDE = 0.25;
const SPEED_DRAG_SCALE = 0.095;
const VERTICAL_SPEED_DRAG_SCALE = 0.14;

function rotationFromInput(
  rotation: DroneRotationInput = [0, 0, 0],
): Vector3Tuple {
  if (typeof rotation === "number") {
    return [0, finiteNumber(rotation), 0];
  }

  return sanitizeVector(rotation);
}

function cloneVector(vector: Vector3Tuple): Vector3Tuple {
  return [vector[0], vector[1], vector[2]];
}

function expoAxis(value: number, expo: number): number {
  const clamped = clampUnit(value);
  const amount = clamp(expo, 0, 1);
  const magnitude = Math.abs(clamped);
  const shapedMagnitude =
    magnitude * (1 - amount) + magnitude * magnitude * magnitude * amount;

  return Math.sign(clamped) * shapedMagnitude;
}

function isNeutral(value: number): boolean {
  return Math.abs(value) <= NEUTRAL_INPUT_DEAD_ZONE;
}

function maxRateRadians(
  assist: AssistConfig,
  axis: keyof AssistConfig["maxAngularVelocityDegPerSec"],
): number {
  return (
    Math.max(0, finiteNumber(assist.maxAngularVelocityDegPerSec[axis])) *
    DEG_TO_RAD
  );
}

function targetPitchRate(
  commandPitch: number,
  rotation: Vector3Tuple,
  assist: AssistConfig,
): number {
  if (isNeutral(commandPitch)) {
    return -rotation[0] * autoLevelRate(assist);
  }

  return (
    expoAxis(commandPitch, assist.inputExpo) * maxRateRadians(assist, "pitch")
  );
}

function targetRollRate(
  commandRoll: number,
  rotation: Vector3Tuple,
  assist: AssistConfig,
): number {
  if (isNeutral(commandRoll)) {
    return -rotation[2] * autoLevelRate(assist);
  }

  return -expoAxis(commandRoll, assist.inputExpo) * maxRateRadians(assist, "roll");
}

function autoLevelRate(assist: AssistConfig): number {
  return Math.max(
    0,
    finiteNumber(assist.autoLevelStrength) +
      finiteNumber(assist.horizonHoldStrength) * 0.5,
  );
}

function nextAngularVelocity(
  state: DroneFlightState,
  command: InputCommand,
  drone: DroneConfig,
  assist: AssistConfig,
  deltaSeconds: number,
): Vector3Tuple {
  const targetRates: Vector3Tuple = [
    targetPitchRate(command.pitch, state.rotation, assist),
    expoAxis(command.yaw, assist.inputExpo) * maxRateRadians(assist, "yaw"),
    targetRollRate(command.roll, state.rotation, assist),
  ];
  const responses: Vector3Tuple = [
    Math.max(0, finiteNumber(drone.angularResponse.pitch)),
    Math.max(0, finiteNumber(drone.angularResponse.yaw)),
    Math.max(0, finiteNumber(drone.angularResponse.roll)),
  ];
  const angularDamping = Math.max(0, finiteNumber(drone.angularDrag));
  const maxRates: Vector3Tuple = [
    maxRateRadians(assist, "pitch"),
    maxRateRadians(assist, "yaw"),
    maxRateRadians(assist, "roll"),
  ];

  return [
    clamp(
      damp(
        moveToward(
          state.angularVelocity[0],
          targetRates[0],
          responses[0],
          deltaSeconds,
        ),
        angularDamping,
        deltaSeconds,
      ),
      -maxRates[0],
      maxRates[0],
    ),
    clamp(
      damp(
        moveToward(
          state.angularVelocity[1],
          targetRates[1],
          responses[1],
          deltaSeconds,
        ),
        angularDamping,
        deltaSeconds,
      ),
      -maxRates[1],
      maxRates[1],
    ),
    clamp(
      damp(
        moveToward(
          state.angularVelocity[2],
          targetRates[2],
          responses[2],
          deltaSeconds,
        ),
        angularDamping,
        deltaSeconds,
      ),
      -maxRates[2],
      maxRates[2],
    ),
  ];
}

function integrateRotation(
  state: DroneFlightState,
  angularVelocity: Vector3Tuple,
  drone: DroneConfig,
  deltaSeconds: number,
): Vector3Tuple {
  const maxTilt = Math.max(0, finiteNumber(drone.maxTiltDegrees)) * DEG_TO_RAD;
  const nextPitch = clamp(
    state.rotation[0] + angularVelocity[0] * deltaSeconds,
    -maxTilt,
    maxTilt,
  );
  const nextRoll = clamp(
    state.rotation[2] + angularVelocity[2] * deltaSeconds,
    -maxTilt,
    maxTilt,
  );

  return [
    nextPitch,
    wrapRadians(state.rotation[1] + angularVelocity[1] * deltaSeconds),
    nextRoll,
  ];
}

function thrustAcceleration(
  rotation: Vector3Tuple,
  command: InputCommand,
  config: FlightSimulationConfig,
): Vector3Tuple {
  const drone = config.drone;
  const mass = Math.max(MIN_MASS_KG, finiteNumber(drone.massKg, MIN_MASS_KG));
  const throttle = clampUnit(command.throttle);
  const minThrust = Math.max(0, finiteNumber(drone.idleThrustNewtons));
  const maxThrust = Math.max(minThrust, finiteNumber(drone.maxThrustNewtons));
  const pitch = rotation[0];
  const yaw = rotation[1];
  const roll = rotation[2];
  const gravity = sanitizeVector(config.gravity);
  const verticalEfficiency = Math.max(0.2, Math.cos(pitch) * Math.cos(roll));
  const hoverThrust = config.hoverAssistEnabled
    ? clamp(
        (mass * Math.abs(gravity[1])) / verticalEfficiency,
        minThrust,
        maxThrust,
      )
    : minThrust;
  const thrust =
    throttle >= 0
      ? hoverThrust + throttle * (maxThrust - hoverThrust)
      : hoverThrust + throttle * (hoverThrust - minThrust);
  const thrustPerMass = thrust / mass;
  const forward: Vector3Tuple = [Math.sin(yaw), 0, Math.cos(yaw)];
  const right: Vector3Tuple = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const horizontalAssist = clamp(config.assist.strength, 0, 1);

  return addVector(
    addVector(
      scaleVector(forward, Math.sin(pitch) * thrustPerMass * horizontalAssist),
      scaleVector(right, -Math.sin(roll) * thrustPerMass * horizontalAssist),
    ),
    [0, thrustPerMass * verticalEfficiency, 0],
  );
}

function horizontalControlAcceleration(
  rotation: Vector3Tuple,
  command: InputCommand,
  assist: AssistConfig,
): Vector3Tuple {
  const acceleration =
    Math.max(0, finiteNumber(assist.horizontalControlAcceleration)) *
    clamp(assist.strength, 0, 1);

  if (acceleration === 0) {
    return [0, 0, 0];
  }

  const yaw = rotation[1];
  const forward: Vector3Tuple = [Math.sin(yaw), 0, Math.cos(yaw)];
  const right: Vector3Tuple = [Math.cos(yaw), 0, -Math.sin(yaw)];
  const pitchMove = expoAxis(command.pitch, assist.inputExpo);
  const rollMove = expoAxis(command.roll, assist.inputExpo);

  return addVector(
    scaleVector(forward, pitchMove * acceleration),
    scaleVector(right, rollMove * acceleration),
  );
}

function deterministicNoise(
  position: Vector3Tuple,
  elapsedSeconds: number,
  wind: WindConfig,
): Vector3Tuple {
  const frequency = Math.max(0, finiteNumber(wind.noiseFrequency));
  const amplitude = Math.max(0, finiteNumber(wind.noiseAmplitude));
  const time = finiteNumber(elapsedSeconds);

  return [
    Math.sin((position[0] * 0.73 + position[2] * 0.19 + time) * frequency) *
      amplitude,
    Math.sin(
      (position[1] * 0.41 - position[0] * 0.17 + time * 0.7) * frequency,
    ) *
      amplitude *
      0.35,
    Math.cos(
      (position[2] * 0.61 + position[0] * 0.29 - time * 0.9) * frequency,
    ) *
      amplitude,
  ];
}

function windAcceleration(
  position: Vector3Tuple,
  wind: WindConfig,
  elapsedSeconds: number,
): Vector3Tuple {
  if (!wind.enabled) {
    return [0, 0, 0];
  }

  const base = scaleVector(
    sanitizeVector(wind.vector),
    Math.max(0, finiteNumber(wind.gustStrength)),
  );

  return addVector(base, deterministicNoise(position, elapsedSeconds, wind));
}

function applyDrag(
  velocity: Vector3Tuple,
  drone: DroneConfig,
  brake: boolean,
  deltaSeconds: number,
): Vector3Tuple {
  const brakeMultiplier = brake
    ? Math.max(1, finiteNumber(drone.brakeDragMultiplier, 1))
    : 1;
  const horizontalDrag =
    ((Math.max(0, finiteNumber(drone.linearDrag)) +
      Math.max(0, finiteNumber(drone.lateralDrag))) /
      2) *
    brakeMultiplier;
  const verticalDrag =
    Math.max(0, finiteNumber(drone.verticalDrag)) * Math.sqrt(brakeMultiplier);
  const horizontalSpeed = Math.hypot(velocity[0], velocity[2]);
  const horizontalAirDrag = horizontalSpeed * SPEED_DRAG_SCALE * brakeMultiplier;
  const verticalAirDrag =
    Math.abs(velocity[1]) * VERTICAL_SPEED_DRAG_SCALE * Math.sqrt(brakeMultiplier);

  return [
    damp(velocity[0], horizontalDrag + horizontalAirDrag, deltaSeconds),
    damp(velocity[1], verticalDrag + verticalAirDrag, deltaSeconds),
    damp(velocity[2], horizontalDrag + horizontalAirDrag, deltaSeconds),
  ];
}

function integrateVelocity(
  state: DroneFlightState,
  command: InputCommand,
  config: FlightSimulationConfig,
  rotation: Vector3Tuple,
  deltaSeconds: number,
  elapsedSeconds: number,
): Vector3Tuple {
  const gravity = sanitizeVector(config.gravity);
  const acceleration = addVector(
    addVector(
      addVector(
        thrustAcceleration(rotation, command, config),
        horizontalControlAcceleration(rotation, command, config.assist),
      ),
      gravity,
    ),
    windAcceleration(state.position, config.wind, elapsedSeconds),
  );
  const accelerated = addVector(
    state.velocity,
    scaleVector(acceleration, deltaSeconds),
  );

  return applyDrag(accelerated, config.drone, command.brake, deltaSeconds);
}

function integratePosition(
  state: DroneFlightState,
  velocity: Vector3Tuple,
  deltaSeconds: number,
): Vector3Tuple {
  const next = addVector(state.position, scaleVector(velocity, deltaSeconds));

  if (next[1] < MIN_ALTITUDE) {
    return [next[0], MIN_ALTITUDE, next[2]];
  }

  return next;
}

function groundedVelocity(
  position: Vector3Tuple,
  velocity: Vector3Tuple,
): Vector3Tuple {
  if (position[1] <= MIN_ALTITUDE && velocity[1] < 0) {
    return [velocity[0], 0, velocity[2]];
  }

  return velocity;
}

function stablePositionFor(
  previous: DroneFlightState,
  position: Vector3Tuple,
): Vector3Tuple {
  if (position.every(Number.isFinite) && position[1] > MIN_ALTITUDE + 0.05) {
    return position;
  }

  return previous.lastStablePosition;
}

export function createDroneFlightState(
  startPosition: Vector3Tuple,
  startRotation?: DroneRotationInput,
): DroneFlightState {
  const position = sanitizeVector(startPosition);
  const rotation = rotationFromInput(startRotation);

  return {
    position,
    velocity: [0, 0, 0],
    rotation,
    angularVelocity: [0, 0, 0],
    lastStablePosition: cloneVector(position),
    resetPosition: cloneVector(position),
  };
}

export function resetDroneState(
  state: DroneFlightState,
  startPosition?: Vector3Tuple,
  startRotation?: DroneRotationInput,
): DroneFlightState {
  const position = sanitizeVector(
    startPosition ?? state.lastStablePosition ?? state.resetPosition,
  );
  const rotation = rotationFromInput(startRotation);

  return {
    position,
    velocity: [0, 0, 0],
    rotation,
    angularVelocity: [0, 0, 0],
    lastStablePosition: cloneVector(position),
    resetPosition: cloneVector(position),
  };
}

export function stepFlight(
  state: DroneFlightState,
  command: InputCommand,
  config: FlightSimulationConfig = defaultSimulationConfig,
  deltaSeconds = defaultSimulationConfig.fixedDeltaMs / 1000,
  elapsedSeconds = 0,
): DroneFlightState {
  const delta = clamp(deltaSeconds, 0, MAX_DELTA_SECONDS);
  const safeState: DroneFlightState = {
    position: sanitizeVector(state.position),
    velocity: sanitizeVector(state.velocity),
    rotation: rotationFromInput(state.rotation),
    angularVelocity: sanitizeVector(state.angularVelocity),
    lastStablePosition: sanitizeVector(state.lastStablePosition),
    resetPosition: sanitizeVector(state.resetPosition),
  };
  const angularVelocity = nextAngularVelocity(
    safeState,
    command,
    config.drone,
    config.assist,
    delta,
  );
  const rotation = integrateRotation(
    safeState,
    angularVelocity,
    config.drone,
    delta,
  );
  let velocity = integrateVelocity(
    safeState,
    command,
    config,
    rotation,
    delta,
    elapsedSeconds,
  );
  const position = integratePosition(safeState, velocity, delta);
  velocity = groundedVelocity(position, velocity);

  return {
    position,
    velocity,
    rotation,
    angularVelocity,
    lastStablePosition: stablePositionFor(safeState, position),
    resetPosition: safeState.resetPosition,
  };
}

export function isOutOfBounds(
  position: Vector3Tuple,
  bounds: CourseBounds,
): boolean {
  if (
    !position.every(Number.isFinite) ||
    !bounds.min.every(Number.isFinite) ||
    !bounds.max.every(Number.isFinite)
  ) {
    return true;
  }

  const safePosition = sanitizeVector(position);

  return (
    safePosition[0] < bounds.min[0] ||
    safePosition[0] > bounds.max[0] ||
    safePosition[1] < bounds.min[1] ||
    safePosition[1] > bounds.max[1] ||
    safePosition[2] < bounds.min[2] ||
    safePosition[2] > bounds.max[2]
  );
}
