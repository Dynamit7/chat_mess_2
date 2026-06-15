/**
 * AI Translation Service
 * Real-time message translation using OpenAI GPT-4
 */

const OpenAI = require('openai');
const crypto = require('crypto');

// Supported languages
const SUPPORTED_LANGUAGES = {
  en: 'English',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  it: 'Italian',
  pt: 'Portuguese',
  ru: 'Russian',
  zh: 'Chinese',
  ja: 'Japanese',
  ko: 'Korean',
  ar: 'Arabic',
  hi: 'Hindi',
  tr: 'Turkish',
  pl: 'Polish',
  nl: 'Dutch',
  sv: 'Swedish',
  da: 'Danish',
  fi: 'Finnish',
  no: 'Norwegian',
  cs: 'Czech',
  uk: 'Ukrainian',
  th: 'Thai',
  vi: 'Vietnamese',
  id: 'Indonesian',
  ms: 'Malay',
  he: 'Hebrew',
  el: 'Greek',
  ro: 'Romanian',
  hu: 'Hungarian',
  bg: 'Bulgarian',
};

class TranslationService {
  constructor() {
    this.openai = null;
    this.redisClient = null;
    this.cacheEnabled = true;
    this.cacheTTL = 86400; // 24 hours
  }

  /**
   * Initialize the service
   */
  async init() {
    // Initialize OpenAI
    if (process.env.OPENAI_API_KEY) {
      this.openai = new OpenAI({
        apiKey: process.env.OPENAI_API_KEY,
      });
      console.log('[Translation] OpenAI initialized');
    } else {
      console.warn('[Translation] OPENAI_API_KEY not set');
    }

    // Initialize Redis for caching
    try {
      const Redis = require('redis');
      this.redisClient = Redis.createClient({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
      });
      await this.redisClient.connect();
      console.log('[Translation] Redis cache connected');
    } catch (error) {
      console.warn('[Translation] Redis not available, caching disabled');
      this.cacheEnabled = false;
    }
  }

  /**
   * Generate cache key for translation
   */
  generateCacheKey(text, sourceLang, targetLang) {
    const hash = crypto.createHash('md5').update(text).digest('hex');
    return `translation:${hash}:${sourceLang}:${targetLang}`;
  }

  /**
   * Get cached translation
   */
  async getCached(text, sourceLang, targetLang) {
    if (!this.cacheEnabled || !this.redisClient) return null;

    try {
      const key = this.generateCacheKey(text, sourceLang, targetLang);
      const cached = await this.redisClient.get(key);
      return cached ? JSON.parse(cached) : null;
    } catch (error) {
      return null;
    }
  }

