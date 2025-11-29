import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEditorStore, defaultTreeState } from './editorStore';

const STORAGE_KEY = 'config-editor:tree';

export interface TreeStoreState {
  // Global tree UI state (not per-tab)
  showPopulatedOnly: boolean;
}

export interface TreeStoreActions {
  // Global state
  setShowPopulatedOnly: (show: boolean) => void;

  // Per-tab tree state (reads/writes to active tab)
  toggleTreeNode: (path: string) => void;
  setSelectedPath: (path: string | null) => void;
  isTreeNodeExpanded: (path: string) => boolean;

  // Per-tab form expansion coordination
  isFormPathExpanded: (path: string, depth: number, globalLevel: number | 'all' | null) => boolean;
  toggleFormPath: (path: string) => void;
  expandFormAncestors: (path: string) => void;

  // Reset state (when schema changes)
  resetTreeState: () => void;
}

export type TreeStore = TreeStoreState & TreeStoreActions;

export const useTreeStore = create<TreeStore>()(
  persist(
    (set, get) => ({
      showPopulatedOnly: false,

      setShowPopulatedOnly: (show) => {
        set({ showPopulatedOnly: show });
      },

      toggleTreeNode: (path) => {
        const editorStore = useEditorStore.getState();
        const treeState = editorStore.getActiveTabTreeState();
        const expanded = new Set(treeState.expandedTreePaths);

        if (expanded.has(path)) {
          expanded.delete(path);
        } else {
          expanded.add(path);
        }

        editorStore.updateTreeState({
          expandedTreePaths: Array.from(expanded),
        });
      },

      setSelectedPath: (path) => {
        const editorStore = useEditorStore.getState();
        editorStore.updateTreeState({ selectedPath: path });
      },

      isTreeNodeExpanded: (path) => {
        const editorStore = useEditorStore.getState();
        const treeState = editorStore.getActiveTabTreeState();
        return treeState.expandedTreePaths.includes(path);
      },

      isFormPathExpanded: (path, depth, globalLevel) => {
        const editorStore = useEditorStore.getState();
        const treeState = editorStore.getActiveTabTreeState();

        // If manually toggled, use that state
        if (treeState.manuallyToggledFormPaths.includes(path)) {
          return treeState.expandedFormPaths.includes(path);
        }

        // Otherwise use global level default
        if (globalLevel === 'all') return true;
        if (globalLevel === null) return depth < 2; // default behavior
        return depth < globalLevel;
      },

      toggleFormPath: (path) => {
        const editorStore = useEditorStore.getState();
        const treeState = editorStore.getActiveTabTreeState();

        const manuallyToggled = new Set(treeState.manuallyToggledFormPaths);
        const expanded = new Set(treeState.expandedFormPaths);

        manuallyToggled.add(path);

        if (expanded.has(path)) {
          expanded.delete(path);
        } else {
          expanded.add(path);
        }

        editorStore.updateTreeState({
          expandedFormPaths: Array.from(expanded),
          manuallyToggledFormPaths: Array.from(manuallyToggled),
        });
      },

      expandFormAncestors: (path) => {
        const editorStore = useEditorStore.getState();
        const treeState = editorStore.getActiveTabTreeState();

        const manuallyToggled = new Set(treeState.manuallyToggledFormPaths);
        const expanded = new Set(treeState.expandedFormPaths);
        const treeExpanded = new Set(treeState.expandedTreePaths);

        // Parse path and expand each ancestor
        // Path format: "a.b[0].c" -> ancestors: "a", "a.b", "a.b[0]"
        const parts: string[] = [];
        let current = '';

        for (let i = 0; i < path.length; i++) {
          const char = path[i];
          if (char === '.' && current) {
            parts.push(current);
            current = '';
          } else if (char === '[') {
            if (current) parts.push(current);
            current = '[';
          } else if (char === ']') {
            current += ']';
            parts.push(current);
            current = '';
          } else {
            current += char;
          }
        }
        if (current) parts.push(current);

        // Build ancestor paths and include the target path itself
        let ancestorPath = '';
        for (let i = 0; i < parts.length; i++) {
          const part = parts[i];
          if (part.startsWith('[')) {
            ancestorPath += part;
          } else {
            ancestorPath = ancestorPath ? `${ancestorPath}.${part}` : part;
          }

          manuallyToggled.add(ancestorPath);
          expanded.add(ancestorPath);
          treeExpanded.add(ancestorPath);
        }

        editorStore.updateTreeState({
          expandedFormPaths: Array.from(expanded),
          manuallyToggledFormPaths: Array.from(manuallyToggled),
          expandedTreePaths: Array.from(treeExpanded),
        });
      },

      resetTreeState: () => {
        const editorStore = useEditorStore.getState();
        editorStore.updateTreeState({ ...defaultTreeState });
      },
    }),
    {
      name: STORAGE_KEY,
      partialize: (state) => ({
        showPopulatedOnly: state.showPopulatedOnly,
      }),
    }
  )
);

// Selector hooks for reactive updates from editorStore's active tab
export const useSelectedPath = () => {
  const activeTab = useEditorStore((state) =>
    state.tabs.find((t) => t.id === state.activeTabId)
  );
  return activeTab?.treeState.selectedPath ?? null;
};

export const useExpandedTreePaths = () => {
  const activeTab = useEditorStore((state) =>
    state.tabs.find((t) => t.id === state.activeTabId)
  );
  return new Set(activeTab?.treeState.expandedTreePaths ?? []);
};

export const useExpandedFormPaths = () => {
  const activeTab = useEditorStore((state) =>
    state.tabs.find((t) => t.id === state.activeTabId)
  );
  return new Set(activeTab?.treeState.expandedFormPaths ?? []);
};

export const useManuallyToggledFormPaths = () => {
  const activeTab = useEditorStore((state) =>
    state.tabs.find((t) => t.id === state.activeTabId)
  );
  return new Set(activeTab?.treeState.manuallyToggledFormPaths ?? []);
};
