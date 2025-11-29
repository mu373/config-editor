import { useState, useEffect, useRef } from 'react';
import { ChevronDown, ChevronRight, Trash2 } from 'lucide-react';
import type { JSONSchema7 } from 'json-schema';
import { SortableArrayField } from './SortableArrayField';
import { VariantField } from './VariantField';
import { DictionaryField } from './DictionaryField';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../ui/select';
import { BufferedInput } from '../ui/input';
import { useTreeStore } from '../../store/treeStore';

// Shared component for field descriptions
// When inline=true (for fields with input/select), aligned under the input: ml = w-48 (12rem) + gap-3 (0.75rem) = 12.75rem
export function FieldDescription({ children, noMargin = false, inline = false }: { children: React.ReactNode; noMargin?: boolean; inline?: boolean }) {
  return <p className={`text-xs text-muted-foreground/70 ${inline ? 'ml-[12.75rem]' : ''} ${noMargin ? '' : 'mt-1'}`}>{children}</p>;
}

// Shared component for nested children container with left border
export function ChildrenContainer({ children }: { children: React.ReactNode }) {
  return <div className="mt-1 border-l-2 border-border pl-6">{children}</div>;
}

// Shared component for delete button with confirmation
interface ConfirmDeleteButtonProps {
  onDelete: () => void;
  className?: string;
  size?: 'sm' | 'default';
}

export function ConfirmDeleteButton({ onDelete, className = '', size = 'default' }: ConfirmDeleteButtonProps) {
  const [confirming, setConfirming] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  // Reset confirming state when clicking outside
  useEffect(() => {
    if (!confirming) return;

    const handleClickOutside = (e: MouseEvent) => {
      if (buttonRef.current && !buttonRef.current.contains(e.target as Node)) {
        setConfirming(false);
      }
    };

    // Also reset after a timeout
    const timeout = setTimeout(() => setConfirming(false), 3000);

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      clearTimeout(timeout);
    };
  }, [confirming]);

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (confirming) {
      onDelete();
      setConfirming(false);
    } else {
      setConfirming(true);
    }
  };

  const iconSize = size === 'sm' ? 'w-3 h-3' : 'w-3 h-3';
  const buttonSize = size === 'sm' ? 'p-1' : 'w-6 h-7';

  return (
    <div className="relative flex-shrink-0">
      <button
        ref={buttonRef}
        type="button"
        onClick={handleClick}
        className={`flex items-center justify-center ${buttonSize} ${
          confirming
            ? 'text-destructive'
            : 'text-muted-foreground hover:text-destructive'
        } ${className}`}
        title={confirming ? 'Click again to delete' : 'Delete'}
      >
        <Trash2 className={iconSize} />
      </button>
      {confirming && (
        <div className="absolute right-full top-1/2 -translate-y-1/2 mr-1 px-2 py-0.5 text-xs text-destructive/70 bg-destructive/10 border border-destructive/20 rounded whitespace-nowrap z-10">
          Confirm delete?
        </div>
      )}
    </div>
  );
}

// Shared component for field labels with array index styling
interface FieldLabelProps {
  name: string;
  title: string;
  required?: boolean;
  summaryLabel?: string | null;
  className?: string;
  as?: 'label' | 'span';
}

