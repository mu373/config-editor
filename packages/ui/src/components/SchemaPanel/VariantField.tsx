import { useState, useMemo, useCallback } from 'react';
import type { JSONSchema7 } from 'json-schema';
import { FormField, FieldDescription, ChildrenContainer, type GlobalExpandLevel } from './FormField';

interface VariantFieldProps {
  name: string;
  schema: JSONSchema7;
  value: unknown;
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

interface VariantInfo {
  index: number;
  schema: JSONSchema7;
  resolvedSchema: JSONSchema7;
  label: string;
  isNull: boolean;
}

function isPrimitiveType(schema: JSONSchema7): boolean {
  const type = schema.type;
  // Include enums as primitive (they render as select dropdown)
  if (schema.enum) return true;
  return type === 'string' || type === 'number' || type === 'integer' || type === 'boolean';
}

function getVariantLabel(schema: JSONSchema7, resolvedSchema: JSONSchema7): string {
  // Use title if available
  if (resolvedSchema.title) return resolvedSchema.title;
  if (schema.title) return schema.title;

  // For refs, use the ref name
  if (schema.$ref) {
    const refName = schema.$ref.split('/').pop() || 'Reference';
    return refName;
  }

  // For type-based, create a descriptive label
  const type = resolvedSchema.type;
  if (type === 'null') return 'None';
  if (type === 'boolean') return 'Boolean';
  if (type === 'string') {
    if (resolvedSchema.format === 'date') return 'Date';
    if (resolvedSchema.format === 'date-time') return 'DateTime';
    if (resolvedSchema.enum) return 'Choice';
    return 'Text';
  }
  if (type === 'number') return 'Number';
  if (type === 'integer') return 'Integer';
  if (type === 'array') return 'List';
  if (type === 'object') return 'Object';

  return String(type || 'Unknown');
}

function getDefaultValue(schema: JSONSchema7): unknown {
  if (schema.default !== undefined) return schema.default;
  if (schema.type === 'null') return null;
  if (schema.type === 'string') return '';
  if (schema.type === 'number' || schema.type === 'integer') return 0;
  if (schema.type === 'boolean') return false;
  if (schema.type === 'array') return [];
  if (schema.type === 'object') return {};
  return null;
}

function determineCurrentVariant(
  value: unknown,
  variants: VariantInfo[]
): number {
  // If value is null/undefined, prefer null variant or first variant
  if (value === null || value === undefined) {
    const nullVariant = variants.find((v) => v.isNull);
    return nullVariant?.index ?? 0;
  }

  const valueType = typeof value;
  const isArray = Array.isArray(value);

  // Find best matching variant
  for (const variant of variants) {
    if (variant.isNull) continue;

    const schema = variant.resolvedSchema;
    const schemaType = schema.type;

    if (isArray && schemaType === 'array') return variant.index;
    if (valueType === 'object' && !isArray && schemaType === 'object')
      return variant.index;
    if (valueType === 'boolean' && schemaType === 'boolean') return variant.index;
    if (valueType === 'number' && (schemaType === 'number' || schemaType === 'integer'))
      return variant.index;
    if (valueType === 'string' && schemaType === 'string') return variant.index;
  }

  // Default to first non-null variant
  return variants.find((v) => !v.isNull)?.index ?? 0;
}

export function VariantField({
  name,
  schema,
  value,
  path,
  required = false,
  onChange,
  depth = 0,
  rootSchema,
  globalExpandLevel,
}: VariantFieldProps) {
  const variants = useMemo(() => {
    const variantSchemas = schema.anyOf || schema.oneOf || [];
    return variantSchemas.map((variantSchema, index) => {
      const s = variantSchema as JSONSchema7;
      const resolved = rootSchema ? resolveRef(s, rootSchema) : s;
      const isNull = resolved.type === 'null' || s.type === 'null';
      return {
        index,
        schema: s,
        resolvedSchema: resolved,
        label: getVariantLabel(s, resolved),
        isNull,
      } as VariantInfo;
    });
  }, [schema, rootSchema]);

  // Filter out null variant for selector display (null is handled by "clear" functionality)
  const selectableVariants = useMemo(
    () => variants.filter((v) => !v.isNull),
    [variants]
  );

  const hasNullVariant = variants.some((v) => v.isNull);

  // Infer initial variant from value
  const inferredVariantIndex = useMemo(
    () => determineCurrentVariant(value, variants),
    [value, variants]
  );

  // Track user's explicit variant selection (null means use inferred)
  const [selectedVariantIndex, setSelectedVariantIndex] = useState<number | null>(null);

  // Use explicit selection if set, otherwise use inferred
  const currentVariantIndex = selectedVariantIndex !== null ? selectedVariantIndex : inferredVariantIndex;
  const currentVariant = variants[currentVariantIndex];

  const handleVariantChange = useCallback(
    (newIndex: number) => {
      const newVariant = variants[newIndex];
      if (!newVariant) return;

      // Track the explicit selection
      setSelectedVariantIndex(newIndex);

      if (newVariant.isNull) {
        onChange(path, null);
      } else {
        // Create default value for new variant type
        const defaultVal = getDefaultValue(newVariant.resolvedSchema);
        onChange(path, defaultVal);
      }
    },
    [variants, onChange, path]
  );

  const title = schema.title || name;
  const description = schema.description;

  // If only one non-null variant (plus optional null), just render as the variant type
  if (selectableVariants.length === 1) {
    return (
      <FormField
        name={name}
        schema={selectableVariants[0].resolvedSchema}
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

  // Check if current variant is a primitive type (render inline)
  const currentIsPrimitive = currentVariant && !currentVariant.isNull && isPrimitiveType(currentVariant.resolvedSchema);

  // Render inline input for primitive types
  const renderPrimitiveInput = () => {
    if (!currentVariant || currentVariant.isNull) return null;
    const variantSchema = currentVariant.resolvedSchema;
    const variantType = variantSchema.type;

    // Handle enum type (select dropdown)
    if (variantSchema.enum) {
      return (
        <select
          value={(value as string) ?? ''}
          onChange={(e) => onChange(path, e.target.value || null)}
          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="">-- Select --</option>
          {variantSchema.enum.map((opt) => (
            <option key={String(opt)} value={String(opt)}>
              {String(opt)}
            </option>
          ))}
        </select>
      );
    }

    if (variantType === 'string') {
      const isDate = variantSchema.format === 'date';
      const isDateTime = variantSchema.format === 'date-time';
      return (
        <input
          type={isDate ? 'date' : isDateTime ? 'datetime-local' : 'text'}
          value={(value as string) ?? ''}
          onChange={(e) => onChange(path, e.target.value || null)}
          placeholder={variantSchema.default as string}
          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
        />
      );
    }

    if (variantType === 'number' || variantType === 'integer') {
      return (
        <input
          type="number"
          value={(value as number) ?? ''}
          onChange={(e) => {
            const val = e.target.value;
            if (val === '') {
              onChange(path, null);
            } else {
              onChange(path, variantType === 'integer' ? parseInt(val) : parseFloat(val));
            }
          }}
          min={variantSchema.minimum}
          max={variantSchema.maximum}
          step={variantType === 'integer' ? 1 : 'any'}
          className="flex-1 px-2 py-1 text-sm border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-transparent"
        />
      );
    }

    if (variantType === 'boolean') {
      return (
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={Boolean(value)}
            onChange={(e) => onChange(path, e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-8 h-4 bg-gray-200 peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-blue-500 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-blue-600"></div>
        </label>
      );
    }

    return null;
  };

  // At depth 0 (root level), children render at full width outside the header row
  // At deeper levels, children render inside the content area (indented)
  if (depth === 0) {
    return (
      <div className="mb-2">
        {/* Header row: label | variant selector + inline input for primitives */}
        <div className="flex items-start gap-3">
          <label className="flex-shrink-0 w-32 text-sm font-medium text-gray-700 pt-0.5">
            {title}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </label>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <select
                value={currentVariantIndex}
                onChange={(e) => handleVariantChange(parseInt(e.target.value))}
                className="text-xs px-2 py-1 border border-gray-200 rounded bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-shrink-0"
              >
                {hasNullVariant && (
                  <option value={variants.find((v) => v.isNull)?.index}>
                    None
                  </option>
                )}
                {selectableVariants.map((variant) => (
                  <option key={variant.index} value={variant.index}>
                    {variant.label}
                  </option>
                ))}
              </select>
              {/* Render primitive input inline */}
              {currentIsPrimitive && renderPrimitiveInput()}
            </div>
            {description && (
              <FieldDescription>{description}</FieldDescription>
            )}
          </div>
        </div>

        {/* Render the current variant's form field at full width (only for non-primitive types) */}
        {currentVariant && !currentVariant.isNull && !currentIsPrimitive && (
          <ChildrenContainer>
            <FormField
              name=""
              schema={currentVariant.resolvedSchema}
              value={value}
              path={path}
              onChange={onChange}
              depth={1}
              rootSchema={rootSchema}
              globalExpandLevel={globalExpandLevel}
                          />
          </ChildrenContainer>
        )}
      </div>
    );
  }

  // Deeper levels: children inside content area (indented)
  return (
    <div className="mb-2">
      {/* Header row: label | variant selector + inline input for primitives */}
      <div className="flex items-start gap-3">
        <label className="flex-shrink-0 w-32 text-sm font-medium text-gray-700 pt-0.5">
          {title}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </label>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <select
              value={currentVariantIndex}
              onChange={(e) => handleVariantChange(parseInt(e.target.value))}
              className="text-xs px-2 py-1 border border-gray-200 rounded bg-gray-50 text-gray-600 focus:outline-none focus:ring-1 focus:ring-blue-500 flex-shrink-0"
            >
              {hasNullVariant && (
                <option value={variants.find((v) => v.isNull)?.index}>
                  None
                </option>
              )}
              {selectableVariants.map((variant) => (
                <option key={variant.index} value={variant.index}>
                  {variant.label}
                </option>
              ))}
            </select>
            {/* Render primitive input inline */}
            {currentIsPrimitive && renderPrimitiveInput()}
          </div>
          {description && (
            <FieldDescription>{description}</FieldDescription>
          )}
        </div>
      </div>

      {/* Render the current variant's form field (only for non-primitive types) */}
      {currentVariant && !currentVariant.isNull && !currentIsPrimitive && (
        <ChildrenContainer>
          <FormField
            name=""
            schema={currentVariant.resolvedSchema}
            value={value}
            path={path}
            onChange={onChange}
            depth={0}
            rootSchema={rootSchema}
          />
        </ChildrenContainer>
      )}
    </div>
  );
}
