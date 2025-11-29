import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { SchemaForm, type GlobalExpandLevel } from './SchemaForm';
import { SchemaTreeSidebar } from './SchemaTreeSidebar';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { JSONSchema7 } from 'json-schema';
import {
  parseYaml,
  stringifyYaml,
  parseJson,
  stringifyJson,
  parseJsonc,
  stringifyJsonc,
  updateYamlPreservingComments,
  updateJsonPreservingComments,
  type Format,
  type SchemaPreset,
} from '@config-editor/core';
import { useTreeStore } from '../../store/treeStore';

// Debounce delay for content updates - balance between responsive feel and avoiding input disruption
const DEBOUNCE_DELAY = 300;

interface SchemaPanelProps {
  schema: JSONSchema7 | null;
  schemaId?: string | null;
  schemas?: SchemaPreset[];
  onSchemaChange?: (schemaId: string) => void;
  content: string;
  format: Format;
  onContentChange: (content: string) => void;
}

export function SchemaPanel({
  schema,
  schemaId,
  schemas,
  onSchemaChange,
  content,
  format,
  onContentChange,
}: SchemaPanelProps) {
  const [parseError, setParseError] = useState<string | null>(null);
  const [globalExpandLevel, setGlobalExpandLevel] = useState<GlobalExpandLevel>(1);
  const lastValidValueRef = useRef<Record<string, unknown> | null>(null);
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Track pending value to use for form while debounced update is pending
  const [pendingValue, setPendingValue] = useState<Record<string, unknown> | null>(null);
  // Track the last content we sent to parent to distinguish our own updates from external ones
  const lastSentContentRef = useRef<string>('');

  // Cleanup debounce timeout on unmount
  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  // Parse content to object for form editing
  const parsedValue = useMemo(() => {
    if (!content) return {};
    try {
      let parsed: unknown;
      if (format === 'yaml') {
        parsed = parseYaml(content);
      } else if (format === 'jsonc') {
        parsed = parseJsonc(content);
      } else {
        parsed = parseJson(content);
      }
      setParseError(null);
      lastValidValueRef.current = parsed as Record<string, unknown>;

      return parsed as Record<string, unknown>;
    } catch (err) {
      setParseError((err as Error).message);
      return lastValidValueRef.current ?? {};
    }
  }, [content, format]);

  // Clear pending value when content changes
  // - If it matches lastSentContentRef, our own update arrived - safe to clear
  // - If it doesn't match, external change - also clear to show external data
  useEffect(() => {
    setPendingValue(null);
  }, [content]);

  // Use pending value if available (for immediate form feedback), otherwise parsed content
  const formValue = pendingValue ?? parsedValue;

  // Ref to always have latest content without recreating callback
  const contentRef = useRef(content);
  useEffect(() => {
    contentRef.current = content;
  }, [content]);

  // Handle form changes - debounce serialization to reduce Monaco updates
  const handleFormChange = useCallback(
    (newValue: Record<string, unknown>) => {
      // Update form immediately for responsive UI
      setPendingValue(() => newValue);

      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Debounce the serialization and store update
      debounceTimeoutRef.current = setTimeout(() => {
        try {
          let newContent: string;
          const currentContent = contentRef.current;
          if (format === 'yaml') {
            // Pass schema for property ordering (cast to unknown to satisfy TypeScript)
            newContent = updateYamlPreservingComments(currentContent, newValue, schema as unknown as Parameters<typeof updateYamlPreservingComments>[2]);
          } else if (format === 'jsonc') {
            newContent = updateJsonPreservingComments(currentContent, newValue);
          } else {
            newContent = stringifyJson(newValue);
          }
          lastSentContentRef.current = newContent;
          onContentChange(newContent);
        } catch (err) {
          console.error('Serialization error:', err);
        }
      }, DEBOUNCE_DELAY);
    },
    [format, onContentChange, schema]
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
        const element = document.querySelector(`[data-field-path="${path}"]`);
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

      {parseError && (
        <div className="px-3 py-2 bg-yellow-50 border-b border-border text-xs text-yellow-800">
          ⚠ Parse error: showing last valid state
        </div>
      )}

      <div className="flex-1 overflow-hidden">
        {schema ? (
          <PanelGroup direction="horizontal" autoSaveId="schema-panel-tree">
            <Panel defaultSize={30} minSize={15} maxSize={50}>
              <SchemaTreeSidebar
                schema={schema}
                value={formValue}
                onNavigate={handleTreeNavigate}
              />
            </Panel>
            <PanelResizeHandle className="w-1 bg-border hover:bg-ring transition-colors cursor-col-resize" />
            <Panel defaultSize={70} minSize={50}>
              <div className="h-full overflow-auto">
                <SchemaForm
                  schema={schema}
                  value={formValue}
                  onChange={handleFormChange}
                  globalExpandLevel={globalExpandLevel}
                />
              </div>
            </Panel>
          </PanelGroup>
        ) : (
          <div className="p-4 text-sm text-muted-foreground">No schema loaded</div>
        )}
      </div>
    </div>
  );
}

export { SchemaForm } from './SchemaForm';
export { FormField } from './FormField';
