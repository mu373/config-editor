import { create } from 'zustand';

export interface TreeStoreState {
  // Tree UI state
  showPopulatedOnly: boolean;
  expandedTreePaths: Set<string>;
  selectedPath: string | null;

  // Shared form expansion state (synced with tree)
  expandedFormPaths: Set<string>;
  manuallyToggledFormPaths: Set<string>;
}

export interface TreeStoreActions {
  // Tree state
  setShowPopulatedOnly: (show: boolean) => void;
  toggleTreeNode: (path: string) => void;
  setSelectedPath: (path: string | null) => void;
  isTreeNodeExpanded: (path: string) => boolean;

  // Form expansion coordination
  isFormPathExpanded: (path: string, depth: number, globalLevel: number | 'all' | null) => boolean;
  toggleFormPath: (path: string) => void;
  expandFormAncestors: (path: string) => void;

  // Reset state (when schema changes)
  resetTreeState: () => void;
}

export type TreeStore = TreeStoreState & TreeStoreActions;

const initialState: TreeStoreState = {
  showPopulatedOnly: false,
  expandedTreePaths: new Set<string>(),
  selectedPath: null,
  expandedFormPaths: new Set<string>(),
  manuallyToggledFormPaths: new Set<string>(),
};

export const useTreeStore = create<TreeStore>((set, get) => ({
  ...initialState,

  setShowPopulatedOnly: (show) => {
    set({ showPopulatedOnly: show });
  },

  toggleTreeNode: (path) => {
    set((state) => {
      const newExpanded = new Set(state.expandedTreePaths);
      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }
      return { expandedTreePaths: newExpanded };
    });
  },

  setSelectedPath: (path) => {
    set({ selectedPath: path });
  },

  isTreeNodeExpanded: (path) => {
    return get().expandedTreePaths.has(path);
  },

  isFormPathExpanded: (path, depth, globalLevel) => {
    const state = get();

    // If manually toggled, use that state
    if (state.manuallyToggledFormPaths.has(path)) {
      return state.expandedFormPaths.has(path);
    }

    // Otherwise use global level default
    if (globalLevel === 'all') return true;
    if (globalLevel === null) return depth < 2; // default behavior
    return depth < globalLevel;
  },

  toggleFormPath: (path) => {
    set((state) => {
      const newManuallyToggled = new Set(state.manuallyToggledFormPaths);
      const newExpanded = new Set(state.expandedFormPaths);

      newManuallyToggled.add(path);

      if (newExpanded.has(path)) {
        newExpanded.delete(path);
      } else {
        newExpanded.add(path);
      }

      return {
        expandedFormPaths: newExpanded,
        manuallyToggledFormPaths: newManuallyToggled,
      };
    });
  },

  expandFormAncestors: (path) => {
    set((state) => {
      const newManuallyToggled = new Set(state.manuallyToggledFormPaths);
      const newExpanded = new Set(state.expandedFormPaths);
      const newTreeExpanded = new Set(state.expandedTreePaths);

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

        newManuallyToggled.add(ancestorPath);
        newExpanded.add(ancestorPath);
        newTreeExpanded.add(ancestorPath);
      }

      return {
        expandedFormPaths: newExpanded,
        manuallyToggledFormPaths: newManuallyToggled,
        expandedTreePaths: newTreeExpanded,
      };
    });
  },

  resetTreeState: () => {
    set(initialState);
  },
}));
