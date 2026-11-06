export const colors = {
  background: "#041127",
  backgroundRaised: "#071a35",
  surface: "#0b2345",
  surfaceMuted: "#102b50",
  border: "rgba(126, 229, 255, 0.22)",
  text: "#f4f8ff",
  textMuted: "#aabbd3",
  cyan: "#64e6ff",
  cyanStrong: "#00c8ff",
  violet: "#8d6cff",
  magenta: "#ff4bd8",
  green: "#62f2b3",
  amber: "#ffd36a",
  red: "#ff728b",
  black: "#000000",
  overlay: "rgba(0, 0, 0, 0.45)",
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
} as const;

export const radius = {
  sm: 10,
  md: 16,
  lg: 22,
  pill: 999,
} as const;

export const typography = {
  title: 28,
  heading: 20,
  body: 16,
  small: 13,
  micro: 11,
} as const;
