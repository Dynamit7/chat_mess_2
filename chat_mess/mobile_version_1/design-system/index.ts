/**
 * 2026 Design System - Main Export
 * Comprehensive design system for the chat super-app
 */

// Token exports
export * from './tokens/colors';
export * from './tokens/typography';
export * from './tokens/shadows';
export * from './tokens/glass';

// Theme exports
export { lightTheme, type LightTheme } from './themes/lightTheme';
export { darkTheme, type DarkTheme } from './themes/darkTheme';
export { oledTheme, type OledTheme } from './themes/oledTheme';

// Import themes for combined export
import { lightTheme } from './themes/lightTheme';
import { darkTheme } from './themes/darkTheme';
import { oledTheme } from './themes/oledTheme';

// Theme type union
export type ThemeMode = 'light' | 'dark' | 'oled' | 'system';
export type Theme = typeof lightTheme | typeof darkTheme | typeof oledTheme;

// Theme mapping
export const themes = {
  light: lightTheme,
  dark: darkTheme,
  oled: oledTheme,
} as const;

// Helper to get theme by mode
export const getTheme = (mode: Exclude<ThemeMode, 'system'>): Theme => {
  return themes[mode];
};

// Spacing scale (based on 4px grid)
export const spacing = {
  0: 0,
  0.5: 2,
  1: 4,
  1.5: 6,
  2: 8,
  2.5: 10,
  3: 12,
  3.5: 14,
  4: 16,
  5: 20,
  6: 24,
  7: 28,
  8: 32,
  9: 36,
  10: 40,
  11: 44,
  12: 48,
  14: 56,
  16: 64,
  20: 80,
  24: 96,
  28: 112,
  32: 128,
  36: 144,
  40: 160,
  44: 176,
  48: 192,
  52: 208,
  56: 224,
  60: 240,
  64: 256,
  72: 288,
  80: 320,
  96: 384,
} as const;

// Border radius scale
export const borderRadius = {
  none: 0,
  sm: 4,
  md: 8,
  lg: 12,
  xl: 16,
  '2xl': 20,
  '3xl': 24,
  '4xl': 32,
  full: 9999,
} as const;

// Z-index scale
export const zIndex = {
  hide: -1,
  base: 0,
  dropdown: 1000,
  sticky: 1020,
  fixed: 1030,
  backdrop: 1040,
  modal: 1050,
  popover: 1060,
  tooltip: 1070,
  toast: 1080,
  overlay: 1090,
  max: 9999,
} as const;

// Animation timing
export const timing = {
  instant: 0,
  fast: 150,
  normal: 300,
  slow: 450,
  slower: 600,
  slowest: 1000,
} as const;

// Easing functions
export const easing = {
  linear: [0, 0, 1, 1] as const,
  easeIn: [0.4, 0, 1, 1] as const,
  easeOut: [0, 0, 0.2, 1] as const,
  easeInOut: [0.4, 0, 0.2, 1] as const,
  spring: [0.68, -0.55, 0.265, 1.55] as const,
  bounce: [0.68, -0.6, 0.32, 1.6] as const,
} as const;

// Breakpoints (for responsive design)
export const breakpoints = {
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  '2xl': 1536,
} as const;

// Design system configuration
export const designSystem = {
  themes,
  getTheme,
  spacing,
  borderRadius,
  zIndex,
  timing,
  easing,
  breakpoints,
};

export default designSystem;