  /**
   * Cache translation result
   */
  async cacheTranslation(text, sourceLang, targetLang, translation) {
    if (!this.cacheEnabled || !this.redisClient) return;

    try {
      const key = this.generateCacheKey(text, sourceLang, targetLang);
      await this.redisClient.setEx(key, this.cacheTTL, JSON.stringify(translation));

      // Also save to database for persistence
      const { TranslationCache } = require('../models');
      const hash = crypto.createHash('md5').update(text).digest('hex');

      await TranslationCache.findOrCreate({
        where: {
          messageHash: hash,
          sourceLanguage: sourceLang,
          targetLanguage: targetLang,
        },
        defaults: {
          translatedText: translation.text,
        },
      });
    } catch (error) {
      console.error('[Translation] Cache error:', error.message);
    }
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text) {
    if (!this.openai) return 'en';

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: 'You are a language detection system. Respond with only the ISO 639-1 language code (e.g., "en", "es", "fr"). No explanation.',
          },
          {
            role: 'user',
            content: text,
          },
        ],
        max_tokens: 5,
        temperature: 0,
      });

      const detected = response.choices[0]?.message?.content?.trim().toLowerCase();
      return SUPPORTED_LANGUAGES[detected] ? detected : 'en';
    } catch (error) {
      console.error('[Translation] Language detection failed:', error.message);
      return 'en';
    }
  }

  /**
   * Translate text
   */
  async translate(text, targetLang, sourceLang = null) {
    if (!text || !targetLang) {
      return { success: false, error: 'Missing required parameters' };
    }

    // Check if target language is supported
    if (!SUPPORTED_LANGUAGES[targetLang]) {
      return { success: false, error: 'Unsupported target language' };
    }

    // Detect source language if not provided
    if (!sourceLang) {
      sourceLang = await this.detectLanguage(text);
    }

    // Don't translate if same language
    if (sourceLang === targetLang) {
      return {
        success: true,
        text,
        sourceLang,
        targetLang,
        cached: false,
      };
    }

    // Check cache first
    const cached = await this.getCached(text, sourceLang, targetLang);
    if (cached) {
      return {
        success: true,
        ...cached,
        cached: true,
      };
    }

    // Translate using OpenAI
    if (!this.openai) {
      return { success: false, error: 'Translation service not available' };
    }

    try {
      const response = await this.openai.chat.completions.create({
        model: 'gpt-4-turbo',
        messages: [
          {
            role: 'system',
            content: `You are a professional translator. Translate the following text from ${SUPPORTED_LANGUAGES[sourceLang]} to ${SUPPORTED_LANGUAGES[targetLang]}. Maintain the original tone, style, and formatting. Only output the translation, no explanations.`,
          },
          {
            role: 'user',
            content: text,
          },
        ],
        temperature: 0.3,
        max_tokens: Math.min(text.length * 2, 4000),
      });

      const translatedText = response.choices[0]?.message?.content?.trim();

      if (!translatedText) {
        return { success: false, error: 'Translation failed' };
      }

      const result = {
        text: translatedText,
        sourceLang,
        targetLang,
        sourceLanguageName: SUPPORTED_LANGUAGES[sourceLang],
        targetLanguageName: SUPPORTED_LANGUAGES[targetLang],
      };

      // Cache the result
      await this.cacheTranslation(text, sourceLang, targetLang, result);

      return {
        success: true,
        ...result,
        cached: false,
      };
    } catch (error) {
      console.error('[Translation] Translation failed:', error.message);
      return { success: false, error: error.message };
    }
  }

  /**
   * Translate multiple texts (batch)
   */
  async translateBatch(texts, targetLang, sourceLang = null) {
    const results = await Promise.all(
      texts.map((text) => this.translate(text, targetLang, sourceLang))
    );
    return results;
  }

  /**
   * Stream translation (for real-time updates)
   */
  async *translateStream(text, targetLang, sourceLang = null) {
    if (!this.openai) {
      throw new Error('Translation service not available');
    }

    if (!sourceLang) {
      sourceLang = await this.detectLanguage(text);
    }

    if (sourceLang === targetLang) {
      yield text;
      return;
    }

    const stream = await this.openai.chat.completions.create({
      model: 'gpt-4-turbo',
      messages: [
        {
          role: 'system',
          content: `Translate from ${SUPPORTED_LANGUAGES[sourceLang]} to ${SUPPORTED_LANGUAGES[targetLang]}. Only output the translation.`,
        },
        {
          role: 'user',
          content: text,
        },
      ],
      stream: true,
      temperature: 0.3,
    });

    for await (const chunk of stream) {
      const content = chunk.choices[0]?.delta?.content;
      if (content) {
        yield content;
      }
    }
  }

  /**
   * Get supported languages
   */
  getSupportedLanguages() {
    return SUPPORTED_LANGUAGES;
  }
}

// Singleton instance
const translationService = new TranslationService();

module.exports = {
  TranslationService,
  translationService,
  init: () => translationService.init(),
  translate: (text, targetLang, sourceLang) => translationService.translate(text, targetLang, sourceLang),
  translateBatch: (texts, targetLang, sourceLang) => translationService.translateBatch(texts, targetLang, sourceLang),
  translateStream: (text, targetLang, sourceLang) => translationService.translateStream(text, targetLang, sourceLang),
  detectLanguage: (text) => translationService.detectLanguage(text),
  getSupportedLanguages: () => translationService.getSupportedLanguages(),
};
