import { create } from 'zustand';
import { persist } from 'zustand/middleware';
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
  getSchemaById: (id: string) => SchemaPreset | undefined;
}

export type SchemaStore = SchemaStoreState & SchemaStoreActions;

export const useSchemaStore = create<SchemaStore>()(
  persist(
    (set, get) => ({
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
          return { schemas: newSchemas };
        });
      },

      updateSchema: (id, updates) => {
        set((state) => ({
          schemas: state.schemas.map((s) =>
            s.id === id ? { ...s, ...updates } : s
          ),
        }));
      },

      removeSchema: (id) => {
        set((state) => ({
          schemas: state.schemas.filter((s) => s.id !== id),
          selectedSchemaId:
            state.selectedSchemaId === id ? null : state.selectedSchemaId,
        }));
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
          return { schemas: newSchemas };
        });
      },

      setSchemas: (schemas) => {
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
          return { schemas: newSchemas };
        });
      },

      setSelectedSchemaId: (id) => {
        set({ selectedSchemaId: id });
      },

      getSchemaById: (id) => {
        return get().schemas.find((s) => s.id === id);
      },
    }),
    {
      name: STORAGE_KEY,
    }
  )
);
