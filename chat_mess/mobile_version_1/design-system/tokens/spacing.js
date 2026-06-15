/**
 * Spacing System for Super-App Messenger 2026
 * Based on 4px grid system
 */

// Base unit
const BASE_UNIT = 4;

// Spacing scale (multipliers of base unit)
export const spacing = {
  0: 0,
  0.5: BASE_UNIT * 0.5,  // 2px
  1: BASE_UNIT,          // 4px
  1.5: BASE_UNIT * 1.5,  // 6px
  2: BASE_UNIT * 2,      // 8px
  2.5: BASE_UNIT * 2.5,  // 10px
  3: BASE_UNIT * 3,      // 12px
  3.5: BASE_UNIT * 3.5,  // 14px
  4: BASE_UNIT * 4,      // 16px
  5: BASE_UNIT * 5,      // 20px
  6: BASE_UNIT * 6,      // 24px
  7: BASE_UNIT * 7,      // 28px
  8: BASE_UNIT * 8,      // 32px
  9: BASE_UNIT * 9,      // 36px
  10: BASE_UNIT * 10,    // 40px
  11: BASE_UNIT * 11,    // 44px
  12: BASE_UNIT * 12,    // 48px
  14: BASE_UNIT * 14,    // 56px
  16: BASE_UNIT * 16,    // 64px
  20: BASE_UNIT * 20,    // 80px
  24: BASE_UNIT * 24,    // 96px
  28: BASE_UNIT * 28,    // 112px
  32: BASE_UNIT * 32,    // 128px
  36: BASE_UNIT * 36,    // 144px
  40: BASE_UNIT * 40,    // 160px
  44: BASE_UNIT * 44,    // 176px
  48: BASE_UNIT * 48,    // 192px
  52: BASE_UNIT * 52,    // 208px
  56: BASE_UNIT * 56,    // 224px
  60: BASE_UNIT * 60,    // 240px
  64: BASE_UNIT * 64,    // 256px
  72: BASE_UNIT * 72,    // 288px
  80: BASE_UNIT * 80,    // 320px
  96: BASE_UNIT * 96,    // 384px
};

// Semantic spacing
export const semantic = {
  // Component internal spacing
  component: {
    xs: spacing[1],   // 4px
    sm: spacing[2],   // 8px
    md: spacing[3],   // 12px
    lg: spacing[4],   // 16px
    xl: spacing[6],   // 24px
  },

  // Content spacing (between elements)
  content: {
    xs: spacing[2],   // 8px
    sm: spacing[3],   // 12px
    md: spacing[4],   // 16px
    lg: spacing[6],   // 24px
    xl: spacing[8],   // 32px
  },

  // Section spacing (between sections)
  section: {
    xs: spacing[6],   // 24px
    sm: spacing[8],   // 32px
    md: spacing[12],  // 48px
    lg: spacing[16],  // 64px
    xl: spacing[24],  // 96px
  },

  // Screen padding
  screen: {
    horizontal: spacing[4],  // 16px
    vertical: spacing[4],    // 16px
    top: spacing[6],         // 24px - account for notch
    bottom: spacing[8],      // 32px - account for home indicator
  },

  // Chat specific
  chat: {
    messageGap: spacing[2],        // 8px between messages
    bubblePadding: spacing[3],     // 12px inside bubble
    bubbleRadius: spacing[5],      // 20px border radius
    avatarSize: spacing[10],       // 40px
    avatarGap: spacing[2],         // 8px
    inputPadding: spacing[3],      // 12px
    inputHeight: spacing[12],      // 48px
  },

  // List item spacing
  listItem: {
    padding: spacing[4],           // 16px
    gap: spacing[3],               // 12px
    avatarSize: spacing[12],       // 48px
    iconSize: spacing[6],          // 24px
  },

  // Card spacing
  card: {
    padding: spacing[4],           // 16px
    gap: spacing[3],               // 12px
    radius: spacing[4],            // 16px
  },

  // Button spacing
  button: {
    paddingHorizontal: spacing[6], // 24px
    paddingVertical: spacing[3],   // 12px
    gap: spacing[2],               // 8px
    minHeight: spacing[11],        // 44px (iOS touch target)
  },

  // Input spacing
  input: {
    paddingHorizontal: spacing[4], // 16px
    paddingVertical: spacing[3],   // 12px
    height: spacing[12],           // 48px
    radius: spacing[3],            // 12px
  },

  // Modal/Bottom sheet spacing
  modal: {
    padding: spacing[6],           // 24px
    headerGap: spacing[4],         // 16px
    contentGap: spacing[4],        // 16px
    radius: spacing[6],            // 24px
  },

  // Tab bar
  tabBar: {
    height: spacing[16],           // 64px
    iconSize: spacing[6],          // 24px
    labelGap: spacing[1],          // 4px
    padding: spacing[2],           // 8px
  },

  // Header
  header: {
    height: spacing[14],           // 56px
    padding: spacing[4],           // 16px
    iconSize: spacing[6],          // 24px
  },
};

// Border radius presets
export const borderRadius = {
  none: 0,
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  '2xl': 24,
  '3xl': 32,
  full: 9999,
};

// Icon sizes
export const iconSize = {
  xs: 16,
  sm: 20,
  md: 24,
  lg: 28,
  xl: 32,
  '2xl': 40,
  '3xl': 48,
};

// Avatar sizes
export const avatarSize = {
  xs: 24,
  sm: 32,
  md: 40,
  lg: 48,
  xl: 56,
  '2xl': 64,
  '3xl': 80,
  '4xl': 96,
  '5xl': 128,
};

// Touch target sizes (minimum for accessibility)
export const touchTarget = {
  min: 44,  // iOS minimum
  recommended: 48,
};

export default {
  spacing,
  semantic,
  borderRadius,
  iconSize,
  avatarSize,
  touchTarget,
  BASE_UNIT,
};
