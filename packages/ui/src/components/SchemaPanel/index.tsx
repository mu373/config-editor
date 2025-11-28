import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { PanelLeftClose, PanelLeft, TreeDeciduous, FormInput } from 'lucide-react';
import { SchemaTree } from './SchemaTree';
import { SchemaForm, type GlobalExpandLevel } from './SchemaForm';
import type { JSONSchema7 } from 'json-schema';
import { parseYaml, stringifyYaml, parseJson, stringifyJson, type Format, type SchemaPreset } from '@config-editor/core';

interface SchemaPanelProps {
  schema: JSONSchema7 | null;
  schemaId?: string | null;
  schemas?: SchemaPreset[];
  onSchemaChange?: (schemaId: string) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  onFieldClick?: (path: string) => void;
  content: string;
  format: Format;
  onContentChange: (content: string) => void;
}

type ViewMode = 'tree' | 'form';

export function SchemaPanel({
  schema,
  schemaId,
  schemas,
  onSchemaChange,
  isCollapsed,
  onToggleCollapse,
  onFieldClick,
  content,
  format,
  onContentChange,
}: SchemaPanelProps) {
  const [viewMode, setViewMode] = useState<ViewMode>('form');
  const [parseError, setParseError] = useState<string | null>(null);
  const [globalExpandLevel, setGlobalExpandLevel] = useState<GlobalExpandLevel>(1);
  const lastValidValueRef = useRef<Record<string, unknown> | null>(null);

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

  // Handle form changes - serialize back to content
  const handleFormChange = useCallback(
    (newValue: Record<string, unknown>) => {
      try {
        const newContent =
          format === 'json' ? stringifyJson(newValue) : stringifyYaml(newValue);
        onContentChange(newContent);
      } catch (err) {
        console.error('Serialization error:', err);
      }
    },
    [format, onContentChange]
  );

  if (isCollapsed) {
    return (
      <div className="h-full flex flex-col border-r bg-white w-10">
        <button
          onClick={onToggleCollapse}
          className="p-2 hover:bg-gray-100 rounded m-1"
          title="Expand Schema Panel"
        >
          <PanelLeft className="w-5 h-5 text-gray-600" />
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col border-r bg-white">
      <div className="flex items-center justify-between px-3 h-10 border-b bg-gray-50">
        <div className="flex items-center gap-2 min-w-0">
          {schemas && schemas.length > 0 && onSchemaChange ? (
            <select
              value={schemaId || ''}
              onChange={(e) => onSchemaChange(e.target.value)}
              className="text-xs font-medium text-gray-700 h-6 px-2 border border-gray-200 rounded bg-white focus:outline-none focus:ring-1 focus:ring-blue-500 max-w-[180px] truncate"
              title="Select schema"
            >
              {!schemaId && (
                <option value="" disabled>
                  Select schema...
                </option>
              )}
              {schemas.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          ) : (
            <span className="text-sm font-medium text-gray-700 truncate">
              {schemas?.find((s) => s.id === schemaId)?.name || schemaId || 'Select schema...'}
            </span>
          )}
          {viewMode === 'form' && (
            <select
              value={globalExpandLevel === null ? '' : globalExpandLevel}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  setGlobalExpandLevel(null);
                } else if (val === 'all') {
                  setGlobalExpandLevel('all');
                } else {
                  setGlobalExpandLevel(parseInt(val, 10));
                }
              }}
              className="text-xs h-6 px-1.5 border border-gray-200 rounded bg-white text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500"
              title="Expand level"
            >
              <option value="">Auto</option>
              <option value="0">Root only</option>
              <option value="1">Level 1</option>
              <option value="2">Level 2</option>
              <option value="3">Level 3</option>
              <option value="all">All</option>
            </select>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* View mode toggle */}
          <div className="flex items-center bg-gray-200 rounded p-0.5 mr-2">
            <button
              onClick={() => setViewMode('form')}
              className={`p-1 rounded transition-colors ${
                viewMode === 'form'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Form view"
            >
              <FormInput className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode('tree')}
              className={`p-1 rounded transition-colors ${
                viewMode === 'tree'
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-500 hover:text-gray-700'
              }`}
              title="Tree view"
            >
              <TreeDeciduous className="w-3.5 h-3.5" />
            </button>
          </div>
          <button
            onClick={onToggleCollapse}
            className="p-1 hover:bg-gray-200 rounded"
            title="Collapse Schema Panel"
          >
            <PanelLeftClose className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      </div>

      {parseError && (
        <div className="px-3 py-2 bg-yellow-50 border-b border-yellow-200 text-xs text-yellow-800">
          ⚠ Parse error: showing last valid state
        </div>
      )}

      <div className="flex-1 overflow-auto">
        {schema ? (
          viewMode === 'tree' ? (
            <SchemaTree schema={schema} onFieldClick={onFieldClick} />
          ) : (
            <SchemaForm
              schema={schema}
              value={parsedValue}
              onChange={handleFormChange}
              globalExpandLevel={globalExpandLevel}
            />
          )
        ) : (
          <div className="p-4 text-sm text-gray-500">No schema loaded</div>
        )}
      </div>
    </div>
  );
}

export { SchemaTree } from './SchemaTree';
export { SchemaForm } from './SchemaForm';
export { FormField } from './FormField';
