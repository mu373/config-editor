import jsYaml from 'js-yaml';
import { parseDocument } from 'yaml';

export function yamlToJson(yamlContent: string): unknown {
  return jsYaml.load(yamlContent, {
    // Keep dates as strings instead of Date objects for better compatibility with HTML inputs
    schema: jsYaml.CORE_SCHEMA,
  });
}

export function jsonToYaml(jsonContent: unknown): string {
  return jsYaml.dump(jsonContent, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
}

export function parseYaml(content: string): unknown {
  return jsYaml.load(content, {
    // Keep dates as strings instead of Date objects for better compatibility with HTML inputs
    schema: jsYaml.CORE_SCHEMA,
  });
}

export function stringifyYaml(value: unknown): string {
  return jsYaml.dump(value, {
    indent: 2,
    lineWidth: -1,
    noRefs: true,
    sortKeys: false,
  });
}

/**
 * Update YAML content while preserving comments and formatting.
 * This uses string manipulation to preserve exact spacing and comments.
 *
 * @param originalYaml - The original YAML content (with comments)
 * @param newValue - The new value to apply
 * @returns Updated YAML content with comments preserved
 */
export function updateYamlPreservingComments(
  originalYaml: string,
  newValue: unknown
): string {
  try {
    // Parse to get the old values
    const oldValue = parseYaml(originalYaml) as Record<string, unknown> | null;

    // If values are the same, return original
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
      return originalYaml;
    }

    // Use line-by-line replacement to preserve exact spacing
    // This now handles inserting new keys and deleting removed keys at all nesting levels
    let lines = originalYaml.split('\n');
    lines = updateYamlLines(lines, oldValue, newValue, 0, '');

    return lines.join('\n');
  } catch (error) {
    // Fallback to regular serialization if patching fails
    console.warn('Failed to preserve YAML comments, falling back to regular serialization:', error);
    return stringifyYaml(newValue);
  }
}

/**
 * Serialize a key-value pair to YAML lines
 */
function serializeValueToYaml(key: string, value: unknown, indent: string): string[] {
  if (value === null || value === undefined) {
    return [`${indent}${key}: null`];
  }

  if (typeof value === 'object' && !Array.isArray(value)) {
    const obj = value as Record<string, unknown>;
    const lines = [`${indent}${key}:`];
    for (const [k, v] of Object.entries(obj)) {
      lines.push(...serializeValueToYaml(k, v, indent + '  '));
    }
    return lines;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return [`${indent}${key}: []`];
    }
    const lines = [`${indent}${key}:`];
    for (const item of value) {
      if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
        // Object item - serialize with proper indentation
        const itemLines = serializeObjectAsYamlLines(item as Record<string, unknown>, indent + '    ');
        if (itemLines.length > 0) {
          // First line of object gets the `-` prefix
          lines.push(`${indent}  - ${itemLines[0].trim()}`);
          lines.push(...itemLines.slice(1));
        }
      } else {
        lines.push(`${indent}  - ${serializeScalarValue(item)}`);
      }
    }
    return lines;
  }

  return [`${indent}${key}: ${serializeScalarValue(value)}`];
}

/**
 * Serialize an object as YAML lines (without the key)
 */
function serializeObjectAsYamlLines(obj: Record<string, unknown>, indent: string): string[] {
  const lines: string[] = [];
  for (const [k, v] of Object.entries(obj)) {
    lines.push(...serializeValueToYaml(k, v, indent));
  }
  return lines;
}

/**
 * Remove a key from YAML content
 */
function removeKeyFromYaml(lines: string[], key: string, indent: string): string[] {
  const result: string[] = [];
  let skipUntilNextKey = false;
  let skipIndent = '';

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    if (skipUntilNextKey) {
      // Check if we've reached a line with same or lesser indentation (new key at same level)
      if (trimmed !== '' && !trimmed.startsWith('#')) {
        const currentIndent = line.match(/^(\s*)/)?.[1] ?? '';
        if (currentIndent.length <= skipIndent.length) {
          skipUntilNextKey = false;
        }
      }
    }

    if (!skipUntilNextKey) {
      // Check if this line is the key we want to remove
      const keyPattern = new RegExp(`^(${escapeRegex(indent)})${escapeRegex(key)}:\\s*`);
      if (keyPattern.test(line)) {
        // Start skipping this key and its nested content
        skipUntilNextKey = true;
        skipIndent = indent;
        continue;
      }
      result.push(line);
    }
  }

  return result;
}

