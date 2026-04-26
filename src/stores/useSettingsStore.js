import { create } from 'zustand';
import db from '../db/database.js';

const DEFAULT_SETTINGS = {
  id: 'user',
  globalCriteria: 75,
  theme: 'system',
  accentColor: '#2D6A4F',
  weekStartDay: 1,
  onboardingDone: false,
  language: 'en',
  semesterStartDate: null,
  semesterEndDate: null,
};

const useSettingsStore = create((set, get) => ({
  settings: DEFAULT_SETTINGS,
  loading: true,

  loadSettings: async () => {
    let settings = await db.settings.get('user');
    if (!settings) {
      settings = { ...DEFAULT_SETTINGS };
      await db.settings.put(settings);
    }
    // Ensure new fields exist on old records
    const merged = { ...DEFAULT_SETTINGS, ...settings };
    set({ settings: merged, loading: false });
    get().applyTheme(merged.theme);
  },

  updateSettings: async (updates) => {
    const current = get().settings;
    const newSettings = { ...current, ...updates };
    await db.settings.put(newSettings);
    set({ settings: newSettings });
    if (updates.theme !== undefined) {
      get().applyTheme(updates.theme);
    }
  },

  applyTheme: (theme) => {
    const root = document.documentElement;
    if (theme === 'dark') {
      root.setAttribute('data-theme', 'dark');
    } else if (theme === 'light') {
      root.removeAttribute('data-theme');
    } else {
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      if (prefersDark) root.setAttribute('data-theme', 'dark');
      else root.removeAttribute('data-theme');
    }
  },

  completeOnboarding: async () => {
    await get().updateSettings({ onboardingDone: true });
  }
}));

export default useSettingsStore;
