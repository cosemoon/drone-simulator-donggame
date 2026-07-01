import { neutralInputCommand } from "./config";
import type { InputCommand } from "./types";

export type OneShotInputAction = "camera" | "reset" | "pause";

export type KeyCodeState =
  | Readonly<Record<string, boolean>>
  | ReadonlyMap<string, boolean>
  | ReadonlySet<string>;

export interface KeyboardInputEventLike {
  code: string;
  repeat?: boolean;
}

export interface KeyboardInputController {
  setKey(code: string, pressed: boolean): void;
  keyDown(event: KeyboardInputEventLike | string): void;
  keyUp(event: KeyboardInputEventLike | string): void;
  getCommand(): InputCommand;
  getKeyState(): ReadonlySet<string>;
  consumeOneShotActions(actions?: readonly OneShotInputAction[]): void;
  clearOneShotActions(actions?: readonly OneShotInputAction[]): void;
  clear(): void;
}

export interface VirtualStickVector {
  x: number;
  y: number;
}

export interface VirtualStickOptions {
  deadZone?: number;
  expo?: number;
}

export interface VirtualStickCommandInput {
  left?: VirtualStickVector | null;
  right?: VirtualStickVector | null;
}

export interface ClearableInput {
  clear(): void;
}

// Desktop defaults keep throttle/yaw on WASD and pitch/roll on arrows so no axis
// has to share a key with another axis. Key values are KeyboardEvent.code names.
export const KEYBOARD_INPUT_BINDINGS = {
  throttleUp: ["KeyW"],
  throttleDown: ["KeyS"],
  yawLeft: ["KeyA"],
  yawRight: ["KeyD"],
  pitchForward: ["ArrowUp"],
  pitchBack: ["ArrowDown"],
  rollLeft: ["ArrowLeft"],
  rollRight: ["ArrowRight"],
  brake: ["Space"],
  camera: ["KeyC"],
  reset: ["KeyR"],
  pause: ["Escape", "KeyP"],
} as const;

export const ONE_SHOT_INPUT_ACTIONS = [
  "camera",
  "reset",
  "pause",
] as const satisfies readonly OneShotInputAction[];

export const DEFAULT_VIRTUAL_STICK_OPTIONS = {
  deadZone: 0.08,
  expo: 0,
} as const satisfies Required<VirtualStickOptions>;

const neutralStick: VirtualStickVector = { x: 0, y: 0 };

export function createNeutralInputCommand(): InputCommand {
  return { ...neutralInputCommand };
}

function clamp(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }

  return Math.min(max, Math.max(min, value));
}

export function clampUnit(value: number): number {
  return clamp(value, -1, 1);
}

function eventCode(event: KeyboardInputEventLike | string): string {
  return typeof event === "string" ? event : event.code;
}

function isKeyPressed(keyState: KeyCodeState, code: string): boolean {
  const maybeMap = keyState as ReadonlyMap<string, boolean>;

  if (typeof maybeMap.get === "function") {
    return maybeMap.get(code) === true;
  }

  const maybeSet = keyState as ReadonlySet<string>;

  if (typeof maybeSet.has === "function") {
    return maybeSet.has(code);
  }

  return (keyState as Readonly<Record<string, boolean>>)[code] === true;
}

function isAnyKeyPressed(
  keyState: KeyCodeState,
  codes: readonly string[],
): boolean {
  return codes.some((code) => isKeyPressed(keyState, code));
}

function axisFromKeys(
  keyState: KeyCodeState,
  positiveCodes: readonly string[],
  negativeCodes: readonly string[],
): number {
  return (
    Number(isAnyKeyPressed(keyState, positiveCodes)) -
    Number(isAnyKeyPressed(keyState, negativeCodes))
  );
}

function keyListIncludes(codes: readonly string[], code: string): boolean {
  return codes.includes(code);
}

function oneShotActionForCode(code: string): OneShotInputAction | null {
  if (keyListIncludes(KEYBOARD_INPUT_BINDINGS.camera, code)) {
    return "camera";
  }

  if (keyListIncludes(KEYBOARD_INPUT_BINDINGS.reset, code)) {
    return "reset";
  }

  if (keyListIncludes(KEYBOARD_INPUT_BINDINGS.pause, code)) {
    return "pause";
  }

  return null;
}

export function commandFromKeyboardState(keyState: KeyCodeState): InputCommand {
  return {
    ...createNeutralInputCommand(),
    throttle: axisFromKeys(
      keyState,
      KEYBOARD_INPUT_BINDINGS.throttleUp,
      KEYBOARD_INPUT_BINDINGS.throttleDown,
    ),
    yaw: axisFromKeys(
      keyState,
      KEYBOARD_INPUT_BINDINGS.yawLeft,
      KEYBOARD_INPUT_BINDINGS.yawRight,
    ),
    pitch: axisFromKeys(
      keyState,
      KEYBOARD_INPUT_BINDINGS.pitchForward,
      KEYBOARD_INPUT_BINDINGS.pitchBack,
    ),
    roll: axisFromKeys(
      keyState,
      KEYBOARD_INPUT_BINDINGS.rollLeft,
      KEYBOARD_INPUT_BINDINGS.rollRight,
    ),
    brake: isAnyKeyPressed(keyState, KEYBOARD_INPUT_BINDINGS.brake),
  };
}

