import { useState, useCallback, useRef } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import axios from 'axios';
import { BASE_URL } from '../src/config';

export default function useTranslateMessage() {
  // Map of messageId -> { text, loading, error }
  const [translations, setTranslations] = useState({});
  const translationsRef = useRef(translations);
  translationsRef.current = translations;

  const translateMessage = useCallback(async (messageId, text) => {
    if (!text) return;

    const existing = translationsRef.current[messageId];

    // Toggle off if already has translation or error
    if (existing?.text || existing?.error) {
      setTranslations(prev => {
        const next = { ...prev };
        delete next[messageId];
        return next;
      });
      return;
    }

    // Don't start another request if already loading
    if (existing?.loading) return;

    setTranslations(prev => ({
      ...prev,
      [messageId]: { text: null, loading: true, error: null },
    }));

    try {
      const userId = await AsyncStorage.getItem('userId');
      const lang = await AsyncStorage.getItem('preferredTranslateLang') || 'ru';

      const res = await axios.post(`${BASE_URL}/api/users/translate`, {
        userId, text, targetLang: lang,
      });

      setTranslations(prev => ({
        ...prev,
        [messageId]: { text: res.data.translatedText, loading: false, error: null },
      }));
    } catch (err) {
      const errorMsg = err.response?.data?.error || 'Ошибка перевода';
      setTranslations(prev => ({
        ...prev,
        [messageId]: { text: null, loading: false, error: errorMsg },
      }));
    }
  }, []);

  return { translations, translateMessage };
}
