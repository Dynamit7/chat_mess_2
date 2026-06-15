/**
 * 2026 Design System - Light Theme
 * Complete light theme configuration
 */

import { colors, neutralPalette, primaryPalette, semanticColors, statusColors } from '../tokens/colors';
import { glassPresets, glassBackgrounds, glassBorders } from '../tokens/glass';
import { elevations, messageShadows } from '../tokens/shadows';

export const lightTheme = {
  name: 'light',
  isDark: false,
  isOled: false,

  // Core colors
  colors: {
    // Backgrounds
    background: {
      primary: neutralPalette[0],
      secondary: neutralPalette[50],
      tertiary: neutralPalette[100],
      elevated: neutralPalette[0],
      inverse: neutralPalette[900],
    },

    // Surfaces
    surface: {
      primary: neutralPalette[0],
      secondary: neutralPalette[50],
      tertiary: neutralPalette[100],
      overlay: 'rgba(0, 0, 0, 0.5)',
    },

    // Text
    text: {
      primary: neutralPalette[900],
      secondary: neutralPalette[600],
      tertiary: neutralPalette[500],
      disabled: neutralPalette[400],
      inverse: neutralPalette[0],
      link: primaryPalette[600],
    },

    // Brand
    brand: {
      primary: primaryPalette[500],
      primaryHover: primaryPalette[600],
      primaryActive: primaryPalette[700],
      secondary: primaryPalette[100],
    },

    // Semantic
    semantic: {
      success: semanticColors.success.main,
      successBackground: semanticColors.success.light,
      warning: semanticColors.warning.main,
      warningBackground: semanticColors.warning.light,
      error: semanticColors.error.main,
      errorBackground: semanticColors.error.light,
      info: semanticColors.info.main,
      infoBackground: semanticColors.info.light,
    },

    // Status
    status: statusColors,

    // Borders
    border: {
      primary: neutralPalette[200],
      secondary: neutralPalette[100],
      focus: primaryPalette[500],
      error: semanticColors.error.main,
    },

    // Input
    input: {
      background: neutralPalette[50],
      backgroundFocused: neutralPalette[0],
      border: neutralPalette[300],
      borderFocused: primaryPalette[500],
      placeholder: neutralPalette[400],
    },

    // Chat specific
    chat: {
      messageSent: primaryPalette[500],
      messageReceived: neutralPalette[100],
      messageSentText: neutralPalette[0],
      messageReceivedText: neutralPalette[900],
      timestamp: neutralPalette[500],
      replyLine: primaryPalette[300],
      reaction: neutralPalette[100],
      typing: primaryPalette[100],
    },

    // Icons
    icon: {
      primary: neutralPalette[700],
      secondary: neutralPalette[500],
      tertiary: neutralPalette[400],
      inverse: neutralPalette[0],
      brand: primaryPalette[500],
    },
  },

  // Glass effects
  glass: {
    card: glassPresets.cardLight,
    button: glassPresets.buttonLight,
    modal: glassPresets.modalLight,
    nav: glassPresets.navLight,
    input: glassPresets.inputLight,
    tooltip: glassPresets.tooltipLight,
    messageSent: glassPresets.messageSent,
    messageReceived: glassPresets.messageReceived,
    backgrounds: glassBackgrounds.light,
    borders: glassBorders.light,
  },

  // Shadows
  shadows: {
    ...elevations,
    message: messageShadows,
  },

  // Component specific
  components: {
    // Header
    header: {
      background: neutralPalette[0],
      border: neutralPalette[200],
      title: neutralPalette[900],
      icon: neutralPalette[700],
    },

    // Tab bar
    tabBar: {
      background: neutralPalette[0],
      border: neutralPalette[200],
      active: primaryPalette[500],
      inactive: neutralPalette[400],
      indicator: primaryPalette[500],
    },

    // Cards
    card: {
      background: neutralPalette[0],
      border: neutralPalette[100],
      shadow: elevations.md,
    },

    // Buttons
    button: {
      primary: {
        background: primaryPalette[500],
        text: neutralPalette[0],
        border: 'transparent',
      },
      secondary: {
        background: primaryPalette[100],
        text: primaryPalette[700],
        border: 'transparent',
      },
      outline: {
        background: 'transparent',
        text: primaryPalette[500],
        border: primaryPalette[500],
      },
      ghost: {
        background: 'transparent',
        text: primaryPalette[500],
        border: 'transparent',
      },
      danger: {
        background: semanticColors.error.main,
        text: neutralPalette[0],
        border: 'transparent',
      },
    },

    // Avatar
    avatar: {
      background: primaryPalette[100],
      text: primaryPalette[700],
      border: neutralPalette[0],
      online: statusColors.online,
    },

    // Badge
    badge: {
      background: semanticColors.error.main,
      text: neutralPalette[0],
    },

    // Divider
    divider: {
      color: neutralPalette[200],
    },

    // Skeleton
    skeleton: {
      background: neutralPalette[200],
      shimmer: neutralPalette[100],
    },
  },
};

export type LightTheme = typeof lightTheme;
export default lightTheme;
