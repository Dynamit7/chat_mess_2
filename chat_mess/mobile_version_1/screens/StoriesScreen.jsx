import React from 'react';
import { View, Text, ScrollView, StyleSheet } from 'react-native';
import Stories from '../components/stories/Stories';
import { useTheme } from '../ThemeContext';
import { LinearGradient } from 'expo-linear-gradient';

export default function StoriesScreen() {
  const { isDarkMode } = useTheme();

  return (
    <View style={[styles.container, { backgroundColor: isDarkMode ? '#0B0F19' : '#FFFFFF' }]}>
      {/* Decorative top accent */}
      <LinearGradient
        colors={['#7C5CFF', '#9070FF', '#FF6B9D']}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={styles.topAccent}
      />

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollContent}
      >
        {/* Section header */}
        <View style={styles.headerSection}>
          <Text style={[styles.headerTitle, { color: isDarkMode ? '#fff' : '#121826' }]}>
            Stories
          </Text>
          <Text style={[styles.headerSubtitle, { color: isDarkMode ? '#AD94FF' : '#7C5CFF' }]}>
            Share your moments
          </Text>
        </View>

        <Stories />
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topAccent: {
    height: 3,
    width: '100%',
  },
  scrollContent: {
    paddingBottom: 30,
  },
  headerSection: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 8,
  },
  headerTitle: {
    fontSize: 28,
    fontWeight: '800',
    letterSpacing: 0.5,
  },
  headerSubtitle: {
    fontSize: 14,
    marginTop: 2,
    fontWeight: '500',
  },
});
