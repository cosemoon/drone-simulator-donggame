import type { Vector3Tuple } from "./types";

export const ZERO_VECTOR: Vector3Tuple = [0, 0, 0];

export function finiteNumber(value: number, fallback = 0): number {
  return Number.isFinite(value) ? value : fallback;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, finiteNumber(value, min)));
}

export function clampUnit(value: number): number {
  return clamp(value, -1, 1);
}

export function addVector(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

export function scaleVector(
  vector: Vector3Tuple,
  scalar: number,
): Vector3Tuple {
  const finiteScalar = finiteNumber(scalar);

  return [
    vector[0] * finiteScalar,
    vector[1] * finiteScalar,
    vector[2] * finiteScalar,
  ];
}

export function sanitizeVector(
  vector: Vector3Tuple,
  fallback: Vector3Tuple = ZERO_VECTOR,
): Vector3Tuple {
  return [
    finiteNumber(vector[0], fallback[0]),
    finiteNumber(vector[1], fallback[1]),
    finiteNumber(vector[2], fallback[2]),
  ];
}

export function vectorMagnitude(vector: Vector3Tuple): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

export function damp(value: number, damping: number, deltaSeconds: number): number {
  const decay = Math.exp(-Math.max(0, finiteNumber(damping)) * deltaSeconds);

  return finiteNumber(value) * decay;
}

export function moveToward(
  value: number,
  target: number,
  response: number,
  deltaSeconds: number,
): number {
  const amount = clamp(response * deltaSeconds, 0, 1);

  return value + (target - value) * amount;
}

export function wrapRadians(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.atan2(Math.sin(value), Math.cos(value));
}
