export type Vector3Tuple = readonly [x: number, y: number, z: number];

export type CameraMode = "chase" | "fpv" | "orbit";

export type CameraCommand = "none" | "cycle" | CameraMode;

export interface InputCommand {
  throttle: number;
  yaw: number;
  pitch: number;
  roll: number;
  brake: boolean;
  reset: boolean;
  camera: CameraCommand;
  pause: boolean;
}

export type ThemeId = "clean-sim" | "neon-night" | "high-contrast";

export interface RaceResult {
  id: string;
  nickname: string;
  courseId: string;
  courseVersion: string;
  themeId: ThemeId;
  elapsedMs: number;
  penaltyMs: number;
  finalMs: number;
  collisions: number;
  wrongGates: number;
  gateClips: number;
  resets: number;
  outOfBounds: number;
  completedAt: string;
  buildVersion: string;
}

export interface GateDimensions {
  width: number;
  height: number;
  depth: number;
}

export interface Gate {
  id: string;
  order: number;
  label: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  normal: Vector3Tuple;
  radius: number;
  dimensions: GateDimensions;
  required: boolean;
  accent?: string;
  themeAccent?: Partial<Record<ThemeId, string>>;
}

export interface CourseStart {
  name: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  padRadius: number;
}

export interface CourseFinish {
  name: string;
  type: "gate" | "line";
  gateId?: string;
  position: Vector3Tuple;
  rotation: Vector3Tuple;
  width: number;
}

export interface CourseBounds {
  min: Vector3Tuple;
  max: Vector3Tuple;
}

export interface Course {
  id: string;
  version: string;
  label: string;
  description: string;
  themeId: ThemeId;
  start: CourseStart;
  finish: CourseFinish;
  bounds: CourseBounds;
  gates: readonly Gate[];
}

export interface AngularResponseConfig {
  yaw: number;
  pitch: number;
  roll: number;
}

export interface DroneConfig {
  massKg: number;
  maxThrustNewtons: number;
  idleThrustNewtons: number;
  linearDrag: number;
  lateralDrag: number;
  verticalDrag: number;
  angularDrag: number;
  angularResponse: AngularResponseConfig;
  maxTiltDegrees: number;
  brakeDragMultiplier: number;
}

export interface AssistConfig {
  mode: "assisted-acro";
  strength: number;
  horizontalControlAcceleration: number;
  autoLevelStrength: number;
  horizonHoldStrength: number;
  inputExpo: number;
  maxAngularVelocityDegPerSec: AngularResponseConfig;
}

export interface WindConfig {
  enabled: boolean;
  vector: Vector3Tuple;
  gustStrength: number;
  noiseAmplitude: number;
  noiseFrequency: number;
}

export interface PenaltyConfig {
  collisionMs: number;
  gateClipMs: number;
  missedGateMs: number;
  resetMs: number;
  outOfBoundsMs: number;
  maxRecoverableCollisions: number;
}

export interface SimulationConfig {
  buildVersion: string;
  courseId: string;
  courseVersion: string;
  defaultThemeId: ThemeId;
  hoverAssistEnabled: boolean;
  tickHz: number;
  fixedDeltaMs: number;
  gravity: Vector3Tuple;
  drone: DroneConfig;
  assist: AssistConfig;
  wind: WindConfig;
  penalties: PenaltyConfig;
}

export type HexColor = `#${string}`;

export interface ThemeColors {
  scene: {
    background: HexColor;
    ambientLight: HexColor;
    keyLight: HexColor;
    accentLight: HexColor;
  };
  sky: {
    top: HexColor;
    horizon: HexColor;
    fog: HexColor;
    fogNear: number;
    fogFar: number;
  };
  ground: {
    base: HexColor;
    gridMajor: HexColor;
    gridMinor: HexColor;
    startPad: HexColor;
    finishPad: HexColor;
  };
  gate: {
    frame: HexColor;
    active: HexColor;
    cleared: HexColor;
    missed: HexColor;
    accent: HexColor;
  };
  hud: {
    foreground: HexColor;
    muted: HexColor;
    panel: HexColor;
    panelBorder: HexColor;
    accent: HexColor;
    warning: HexColor;
    danger: HexColor;
    positive: HexColor;
  };
}

export interface GameTheme {
  id: ThemeId;
  label: string;
  colors: ThemeColors;
}
