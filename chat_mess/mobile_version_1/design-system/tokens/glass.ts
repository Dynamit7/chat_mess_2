/**
 * 2026 Design System - Glassmorphism Tokens
 * Complete glassmorphism configuration for frosted glass effects
 */

import { ViewStyle } from 'react-native';

// Blur intensity levels
export const blurIntensity = {
  none: 0,
  subtle: 10,
  light: 25,
  medium: 50,
  strong: 75,
  heavy: 100,
};

// Glass tint modes (for expo-blur)
export type GlassTint = 'light' | 'dark' | 'default' | 'extraLight' | 'prominent' | 'systemMaterial' | 'systemThinMaterial' | 'systemUltraThinMaterial';

export const glassTints: Record<string, GlassTint> = {
  light: 'light',
  dark: 'dark',
  default: 'default',
  extraLight: 'extraLight',
  prominent: 'prominent',
  material: 'systemMaterial',
  thinMaterial: 'systemThinMaterial',
  ultraThin: 'systemUltraThinMaterial',
};

// Glass background overlays
export const glassBackgrounds = {
  light: {
    ultraLight: 'rgba(255, 255, 255, 0.1)',
    light: 'rgba(255, 255, 255, 0.2)',
    medium: 'rgba(255, 255, 255, 0.3)',
    strong: 'rgba(255, 255, 255, 0.4)',
    solid: 'rgba(255, 255, 255, 0.6)',
  },
  dark: {
    ultraLight: 'rgba(0, 0, 0, 0.1)',
    light: 'rgba(0, 0, 0, 0.2)',
    medium: 'rgba(0, 0, 0, 0.3)',
    strong: 'rgba(0, 0, 0, 0.4)',
    solid: 'rgba(0, 0, 0, 0.6)',
  },
  colored: {
    primary: 'rgba(142, 68, 173, 0.2)',
    accent: 'rgba(59, 130, 246, 0.2)',
    success: 'rgba(34, 197, 94, 0.2)',
    warning: 'rgba(245, 158, 11, 0.2)',
    error: 'rgba(239, 68, 68, 0.2)',
  },
};

// Glass border styles
export const glassBorders = {
  light: {
    subtle: 'rgba(255, 255, 255, 0.1)',
    light: 'rgba(255, 255, 255, 0.18)',
    medium: 'rgba(255, 255, 255, 0.25)',
    strong: 'rgba(255, 255, 255, 0.35)',
  },
  dark: {
    subtle: 'rgba(255, 255, 255, 0.04)',
    light: 'rgba(255, 255, 255, 0.08)',
    medium: 'rgba(255, 255, 255, 0.12)',
    strong: 'rgba(255, 255, 255, 0.18)',
  },
};

// Border radius presets for glass components
export const glassRadius = {
  none: 0,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
};

// Glass component style presets
export interface GlassStyle {
  blur: number;
  tint: GlassTint;
  backgroundColor: string;
  borderColor: string;
  borderWidth: number;
  borderRadius: number;
}

