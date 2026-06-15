/**
 * 2026 Design System - Shadow Tokens
 * Comprehensive elevation system with depth effects and glow variants
 */

import { ViewStyle } from 'react-native';

// Base shadow colors
export const shadowColors = {
  light: '#000000',
  dark: '#000000',
  primary: '#8E44AD',
  accent: '#3B82F6',
  success: '#22C55E',
  error: '#EF4444',
};

// Elevation levels (Material Design inspired but enhanced)
export interface ShadowStyle {
  shadowColor: string;
  shadowOffset: { width: number; height: number };
  shadowOpacity: number;
  shadowRadius: number;
  elevation: number;
}

export const elevations: Record<string, ShadowStyle> = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  // Subtle elevation (cards, list items)
  sm: {
    shadowColor: shadowColors.light,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  // Light elevation (buttons, chips)
  md: {
    shadowColor: shadowColors.light,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  // Medium elevation (dropdowns, menus)
  lg: {
    shadowColor: shadowColors.light,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 4,
  },

  // High elevation (modals, dialogs)
  xl: {
    shadowColor: shadowColors.light,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.16,
    shadowRadius: 16,
    elevation: 8,
  },

  // Maximum elevation (popovers, tooltips)
  '2xl': {
    shadowColor: shadowColors.light,
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.20,
    shadowRadius: 24,
    elevation: 12,
  },

  // Extreme elevation (floating action buttons)
  '3xl': {
    shadowColor: shadowColors.light,
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.24,
    shadowRadius: 32,
    elevation: 16,
  },
};

// Glass shadows (softer, more diffused)
export const glassShadows: Record<string, ShadowStyle> = {
  light: {
    shadowColor: shadowColors.light,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.08,
    shadowRadius: 32,
    elevation: 4,
  },
  dark: {
    shadowColor: shadowColors.light,
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 32,
    elevation: 8,
  },
};

// Glow effects (colored shadows)
export const createGlow = (color: string, intensity: 'subtle' | 'medium' | 'strong' = 'medium'): ShadowStyle => {
  const intensityMap = {
    subtle: { opacity: 0.15, radius: 8, offset: 2 },
    medium: { opacity: 0.25, radius: 16, offset: 4 },
    strong: { opacity: 0.40, radius: 24, offset: 6 },
  };

  const config = intensityMap[intensity];

  return {
    shadowColor: color,
    shadowOffset: { width: 0, height: config.offset },
    shadowOpacity: config.opacity,
    shadowRadius: config.radius,
    elevation: 6,
  };
};

// Pre-defined glow presets
export const glowPresets = {
  primary: createGlow(shadowColors.primary, 'medium'),
  primarySubtle: createGlow(shadowColors.primary, 'subtle'),
  primaryStrong: createGlow(shadowColors.primary, 'strong'),
  accent: createGlow(shadowColors.accent, 'medium'),
  success: createGlow(shadowColors.success, 'medium'),
  error: createGlow(shadowColors.error, 'medium'),
};

// Inner shadows (for pressed states)
export const innerShadows = {
  subtle: {
    // Note: React Native doesn't natively support inner shadows
    // This is a workaround using negative elevation
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
  },
  medium: {
    backgroundColor: 'rgba(0, 0, 0, 0.10)',
  },
  strong: {
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
  },
};

// 3D depth shadows (for cards with depth)
export const depthShadows = {
  raised: {
    ...elevations.lg,
    transform: [{ translateY: -2 }],
  },
  floating: {
    ...elevations.xl,
    transform: [{ translateY: -4 }],
  },
  lifted: {
    ...elevations['2xl'],
    transform: [{ translateY: -8 }],
  },
};

// Message bubble shadows
export const messageShadows = {
  sent: {
    shadowColor: shadowColors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 2,
  },
  received: {
    shadowColor: shadowColors.light,
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 1,
  },
};

// Export combined shadow system
export const shadows = {
  colors: shadowColors,
  elevations,
  glass: glassShadows,
  createGlow,
  glowPresets,
  innerShadows,
  depth: depthShadows,
  message: messageShadows,
};

export default shadows;
