/**
 * Typography System for Super-App Messenger 2026
 * Modern, readable, cross-platform font scale
 */

import { Platform } from 'react-native';

// Font families - using system fonts for best performance
export const fontFamily = {
  // Primary font stack
  primary: Platform.select({
    ios: 'SF Pro Display',
    android: 'Roboto',
    web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    default: 'System',
  }),

  // Secondary font for body text
  secondary: Platform.select({
    ios: 'SF Pro Text',
    android: 'Roboto',
    web: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif',
    default: 'System',
  }),

  // Monospace for code
  mono: Platform.select({
    ios: 'SF Mono',
    android: 'Roboto Mono',
    web: '"SF Mono", "Fira Code", "Fira Mono", Menlo, Consolas, monospace',
    default: 'monospace',
  }),
};

// Font weights
export const fontWeight = {
  thin: '100',
  extraLight: '200',
  light: '300',
  regular: '400',
  medium: '500',
  semiBold: '600',
  bold: '700',
  extraBold: '800',
  black: '900',
};

// Font sizes with line heights
export const fontSize = {
  // Display sizes - for hero text
  display: {
    '2xl': { size: 72, lineHeight: 80, letterSpacing: -2 },
    xl: { size: 60, lineHeight: 68, letterSpacing: -1.5 },
    lg: { size: 48, lineHeight: 56, letterSpacing: -1 },
    md: { size: 36, lineHeight: 44, letterSpacing: -0.5 },
    sm: { size: 30, lineHeight: 38, letterSpacing: 0 },
  },

  // Heading sizes
  heading: {
    h1: { size: 32, lineHeight: 40, letterSpacing: -0.5 },
    h2: { size: 28, lineHeight: 36, letterSpacing: -0.25 },
    h3: { size: 24, lineHeight: 32, letterSpacing: 0 },
    h4: { size: 20, lineHeight: 28, letterSpacing: 0 },
    h5: { size: 18, lineHeight: 26, letterSpacing: 0 },
    h6: { size: 16, lineHeight: 24, letterSpacing: 0 },
  },

  // Body text sizes
  body: {
    xl: { size: 20, lineHeight: 30, letterSpacing: 0 },
    lg: { size: 18, lineHeight: 28, letterSpacing: 0 },
    md: { size: 16, lineHeight: 24, letterSpacing: 0 },
    sm: { size: 14, lineHeight: 20, letterSpacing: 0 },
    xs: { size: 12, lineHeight: 18, letterSpacing: 0 },
  },

  // Label/caption sizes
  label: {
    lg: { size: 14, lineHeight: 20, letterSpacing: 0.25 },
    md: { size: 12, lineHeight: 16, letterSpacing: 0.5 },
    sm: { size: 11, lineHeight: 14, letterSpacing: 0.5 },
    xs: { size: 10, lineHeight: 12, letterSpacing: 0.5 },
  },
};

