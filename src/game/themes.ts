import type { GameTheme } from "./types";

export const gameThemes = [
  {
    id: "clean-sim",
    label: "A. 클린 시뮬레이션",
    colors: {
      scene: {
        background: "#e9f1f4",
        ambientLight: "#f7fbff",
        keyLight: "#ffffff",
        accentLight: "#f6c45c",
      },
      sky: {
        top: "#b8d8e8",
        horizon: "#edf6f4",
        fog: "#d5e3e5",
        fogNear: 38,
        fogFar: 96,
      },
      ground: {
        base: "#d9ded2",
        gridMajor: "#7f9084",
        gridMinor: "#b5c0b2",
        startPad: "#f7f9f2",
        finishPad: "#dff3cf",
      },
      gate: {
        frame: "#263238",
        active: "#ff8f2f",
        cleared: "#3f8f5f",
        missed: "#bd3e3e",
        accent: "#256d85",
      },
      hud: {
        foreground: "#142126",
        muted: "#5a6a6f",
        panel: "#f8fbfa",
        panelBorder: "#b9c7c9",
        accent: "#0f7c8f",
        warning: "#b96d00",
        danger: "#b43333",
        positive: "#257a4d",
      },
    },
  },
  {
    id: "neon-night",
    label: "B. 네온 나이트",
    colors: {
      scene: {
        background: "#100d18",
        ambientLight: "#27313f",
        keyLight: "#f2f0ff",
        accentLight: "#ff7b54",
      },
      sky: {
        top: "#15112a",
        horizon: "#2b1f32",
        fog: "#251a2d",
        fogNear: 26,
        fogFar: 78,
      },
      ground: {
        base: "#15191d",
        gridMajor: "#4ecdc4",
        gridMinor: "#4d5964",
        startPad: "#1d3936",
        finishPad: "#4b2a20",
      },
      gate: {
        frame: "#e6f7ff",
        active: "#ff9f1c",
        cleared: "#2ec4b6",
        missed: "#ff4d6d",
        accent: "#ffe66d",
      },
      hud: {
        foreground: "#fff8e8",
        muted: "#a9a4b8",
        panel: "#191724",
        panelBorder: "#4ecdc4",
        accent: "#ff9f1c",
        warning: "#ffe66d",
        danger: "#ff4d6d",
        positive: "#2ec4b6",
      },
    },
  },
  {
    id: "high-contrast",
    label: "C. 하이 콘트라스트",
    colors: {
      scene: {
        background: "#f5f2e8",
        ambientLight: "#fffaf0",
        keyLight: "#ffffff",
        accentLight: "#ffcc00",
      },
      sky: {
        top: "#f7d46b",
        horizon: "#f5f2e8",
        fog: "#e8dfc7",
        fogNear: 42,
        fogFar: 110,
      },
      ground: {
        base: "#101113",
        gridMajor: "#ffcc00",
        gridMinor: "#6f756f",
        startPad: "#f2f2f2",
        finishPad: "#ffcc00",
      },
      gate: {
        frame: "#050505",
        active: "#ffcc00",
        cleared: "#00a36c",
        missed: "#d62246",
        accent: "#ffffff",
      },
      hud: {
        foreground: "#ffffff",
        muted: "#d8d8d8",
        panel: "#050505",
        panelBorder: "#ffcc00",
        accent: "#ffcc00",
        warning: "#ff9f1c",
        danger: "#ff3b30",
        positive: "#00d084",
      },
    },
  },
] as const satisfies readonly GameTheme[];

export const gameThemeById = Object.fromEntries(
  gameThemes.map((theme) => [theme.id, theme]),
) as Record<(typeof gameThemes)[number]["id"], (typeof gameThemes)[number]>;