export function FieldLabel({ name, title, required, summaryLabel, className = '', as = 'label' }: FieldLabelProps) {
  const isArrayIndex = /^\[\d+\]$/.test(name);

  const renderContent = () => {
    if (isArrayIndex && summaryLabel) {
      return (
        <>
          <span className="font-mono text-xs text-muted-foreground/70">{name}</span>
          <span className="font-medium"> {summaryLabel}</span>
        </>
      );
    }
    if (isArrayIndex) {
      return <span className="font-mono text-xs text-muted-foreground/70">{name}</span>;
    }
    return title;
  };

  const Tag = as;
  return (
    <Tag className={`text-sm ${isArrayIndex ? '' : 'font-medium'} text-foreground ${className}`}>
      {renderContent()}
      {required && <span className="text-red-500 ml-0.5">*</span>}
    </Tag>
  );
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
  // Use treeStore for form expansion state
  // Subscribe to manuallyToggledFormPaths to trigger re-renders when paths are expanded via navigation
  const { isFormPathExpanded, toggleFormPath, manuallyToggledFormPaths } = useTreeStore();

  // Determine expanded state:
  // 1. If controlled by parent (isExpandedControlled), use that
  // 2. Otherwise use treeStore
  // Note: We reference manuallyToggledFormPaths.has(path) to ensure reactivity
  const _isManuallyToggled = manuallyToggledFormPaths.has(path);
  const isExpanded = isExpandedControlled !== undefined
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
  const title = effectiveSchema.title || name;
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
    const NONE_VALUE = '__none__';
    const isArrayItem = /^\[\d+\]$/.test(name);
    return (
      <div data-field-path={path} className={isArrayItem ? '' : 'py-2'}>
        <div className={`flex items-center gap-3 ${isArrayItem ? 'h-7' : ''}`}>
          <FieldLabel name={name} title={title} required={required} summaryLabel={summaryLabel} className={`flex-shrink-0 ${isArrayItem ? '' : 'w-48'}`} />
          <div className="flex-1 min-w-0">
            <Select
              value={(value as string) || (nullable ? NONE_VALUE : undefined)}
              onValueChange={(val) => onChange(path, val === NONE_VALUE ? null : val)}
            >
              <SelectTrigger size="sm" className={`w-full text-sm ${isArrayItem ? 'h-7' : 'h-8'}`}>
                <SelectValue placeholder={nullable ? '-- None --' : 'Select...'} />
              </SelectTrigger>
              <SelectContent>
                {nullable && <SelectItem value={NONE_VALUE}>-- None --</SelectItem>}
                {effectiveSchema.enum.map((opt) => (
                  <SelectItem key={String(opt)} value={String(opt)}>
                    {String(opt)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
        {description && !isArrayItem && (
          <FieldDescription inline>{description}</FieldDescription>
        )}
      </div>
    );
  }

  // Handle string type
  if (schemaType === 'string') {
    const isDate = effectiveSchema.format === 'date';
    const isDateTime = effectiveSchema.format === 'date-time';
    const inputType = isDate ? 'date' : isDateTime ? 'datetime-local' : 'text';
    const isArrayItem = /^\[\d+\]$/.test(name);

    // Convert value to HTML input format for date/datetime
    let inputValue = '';

    if (value instanceof Date) {
      // Value is already a Date object
      if (isDate) {
        inputValue = value.toISOString().split('T')[0];
      } else if (isDateTime) {
        const year = value.getFullYear();
        const month = String(value.getMonth() + 1).padStart(2, '0');
        const day = String(value.getDate()).padStart(2, '0');
        const hours = String(value.getHours()).padStart(2, '0');
        const minutes = String(value.getMinutes()).padStart(2, '0');
        inputValue = `${year}-${month}-${day}T${hours}:${minutes}`;
      }
    } else if (typeof value === 'string') {
      // Value is a string, try to parse it
      if (isDate && value) {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            inputValue = date.toISOString().split('T')[0];
          } else {
            inputValue = value;
          }
        } catch {
          inputValue = value;
        }
      } else if (isDateTime && value) {
        try {
          const date = new Date(value);
          if (!isNaN(date.getTime())) {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            const day = String(date.getDate()).padStart(2, '0');
            const hours = String(date.getHours()).padStart(2, '0');
            const minutes = String(date.getMinutes()).padStart(2, '0');
            inputValue = `${year}-${month}-${day}T${hours}:${minutes}`;
          } else {
            inputValue = value;
          }
        } catch {
          inputValue = value;
        }
      } else {
        inputValue = value;
      }
    }

    return (
      <div data-field-path={path} className={isArrayItem ? '' : 'py-2'}>
        <div className={`flex items-center gap-3 ${isArrayItem ? 'h-7' : ''}`}>
          <FieldLabel name={name} title={title} required={required} summaryLabel={summaryLabel} className={`flex-shrink-0 ${isArrayItem ? '' : 'w-48'}`} />
          <div className="flex-1 min-w-0">
            <BufferedInput
              type={inputType}
              size="sm"
              value={inputValue}
              onChange={(e) => onChange(path, e.target.value || (nullable ? null : ''))}
              placeholder={effectiveSchema.default as string}
            />
          </div>
        </div>
        {description && !isArrayItem && (
          <FieldDescription inline>{description}</FieldDescription>
        )}
      </div>
    );
  }

  // Handle number/integer type - use text input to avoid browser number input quirks
  if (schemaType === 'number' || schemaType === 'integer') {
    const isArrayItem = /^\[\d+\]$/.test(name);
    // Convert to string for display, keeping empty string for null/undefined
    const stringValue = value === null || value === undefined ? '' : String(value);

    return (
      <div data-field-path={path} className={isArrayItem ? '' : 'py-2'}>
        <div className={`flex items-center gap-3 ${isArrayItem ? 'h-7' : ''}`}>
          <div className={`flex-shrink-0 ${isArrayItem ? '' : 'w-48'}`}>
            <FieldLabel name={name} title={title} required={required} summaryLabel={summaryLabel} />
            {(effectiveSchema.minimum !== undefined || effectiveSchema.maximum !== undefined) && !isArrayItem && (
              <p className="text-xs text-muted-foreground mt-0.5">
                Range: {effectiveSchema.minimum ?? '-∞'} - {effectiveSchema.maximum ?? '∞'}
              </p>
            )}
          </div>
          <div className="flex-1 min-w-0">
            <BufferedInput
              type="text"
              inputMode="decimal"
              size="sm"
              value={stringValue}
              onChange={(e) => {
                const val = e.target.value;
                if (val === '') {
                  onChange(path, nullable ? null : 0);
                } else {
                  const num = schemaType === 'integer' ? parseInt(val, 10) : parseFloat(val);
                  // Only update if it's a valid number
                  if (!isNaN(num)) {
                    onChange(path, num);
                  }
                }
              }}
            />
          </div>
        </div>
        {description && !isArrayItem && (
          <FieldDescription inline>{description}</FieldDescription>
        )}
      </div>
    );
  }

  // Handle boolean type
  if (schemaType === 'boolean') {
    const isArrayItem = /^\[\d+\]$/.test(name);
    return (
      <div data-field-path={path} className={isArrayItem ? '' : 'py-2'}>
        <div className={`flex items-center gap-3 ${isArrayItem ? 'h-7' : ''}`}>
          <FieldLabel name={name} title={title} required={required} summaryLabel={summaryLabel} className={`flex-shrink-0 ${isArrayItem ? '' : 'w-48'}`} />
          <div className="flex-1 min-w-0">
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={Boolean(value)}
                onChange={(e) => onChange(path, e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-8 h-4 bg-input peer-focus:outline-none peer-focus:ring-1 peer-focus:ring-ring rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-background after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-background after:border-border after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-primary"></div>
            </label>
          </div>
        </div>
        {description && !isArrayItem && (
          <FieldDescription inline>{description}</FieldDescription>
        )}
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

  // Handle dictionary/map type (object with additionalProperties or patternProperties but no fixed properties)
  if (schemaType === 'object' && !effectiveSchema.properties) {
    const hasAdditionalProps = effectiveSchema.additionalProperties && typeof effectiveSchema.additionalProperties === 'object';
    const hasPatternProps = effectiveSchema.patternProperties && typeof effectiveSchema.patternProperties === 'object';

    if (hasAdditionalProps || hasPatternProps) {
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
  }

  // Handle object type
  if (schemaType === 'object' && effectiveSchema.properties) {
    const objValue = (value as Record<string, unknown>) ?? {};

    // At depth 0 (root level), children render at full width outside the header row
    // At deeper levels, children render inside the content area (indented)
    const isArrayItem = /^\[\d+\]$/.test(name);
    if (depth === 0) {
      return (
        <div data-field-path={path} className={isArrayItem ? '' : 'py-2'}>
          {/* Header row: label with chevron */}
          <div
            className={`flex items-center gap-1 cursor-pointer ${isArrayItem ? 'h-7' : 'h-6'}`}
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <FieldLabel name={name} title={title} required={required} summaryLabel={summaryLabel} as="span" />
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
          </div>
          {/* Hide description for array items */}
          {description && !isArrayItem && (
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
      <div data-field-path={path} className={isArrayItem ? '' : 'py-2'}>
        {/* Header row: label with chevron */}
        <div
          className={`flex items-center gap-1 cursor-pointer ${isArrayItem ? 'h-7' : ''}`}
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <FieldLabel name={name} title={title} required={required} summaryLabel={summaryLabel} as="span" />
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          )}
        </div>
        {/* Hide description for array items */}
        {description && !isArrayItem && (
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

  const isArrayItem = /^\[\d+\]$/.test(name);
  return (
    <div data-field-path={path} className={isArrayItem ? '' : 'py-2'}>
      <div className={`flex items-center gap-3 ${isArrayItem ? 'h-7' : ''}`}>
        <FieldLabel name={name} title={title} required={required} summaryLabel={summaryLabel} className={`flex-shrink-0 ${isArrayItem ? '' : 'w-48'}`} />
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
        <FieldDescription inline>{description}</FieldDescription>
      )}
    </div>
  );
}