export const glassPresets: Record<string, GlassStyle> = {
  // Card presets
  cardLight: {
    blur: blurIntensity.medium,
    tint: 'light',
    backgroundColor: glassBackgrounds.light.medium,
    borderColor: glassBorders.light.light,
    borderWidth: 1,
    borderRadius: glassRadius.xl,
  },
  cardDark: {
    blur: blurIntensity.medium,
    tint: 'dark',
    backgroundColor: glassBackgrounds.dark.medium,
    borderColor: glassBorders.dark.light,
    borderWidth: 1,
    borderRadius: glassRadius.xl,
  },

  // Button presets
  buttonLight: {
    blur: blurIntensity.light,
    tint: 'light',
    backgroundColor: glassBackgrounds.light.light,
    borderColor: glassBorders.light.medium,
    borderWidth: 1,
    borderRadius: glassRadius.lg,
  },
  buttonDark: {
    blur: blurIntensity.light,
    tint: 'dark',
    backgroundColor: glassBackgrounds.dark.light,
    borderColor: glassBorders.dark.medium,
    borderWidth: 1,
    borderRadius: glassRadius.lg,
  },

  // Modal/overlay presets
  modalLight: {
    blur: blurIntensity.strong,
    tint: 'light',
    backgroundColor: glassBackgrounds.light.strong,
    borderColor: glassBorders.light.strong,
    borderWidth: 1,
    borderRadius: glassRadius['2xl'],
  },
  modalDark: {
    blur: blurIntensity.strong,
    tint: 'dark',
    backgroundColor: glassBackgrounds.dark.strong,
    borderColor: glassBorders.dark.strong,
    borderWidth: 1,
    borderRadius: glassRadius['2xl'],
  },

  // Navigation bar presets
  navLight: {
    blur: blurIntensity.heavy,
    tint: 'extraLight',
    backgroundColor: glassBackgrounds.light.solid,
    borderColor: glassBorders.light.subtle,
    borderWidth: 0.5,
    borderRadius: 0,
  },
  navDark: {
    blur: blurIntensity.heavy,
    tint: 'dark',
    backgroundColor: glassBackgrounds.dark.solid,
    borderColor: glassBorders.dark.subtle,
    borderWidth: 0.5,
    borderRadius: 0,
  },

  // Message bubble presets
  messageSent: {
    blur: blurIntensity.light,
    tint: 'default',
    backgroundColor: 'rgba(142, 68, 173, 0.85)',
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderWidth: 1,
    borderRadius: glassRadius.xl,
  },
  messageReceived: {
    blur: blurIntensity.light,
    tint: 'light',
    backgroundColor: glassBackgrounds.light.strong,
    borderColor: glassBorders.light.light,
    borderWidth: 1,
    borderRadius: glassRadius.xl,
  },
  messageReceivedDark: {
    blur: blurIntensity.light,
    tint: 'dark',
    backgroundColor: glassBackgrounds.dark.strong,
    borderColor: glassBorders.dark.light,
    borderWidth: 1,
    borderRadius: glassRadius.xl,
  },

  // Input field presets
  inputLight: {
    blur: blurIntensity.subtle,
    tint: 'light',
    backgroundColor: glassBackgrounds.light.ultraLight,
    borderColor: glassBorders.light.medium,
    borderWidth: 1,
    borderRadius: glassRadius.lg,
  },
  inputDark: {
    blur: blurIntensity.subtle,
    tint: 'dark',
    backgroundColor: glassBackgrounds.dark.ultraLight,
    borderColor: glassBorders.dark.medium,
    borderWidth: 1,
    borderRadius: glassRadius.lg,
  },

  // Tooltip/popover presets
  tooltipLight: {
    blur: blurIntensity.medium,
    tint: 'light',
    backgroundColor: glassBackgrounds.light.solid,
    borderColor: glassBorders.light.light,
    borderWidth: 1,
    borderRadius: glassRadius.md,
  },
  tooltipDark: {
    blur: blurIntensity.medium,
    tint: 'dark',
    backgroundColor: glassBackgrounds.dark.solid,
    borderColor: glassBorders.dark.light,
    borderWidth: 1,
    borderRadius: glassRadius.md,
  },
};

// Animation configurations for glass effects
export const glassAnimations = {
  fadeIn: {
    duration: 200,
    easing: 'ease-out',
  },
  blur: {
    duration: 300,
    easing: 'ease-in-out',
  },
  scale: {
    duration: 150,
    spring: {
      damping: 15,
      stiffness: 300,
    },
  },
};

// Helper function to create custom glass styles
export const createGlassStyle = (
  theme: 'light' | 'dark',
  options: Partial<GlassStyle> = {}
): GlassStyle => {
  const basePreset = theme === 'light' ? glassPresets.cardLight : glassPresets.cardDark;

  return {
    ...basePreset,
    ...options,
  };
};

// Export combined glass system
export const glass = {
  blur: blurIntensity,
  tints: glassTints,
  backgrounds: glassBackgrounds,
  borders: glassBorders,
  radius: glassRadius,
  presets: glassPresets,
  animations: glassAnimations,
  createStyle: createGlassStyle,
};

export default glass;
