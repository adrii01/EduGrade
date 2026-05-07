import React, { createContext, useContext, useEffect, useState } from 'react';
import { useAuth } from './AuthContext';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/src/firebase';

export type AppTheme = 'light' | 'dark';

interface ThemeContextType {
  theme: AppTheme;
  setTheme: (theme: AppTheme) => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const { profile } = useAuth();
  const [theme, setThemeState] = useState<AppTheme>('light');

  useEffect(() => {
    if (profile?.preferences?.theme) {
      setThemeState(profile.preferences.theme as AppTheme);
    } else {
      // Default to light mode
      setThemeState('light');
    }
  }, [profile]);

  useEffect(() => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  }, [theme]);

  const setTheme = async (newTheme: AppTheme) => {
    setThemeState(newTheme);
    if (profile?.uid) {
      try {
        await updateDoc(doc(db, 'teachers', profile.uid), {
          'preferences.theme': newTheme
        });
      } catch (error) {
        console.error("Error saving theme:", error);
      }
    }
  };

  return (
    <ThemeContext.Provider value={{ theme, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within a ThemeProvider');
  return context;
}
