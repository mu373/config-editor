import * as jsonc from 'jsonc-parser';

export function parseJson(content: string): unknown {
  return JSON.parse(content);
}

export function stringifyJson(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Parse JSONC (JSON with Comments) content.
 * Falls back to regular JSON.parse if parsing fails.
 */
export function parseJsonc(content: string): unknown {
  const errors: jsonc.ParseError[] = [];
  const result = jsonc.parse(content, errors, { allowTrailingComma: true });

  if (errors.length > 0) {
    // If JSONC parsing fails, try regular JSON
    return JSON.parse(content);
  }

  return result;
}

/**
 * Stringify to JSONC format (same as JSON for now).
 * Comments will be preserved when using updateJsonPreservingComments.
 */
export function stringifyJsonc(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

/**
 * Update JSON/JSONC content while preserving comments and formatting.
 * This uses jsonc-parser to surgically update only the changed values.
 *
 * @param originalJson - The original JSON/JSONC content (with potential comments)
 * @param newValue - The new value to apply
 * @returns Updated JSON content with comments preserved
 */
export function updateJsonPreservingComments(
  originalJson: string,
  newValue: unknown
): string {
  try {
    // Parse the new value to get paths that need updating
    const edits = generateEdits(originalJson, newValue);

    // Apply all edits to the original content
    const result = jsonc.applyEdits(originalJson, edits);
    return result;
  } catch (error) {
    // Fallback to regular serialization if patching fails
    console.warn('Failed to preserve JSON comments, falling back to regular serialization:', error);
    return stringifyJsonc(newValue);
  }
}

/**
 * Generate edit operations to transform original JSON to match newValue.
 * This recursively compares the structures and creates minimal edits.
 */
function generateEdits(
  originalJson: string,
  newValue: unknown
): jsonc.Edit[] {
  const edits: jsonc.Edit[] = [];
  const originalValue = parseJsonc(originalJson);

  // Generate edits by comparing old and new values
  generateEditsRecursive([], originalValue, newValue, edits);

  return edits;
}

function generateEditsRecursive(
  path: jsonc.JSONPath,
  oldValue: unknown,
  newValue: unknown,
  edits: jsonc.Edit[]
): void {
  // If values are identical, no edit needed
  if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
    return;
  }

  // If types differ or one is primitive, replace the whole value
  if (
    typeof oldValue !== typeof newValue ||
    oldValue === null ||
    newValue === null ||
    typeof newValue !== 'object'
  ) {
    edits.push({
      path,
      value: newValue,
    } as jsonc.Edit);
    return;
  }

  // Both are objects/arrays - recurse into children
  if (Array.isArray(newValue)) {
    if (!Array.isArray(oldValue)) {
      // Type changed from object to array
      edits.push({
        path,
        value: newValue,
      } as jsonc.Edit);
      return;
    }

    // Handle array updates
    if (newValue.length !== oldValue.length) {
      // Length changed - replace entire array for simplicity
      edits.push({
        path,
        value: newValue,
      } as jsonc.Edit);
    } else {
      // Same length - check each element
      newValue.forEach((item, index) => {
        generateEditsRecursive([...path, index], oldValue[index], item, edits);
      });
    }
  } else {
    // Both are objects
    const oldObj = oldValue as Record<string, unknown>;
    const newObj = newValue as Record<string, unknown>;

    const oldKeys = new Set(Object.keys(oldObj));
    const newKeys = new Set(Object.keys(newObj));

    // Remove keys that are no longer present
    for (const key of oldKeys) {
      if (!newKeys.has(key)) {
        edits.push({
          path: [...path, key],
          value: undefined,
        } as jsonc.Edit);
      }
    }

    // Add or update keys
    for (const key of newKeys) {
      if (!oldKeys.has(key)) {
        // New key
        edits.push({
          path: [...path, key],
          value: newObj[key],
        } as jsonc.Edit);
      } else {
        // Existing key - recurse
        generateEditsRecursive([...path, key], oldObj[key], newObj[key], edits);
      }
    }
  }
}

export type Format = 'yaml' | 'json' | 'jsonc';

export function detectFormat(content: string): Format {
  const trimmed = content.trim();
  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      // Try JSONC first (supports comments and trailing commas)
      const errors: jsonc.ParseError[] = [];
      jsonc.parse(content, errors, { allowTrailingComma: true });

      if (errors.length === 0) {
        // Check if it has comments or trailing commas (JSONC features)
        if (content.includes('//') || content.includes('/*')) {
          return 'jsonc';
        }
        return 'json';
      }

      // Try regular JSON
      JSON.parse(trimmed);
      return 'json';
    } catch {
      // Not valid JSON, assume YAML
    }
  }
  return 'yaml';
}
