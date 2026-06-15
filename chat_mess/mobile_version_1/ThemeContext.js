/**
 * Enhanced Theme Context - 2026 Edition
 * Supports Light, Dark, OLED Black, and System Auto modes
 * Includes smooth animated transitions between themes
 */

import React, { createContext, useState, useContext, useEffect, useMemo, useCallback } from 'react';
import { Appearance, useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Animated, {
  useSharedValue,
  withTiming,
  useAnimatedStyle,
  interpolateColor,
  Easing,
} from 'react-native-reanimated';
import * as Haptics from 'expo-haptics';

// Import themes from design system
import { lightTheme } from './design-system/themes/lightTheme';
import { darkTheme } from './design-system/themes/darkTheme';
import { oledTheme } from './design-system/themes/oledTheme';

// Theme modes
export const THEME_MODES = {
  LIGHT: 'light',
  DARK: 'dark',
  OLED: 'oled',
  SYSTEM: 'system',
};

// Storage key
const THEME_STORAGE_KEY = '@app_theme_mode';

// Legacy theme colors mapping (for backward compatibility with old theme.js)
const createLegacyTheme = (newTheme) => ({
  colors: {
    primary: newTheme.colors.brand.primary,
    white: '#ffffff',
    black: '#000000',
    searchIcon: newTheme.colors.icon.secondary,
    searchText: newTheme.colors.text.secondary,
    searchBackground: newTheme.colors.input.background,
    title: newTheme.colors.text.primary,
    subTitle: newTheme.colors.text.secondary,
    storyBorder: newTheme.colors.brand.primary,
    description: newTheme.colors.text.tertiary,
    inputBackground: newTheme.colors.input.background,
    inputText: newTheme.colors.text.primary,
    danger: newTheme.colors.semantic.error,
    light: newTheme.colors.border.primary,
    messageBackground: newTheme.colors.chat.messageSent,
    halfOpacitySecondary: 'rgba(0, 194, 255, 0.5)',
    halfOpacityPrimary: 'rgba(124, 92, 255, 0.5)',
    success: newTheme.colors.semantic.success,
    // New colors
    background: newTheme.colors.background.primary,
    surface: newTheme.colors.surface.primary,
    text: newTheme.colors.text.primary,
    textSecondary: newTheme.colors.text.secondary,
    // Profile screen colors
    back: newTheme.colors.background.primary,
    icon: newTheme.colors.brand.primary,
    arrow_icon_color: '#ffffff',
    prof_con_back: newTheme.isDark
      ? ['#1A2233', '#0B0F19']
      : ['#7C5CFF', '#00C2FF'],
    prof_icon: newTheme.colors.brand.primary,
    setting: newTheme.colors.text.primary,
    exit: newTheme.colors.semantic.error,
    // Chat colors
    chatBackground: newTheme.colors.background.primary,
    messageSent: newTheme.colors.chat.messageSent,
    messageReceived: newTheme.colors.chat.messageReceived,
    messageSentText: newTheme.colors.chat.messageSentText,
    messageReceivedText: newTheme.colors.chat.messageReceivedText,
  },
  fontSize: {
    title: 18,
    subTitle: 13,
    message: 15,
  },
});

// Create context with default values
const ThemeContext = createContext({
  theme: lightTheme,
  currentTheme: createLegacyTheme(lightTheme), // Legacy support
  themeMode: THEME_MODES.SYSTEM,
  isDarkMode: false,
  isOledMode: false,
  setThemeMode: () => {},
  toggleDarkMode: () => {},
  cycleTheme: () => {},
  themeProgress: { value: 0 },
});

export const useTheme = () => useContext(ThemeContext);

// Hook for animated theme transitions
export const useAnimatedTheme = () => {
  const { theme, themeProgress } = useTheme();

  const animatedBackgroundStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        themeProgress.value,
        [0, 1, 2],
        [
          lightTheme.colors.background.primary,
          darkTheme.colors.background.primary,
          oledTheme.colors.background.primary,
        ]
      ),
    };
  });

  const animatedTextStyle = useAnimatedStyle(() => {
    return {
      color: interpolateColor(
        themeProgress.value,
        [0, 1, 2],
        [
          lightTheme.colors.text.primary,
          darkTheme.colors.text.primary,
          oledTheme.colors.text.primary,
        ]
      ),
    };
  });

  const animatedCardStyle = useAnimatedStyle(() => {
    return {
      backgroundColor: interpolateColor(
        themeProgress.value,
        [0, 1, 2],
        [
          lightTheme.components.card.background,
          darkTheme.components.card.background,
          oledTheme.components.card.background,
        ]
      ),
    };
  });

  return {
    theme,
    animatedBackgroundStyle,
    animatedTextStyle,
    animatedCardStyle,
  };
};

