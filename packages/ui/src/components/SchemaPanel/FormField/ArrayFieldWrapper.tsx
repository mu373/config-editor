import type { JSONSchema7 } from 'json-schema';
import { SortableArrayField } from '../SortableArrayField';
import type { GlobalExpandLevel } from '../types';

export interface ArrayFieldWrapperProps {
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

export function ArrayFieldWrapper({
  name,
  schema,
  value,
  path,
  required = false,
  onChange,
  depth = 0,
  rootSchema,
  globalExpandLevel,
}: ArrayFieldWrapperProps) {
  return (
    <SortableArrayField
      name={name}
      schema={schema}
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
