import type { JSONSchema7 } from 'json-schema';
import { resolveRef } from '@config-editor/core';
import { VariantField } from './VariantField';
import { BufferedInput } from '../ui/input';
import { useTreeStore } from '../../store/treeStore';
import type { GlobalExpandLevel } from './types';

// Import type-specific field components
import { EnumField } from './FormField/EnumField';
import { StringField } from './FormField/StringField';
import { NumberField } from './FormField/NumberField';
import { BooleanField } from './FormField/BooleanField';
import { ObjectField } from './FormField/ObjectField';
import { ArrayFieldWrapper } from './FormField/ArrayFieldWrapper';
import { DictionaryFieldWrapper } from './FormField/DictionaryFieldWrapper';

// Re-export shared components for backwards compatibility
export { FieldLabel, FieldDescription, ChildrenContainer, ConfirmDeleteButton } from './FormField/shared';
export type { GlobalExpandLevel };

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
  isExpandedControlled?: boolean;
  onExpandedChange?: (expanded: boolean) => void;
  summaryLabel?: string | null;
  globalExpandLevel?: GlobalExpandLevel;
}

export function FormField(props: FormFieldProps) {
  const {
    name,
    schema,
    value,
    path,
    required = false,
    onChange,
    depth = 0,
    rootSchema,
    isExpandedControlled,
    onExpandedChange,
    summaryLabel,
    globalExpandLevel = null,
  } = props;

  // Use treeStore for form expansion state
  const { isFormPathExpanded, toggleFormPath, manuallyToggledFormPaths } = useTreeStore();

  // Determine expanded state
  const _isManuallyToggled = manuallyToggledFormPaths.has(path);
  const isExpanded =
    isExpandedControlled !== undefined
      ? isExpandedControlled
      : isFormPathExpanded(path, depth, globalExpandLevel);

  const setIsExpanded = (expanded: boolean) => {
    if (onExpandedChange) {
      onExpandedChange(expanded);
    } else {
      toggleFormPath(path);
    }
  };

  // Resolve $ref if present
  const resolvedSchema = rootSchema ? resolveRef(schema, rootSchema) : schema;
  // Spread schema first, then resolvedSchema to let resolved content override
  // Keep original title/description if present
  let effectiveSchema: JSONSchema7 = {
    ...resolvedSchema,
    title: schema.title || resolvedSchema.title,
    description: schema.description || resolvedSchema.description,
  };
  delete effectiveSchema.$ref;

  // Merge allOf schemas into effectiveSchema
  if (effectiveSchema.allOf && Array.isArray(effectiveSchema.allOf)) {
    let mergedProperties: Record<string, JSONSchema7> = {};
    let mergedRequired: string[] = [];
    let mergedType: JSONSchema7['type'];

    for (const subSchema of effectiveSchema.allOf) {
      const sub = subSchema as JSONSchema7;
      // Merge properties
      if (sub.properties) {
        Object.entries(sub.properties).forEach(([key, val]) => {
          if (typeof val === 'object') {
            mergedProperties[key] = val as JSONSchema7;
          }
        });
      }
      // Merge required
      if (sub.required) {
        mergedRequired = [...mergedRequired, ...sub.required];
      }
      // Take type from first subschema that has it
      if (sub.type && !mergedType) {
        mergedType = sub.type;
      }
    }

    // Create new schema with merged properties
    effectiveSchema = {
      ...effectiveSchema,
      properties: Object.keys(mergedProperties).length > 0 ? mergedProperties : effectiveSchema.properties,
      required: mergedRequired.length > 0 ? mergedRequired : effectiveSchema.required,
      type: mergedType || effectiveSchema.type
    };
  }

  // Helper function to get the effective type from a schema
  function getTypeFromSchema(s: JSONSchema7): string | undefined {
    if (s.type) {
      if (Array.isArray(s.type)) {
        return s.type.find((t) => t !== 'null') || 'string';
      }
      return s.type as string;
    }
    // Infer type from schema structure if type is not explicitly set
    if (s.properties || s.additionalProperties || s.patternProperties) return 'object';
    if (s.items) return 'array';
    if (s.enum) return 'string';
    // Check inside allOf for type information
    if (s.allOf && Array.isArray(s.allOf)) {
      for (const subSchema of s.allOf) {
        const subType = getTypeFromSchema(subSchema as JSONSchema7);
        if (subType) return subType;
      }
    }
    return undefined;
  }

  // Check if the original schema allows null (before expansion)
  const originalHasNullVariant =
    (Array.isArray(effectiveSchema.type) && effectiveSchema.type.includes('null')) ||
    effectiveSchema.anyOf?.some((v) => (v as JSONSchema7).type === 'null') ||
    effectiveSchema.oneOf?.some((v) => (v as JSONSchema7).type === 'null');

  // Helper to merge allOf schemas
  function mergeAllOf(schema: JSONSchema7): JSONSchema7 {
    if (!schema.allOf || !Array.isArray(schema.allOf)) {
      return schema;
    }

    let mergedProperties: Record<string, JSONSchema7> = {};
    let mergedRequired: string[] = [];
    let mergedType: JSONSchema7['type'];

    for (const subSchema of schema.allOf) {
      const sub = subSchema as JSONSchema7;
      if (sub.properties) {
        Object.entries(sub.properties).forEach(([key, val]) => {
          if (typeof val === 'object') {
            mergedProperties[key] = val as JSONSchema7;
          }
        });
      }
      if (sub.required) {
        mergedRequired = [...mergedRequired, ...sub.required];
      }
      if (sub.type && !mergedType) {
        mergedType = sub.type;
      }
    }

    return {
      ...schema,
      properties: Object.keys(mergedProperties).length > 0 ? mergedProperties : schema.properties,
      required: mergedRequired.length > 0 ? mergedRequired : schema.required,
      type: mergedType || schema.type
    };
  }

  // For anyOf/oneOf with a single non-null variant (possibly via $ref),
  // resolve and expand that variant as the effective schema
  function resolveNullableRef(s: JSONSchema7): JSONSchema7 {
    const variants = s.anyOf || s.oneOf;
    if (!variants) return s;

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
          nonNullVariants.push({ schema: variant, resolved: mergeAllOf(resolved) });
        }
      } else if (variant.type && variant.type !== 'null') {
        nonNullVariants.push({ schema: variant, resolved: mergeAllOf(variant) });
      } else if (!variant.type && !variant.$ref) {
        nonNullVariants.push({ schema: variant, resolved: mergeAllOf(variant) });
      }
    }

    if (nonNullVariants.length === 1) {
      const { resolved } = nonNullVariants[0];
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

  const title = effectiveSchema.title || name;
  const description = effectiveSchema.description;


  // Determine the effective type, handling anyOf/oneOf for nullable types
  function getEffectiveType(s: JSONSchema7): string | undefined {
    const directType = getTypeFromSchema(s);
    if (directType) return directType;

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
  const nullable = originalHasNullVariant;

  // Check for polymorphic schemas (anyOf/oneOf with multiple non-null variants)
  const variants = effectiveSchema.anyOf || effectiveSchema.oneOf;
  if (variants) {
    const nonNullVariants = variants.filter((v) => {
      const variant = v as JSONSchema7;
      const isValidationOnly = !variant.type && !variant.properties && !variant.$ref && !variant.items;
      if (isValidationOnly) return false;

      if (!variant.type) return true;
      if (Array.isArray(variant.type)) {
        return variant.type.some((t) => t !== 'null');
      }
      return variant.type !== 'null';
    });

    // Always delegate to VariantField when there are multiple non-null variants
    // VariantField will handle variant detection and selection
    if (nonNullVariants.length > 1) {
      return <VariantField {...props} schema={effectiveSchema} />;
    }
  }

  // Route to appropriate field component based on schema type
  const commonProps = {
    name,
    value,
    path,
    required,
    onChange,
    summaryLabel,
    title,
    description,
  };

  // Handle enum type
  if (effectiveSchema.enum) {
    return <EnumField {...commonProps} schema={effectiveSchema} nullable={nullable} />;
  }

  // Handle string type
  if (schemaType === 'string') {
    return <StringField {...commonProps} schema={effectiveSchema} nullable={nullable} />;
  }

  // Handle number/integer type
  if (schemaType === 'number' || schemaType === 'integer') {
    return (
      <NumberField
        {...commonProps}
        schema={effectiveSchema}
        nullable={nullable}
        schemaType={schemaType}
      />
    );
  }

  // Handle boolean type
  if (schemaType === 'boolean') {
    return <BooleanField {...commonProps} />;
  }

  // Handle array type
  if (schemaType === 'array' && effectiveSchema.items) {
    return (
      <ArrayFieldWrapper
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

  // Handle dictionary/map type
  if (schemaType === 'object' && !effectiveSchema.properties) {
    const hasAdditionalProps =
      effectiveSchema.additionalProperties && typeof effectiveSchema.additionalProperties === 'object';
    const hasPatternProps =
      effectiveSchema.patternProperties && typeof effectiveSchema.patternProperties === 'object';

    if (hasAdditionalProps || hasPatternProps) {
      return (
        <DictionaryFieldWrapper
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

  // Handle object type
  // Check if schema has properties (either directly or in allOf)
  const hasProperties = effectiveSchema.properties ||
    (effectiveSchema.allOf && effectiveSchema.allOf.some((s) => !!(s as JSONSchema7).properties));


  if (schemaType === 'object' && hasProperties) {
    return (
      <ObjectField
        {...commonProps}
        schema={effectiveSchema}
        depth={depth}
        rootSchema={rootSchema}
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
        globalExpandLevel={globalExpandLevel}
        FormField={FormField}
      />
    );
  }

  // Fallback for unknown types - treat as string
  const isArrayItem = /^\[\d+\]$/.test(name);
  const stringValue =
    value === null || value === undefined
      ? ''
      : typeof value === 'string'
        ? value
        : typeof value === 'object'
          ? JSON.stringify(value, null, 2)
          : String(value);

  return (
    <div data-field-path={path} className={isArrayItem ? '' : 'py-4'}>
      <div className={`flex items-center gap-3 ${isArrayItem ? 'h-7' : ''}`}>
        <div className={`flex-shrink-0 ${isArrayItem ? '' : 'w-48'}`}>
          <span className="text-sm font-medium text-foreground">{title}</span>
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </div>
        <div className="flex-1 min-w-0">
          <BufferedInput
            type="text"
            size="sm"
            value={stringValue}
            onChange={(e) => onChange(path, e.target.value || (nullable ? null : ''))}
          />
        </div>
      </div>
      {description && !isArrayItem && (
        <p className="text-xs text-muted-foreground/70 ml-[12.75rem] mt-1">{description}</p>
      )}
    </div>
  );
}
