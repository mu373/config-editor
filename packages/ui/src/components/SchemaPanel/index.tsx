import { useState, useMemo, useCallback, useRef, useEffect } from 'react';
import { SchemaForm, type GlobalExpandLevel } from './SchemaForm';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import type { JSONSchema7 } from 'json-schema';
import { parseYaml, stringifyYaml, parseJson, stringifyJson, type Format, type SchemaPreset } from '@config-editor/core';

// Debounce delay for content updates - keep low for responsive feel
const DEBOUNCE_DELAY = 50;

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
      const parsed = format === 'json' ? parseJson(content) : parseYaml(content);
      setParseError(null);
      lastValidValueRef.current = parsed as Record<string, unknown>;
      return parsed as Record<string, unknown>;
    } catch (err) {
      setParseError((err as Error).message);
      return lastValidValueRef.current ?? {};
    }
  }, [content, format]);

  // Use pending value if available (for immediate form feedback), otherwise parsed content
  const formValue = pendingValue ?? parsedValue;

  // Handle form changes - debounce serialization to reduce Monaco updates
  const handleFormChange = useCallback(
    (newValue: Record<string, unknown>) => {
      // Update form immediately for responsive UI
      setPendingValue(newValue);

      // Clear existing timeout
      if (debounceTimeoutRef.current) {
        clearTimeout(debounceTimeoutRef.current);
      }

      // Debounce the serialization and store update
      debounceTimeoutRef.current = setTimeout(() => {
        try {
          const newContent =
            format === 'json' ? stringifyJson(newValue) : stringifyYaml(newValue);
          onContentChange(newContent);
          // Clear pending value after successful update
          setPendingValue(null);
        } catch (err) {
          console.error('Serialization error:', err);
        }
      }, DEBOUNCE_DELAY);
    },
    [format, onContentChange]
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

      <div className="flex-1 overflow-auto">
        {schema ? (
          <SchemaForm
            schema={schema}
            value={formValue}
            onChange={handleFormChange}
            globalExpandLevel={globalExpandLevel}
          />
        ) : (
          <div className="p-4 text-sm text-muted-foreground">No schema loaded</div>
        )}
      </div>
    </div>
  );
}

export { SchemaForm } from './SchemaForm';
export { FormField } from './FormField';
