import type { JSONSchema7 } from 'json-schema';
import { DictionaryField } from '../DictionaryField';
import type { GlobalExpandLevel } from '../types';

export interface DictionaryFieldWrapperProps {
  name: string;
  schema: JSONSchema7;
  value: unknown;
  path: string;
  required?: boolean;
  onChange: (path: string, value: unknown) => void;
  depth?: number;
  rootSchema?: JSONSchema7;
  globalExpandLevel?: GlobalExpandLevel;
}

export function DictionaryFieldWrapper({
  name,
  schema,
  value,
  path,
  required = false,
  onChange,
  depth = 0,
  rootSchema,
  globalExpandLevel,
}: DictionaryFieldWrapperProps) {
  return (
    <DictionaryField
      name={name}
      schema={schema}
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