// Pre-built text styles
export const textStyles = {
  // Display variants
  displayLarge: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.display.lg.size,
    lineHeight: fontSize.display.lg.lineHeight,
    letterSpacing: fontSize.display.lg.letterSpacing,
    fontWeight: fontWeight.bold,
  },
  displayMedium: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.display.md.size,
    lineHeight: fontSize.display.md.lineHeight,
    letterSpacing: fontSize.display.md.letterSpacing,
    fontWeight: fontWeight.bold,
  },
  displaySmall: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.display.sm.size,
    lineHeight: fontSize.display.sm.lineHeight,
    letterSpacing: fontSize.display.sm.letterSpacing,
    fontWeight: fontWeight.bold,
  },

  // Heading variants
  h1: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.heading.h1.size,
    lineHeight: fontSize.heading.h1.lineHeight,
    letterSpacing: fontSize.heading.h1.letterSpacing,
    fontWeight: fontWeight.bold,
  },
  h2: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.heading.h2.size,
    lineHeight: fontSize.heading.h2.lineHeight,
    letterSpacing: fontSize.heading.h2.letterSpacing,
    fontWeight: fontWeight.bold,
  },
  h3: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.heading.h3.size,
    lineHeight: fontSize.heading.h3.lineHeight,
    letterSpacing: fontSize.heading.h3.letterSpacing,
    fontWeight: fontWeight.semiBold,
  },
  h4: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.heading.h4.size,
    lineHeight: fontSize.heading.h4.lineHeight,
    letterSpacing: fontSize.heading.h4.letterSpacing,
    fontWeight: fontWeight.semiBold,
  },
  h5: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.heading.h5.size,
    lineHeight: fontSize.heading.h5.lineHeight,
    letterSpacing: fontSize.heading.h5.letterSpacing,
    fontWeight: fontWeight.medium,
  },
  h6: {
    fontFamily: fontFamily.primary,
    fontSize: fontSize.heading.h6.size,
    lineHeight: fontSize.heading.h6.lineHeight,
    letterSpacing: fontSize.heading.h6.letterSpacing,
    fontWeight: fontWeight.medium,
  },

  // Body variants
  bodyLarge: {
    fontFamily: fontFamily.secondary,
    fontSize: fontSize.body.lg.size,
    lineHeight: fontSize.body.lg.lineHeight,
    letterSpacing: fontSize.body.lg.letterSpacing,
    fontWeight: fontWeight.regular,
  },
  bodyMedium: {
    fontFamily: fontFamily.secondary,
    fontSize: fontSize.body.md.size,
    lineHeight: fontSize.body.md.lineHeight,
    letterSpacing: fontSize.body.md.letterSpacing,
    fontWeight: fontWeight.regular,
  },
  bodySmall: {
    fontFamily: fontFamily.secondary,
    fontSize: fontSize.body.sm.size,
    lineHeight: fontSize.body.sm.lineHeight,
    letterSpacing: fontSize.body.sm.letterSpacing,
    fontWeight: fontWeight.regular,
  },

  // Label variants
  labelLarge: {
    fontFamily: fontFamily.secondary,
    fontSize: fontSize.label.lg.size,
    lineHeight: fontSize.label.lg.lineHeight,
    letterSpacing: fontSize.label.lg.letterSpacing,
    fontWeight: fontWeight.medium,
  },
  labelMedium: {
    fontFamily: fontFamily.secondary,
    fontSize: fontSize.label.md.size,
    lineHeight: fontSize.label.md.lineHeight,
    letterSpacing: fontSize.label.md.letterSpacing,
    fontWeight: fontWeight.medium,
  },
  labelSmall: {
    fontFamily: fontFamily.secondary,
    fontSize: fontSize.label.sm.size,
    lineHeight: fontSize.label.sm.lineHeight,
    letterSpacing: fontSize.label.sm.letterSpacing,
    fontWeight: fontWeight.medium,
  },

  // Special variants
  button: {
    fontFamily: fontFamily.primary,
    fontSize: 16,
    lineHeight: 24,
    letterSpacing: 0.5,
    fontWeight: fontWeight.semiBold,
    textTransform: 'none',
  },
  buttonSmall: {
    fontFamily: fontFamily.primary,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0.25,
    fontWeight: fontWeight.semiBold,
    textTransform: 'none',
  },
  caption: {
    fontFamily: fontFamily.secondary,
    fontSize: fontSize.label.sm.size,
    lineHeight: fontSize.label.sm.lineHeight,
    letterSpacing: fontSize.label.sm.letterSpacing,
    fontWeight: fontWeight.regular,
  },
  overline: {
    fontFamily: fontFamily.secondary,
    fontSize: fontSize.label.xs.size,
    lineHeight: fontSize.label.xs.lineHeight,
    letterSpacing: 1.5,
    fontWeight: fontWeight.medium,
    textTransform: 'uppercase',
  },
  code: {
    fontFamily: fontFamily.mono,
    fontSize: fontSize.body.sm.size,
    lineHeight: fontSize.body.sm.lineHeight,
    letterSpacing: 0,
    fontWeight: fontWeight.regular,
  },

  // Chat-specific
  messageText: {
    fontFamily: fontFamily.secondary,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
    fontWeight: fontWeight.regular,
  },
  messageTime: {
    fontFamily: fontFamily.secondary,
    fontSize: 11,
    lineHeight: 14,
    letterSpacing: 0.25,
    fontWeight: fontWeight.regular,
  },
  chatName: {
    fontFamily: fontFamily.primary,
    fontSize: 16,
    lineHeight: 22,
    letterSpacing: 0,
    fontWeight: fontWeight.semiBold,
  },
  chatPreview: {
    fontFamily: fontFamily.secondary,
    fontSize: 14,
    lineHeight: 20,
    letterSpacing: 0,
    fontWeight: fontWeight.regular,
  },
};

export default {
  fontFamily,
  fontWeight,
  fontSize,
  textStyles,
};