/**
 * Find the end of a YAML block (where indentation returns to parent level or less)
 */
function findBlockEnd(lines: string[], startIdx: number, parentIndent: string): number {
  for (let i = startIdx; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();

    // Skip empty lines and comments
    if (trimmed === '' || trimmed.startsWith('#')) {
      continue;
    }

    // Check indentation - if we find a line with same or less indentation, block ends before it
    const lineIndent = line.match(/^(\s*)/)?.[1] ?? '';
    if (lineIndent.length <= parentIndent.length) {
      return i;
    }
  }
  return lines.length;
}

/**
 * Update YAML lines while preserving exact spacing and comments.
 * Now also handles inserting new keys and deleting removed keys at any nesting level.
 */
function updateYamlLines(
  lines: string[],
  oldValue: any,
  newValue: any,
  startIdx: number,
  indent: string = ''
): string[] {
  let result = [...lines];

  if (typeof newValue !== 'object' || newValue === null) {
    return result;
  }

  if (Array.isArray(newValue)) {
    // Arrays are handled by their parent object, not directly
    return result;
  }

  const oldObj = (oldValue ?? {}) as Record<string, unknown>;
  const newObj = newValue as Record<string, unknown>;

  // Track keys that exist in YAML and their positions
  const existingKeyPositions: Map<string, { lineIdx: number; lineIndent: string }> = new Map();

  // Find positions of existing keys at this indent level
  for (let i = startIdx; i < result.length; i++) {
    const line = result[i];
    const trimmed = line.trim();

    // Skip comments and empty lines
    if (trimmed.startsWith('#') || trimmed === '') {
      continue;
    }

    // Check if we've exited this indentation level
    const lineIndent = line.match(/^(\s*)/)?.[1] ?? '';
    if (lineIndent.length < indent.length) {
      break; // We've exited this object's scope
    }
    if (lineIndent.length > indent.length) {
      continue; // Skip nested content
    }

    // Check if this line is a key at the current indent level
    const keyMatch = line.match(/^(\s*)([^:\s#]+):\s*/);
    if (keyMatch && keyMatch[1] === indent) {
      const key = keyMatch[2];
      existingKeyPositions.set(key, { lineIdx: i, lineIndent: keyMatch[1] });
    }
  }

  // Handle each key in newValue
  for (const [key, value] of Object.entries(newObj)) {
    const oldVal = oldObj[key];

    // Skip if value unchanged
    if (JSON.stringify(oldVal) === JSON.stringify(value)) {
      continue;
    }

    const existingPos = existingKeyPositions.get(key);

    if (existingPos) {
      // Key exists - update it
      if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
        // Nested object - recurse
        result = updateYamlLines(result, oldVal, value, existingPos.lineIdx + 1, indent + '  ');
      } else if (Array.isArray(value)) {
        // Array value - remove old content and insert new
        const blockEnd = findBlockEnd(result, existingPos.lineIdx + 1, indent);
        const newArrayLines = serializeValueToYaml(key, value, indent);

        // Replace from the key line to end of block with new content
        const lineDiff = newArrayLines.length - (blockEnd - existingPos.lineIdx);
        result.splice(existingPos.lineIdx, blockEnd - existingPos.lineIdx, ...newArrayLines);

        // Update existing key positions after array update
        if (lineDiff !== 0) {
          for (const [k, pos] of existingKeyPositions.entries()) {
            if (pos.lineIdx > existingPos.lineIdx) {
              existingKeyPositions.set(k, { ...pos, lineIdx: pos.lineIdx + lineDiff });
            }
          }
        }
      } else {
        // Scalar value - find and update the line
        const line = result[existingPos.lineIdx];

        // Check if this is a scalar value line (key: value) vs object header (key:)
        const scalarPattern = new RegExp(`^(${escapeRegex(indent)})${escapeRegex(key)}:\\s+(.+?)(?:\\s*#.*)?$`);
        const scalarMatch = line.match(scalarPattern);

        if (scalarMatch) {
          const oldValueStr = scalarMatch[2].trim();
          const commentMatch = line.match(/#.*$/);
          const comment = commentMatch ? commentMatch[0] : '';

          let spacing = '  ';
          if (comment) {
            const valueEnd = line.indexOf(oldValueStr) + oldValueStr.length;
            const commentStart = line.indexOf('#');
            if (commentStart > valueEnd) {
              spacing = line.substring(valueEnd, commentStart);
            }
          }

          const newValueStr = serializeScalarValue(value);
          result[existingPos.lineIdx] = comment
            ? `${indent}${key}: ${newValueStr}${spacing}${comment}`
            : `${indent}${key}: ${newValueStr}`;
        }
      }
    } else if (!(key in oldObj)) {
      // New key - insert it at the end of this object's scope
      const insertedLines = serializeValueToYaml(key, value, indent);

      // Find insertion point: end of current object's scope
      let insertIdx = findBlockEnd(result, startIdx, indent);

      // Back up over trailing empty lines within scope
      while (insertIdx > startIdx && result[insertIdx - 1].trim() === '') {
        insertIdx--;
      }

      result.splice(insertIdx, 0, ...insertedLines);

      // Update existing key positions after insertion
      for (const [k, pos] of existingKeyPositions.entries()) {
        if (pos.lineIdx >= insertIdx) {
          existingKeyPositions.set(k, { ...pos, lineIdx: pos.lineIdx + insertedLines.length });
        }
      }
    }
  }

  // Handle deleted keys
  for (const key of Object.keys(oldObj)) {
    if (!(key in newObj)) {
      result = removeKeyFromYaml(result, key, indent);
    }
  }

  return result;
}

/**
 * Serialize a scalar value for YAML
 */
function serializeScalarValue(value: any): string {
  if (typeof value === 'string') {
    // Check if string needs quoting
    if (value.includes(':') || value.includes('#') || value.trim() !== value) {
      return `"${value.replace(/"/g, '\\"')}"`;
    }
    return value;
  }
  if (typeof value === 'boolean') {
    return value ? 'true' : 'false';
  }
  if (typeof value === 'number') {
    return String(value);
  }
  if (value === null || value === undefined) {
    return 'null';
  }
  return String(value);
}

/**
 * Escape special regex characters
 */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Recursively update a YAML node while preserving structure
 */
function updateYamlNode(node: any, newValue: unknown): void {
  if (node === null || node === undefined) return;

  // Handle different node types
  if (node.type === 'MAP' || node.constructor.name === 'YAMLMap') {
    const newObj = newValue as Record<string, unknown>;

    // Track which keys to keep/remove
    const newKeys = new Set(Object.keys(newObj));
    const keysToRemove: any[] = [];

    // Update existing keys
    for (const pair of node.items) {
      const key = pair.key?.value;
      if (key in newObj) {
        const value = newObj[key];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          // Recursive update for nested objects
          updateYamlNode(pair.value, value);
        } else if (Array.isArray(value)) {
          // Handle arrays
          updateYamlNode(pair.value, value);
        } else {
          // Simple value update - preserve the scalar node to keep comments
          if (pair.value && typeof pair.value === 'object' && 'value' in pair.value) {
            // It's a Scalar node, update its value
            pair.value.value = value;
          } else {
            // Create new scalar
            pair.value = value;
          }
        }
        newKeys.delete(key);
      } else {
        // Mark for removal
        keysToRemove.push(pair);
      }
    }

    // Remove keys that don't exist in new value
    for (const pair of keysToRemove) {
      const index = node.items.indexOf(pair);
      if (index > -1) {
        node.items.splice(index, 1);
      }
    }

    // Add new keys that don't exist yet
    for (const key of newKeys) {
      node.add({ key, value: newObj[key] });
    }
  } else if (node.type === 'SEQ' || node.constructor.name === 'YAMLSeq') {
    const newArr = newValue as unknown[];

    // Update array length to match
    while (node.items.length > newArr.length) {
      node.items.pop();
    }

    // Update each item
    for (let i = 0; i < newArr.length; i++) {
      if (i < node.items.length) {
        const value = newArr[i];
        if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
          updateYamlNode(node.items[i], value);
        } else {
          // Update scalar value - preserve node to keep comments
          if (node.items[i] && typeof node.items[i] === 'object' && 'value' in node.items[i]) {
            node.items[i].value = value;
          } else {
            node.items[i] = value;
          }
        }
      } else {
        node.add(newArr[i]);
      }
    }
  } else {
    // For scalar values, the parent should handle the update
    // This shouldn't be called directly for scalars
  }
}
