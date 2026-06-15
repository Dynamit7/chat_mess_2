// LanguageContext.js
import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import i18n from './i18n';

export const LanguageContext = createContext();

export const LanguageProvider = ({ children }) => {
  const [language, setLanguage] = useState('ru');

  useEffect(() => {
    const loadLanguage = async () => {
      const storedLang = await AsyncStorage.getItem('language');
      if (storedLang) {
        setLanguage(storedLang);
        i18n.changeLanguage(storedLang);
      }
    };
    loadLanguage();
  }, []);

  const changeLanguage = async (lang) => {
    setLanguage(lang);
    i18n.changeLanguage(lang);
    await AsyncStorage.setItem('language', lang);
  };

  return (
    <LanguageContext.Provider value={{ language, changeLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
};
