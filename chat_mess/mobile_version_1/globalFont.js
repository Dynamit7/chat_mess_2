/**
 * Global premium typography — maps every <Text> / <TextInput> to the
 * matching Raleway weight file. Gives the whole app one elegant, consistent
 * typeface without touching individual components.
 */
import React from 'react';
import { Text, TextInput, StyleSheet, Platform } from 'react-native';

// fontWeight -> Raleway family name
const WEIGHT_TO_FAMILY = {
  '100': 'Raleway_100Thin',
  '200': 'Raleway_200ExtraLight',
  '300': 'Raleway_300Light',
  '400': 'Raleway_400Regular',
  '500': 'Raleway_500Medium',
  '600': 'Raleway_600SemiBold',
  '700': 'Raleway_700Bold',
  '800': 'Raleway_800ExtraBold',
  '900': 'Raleway_900Black',
  normal: 'Raleway_400Regular',
  bold: 'Raleway_700Bold',
};

const familyForWeight = (weight) =>
  WEIGHT_TO_FAMILY[String(weight)] || 'Raleway_400Regular';

const pickFamily = (style) => {
  const flat = StyleSheet.flatten(style) || {};
  // Respect explicitly-set non-Raleway custom fonts (e.g. Orbitron brand marks)
  if (flat.fontFamily && !String(flat.fontFamily).startsWith('Raleway')) {
    return null;
  }
  return familyForWeight(flat.fontWeight);
};

let patched = false;

export function applyGlobalFont() {
  if (patched) return;
  patched = true;

  const patch = (Component) => {
    const original = Component.render;
    if (!original) return;
    Component.render = function (...args) {
      const element = original.apply(this, args);
      if (!element) return element;
      const family = pickFamily(element.props.style);
      if (!family) return element;
      // StyleSheet.flatten converts array → flat object, safe for DOM spans on web
      const mergedStyle = StyleSheet.flatten([{ fontFamily: family }, element.props.style]);
      return React.cloneElement(element, { style: mergedStyle });
    };
  };

  patch(Text);
  patch(TextInput);
}
