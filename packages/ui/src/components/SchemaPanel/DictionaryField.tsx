import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { JSONSchema7 } from 'json-schema';
import { FormField, FieldDescription, ChildrenContainer, FieldLabel, ConfirmDeleteButton, type GlobalExpandLevel } from './FormField';
import { SortableArrayField } from './SortableArrayField';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { useTreeStore } from '../../store/treeStore';

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
  globalExpandLevel = null,
}: DictionaryFieldProps) {
  // Use treeStore for form expansion state
  // Subscribe to manuallyToggledFormPaths to trigger re-renders when paths are expanded via navigation
  const { isFormPathExpanded, toggleFormPath, manuallyToggledFormPaths, selectedPath } = useTreeStore();
  const _isManuallyToggled = manuallyToggledFormPaths.has(path);

  const isExpanded = isFormPathExpanded(path, depth, globalExpandLevel);

  const setIsExpanded = () => {
    toggleFormPath(path);
  };
  const [newKeyInput, setNewKeyInput] = useState('');
  const [isAddingKey, setIsAddingKey] = useState(false);

  const title = schema.title || name;
  const description = schema.description;
  // Get item schema from either additionalProperties or patternProperties
  let itemSchema: JSONSchema7;
  if (schema.additionalProperties && typeof schema.additionalProperties === 'object') {
    itemSchema = schema.additionalProperties as JSONSchema7;
  } else if (schema.patternProperties && typeof schema.patternProperties === 'object') {
    // Get the first pattern's schema (most schemas have just one pattern)
    const patterns = Object.values(schema.patternProperties);
    if (patterns.length > 0) {
      itemSchema = patterns[0] as JSONSchema7;
    } else {
      // Fallback: allow any type
      itemSchema = { type: 'object' } as JSONSchema7;
    }
  } else {
    // Fallback: allow any type
    itemSchema = { type: 'object' } as JSONSchema7;
  }
  const entries = Object.entries(value || {});

  // Track expanded state for each entry (controlled mode for Collapse/Expand All)
  const [entryExpandedStates, setEntryExpandedStates] = useState<Record<string, boolean>>(() => {
    const initial: Record<string, boolean> = {};
    entries.forEach(([key]) => {
      initial[key] = depth < 2;
    });
    return initial;
  });

  // Sync with treeStore: when navigation selects a dictionary entry path, expand it locally
  useEffect(() => {
    if (!selectedPath) return;
    // Check if selectedPath is a child of this dictionary (e.g., "services.web" or "services.web.ports")
    const dictPrefix = `${path}.`;
    if (selectedPath.startsWith(dictPrefix)) {
      // Extract the key from the path (first segment after the prefix)
      const remainder = selectedPath.slice(dictPrefix.length);
      const key = remainder.split('.')[0].split('[')[0]; // Handle both "web.ports" and "web[0]"
      if (key && entries.some(([k]) => k === key)) {
        setEntryExpandedStates(prev => {
          if (prev[key]) return prev;
          return { ...prev, [key]: true };
        });
      }
    }
  }, [selectedPath, path, entries]);

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
    <div data-field-path={path} className="py-2">
      {/* Header row: label with chevron | count and controls */}
      <div className="flex items-center gap-3">
        <div
          className="flex items-center gap-1 cursor-pointer"
          onClick={setIsExpanded}
        >
          <FieldLabel name={name} title={title} required={required} as="span" />
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">
            ({entries.length} {entries.length === 1 ? 'entry' : 'entries'})
          </span>
          {entries.length > 0 && (
            <>
              <span className="text-border">|</span>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Collapse
              </button>
              <button
                type="button"
                onClick={handleExpandAll}
                className="text-xs text-muted-foreground hover:text-foreground"
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
            <div className="mb-3 p-2 bg-primary/10 rounded border border-primary/30">
              <div className="flex items-center gap-2">
                <Input
                  type="text"
                  size="sm"
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
                  className="flex-1"
                  autoFocus
                />
                <Button
                  type="button"
                  size="sm"
                  onClick={handleAddKey}
                  disabled={!newKeyInput.trim()}
                >
                  Add
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setIsAddingKey(false);
                    setNewKeyInput('');
                  }}
                >
                  Cancel
                </Button>
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
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 py-1"
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
  // Use treeStore for form expansion state
  // Subscribe to manuallyToggledFormPaths to trigger re-renders when paths are expanded via navigation
  const { isFormPathExpanded, toggleFormPath, manuallyToggledFormPaths } = useTreeStore();
  const _isManuallyToggled = manuallyToggledFormPaths.has(path);
  const [isEditing, setIsEditing] = useState(false);
  const [editKey, setEditKey] = useState(entryKey);

  // Use controlled state if provided, otherwise treeStore
  const isExpanded = isExpandedControlled !== undefined
    ? isExpandedControlled
    : isFormPathExpanded(path, depth, null);
  const setIsExpanded = () => {
    if (onExpandedChange) {
      onExpandedChange(!isExpanded);
    } else {
      toggleFormPath(path);
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
  // Check if the schema is an array type
  const isArraySchema = effectiveSchema.type === 'array' && effectiveSchema.items;

  if (isObjectSchema || isArraySchema) {
    // Render as collapsible section with nested form fields
    return (
      <div data-field-path={path} className="py-1.5">
        <div className="flex items-center gap-1">
          <div
            className="flex items-center gap-1 cursor-pointer flex-1"
            onClick={setIsExpanded}
          >
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
            {isEditing ? (
              <Input
                type="text"
                size="sm"
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
                className="w-auto font-medium border-primary/50"
                autoFocus
              />
            ) : (
              <span
                className="text-sm font-medium text-primary hover:underline cursor-text"
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
          <ConfirmDeleteButton onDelete={onDelete} size="sm" />
        </div>

        {isExpanded && (
          <ChildrenContainer>
            {isArraySchema ? (
              // Render array directly with hideHeader since we already show the key in the header
              <SortableArrayField
                name={entryKey}
                schema={effectiveSchema}
                value={(value as unknown[]) ?? []}
                path={path}
                onChange={onChange}
                depth={1}
                rootSchema={rootSchema}
                hideHeader
              />
            ) : effectiveSchema.properties ? (
              // Render object properties
              Object.entries(effectiveSchema.properties).map(([propKey, propSchema]) => (
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
              ))
            ) : null}
          </ChildrenContainer>
        )}
      </div>
    );
  }

  // For primitive schemas, render inline
  return (
    <div data-field-path={path} className="py-1.5">
      <div className="flex items-center gap-2">
        {isEditing ? (
          <Input
            type="text"
            size="sm"
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
            className="w-48 font-medium border-primary/50"
            autoFocus
          />
        ) : (
          <span
            className="w-48 flex-shrink-0 text-sm font-medium text-primary hover:underline cursor-text"
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
        <ConfirmDeleteButton onDelete={onDelete} size="sm" />
      </div>
    </div>
  );
}
