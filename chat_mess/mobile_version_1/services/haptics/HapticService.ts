/**
 * Haptic Service - 2026 Edition
 * Comprehensive haptic feedback system with pattern support
 */

import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Storage key for haptic settings
const HAPTIC_SETTINGS_KEY = '@app_haptic_settings';

// Haptic feedback types
export type HapticFeedbackType =
  | 'impact_light'
  | 'impact_medium'
  | 'impact_heavy'
  | 'selection'
  | 'success'
  | 'warning'
  | 'error';

// Haptic settings interface
export interface HapticSettings {
  enabled: boolean;
  intensity: 'low' | 'medium' | 'high';
  enableForMessages: boolean;
  enableForButtons: boolean;
  enableForNavigation: boolean;
  enableForNotifications: boolean;
}

// Default settings
const DEFAULT_SETTINGS: HapticSettings = {
  enabled: true,
  intensity: 'medium',
  enableForMessages: true,
  enableForButtons: true,
  enableForNavigation: true,
  enableForNotifications: true,
};

// Singleton instance
let settings: HapticSettings = { ...DEFAULT_SETTINGS };
let isInitialized = false;

/**
 * Initialize the haptic service
 */
export const initializeHaptics = async (): Promise<void> => {
  try {
    const stored = await AsyncStorage.getItem(HAPTIC_SETTINGS_KEY);
    if (stored) {
      settings = { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
    }
    isInitialized = true;
  } catch (error) {
    console.error('Error initializing haptics:', error);
    settings = { ...DEFAULT_SETTINGS };
  }
};

/**
 * Get current haptic settings
 */
export const getHapticSettings = (): HapticSettings => {
  return { ...settings };
};

/**
 * Update haptic settings
 */
export const updateHapticSettings = async (newSettings: Partial<HapticSettings>): Promise<void> => {
  settings = { ...settings, ...newSettings };
  try {
    await AsyncStorage.setItem(HAPTIC_SETTINGS_KEY, JSON.stringify(settings));
  } catch (error) {
    console.error('Error saving haptic settings:', error);
  }
};

/**
 * Check if haptics are available on this device
 */
export const isHapticsAvailable = (): boolean => {
  return Platform.OS === 'ios' || Platform.OS === 'android';
};

/**
 * Internal function to get impact style based on intensity setting
 */
const getImpactStyle = (
  requested: Haptics.ImpactFeedbackStyle
): Haptics.ImpactFeedbackStyle => {
  if (settings.intensity === 'low') {
    return Haptics.ImpactFeedbackStyle.Light;
  }
  if (settings.intensity === 'high') {
    return requested === Haptics.ImpactFeedbackStyle.Light
      ? Haptics.ImpactFeedbackStyle.Medium
      : Haptics.ImpactFeedbackStyle.Heavy;
  }
  return requested;
};

/**
 * Trigger a haptic feedback
 */
export const triggerHaptic = async (type: HapticFeedbackType): Promise<void> => {
  if (!settings.enabled || !isHapticsAvailable()) return;

  try {
    switch (type) {
      case 'impact_light':
        await Haptics.impactAsync(getImpactStyle(Haptics.ImpactFeedbackStyle.Light));
        break;
      case 'impact_medium':
        await Haptics.impactAsync(getImpactStyle(Haptics.ImpactFeedbackStyle.Medium));
        break;
      case 'impact_heavy':
        await Haptics.impactAsync(getImpactStyle(Haptics.ImpactFeedbackStyle.Heavy));
        break;
      case 'selection':
        await Haptics.selectionAsync();
        break;
      case 'success':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'error':
        await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
        break;
    }
  } catch (error) {
    // Silently fail for haptic errors
    console.debug('Haptic feedback failed:', error);
  }
};

/**
 * Predefined haptic patterns
 */
export const HapticPatterns = {
  // Message interactions
  messageSent: async (): Promise<void> => {
    if (!settings.enableForMessages) return;
    await triggerHaptic('impact_light');
  },

  messageReceived: async (): Promise<void> => {
    if (!settings.enableForMessages) return;
    await triggerHaptic('success');
  },

  messageDeleted: async (): Promise<void> => {
    if (!settings.enableForMessages) return;
    await triggerHaptic('impact_medium');
  },

  // Reaction interactions
  reactionAdded: async (): Promise<void> => {
    if (!settings.enableForMessages) return;
    await triggerHaptic('impact_medium');
    await delay(50);
    await triggerHaptic('impact_light');
  },

  reactionRemoved: async (): Promise<void> => {
    if (!settings.enableForMessages) return;
    await triggerHaptic('impact_light');
  },

  // Selection interactions
  selectionStart: async (): Promise<void> => {
    await triggerHaptic('selection');
  },

  selectionChange: async (): Promise<void> => {
    await triggerHaptic('selection');
  },

  // Long press
  longPressStart: async (): Promise<void> => {
    await triggerHaptic('impact_heavy');
  },

  longPressActivate: async (): Promise<void> => {
    await triggerHaptic('impact_medium');
  },

  // Button presses
  buttonPress: async (): Promise<void> => {
    if (!settings.enableForButtons) return;
    await triggerHaptic('impact_light');
  },

  buttonPressHard: async (): Promise<void> => {
    if (!settings.enableForButtons) return;
    await triggerHaptic('impact_medium');
  },

  // Navigation
  tabChange: async (): Promise<void> => {
    if (!settings.enableForNavigation) return;
    await triggerHaptic('selection');
  },

  screenTransition: async (): Promise<void> => {
    if (!settings.enableForNavigation) return;
    await triggerHaptic('impact_light');
  },

  pullToRefresh: async (): Promise<void> => {
    if (!settings.enableForNavigation) return;
    await triggerHaptic('impact_medium');
  },

  // Swipe actions
  swipeThresholdReached: async (): Promise<void> => {
    await triggerHaptic('impact_medium');
  },

  swipeActionTriggered: async (): Promise<void> => {
    await triggerHaptic('success');
  },

  // Errors and warnings
  error: async (): Promise<void> => {
    await triggerHaptic('error');
  },

  warning: async (): Promise<void> => {
    await triggerHaptic('warning');
  },

  // Success
  success: async (): Promise<void> => {
    await triggerHaptic('success');
  },

  // Call events
  callConnected: async (): Promise<void> => {
    await triggerHaptic('impact_heavy');
    await delay(100);
    await triggerHaptic('impact_medium');
  },

  callEnded: async (): Promise<void> => {
    await triggerHaptic('impact_medium');
    await delay(50);
    await triggerHaptic('impact_light');
  },

  callRinging: async (): Promise<void> => {
    // Vibration pattern for ringing
    for (let i = 0; i < 3; i++) {
      await triggerHaptic('impact_medium');
      await delay(150);
    }
  },

  // Notifications
  notificationReceived: async (): Promise<void> => {
    if (!settings.enableForNotifications) return;
    await triggerHaptic('success');
  },

  // Recording
  recordingStart: async (): Promise<void> => {
    await triggerHaptic('impact_medium');
  },

  recordingStop: async (): Promise<void> => {
    await triggerHaptic('impact_heavy');
  },

  // Media
  photoTaken: async (): Promise<void> => {
    await triggerHaptic('impact_medium');
  },

  videoStart: async (): Promise<void> => {
    await triggerHaptic('impact_light');
  },

  videoStop: async (): Promise<void> => {
    await triggerHaptic('impact_medium');
  },

  // Toggle switches
  toggleOn: async (): Promise<void> => {
    await triggerHaptic('impact_light');
  },

  toggleOff: async (): Promise<void> => {
    await triggerHaptic('impact_light');
  },

  // Slider
  sliderTick: async (): Promise<void> => {
    await triggerHaptic('selection');
  },

  sliderEnd: async (): Promise<void> => {
    await triggerHaptic('impact_light');
  },
};

/**
 * Helper function for delays
 */
const delay = (ms: number): Promise<void> => {
  return new Promise((resolve) => setTimeout(resolve, ms));
};

/**
 * Custom haptic pattern builder
 */
export const createHapticPattern = (steps: Array<{ type: HapticFeedbackType; delay?: number }>) => {
  return async (): Promise<void> => {
    if (!settings.enabled) return;

    for (const step of steps) {
      await triggerHaptic(step.type);
      if (step.delay) {
        await delay(step.delay);
      }
    }
  };
};

// Export default service object
export const HapticService = {
  initialize: initializeHaptics,
  getSettings: getHapticSettings,
  updateSettings: updateHapticSettings,
  isAvailable: isHapticsAvailable,
  trigger: triggerHaptic,
  patterns: HapticPatterns,
  createPattern: createHapticPattern,
};

export default HapticService;
