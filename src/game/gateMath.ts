import type { Gate, Vector3Tuple } from "./types";

function subtract(a: Vector3Tuple, b: Vector3Tuple): Vector3Tuple {
  return [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
}

function addScaled(
  point: Vector3Tuple,
  direction: Vector3Tuple,
  scale: number,
): Vector3Tuple {
  return [
    point[0] + direction[0] * scale,
    point[1] + direction[1] * scale,
    point[2] + direction[2] * scale,
  ];
}

function dot(a: Vector3Tuple, b: Vector3Tuple): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

function magnitude(vector: Vector3Tuple): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

function normalize(vector: Vector3Tuple): Vector3Tuple {
  const length = magnitude(vector);

  if (length === 0) {
    return [0, 0, 1];
  }

  return [vector[0] / length, vector[1] / length, vector[2] / length];
}

export function signedGateDistance(gate: Gate, point: Vector3Tuple): number {
  return dot(subtract(point, gate.position), normalize(gate.normal));
}

export function crossedGatePlane(
  gate: Gate,
  previousPosition: Vector3Tuple,
  currentPosition: Vector3Tuple,
): boolean {
  const before = signedGateDistance(gate, previousPosition);
  const after = signedGateDistance(gate, currentPosition);

  if (before >= 0 || after < 0) {
    return false;
  }

  const distanceDelta = after - before;

  if (distanceDelta <= 0) {
    return false;
  }

  const t = -before / distanceDelta;
  const movement = subtract(currentPosition, previousPosition);
  const intersection = addScaled(previousPosition, movement, t);
  const centerToIntersection = subtract(intersection, gate.position);

  return magnitude(centerToIntersection) <= gate.radius;
}
