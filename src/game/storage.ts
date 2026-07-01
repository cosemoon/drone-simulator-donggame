import { gameThemeById } from "./themes";
import type { CameraMode, ThemeId } from "./types";

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export interface GameSettings {
  themeId: ThemeId;
  cameraMode: CameraMode;
  hoverAssistEnabled: boolean;
  touchControlsEnabled: boolean;
  reducedMotion: boolean;
}

export const STORAGE_VERSION = "v1";
export const STORAGE_NAMESPACE = `drone-time-attack:${STORAGE_VERSION}`;

export const STORAGE_KEYS = {
  nickname: `${STORAGE_NAMESPACE}:nickname`,
  settings: `${STORAGE_NAMESPACE}:settings`,
  localLeaderboard: `${STORAGE_NAMESPACE}:local-leaderboard`,
} as const;

export const DEFAULT_NICKNAME = "Pilot";

export const DEFAULT_GAME_SETTINGS: GameSettings = {
  themeId: "high-contrast",
  cameraMode: "chase",
  hoverAssistEnabled: true,
  touchControlsEnabled: true,
  reducedMotion: false,
};

const cameraModes = new Set<CameraMode>(["chase", "fpv", "orbit"]);
const nicknameMaxLength = 24;

export function createMemoryStorage(
  initialValues: Record<string, string> = {},
): StorageLike {
  const values = new Map(Object.entries(initialValues));

  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
    removeItem(key) {
      values.delete(key);
    },
  };
}

function getWindowLocalStorage(): StorageLike | null {
  if (typeof window === "undefined") {
    return null;
  }

  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

function canUseStorage(storage: StorageLike): boolean {
  const testKey = `${STORAGE_NAMESPACE}:adapter-test`;

  try {
    storage.setItem(testKey, testKey);
    const stored = storage.getItem(testKey);
    storage.removeItem(testKey);
    return stored === testKey;
  } catch {
    return false;
  }
}

export function createStorageAdapter(
  primaryStorage: StorageLike | null = getWindowLocalStorage(),
  fallbackStorage: StorageLike = createMemoryStorage(),
): StorageLike {
  let activeStorage =
    primaryStorage && canUseStorage(primaryStorage)
      ? primaryStorage
      : fallbackStorage;

  const useFallback = () => {
    activeStorage = fallbackStorage;
  };

  return {
    getItem(key) {
      try {
        return activeStorage.getItem(key);
      } catch {
        useFallback();
        return fallbackStorage.getItem(key);
      }
    },
    setItem(key, value) {
      try {
        activeStorage.setItem(key, value);
      } catch {
        useFallback();
        fallbackStorage.setItem(key, value);
      }
    },
    removeItem(key) {
      try {
        activeStorage.removeItem(key);
      } catch {
        useFallback();
        fallbackStorage.removeItem(key);
      }
    },
  };
}

export function createBrowserStorageAdapter(): StorageLike {
  return createStorageAdapter(getWindowLocalStorage());
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isThemeId(value: unknown): value is ThemeId {
  return (
    typeof value === "string" &&
    Object.prototype.hasOwnProperty.call(gameThemeById, value)
  );
}

function isCameraMode(value: unknown): value is CameraMode {
  return typeof value === "string" && cameraModes.has(value as CameraMode);
}

export function readJsonValue(
  storage: StorageLike,
  key: string,
): unknown | null {
  const stored = storage.getItem(key);

  if (stored === null) {
    return null;
  }

  try {
    return JSON.parse(stored) as unknown;
  } catch {
    return null;
  }
}

export function writeJsonValue(
  storage: StorageLike,
  key: string,
  value: unknown,
): void {
  storage.setItem(key, JSON.stringify(value));
}

export function sanitizeNickname(value: unknown): string {
  if (typeof value !== "string") {
    return DEFAULT_NICKNAME;
  }

  const trimmed = value.trim();

  if (trimmed.length === 0) {
    return DEFAULT_NICKNAME;
  }

  return trimmed.slice(0, nicknameMaxLength);
}

export function loadNickname(
  storage: StorageLike = createStorageAdapter(),
): string {
  return sanitizeNickname(storage.getItem(STORAGE_KEYS.nickname));
}

export function saveNickname(
  nickname: string,
  storage: StorageLike = createStorageAdapter(),
): void {
  storage.setItem(STORAGE_KEYS.nickname, sanitizeNickname(nickname));
}

export function sanitizeSettings(value: unknown): GameSettings {
  if (!isRecord(value)) {
    return { ...DEFAULT_GAME_SETTINGS };
  }

  return {
    themeId: isThemeId(value.themeId)
      ? value.themeId
      : DEFAULT_GAME_SETTINGS.themeId,
    cameraMode: isCameraMode(value.cameraMode)
      ? value.cameraMode
      : DEFAULT_GAME_SETTINGS.cameraMode,
    hoverAssistEnabled:
      typeof value.hoverAssistEnabled === "boolean"
        ? value.hoverAssistEnabled
        : DEFAULT_GAME_SETTINGS.hoverAssistEnabled,
    touchControlsEnabled:
      typeof value.touchControlsEnabled === "boolean"
        ? value.touchControlsEnabled
        : DEFAULT_GAME_SETTINGS.touchControlsEnabled,
    reducedMotion:
      typeof value.reducedMotion === "boolean"
        ? value.reducedMotion
        : DEFAULT_GAME_SETTINGS.reducedMotion,
  };
}

export function loadSettings(
  storage: StorageLike = createStorageAdapter(),
): GameSettings {
  return sanitizeSettings(readJsonValue(storage, STORAGE_KEYS.settings));
}

export function saveSettings(
  settings: GameSettings,
  storage: StorageLike = createStorageAdapter(),
): void {
  writeJsonValue(storage, STORAGE_KEYS.settings, sanitizeSettings(settings));
}

export interface GameStorage {
  loadNickname(): string;
  saveNickname(nickname: string): void;
  loadSettings(): GameSettings;
  saveSettings(settings: GameSettings): void;
}

export function createGameStorage(
  storage: StorageLike = createStorageAdapter(),
): GameStorage {
  return {
    loadNickname: () => loadNickname(storage),
    saveNickname: (nickname) => saveNickname(nickname, storage),
    loadSettings: () => loadSettings(storage),
    saveSettings: (settings) => saveSettings(settings, storage),
  };
}
