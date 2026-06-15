/**
 * 2026 Design System - Dark Theme
 * Complete dark theme configuration
 */

import { colors, neutralPalette, primaryPalette, accentPalette, semanticColors, statusColors } from '../tokens/colors';
import { glassPresets, glassBackgrounds, glassBorders } from '../tokens/glass';
import { elevations, messageShadows } from '../tokens/shadows';

// Premium Futuristic dark surfaces
const bg = {
  base: '#0B0F19',
  raised: '#0E1320',
  card: '#121826',
  elevated: '#1A2233',
  hover: '#222B3D',
};
const txt = {
  primary: '#F5F7FA',
  secondary: '#94A3B8',
  tertiary: '#64748B',
  disabled: '#475569',
};
const line = {
  subtle: 'rgba(255, 255, 255, 0.06)',
  primary: 'rgba(255, 255, 255, 0.08)',
  strong: 'rgba(255, 255, 255, 0.14)',
};

export const darkTheme = {
  name: 'dark',
  isDark: true,
  isOled: false,

  // Core colors
  colors: {
    // Backgrounds
    background: {
      primary: bg.base,
      secondary: bg.raised,
      tertiary: bg.card,
      elevated: bg.elevated,
      inverse: neutralPalette[0],
    },

    // Surfaces
    surface: {
      primary: bg.card,
      secondary: bg.elevated,
      tertiary: bg.hover,
      overlay: 'rgba(5, 8, 16, 0.72)',
    },

    // Text
    text: {
      primary: txt.primary,
      secondary: txt.secondary,
      tertiary: txt.tertiary,
      disabled: txt.disabled,
      inverse: bg.base,
      link: accentPalette[400],
    },

    // Brand
    brand: {
      primary: primaryPalette[500],
      primaryHover: primaryPalette[400],
      primaryActive: primaryPalette[600],
      secondary: 'rgba(124, 92, 255, 0.16)',
      accent: accentPalette[500],
    },

    // Semantic
    semantic: {
      success: semanticColors.success.main,
      successBackground: 'rgba(34, 197, 94, 0.15)',
      warning: semanticColors.warning.main,
      warningBackground: 'rgba(245, 158, 11, 0.15)',
      error: semanticColors.error.main,
      errorBackground: 'rgba(239, 68, 68, 0.15)',
      info: accentPalette[500],
      infoBackground: 'rgba(0, 194, 255, 0.15)',
    },

    // Status
    status: statusColors,

    // Borders
    border: {
      primary: line.primary,
      secondary: line.subtle,
      focus: primaryPalette[500],
      error: semanticColors.error.main,
    },

    // Input
    input: {
      background: bg.card,
      backgroundFocused: bg.elevated,
      border: line.primary,
      borderFocused: primaryPalette[500],
      placeholder: txt.tertiary,
    },

    // Chat specific
    chat: {
      messageSent: primaryPalette[500],
      messageReceived: bg.elevated,
      messageSentText: '#FFFFFF',
      messageReceivedText: txt.primary,
      timestamp: txt.tertiary,
      replyLine: accentPalette[500],
      reaction: bg.hover,
      typing: 'rgba(124, 92, 255, 0.16)',
    },

    // Icons
    icon: {
      primary: txt.primary,
      secondary: txt.secondary,
      tertiary: txt.tertiary,
      inverse: bg.base,
      brand: primaryPalette[500],
    },
  },

  // Glass effects
  glass: {
    card: glassPresets.cardDark,
    button: glassPresets.buttonDark,
    modal: glassPresets.modalDark,
    nav: glassPresets.navDark,
    input: glassPresets.inputDark,
    tooltip: glassPresets.tooltipDark,
    messageSent: glassPresets.messageSent,
    messageReceived: glassPresets.messageReceivedDark,
    backgrounds: glassBackgrounds.dark,
    borders: glassBorders.dark,
  },

  // Shadows (reduced in dark mode)
  shadows: {
    ...Object.fromEntries(
      Object.entries(elevations).map(([key, value]) => [
        key,
        { ...value, shadowOpacity: value.shadowOpacity * 0.6 },
      ])
    ),
    message: {
      sent: { ...messageShadows.sent, shadowOpacity: 0.25 },
      received: { ...messageShadows.received, shadowOpacity: 0.15 },
    },
  },

  // Component specific
  components: {
    // Header
    header: {
      background: bg.base,
      border: line.subtle,
      title: txt.primary,
      icon: txt.primary,
    },

    // Tab bar
    tabBar: {
      background: bg.raised,
      border: line.subtle,
      active: primaryPalette[500],
      inactive: txt.tertiary,
      indicator: primaryPalette[500],
    },

    // Cards
    card: {
      background: bg.card,
      border: line.subtle,
      shadow: { ...elevations.md, shadowOpacity: 0.15 },
    },

    // Buttons
    button: {
      primary: {
        background: primaryPalette[500],
        text: '#FFFFFF',
        border: 'transparent',
      },
      secondary: {
        background: 'rgba(124, 92, 255, 0.16)',
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
        background: semanticColors.error.main,
        text: '#FFFFFF',
        border: 'transparent',
      },
    },

    // Avatar
    avatar: {
      background: primaryPalette[800],
      text: primaryPalette[200],
      border: line.primary,
      online: statusColors.online,
    },

    // Badge
    badge: {
      background: primaryPalette[500],
      text: '#FFFFFF',
    },

    // Divider
    divider: {
      color: line.subtle,
    },

    // Skeleton
    skeleton: {
      background: bg.elevated,
      shimmer: bg.hover,
    },
  },
};

export type DarkTheme = typeof darkTheme;
export default darkTheme;
