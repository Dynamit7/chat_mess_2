/**
 * ImageGeneratorScreen
 * AI image generation with DALL-E
 * Super-App Messenger 2026
 */

import React, { useState, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  Image,
  ScrollView,
  ActivityIndicator,
  Dimensions,
  Share,
  Alert,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { BlurView } from 'expo-blur';
import Animated, {
  FadeIn,
  FadeInDown,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

import { BASE_URL } from '../../src/config';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const IMAGE_SIZE = SCREEN_WIDTH - 32;

const STYLES = [
  { id: 'vivid', name: 'Vivid', icon: 'color-palette' },
  { id: 'natural', name: 'Natural', icon: 'leaf' },
];

const SIZES = [
  { id: '1024x1024', name: 'Square', ratio: '1:1' },
  { id: '1792x1024', name: 'Landscape', ratio: '16:9' },
  { id: '1024x1792', name: 'Portrait', ratio: '9:16' },
];

const QUALITY = [
  { id: 'standard', name: 'Standard' },
  { id: 'hd', name: 'HD' },
];

const EXAMPLE_PROMPTS = [
  'A serene Japanese garden at sunset with cherry blossoms',
  'Futuristic cyberpunk city with neon lights and flying cars',
  'Cute robot playing with a golden retriever puppy',
  'Abstract art with flowing colors and geometric shapes',
  'Cozy cabin in snowy mountains with northern lights',
];

const StyleOption = ({ style, isSelected, onSelect }) => {
  const scale = useSharedValue(1);

  const handlePress = () => {
    scale.value = withSpring(0.95, {}, () => {
      scale.value = withSpring(1);
    });
    onSelect(style);
  };

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View style={animatedStyle}>
      <TouchableOpacity
        style={[styles.optionButton, isSelected && styles.optionButtonSelected]}
        onPress={handlePress}
      >
        <Ionicons
          name={style.icon}
          size={20}
          color={isSelected ? '#fff' : 'rgba(255,255,255,0.6)'}
        />
        <Text style={[styles.optionText, isSelected && styles.optionTextSelected]}>
          {style.name}
        </Text>
      </TouchableOpacity>
    </Animated.View>
  );
};

const ImageGeneratorScreen = () => {
  const navigation = useNavigation();
  const insets = useSafeAreaInsets();

  const [prompt, setPrompt] = useState('');
  const [selectedStyle, setSelectedStyle] = useState(STYLES[0]);
  const [selectedSize, setSelectedSize] = useState(SIZES[0]);
  const [selectedQuality, setSelectedQuality] = useState(QUALITY[0]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [generatedImage, setGeneratedImage] = useState(null);
  const [revisedPrompt, setRevisedPrompt] = useState('');
  const [history, setHistory] = useState([]);

  const getToken = useCallback(async () => {
    return await AsyncStorage.getItem('token');
  }, []);

  const generateImage = useCallback(async () => {
    if (!prompt.trim()) {
      Alert.alert('Error', 'Please enter a prompt');
      return;
    }

    setIsGenerating(true);
    setGeneratedImage(null);

    try {
      const token = await getToken();
      const response = await fetch(`${BASE_URL}/api/ai/generate-image`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: prompt.trim(),
          size: selectedSize.id,
          quality: selectedQuality.id,
          style: selectedStyle.id,
        }),
      });

      const data = await response.json();

      if (response.ok && data.images?.[0]) {
        setGeneratedImage(data.images[0].url);
        setRevisedPrompt(data.images[0].revisedPrompt || '');
        setHistory(prev => [
          { prompt: prompt.trim(), image: data.images[0].url, timestamp: Date.now() },
          ...prev.slice(0, 9),
        ]);
      } else {
        Alert.alert('Error', data.error || 'Failed to generate image');
      }
    } catch (error) {
      console.error('Generation error:', error);
      Alert.alert('Error', 'Failed to generate image. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, [prompt, selectedSize, selectedQuality, selectedStyle, getToken]);

  const saveImage = useCallback(async () => {
    if (!generatedImage) return;

    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant access to save images');
        return;
      }

      const filename = `ai-image-${Date.now()}.png`;
      const fileUri = FileSystem.documentDirectory + filename;

      await FileSystem.downloadAsync(generatedImage, fileUri);
      await MediaLibrary.saveToLibraryAsync(fileUri);

      Alert.alert('Saved', 'Image saved to your gallery');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save image');
    }
  }, [generatedImage]);

  const shareImage = useCallback(async () => {
    if (!generatedImage) return;

    try {
      await Share.share({
        url: generatedImage,
        message: `Generated with AI: ${prompt}`,
      });
    } catch (error) {
      console.error('Share error:', error);
    }
  }, [generatedImage, prompt]);

  const useExamplePrompt = useCallback((examplePrompt) => {
    setPrompt(examplePrompt);
  }, []);

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => navigation.goBack()}
        >
          <Ionicons name="arrow-back" size={24} color="#fff" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>AI Image Generator</Text>
        <TouchableOpacity style={styles.headerButton}>
          <Ionicons name="time-outline" size={24} color="#fff" />
        </TouchableOpacity>
      </View>

      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {/* Generated Image */}
        {generatedImage ? (
          <Animated.View entering={FadeIn.duration(500)} style={styles.imageContainer}>
            <Image
              source={{ uri: generatedImage }}
              style={styles.generatedImage}
              resizeMode="cover"
            />
            {revisedPrompt && (
              <View style={styles.revisedPromptContainer}>
                <Text style={styles.revisedPromptLabel}>Revised prompt:</Text>
                <Text style={styles.revisedPromptText}>{revisedPrompt}</Text>
              </View>
            )}
            <View style={styles.imageActions}>
              <TouchableOpacity style={styles.imageAction} onPress={saveImage}>
                <Ionicons name="download-outline" size={24} color="#fff" />
                <Text style={styles.imageActionText}>Save</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageAction} onPress={shareImage}>
                <Ionicons name="share-outline" size={24} color="#fff" />
                <Text style={styles.imageActionText}>Share</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.imageAction} onPress={generateImage}>
                <Ionicons name="refresh-outline" size={24} color="#fff" />
                <Text style={styles.imageActionText}>Regenerate</Text>
              </TouchableOpacity>
            </View>
          </Animated.View>
        ) : isGenerating ? (
          <View style={styles.generatingContainer}>
            <LinearGradient
              colors={['#FF2D55', '#7C5CFF', '#5856D6']}
              style={styles.generatingGradient}
            >
              <ActivityIndicator size="large" color="#fff" />
              <Text style={styles.generatingText}>Creating your image...</Text>
              <Text style={styles.generatingSubtext}>This may take a few seconds</Text>
            </LinearGradient>
          </View>
        ) : (
          <View style={styles.placeholderContainer}>
            <LinearGradient
              colors={['rgba(255,45,85,0.2)', 'rgba(175,82,222,0.2)']}
              style={styles.placeholderGradient}
            >
              <Ionicons name="image-outline" size={64} color="rgba(255,255,255,0.3)" />
              <Text style={styles.placeholderText}>Your image will appear here</Text>
            </LinearGradient>
          </View>
        )}

        {/* Prompt Input */}
        <Animated.View entering={FadeInDown.delay(100)} style={styles.section}>
          <Text style={styles.sectionTitle}>Describe your image</Text>
          <View style={styles.promptInputContainer}>
            <TextInput
              style={styles.promptInput}
              placeholder="A serene mountain landscape at golden hour..."
              placeholderTextColor="rgba(255,255,255,0.4)"
              value={prompt}
              onChangeText={setPrompt}
              multiline
              maxLength={1000}
            />
            <Text style={styles.charCount}>{prompt.length}/1000</Text>
          </View>
        </Animated.View>

        {/* Example Prompts */}
        {!prompt && (
          <Animated.View entering={FadeInDown.delay(200)} style={styles.section}>
            <Text style={styles.sectionTitle}>Try these prompts</Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.examplesContainer}
            >
              {EXAMPLE_PROMPTS.map((example, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.exampleChip}
                  onPress={() => useExamplePrompt(example)}
                >
                  <Text style={styles.exampleText} numberOfLines={2}>
                    {example}
                  </Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </Animated.View>
        )}

        {/* Style Selection */}
        <Animated.View entering={FadeInDown.delay(300)} style={styles.section}>
          <Text style={styles.sectionTitle}>Style</Text>
          <View style={styles.optionsRow}>
            {STYLES.map((style) => (
              <StyleOption
                key={style.id}
                style={style}
                isSelected={selectedStyle.id === style.id}
                onSelect={setSelectedStyle}
              />
            ))}
          </View>
        </Animated.View>

        {/* Size Selection */}
        <Animated.View entering={FadeInDown.delay(400)} style={styles.section}>
          <Text style={styles.sectionTitle}>Size</Text>
          <View style={styles.optionsRow}>
            {SIZES.map((size) => (
              <TouchableOpacity
                key={size.id}
                style={[
                  styles.sizeOption,
                  selectedSize.id === size.id && styles.sizeOptionSelected,
                ]}
                onPress={() => setSelectedSize(size)}
              >
                <Text
                  style={[
                    styles.sizeText,
                    selectedSize.id === size.id && styles.sizeTextSelected,
                  ]}
                >
                  {size.name}
                </Text>
                <Text style={styles.sizeRatio}>{size.ratio}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        {/* Quality Selection */}
        <Animated.View entering={FadeInDown.delay(500)} style={styles.section}>
          <Text style={styles.sectionTitle}>Quality</Text>
          <View style={styles.optionsRow}>
            {QUALITY.map((q) => (
              <TouchableOpacity
                key={q.id}
                style={[
                  styles.qualityOption,
                  selectedQuality.id === q.id && styles.qualityOptionSelected,
                ]}
                onPress={() => setSelectedQuality(q)}
              >
                <Text
                  style={[
                    styles.qualityText,
                    selectedQuality.id === q.id && styles.qualityTextSelected,
                  ]}
                >
                  {q.name}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Animated.View>

        <View style={{ height: 100 }} />
      </ScrollView>

      {/* Generate Button */}
      <View style={[styles.generateContainer, { paddingBottom: insets.bottom + 16 }]}>
        <TouchableOpacity
          style={[styles.generateButton, isGenerating && styles.generateButtonDisabled]}
          onPress={generateImage}
          disabled={isGenerating || !prompt.trim()}
        >
          <LinearGradient
            colors={['#FF2D55', '#7C5CFF']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.generateGradient}
          >
            {isGenerating ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Ionicons name="sparkles" size={20} color="#fff" />
                <Text style={styles.generateText}>Generate Image</Text>
              </>
            )}
          </LinearGradient>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#000',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
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
  content: {
    flex: 1,
  },
  contentContainer: {
    padding: 16,
  },
  imageContainer: {
    borderRadius: 16,
    overflow: 'hidden',
    marginBottom: 24,
  },
  generatedImage: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 16,
  },
  revisedPromptContainer: {
    padding: 12,
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderBottomLeftRadius: 16,
    borderBottomRightRadius: 16,
  },
  revisedPromptLabel: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 12,
    marginBottom: 4,
  },
  revisedPromptText: {
    color: '#fff',
    fontSize: 13,
    lineHeight: 18,
  },
  imageActions: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: 16,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  imageAction: {
    alignItems: 'center',
    gap: 4,
  },
  imageActionText: {
    color: '#fff',
    fontSize: 12,
  },
  generatingContainer: {
    marginBottom: 24,
  },
  generatingGradient: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  generatingText: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
    marginTop: 16,
  },
  generatingSubtext: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    marginTop: 4,
  },
  placeholderContainer: {
    marginBottom: 24,
  },
  placeholderGradient: {
    width: IMAGE_SIZE,
    height: IMAGE_SIZE * 0.6,
    borderRadius: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderText: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 14,
    marginTop: 12,
  },
  section: {
    marginBottom: 24,
  },
  sectionTitle: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
    marginBottom: 12,
  },
  promptInputContainer: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    borderRadius: 12,
    padding: 16,
  },
  promptInput: {
    color: '#fff',
    fontSize: 15,
    minHeight: 80,
    textAlignVertical: 'top',
  },
  charCount: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 12,
    textAlign: 'right',
    marginTop: 8,
  },
  examplesContainer: {
    gap: 8,
  },
  exampleChip: {
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 12,
    width: 200,
  },
  exampleText: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 13,
    lineHeight: 18,
  },
  optionsRow: {
    flexDirection: 'row',
    gap: 12,
  },
  optionButton: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 12,
    gap: 8,
  },
  optionButtonSelected: {
    backgroundColor: '#FF2D55',
  },
  optionText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  optionTextSelected: {
    color: '#fff',
  },
  sizeOption: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  sizeOptionSelected: {
    backgroundColor: '#FF2D55',
  },
  sizeText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  sizeTextSelected: {
    color: '#fff',
  },
  sizeRatio: {
    color: 'rgba(255,255,255,0.4)',
    fontSize: 11,
    marginTop: 2,
  },
  qualityOption: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.1)',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  qualityOptionSelected: {
    backgroundColor: '#FF2D55',
  },
  qualityText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 14,
    fontWeight: '500',
  },
  qualityTextSelected: {
    color: '#fff',
  },
  generateContainer: {
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  generateButton: {
    borderRadius: 16,
    overflow: 'hidden',
  },
  generateButtonDisabled: {
    opacity: 0.6,
  },
  generateGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
    gap: 8,
  },
  generateText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
});

export default ImageGeneratorScreen;
