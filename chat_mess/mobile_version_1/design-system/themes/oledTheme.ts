/**
 * 2026 Design System - OLED Black Theme
 * Ultra-dark theme optimized for OLED displays with pure blacks
 */

import { colors, neutralPalette, primaryPalette, semanticColors, statusColors } from '../tokens/colors';
import { glassPresets, glassBackgrounds, glassBorders, blurIntensity } from '../tokens/glass';
import { elevations, messageShadows } from '../tokens/shadows';

// OLED-specific pure black colors
const oledBlack = '#000000';
const oledNearBlack = '#0A0A0A';
const oledDarkGray = '#121212';
const oledMidGray = '#1A1A1A';

export const oledTheme = {
  name: 'oled',
  isDark: true,
  isOled: true,

  // Core colors
  colors: {
    // Backgrounds - Pure blacks for OLED power savings
    background: {
      primary: oledBlack,
      secondary: oledNearBlack,
      tertiary: oledDarkGray,
      elevated: oledMidGray,
      inverse: neutralPalette[0],
    },

    // Surfaces
    surface: {
      primary: oledNearBlack,
      secondary: oledDarkGray,
      tertiary: oledMidGray,
      overlay: 'rgba(0, 0, 0, 0.85)',
    },

    // Text - High contrast for readability
    text: {
      primary: neutralPalette[0],
      secondary: neutralPalette[300],
      tertiary: neutralPalette[400],
      disabled: neutralPalette[600],
      inverse: oledBlack,
      link: primaryPalette[300],
    },

    // Brand - Slightly brighter for OLED contrast
    brand: {
      primary: primaryPalette[400],
      primaryHover: primaryPalette[300],
      primaryActive: primaryPalette[500],
      secondary: 'rgba(142, 68, 173, 0.15)',
    },

    // Semantic
    semantic: {
      success: semanticColors.success.main,
      successBackground: 'rgba(34, 197, 94, 0.12)',
      warning: semanticColors.warning.main,
      warningBackground: 'rgba(245, 158, 11, 0.12)',
      error: semanticColors.error.main,
      errorBackground: 'rgba(239, 68, 68, 0.12)',
      info: semanticColors.info.main,
      infoBackground: 'rgba(59, 130, 246, 0.12)',
    },

    // Status
    status: statusColors,

    // Borders - Very subtle for OLED
    border: {
      primary: 'rgba(255, 255, 255, 0.08)',
      secondary: 'rgba(255, 255, 255, 0.04)',
      focus: primaryPalette[400],
      error: semanticColors.error.main,
    },

    // Input
    input: {
      background: oledNearBlack,
      backgroundFocused: oledDarkGray,
      border: 'rgba(255, 255, 255, 0.1)',
      borderFocused: primaryPalette[400],
      placeholder: neutralPalette[500],
    },

    // Chat specific
    chat: {
      messageSent: primaryPalette[700],
      messageReceived: oledMidGray,
      messageSentText: neutralPalette[0],
      messageReceivedText: neutralPalette[100],
      timestamp: neutralPalette[500],
      replyLine: primaryPalette[700],
      reaction: oledDarkGray,
      typing: 'rgba(142, 68, 173, 0.1)',
    },

    // Icons
    icon: {
      primary: neutralPalette[100],
      secondary: neutralPalette[400],
      tertiary: neutralPalette[500],
      inverse: oledBlack,
      brand: primaryPalette[400],
    },
  },

  // Glass effects - Adjusted for OLED
  glass: {
    card: {
      blur: blurIntensity.strong,
      tint: 'dark' as const,
      backgroundColor: 'rgba(0, 0, 0, 0.6)',
      borderColor: 'rgba(255, 255, 255, 0.06)',
      borderWidth: 1,
      borderRadius: 24,
    },
    button: {
      blur: blurIntensity.medium,
      tint: 'dark' as const,
      backgroundColor: 'rgba(0, 0, 0, 0.5)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderWidth: 1,
      borderRadius: 16,
    },
    modal: {
      blur: blurIntensity.heavy,
      tint: 'dark' as const,
      backgroundColor: 'rgba(0, 0, 0, 0.75)',
      borderColor: 'rgba(255, 255, 255, 0.06)',
      borderWidth: 1,
      borderRadius: 24,
    },
    nav: {
      blur: blurIntensity.heavy,
      tint: 'dark' as const,
      backgroundColor: 'rgba(0, 0, 0, 0.85)',
      borderColor: 'rgba(255, 255, 255, 0.04)',
      borderWidth: 0.5,
      borderRadius: 0,
    },
    input: {
      blur: blurIntensity.subtle,
      tint: 'dark' as const,
      backgroundColor: 'rgba(0, 0, 0, 0.4)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      borderRadius: 16,
    },
    tooltip: {
      blur: blurIntensity.medium,
      tint: 'dark' as const,
      backgroundColor: 'rgba(0, 0, 0, 0.8)',
      borderColor: 'rgba(255, 255, 255, 0.08)',
      borderWidth: 1,
      borderRadius: 12,
    },
    messageSent: {
      blur: blurIntensity.light,
      tint: 'default' as const,
      backgroundColor: 'rgba(109, 40, 217, 0.85)',
      borderColor: 'rgba(255, 255, 255, 0.1)',
      borderWidth: 1,
      borderRadius: 20,
    },
    messageReceived: {
      blur: blurIntensity.light,
      tint: 'dark' as const,
      backgroundColor: 'rgba(26, 26, 26, 0.9)',
      borderColor: 'rgba(255, 255, 255, 0.06)',
      borderWidth: 1,
      borderRadius: 20,
    },
    backgrounds: {
      ultraLight: 'rgba(255, 255, 255, 0.02)',
      light: 'rgba(255, 255, 255, 0.04)',
      medium: 'rgba(255, 255, 255, 0.06)',
      strong: 'rgba(255, 255, 255, 0.08)',
      solid: 'rgba(0, 0, 0, 0.9)',
    },
    borders: {
      subtle: 'rgba(255, 255, 255, 0.02)',
      light: 'rgba(255, 255, 255, 0.04)',
      medium: 'rgba(255, 255, 255, 0.06)',
      strong: 'rgba(255, 255, 255, 0.1)',
    },
  },

  // Shadows - Minimal for OLED (use glows instead)
  shadows: {
    none: elevations.none,
    sm: { ...elevations.sm, shadowOpacity: 0 },
    md: { ...elevations.md, shadowOpacity: 0 },
    lg: { ...elevations.lg, shadowOpacity: 0.1 },
    xl: { ...elevations.xl, shadowOpacity: 0.15 },
    '2xl': { ...elevations['2xl'], shadowOpacity: 0.2 },
    '3xl': { ...elevations['3xl'], shadowOpacity: 0.25 },
    message: {
      sent: {
        shadowColor: primaryPalette[500],
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 2,
      },
      received: { ...messageShadows.received, shadowOpacity: 0 },
    },
  },

  // Component specific
  components: {
    // Header
    header: {
      background: oledBlack,
      border: 'rgba(255, 255, 255, 0.06)',
      title: neutralPalette[0],
      icon: neutralPalette[100],
    },

    // Tab bar
    tabBar: {
      background: oledBlack,
      border: 'rgba(255, 255, 255, 0.06)',
      active: primaryPalette[400],
      inactive: neutralPalette[500],
      indicator: primaryPalette[400],
    },

    // Cards
    card: {
      background: oledNearBlack,
      border: 'rgba(255, 255, 255, 0.04)',
      shadow: elevations.none,
    },

    // Buttons
    button: {
      primary: {
        background: primaryPalette[600],
        text: neutralPalette[0],
        border: 'transparent',
      },
      secondary: {
        background: 'rgba(142, 68, 173, 0.15)',
        text: primaryPalette[300],
        border: 'transparent',
      },
      outline: {
        background: 'transparent',
        text: primaryPalette[400],
        border: primaryPalette[500],
      },
      ghost: {
        background: 'transparent',
        text: primaryPalette[400],
        border: 'transparent',
      },
      danger: {
        background: semanticColors.error.dark,
        text: neutralPalette[0],
        border: 'transparent',
      },
    },

    // Avatar
    avatar: {
      background: 'rgba(142, 68, 173, 0.2)',
      text: primaryPalette[200],
      border: 'rgba(255, 255, 255, 0.06)',
      online: statusColors.online,
    },

    // Badge
    badge: {
      background: semanticColors.error.main,
      text: neutralPalette[0],
    },

    // Divider
    divider: {
      color: 'rgba(255, 255, 255, 0.06)',
    },

    // Skeleton
    skeleton: {
      background: oledDarkGray,
      shimmer: oledMidGray,
    },
  },
};

export type OledTheme = typeof oledTheme;
export default oledTheme;
