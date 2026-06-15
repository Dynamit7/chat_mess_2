/**
 * Color System for Super-App Messenger 2026
 * Glassmorphism + Modern gradient palette
 */

// Base colors
export const palette = {
  // Primary brand colors — Premium Futuristic violet
  primary: {
    50: '#F1EDFF',
    100: '#E4DBFF',
    200: '#C9B8FF',
    300: '#AD94FF',
    400: '#9070FF',
    500: '#7C5CFF', // Main primary
    600: '#5B3FE0',
    700: '#4A33B8',
    800: '#382890',
    900: '#261B66',
  },

  // Secondary accent — electric cyan
  secondary: {
    50: '#E0FAFF',
    100: '#B8F2FF',
    200: '#85E8FF',
    300: '#52DBFF',
    400: '#26CEFF',
    500: '#00C2FF',
    600: '#009BD6',
    700: '#0077AB',
    800: '#005780',
    900: '#003B59',
  },

  // Neutral grays
  gray: {
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
  },

  // Semantic colors
  success: {
    light: '#4ADE80',
    main: '#22C55E',
    dark: '#16A34A',
  },

  warning: {
    light: '#FCD34D',
    main: '#F59E0B',
    dark: '#D97706',
  },

  error: {
    light: '#F87171',
    main: '#EF4444',
    dark: '#DC2626',
  },

  info: {
    light: '#60A5FA',
    main: '#3B82F6',
    dark: '#2563EB',
  },
};

// Glassmorphism colors
export const glass = {
  light: {
    background: 'rgba(255, 255, 255, 0.25)',
    backgroundHover: 'rgba(255, 255, 255, 0.35)',
    backgroundActive: 'rgba(255, 255, 255, 0.45)',
    border: 'rgba(255, 255, 255, 0.18)',
    borderHover: 'rgba(255, 255, 255, 0.28)',
    shadow: 'rgba(31, 38, 135, 0.15)',
    blur: 20,
  },
  dark: {
    background: 'rgba(17, 17, 17, 0.75)',
    backgroundHover: 'rgba(17, 17, 17, 0.85)',
    backgroundActive: 'rgba(17, 17, 17, 0.95)',
    border: 'rgba(255, 255, 255, 0.08)',
    borderHover: 'rgba(255, 255, 255, 0.15)',
    shadow: 'rgba(0, 0, 0, 0.25)',
    blur: 20,
  },
};

// Gradient presets — Premium Futuristic violet→cyan
export const gradients = {
  primary: ['#7C5CFF', '#00C2FF'],
  secondary: ['#9070FF', '#7C5CFF'],
  sunset: ['#fa709a', '#fee140'],
  ocean: ['#00C2FF', '#52DBFF'],
  forest: ['#11998e', '#38ef7d'],
  fire: ['#f12711', '#f5af19'],
  purple: ['#7C5CFF', '#5B3FE0'],
  neon: ['#00C2FF', '#7C5CFF'],
  dark: ['#1A2233', '#121826', '#0B0F19'],
  mesh: {
    purple: ['#7C5CFF', '#00C2FF'],
    blue: ['#00C2FF', '#52DBFF'],
    orange: ['#FF4D4D', '#F9CB28'],
  },
};

// Message bubble colors
export const messageBubbles = {
  light: {
    sent: {
      background: 'rgba(124, 92, 255, 0.95)',
      text: '#FFFFFF',
      time: 'rgba(255, 255, 255, 0.7)',
    },
    received: {
      background: 'rgba(255, 255, 255, 0.85)',
      text: '#1a1a1a',
      time: 'rgba(0, 0, 0, 0.5)',
    },
  },
  dark: {
    sent: {
      background: 'rgba(124, 92, 255, 0.92)',
      text: '#FFFFFF',
      time: 'rgba(255, 255, 255, 0.7)',
    },
    received: {
      background: 'rgba(26, 34, 51, 0.92)',
      text: '#F5F7FA',
      time: 'rgba(255, 255, 255, 0.5)',
    },
  },
};

// Theme definitions
export const lightTheme = {
  background: {
    primary: '#FFFFFF',
    secondary: '#F8FAFC',
    tertiary: '#F1F5F9',
    elevated: '#FFFFFF',
  },
  surface: {
    primary: '#FFFFFF',
    secondary: '#F8FAFC',
    tertiary: '#F1F5F9',
  },
  text: {
    primary: '#0F172A',
    secondary: '#475569',
    tertiary: '#94A3B8',
    disabled: '#CBD5E1',
    inverse: '#FFFFFF',
  },
  border: {
    light: '#E2E8F0',
    medium: '#CBD5E1',
    heavy: '#94A3B8',
  },
  ...palette,
  glass: glass.light,
  messageBubble: messageBubbles.light,
};

export const darkTheme = {
  background: {
    primary: '#0B0F19',
    secondary: '#0E1320',
    tertiary: '#121826',
    elevated: '#1A2233',
  },
  surface: {
    primary: '#121826',
    secondary: '#1A2233',
    tertiary: '#222B3D',
  },
  text: {
    primary: '#F5F7FA',
    secondary: '#94A3B8',
    tertiary: '#64748B',
    disabled: '#475569',
    inverse: '#0B0F19',
  },
  border: {
    light: 'rgba(255,255,255,0.08)',
    medium: 'rgba(255,255,255,0.14)',
    heavy: 'rgba(255,255,255,0.22)',
  },
  ...palette,
  glass: glass.dark,
  messageBubble: messageBubbles.dark,
};

// Export default
export default {
  palette,
  glass,
  gradients,
  messageBubbles,
  light: lightTheme,
  dark: darkTheme,
};
