import type { JSONSchema7 } from 'json-schema';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '../../ui/select';
import { FieldLabel, FieldDescription } from './shared';

export interface EnumFieldProps {
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

export function EnumField({
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
}: EnumFieldProps) {
  const NONE_VALUE = '__none__';
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
          <Select
            value={(value as string) || (nullable ? NONE_VALUE : undefined)}
            onValueChange={(val) => onChange(path, val === NONE_VALUE ? null : val)}
          >
            <SelectTrigger size="sm" className={`w-full text-sm ${isArrayItem ? 'h-7' : 'h-8'}`}>
              <SelectValue placeholder={nullable ? '-- None --' : 'Select...'} />
            </SelectTrigger>
            <SelectContent>
              {nullable && <SelectItem value={NONE_VALUE}>-- None --</SelectItem>}
              {schema.enum?.map((opt) => (
                <SelectItem key={String(opt)} value={String(opt)}>
                  {String(opt)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      {description && !isArrayItem && <FieldDescription inline>{description}</FieldDescription>}
    </div>
  );
}
