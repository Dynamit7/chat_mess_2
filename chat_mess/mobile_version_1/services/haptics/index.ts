/**
 * Haptics Service - Barrel Export
 */

export {
  HapticService,
  HapticPatterns,
  initializeHaptics,
  getHapticSettings,
  updateHapticSettings,
  isHapticsAvailable,
  triggerHaptic,
  createHapticPattern,
  type HapticSettings,
  type HapticFeedbackType,
} from './HapticService';

export {
  useHaptic,
  useHapticPress,
  useHapticGesture,
} from './useHaptic';
