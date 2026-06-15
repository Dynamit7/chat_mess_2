/**
 * Animation System for Super-App Messenger 2026
 * Smooth, responsive micro-interactions
 */

import { Easing } from 'react-native-reanimated';

// Duration presets (in milliseconds)
export const duration = {
  instant: 0,
  fastest: 100,
  fast: 150,
  normal: 250,
  slow: 350,
  slower: 500,
  slowest: 750,

  // Semantic durations
  microInteraction: 150,
  transition: 250,
  emphasis: 400,
  complex: 500,
  pageTransition: 350,
};

// Easing presets using Reanimated Easing
export const easing = {
  // Standard easings
  linear: Easing.linear,
  easeIn: Easing.in(Easing.ease),
  easeOut: Easing.out(Easing.ease),
  easeInOut: Easing.inOut(Easing.ease),

  // Cubic easings
  easeInCubic: Easing.in(Easing.cubic),
  easeOutCubic: Easing.out(Easing.cubic),
  easeInOutCubic: Easing.inOut(Easing.cubic),

  // Quart easings (smoother)
  easeInQuart: Easing.in(Easing.quad),
  easeOutQuart: Easing.out(Easing.quad),
  easeInOutQuart: Easing.inOut(Easing.quad),

  // Expo easings (dramatic)
  easeInExpo: Easing.in(Easing.exp),
  easeOutExpo: Easing.out(Easing.exp),
  easeInOutExpo: Easing.inOut(Easing.exp),

  // Back easings (overshoot)
  easeInBack: Easing.in(Easing.back(1.7)),
  easeOutBack: Easing.out(Easing.back(1.7)),
  easeInOutBack: Easing.inOut(Easing.back(1.7)),

  // Elastic easings (bounce)
  easeInElastic: Easing.in(Easing.elastic(1)),
  easeOutElastic: Easing.out(Easing.elastic(1)),
  easeInOutElastic: Easing.inOut(Easing.elastic(1)),

  // Bounce
  bounce: Easing.bounce,
  bounceIn: Easing.in(Easing.bounce),
  bounceOut: Easing.out(Easing.bounce),
};

// Spring configurations for Reanimated
export const spring = {
  // Snappy - quick and responsive
  snappy: {
    damping: 15,
    stiffness: 400,
    mass: 1,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },

  // Bouncy - playful with overshoot
  bouncy: {
    damping: 10,
    stiffness: 180,
    mass: 1,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },

  // Gentle - slow and smooth
  gentle: {
    damping: 20,
    stiffness: 120,
    mass: 1,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },

  // Stiff - minimal overshoot
  stiff: {
    damping: 20,
    stiffness: 300,
    mass: 1,
    overshootClamping: true,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },

  // Default balanced spring
  default: {
    damping: 15,
    stiffness: 200,
    mass: 1,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },

  // For bottom sheets and modals
  modal: {
    damping: 25,
    stiffness: 300,
    mass: 1,
    overshootClamping: true,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },

  // For swipe gestures
  swipe: {
    damping: 20,
    stiffness: 250,
    mass: 1,
    overshootClamping: false,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },

  // For button press
  button: {
    damping: 12,
    stiffness: 400,
    mass: 0.8,
    overshootClamping: true,
    restDisplacementThreshold: 0.01,
    restSpeedThreshold: 0.01,
  },
};

// Pre-built animation configs for withTiming
export const timingConfigs = {
  // Fast feedback
  microInteraction: {
    duration: duration.microInteraction,
    easing: easing.easeOutCubic,
  },

  // Standard transitions
  transition: {
    duration: duration.transition,
    easing: easing.easeInOutCubic,
  },

  // Emphasis animations
  emphasis: {
    duration: duration.emphasis,
    easing: easing.easeOutBack,
  },

  // Page/screen transitions
  pageEnter: {
    duration: duration.pageTransition,
    easing: easing.easeOutCubic,
  },
  pageExit: {
    duration: duration.fast,
    easing: easing.easeInCubic,
  },

  // Fade animations
  fadeIn: {
    duration: duration.normal,
    easing: easing.easeOut,
  },
  fadeOut: {
    duration: duration.fast,
    easing: easing.easeIn,
  },

  // Scale animations
  scaleUp: {
    duration: duration.normal,
    easing: easing.easeOutBack,
  },
  scaleDown: {
    duration: duration.fast,
    easing: easing.easeIn,
  },

  // Slide animations
  slideIn: {
    duration: duration.transition,
    easing: easing.easeOutCubic,
  },
  slideOut: {
    duration: duration.fast,
    easing: easing.easeInCubic,
  },
};

// Keyframe presets for complex animations
export const keyframes = {
  // Pulse effect
  pulse: {
    0: { scale: 1, opacity: 1 },
    50: { scale: 1.05, opacity: 0.8 },
    100: { scale: 1, opacity: 1 },
  },

  // Shake effect (for errors)
  shake: {
    0: { translateX: 0 },
    20: { translateX: -10 },
    40: { translateX: 10 },
    60: { translateX: -10 },
    80: { translateX: 10 },
    100: { translateX: 0 },
  },

  // Bounce in
  bounceIn: {
    0: { scale: 0.3, opacity: 0 },
    50: { scale: 1.05 },
    70: { scale: 0.9 },
    100: { scale: 1, opacity: 1 },
  },

  // Fade up
  fadeUp: {
    0: { opacity: 0, translateY: 20 },
    100: { opacity: 1, translateY: 0 },
  },

  // Fade down
  fadeDown: {
    0: { opacity: 0, translateY: -20 },
    100: { opacity: 1, translateY: 0 },
  },

  // Zoom in
  zoomIn: {
    0: { scale: 0, opacity: 0 },
    100: { scale: 1, opacity: 1 },
  },

  // Slide from right
  slideFromRight: {
    0: { translateX: '100%', opacity: 0 },
    100: { translateX: 0, opacity: 1 },
  },

  // Slide from bottom
  slideFromBottom: {
    0: { translateY: '100%', opacity: 0 },
    100: { translateY: 0, opacity: 1 },
  },

  // Heart beat (for likes)
  heartBeat: {
    0: { scale: 1 },
    14: { scale: 1.3 },
    28: { scale: 1 },
    42: { scale: 1.3 },
    70: { scale: 1 },
  },

  // Typing indicator dots
  typingDot: {
    0: { opacity: 0.3, translateY: 0 },
    50: { opacity: 1, translateY: -4 },
    100: { opacity: 0.3, translateY: 0 },
  },
};

// Stagger delays for list animations
export const stagger = {
  fast: 30,
  normal: 50,
  slow: 80,

  // Calculate delay for index
  getDelay: (index, type = 'normal') => index * stagger[type],
};

// Gesture thresholds
export const gesture = {
  swipe: {
    velocityThreshold: 500,
    distanceThreshold: 50,
  },
  tap: {
    maxDuration: 200,
    maxDistance: 10,
  },
  longPress: {
    minDuration: 500,
  },
};

export default {
  duration,
  easing,
  spring,
  timingConfigs,
  keyframes,
  stagger,
  gesture,
};
