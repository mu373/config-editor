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

export interface EditorState {
  tabs: Tab[];
  activeTabId: string | null;
}

export interface EditorActions {
  // Tab management
  addTab: (tab: Omit<Tab, 'id'>) => string;
  closeTab: (id: string) => void;
  setActiveTab: (id: string) => void;

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

export const useEditorStore = create<EditorStore>((set, get) => ({
  tabs: [],
  activeTabId: null,

  addTab: (tabData) => {
    const id = generateTabId();
    const newTab: Tab = { ...tabData, id };
    set((state) => ({
      tabs: [...state.tabs, newTab],
      activeTabId: id,
    }));
    return id;
  },

  closeTab: (id) => {
    set((state) => {
      const tabIndex = state.tabs.findIndex((t) => t.id === id);
      if (tabIndex === -1) return state;

      const newTabs = state.tabs.filter((t) => t.id !== id);
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

      return { tabs: newTabs, activeTabId: newActiveId };
    });
  },

  setActiveTab: (id) => {
    set({ activeTabId: id });
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
