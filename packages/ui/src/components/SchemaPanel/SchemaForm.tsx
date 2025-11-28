import { useCallback, useMemo } from 'react';
import type { JSONSchema7 } from 'json-schema';
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

function getDefaultValue(schema: JSONSchema7, rootSchema?: JSONSchema7): unknown {
  const resolved = rootSchema ? resolveRef(schema, rootSchema) : schema;
  if (resolved.default !== undefined) return resolved.default;

  // Handle nullable types (anyOf/oneOf with null)
  if (resolved.anyOf || resolved.oneOf) {
    return null;
  }

  const schemaType = Array.isArray(resolved.type)
    ? resolved.type.find((t) => t !== 'null')
    : resolved.type;

  if (schemaType === 'string') return '';
  if (schemaType === 'number' || schemaType === 'integer') return 0;
  if (schemaType === 'boolean') return false;
  if (schemaType === 'array') return [];
  if (schemaType === 'object') return {};
  return null;
}

function setValueAtPath(
  obj: Record<string, unknown>,
  path: string,
  value: unknown
): Record<string, unknown> {
  const parts = (path.match(/[^.\[\]]+|\[\d+\]/g) ?? []) as string[];

  if (parts.length === 0) return obj;

  const [first, ...rest] = parts as [string, ...string[]];
  if (!first) return obj;
  if (parts.length === 1) {
    return { ...obj, [first]: value };
  }
  const restPath = rest.map((p, i) => {
    if (p.startsWith('[') && p.endsWith(']')) {
      return p;
    }
    return i === 0 ? p : `.${p}`;
  }).join('');

  const currentValue = obj[first];
  const nextIsArray = rest[0]?.startsWith('[') && rest[0]?.endsWith(']');

  let nextObj: Record<string, unknown>;
  if (currentValue === undefined || currentValue === null) {
    nextObj = nextIsArray ? [] as unknown as Record<string, unknown> : {};
  } else if (Array.isArray(currentValue)) {
    nextObj = [...currentValue] as unknown as Record<string, unknown>;
  } else if (typeof currentValue === 'object') {
    nextObj = { ...currentValue as Record<string, unknown> };
  } else {
    nextObj = nextIsArray ? [] as unknown as Record<string, unknown> : {};
  }

  return {
    ...obj,
    [first]: setValueAtPath(nextObj, restPath, value),
  };
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
      className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-50 rounded-md transition-colors group"
    >
      <Plus className="w-4 h-4 text-gray-400 group-hover:text-blue-500" />
      <div className="flex-1">
        <span className="font-medium">{title}</span>
        {description && (
          <span className="text-xs text-gray-400 ml-2">{description}</span>
        )}
      </div>
    </button>
  );
}

export function SchemaForm({ schema, value, onChange, globalExpandLevel }: SchemaFormProps) {
  const handleFieldChange = useCallback(
    (path: string, fieldValue: unknown) => {
      const newValue = setValueAtPath(value, path, fieldValue);
      onChange(newValue);
    },
    [value, onChange]
  );

  const handleDeleteField = useCallback(
    (key: string) => {
      const newValue = { ...value };
      delete newValue[key];
      onChange(newValue);
    },
    [value, onChange]
  );

  const handleAddField = useCallback(
    (key: string, propSchema: JSONSchema7) => {
      const defaultVal = getDefaultValue(propSchema, schema);
      const newValue = { ...value, [key]: defaultVal };
      onChange(newValue);
    },
    [value, onChange, schema]
  );

  const properties = schema.properties;
  if (!properties) {
    return (
      <div className="p-4 text-sm text-gray-500">
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
                className="absolute top-0 right-0 p-1 text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
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
        <div className="mt-4 pt-3 border-t border-gray-100">
          <div className="text-xs text-gray-400 uppercase tracking-wide mb-2 px-1">
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
