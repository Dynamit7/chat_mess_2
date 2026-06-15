/**
 * PollCreator Component
 * Create polls and quizzes in chats
 * Super-App Messenger 2026
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ScrollView,
  Switch,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeInDown,
  FadeOutDown,
  Layout,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { BASE_URL } from '../../src/config';

const MAX_OPTIONS = 10;
const MIN_OPTIONS = 2;

const OptionInput = ({ index, value, onChange, onRemove, isCorrect, onSetCorrect, showCorrect, canRemove }) => {
  return (
    <Animated.View
      entering={FadeInDown.duration(200)}
      exiting={FadeOutDown.duration(200)}
      layout={Layout.springify()}
      style={styles.optionContainer}
    >
      <View style={styles.optionNumber}>
        <Text style={styles.optionNumberText}>{index + 1}</Text>
      </View>
      <TextInput
        style={styles.optionInput}
        placeholder={`Option ${index + 1}`}
        placeholderTextColor="rgba(255,255,255,0.4)"
        value={value}
        onChangeText={onChange}
        maxLength={100}
      />
      {showCorrect && (
        <TouchableOpacity
          style={[styles.correctButton, isCorrect && styles.correctButtonActive]}
          onPress={onSetCorrect}
        >
          <Ionicons
            name={isCorrect ? 'checkmark-circle' : 'checkmark-circle-outline'}
            size={24}
            color={isCorrect ? '#34C759' : 'rgba(255,255,255,0.3)'}
          />
        </TouchableOpacity>
      )}
      {canRemove && (
        <TouchableOpacity style={styles.removeButton} onPress={onRemove}>
          <Ionicons name="close-circle" size={24} color="rgba(255,255,255,0.3)" />
        </TouchableOpacity>
      )}
    </Animated.View>
  );
};

const PollCreator = ({ chatId, groupId, channelId, onClose, onPollCreated }) => {
  const insets = useSafeAreaInsets();

  const [question, setQuestion] = useState('');
  const [options, setOptions] = useState(['', '']);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [allowMultipleAnswers, setAllowMultipleAnswers] = useState(false);
  const [isQuiz, setIsQuiz] = useState(false);
  const [correctOptionIndex, setCorrectOptionIndex] = useState(0);
  const [explanation, setExplanation] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleOptionChange = useCallback((index, value) => {
    setOptions(prev => {
      const newOptions = [...prev];
      newOptions[index] = value;
      return newOptions;
    });
  }, []);

  const handleAddOption = useCallback(() => {
    if (options.length < MAX_OPTIONS) {
      setOptions(prev => [...prev, '']);
    }
  }, [options.length]);

  const handleRemoveOption = useCallback((index) => {
    if (options.length > MIN_OPTIONS) {
      setOptions(prev => prev.filter((_, i) => i !== index));
      if (correctOptionIndex >= index && correctOptionIndex > 0) {
        setCorrectOptionIndex(prev => prev - 1);
      }
    }
  }, [options.length, correctOptionIndex]);

  const handleCreate = useCallback(async () => {
    // Validation
    if (!question.trim()) {
      Alert.alert('Error', 'Please enter a question');
      return;
    }

    const validOptions = options.filter(opt => opt.trim());
    if (validOptions.length < MIN_OPTIONS) {
      Alert.alert('Error', `Please add at least ${MIN_OPTIONS} options`);
      return;
    }

    if (isQuiz && !options[correctOptionIndex]?.trim()) {
      Alert.alert('Error', 'Please select a valid correct answer');
      return;
    }

    setIsCreating(true);

    try {
      const token = await AsyncStorage.getItem('token');
      const userId = await AsyncStorage.getItem('userId');
      const response = await fetch(`${BASE_URL}/api/polls`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          userId: userId ? Number(userId) : undefined,
          chatId,
          groupId,
          channelId,
          question: question.trim(),
          options: validOptions,
          isAnonymous,
          allowMultipleAnswers,
          isQuiz,
          correctOptionIndex: isQuiz ? correctOptionIndex : undefined,
          explanation: isQuiz ? explanation.trim() : undefined,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        onPollCreated?.(data.poll);
        onClose?.();
      } else {
        Alert.alert('Error', data.error || 'Failed to create poll');
      }
    } catch (error) {
      console.error('Error creating poll:', error);
      Alert.alert('Error', 'Failed to create poll');
    } finally {
      setIsCreating(false);
    }
  }, [
    question,
    options,
    isAnonymous,
    allowMultipleAnswers,
    isQuiz,
    correctOptionIndex,
    explanation,
    chatId,
    groupId,
    channelId,
    onPollCreated,
    onClose,
  ]);

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <BlurView intensity={90} tint="dark" style={styles.blurContainer}>
        {/* Header */}
        <View style={[styles.header, { paddingTop: insets.top + 12 }]}>
          <TouchableOpacity style={styles.headerButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#fff" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Create Poll</Text>
          <TouchableOpacity
            style={[styles.createButton, isCreating && styles.createButtonDisabled]}
            onPress={handleCreate}
            disabled={isCreating}
          >
            <Text style={styles.createButtonText}>
              {isCreating ? 'Creating...' : 'Create'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={styles.content}
          contentContainerStyle={styles.contentContainer}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Question */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Question</Text>
            <TextInput
              style={styles.questionInput}
              placeholder="Ask a question..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={question}
              onChangeText={setQuestion}
              multiline
              maxLength={300}
            />
            <Text style={styles.charCount}>{question.length}/300</Text>
          </View>

          {/* Options */}
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Options</Text>
              {isQuiz && (
                <Text style={styles.sectionHint}>Tap ✓ for correct answer</Text>
              )}
            </View>

            {options.map((option, index) => (
              <OptionInput
                key={index}
                index={index}
                value={option}
                onChange={(value) => handleOptionChange(index, value)}
                onRemove={() => handleRemoveOption(index)}
                isCorrect={isQuiz && correctOptionIndex === index}
                onSetCorrect={() => setCorrectOptionIndex(index)}
                showCorrect={isQuiz}
                canRemove={options.length > MIN_OPTIONS}
              />
            ))}

            {options.length < MAX_OPTIONS && (
              <TouchableOpacity style={styles.addOptionButton} onPress={handleAddOption}>
                <Ionicons name="add-circle-outline" size={22} color="#FF2D55" />
                <Text style={styles.addOptionText}>Add Option</Text>
              </TouchableOpacity>
            )}
          </View>

          {/* Quiz Explanation */}
          {isQuiz && (
            <Animated.View
              entering={FadeInDown.duration(200)}
              style={styles.section}
            >
              <Text style={styles.sectionTitle}>Explanation (optional)</Text>
              <TextInput
                style={styles.explanationInput}
                placeholder="Explain the correct answer..."
                placeholderTextColor="rgba(255,255,255,0.4)"
                value={explanation}
                onChangeText={setExplanation}
                multiline
                maxLength={200}
              />
            </Animated.View>
          )}

          {/* Settings */}
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Settings</Text>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="eye-off-outline" size={22} color="#fff" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Anonymous Voting</Text>
                  <Text style={styles.settingSubtitle}>Hide who voted for what</Text>
                </View>
              </View>
              <Switch
                value={isAnonymous}
                onValueChange={setIsAnonymous}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#FF2D55' }}
                thumbColor="#fff"
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="checkbox-outline" size={22} color="#fff" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Multiple Answers</Text>
                  <Text style={styles.settingSubtitle}>Allow selecting multiple options</Text>
                </View>
              </View>
              <Switch
                value={allowMultipleAnswers}
                onValueChange={setAllowMultipleAnswers}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#FF2D55' }}
                thumbColor="#fff"
                disabled={isQuiz}
              />
            </View>

            <View style={styles.settingRow}>
              <View style={styles.settingInfo}>
                <Ionicons name="school-outline" size={22} color="#fff" />
                <View style={styles.settingText}>
                  <Text style={styles.settingTitle}>Quiz Mode</Text>
                  <Text style={styles.settingSubtitle}>Mark one answer as correct</Text>
                </View>
              </View>
              <Switch
                value={isQuiz}
                onValueChange={(value) => {
                  setIsQuiz(value);
                  if (value) {
                    setAllowMultipleAnswers(false);
                  }
                }}
                trackColor={{ false: 'rgba(255,255,255,0.2)', true: '#FF2D55' }}
                thumbColor="#fff"
              />
            </View>
          </View>
        </ScrollView>
      </BlurView>
    </KeyboardAvoidingView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  blurContainer: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.1)',
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  createButton: {
    backgroundColor: '#FF2D55',
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 16,
  },
  createButtonDisabled: {
    opacity: 0.6,
  },
  createButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
    paddingBottom: 100,
  },
  section: {
    marginBottom: 24,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  sectionHint: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
  },
  questionInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 16,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 4,
  },
  optionContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
    gap: 8,
  },
  optionNumber: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,45,85,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionNumberText: {
    color: '#FF2D55',
    fontSize: 13,
    fontWeight: '600',
  },
  optionInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 14,
    color: '#fff',
    fontSize: 15,
  },
  correctButton: {
    padding: 4,
  },
  correctButtonActive: {
    backgroundColor: 'rgba(52,199,89,0.2)',
    borderRadius: 12,
  },
  removeButton: {
    padding: 4,
  },
  addOptionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    gap: 8,
  },
  addOptionText: {
    color: '#FF2D55',
    fontSize: 15,
    fontWeight: '500',
  },
  explanationInput: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
    color: '#fff',
    fontSize: 15,
    minHeight: 60,
    textAlignVertical: 'top',
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: 'rgba(255,255,255,0.05)',
    padding: 16,
    borderRadius: 12,
    marginBottom: 8,
  },
  settingInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
  },
  settingText: {
    marginLeft: 12,
    flex: 1,
  },
  settingTitle: {
    color: '#fff',
    fontSize: 15,
    fontWeight: '500',
  },
  settingSubtitle: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginTop: 2,
  },
});

export default PollCreator;
