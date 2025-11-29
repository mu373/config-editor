import { memo } from 'react';
import type { JSONSchema7 } from 'json-schema';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { FieldLabel, FieldDescription, ChildrenContainer } from './shared';
import type { GlobalExpandLevel } from '../types';

export interface ObjectFieldProps {
  name: string;
  schema: JSONSchema7;
  value: unknown;
  path: string;
  required?: boolean;
  onChange: (path: string, value: unknown) => void;
  depth?: number;
  rootSchema?: JSONSchema7;
  summaryLabel?: string | null;
  title: string;
  description?: string;
  isExpanded: boolean;
  setIsExpanded: (expanded: boolean) => void;
  globalExpandLevel?: GlobalExpandLevel;
  FormField: React.ComponentType<any>;
}

export const ObjectField = memo(function ObjectField({
  name,
  schema,
  value,
  path,
  required = false,
  onChange,
  depth = 0,
  rootSchema,
  summaryLabel,
  title,
  description,
  isExpanded,
  setIsExpanded,
  globalExpandLevel,
  FormField,
}: ObjectFieldProps) {
  const objValue = (value as Record<string, unknown>) ?? {};
  const isArrayItem = /^\[\d+\]$/.test(name);

  // At depth 0 (root level), children render at full width outside the header row
  if (depth === 0) {
    return (
      <div data-field-path={path} className={isArrayItem ? '' : 'py-4'}>
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
        {description && !isArrayItem && <FieldDescription>{description}</FieldDescription>}

        {isExpanded && (
          <ChildrenContainer>
            {Object.entries(schema.properties || {}).map(([key, propSchema]) => (
              <FormField
                key={key}
                name={key}
                schema={propSchema as JSONSchema7}
                value={objValue[key]}
                path={`${path}.${key}`}
                required={schema.required?.includes(key)}
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
    <div data-field-path={path} className={isArrayItem ? '' : 'py-4'}>
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
      {description && !isArrayItem && <FieldDescription>{description}</FieldDescription>}

      {isExpanded && (
        <ChildrenContainer>
          {Object.entries(schema.properties || {}).map(([key, propSchema]) => (
            <FormField
              key={key}
              name={key}
              schema={propSchema as JSONSchema7}
              value={objValue[key]}
              path={`${path}.${key}`}
              required={schema.required?.includes(key)}
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
});
