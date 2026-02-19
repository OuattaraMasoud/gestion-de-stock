import { create } from 'zustand';

export type ThemeMode = 'light' | 'dark' | 'system';

interface ThemeStore {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
  applyTheme: () => void;
}

const STORAGE_KEY = 'theme-mode';

let mediaQueryListener: ((e: MediaQueryListEvent) => void) | null = null;

const applyThemeToDOM = (mode: ThemeMode) => {
  const root = document.documentElement;
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;

  if (mode === 'dark' || (mode === 'system' && prefersDark)) {
    root.classList.add('dark');
  } else {
    root.classList.remove('dark');
  }
};

export const useThemeStore = create<ThemeStore>((set, get) => ({
  mode: (localStorage.getItem(STORAGE_KEY) as ThemeMode) || 'system',

  setMode: (mode: ThemeMode) => {
    localStorage.setItem(STORAGE_KEY, mode);
    set({ mode });

    // Remove old listener if switching away from system
    if (mediaQueryListener) {
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', mediaQueryListener);
      mediaQueryListener = null;
    }

    applyThemeToDOM(mode);

    // Listen to OS changes in system mode
    if (mode === 'system') {
      mediaQueryListener = () => applyThemeToDOM('system');
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', mediaQueryListener);
    }
  },

  applyTheme: () => {
    const mode = get().mode;

    // Remove old listener
    if (mediaQueryListener) {
      window.matchMedia('(prefers-color-scheme: dark)').removeEventListener('change', mediaQueryListener);
      mediaQueryListener = null;
    }

    applyThemeToDOM(mode);

    if (mode === 'system') {
      mediaQueryListener = () => applyThemeToDOM('system');
      window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', mediaQueryListener);
    }
  },
}));
