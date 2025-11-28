export function parseJson(content: string): unknown {
  return JSON.parse(content);
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export type Format = 'yaml' | 'json';

export function detectFormat(content: string): Format {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON, assume YAML
    }
  }
  return 'yaml';
}
