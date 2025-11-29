import { useState, useMemo, useCallback } from 'react';
import type { JSONSchema7 } from 'json-schema';
import { FormField, FieldDescription, ChildrenContainer, FieldLabel, type GlobalExpandLevel } from './FormField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { Input } from '../ui/input';

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

  // First pass: Check for exact enum matches (more specific)
  if (valueType === 'string') {
    for (const variant of variants) {
      if (variant.isNull) continue;
      const schema = variant.resolvedSchema;
      if (schema.enum && schema.enum.includes(value)) {
        return variant.index;
      }
    }
  }

  // Second pass: Check for type matches (more generic)
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
        <Select
          value={(value as string) ?? ''}
          onValueChange={(val) => onChange(path, val || null)}
        >
          <SelectTrigger size="sm" className="flex-1 h-8 text-sm">
            <SelectValue placeholder="-- Select --" />
          </SelectTrigger>
          <SelectContent>
            {variantSchema.enum.map((opt) => (
              <SelectItem key={String(opt)} value={String(opt)}>
                {String(opt)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      );
    }

    if (variantType === 'string') {
      const isDate = variantSchema.format === 'date';
      const isDateTime = variantSchema.format === 'date-time';
      return (
        <Input
          type={isDate ? 'date' : isDateTime ? 'datetime-local' : 'text'}
          size="sm"
          value={(value as string) ?? ''}
          onChange={(e) => onChange(path, e.target.value || null)}
          placeholder={variantSchema.default as string}
          className="flex-1"
        />
      );
    }

    if (variantType === 'number' || variantType === 'integer') {
      return (
        <Input
          type="number"
          size="sm"
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
          className="flex-1"
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
          <div className="w-8 h-4 bg-input peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-input after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
        </label>
      );
    }

    return null;
  };

  // Check if this is an array item (name like [0], [1], etc.)
  const isArrayItem = /^\[\d+\]$/.test(name);

  // At depth 0 (root level), children render at full width outside the header row
  // At deeper levels, children render inside the content area (indented)
  if (depth === 0) {
    return (
      <div className={isArrayItem ? '' : 'py-2'}>
        {/* Header row: label | variant selector + inline input for primitives */}
        <div className={`flex items-center gap-3 ${isArrayItem ? 'h-7' : ''}`}>
          <FieldLabel name={name} title={title} required={required} className={`flex-shrink-0 ${isArrayItem ? '' : 'w-48'}`} />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <Select
                value={String(currentVariantIndex)}
                onValueChange={(val) => handleVariantChange(parseInt(val))}
              >
                <SelectTrigger size="sm" className="h-7 text-xs px-2 bg-muted text-muted-foreground flex-shrink-0 w-auto">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {hasNullVariant && (
                    <SelectItem value={String(variants.find((v) => v.isNull)?.index)}>
                      None
                    </SelectItem>
                  )}
                  {selectableVariants.map((variant) => (
                    <SelectItem key={variant.index} value={String(variant.index)}>
                      {variant.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* Render primitive input inline */}
              {currentIsPrimitive && renderPrimitiveInput()}
            </div>
          </div>
        </div>
        {description && !isArrayItem && (
          <FieldDescription inline>{description}</FieldDescription>
        )}

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
    <div className={isArrayItem ? '' : 'py-2'}>
      {/* Header row: label | variant selector + inline input for primitives */}
      <div className={`flex items-center gap-3 ${isArrayItem ? 'h-7' : ''}`}>
        <FieldLabel name={name} title={title} required={required} className={`flex-shrink-0 ${isArrayItem ? '' : 'w-48'}`} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Select
              value={String(currentVariantIndex)}
              onValueChange={(val) => handleVariantChange(parseInt(val))}
            >
              <SelectTrigger size="sm" className="h-7 text-xs px-2 bg-muted text-muted-foreground flex-shrink-0 w-auto">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {hasNullVariant && (
                  <SelectItem value={String(variants.find((v) => v.isNull)?.index)}>
                    None
                  </SelectItem>
                )}
                {selectableVariants.map((variant) => (
                  <SelectItem key={variant.index} value={String(variant.index)}>
                    {variant.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* Render primitive input inline */}
            {currentIsPrimitive && renderPrimitiveInput()}
          </div>
        </div>
      </div>
      {description && !isArrayItem && (
        <FieldDescription inline>{description}</FieldDescription>
      )}

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
