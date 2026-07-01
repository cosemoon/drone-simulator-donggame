import * as THREE from "three";
import { describe, expect, it } from "vitest";
import { updateCameraRig } from "../camera";
import { trainingArenaCourse } from "../course";
import type { Vector3Tuple } from "../types";

function directionOf(camera: THREE.PerspectiveCamera): Vector3Tuple {
  const direction = new THREE.Vector3();

  camera.getWorldDirection(direction);

  return [direction.x, direction.y, direction.z];
}

describe("chase camera rig", () => {
  it("stays fixed behind the drone instead of easing from old camera state", () => {
    const camera = new THREE.PerspectiveCamera(70, 1, 0.1, 220);

    camera.position.set(100, 50, 20);
    updateCameraRig(
      camera,
      { position: [0, 3, 0], rotation: [0, 0, 0] },
      "chase",
    );

    expect(camera.position.x).toBeCloseTo(0, 3);
    expect(camera.position.y).toBeCloseTo(7.2, 3);
    expect(camera.position.z).toBeCloseTo(-8.8, 3);
  });

  it("keeps the same chase look direction even when a next gate is present", () => {
    const withoutGate = new THREE.PerspectiveCamera(70, 1, 0.1, 220);
    const withGate = new THREE.PerspectiveCamera(70, 1, 0.1, 220);
    const drone = { position: [0, 3, 0] as Vector3Tuple, rotation: [0, 0, 0] as Vector3Tuple };

    updateCameraRig(withoutGate, drone, "chase", { smoothing: 1 });
    updateCameraRig(withGate, drone, "chase", {
      nextGate: trainingArenaCourse.gates[5],
      smoothing: 1,
    });

    expect(directionOf(withGate)).toEqual(
      expect.arrayContaining(directionOf(withoutGate).map((value) => expect.closeTo(value, 3))),
    );
  });
});
