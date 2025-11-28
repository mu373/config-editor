import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react';
import type { JSONSchema7 } from 'json-schema';
import { FormField, FieldDescription, ChildrenContainer, type GlobalExpandLevel } from './FormField';

interface DictionaryFieldProps {
  name: string;
  schema: JSONSchema7;
  value: Record<string, unknown>;
  path: string;
  required?: boolean;
  onChange: (path: string, value: unknown) => void;
  depth?: number;
  rootSchema?: JSONSchema7;
  /** Global expand level - used as initial default only */
  globalExpandLevel?: GlobalExpandLevel;
}

function resolveRef(schema: JSONSchema7, rootSchema: JSONSchema7): JSONSchema7 {
  if (!schema.$ref) return schema;

  const refPath = schema.$ref.replace('#/', '').split('/');
  let resolved: Record<string, unknown> = rootSchema as Record<string, unknown>;

  for (const part of refPath) {
    resolved = resolved[part] as Record<string, unknown>;
    if (!resolved) return schema;
  }

  return resolved as JSONSchema7;
}

function getDefaultValueForSchema(schema: JSONSchema7, rootSchema?: JSONSchema7): unknown {
  // Resolve $ref if present
  const resolvedSchema = rootSchema && schema.$ref ? resolveRef(schema, rootSchema) : schema;

  if (resolvedSchema.default !== undefined) return resolvedSchema.default;
  if (resolvedSchema.type === 'string') return '';
  if (resolvedSchema.type === 'number' || resolvedSchema.type === 'integer') return 0;
  if (resolvedSchema.type === 'boolean') return false;
  if (resolvedSchema.type === 'array') return [];
  if (resolvedSchema.type === 'object') return {};
  return null;
}

