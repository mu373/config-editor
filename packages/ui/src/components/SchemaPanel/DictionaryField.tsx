import { useState } from 'react';
import { ChevronDown, ChevronRight, Plus } from 'lucide-react';
import type { JSONSchema7 } from 'json-schema';
import { resolveRef, getDefaultValue, isValidObjectKey } from '@config-editor/core';
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
  // Use treeStore for ALL expansion state (centralized, path-based)
  const { isFormPathExpanded, toggleFormPath } = useTreeStore();

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

  const handleCollapseAll = () => {
    // Collapse all dictionary entries by toggling their paths
    entries.forEach(([key]) => {
      const entryPath = `${path}.${key}`;
      if (isFormPathExpanded(entryPath, depth + 1, globalExpandLevel)) {
        toggleFormPath(entryPath);
      }
    });
  };

  const handleExpandAll = () => {
    // Expand all dictionary entries by toggling their paths
    entries.forEach(([key]) => {
      const entryPath = `${path}.${key}`;
      if (!isFormPathExpanded(entryPath, depth + 1, globalExpandLevel)) {
        toggleFormPath(entryPath);
      }
    });
  };

  const handleAddKey = () => {
    if (!newKeyInput.trim()) return;

    if (!isValidObjectKey(newKeyInput)) {
      alert('Invalid key name. Reserved keywords like __proto__, constructor are not allowed.');
      return;
    }

    if (value && newKeyInput in value) {
      alert('Key already exists');
      return;
    }

    const defaultValue = getDefaultValue(itemSchema, rootSchema);
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

    if (!isValidObjectKey(newKey)) {
      alert('Invalid key name. Reserved keywords like __proto__, constructor are not allowed.');
      return;
    }

    if (newKey in value) {
      alert('Key already exists');
      return;
    }

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
        <ChildrenContainer onCollapse={setIsExpanded}>
          {/* Add new key input */}
          {isAddingKey && (
            <div className="mb-3 p-2 bg-primary/10 rounded border border-primary/30">
              <div className="flex flex-col gap-2">
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
                    className={`flex-1 ${newKeyInput && !isValidObjectKey(newKeyInput) ? 'border-destructive focus-visible:ring-destructive' : ''}`}
                    autoFocus
                  />
                  <Button
                    type="button"
                    size="sm"
                    onClick={handleAddKey}
                    disabled={!newKeyInput.trim() || !isValidObjectKey(newKeyInput)}
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
                {newKeyInput && !isValidObjectKey(newKeyInput) && (
                  <p className="text-xs text-destructive">
                    Invalid key: reserved keyword
                  </p>
                )}
                {newKeyInput && isValidObjectKey(newKeyInput) && value && newKeyInput in value && (
                  <p className="text-xs text-destructive">
                    Key already exists
                  </p>
                )}
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
              globalExpandLevel={globalExpandLevel}
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
  /** Global expand level - used as initial default only */
  globalExpandLevel?: GlobalExpandLevel;
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
  globalExpandLevel = null,
}: DictionaryEntryProps) {
  // Use treeStore for ALL expansion state (centralized, path-based)
  const { isFormPathExpanded, toggleFormPath } = useTreeStore();
  const [isEditing, setIsEditing] = useState(false);
  const [editKey, setEditKey] = useState(entryKey);

  const isExpanded = isFormPathExpanded(path, depth, globalExpandLevel);
  const setIsExpanded = () => {
    toggleFormPath(path);
  };

  const handleKeySubmit = () => {
    if (editKey.trim() && editKey !== entryKey) {
      if (!isValidObjectKey(editKey)) {
        alert('Invalid key name. Reserved keywords like __proto__, constructor are not allowed.');
        setEditKey(entryKey);
        setIsEditing(false);
        return;
      }
      onRename(editKey);
    }
    setIsEditing(false);
  };

  // Resolve $ref if present
  let resolvedSchema = rootSchema ? resolveRef(schema, rootSchema) : schema;
  let effectiveSchema = { ...resolvedSchema, ...schema };
  delete effectiveSchema.$ref;

  // Resolve oneOf/anyOf with $ref (similar to FormField)
  const variants = effectiveSchema.anyOf || effectiveSchema.oneOf;
  if (variants && rootSchema) {
    const nonNullVariants: JSONSchema7[] = [];
    for (const v of variants) {
      const variant = v as JSONSchema7;
      if (variant.$ref) {
        const resolved = resolveRef(variant, rootSchema);
        if (resolved.type !== 'null') {
          nonNullVariants.push(resolved);
        }
      } else if (variant.type !== 'null') {
        nonNullVariants.push(variant);
      }
    }
    // If there's exactly one non-null variant, use it
    if (nonNullVariants.length === 1) {
      effectiveSchema = {
        ...nonNullVariants[0],
        title: effectiveSchema.title || nonNullVariants[0].title,
        description: effectiveSchema.description || nonNullVariants[0].description,
      };
    } else if (nonNullVariants.length > 1) {
      // Multiple variants - prefer complex types (object/array) over primitives
      const objectVariants = nonNullVariants.filter(v => v.type === 'object' || v.properties || v.additionalProperties || v.patternProperties);
      const arrayVariants = nonNullVariants.filter(v => v.type === 'array' || v.items);

      if (objectVariants.length === 1) {
        // One object variant and other primitive variants - use the object
        effectiveSchema = {
          ...objectVariants[0],
          title: effectiveSchema.title || objectVariants[0].title,
          description: effectiveSchema.description || objectVariants[0].description,
        };
      } else if (objectVariants.length > 1) {
        // Multiple object variants - use the first one
        effectiveSchema = {
          ...objectVariants[0],
          title: effectiveSchema.title || objectVariants[0].title,
          description: effectiveSchema.description || objectVariants[0].description,
        };
      } else if (arrayVariants.length >= 1) {
        // Array variant(s) present - use the first one
        effectiveSchema = {
          ...arrayVariants[0],
          title: effectiveSchema.title || arrayVariants[0].title,
          description: effectiveSchema.description || arrayVariants[0].description,
        };
      }
    }
  }

  // Check if the schema is an object type (has properties or is type: object)
  const isObjectSchema = effectiveSchema.type === 'object' || effectiveSchema.properties;
  // Check if the schema is an array type
  const isArraySchema = effectiveSchema.type === 'array' && effectiveSchema.items;

  if (isObjectSchema || isArraySchema) {
    // Render as collapsible section with nested form fields (always vertical)
    return (
      <div data-field-path={path} className="py-1.5">
        {/* Header row: chevron, key label, delete button */}
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

        {/* Nested content on new line below */}
        {isExpanded && (isArraySchema || (effectiveSchema.properties && Object.keys(effectiveSchema.properties).length > 0)) && (
          <ChildrenContainer onCollapse={setIsExpanded}>
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
            ) : (
              // Render object properties
              Object.entries(effectiveSchema.properties!).map(([propKey, propSchema]) => (
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
            )}
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
            name=""
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
