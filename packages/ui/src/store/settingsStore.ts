import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type MonacoTheme = 'vs' | 'vs-dark' | 'hc-black' | 'hc-light' | 'monokai' | 'dracula' | 'solarized-dark' | 'solarized-light';

// Tailwind color palettes for accent color
export type AccentColor = 'slate' | 'gray' | 'zinc' | 'neutral' | 'stone' | 'red' | 'orange' | 'amber' | 'yellow' | 'lime' | 'green' | 'emerald' | 'teal' | 'cyan' | 'sky' | 'blue' | 'indigo' | 'violet' | 'purple' | 'fuchsia' | 'pink' | 'rose';

// Active view types: 'editor' for file tabs, 'schemas' for schemas panel, 'settings' for settings panel
export type ActiveView = 'editor' | 'schemas' | 'settings';

const STORAGE_KEY = 'config-editor:settings';

interface Settings {
  monacoTheme: MonacoTheme;
  jsonIncludeComments: boolean;
  accentColor: AccentColor;
}

interface SettingsStore {
  settings: Settings;
  activeView: ActiveView;
  schemasTabOpen: boolean;
  settingsTabOpen: boolean;
  setMonacoTheme: (theme: MonacoTheme) => void;
  setJsonIncludeComments: (value: boolean) => void;
  setAccentColor: (color: AccentColor) => void;
  setActiveView: (view: ActiveView) => void;
  openSchemasTab: () => void;
  closeSchemasTab: () => void;
  openSettingsTab: () => void;
  closeSettingsTab: () => void;
}

const defaultSettings: Settings = {
  monacoTheme: 'vs',
  jsonIncludeComments: false,
  accentColor: 'sky',
};

export const useSettingsStore = create<SettingsStore>()(
  persist(
    (set, get) => ({
      settings: defaultSettings,
      activeView: 'editor',
      schemasTabOpen: false,
      settingsTabOpen: false,

      setMonacoTheme: (theme) => {
        set({ settings: { ...get().settings, monacoTheme: theme } });
      },

      setJsonIncludeComments: (value) => {
        set({ settings: { ...get().settings, jsonIncludeComments: value } });
      },

      setAccentColor: (color) => {
        set({ settings: { ...get().settings, accentColor: color } });
        // Update the CSS custom property for accent color
        document.documentElement.dataset.accent = color;
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
    }),
    {
      name: STORAGE_KEY,
      onRehydrateStorage: () => (state) => {
        if (state) {
          // Apply accent color on load
          document.documentElement.dataset.accent = state.settings.accentColor;
        } else {
          // Apply default accent color
          document.documentElement.dataset.accent = defaultSettings.accentColor;
        }
      },
    }
  )
);
