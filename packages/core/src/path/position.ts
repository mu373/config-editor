/**
 * Utilities for mapping cursor positions (line/column) to document paths.
 *
 * These utilities parse YAML/JSON content and find which path the cursor is on.
 */

import { parseDocument, type Node, isMap, isSeq, isScalar, isPair, isNode } from 'yaml';
import * as jsoncParser from 'jsonc-parser';
import type { Path, PathSegment } from './types';
import { pathToString } from './parser';

/**
 * Position in the document (1-indexed, matching Monaco conventions)
 */
export interface CursorPosition {
  lineNumber: number;
  column: number;
}

/**
 * Convert line/column to offset in the content string
 */
function positionToOffset(content: string, line: number, column: number): number {
  const lines = content.split('\n');
  let offset = 0;

  for (let i = 0; i < line - 1 && i < lines.length; i++) {
    offset += lines[i].length + 1; // +1 for newline
  }

  offset += Math.min(column - 1, lines[line - 1]?.length ?? 0);
  return offset;
}

/**
 * Find the path at a given position in YAML content.
 *
 * @param content - The YAML content
 * @param position - Cursor position (1-indexed line and column)
 * @returns Path string at the cursor position, or null if not found
 */
export function getPathAtPositionYaml(
  content: string,
  position: CursorPosition
): string | null {
  try {
    const doc = parseDocument(content, { keepSourceTokens: true });
    const offset = positionToOffset(content, position.lineNumber, position.column);

    const path = findPathAtOffset(doc.contents, offset, []);
    if (!path) return null;

    return pathToString(path);
  } catch {
    return null;
  }
}

/**
 * Recursively find the path at a given offset in a YAML node.
 */
function findPathAtOffset(
  node: Node | null,
  offset: number,
  currentPath: Path
): Path | null {
  if (!node) return null;

  // Check if offset is within this node's range
  const range = node.range;
  if (!range) return null;

  const [start, end] = range;
  if (offset < start || offset > end) {
    return null;
  }

  if (isMap(node)) {
    // For map nodes, check each pair
    for (const pair of node.items) {
      if (!isPair(pair)) continue;

      const key = pair.key;
      const value = pair.value;

      // Check if we're on the key
      if (isScalar(key) && key.range) {
        const [keyStart, keyEnd] = key.range;
        if (offset >= keyStart && offset <= keyEnd) {
          // Cursor is on the key itself
          return [...currentPath, { type: 'property', key: String(key.value) }];
        }
      }

      // Check if we're in the value
      if (isNode(value) && value.range) {
        const [valStart, valEnd] = value.range;
        if (offset >= valStart && offset <= valEnd) {
          const keyString = isScalar(key) ? String(key.value) : '';
          const newPath: Path = [...currentPath, { type: 'property', key: keyString }];

          // If value is a container, recurse
          if (isMap(value) || isSeq(value)) {
            const deeper = findPathAtOffset(value, offset, newPath);
            return deeper ?? newPath;
          }

          // Scalar value - return the path to this key
          return newPath;
        }
      }

      // Check if we're between key and value (on the line but not in key/value range)
      if (isScalar(key) && key.range) {
        const [keyStart] = key.range;
        const valEnd = isNode(value) && value.range ? value.range[1] : key.range[1];
        if (offset >= keyStart && offset <= valEnd) {
          return [...currentPath, { type: 'property', key: String(key.value) }];
        }
      }
    }

    // We're inside the map but not specifically on a key/value
    return currentPath.length > 0 ? currentPath : null;
  }

  if (isSeq(node)) {
    // For sequence nodes, check each item
    for (let i = 0; i < node.items.length; i++) {
      const item = node.items[i];
      if (!isNode(item) || !item.range) continue;

      const [itemStart, itemEnd] = item.range;
      if (offset >= itemStart && offset <= itemEnd) {
        const newPath: Path = [...currentPath, { type: 'index', index: i }];

        // If item is a container, recurse
        if (isMap(item) || isSeq(item)) {
          const deeper = findPathAtOffset(item, offset, newPath);
          return deeper ?? newPath;
        }

        return newPath;
      }
    }

    // We're in the sequence but not on a specific item
    return currentPath.length > 0 ? currentPath : null;
  }

  // Scalar node - return current path
  return currentPath.length > 0 ? currentPath : null;
}

/**
 * Find the path at a given position in JSON/JSONC content.
 *
 * @param content - The JSON/JSONC content
 * @param position - Cursor position (1-indexed line and column)
 * @returns Path string at the cursor position, or null if not found
 */
export function getPathAtPositionJson(
  content: string,
  position: CursorPosition
): string | null {
  try {
    const offset = positionToOffset(content, position.lineNumber, position.column);
    const location = jsoncParser.getLocation(content, offset);

    if (!location.path || location.path.length === 0) {
      return null;
    }

    // Convert jsonc-parser path to our Path type
    const segments: PathSegment[] = location.path.map((segment) => {
      if (typeof segment === 'number') {
        return { type: 'index', index: segment } as PathSegment;
      }
      return { type: 'property', key: String(segment) } as PathSegment;
    });

    return pathToString(segments);
  } catch {
    return null;
  }
}

/**
 * Find the path at a given position, automatically detecting format.
 *
 * @param content - The document content
 * @param position - Cursor position (1-indexed line and column)
 * @param format - The format of the content ('yaml', 'json', or 'jsonc')
 * @returns Path string at the cursor position, or null if not found
 */
export function getPathAtPosition(
  content: string,
  position: CursorPosition,
  format: 'yaml' | 'json' | 'jsonc'
): string | null {
  if (format === 'yaml') {
    return getPathAtPositionYaml(content, position);
  }
  return getPathAtPositionJson(content, position);
}
