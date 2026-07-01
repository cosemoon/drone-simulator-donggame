import { describe, expect, it } from "vitest";
import {
  clearInput,
  commandFromKeyboardState,
  commandFromVirtualSticks,
  createKeyboardInput,
  neutralInputCommand,
  normalizeVirtualStickAxis,
} from "../index";

describe("keyboard input mapping", () => {
  it("maps default keys to normalized axes without overlapping throttle and pitch", () => {
    const input = createKeyboardInput();

    input.setKey("KeyW", true);
    input.setKey("KeyA", true);
    input.setKey("ArrowUp", true);
    input.setKey("ArrowLeft", true);
    input.setKey("Space", true);

    expect(input.getCommand()).toEqual({
      ...neutralInputCommand,
      throttle: 1,
      yaw: 1,
      pitch: 1,
      roll: 1,
      brake: true,
    });
  });

  it("can map a plain key state without creating keyboard state", () => {
    expect(
      commandFromKeyboardState({
        KeyS: true,
        KeyD: true,
        ArrowDown: true,
        ArrowRight: true,
      }),
    ).toEqual({
      ...neutralInputCommand,
      throttle: -1,
      yaw: -1,
      pitch: -1,
      roll: -1,
    });
  });

  it("keeps one-shot actions pending until the caller consumes them", () => {
    const input = createKeyboardInput();

    input.setKey("KeyC", true);
    input.setKey("KeyR", true);
    input.setKey("Escape", true);

    expect(input.getCommand()).toMatchObject({
      camera: "cycle",
      reset: true,
      pause: true,
    });
    expect(input.getCommand()).toMatchObject({
      camera: "cycle",
      reset: true,
      pause: true,
    });

    input.consumeOneShotActions();

    expect(input.getCommand()).toMatchObject({
      camera: "none",
      reset: false,
      pause: false,
    });

    input.setKey("KeyC", true);
    expect(input.getCommand().camera).toBe("none");

    input.setKey("KeyC", false);
    input.setKey("KeyC", true);
    expect(input.getCommand().camera).toBe("cycle");
  });

  it("clears held keys and pending actions for blur, pause, cancel, and resume", () => {
    const input = createKeyboardInput();

    input.setKey("KeyW", true);
    input.setKey("ArrowLeft", true);
    input.setKey("KeyC", true);

    expect(clearInput(input)).toEqual(neutralInputCommand);
    expect(input.getCommand()).toEqual(neutralInputCommand);

    input.setKey("KeyW", false);
    input.setKey("ArrowLeft", false);

    expect(input.getCommand()).toEqual(neutralInputCommand);
  });
});

describe("virtual stick normalization", () => {
  it("applies dead zone and clamps axes to the normalized range", () => {
    expect(normalizeVirtualStickAxis(0.04, { deadZone: 0.08 })).toBe(0);
    expect(normalizeVirtualStickAxis(0.54, { deadZone: 0.08 })).toBeCloseTo(
      0.5,
      3,
    );
    expect(normalizeVirtualStickAxis(1.5, { deadZone: 0.08 })).toBe(1);
    expect(normalizeVirtualStickAxis(-1.5, { deadZone: 0.08 })).toBe(-1);
  });

  it("optionally applies expo after dead zone normalization", () => {
    expect(
      normalizeVirtualStickAxis(0.54, { deadZone: 0.08, expo: 1 }),
    ).toBeCloseTo(0.125, 3);
  });

  it("maps left stick to throttle and yaw, and right stick to pitch and roll", () => {
    expect(
      commandFromVirtualSticks(
        {
          left: { x: -0.5, y: 0.6 },
          right: { x: -0.4, y: 0.7 },
        },
        { deadZone: 0, expo: 0 },
      ),
    ).toEqual({
      ...neutralInputCommand,
      throttle: 0.6,
      yaw: 0.5,
      pitch: 0.7,
      roll: 0.4,
    });
  });
});
