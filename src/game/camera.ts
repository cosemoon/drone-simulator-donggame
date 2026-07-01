import * as THREE from "three";
import type { CameraCommand, CameraMode, Gate, Vector3Tuple } from "./types";

export type PlayableCameraMode = Extract<CameraMode, "chase" | "fpv">;

const PLAYABLE_CAMERA_MODES = new Set<CameraMode>(["chase", "fpv"]);
const FORWARD = new THREE.Vector3(0, 0, 1);
const UP = new THREE.Vector3(0, 1, 0);

function isPlayableCameraMode(mode: CameraMode): mode is PlayableCameraMode {
  return PLAYABLE_CAMERA_MODES.has(mode);
}

export function normalizeCameraMode(mode: CameraMode): PlayableCameraMode {
  return isPlayableCameraMode(mode) ? mode : "chase";
}

export function resolveCameraModeCommand(
  currentMode: CameraMode,
  command: CameraCommand,
): PlayableCameraMode {
  const current = normalizeCameraMode(currentMode);

  if (command === "cycle") {
    return current === "chase" ? "fpv" : "chase";
  }

  if (command === "chase" || command === "fpv") {
    return command;
  }

  return current;
}

export interface DroneCameraState {
  position: Vector3Tuple;
  rotation: Vector3Tuple;
}

export interface CameraRigOptions {
  nextGate?: Gate | null;
  smoothing?: number;
}

function vectorFromTuple(tuple: Vector3Tuple): THREE.Vector3 {
  return new THREE.Vector3(tuple[0], tuple[1], tuple[2]);
}

function eulerFromDrone(rotation: Vector3Tuple): THREE.Euler {
  return new THREE.Euler(rotation[0], rotation[1], rotation[2], "YXZ");
}

function applyCameraSmoothing(
  camera: THREE.PerspectiveCamera,
  targetPosition: THREE.Vector3,
  targetLookAt: THREE.Vector3,
  smoothing: number,
): void {
  const amount = THREE.MathUtils.clamp(smoothing, 0, 1);

  if (amount >= 1 || camera.position.lengthSq() === 0) {
    camera.position.copy(targetPosition);
  } else {
    camera.position.lerp(targetPosition, amount);
  }

  camera.up.copy(UP);
  camera.lookAt(targetLookAt);
}

export function updateCameraRig(
  camera: THREE.PerspectiveCamera,
  drone: DroneCameraState,
  mode: PlayableCameraMode,
  options: CameraRigOptions = {},
): void {
  const position = vectorFromTuple(drone.position);
  const euler = eulerFromDrone(drone.rotation);
  const forward = FORWARD.clone().applyEuler(euler).normalize();
  const smoothing = options.smoothing ?? 1;

  if (mode === "fpv") {
    const cockpit = position.clone().add(new THREE.Vector3(0, 0.18, 0));
    const lookAt = cockpit.clone().add(forward.multiplyScalar(16));

    camera.position.copy(cockpit);
    camera.up.copy(UP);
    camera.lookAt(lookAt);
    return;
  }

  const yawOnlyForward = new THREE.Vector3(
    Math.sin(drone.rotation[1]),
    0,
    Math.cos(drone.rotation[1]),
  ).normalize();
  const targetPosition = position
    .clone()
    .addScaledVector(yawOnlyForward, -8.8)
    .add(new THREE.Vector3(0, 4.2, 0));
  const lookAt = position
    .clone()
    .addScaledVector(yawOnlyForward, 7)
    .add(new THREE.Vector3(0, 1, 0));

  applyCameraSmoothing(camera, targetPosition, lookAt, smoothing);
}
