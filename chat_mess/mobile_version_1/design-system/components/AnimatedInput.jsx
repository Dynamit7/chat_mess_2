/**
 * AnimatedInput - Modern input with animations
 * Floating label, focus effects, validation states
 */

import React, { useState, useRef, useCallback } from 'react';
import { View, TextInput, StyleSheet, Text, TouchableOpacity } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  interpolateColor,
} from 'react-native-reanimated';
import { MaterialCommunityIcons } from '@expo/vector-icons';
import { useTheme } from '../../ThemeContext';
import { timingConfigs, spring } from '../tokens/animations';
import { spacing, borderRadius } from '../tokens/spacing';
import { textStyles } from '../tokens/typography';
import { palette, lightTheme, darkTheme } from '../tokens/colors';
import { shadows } from '../tokens/shadows';

const AnimatedTextInput = Animated.createAnimatedComponent(TextInput);

export const AnimatedInput = ({
  label,
  placeholder,
  value,
  onChangeText,
  onFocus,
  onBlur,
  error,
  helperText,
  leftIcon,
  rightIcon,
  onRightIconPress,
  secureTextEntry = false,
  multiline = false,
  variant = 'outlined', // 'outlined', 'filled', 'underlined'
  size = 'md', // 'sm', 'md', 'lg'
  disabled = false,
  required = false,
  maxLength,
  keyboardType = 'default',
  autoCapitalize = 'sentences',
  autoCorrect = true,
  style,
  inputStyle,
  ...props
}) => {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? darkTheme : lightTheme;
  const inputRef = useRef(null);

  // States
  const [isFocused, setIsFocused] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Animation values
  const focusAnim = useSharedValue(0);
  const labelAnim = useSharedValue(value ? 1 : 0);
  const shakeAnim = useSharedValue(0);

  // Size configurations
  const sizeConfig = {
    sm: { height: 44, fontSize: 14, labelSize: 12, iconSize: 18 },
    md: { height: 52, fontSize: 16, labelSize: 14, iconSize: 20 },
    lg: { height: 60, fontSize: 18, labelSize: 16, iconSize: 24 },
  };

  const currentSize = sizeConfig[size] || sizeConfig.md;

  // Handle focus
  const handleFocus = useCallback((e) => {
    setIsFocused(true);
    focusAnim.value = withTiming(1, timingConfigs.microInteraction);
    labelAnim.value = withTiming(1, timingConfigs.microInteraction);
    onFocus?.(e);
  }, [onFocus]);

  // Handle blur
  const handleBlur = useCallback((e) => {
    setIsFocused(false);
    focusAnim.value = withTiming(0, timingConfigs.microInteraction);
    if (!value) {
      labelAnim.value = withTiming(0, timingConfigs.microInteraction);
    }
    onBlur?.(e);
  }, [value, onBlur]);

  // Shake animation for error
  const triggerShake = useCallback(() => {
    shakeAnim.value = withSpring(1, { damping: 2, stiffness: 400 }, () => {
      shakeAnim.value = withSpring(0);
    });
  }, []);

  // Call shake on error
  React.useEffect(() => {
    if (error) {
      triggerShake();
    }
  }, [error]);

  // Get colors based on state
  const getBorderColor = () => {
    if (error) return palette.error.main;
    if (isFocused) return palette.primary[500];
    return theme.border.medium;
  };

  const getLabelColor = () => {
    if (error) return palette.error.main;
    if (isFocused) return palette.primary[500];
    return theme.text.secondary;
  };

  // Animated styles
  const containerAnimatedStyle = useAnimatedStyle(() => {
    const shake = interpolate(
      shakeAnim.value,
      [0, 0.25, 0.5, 0.75, 1],
      [0, -10, 10, -10, 0]
    );

    return {
      transform: [{ translateX: shake }],
    };
  });

  const labelAnimatedStyle = useAnimatedStyle(() => {
    const translateY = interpolate(labelAnim.value, [0, 1], [0, -28]);
    const scale = interpolate(labelAnim.value, [0, 1], [1, 0.85]);
    const translateX = interpolate(labelAnim.value, [0, 1], [0, leftIcon ? -28 : 0]);

    return {
      transform: [
        { translateY },
        { scale },
        { translateX },
      ],
    };
  });

  const borderAnimatedStyle = useAnimatedStyle(() => {
    const borderWidth = interpolate(focusAnim.value, [0, 1], [1, 2]);

    return {
      borderWidth,
    };
  });

  // Variant styles
  const getVariantStyles = () => {
    switch (variant) {
      case 'filled':
        return {
          backgroundColor: isDarkMode ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)',
          borderWidth: 0,
          borderBottomWidth: 2,
          borderRadius: borderRadius.md,
          borderBottomLeftRadius: 0,
          borderBottomRightRadius: 0,
        };
      case 'underlined':
        return {
          backgroundColor: 'transparent',
          borderWidth: 0,
          borderBottomWidth: 2,
          borderRadius: 0,
        };
      case 'outlined':
      default:
        return {
          backgroundColor: 'transparent',
          borderWidth: 1,
          borderRadius: borderRadius.md,
        };
    }
  };

  const variantStyles = getVariantStyles();

  return (
    <Animated.View style={[styles.wrapper, containerAnimatedStyle, style]}>
      {/* Input container */}
      <Animated.View
        style={[
          styles.container,
          variantStyles,
          {
            height: multiline ? undefined : currentSize.height,
            minHeight: multiline ? currentSize.height * 2 : undefined,
            borderColor: getBorderColor(),
          },
          borderAnimatedStyle,
        ]}
      >
        {/* Left icon */}
        {leftIcon && (
          <View style={styles.leftIcon}>
            <MaterialCommunityIcons
              name={leftIcon}
              size={currentSize.iconSize}
              color={isFocused ? palette.primary[500] : theme.text.tertiary}
            />
          </View>
        )}

        {/* Input field */}
        <AnimatedTextInput
          ref={inputRef}
          style={[
            styles.input,
            {
              fontSize: currentSize.fontSize,
              color: theme.text.primary,
              paddingLeft: leftIcon ? spacing[10] : spacing[4],
              paddingRight: rightIcon || secureTextEntry ? spacing[10] : spacing[4],
            },
            inputStyle,
          ]}
          value={value}
          onChangeText={onChangeText}
          onFocus={handleFocus}
          onBlur={handleBlur}
          placeholder={isFocused || labelAnim.value === 1 ? placeholder : ''}
          placeholderTextColor={theme.text.tertiary}
          secureTextEntry={secureTextEntry && !showPassword}
          editable={!disabled}
          multiline={multiline}
          maxLength={maxLength}
          keyboardType={keyboardType}
          autoCapitalize={autoCapitalize}
          autoCorrect={autoCorrect}
          {...props}
        />

        {/* Floating label */}
        {label && (
          <Animated.View
            style={[
              styles.labelContainer,
              { left: leftIcon ? spacing[10] : spacing[4] },
              labelAnimatedStyle,
            ]}
            pointerEvents="none"
          >
            <View style={[
              styles.labelBackground,
              { backgroundColor: variant === 'outlined' ? theme.background.primary : 'transparent' },
            ]}>
              <Text style={[styles.label, { color: getLabelColor(), fontSize: currentSize.labelSize }]}>
                {label}
                {required && <Text style={{ color: palette.error.main }}> *</Text>}
              </Text>
            </View>
          </Animated.View>
        )}

        {/* Right icon / Password toggle */}
        {(rightIcon || secureTextEntry) && (
          <TouchableOpacity
            style={styles.rightIcon}
            onPress={() => {
              if (secureTextEntry) {
                setShowPassword(!showPassword);
              } else {
                onRightIconPress?.();
              }
            }}
          >
            <MaterialCommunityIcons
              name={secureTextEntry ? (showPassword ? 'eye-off' : 'eye') : rightIcon}
              size={currentSize.iconSize}
              color={theme.text.tertiary}
            />
          </TouchableOpacity>
        )}
      </Animated.View>

      {/* Helper text / Error message */}
      {(helperText || error || maxLength) && (
        <View style={styles.helperContainer}>
          <Text
            style={[
              styles.helperText,
              { color: error ? palette.error.main : theme.text.tertiary },
            ]}
          >
            {error || helperText}
          </Text>
          {maxLength && (
            <Text style={[styles.counter, { color: theme.text.tertiary }]}>
              {value?.length || 0}/{maxLength}
            </Text>
          )}
        </View>
      )}
    </Animated.View>
  );
};

