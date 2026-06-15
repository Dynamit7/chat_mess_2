/**
 * 2026 Design System - Color Tokens
 * Comprehensive color palette with semantic tokens and glassmorphism support
 */

// Primary color palette with full scale — Premium Futuristic violet
export const primaryPalette = {
  50: '#F1EDFF',
  100: '#E4DBFF',
  200: '#C9B8FF',
  300: '#AD94FF',
  400: '#9070FF',
  500: '#7C5CFF', // Brand primary
  600: '#5B3FE0',
  700: '#4A33B8',
  800: '#382890',
  900: '#261B66',
};

// Secondary accent palette — electric cyan
export const accentPalette = {
  50: '#E0FAFF',
  100: '#B8F2FF',
  200: '#85E8FF',
  300: '#52DBFF',
  400: '#26CEFF',
  500: '#00C2FF', // Accent cyan
  600: '#009BD6',
  700: '#0077AB',
  800: '#005780',
  900: '#003B59',
};

// Neutral grayscale
export const neutralPalette = {
  0: '#FFFFFF',
  50: '#FAFAFA',
  100: '#F4F4F5',
  200: '#E4E4E7',
  300: '#D4D4D8',
  400: '#A1A1AA',
  500: '#71717A',
  600: '#52525B',
  700: '#3F3F46',
  800: '#27272A',
  900: '#18181B',
  950: '#09090B',
  1000: '#000000',
};

// Semantic colors
export const semanticColors = {
  success: {
    light: '#DCFCE7',
    main: '#22C55E',
    dark: '#16A34A',
  },
  warning: {
    light: '#FEF3C7',
    main: '#F59E0B',
    dark: '#D97706',
  },
  error: {
    light: '#FEE2E2',
    main: '#EF4444',
    dark: '#DC2626',
  },
  info: {
    light: '#DBEAFE',
    main: '#3B82F6',
    dark: '#2563EB',
  },
};

// Status colors
export const statusColors = {
  online: '#22C55E',
  away: '#F59E0B',
  busy: '#EF4444',
  offline: '#71717A',
  typing: '#7C5CFF',
};

// Glassmorphism colors
export const glassColors = {
  light: {
    background: 'rgba(255, 255, 255, 0.25)',
    backgroundStrong: 'rgba(255, 255, 255, 0.4)',
    border: 'rgba(255, 255, 255, 0.18)',
    borderStrong: 'rgba(255, 255, 255, 0.3)',
    shadow: 'rgba(0, 0, 0, 0.1)',
  },
  dark: {
    background: 'rgba(0, 0, 0, 0.25)',
    backgroundStrong: 'rgba(0, 0, 0, 0.4)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderStrong: 'rgba(255, 255, 255, 0.15)',
    shadow: 'rgba(0, 0, 0, 0.3)',
  },
  oled: {
    background: 'rgba(0, 0, 0, 0.65)',
    backgroundStrong: 'rgba(0, 0, 0, 0.8)',
    border: 'rgba(255, 255, 255, 0.04)',
    borderStrong: 'rgba(255, 255, 255, 0.08)',
    shadow: 'rgba(0, 0, 0, 0.5)',
  },
};

// Gradient presets — signature Premium Futuristic violet→cyan
export const gradients = {
  primary: ['#7C5CFF', '#00C2FF'],
  brand: ['#9070FF', '#7C5CFF', '#5B3FE0'],
  sunset: ['#F59E0B', '#EF4444', '#EC4899'],
  aurora: ['#00C2FF', '#7C5CFF', '#9070FF'],
  night: ['#1A2233', '#121826', '#0B0F19'],
  ocean: ['#00C2FF', '#26CEFF', '#52DBFF'],
  forest: ['#22C55E', '#16A34A', '#15803D'],
  fire: ['#F97316', '#EF4444', '#DC2626'],
  cosmic: ['#7C5CFF', '#5B3FE0', '#00C2FF'],
};

// Message bubble colors
export const messageBubbleColors = {
  light: {
    sent: {
      background: primaryPalette[500],
      text: '#FFFFFF',
      timestamp: 'rgba(255, 255, 255, 0.7)',
    },
    received: {
      background: neutralPalette[100],
      text: neutralPalette[900],
      timestamp: neutralPalette[500],
    },
  },
  dark: {
    sent: {
      background: primaryPalette[600],
      text: '#FFFFFF',
      timestamp: 'rgba(255, 255, 255, 0.7)',
    },
    received: {
      background: neutralPalette[800],
      text: neutralPalette[100],
      timestamp: neutralPalette[400],
    },
  },
  oled: {
    sent: {
      background: primaryPalette[700],
      text: '#FFFFFF',
      timestamp: 'rgba(255, 255, 255, 0.6)',
    },
    received: {
      background: neutralPalette[900],
      text: neutralPalette[100],
      timestamp: neutralPalette[500],
    },
  },
};

// Export combined color system
export const colors = {
  primary: primaryPalette,
  accent: accentPalette,
  neutral: neutralPalette,
  semantic: semanticColors,
  status: statusColors,
  glass: glassColors,
  gradients,
  messageBubble: messageBubbleColors,
};

export default colors;
