import React, { createContext, useState, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export const UserContext = createContext();

export const UserProvider = ({ children }) => {
  const [ghostMode, setGhostMode] = useState(false);

  useEffect(() => {
    const loadGhostMode = async () => {
      try {
        const stored = await AsyncStorage.getItem("ghostMode");
        if (stored !== null) {
          setGhostMode(JSON.parse(stored));
        }
      } catch (err) {
        console.error("Ошибка чтения ghostMode:", err);
      }
    };
    loadGhostMode();
  }, []);

  const toggleGhostMode = async () => {
    const newMode = !ghostMode;
    setGhostMode(newMode);
    try {
      await AsyncStorage.setItem('ghostMode', JSON.stringify(newMode));
    } catch (err) {
      console.error("Ошибка сохранения ghostMode:", err);
    }
  };

  return (
    <UserContext.Provider value={{ ghostMode, toggleGhostMode }}>
      {children}
    </UserContext.Provider>
  );
};