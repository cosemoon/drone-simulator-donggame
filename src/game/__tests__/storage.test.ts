import { describe, expect, it } from "vitest";
import {
  DEFAULT_GAME_SETTINGS,
  DEFAULT_NICKNAME,
  STORAGE_KEYS,
  createGameStorage,
  createMemoryStorage,
  createStorageAdapter,
} from "../storage";
import type { StorageLike } from "../storage";

class ThrowingStorage implements StorageLike {
  getItem(): string | null {
    throw new Error("storage unavailable");
  }

  setItem(): void {
    throw new Error("storage unavailable");
  }

  removeItem(): void {
    throw new Error("storage unavailable");
  }
}

describe("storage keys", () => {
  it("uses a v1 namespace for nickname, settings, and local leaderboard", () => {
    expect(STORAGE_KEYS.nickname).toBe("drone-time-attack:v1:nickname");
    expect(STORAGE_KEYS.settings).toBe("drone-time-attack:v1:settings");
    expect(STORAGE_KEYS.playerProfile).toBe(
      "drone-time-attack:v1:player-profile",
    );
    expect(STORAGE_KEYS.localLeaderboard).toBe(
      "drone-time-attack:v1:local-leaderboard",
    );
  });
});

describe("createStorageAdapter", () => {
  it("falls back to memory storage when the provided storage throws", () => {
    const storage = createStorageAdapter(new ThrowingStorage());

    storage.setItem("pilot", "Ace");

    expect(storage.getItem("pilot")).toBe("Ace");
  });
});

describe("createGameStorage", () => {
  it("returns default settings when storage is empty", () => {
    const gameStorage = createGameStorage(createMemoryStorage());

    expect(gameStorage.loadSettings()).toEqual(DEFAULT_GAME_SETTINGS);
  });

  it("falls back to default settings when stored JSON is corrupted", () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.settings]: "{not-json",
    });
    const gameStorage = createGameStorage(storage);

    expect(gameStorage.loadSettings()).toEqual(DEFAULT_GAME_SETTINGS);
  });

  it("sanitizes invalid settings fields while keeping valid fields", () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.settings]: JSON.stringify({
        themeId: "neon-night",
        cameraMode: "side",
        touchControlsEnabled: "yes",
        hoverAssistEnabled: false,
        maxSpeedMetersPerSecond: 10,
        reducedMotion: true,
      }),
    });
    const gameStorage = createGameStorage(storage);

    expect(gameStorage.loadSettings()).toEqual({
      ...DEFAULT_GAME_SETTINGS,
      themeId: "neon-night",
      hoverAssistEnabled: false,
      maxSpeedMetersPerSecond: 10,
      reducedMotion: true,
    });
  });

  it("persists a sanitized player profile for online score submission", () => {
    const storage = createMemoryStorage();
    const gameStorage = createGameStorage(storage);

    gameStorage.savePlayerProfile({
      school: "  하늘초  ",
      grade: "5학년",
      classNumber: "2반",
      studentNumber: "14번",
      nickname: "  민준  ",
    });

    expect(gameStorage.loadPlayerProfile()).toEqual({
      school: "하늘초",
      grade: "5",
      classNumber: "2",
      studentNumber: "14",
      nickname: "민준",
    });
  });

  it("rejects inherited object keys as theme ids", () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.settings]: JSON.stringify({
        themeId: "toString",
        cameraMode: "chase",
        touchControlsEnabled: true,
        reducedMotion: false,
      }),
    });
    const gameStorage = createGameStorage(storage);

    expect(gameStorage.loadSettings().themeId).toBe(
      DEFAULT_GAME_SETTINGS.themeId,
    );
  });

  it("persists nickname separately from settings", () => {
    const storage = createMemoryStorage();
    const gameStorage = createGameStorage(storage);

    gameStorage.saveNickname("  Ace Pilot  ");

    expect(gameStorage.loadNickname()).toBe("Ace Pilot");
    expect(storage.getItem(STORAGE_KEYS.nickname)).toBe("Ace Pilot");
    expect(gameStorage.loadSettings()).toEqual(DEFAULT_GAME_SETTINGS);
  });

  it("returns the default nickname when the stored nickname is blank", () => {
    const storage = createMemoryStorage({
      [STORAGE_KEYS.nickname]: "   ",
    });
    const gameStorage = createGameStorage(storage);

    expect(gameStorage.loadNickname()).toBe(DEFAULT_NICKNAME);
  });
});