export function createKeyboardInput(
  initialPressedKeys: Iterable<string> = [],
): KeyboardInputController {
  const pressedKeys = new Set(initialPressedKeys);
  const pendingOneShotActions = new Set<OneShotInputAction>();

  function setKey(code: string, isPressed: boolean): void {
    const wasPressed = pressedKeys.has(code);

    if (isPressed) {
      pressedKeys.add(code);

      if (!wasPressed) {
        const action = oneShotActionForCode(code);

        if (action) {
          pendingOneShotActions.add(action);
        }
      }

      return;
    }

    pressedKeys.delete(code);
  }

  function clearOneShotActions(
    actions: readonly OneShotInputAction[] = ONE_SHOT_INPUT_ACTIONS,
  ): void {
    for (const action of actions) {
      pendingOneShotActions.delete(action);
    }
  }

  return {
    setKey,
    keyDown(event) {
      setKey(eventCode(event), true);
    },
    keyUp(event) {
      setKey(eventCode(event), false);
    },
    getCommand() {
      const command = commandFromKeyboardState(pressedKeys);

      if (pendingOneShotActions.has("camera")) {
        command.camera = "cycle";
      }

      if (pendingOneShotActions.has("reset")) {
        command.reset = true;
      }

      if (pendingOneShotActions.has("pause")) {
        command.pause = true;
      }

      return command;
    },
    getKeyState() {
      return new Set(pressedKeys);
    },
    consumeOneShotActions: clearOneShotActions,
    clearOneShotActions,
    clear() {
      pressedKeys.clear();
      pendingOneShotActions.clear();
    },
  };
}

export function normalizeVirtualStickAxis(
  value: number,
  options: VirtualStickOptions = DEFAULT_VIRTUAL_STICK_OPTIONS,
): number {
  const clampedValue = clampUnit(value);
  const deadZone = clamp(
    Math.abs(options.deadZone ?? DEFAULT_VIRTUAL_STICK_OPTIONS.deadZone),
    0,
    0.99,
  );
  const magnitude = Math.abs(clampedValue);

  if (magnitude <= deadZone) {
    return 0;
  }

  const normalizedMagnitude = (magnitude - deadZone) / (1 - deadZone);
  const expo = clamp(options.expo ?? DEFAULT_VIRTUAL_STICK_OPTIONS.expo, 0, 1);
  const shapedMagnitude =
    normalizedMagnitude * (1 - expo) +
    normalizedMagnitude * normalizedMagnitude * normalizedMagnitude * expo;

  return clampUnit(Math.sign(clampedValue) * shapedMagnitude);
}

export function normalizeVirtualStick(
  stick: VirtualStickVector = neutralStick,
  options: VirtualStickOptions = DEFAULT_VIRTUAL_STICK_OPTIONS,
): VirtualStickVector {
  return {
    x: normalizeVirtualStickAxis(stick.x, options),
    y: normalizeVirtualStickAxis(stick.y, options),
  };
}

export function commandFromVirtualSticks(
  sticks: VirtualStickCommandInput,
  options: VirtualStickOptions = DEFAULT_VIRTUAL_STICK_OPTIONS,
): InputCommand {
  const left = normalizeVirtualStick(sticks.left ?? neutralStick, options);
  const right = normalizeVirtualStick(sticks.right ?? neutralStick, options);

  // Stick vectors use x-right/y-up. Left-stick left matches KeyA yaw.
  return {
    ...createNeutralInputCommand(),
    throttle: left.y,
    yaw: -left.x,
    pitch: right.y,
    roll: -right.x,
  };
}

export function mergeInputCommands(
  ...commands: readonly InputCommand[]
): InputCommand {
  return commands.reduce<InputCommand>(
    (merged, command) => ({
      throttle: clampUnit(merged.throttle + command.throttle),
      yaw: clampUnit(merged.yaw + command.yaw),
      pitch: clampUnit(merged.pitch + command.pitch),
      roll: clampUnit(merged.roll + command.roll),
      brake: merged.brake || command.brake,
      reset: merged.reset || command.reset,
      camera: command.camera === "none" ? merged.camera : command.camera,
      pause: merged.pause || command.pause,
    }),
    createNeutralInputCommand(),
  );
}

export function clearInput(target?: ClearableInput | null): InputCommand {
  target?.clear();
  return createNeutralInputCommand();
}

export function createInputSystem() {
  const keyboard = createKeyboardInput();
  let touchCommand = createNeutralInputCommand();

  return {
    keyboard,
    setTouchSticks(
      sticks: VirtualStickCommandInput,
      options?: VirtualStickOptions,
    ) {
      touchCommand = commandFromVirtualSticks(sticks, options);
    },
    clearTouchSticks() {
      touchCommand = createNeutralInputCommand();
    },
    getCommand() {
      return mergeInputCommands(touchCommand, keyboard.getCommand());
    },
    consumeOneShotActions(actions?: readonly OneShotInputAction[]) {
      keyboard.consumeOneShotActions(actions);
    },
    clear() {
      keyboard.clear();
      touchCommand = createNeutralInputCommand();
    },
  };
}
