import { COURSE_VERSION } from "./config";
import type { Course, Gate, Vector3Tuple } from "./types";

function gateDimensions(radius: number) {
  return {
    width: radius * 2,
    height: radius * 2,
    depth: 0.36,
  };
}

function gate(
  id: string,
  order: number,
  label: string,
  position: Vector3Tuple,
  normal: Vector3Tuple,
  radius: number,
  accent: string,
): Gate {
  return {
    id,
    order,
    label,
    position,
    normal,
    radius,
    rotation: [0, 0, 0],
    dimensions: gateDimensions(radius),
    required: true,
    accent,
  };
}

export const trainingArenaGates = [
  gate("ta-gate-01", 1, "게이트 1", [0, 3.2, -2], [0, 0, 1], 3.2, "start"),
  gate(
    "ta-gate-02",
    2,
    "게이트 2",
    [7, 4.3, 7],
    [-0.35, 0, 0.94],
    3,
    "right-bank",
  ),
  gate(
    "ta-gate-03",
    3,
    "게이트 3",
    [-6, 5.4, 15],
    [0.45, 0, 0.89],
    3,
    "left-climb",
  ),
  gate("ta-gate-04", 4, "게이트 4", [0, 6.1, 23], [0, 0, 1], 2.8, "high-center"),
  gate(
    "ta-gate-05",
    5,
    "게이트 5",
    [8, 4.8, 30],
    [-0.5, 0, 0.86],
    3,
    "sprint-right",
  ),
  gate(
    "ta-gate-06",
    6,
    "게이트 6",
    [-8, 3.8, 35],
    [0.5, 0, 0.86],
    3.2,
    "sprint-left",
  ),
  gate(
    "ta-gate-07",
    7,
    "게이트 7",
    [-2, 5.8, 41],
    [0.12, 0, 0.99],
    2.8,
    "tight-rise",
  ),
  {
    ...gate(
      "ta-gate-08",
      8,
      "결승 게이트",
      [0, 4.4, 46],
      [0, 0, 1],
      3.4,
      "finish",
    ),
    themeAccent: {
      "clean-sim": "finish-green",
      "neon-night": "hot-finish",
      "high-contrast": "finish-yellow",
    },
  },
] as const satisfies readonly Gate[];

export const trainingArenaCourse: Course = {
  id: "training-arena-01",
  version: COURSE_VERSION,
  label: "훈련 아레나",
  description: "입문용 Assisted Acro 타임어택 코스",
  themeId: "clean-sim",
  start: {
    name: "훈련 출발",
    position: [0, 2.2, -10],
    rotation: [0, 0, 0],
    padRadius: 3.5,
  },
  finish: {
    name: "훈련 결승",
    type: "gate",
    gateId: "ta-gate-08",
    position: [0, 4.4, 46],
    rotation: [0, 0, 0],
    width: 6.8,
  },
  bounds: {
    min: [-18, 0, -16],
    max: [18, 12, 54],
  },
  gates: trainingArenaGates,
};

export const courses = [trainingArenaCourse] as const satisfies readonly Course[];
