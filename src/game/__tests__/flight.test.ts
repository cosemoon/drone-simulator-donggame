import { describe, expect, it } from "vitest";
import {
  createDroneFlightState,
  defaultSimulationConfig,
  neutralInputCommand,
  resetDroneState,
  isOutOfBounds,
  stepFlight,
} from "../index";
import type { InputCommand, SimulationConfig, Vector3Tuple } from "../index";

const noWindConfig: SimulationConfig = {
  ...defaultSimulationConfig,
  wind: {
    ...defaultSimulationConfig.wind,
    enabled: false,
  },
};

function command(overrides: Partial<InputCommand> = {}): InputCommand {
  return {
    ...neutralInputCommand,
    ...overrides,
  };
}

function configWithDrone(
  overrides: Partial<SimulationConfig["drone"]>,
): SimulationConfig {
  return {
    ...noWindConfig,
    drone: {
      ...noWindConfig.drone,
      ...overrides,
    },
  };
}

function magnitude(vector: Vector3Tuple): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

describe("drone flight simulation", () => {
  it("holds altitude from neutral throttle while upright", () => {
    const initial = createDroneFlightState([0, 10, 0]);

    const next = stepFlight(
      initial,
      command(),
      noWindConfig,
      1 / noWindConfig.tickHz,
      0,
    );

    expect(next.velocity[1]).toBeCloseTo(0, 5);
    expect(next.position[1]).toBeCloseTo(initial.position[1], 5);
  });

  it("falls from neutral throttle when hover assist is disabled", () => {
    const initial = createDroneFlightState([0, 10, 0]);

    const next = stepFlight(
      initial,
      command(),
      { ...noWindConfig, hoverAssistEnabled: false },
      1 / noWindConfig.tickHz,
      0,
    );

    expect(next.velocity[1]).toBeLessThan(0);
    expect(next.position[1]).toBeLessThan(initial.position[1]);
  });

  it("descends when throttle is pulled below the hover point", () => {
    const initial = createDroneFlightState([0, 10, 0]);

    const next = stepFlight(
      initial,
      command({ throttle: -1 }),
      noWindConfig,
      1 / noWindConfig.tickHz,
      0,
    );

    expect(next.velocity[1]).toBeLessThan(0);
    expect(next.position[1]).toBeLessThan(initial.position[1]);
  });

  it("damps leftover climb speed after throttle returns to neutral", () => {
    const initial = {
      ...createDroneFlightState([0, 10, 0]),
      velocity: [0, 2.4, 0] as Vector3Tuple,
    };

    const next = stepFlight(initial, command(), noWindConfig, 0.5, 0);

    expect(next.velocity[1]).toBeGreaterThan(0);
    expect(next.velocity[1]).toBeLessThan(1.5);
  });

  it("increases vertical velocity and altitude with sustained throttle", () => {
    let state = createDroneFlightState([0, 2, 0]);

    for (let step = 0; step < 45; step += 1) {
      state = stepFlight(
        state,
        command({ throttle: 1 }),
        noWindConfig,
        1 / noWindConfig.tickHz,
        step / noWindConfig.tickHz,
      );
    }

    expect(state.velocity[1]).toBeGreaterThan(0);
    expect(state.position[1]).toBeGreaterThan(2);
  });

  it("changes pitch, roll, and yaw rotation from normalized controls", () => {
    const initial = createDroneFlightState([0, 3, 0]);

    const next = stepFlight(
      initial,
      command({ pitch: 1, roll: 1, yaw: 1 }),
      noWindConfig,
      0.25,
      0,
    );

    expect(next.rotation[0]).toBeGreaterThan(0);
    expect(next.rotation[1]).toBeGreaterThan(0);
    expect(next.rotation[2]).toBeLessThan(0);
    expect(Math.abs(next.angularVelocity[0])).toBeLessThanOrEqual(
      (noWindConfig.assist.maxAngularVelocityDegPerSec.pitch * Math.PI) / 180,
    );
  });

  it("tilts visually in the same direction as left and right movement commands", () => {
    const initial = createDroneFlightState([0, 3, 0]);
    const screenLeft = stepFlight(
      initial,
      command({ roll: 1 }),
      noWindConfig,
      0.25,
      0,
    );
    const screenRight = stepFlight(
      initial,
      command({ roll: -1 }),
      noWindConfig,
      0.25,
      0,
    );

    expect(screenLeft.rotation[2]).toBeLessThan(0);
    expect(screenRight.rotation[2]).toBeGreaterThan(0);
  });

  it("moves forward/back and screen-left/right from right-stick controls even without throttle", () => {
    const assistedMovementConfig: SimulationConfig = {
      ...noWindConfig,
      gravity: [0, 0, 0],
      drone: {
        ...noWindConfig.drone,
        idleThrustNewtons: 0,
        maxThrustNewtons: 0,
      },
    };
    const initial = createDroneFlightState([0, 3, 0]);
    const forward = stepFlight(
      initial,
      command({ pitch: 1 }),
      assistedMovementConfig,
      0.25,
      0,
    );
    const back = stepFlight(
      initial,
      command({ pitch: -1 }),
      assistedMovementConfig,
      0.25,
      0,
    );
    const screenRight = stepFlight(
      initial,
      command({ roll: -1 }),
      assistedMovementConfig,
      0.25,
      0,
    );
    const screenLeft = stepFlight(
      initial,
      command({ roll: 1 }),
      assistedMovementConfig,
      0.25,
      0,
    );

    expect(forward.velocity[2]).toBeGreaterThan(0);
    expect(back.velocity[2]).toBeLessThan(0);
    expect(screenRight.velocity[0]).toBeLessThan(0);
    expect(screenLeft.velocity[0]).toBeGreaterThan(0);
  });

  it("holds altitude while moving with pitch and roll commands", () => {
    let state = createDroneFlightState([0, 8, 0]);

    for (let step = 0; step < noWindConfig.tickHz * 2; step += 1) {
      state = stepFlight(
        state,
        command({ pitch: 1, roll: 1 }),
        noWindConfig,
        1 / noWindConfig.tickHz,
        step / noWindConfig.tickHz,
      );
    }

    expect(state.position[1]).toBeGreaterThanOrEqual(7.95);
  });

  it("tapers sustained acceleration with speed-based air resistance", () => {
    let state = createDroneFlightState([0, 8, 0]);
    let speedAfterOneSecond = 0;
    let speedAfterFourSeconds = 0;

    for (let step = 0; step < noWindConfig.tickHz * 6; step += 1) {
      state = stepFlight(
        state,
        command({ pitch: 1 }),
        noWindConfig,
        1 / noWindConfig.tickHz,
        step / noWindConfig.tickHz,
      );

      if (step === noWindConfig.tickHz) {
        speedAfterOneSecond = magnitude([state.velocity[0], 0, state.velocity[2]]);
      }

      if (step === noWindConfig.tickHz * 4) {
        speedAfterFourSeconds = magnitude([state.velocity[0], 0, state.velocity[2]]);
      }
    }

    const finalSpeed = magnitude([state.velocity[0], 0, state.velocity[2]]);

    expect(finalSpeed - speedAfterFourSeconds).toBeLessThan(
      speedAfterFourSeconds - speedAfterOneSecond,
    );
    expect(finalSpeed).toBeLessThan(12);
  });

  it("damps angular velocity and auto-levels pitch and roll when input is neutral", () => {
    const initial = createDroneFlightState([0, 4, 0], [0.35, 0.4, -0.3]);
    const disturbed = stepFlight(
      initial,
      command({ pitch: 1, roll: 1, yaw: 1 }),
      noWindConfig,
      0.2,
      0,
    );

    const leveled = stepFlight(
      disturbed,
      command(),
      noWindConfig,
      0.5,
      0.5,
    );

    expect(Math.abs(leveled.angularVelocity[0])).toBeLessThan(
      Math.abs(disturbed.angularVelocity[0]),
    );
    expect(Math.abs(leveled.angularVelocity[2])).toBeLessThan(
      Math.abs(disturbed.angularVelocity[2]),
    );
    expect(Math.abs(leveled.rotation[0])).toBeLessThan(
      Math.abs(disturbed.rotation[0]),
    );
    expect(Math.abs(leveled.rotation[2])).toBeLessThan(
      Math.abs(disturbed.rotation[2]),
    );
  });

  it("brake increases drag against existing velocity", () => {
    const state = {
      ...createDroneFlightState([0, 5, 0]),
      velocity: [8, 0, -3] as Vector3Tuple,
    };

    const coasting = stepFlight(state, command(), noWindConfig, 0.5, 0);
    const braking = stepFlight(
      state,
      command({ brake: true }),
      noWindConfig,
      0.5,
      0,
    );

    expect(magnitude(braking.velocity)).toBeLessThan(magnitude(coasting.velocity));
  });

  it("reset restores a stable pose and records the reset position", () => {
    const active = {
      ...createDroneFlightState([0, 4, 0], [0.2, 0.5, -0.2]),
      velocity: [3, -2, 1] as Vector3Tuple,
      angularVelocity: [1, 1, 1] as Vector3Tuple,
    };

    const reset = resetDroneState(active, [4, 6, -2], [0, 0.75, 0]);

    expect(reset.position).toEqual([4, 6, -2]);
    expect(reset.velocity).toEqual([0, 0, 0]);
    expect(reset.rotation).toEqual([0, 0.75, 0]);
    expect(reset.angularVelocity).toEqual([0, 0, 0]);
    expect(reset.lastStablePosition).toEqual([4, 6, -2]);
    expect(reset.resetPosition).toEqual([4, 6, -2]);
  });

  it("detects positions outside course bounds and treats invalid positions as outside", () => {
    const bounds = {
      min: [-2, 0, -2] as Vector3Tuple,
      max: [2, 5, 2] as Vector3Tuple,
    };

    expect(isOutOfBounds([0, 2, 0], bounds)).toBe(false);
    expect(isOutOfBounds([3, 2, 0], bounds)).toBe(true);
    expect(isOutOfBounds([0, Number.NaN, 0], bounds)).toBe(true);
  });

  it("applies deterministic wind influence from elapsed time and position", () => {
    const windyInitial = createDroneFlightState([2, 8, -3]);
    const windyConfig: SimulationConfig = {
      ...defaultSimulationConfig,
      wind: {
        ...defaultSimulationConfig.wind,
        enabled: true,
      },
    };

    const first = stepFlight(windyInitial, command(), windyConfig, 0.4, 12.5);
    const second = stepFlight(windyInitial, command(), windyConfig, 0.4, 12.5);
    const calm = stepFlight(windyInitial, command(), noWindConfig, 0.4, 12.5);

    expect(first).toEqual(second);
    expect(first.velocity).not.toEqual(calm.velocity);
  });

  it("keeps values finite and tilt clamped under large input and delta spikes", () => {
    let state = createDroneFlightState([0, 100, 0]);
    const config = configWithDrone({ maxTiltDegrees: 30 });
    const maxTiltRadians = (config.drone.maxTiltDegrees * Math.PI) / 180;

    state = stepFlight(
      state,
      command({ throttle: 99, pitch: 99, roll: -99, yaw: 99 }),
      config,
      10,
      100,
    );

    const values = [
      ...state.position,
      ...state.velocity,
      ...state.rotation,
      ...state.angularVelocity,
    ];

    expect(values.every(Number.isFinite)).toBe(true);
    expect(Math.abs(state.rotation[0])).toBeLessThanOrEqual(maxTiltRadians);
    expect(Math.abs(state.rotation[2])).toBeLessThanOrEqual(maxTiltRadians);
  });
});
