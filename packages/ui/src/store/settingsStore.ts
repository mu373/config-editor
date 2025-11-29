import { create } from 'zustand';

export type MonacoTheme = 'vs' | 'vs-dark' | 'hc-black' | 'hc-light';

// Active view types: 'editor' for file tabs, 'schemas' for schemas panel, 'settings' for settings panel
export type ActiveView = 'editor' | 'schemas' | 'settings';

const STORAGE_KEY = 'config-editor:settings';

interface Settings {
  monacoTheme: MonacoTheme;
}

interface SettingsStore {
  settings: Settings;
  activeView: ActiveView;
  schemasTabOpen: boolean;
  settingsTabOpen: boolean;
  setMonacoTheme: (theme: MonacoTheme) => void;
  setActiveView: (view: ActiveView) => void;
  openSchemasTab: () => void;
  closeSchemasTab: () => void;
  openSettingsTab: () => void;
  closeSettingsTab: () => void;
  hydrateFromStorage: () => void;
}

const defaultSettings: Settings = {
  monacoTheme: 'vs',
};

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  settings: defaultSettings,
  activeView: 'editor',
  schemasTabOpen: false,
  settingsTabOpen: false,

  setMonacoTheme: (theme) => {
    const newSettings = { ...get().settings, monacoTheme: theme };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(newSettings));
    set({ settings: newSettings });
  },

  setActiveView: (view) => set({ activeView: view }),

  openSchemasTab: () => set({ schemasTabOpen: true, activeView: 'schemas' }),

  closeSchemasTab: () => {
    const { settingsTabOpen } = get();
    set({
      schemasTabOpen: false,
      activeView: settingsTabOpen ? 'settings' : 'editor'
    });
  },

  openSettingsTab: () => set({ settingsTabOpen: true, activeView: 'settings' }),

  closeSettingsTab: () => {
    const { schemasTabOpen } = get();
    set({
      settingsTabOpen: false,
      activeView: schemasTabOpen ? 'schemas' : 'editor'
    });
  },

  hydrateFromStorage: () => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        set({ settings: { ...defaultSettings, ...JSON.parse(stored) } });
      }
    } catch (e) {
      console.error('Failed to load settings:', e);
    }
  },
}));
