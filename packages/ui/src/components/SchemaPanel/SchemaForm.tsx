import { useCallback, useMemo, useRef, useEffect } from 'react';
import type { JSONSchema7 } from 'json-schema';
import { resolveRef, getDefaultValue, parsePath, setValueAtPath } from '@config-editor/core';
import { FormField } from './FormField';
import { Plus, Trash2 } from 'lucide-react';

/**
 * Global expand level - used as initial default for field expansion:
 * - number (0, 1, 2, ...): expand up to this depth level
 * - 'all': expand everything
 * - null: use field's own default (depth < 2)
 */
export type GlobalExpandLevel = number | 'all' | null;

interface SchemaFormProps {
  schema: JSONSchema7;
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  globalExpandLevel: GlobalExpandLevel;
}

interface OptionalFieldProps {
  name: string;
  schema: JSONSchema7;
  rootSchema: JSONSchema7;
  onAdd: () => void;
}

function OptionalField({ name, schema, rootSchema, onAdd }: OptionalFieldProps) {
  const resolved = resolveRef(schema, rootSchema);
  const title = resolved.title || schema.title || name;
  const description = resolved.description || schema.description;

  return (
    <button
      type="button"
      onClick={onAdd}
      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-muted-foreground hover:text-foreground hover:bg-muted rounded-md transition-colors group"
    >
      <Plus className="w-4 h-4 text-muted-foreground group-hover:text-primary" />
      <div className="flex-1">
        <span className="font-medium">{title}</span>
        {description && (
          <span className="text-xs text-muted-foreground/70 ml-2">{description}</span>
        )}
      </div>
    </button>
  );
}

/**
 * SchemaForm renders an editable form based on a JSON Schema.
 *
 * This component uses path-based updates for all field changes. All updates
 * are merged into the document using immutable path operations from the core package.
 *
 * Path format examples:
 * - "name" - simple property
 * - "user.email" - nested object
 * - "items[0]" - array element
 * - "users[0].name" - nested array object
 *
 * @see packages/core/src/path/operations.ts for path utilities
 * @see packages/core/src/path/parser.ts for path parsing
 */
export function SchemaForm({ schema, value, onChange, globalExpandLevel }: SchemaFormProps) {
  // Use ref to always have latest value without recreating callback
  // Update synchronously during render to avoid stale values
  const valueRef = useRef(value);
  valueRef.current = value;

  const handleFieldChange = useCallback(
    (pathString: string, fieldValue: unknown) => {
      // Convert string path to typed Path segments
      // Example: "users[0].name" -> [{type:'property',key:'users'},{type:'index',index:0},{type:'property',key:'name'}]
      const path = parsePath(pathString);

      // Apply immutable update using core utilities
      // This ensures arrays are properly handled (no "[0]" as property key!)
      const newValue = setValueAtPath(valueRef.current, path, fieldValue);

      onChange(newValue);
    },
    [onChange]
  );

  const handleDeleteField = useCallback(
    (key: string) => {
      const newValue = { ...valueRef.current };
      delete newValue[key];
      onChange(newValue);
    },
    [onChange]
  );

  const handleAddField = useCallback(
    (key: string, propSchema: JSONSchema7) => {
      const defaultVal = getDefaultValue(propSchema, schema);
      const newValue = { ...valueRef.current, [key]: defaultVal };
      onChange(newValue);
    },
    [onChange, schema]
  );

  const properties = schema.properties;
  if (!properties) {
    return (
      <div className="p-4 text-sm text-muted-foreground">
        No properties defined in schema
      </div>
    );
  }

  // Separate fields into present (in value) and optional (not in value, not required)
  const presentFields: Array<[string, JSONSchema7]> = [];
  const optionalFields: Array<[string, JSONSchema7]> = [];
  const requiredSet = new Set(schema.required || []);

  for (const [key, propSchema] of Object.entries(properties)) {
    const hasValue = key in value && value[key] !== undefined;
    const isRequired = requiredSet.has(key);

    if (hasValue || isRequired) {
      presentFields.push([key, propSchema as JSONSchema7]);
    } else {
      optionalFields.push([key, propSchema as JSONSchema7]);
    }
  }

  return (
    <div className="p-3">
      {/* Present fields */}
      {presentFields.map(([key, propSchema]) => {
        const isRequired = requiredSet.has(key);
        return (
          <div key={key} className="relative group">
            <FormField
              name={key}
              schema={propSchema}
              value={value[key]}
              path={key}
              required={isRequired}
              onChange={handleFieldChange}
              depth={0}
              rootSchema={schema}
              globalExpandLevel={globalExpandLevel}
            />
            {/* Delete button for optional fields that have values */}
            {!isRequired && key in value && (
              <button
                type="button"
                onClick={() => handleDeleteField(key)}
                className="absolute top-0 right-0 p-1 text-muted-foreground hover:text-destructive opacity-0 group-hover:opacity-100 transition-opacity"
                title="Remove field"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        );
      })}

      {/* Optional fields (click to add) */}
      {optionalFields.length > 0 && (
        <div className="mt-4 pt-3 border-t border-border">
          <div className="text-xs text-muted-foreground uppercase tracking-wide mb-2 px-1">
            Optional fields
          </div>
          <div className="space-y-1">
            {optionalFields.map(([key, propSchema]) => (
              <OptionalField
                key={key}
                name={key}
                schema={propSchema}
                rootSchema={schema}
                onAdd={() => handleAddField(key, propSchema)}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
