/**
 * Shadow/Elevation System for Super-App Messenger 2026
 * Depth and elevation for glassmorphism design
 */

import { Platform } from 'react-native';

// Shadow definitions for iOS/Android
export const shadows = {
  none: {
    shadowColor: 'transparent',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0,
    shadowRadius: 0,
    elevation: 0,
  },

  xs: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 1,
  },

  sm: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 4,
    elevation: 2,
  },

  md: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },

  lg: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 8,
  },

  xl: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 12,
  },

  '2xl': {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 16 },
    shadowOpacity: 0.2,
    shadowRadius: 32,
    elevation: 16,
  },

  '3xl': {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 24 },
    shadowOpacity: 0.25,
    shadowRadius: 48,
    elevation: 24,
  },

  // Inner shadow effect (for pressed states)
  inner: {
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 0,
  },
};

// Glassmorphism shadow presets
export const glassShadows = {
  light: {
    card: {
      shadowColor: 'rgba(31, 38, 135, 0.37)',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 1,
      shadowRadius: 32,
      elevation: 8,
    },
    button: {
      shadowColor: 'rgba(31, 38, 135, 0.25)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 16,
      elevation: 4,
    },
    modal: {
      shadowColor: 'rgba(31, 38, 135, 0.5)',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 1,
      shadowRadius: 48,
      elevation: 16,
    },
    bubble: {
      shadowColor: 'rgba(31, 38, 135, 0.15)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 12,
      elevation: 3,
    },
  },

  dark: {
    card: {
      shadowColor: 'rgba(0, 0, 0, 0.5)',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 1,
      shadowRadius: 32,
      elevation: 8,
    },
    button: {
      shadowColor: 'rgba(0, 0, 0, 0.35)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 16,
      elevation: 4,
    },
    modal: {
      shadowColor: 'rgba(0, 0, 0, 0.65)',
      shadowOffset: { width: 0, height: 16 },
      shadowOpacity: 1,
      shadowRadius: 48,
      elevation: 16,
    },
    bubble: {
      shadowColor: 'rgba(0, 0, 0, 0.25)',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 1,
      shadowRadius: 12,
      elevation: 3,
    },
  },
};

// Neomorphism shadow presets
export const neoShadows = {
  light: {
    raised: {
      shadowColor: '#BEBEBE',
      shadowOffset: { width: 6, height: 6 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 6,
    },
    raisedHighlight: {
      shadowColor: '#FFFFFF',
      shadowOffset: { width: -6, height: -6 },
      shadowOpacity: 1,
      shadowRadius: 10,
      elevation: 0,
    },
    pressed: {
      shadowColor: '#BEBEBE',
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 0.3,
      shadowRadius: 6,
      elevation: 2,
    },
  },

  dark: {
    raised: {
      shadowColor: '#0A0A0A',
      shadowOffset: { width: 6, height: 6 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 6,
    },
    raisedHighlight: {
      shadowColor: '#2A2A2A',
      shadowOffset: { width: -6, height: -6 },
      shadowOpacity: 0.5,
      shadowRadius: 10,
      elevation: 0,
    },
    pressed: {
      shadowColor: '#0A0A0A',
      shadowOffset: { width: 3, height: 3 },
      shadowOpacity: 0.4,
      shadowRadius: 6,
      elevation: 2,
    },
  },
};

// Colored shadows for accent elements
export const coloredShadows = {
  primary: {
    shadowColor: '#8E44AD',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },

  secondary: {
    shadowColor: '#EC4899',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },

  success: {
    shadowColor: '#22C55E',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },

  error: {
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },

  warning: {
    shadowColor: '#F59E0B',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.35,
    shadowRadius: 12,
    elevation: 6,
  },
};

// Helper function to get shadow based on platform
export const getShadow = (shadowKey) => {
  const shadow = shadows[shadowKey];
  if (!shadow) return shadows.none;

  if (Platform.OS === 'android') {
    return { elevation: shadow.elevation };
  }

  return {
    shadowColor: shadow.shadowColor,
    shadowOffset: shadow.shadowOffset,
    shadowOpacity: shadow.shadowOpacity,
    shadowRadius: shadow.shadowRadius,
  };
};

// Helper to combine shadows (for neomorphism)
export const combineShadows = (...shadowKeys) => {
  // Note: Multiple shadows work differently on each platform
  // On web, use boxShadow string
  // On iOS, only one shadow per view (need nested views)
  // On Android, only elevation works
  return shadowKeys.map(key => shadows[key] || shadows.none);
};

export default {
  shadows,
  glassShadows,
  neoShadows,
  coloredShadows,
  getShadow,
  combineShadows,
};