export function DictionaryField({
  name,
  schema,
  value,
  path,
  required = false,
  onChange,
  depth = 0,
  rootSchema,
  globalExpandLevel,
}: DictionaryFieldProps) {
  // Track if user has manually toggled this field
  const [hasBeenManuallyToggled, setHasBeenManuallyToggled] = useState(false);
  const [isExpandedLocal, setIsExpandedLocal] = useState(() => depth < 2);

  // Calculate whether this field should be expanded based on globalExpandLevel
  const shouldExpandByLevel = (level: GlobalExpandLevel) => {
    if (level === 'all') return true;
    if (level !== null && level !== undefined) {
      return depth < level;
    }
    return null; // null means no opinion from global level
  };

  // When globalExpandLevel changes, update expansion state
  // but only if user hasn't manually toggled this field
  useEffect(() => {
    if (hasBeenManuallyToggled) return;

    const shouldExpand = shouldExpandByLevel(globalExpandLevel);
    if (shouldExpand !== null) {
      setIsExpandedLocal(shouldExpand);
    }
  }, [globalExpandLevel, hasBeenManuallyToggled, depth]);

  const isExpanded = isExpandedLocal;

  const setIsExpanded = (expanded: boolean) => {
    setHasBeenManuallyToggled(true);
    setIsExpandedLocal(expanded);
  };
  const [newKeyInput, setNewKeyInput] = useState('');
  const [isAddingKey, setIsAddingKey] = useState(false);

  const title = schema.title || name;
  const description = schema.description;
  const itemSchema = schema.additionalProperties as JSONSchema7;
  const entries = Object.entries(value || {});

  // Track expanded state for each entry (controlled mode for Collapse/Expand All)
  const [entryExpandedStates, setEntryExpandedStates] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    entries.forEach(([key]) => {
      initial[key] = depth < 2;
    });
    return initial;
  });

  // Sync expanded states when entries change (new keys added)
  useEffect(() => {
    setEntryExpandedStates((prev) => {
      const updated = { ...prev };
      entries.forEach(([key]) => {
        if (!(key in updated)) {
          updated[key] = true; // New entries start expanded
        }
      });
      // Remove keys that no longer exist
      Object.keys(updated).forEach((key) => {
        if (!entries.some(([k]) => k === key)) {
          delete updated[key];
        }
      });
      return updated;
    });
  }, [entries.map(([k]) => k).join(',')]);

  const handleCollapseAll = () => {
    const collapsed: Record<string, boolean> = {};
    entries.forEach(([key]) => {
      collapsed[key] = false;
    });
    setEntryExpandedStates(collapsed);
  };

  const handleExpandAll = () => {
    const expanded: Record<string, boolean> = {};
    entries.forEach(([key]) => {
      expanded[key] = true;
    });
    setEntryExpandedStates(expanded);
  };

  const handleEntryExpandedChange = (key: string, expanded: boolean) => {
    setEntryExpandedStates((prev) => ({ ...prev, [key]: expanded }));
  };

  const handleAddKey = () => {
    if (!newKeyInput.trim()) return;
    if (value && newKeyInput in value) {
      // Key already exists
      return;
    }
    const defaultValue = getDefaultValueForSchema(itemSchema, rootSchema);
    onChange(path, { ...value, [newKeyInput]: defaultValue });
    setNewKeyInput('');
    setIsAddingKey(false);
  };

  const handleDeleteKey = (keyToDelete: string) => {
    const newValue = { ...value };
    delete newValue[keyToDelete];
    onChange(path, newValue);
  };

  const handleRenameKey = (oldKey: string, newKey: string) => {
    if (!newKey.trim() || newKey === oldKey) return;
    if (newKey in value) return; // Key already exists

    const newValue: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value)) {
      if (k === oldKey) {
        newValue[newKey] = v;
      } else {
        newValue[k] = v;
      }
    }
    onChange(path, newValue);
  };

  return (
    <div className="mb-2">
      {/* Header row: label with chevron | count and controls */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-1 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="text-sm font-medium text-gray-700">
            {title}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-gray-400" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">
            ({entries.length} {entries.length === 1 ? 'entry' : 'entries'})
          </span>
          {entries.length > 0 && (
            <>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Collapse
              </button>
              <button
                type="button"
                onClick={handleExpandAll}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Expand
              </button>
            </>
          )}
        </div>
      </div>

      {description && <FieldDescription>{description}</FieldDescription>}

      {isExpanded && (
        <ChildrenContainer>
          {/* Add new key input */}
          {isAddingKey && (
            <div className="mb-3 p-2 bg-blue-50 rounded border border-blue-200">
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newKeyInput}
                  onChange={(e) => setNewKeyInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleAddKey();
                    if (e.key === 'Escape') {
                      setIsAddingKey(false);
                      setNewKeyInput('');
                    }
                  }}
                  placeholder="Enter key name..."
                  className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                  autoFocus
                />
                <button
                  type="button"
                  onClick={handleAddKey}
                  disabled={!newKeyInput.trim()}
                  className="px-2 py-1 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Add
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsAddingKey(false);
                    setNewKeyInput('');
                  }}
                  className="px-2 py-1 text-sm text-gray-600 hover:text-gray-800"
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Entries */}
          {entries.map(([key, entryValue]) => (
            <DictionaryEntry
              key={key}
              entryKey={key}
              schema={itemSchema}
              value={entryValue}
              path={`${path}.${key}`}
              onChange={onChange}
              onDelete={() => handleDeleteKey(key)}
              onRename={(newKey) => handleRenameKey(key, newKey)}
              depth={depth + 1}
              rootSchema={rootSchema}
              isExpandedControlled={entryExpandedStates[key]}
              onExpandedChange={(expanded) => handleEntryExpandedChange(key, expanded)}
            />
          ))}

          {/* Add button */}
          {!isAddingKey && (
            <button
              type="button"
              onClick={() => setIsAddingKey(true)}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 py-1"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          )}
        </ChildrenContainer>
      )}
    </div>
  );
}

interface DictionaryEntryProps {
  entryKey: string;
  schema: JSONSchema7;
  value: unknown;
  path: string;
  onChange: (path: string, value: unknown) => void;
  onDelete: () => void;
  onRename: (newKey: string) => void;
  depth: number;
  rootSchema?: JSONSchema7;
  /** Controlled expanded state from parent */
  isExpandedControlled?: boolean;
  /** Callback when expanded state changes */
  onExpandedChange?: (expanded: boolean) => void;
}

