import type { InputCommand, SimulationConfig } from "./types";

export const COURSE_VERSION = "2026.06.30";

export const neutralInputCommand: InputCommand = {
  throttle: 0,
  yaw: 0,
  pitch: 0,
  roll: 0,
  brake: false,
  reset: false,
  camera: "none",
  pause: false,
};

export const defaultSimulationConfig: SimulationConfig = {
  buildVersion: "v1-local-2026.06.30",
  courseId: "training-arena-01",
  courseVersion: COURSE_VERSION,
  defaultThemeId: "clean-sim",
  hoverAssistEnabled: true,
  tickHz: 60,
  fixedDeltaMs: 1000 / 60,
  gravity: [0, -9.81, 0],
  drone: {
    massKg: 1.18,
    maxThrustNewtons: 24,
    idleThrustNewtons: 2.1,
    linearDrag: 1.15,
    lateralDrag: 1.3,
    verticalDrag: 3.1,
    angularDrag: 1.15,
    angularResponse: {
      yaw: 5.2,
      pitch: 7.4,
      roll: 7.8,
    },
    maxTiltDegrees: 40,
    brakeDragMultiplier: 3.2,
  },
  assist: {
    mode: "assisted-acro",
    strength: 0.64,
    horizontalControlAcceleration: 5.6,
    autoLevelStrength: 0.42,
    horizonHoldStrength: 0.3,
    inputExpo: 0.28,
    maxAngularVelocityDegPerSec: {
      yaw: 170,
      pitch: 230,
      roll: 240,
    },
  },
  wind: {
    enabled: true,
    vector: [0.65, 0.05, -0.28],
    gustStrength: 0.32,
    noiseAmplitude: 0.18,
    noiseFrequency: 0.085,
  },
  penalties: {
    collisionMs: 2_000,
    gateClipMs: 750,
    missedGateMs: 5_000,
    resetMs: 3_000,
    outOfBoundsMs: 3_000,
    maxRecoverableCollisions: 8,
  },
};
