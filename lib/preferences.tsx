import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { Language, TranslationKey, translations } from "../translations";

type MapTheme = "light" | "dark";
interface Preferences {
  language: Language;
  setLanguage: (value: Language) => void;
  mapTheme: MapTheme;
  setMapTheme: (value: MapTheme) => void;
  /** Replaces every {param} placeholder. */
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
  /** Translates an error code from services/store (err_<code>), falling back to a generic message. */
  tError: (code: string) => string;
  formatTime: (ms: number) => string;
  formatDateTime: (ms: number) => string;
}

const PreferencesContext = createContext<Preferences | undefined>(undefined);

function stored(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}
function store(key: string, value: string) {
  try {
    localStorage.setItem(key, value);
  } catch {
    /* Private mode: the preference lasts for this visit only. */
  }
}

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [language, setLang] = useState<Language>(() => {
    const saved = stored("runset_lang");
    if (saved === "it" || saved === "en") return saved;
    return navigator.language?.toLowerCase().startsWith("it") ? "it" : "en";
  });
  const [mapTheme, setTheme] = useState<MapTheme>(() => (stored("runset_map_theme") === "light" ? "light" : "dark"));

  const t = useCallback(
    (key: TranslationKey, params?: Record<string, string | number>) => {
      let value = translations[language][key] ?? key;
      for (const [name, replacement] of Object.entries(params ?? {}))
        value = value.split(`{${name}}`).join(String(replacement));
      return value;
    },
    [language],
  );

  const value = useMemo<Preferences>(() => {
    const locale = language === "it" ? "it-IT" : "en-GB";
    return {
      language,
      setLanguage: (next) => {
        setLang(next);
        store("runset_lang", next);
        document.documentElement.lang = next;
      },
      mapTheme,
      setMapTheme: (next) => {
        setTheme(next);
        store("runset_map_theme", next);
      },
      t,
      tError: (code) => {
        const key = `err_${code}` as TranslationKey;
        return key in translations[language] ? t(key) : t("err_generic");
      },
      formatTime: (ms) => new Date(ms).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" }),
      formatDateTime: (ms) =>
        new Date(ms).toLocaleString(locale, { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" }),
    };
  }, [language, mapTheme, t]);

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePrefs() {
  const context = useContext(PreferencesContext);
  if (!context) throw new Error("PreferencesProvider missing");
  return context;
}