export const ThemeProvider = ({ children }) => {
  const systemColorScheme = useColorScheme();
  const [themeMode, setThemeModeState] = useState(THEME_MODES.DARK);
  const [isLoading, setIsLoading] = useState(true);

  // Animated value for smooth transitions (0 = light, 1 = dark, 2 = oled)
  const themeProgress = useSharedValue(0);

  // Load saved theme on mount
  useEffect(() => {
    const loadTheme = async () => {
      try {
        const storedMode = await AsyncStorage.getItem(THEME_STORAGE_KEY);
        if (storedMode && Object.values(THEME_MODES).includes(storedMode)) {
          setThemeModeState(storedMode);
        }
      } catch (error) {
        console.error('Error loading theme:', error);
      } finally {
        setIsLoading(false);
      }
    };
    loadTheme();
  }, []);

  // Listen for system theme changes
  useEffect(() => {
    const subscription = Appearance.addChangeListener(({ colorScheme }) => {
      if (themeMode === THEME_MODES.SYSTEM) {
        updateThemeProgress(colorScheme === 'dark' ? 1 : 0);
      }
    });

    return () => subscription.remove();
  }, [themeMode]);

  // Update animation progress when theme changes
  const updateThemeProgress = useCallback((targetValue) => {
    themeProgress.value = withTiming(targetValue, {
      duration: 350,
      easing: Easing.bezier(0.4, 0, 0.2, 1),
    });
  }, []);

  // Determine the actual theme based on mode and system preference
  const { theme, isDarkMode, isOledMode } = useMemo(() => {
    let resolvedMode = themeMode;

    if (themeMode === THEME_MODES.SYSTEM) {
      resolvedMode = systemColorScheme === 'dark' ? THEME_MODES.DARK : THEME_MODES.LIGHT;
    }

    switch (resolvedMode) {
      case THEME_MODES.OLED:
        return { theme: oledTheme, isDarkMode: true, isOledMode: true };
      case THEME_MODES.DARK:
        return { theme: darkTheme, isDarkMode: true, isOledMode: false };
      case THEME_MODES.LIGHT:
      default:
        return { theme: lightTheme, isDarkMode: false, isOledMode: false };
    }
  }, [themeMode, systemColorScheme]);

  // Update animation when theme changes
  useEffect(() => {
    if (!isLoading) {
      const targetProgress = isOledMode ? 2 : isDarkMode ? 1 : 0;
      updateThemeProgress(targetProgress);
    }
  }, [isDarkMode, isOledMode, isLoading]);

  // Set theme mode with persistence and haptic feedback
  const setThemeMode = useCallback(async (mode) => {
    if (!Object.values(THEME_MODES).includes(mode)) {
      console.warn('Invalid theme mode:', mode);
      return;
    }

    try {
      // Haptic feedback for theme change
      await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);

      setThemeModeState(mode);
      await AsyncStorage.setItem(THEME_STORAGE_KEY, mode);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  }, []);

  // Toggle between light and dark (legacy support)
  const toggleDarkMode = useCallback(async () => {
    const newMode = isDarkMode ? THEME_MODES.LIGHT : THEME_MODES.DARK;
    await setThemeMode(newMode);
  }, [isDarkMode, setThemeMode]);

  // Cycle through all themes: Light -> Dark -> OLED -> Light
  const cycleTheme = useCallback(async () => {
    let nextMode;
    switch (themeMode) {
      case THEME_MODES.LIGHT:
        nextMode = THEME_MODES.DARK;
        break;
      case THEME_MODES.DARK:
        nextMode = THEME_MODES.OLED;
        break;
      case THEME_MODES.OLED:
        nextMode = THEME_MODES.LIGHT;
        break;
      case THEME_MODES.SYSTEM:
        nextMode = isDarkMode ? THEME_MODES.OLED : THEME_MODES.DARK;
        break;
      default:
        nextMode = THEME_MODES.LIGHT;
    }
    await setThemeMode(nextMode);
  }, [themeMode, isDarkMode, setThemeMode]);

  // Create legacy theme for backward compatibility
  const currentTheme = useMemo(() => createLegacyTheme(theme), [theme]);

  // Context value
  const contextValue = useMemo(() => ({
    theme,
    currentTheme, // Legacy support for existing screens
    themeMode,
    isDarkMode,
    isOledMode,
    setThemeMode,
    toggleDarkMode,
    cycleTheme,
    themeProgress,
    // Legacy support
    setIsDarkMode: (value) => setThemeMode(value ? THEME_MODES.DARK : THEME_MODES.LIGHT),
  }), [theme, currentTheme, themeMode, isDarkMode, isOledMode, setThemeMode, toggleDarkMode, cycleTheme, themeProgress]);

  if (isLoading) {
    return null; // Or a loading spinner
  }

  return (
    <ThemeContext.Provider value={contextValue}>
      {children}
    </ThemeContext.Provider>
  );
};

// Export for backwards compatibility
export { ThemeContext };
export default ThemeProvider;
