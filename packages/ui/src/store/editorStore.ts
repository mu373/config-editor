import { create } from 'zustand';
import type { JSONSchema } from '@config-editor/core';
import type { Format } from '@config-editor/core';

export interface Tab {
  id: string;
  fileName: string | null;
  content: string;
  format: Format;
  schema: JSONSchema | null;
  schemaId: string | null;
  isDirty: boolean;
}

// Special tab IDs for non-editor tabs
export const SCHEMAS_TAB_ID = '__schemas__';
export const SETTINGS_TAB_ID = '__settings__';

export interface EditorState {
  tabs: Tab[];
  activeTabId: string | null;
  // Order of all tabs including special tabs (schemas, settings)
  // If empty, tabs render in default order: editor tabs, then schemas, then settings
  tabOrder: string[];
}

export interface EditorActions {
  // Tab management
  addTab: (tab: Omit<Tab, 'id'>) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;
  reorderTabs: (fromId: string, toId: string) => void;
  addToTabOrder: (id: string) => void;
  removeFromTabOrder: (id: string) => void;

  // Current tab operations
  setContent: (content: string) => void;
  setFormat: (format: Format) => void;
  setSchema: (schema: JSONSchema | null, schemaId?: string | null) => void;
  setFileName: (fileName: string | null) => void;
  markClean: () => void;

  // Getters
  getActiveTab: () => Tab | undefined;
}

export type EditorStore = EditorState & EditorActions;

let tabIdCounter = 0;
const generateTabId = () => `tab-${++tabIdCounter}`;

let untitledCounter = 0;
const generateUntitledName = () => `Untitled-${++untitledCounter}`;

export const useEditorStore = create<EditorStore>((set, get) => ({
  tabs: [],
  activeTabId: null,
  tabOrder: [],

  addTab: (tabData) => {
    const id = generateTabId();
    const fileName = tabData.fileName ?? generateUntitledName();
    const newTab: Tab = { ...tabData, id, fileName };
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
      tabOrder: [...state.tabOrder, id],
    }));
    return id;
  },

  closeTab: (id) => {
    set((state) => {
      const tabIndex = state.tabs.findIndex((t) => t.id === id);
      if (tabIndex === -1) return state;

      const newTabs = state.tabs.filter((t) => t.id !== id);
      const newTabOrder = state.tabOrder.filter((tid) => tid !== id);
      let newActiveId = state.activeTabId;

      if (state.activeTabId === id) {
        if (newTabs.length === 0) {
          newActiveId = null;
        } else if (tabIndex >= newTabs.length) {
          newActiveId = newTabs[newTabs.length - 1].id;
        } else {
          newActiveId = newTabs[tabIndex].id;
        }
      }

      return { tabs: newTabs, activeTabId: newActiveId, tabOrder: newTabOrder };
    });
  },

  setActiveTab: (id) => {
    set({ activeTabId: id });
  },

  reorderTabs: (fromId, toId) => {
    set((state) => {
      const newTabOrder = [...state.tabOrder];
      const oldIndex = newTabOrder.indexOf(fromId);
      const newIndex = newTabOrder.indexOf(toId);
      if (oldIndex === -1 || newIndex === -1) return state;
      const [removed] = newTabOrder.splice(oldIndex, 1);
      newTabOrder.splice(newIndex, 0, removed);
      return { tabOrder: newTabOrder };
    });
  },

  addToTabOrder: (id) => {
    set((state) => {
      if (state.tabOrder.includes(id)) return state;
      return { tabOrder: [...state.tabOrder, id] };
    });
  },

  removeFromTabOrder: (id) => {
    set((state) => ({
      tabOrder: state.tabOrder.filter((tid) => tid !== id),
    }));
  },

  setContent: (content) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === state.activeTabId
          ? { ...tab, content, isDirty: true }
          : tab
      ),
    }));
  },

  setFormat: (format) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === state.activeTabId ? { ...tab, format } : tab
      ),
    }));
  },

  setSchema: (schema, schemaId = null) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === state.activeTabId ? { ...tab, schema, schemaId } : tab
      ),
    }));
  },

  setFileName: (fileName) => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === state.activeTabId ? { ...tab, fileName } : tab
      ),
    }));
  },

  markClean: () => {
    set((state) => ({
      tabs: state.tabs.map((tab) =>
        tab.id === state.activeTabId ? { ...tab, isDirty: false } : tab
      ),
    }));
  },

  getActiveTab: () => {
    const state = get();
    return state.tabs.find((t) => t.id === state.activeTabId);
  },
}));
