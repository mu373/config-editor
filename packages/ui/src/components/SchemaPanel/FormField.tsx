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
    effectiveSchema.anyOf?.some((v) => (v as JSONSchema7).type === 'null') ||
    effectiveSchema.oneOf?.some((v) => (v as JSONSchema7).type === 'null');

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
          nonNullVariants.push({ schema: variant, resolved });
        }
      } else if (variant.type && variant.type !== 'null') {
        nonNullVariants.push({ schema: variant, resolved: variant });
      } else if (!variant.type && !variant.$ref) {
        nonNullVariants.push({ schema: variant, resolved: variant });
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

    // Auto-detect variant based on value
    if (nonNullVariants.length > 1 && value !== null && value !== undefined) {
      if (Array.isArray(value)) {
        const arrayVariant = nonNullVariants.find((v) => {
          const variant = v as JSONSchema7;
          return variant.type === 'array' || variant.items;
        });
        if (arrayVariant) {
          effectiveSchema = arrayVariant as JSONSchema7;
        } else {
          return <VariantField {...props} schema={effectiveSchema} />;
        }
      } else if (typeof value === 'object') {
        const objectVariant = nonNullVariants.find((v) => {
          const variant = v as JSONSchema7;
          return variant.type === 'object' || variant.properties || variant.additionalProperties;
        });
        if (objectVariant) {
          effectiveSchema = objectVariant as JSONSchema7;
        } else {
          return <VariantField {...props} schema={effectiveSchema} />;
        }
      } else {
        return <VariantField {...props} schema={effectiveSchema} />;
      }
    } else if (nonNullVariants.length > 1) {
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
  if (schemaType === 'object' && effectiveSchema.properties) {
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