// Search input variant
export const SearchInput = ({
  value,
  onChangeText,
  placeholder = 'Search...',
  onClear,
  style,
  ...props
}) => {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <AnimatedInput
      value={value}
      onChangeText={onChangeText}
      placeholder={placeholder}
      leftIcon="magnify"
      rightIcon={value ? 'close-circle' : undefined}
      onRightIconPress={onClear}
      variant="filled"
      size="sm"
      style={style}
      {...props}
    />
  );
};

// Chat input variant
export const ChatInput = ({
  value,
  onChangeText,
  onSend,
  onAttach,
  placeholder = 'Type a message...',
  style,
  ...props
}) => {
  const { isDarkMode } = useTheme();
  const theme = isDarkMode ? darkTheme : lightTheme;

  return (
    <View style={[styles.chatInputContainer, style]}>
      <TouchableOpacity style={styles.attachButton} onPress={onAttach}>
        <MaterialCommunityIcons name="plus" size={24} color={palette.primary[500]} />
      </TouchableOpacity>

      <View style={styles.chatInputWrapper}>
        <AnimatedInput
          value={value}
          onChangeText={onChangeText}
          placeholder={placeholder}
          variant="filled"
          size="sm"
          multiline
          style={{ flex: 1, marginBottom: 0 }}
          {...props}
        />
      </View>

      <TouchableOpacity
        style={[styles.sendButton, { opacity: value ? 1 : 0.5 }]}
        onPress={onSend}
        disabled={!value}
      >
        <MaterialCommunityIcons name="send" size={24} color="#FFFFFF" />
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: spacing[4],
  },
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    position: 'relative',
  },
  input: {
    flex: 1,
    paddingVertical: spacing[3],
  },
  labelContainer: {
    position: 'absolute',
    top: '50%',
    marginTop: -10,
  },
  labelBackground: {
    paddingHorizontal: spacing[1],
  },
  label: {
    fontWeight: '500',
  },
  leftIcon: {
    position: 'absolute',
    left: spacing[3],
    zIndex: 1,
  },
  rightIcon: {
    position: 'absolute',
    right: spacing[3],
    zIndex: 1,
  },
  helperContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: spacing[1],
    paddingHorizontal: spacing[1],
  },
  helperText: {
    fontSize: 12,
    flex: 1,
  },
  counter: {
    fontSize: 12,
    marginLeft: spacing[2],
  },
  chatInputContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[2],
  },
  attachButton: {
    width: 44,
    height: 44,
    justifyContent: 'center',
    alignItems: 'center',
  },
  chatInputWrapper: {
    flex: 1,
    marginHorizontal: spacing[2],
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: palette.primary[500],
    justifyContent: 'center',
    alignItems: 'center',
  },
});

export default AnimatedInput;
