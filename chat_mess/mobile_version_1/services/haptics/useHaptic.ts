/**
 * useHaptic Hook
 * React hook for easy haptic feedback integration
 */

import { useCallback, useEffect, useState } from 'react';
import {
  HapticService,
  HapticPatterns,
  HapticSettings,
  HapticFeedbackType,
  initializeHaptics,
  getHapticSettings,
  updateHapticSettings,
  triggerHaptic,
} from './HapticService';

interface UseHapticReturn {
  // Settings
  settings: HapticSettings;
  isEnabled: boolean;
  updateSettings: (settings: Partial<HapticSettings>) => Promise<void>;

  // Quick triggers
  trigger: (type: HapticFeedbackType) => Promise<void>;

  // Pattern shortcuts
  messageSent: () => Promise<void>;
  messageReceived: () => Promise<void>;
  reactionAdded: () => Promise<void>;
  buttonPress: () => Promise<void>;
  longPress: () => Promise<void>;
  success: () => Promise<void>;
  error: () => Promise<void>;
  warning: () => Promise<void>;
  selection: () => Promise<void>;
  tabChange: () => Promise<void>;
  swipeThreshold: () => Promise<void>;

  // All patterns
  patterns: typeof HapticPatterns;
}

/**
 * Hook for haptic feedback
 */
export const useHaptic = (): UseHapticReturn => {
  const [settings, setSettings] = useState<HapticSettings>(getHapticSettings());
  const [isInitialized, setIsInitialized] = useState(false);

  // Initialize on mount
  useEffect(() => {
    const init = async () => {
      await initializeHaptics();
      setSettings(getHapticSettings());
      setIsInitialized(true);
    };
    init();
  }, []);

  // Update settings
  const handleUpdateSettings = useCallback(async (newSettings: Partial<HapticSettings>) => {
    await updateHapticSettings(newSettings);
    setSettings(getHapticSettings());
  }, []);

  // Memoized pattern callbacks
  const messageSent = useCallback(() => HapticPatterns.messageSent(), []);
  const messageReceived = useCallback(() => HapticPatterns.messageReceived(), []);
  const reactionAdded = useCallback(() => HapticPatterns.reactionAdded(), []);
  const buttonPress = useCallback(() => HapticPatterns.buttonPress(), []);
  const longPress = useCallback(() => HapticPatterns.longPressStart(), []);
  const success = useCallback(() => HapticPatterns.success(), []);
  const error = useCallback(() => HapticPatterns.error(), []);
  const warning = useCallback(() => HapticPatterns.warning(), []);
  const selection = useCallback(() => HapticPatterns.selectionChange(), []);
  const tabChange = useCallback(() => HapticPatterns.tabChange(), []);
  const swipeThreshold = useCallback(() => HapticPatterns.swipeThresholdReached(), []);

  return {
    settings,
    isEnabled: settings.enabled,
    updateSettings: handleUpdateSettings,
    trigger: triggerHaptic,
    messageSent,
    messageReceived,
    reactionAdded,
    buttonPress,
    longPress,
    success,
    error,
    warning,
    selection,
    tabChange,
    swipeThreshold,
    patterns: HapticPatterns,
  };
};

/**
 * Hook for haptic feedback on press
 * Returns press handlers with haptic feedback
 */
export const useHapticPress = (
  onPress?: () => void,
  options: {
    onPressHaptic?: HapticFeedbackType;
    onPressInHaptic?: HapticFeedbackType;
    onLongPressHaptic?: HapticFeedbackType;
    disabled?: boolean;
  } = {}
) => {
  const {
    onPressHaptic = 'impact_light',
    onPressInHaptic,
    onLongPressHaptic = 'impact_heavy',
    disabled = false,
  } = options;

  const handlePress = useCallback(async () => {
    if (disabled) return;
    await triggerHaptic(onPressHaptic);
    onPress?.();
  }, [disabled, onPressHaptic, onPress]);

  const handlePressIn = useCallback(async () => {
    if (disabled || !onPressInHaptic) return;
    await triggerHaptic(onPressInHaptic);
  }, [disabled, onPressInHaptic]);

  const handleLongPress = useCallback(async () => {
    if (disabled) return;
    await triggerHaptic(onLongPressHaptic);
  }, [disabled, onLongPressHaptic]);

  return {
    onPress: handlePress,
    onPressIn: onPressInHaptic ? handlePressIn : undefined,
    onLongPress: handleLongPress,
  };
};

/**
 * Hook for haptic feedback on gestures
 */
export const useHapticGesture = () => {
  const swipeStart = useCallback(async () => {
    await triggerHaptic('selection');
  }, []);

  const swipeThreshold = useCallback(async () => {
    await HapticPatterns.swipeThresholdReached();
  }, []);

  const swipeComplete = useCallback(async () => {
    await HapticPatterns.swipeActionTriggered();
  }, []);

  const swipeCancel = useCallback(async () => {
    await triggerHaptic('impact_light');
  }, []);

  const pinchStart = useCallback(async () => {
    await triggerHaptic('selection');
  }, []);

  const pinchChange = useCallback(async () => {
    await triggerHaptic('selection');
  }, []);

  return {
    swipeStart,
    swipeThreshold,
    swipeComplete,
    swipeCancel,
    pinchStart,
    pinchChange,
  };
};

export default useHaptic;
