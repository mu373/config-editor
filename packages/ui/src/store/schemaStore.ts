import { create } from 'zustand';
import type { SchemaPreset } from '@config-editor/core';

const STORAGE_KEY = 'config-editor:schemas';

export interface SchemaStoreState {
  schemas: SchemaPreset[];
  selectedSchemaId: string | null;
}

export interface SchemaStoreActions {
  addSchema: (schema: SchemaPreset) => void;
  updateSchema: (id: string, updates: Partial<SchemaPreset>) => void;
  removeSchema: (id: string) => void;
  reorderSchema: (fromIndex: number, toIndex: number) => void;
  setSchemas: (schemas: SchemaPreset[]) => void;
  mergeBundledSchemas: (bundled: SchemaPreset[]) => void;
  setSelectedSchemaId: (id: string | null) => void;
  hydrateFromStorage: () => void;
}

export type SchemaStore = SchemaStoreState & SchemaStoreActions;

function saveToStorage(schemas: SchemaPreset[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(schemas));
  } catch (e) {
    console.error('Failed to save schemas to localStorage:', e);
  }
}

function loadFromStorage(): SchemaPreset[] {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      return JSON.parse(stored);
    }
  } catch (e) {
    console.error('Failed to load schemas from localStorage:', e);
  }
  return [];
}

export const useSchemaStore = create<SchemaStore>((set, get) => ({
  schemas: [],
  selectedSchemaId: null,

  addSchema: (schema) => {
    set((state) => {
      const existing = state.schemas.findIndex((s) => s.id === schema.id);
      let newSchemas: SchemaPreset[];
      if (existing >= 0) {
        newSchemas = [...state.schemas];
        newSchemas[existing] = schema;
      } else {
        newSchemas = [...state.schemas, schema];
      }
      saveToStorage(newSchemas);
      return { schemas: newSchemas };
    });
  },

  updateSchema: (id, updates) => {
    set((state) => {
      const newSchemas = state.schemas.map((s) =>
        s.id === id ? { ...s, ...updates } : s
      );
      saveToStorage(newSchemas);
      return { schemas: newSchemas };
    });
  },

  removeSchema: (id) => {
    set((state) => {
      const newSchemas = state.schemas.filter((s) => s.id !== id);
      saveToStorage(newSchemas);
      return {
        schemas: newSchemas,
        selectedSchemaId:
          state.selectedSchemaId === id ? null : state.selectedSchemaId,
      };
    });
  },

  reorderSchema: (fromIndex, toIndex) => {
    set((state) => {
      if (
        fromIndex < 0 ||
        fromIndex >= state.schemas.length ||
        toIndex < 0 ||
        toIndex >= state.schemas.length ||
        fromIndex === toIndex
      ) {
        return state;
      }
      const newSchemas = [...state.schemas];
      const [removed] = newSchemas.splice(fromIndex, 1);
      newSchemas.splice(toIndex, 0, removed);
      saveToStorage(newSchemas);
      return { schemas: newSchemas };
    });
  },

  setSchemas: (schemas) => {
    saveToStorage(schemas);
    set({ schemas });
  },

  mergeBundledSchemas: (bundled) => {
    set((state) => {
      const existingIds = new Set(state.schemas.map((s) => s.id));
      const newSchemas = [...state.schemas];
      for (const schema of bundled) {
        if (!existingIds.has(schema.id)) {
          newSchemas.push(schema);
        }
      }
      saveToStorage(newSchemas);
      return { schemas: newSchemas };
    });
  },

  setSelectedSchemaId: (id) => {
    set({ selectedSchemaId: id });
  },

  hydrateFromStorage: () => {
    const stored = loadFromStorage();
    if (stored.length > 0) {
      set({ schemas: stored });
    }
  },
}));
