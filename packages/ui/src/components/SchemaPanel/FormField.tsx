import { useState, useEffect } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { JSONSchema7 } from 'json-schema';
import { SortableArrayField } from './SortableArrayField';
import { VariantField } from './VariantField';
import { DictionaryField } from './DictionaryField';

// Shared component for field descriptions
export function FieldDescription({ children, noMargin = false }: { children: React.ReactNode; noMargin?: boolean }) {
  return <p className={`text-xs text-gray-400 ${noMargin ? '' : '-mt-0.5'}`}>{children}</p>;
}

// Shared component for nested children container with left border
export function ChildrenContainer({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 border-l-2 border-gray-200 pl-6">{children}</div>;
}

/**
 * Global expand level - used as initial default for field expansion:
 * - number (0, 1, 2, ...): expand up to this depth level
 * - 'all': expand everything
 * - null: use field's own default (depth < 2)
 */
export type GlobalExpandLevel = number | 'all' | null;

interface FormFieldProps {
  name: string;
  schema: JSONSchema7;
  value: unknown;
  path: string;
  required?: boolean;
  onChange: (path: string, value: unknown) => void;
  onDelete?: () => void;
  depth?: number;
  rootSchema?: JSONSchema7;
  /** Controlled expanded state from parent (for Collapse/Expand All) */
  isExpandedControlled?: boolean;
  /** Callback when expanded state changes (for controlled mode) */
  onExpandedChange?: (expanded: boolean) => void;
  /** Summary label to display for collapsed array items (from x-summary-field) */
  summaryLabel?: string | null;
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

function getDefaultValue(schema: JSONSchema7): unknown {
  if (schema.default !== undefined) return schema.default;
  if (schema.type === 'string') return '';
  if (schema.type === 'number' || schema.type === 'integer') return 0;
  if (schema.type === 'boolean') return false;
  if (schema.type === 'array') return [];
  if (schema.type === 'object') return {};
  return null;
}

export function FormField({
  name,
  schema,
  value,
  path,
  required = false,
  onChange,
  onDelete,
  depth = 0,
  rootSchema,
  isExpandedControlled,
  onExpandedChange,
  summaryLabel,
  globalExpandLevel = null,
}: FormFieldProps) {
  // Track if user has manually toggled this field
  const [hasBeenManuallyToggled, setHasBeenManuallyToggled] = useState(false);
  const [isExpandedLocal, setIsExpandedLocal] = useState(() => depth < 2);

  // Calculate whether this field should be expanded based on globalExpandLevel
  const shouldExpandByLevel = (level: GlobalExpandLevel | null) => {
    if (level === 'all') return true;
    if (level !== null && level !== undefined) {
      return depth < level;
    }
    return null; // null means no opinion from global level
  };

  // When globalExpandLevel changes, update expansion state
  // but only if user hasn't manually toggled this field
  // Skip if this component is controlled by parent (parent handles its own logic)
  useEffect(() => {
    if (hasBeenManuallyToggled) return; // Respect manual toggles
    if (isExpandedControlled !== undefined) return; // Skip controlled components

    const shouldExpand = shouldExpandByLevel(globalExpandLevel);
    if (shouldExpand !== null) {
      setIsExpandedLocal(shouldExpand);
    }
  }, [globalExpandLevel, hasBeenManuallyToggled, depth, isExpandedControlled]);

  // Determine expanded state:
  // 1. If controlled by parent (isExpandedControlled), use that
  // 2. Otherwise use local state
  const isExpanded = isExpandedControlled !== undefined ? isExpandedControlled : isExpandedLocal;

  const setIsExpanded = (expanded: boolean) => {
    setHasBeenManuallyToggled(true); // Mark as manually toggled
    if (onExpandedChange) {
      onExpandedChange(expanded);
    } else {
      setIsExpandedLocal(expanded);
    }
  };

  // Resolve $ref if present
  const resolvedSchema = rootSchema ? resolveRef(schema, rootSchema) : schema;
  let effectiveSchema = { ...resolvedSchema, ...schema };
  delete effectiveSchema.$ref;

  // Helper function to get the effective type from a schema
  function getTypeFromSchema(s: JSONSchema7): string | undefined {
    if (s.type) {
      if (Array.isArray(s.type)) {
        return s.type.find((t) => t !== 'null') || 'string';
      }
      return s.type as string;
    }
    return undefined;
  }

  // Check if the original schema allows null (before expansion)
  const originalHasNullVariant =
    (Array.isArray(effectiveSchema.type) && effectiveSchema.type.includes('null')) ||
    (effectiveSchema.anyOf?.some((v) => (v as JSONSchema7).type === 'null')) ||
    (effectiveSchema.oneOf?.some((v) => (v as JSONSchema7).type === 'null'));

  // For anyOf/oneOf with a single non-null variant (possibly via $ref),
  // resolve and expand that variant as the effective schema
  function resolveNullableRef(s: JSONSchema7): JSONSchema7 {
    const variants = s.anyOf || s.oneOf;
    if (!variants) return s;

    // Find non-null variants
    const nonNullVariants: { schema: JSONSchema7; resolved: JSONSchema7 }[] = [];
    for (const v of variants) {
      const variant = v as JSONSchema7;
      const variantType = variant.type;
      if (variantType === 'null') continue;
      if (Array.isArray(variantType) && variantType.length === 1 && variantType[0] === 'null') {
        continue;
      }

      if (variant.$ref && rootSchema) {
        const resolved = resolveRef(variant, rootSchema);
        if (resolved.type !== 'null') {
          nonNullVariants.push({ schema: variant, resolved });
        }
      } else if (variant.type && variant.type !== 'null') {
        nonNullVariants.push({ schema: variant, resolved: variant });
      } else if (!variant.type && !variant.$ref) {
        // Variant with no type or ref - might be inline schema
        nonNullVariants.push({ schema: variant, resolved: variant });
      }
    }

    // If there's exactly one non-null variant, expand it
    if (nonNullVariants.length === 1) {
      const { resolved } = nonNullVariants[0];
      // Merge the resolved schema while keeping parent description/title
      return {
        ...resolved,
        title: s.title || resolved.title,
        description: s.description || resolved.description,
      };
    }

    return s;
  }

  // Expand nullable $ref patterns (anyOf: [$ref, null])
  effectiveSchema = resolveNullableRef(effectiveSchema);

  // Use summaryLabel if provided (for array items), otherwise use schema title or name
  const title = summaryLabel ? `${name}: ${summaryLabel}` : (effectiveSchema.title || name);
  const description = effectiveSchema.description;

  // Determine the effective type, handling anyOf/oneOf for nullable types
  function getEffectiveType(s: JSONSchema7): string | undefined {
    const directType = getTypeFromSchema(s);
    if (directType) return directType;

    // Handle anyOf: [{type: 'string'}, {type: 'null'}] pattern
    if (s.anyOf || s.oneOf) {
      const variants = s.anyOf || s.oneOf || [];
      for (const v of variants) {
        const variant = v as JSONSchema7;
        if (variant.type) {
          if (Array.isArray(variant.type)) {
            const nonNullType = variant.type.find((t) => t !== 'null');
            if (nonNullType) return nonNullType;
          } else if (variant.type !== 'null') {
            return variant.type as string;
          }
        }
        if (variant.$ref && rootSchema) {
          const resolved = resolveRef(variant, rootSchema);
          if (resolved.type) {
            if (Array.isArray(resolved.type)) {
              const nonNullType = resolved.type.find((t) => t !== 'null');
              if (nonNullType) return nonNullType;
            } else if (resolved.type !== 'null') {
              return resolved.type as string;
            }
          }
        }
      }
    }
    return undefined;
  }

  const schemaType = getEffectiveType(effectiveSchema);

  // Check if field allows null (use the pre-expansion check)
  const nullable = originalHasNullVariant;

  // Check for polymorphic schemas (anyOf/oneOf with multiple non-null variants)
  const variants = effectiveSchema.anyOf || effectiveSchema.oneOf;
  if (variants) {
    const nonNullVariants = variants.filter((v) => {
      const variant = v as JSONSchema7;
      if (!variant.type) return true;
      if (Array.isArray(variant.type)) {
        return variant.type.some((t) => t !== 'null');
      }
      return variant.type !== 'null';
    });
    // If there are multiple non-null variants, use VariantField
    if (nonNullVariants.length > 1) {
      return (
        <VariantField
          name={name}
          schema={effectiveSchema}
          value={value}
          path={path}
          required={required}
          onChange={onChange}
          depth={depth}
          rootSchema={rootSchema}
          globalExpandLevel={globalExpandLevel}
                  />
      );
    }
  }

  // Handle enum type
  if (effectiveSchema.enum) {
    return (
      <div className="mb-2">
        <div className="flex items-start gap-3">
          <label className="flex-shrink-0 w-32 text-sm font-medium text-gray-700 pt-0.5">
            {title}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="flex-1 min-w-0">
            <select
              value={value as string ?? ''}
              onChange={(e) => onChange(path, e.target.value || (nullable ? null : ''))}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            >
              {nullable && <option value="">-- None --</option>}
              {effectiveSchema.enum.map((opt) => (
                <option key={String(opt)} value={String(opt)}>
                  {String(opt)}
                </option>
              ))}
            </select>
            {description && (
              <FieldDescription>{description}</FieldDescription>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Handle string type
  if (schemaType === 'string') {
    const isDate = effectiveSchema.format === 'date';
    const isDateTime = effectiveSchema.format === 'date-time';
    const inputType = isDate ? 'date' : isDateTime ? 'datetime-local' : 'text';
    return (
      <div className="mb-2">
        <div className="flex items-start gap-3">
          <label className="flex-shrink-0 w-32 text-sm font-medium text-gray-700 pt-0.5">
            {title}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="flex-1 min-w-0">
            <input
              type={inputType}
              value={(value as string) ?? ''}
              onChange={(e) => onChange(path, e.target.value || (nullable ? null : ''))}
              placeholder={effectiveSchema.default as string}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            />
            {description && (
              <FieldDescription>{description}</FieldDescription>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Handle number/integer type
  if (schemaType === 'number' || schemaType === 'integer') {
    return (
      <div className="mb-2">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0 w-32">
            <label className="text-sm font-medium text-gray-700">
              {title}
              {required && <span className="text-red-500 ml-0.5">*</span>}
            </label>
            {(effectiveSchema.minimum !== undefined || effectiveSchema.maximum !== undefined) && (
              <p className="text-xs text-gray-400 mt-0.5">
                Range: {effectiveSchema.minimum ?? '-∞'} - {effectiveSchema.maximum ?? '∞'}
              </p>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <input
              type="number"
              value={(value as number) ?? ''}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  onChange(path, nullable ? null : 0);
                } else {
                  onChange(path, schemaType === 'integer' ? parseInt(val) : parseFloat(val));
                }
              }}
              min={effectiveSchema.minimum}
              max={effectiveSchema.maximum}
              step={schemaType === 'integer' ? 1 : 'any'}
              className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
            />
            {description && (
              <FieldDescription>{description}</FieldDescription>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Handle boolean type
  if (schemaType === 'boolean') {
    return (
      <div className="mb-2">
        <div className="flex items-start gap-3">
          <label className="flex-shrink-0 w-32 text-sm font-medium text-gray-700 pt-0.5">
            {title}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="flex-1 min-w-0">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(path, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
            {description && (
              <FieldDescription>{description}</FieldDescription>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Handle array type - use SortableArrayField for drag-to-reorder
  if (schemaType === 'array' && effectiveSchema.items) {
    return (
      <SortableArrayField
        name={name}
        schema={effectiveSchema}
        value={(value as unknown[]) ?? []}
        path={path}
        required={required}
        onChange={onChange}
        depth={depth}
        rootSchema={rootSchema}
        globalExpandLevel={globalExpandLevel}
              />
    );
  }

  // Handle dictionary/map type (object with additionalProperties but no fixed properties)
  if (schemaType === 'object' && effectiveSchema.additionalProperties && typeof effectiveSchema.additionalProperties === 'object' && !effectiveSchema.properties) {
    return (
      <DictionaryField
        name={name}
        schema={effectiveSchema}
        value={(value as Record<string, unknown>) ?? {}}
        path={path}
        required={required}
        onChange={onChange}
        depth={depth}
        rootSchema={rootSchema}
        globalExpandLevel={globalExpandLevel}
              />
    );
  }

  // Handle object type
  if (schemaType === 'object' && effectiveSchema.properties) {
    const objValue = (value as Record<string, unknown>) ?? {};

    // At depth 0 (root level), children render at full width outside the header row
    // At deeper levels, children render inside the content area (indented)
    if (depth === 0) {
      return (
        <div className={summaryLabel ? '' : 'mb-2'}>
          {/* Header row: label with chevron */}
          <div
            className="flex items-center gap-1 cursor-pointer h-6"
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
          {/* Hide description for array items (when summaryLabel is provided) */}
          {description && !summaryLabel && (
            <FieldDescription>{description}</FieldDescription>
          )}

          {/* Children render at full width outside the header row */}
          {isExpanded && (
            <ChildrenContainer>
              {Object.entries(effectiveSchema.properties).map(([key, propSchema]) => (
                <FormField
                  key={key}
                  name={key}
                  schema={propSchema as JSONSchema7}
                  value={objValue[key]}
                  path={`${path}.${key}`}
                  required={effectiveSchema.required?.includes(key)}
                  onChange={onChange}
                  depth={depth + 1}
                  rootSchema={rootSchema}
                  globalExpandLevel={globalExpandLevel}
                                  />
              ))}
            </ChildrenContainer>
          )}
        </div>
      );
    }

    // Deeper levels: children inside content area (indented)
    return (
      <div className="mb-2">
        {/* Header row: label with chevron */}
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
        {/* Hide description for array items (when summaryLabel is provided) */}
        {description && !summaryLabel && (
          <FieldDescription>{description}</FieldDescription>
        )}

        {isExpanded && (
          <ChildrenContainer>
            {Object.entries(effectiveSchema.properties).map(([key, propSchema]) => (
              <FormField
                key={key}
                name={key}
                schema={propSchema as JSONSchema7}
                value={objValue[key]}
                path={`${path}.${key}`}
                required={effectiveSchema.required?.includes(key)}
                onChange={onChange}
                depth={0}
                rootSchema={rootSchema}
                globalExpandLevel={globalExpandLevel}
                              />
            ))}
          </ChildrenContainer>
        )}
      </div>
    );
  }

  // Fallback for unknown types - treat as string
  const stringValue = value === null || value === undefined
    ? ''
    : typeof value === 'string'
      ? value
      : typeof value === 'object'
        ? JSON.stringify(value, null, 2)
        : String(value);

  return (
    <div className="mb-2">
      <div className="flex items-start gap-3">
        <label className="flex-shrink-0 w-32 text-sm font-medium text-gray-700 pt-0.5">
          {title}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <div className="flex-1 min-w-0">
          <input
            type="text"
            value={stringValue}
            onChange={(e) => onChange(path, e.target.value || (nullable ? null : ''))}
            className="w-full px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
          />
          {description && (
            <FieldDescription>{description}</FieldDescription>
          )}
        </div>
      </div>
    </div>
  );
}
