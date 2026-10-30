import React, { createContext, useContext, useEffect, useState } from 'react';
import type { SupportedLocale } from '../types/domain';
import { TRANSLATIONS } from './translations';

interface I18nContextValue {
  locale: SupportedLocale;
  dir: 'ltr' | 'rtl';
  setLocale: (locale: SupportedLocale) => void;
  toggleLocale: () => void;
  t: (key: string) => string;
}

const STORAGE_KEY = 'vion_ui_locale_v1';

const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: React.ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved === 'en' || saved === 'ar') {
        return saved;
      }
    } catch {
      // Ignore storage errors in restricted environments
    }
    return 'en'; // Default interface is English
  });

  const dir: 'ltr' | 'rtl' = locale === 'ar' ? 'rtl' : 'ltr';

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, locale);
    } catch {
      // Ignore storage errors
    }
    document.documentElement.lang = locale;
    document.documentElement.dir = dir;
  }, [locale, dir]);

  const setLocale = (nextLocale: SupportedLocale) => {
    setLocaleState(nextLocale);
  };

  const toggleLocale = () => {
    setLocaleState((prev) => (prev === 'en' ? 'ar' : 'en'));
  };

  const t = (key: string): string => {
    return TRANSLATIONS[locale][key] ?? TRANSLATIONS.en[key] ?? key;
  };

  return (
    <I18nContext.Provider value={{ locale, dir, setLocale, toggleLocale, t }}>
      {children}
    </I18nContext.Provider>
  );
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within an I18nProvider');
  }
  return context;
}
