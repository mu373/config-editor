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
    const oldValue = parseYaml(originalYaml);

    // If values are the same, return original
    if (JSON.stringify(oldValue) === JSON.stringify(newValue)) {
      return originalYaml;
    }

    // Use line-by-line replacement to preserve exact spacing
    const lines = originalYaml.split('\n');
    const result = updateYamlLines(lines, oldValue, newValue, 0);

    return result.join('\n');
  } catch (error) {
    // Fallback to regular serialization if patching fails
    console.warn('Failed to preserve YAML comments, falling back to regular serialization:', error);
    return stringifyYaml(newValue);
  }
}

/**
 * Update YAML lines while preserving exact spacing and comments
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
    // Handle arrays - for now, just update values
    return result;
  }

  // Handle objects - update each key
  for (const [key, value] of Object.entries(newValue)) {
    const oldVal = oldValue?.[key];

    // Skip if value unchanged
    if (JSON.stringify(oldVal) === JSON.stringify(value)) {
      continue;
    }

    // Check if value is a nested object
    if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      // Find the line with this key and recurse for nested object
      for (let i = startIdx; i < result.length; i++) {
        const line = result[i];
        const trimmed = line.trim();

        // Skip comments and empty lines
        if (trimmed.startsWith('#') || trimmed === '') {
          continue;
        }

        // Check if this line contains the key (object header)
        const keyPattern = new RegExp(`^(\\s*)${escapeRegex(key)}:\\s*(?:#.*)?$`);
        const match = line.match(keyPattern);

        if (match) {
          const lineIndent = match[1];
          // Recursively update nested object starting from next line
          result = updateYamlLines(result, oldVal, value, i + 1, lineIndent + '  ');
          break;
        }
      }
    } else {
      // Scalar value - find and update the line
      for (let i = startIdx; i < result.length; i++) {
        const line = result[i];
        const trimmed = line.trim();

        // Skip comments and empty lines
        if (trimmed.startsWith('#') || trimmed === '') {
          continue;
        }

        // Check if this line contains the key with a value
        const keyPattern = new RegExp(`^(\\s*)${escapeRegex(key)}:\\s+(.+?)(?:\\s*#.*)?$`);
        const match = line.match(keyPattern);

        if (match) {
          // Check indent matches expected level (to avoid matching same key in different nesting level)
          if (indent && !line.startsWith(indent + key + ':')) {
            continue;
          }

          const lineIndent = match[1];
          const oldValueStr = match[2].trim();
          const commentMatch = line.match(/#.*$/);
          const comment = commentMatch ? commentMatch[0] : '';

          // Calculate spacing before comment
          let spacing = '  '; // default 2 spaces
          if (comment) {
            // Find the spacing between value and comment in original
            const valueEnd = line.indexOf(oldValueStr) + oldValueStr.length;
            const commentStart = line.indexOf('#');
            if (commentStart > valueEnd) {
              spacing = line.substring(valueEnd, commentStart);
            }
          }

          // Serialize new value
          const newValueStr = serializeScalarValue(value);

          // Reconstruct line with preserved spacing
          if (comment) {
            result[i] = `${lineIndent}${key}: ${newValueStr}${spacing}${comment}`;
          } else {
            result[i] = `${lineIndent}${key}: ${newValueStr}`;
          }

          break;
        }
      }
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