function DictionaryEntry({
  entryKey,
  schema,
  value,
  path,
  onChange,
  onDelete,
  onRename,
  depth,
  rootSchema,
  isExpandedControlled,
  onExpandedChange,
}: DictionaryEntryProps) {
  const [isExpandedLocal, setIsExpandedLocal] = useState(depth < 3);
  const [isEditing, setIsEditing] = useState(false);
  const [editKey, setEditKey] = useState(entryKey);

  // Use controlled state if provided, otherwise local state
  const isExpanded = isExpandedControlled !== undefined ? isExpandedControlled : isExpandedLocal;
  const setIsExpanded = (expanded: boolean) => {
    if (onExpandedChange) {
      onExpandedChange(expanded);
    } else {
      setIsExpandedLocal(expanded);
    }
  };

  const handleKeySubmit = () => {
    if (editKey.trim() && editKey !== entryKey) {
      onRename(editKey);
    }
    setIsEditing(false);
  };

  // Resolve $ref if present
  const resolvedSchema = rootSchema ? resolveRef(schema, rootSchema) : schema;
  const effectiveSchema = { ...resolvedSchema, ...schema };
  delete effectiveSchema.$ref;

  // Check if the schema is an object type (has properties or is type: object)
  const isObjectSchema = effectiveSchema.type === 'object' || effectiveSchema.properties;

  if (isObjectSchema) {
    // Render as collapsible section with nested form fields
    return (
      <div className="mb-2 border-l-2 border-gray-300 pl-2">
        <div className="flex items-center gap-1">
          <div
            className="flex items-center gap-1 cursor-pointer flex-1"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-400" />
            )}
            {isEditing ? (
              <input
                type="text"
                value={editKey}
                onChange={(e) => setEditKey(e.target.value)}
                onBlur={handleKeySubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleKeySubmit();
                  if (e.key === 'Escape') {
                    setEditKey(entryKey);
                    setIsEditing(false);
                  }
                }}
                onClick={(e) => e.stopPropagation()}
                className="px-1 py-0.5 text-sm font-medium border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
                autoFocus
              />
            ) : (
              <span
                className="text-sm font-medium text-blue-700 hover:underline cursor-text"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditing(true);
                }}
                title="Click to rename"
              >
                {entryKey}
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
            className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded"
            title="Delete entry"
          >
            <Trash2 className="w-3 h-3" />
          </button>
        </div>

        {isExpanded && effectiveSchema.properties && (
          <div className="mt-1 ml-4">
            {Object.entries(effectiveSchema.properties).map(([propKey, propSchema]) => (
              <FormField
                key={propKey}
                name={propKey}
                schema={propSchema as JSONSchema7}
                value={(value as Record<string, unknown>)?.[propKey]}
                path={`${path}.${propKey}`}
                required={effectiveSchema.required?.includes(propKey)}
                onChange={onChange}
                depth={0}
                rootSchema={rootSchema}
              />
            ))}
          </div>
        )}
      </div>
    );
  }

  // For primitive schemas, render inline
  return (
    <div className="mb-2">
      <div className="flex items-center gap-2">
        {isEditing ? (
          <input
            type="text"
            value={editKey}
            onChange={(e) => setEditKey(e.target.value)}
            onBlur={handleKeySubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleKeySubmit();
              if (e.key === 'Escape') {
                setEditKey(entryKey);
                setIsEditing(false);
              }
            }}
            className="w-32 px-1 py-0.5 text-sm font-medium border border-blue-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500"
            autoFocus
          />
        ) : (
          <span
            className="w-32 flex-shrink-0 text-sm font-medium text-blue-700 hover:underline cursor-text"
            onClick={() => setIsEditing(true)}
            title="Click to rename"
          >
            {entryKey}
          </span>
        )}
        <div className="flex-1">
          <FormField
            name={entryKey}
            schema={schema}
            value={value}
            path={path}
            onChange={onChange}
            depth={depth}
            rootSchema={rootSchema}
          />
        </div>
        <button
          type="button"
          onClick={onDelete}
          className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded flex-shrink-0"
          title="Delete entry"
        >
          <Trash2 className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
