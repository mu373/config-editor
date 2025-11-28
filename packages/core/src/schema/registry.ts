import type { JSONSchema } from './loader';

export interface SchemaPreset {
  id: string;
  name: string;
  description?: string;
  schema: JSONSchema;
  defaultContent?: string;
}

const schemaRegistry: SchemaPreset[] = [];

export function registerSchema(preset: SchemaPreset): void {
  const existing = schemaRegistry.findIndex((p) => p.id === preset.id);
  if (existing >= 0) {
    schemaRegistry[existing] = preset;
  } else {
    schemaRegistry.push(preset);
  }
}

export function getSchemaById(id: string): SchemaPreset | undefined {
  return schemaRegistry.find((p) => p.id === id);
}

export function getAllSchemas(): SchemaPreset[] {
  return [...schemaRegistry];
}

export function clearRegistry(): void {
  schemaRegistry.length = 0;
}
