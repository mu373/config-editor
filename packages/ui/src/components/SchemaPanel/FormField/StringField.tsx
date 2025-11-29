import { memo } from 'react';
import type { JSONSchema7 } from 'json-schema';
import { BufferedInput } from '../../ui/input';
import { FieldLabel, FieldDescription } from './shared';

export interface StringFieldProps {
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
}

export const StringField = memo(function StringField({
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
}: StringFieldProps) {
  const isDate = schema.format === 'date';
  const isDateTime = schema.format === 'date-time';
  const inputType = isDate ? 'date' : isDateTime ? 'datetime-local' : 'text';
  const isArrayItem = /^\[\d+\]$/.test(name);

  // Convert value to HTML input format for date/datetime
  let inputValue = '';

  if (value instanceof Date) {
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
    <div data-field-path={path} className={isArrayItem ? '' : 'py-4'}>
      <div className={`flex items-center gap-3 ${isArrayItem ? 'h-7' : ''}`}>
        <FieldLabel
          name={name}
          title={title}
          required={required}
          summaryLabel={summaryLabel}
          className={`flex-shrink-0 ${isArrayItem ? '' : 'w-48'}`}
        />
        <div className="flex-1 min-w-0">
          <BufferedInput
            type={inputType}
            size="sm"
            value={inputValue}
            onChange={(e) => onChange(path, e.target.value || (nullable ? null : ''))}
            placeholder={schema.default as string}
          />
        </div>
      </div>
      {description && !isArrayItem && <FieldDescription inline>{description}</FieldDescription>}
    </div>
  );
});
