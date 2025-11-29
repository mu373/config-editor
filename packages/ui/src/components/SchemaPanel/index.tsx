import { useState, useCallback, useRef, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { SchemaForm, type GlobalExpandLevel } from './SchemaForm';
import { SchemaTreeSidebar } from './SchemaTreeSidebar';
import { ErrorBoundary } from '../ErrorBoundary';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { JSONSchema7 } from 'json-schema';
import { DocumentModel, type SchemaPreset } from '@config-editor/core';
import { useTreeStore } from '../../store/treeStore';
import { useDocumentData } from '../../hooks/useDocument';

interface SchemaPanelProps {
  document: DocumentModel | null;
  schemaId?: string | null;
  schemas?: SchemaPreset[];
  onSchemaChange?: (schemaId: string) => void;
}

export function SchemaPanel({
  document,
  schemaId,
  schemas,
  onSchemaChange,
}: SchemaPanelProps) {
  const [globalExpandLevel, setGlobalExpandLevel] = useState<GlobalExpandLevel>(1);

  // Subscribe to document data changes
  const documentData = useDocumentData(document);
  const schema = document?.getSchema() as JSONSchema7 | null;

  // Local form value for immediate UI updates (prevents input lag)
  const [localFormValue, setLocalFormValue] = useState(documentData);

  // Debounce timer for syncing local changes back to document
  const formChangeDebounceRef = useRef<NodeJS.Timeout>();

  // Sync document data to local form value when document changes externally (e.g., from Monaco)
  useEffect(() => {
    setLocalFormValue(documentData);
  }, [documentData]);

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      clearTimeout(formChangeDebounceRef.current);
    };
  }, []);

  // Handle form changes - update local state immediately, sync to document with debouncing
  const handleFormChange = useCallback(
    (newValue: Record<string, unknown>) => {
      if (!document) return;

      // Update local state immediately for responsive UI
      setLocalFormValue(newValue);

      // Debounce document updates to avoid excessive serialization and Monaco updates
      clearTimeout(formChangeDebounceRef.current);
      formChangeDebounceRef.current = setTimeout(() => {
        // Update document - this will automatically sync to Monaco via observer
        document.setData(newValue);
      }, 150); // 150ms debounce matches Monaco sync delay
    },
    [document]
  );

  const { expandFormAncestors } = useTreeStore();

  // Handle tree navigation
  const handleTreeNavigate = useCallback(
    (path: string, hasValue: boolean, isPlaceholder: boolean) => {
      if (isPlaceholder) {
        // TODO: Implement adding new dictionary key
        return;
      }

      // If field doesn't have value, add it with default
      if (!hasValue && schema) {
        // Navigate to path and add the field
        // This triggers by selecting in tree - the form will auto-add when we scroll
      }

      // Expand all ancestors in the form
      expandFormAncestors(path);

      // Scroll to element after DOM update
      requestAnimationFrame(() => {
        const element = globalThis.document.querySelector(`[data-field-path="${path}"]`);
        if (element) {
          // Custom fast scroll with ease-out curve
          const scrollContainer = element.closest('.overflow-auto, .overflow-y-auto');
          if (scrollContainer) {
            const elementRect = element.getBoundingClientRect();
            const containerRect = scrollContainer.getBoundingClientRect();
            const targetScrollTop = scrollContainer.scrollTop + elementRect.top - containerRect.top - 16; // 16px offset from top

            const startScrollTop = scrollContainer.scrollTop;
            const distance = targetScrollTop - startScrollTop;
            const duration = 200; // ms - fast scroll
            const startTime = performance.now();

            const easeOut = (t: number) => 1 - Math.pow(1 - t, 3); // cubic ease-out

            const animateScroll = (currentTime: number) => {
              const elapsed = currentTime - startTime;
              const progress = Math.min(elapsed / duration, 1);
              scrollContainer.scrollTop = startScrollTop + distance * easeOut(progress);

              if (progress < 1) {
                requestAnimationFrame(animateScroll);
              }
            };

            requestAnimationFrame(animateScroll);
          } else {
            // Fallback if no scroll container found
            element.scrollIntoView({ behavior: 'auto', block: 'start' });
          }

          // Add temporary highlight
          element.classList.add('tree-nav-highlight');
          setTimeout(() => element.classList.remove('tree-nav-highlight'), 1500);
        }
      });
    },
    [expandFormAncestors, schema]
  );

  return (
    <div className="h-full flex flex-col border-r border-border bg-background">
      <div className="flex items-center justify-between px-3 h-10 border-b border-border bg-muted">
        <div className="flex items-center gap-2 min-w-0">
          {schemas && schemas.length > 0 && onSchemaChange ? (
            <Select value={schemaId || ''} onValueChange={onSchemaChange}>
              <SelectTrigger
                size="sm"
                className="h-7 text-xs font-medium max-w-[180px] px-2 bg-background"
                title="Select schema"
              >
                <SelectValue placeholder="Select schema..." />
              </SelectTrigger>
              <SelectContent>
                {schemas.map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          ) : (
            <span className="text-sm font-medium text-foreground truncate">
              {schemas?.find((s) => s.id === schemaId)?.name || schemaId || 'Select schema...'}
            </span>
          )}
        </div>
        <Select
          value={globalExpandLevel === null ? 'auto' : String(globalExpandLevel)}
          onValueChange={(val) => {
            if (val === 'auto') {
              setGlobalExpandLevel(null);
            } else if (val === 'all') {
              setGlobalExpandLevel('all');
            } else {
              setGlobalExpandLevel(parseInt(val, 10));
            }
          }}
        >
          <SelectTrigger
            size="sm"
            className="h-7 text-xs px-2 text-muted-foreground bg-background"
            title="Expand level"
          >
            <SelectValue placeholder="Auto" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Auto</SelectItem>
            <SelectItem value="0">Root only</SelectItem>
            <SelectItem value="1">Level 1</SelectItem>
            <SelectItem value="2">Level 2</SelectItem>
            <SelectItem value="3">Level 3</SelectItem>
            <SelectItem value="all">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex-1 overflow-hidden">
        {schema ? (
          <ErrorBoundary
            fallback={
              <div className="p-4 text-sm text-destructive">
                Schema panel error. Please check console.
              </div>
            }
          >
            <PanelGroup direction="horizontal" autoSaveId="schema-panel-tree">
              <Panel defaultSize={30} minSize={15} maxSize={50}>
                <SchemaTreeSidebar
                  schema={schema}
                  value={localFormValue}
                  onNavigate={handleTreeNavigate}
                />
              </Panel>
              <PanelResizeHandle className="w-1 bg-border hover:bg-ring transition-colors cursor-col-resize" />
              <Panel defaultSize={70} minSize={50}>
                <div className="h-full overflow-auto [scrollbar-gutter:stable]">
                  <SchemaForm
                    schema={schema}
                    value={localFormValue}
                    onChange={handleFormChange}
                    globalExpandLevel={globalExpandLevel}
                  />
                </div>
              </Panel>
            </PanelGroup>
          </ErrorBoundary>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">No schema loaded</div>
        )}
      </div>
    </div>
  );
}

export { SchemaForm } from './SchemaForm';
export { FormField } from './FormField';
