import { memo } from 'react';
import { FieldLabel, FieldDescription } from './shared';

export interface BooleanFieldProps {
  name: string;
  value: unknown;
  path: string;
  required?: boolean;
  onChange: (path: string, value: unknown) => void;
  summaryLabel?: string | null;
  title: string;
  description?: string;
}

export const BooleanField = memo(function BooleanField({
  name,
  value,
  path,
  required = false,
  onChange,
  summaryLabel,
  title,
  description,
}: BooleanFieldProps) {
  const isArrayItem = /^\[\d+\]$/.test(name);

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
      {description && !isArrayItem && <FieldDescription inline>{description}</FieldDescription>}
    </div>
  );
});
