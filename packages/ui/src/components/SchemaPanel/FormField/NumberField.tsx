import { memo } from 'react';
import type { JSONSchema7 } from 'json-schema';
import { BufferedInput } from '../../ui/input';
import { FieldLabel, FieldDescription } from './shared';

export interface NumberFieldProps {
  name: string;
  schema: JSONSchema7;
  value: unknown;
  path: string;
  required?: boolean;
  onChange: (path: string, value: unknown) => void;
  summaryLabel?: string | null;
  nullable?: boolean;
  title: string;
  description?: string;
  schemaType: 'number' | 'integer';
}

export const NumberField = memo(function NumberField({
  name,
  schema,
  value,
  path,
  required = false,
  onChange,
  summaryLabel,
  nullable = false,
  title,
  description,
  schemaType,
}: NumberFieldProps) {
  const isArrayItem = /^\[\d+\]$/.test(name);
  const stringValue = value === null || value === undefined ? '' : String(value);

  return (
    <div data-field-path={path} className={isArrayItem ? '' : 'py-4'}>
      <div className={`flex items-center gap-3 ${isArrayItem ? 'h-7' : ''}`}>
        <div className={`flex-shrink-0 ${isArrayItem ? '' : 'w-48'}`}>
          <FieldLabel name={name} title={title} required={required} summaryLabel={summaryLabel} />
          {(schema.minimum !== undefined || schema.maximum !== undefined) && !isArrayItem && (
            <p className="text-xs text-muted-foreground mt-0.5">
              Range: {schema.minimum ?? '-∞'} - {schema.maximum ?? '∞'}
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
                if (!isNaN(num)) {
                  onChange(path, num);
                }
              }
            }}
          />
        </div>
      </div>
      {description && !isArrayItem && <FieldDescription inline>{description}</FieldDescription>}
    </div>
  );
});
