import type { JSONSchema7 } from 'json-schema';

export type JSONSchema = JSONSchema7;

export async function loadSchemaFromUrl(url: string): Promise<JSONSchema> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to load schema from ${url}: ${response.statusText}`);
  }
  return response.json() as Promise<JSONSchema>;
}

export function loadSchemaFromJson(json: string): JSONSchema {
  return JSON.parse(json) as JSONSchema;
}
