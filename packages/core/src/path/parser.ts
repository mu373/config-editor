import { Path, PathSegment } from './types';

/**
 * Parse a string path to structured segments.
 *
 * @param pathString - String representation of a path (e.g., "user.addresses[0].street")
 * @returns Structured path segments
 *
 * @example
 * ```ts
 * parsePath("user.name")
 * // => [{ type: 'property', key: 'user' }, { type: 'property', key: 'name' }]
 *
 * parsePath("users[0]")
 * // => [{ type: 'property', key: 'users' }, { type: 'index', index: 0 }]
 *
 * parsePath("user.addresses[0].street")
 * // => [
 * //   { type: 'property', key: 'user' },
 * //   { type: 'property', key: 'addresses' },
 * //   { type: 'index', index: 0 },
 * //   { type: 'property', key: 'street' }
 * // ]
 * ```
 */
export function parsePath(pathString: string): Path {
  if (!pathString) return [];

  const segments: Path = [];
  const parts = pathString.match(/[^.\[\]]+|\[\d+\]/g) || [];

  for (const part of parts) {
    if (part.startsWith('[') && part.endsWith(']')) {
      const index = parseInt(part.slice(1, -1), 10);
      segments.push({ type: 'index', index });
    } else {
      segments.push({ type: 'property', key: part });
    }
  }

  return segments;
}

/**
 * Convert path segments to string representation.
 *
 * @param path - Structured path segments
 * @returns String representation
 *
 * @example
 * ```ts
 * pathToString([
 *   { type: 'property', key: 'user' },
 *   { type: 'property', key: 'name' }
 * ])
 * // => "user.name"
 *
 * pathToString([
 *   { type: 'property', key: 'users' },
 *   { type: 'index', index: 0 }
 * ])
 * // => "users[0]"
 * ```
 */
export function pathToString(path: Path): string {
  return path
    .map((seg) => (seg.type === 'property' ? seg.key : `[${seg.index}]`))
    .join('.')
    .replace(/\.\[/g, '[');
}

/**
 * Get parent path (all segments except the last one).
 *
 * @param path - Path segments
 * @returns Parent path
 *
 * @example
 * ```ts
 * getParent([
 *   { type: 'property', key: 'user' },
 *   { type: 'property', key: 'addresses' },
 *   { type: 'index', index: 0 }
 * ])
 * // => [
 * //   { type: 'property', key: 'user' },
 * //   { type: 'property', key: 'addresses' }
 * // ]
 * ```
 */
export function getParent(path: Path): Path {
  return path.slice(0, -1);
}

/**
 * Get all ancestor paths (from root to parent).
 *
 * @param path - Path segments
 * @returns Array of ancestor paths, from shortest to longest
 *
 * @example
 * ```ts
 * getAncestors([
 *   { type: 'property', key: 'user' },
 *   { type: 'property', key: 'addresses' },
 *   { type: 'index', index: 0 }
 * ])
 * // => [
 * //   [],
 * //   [{ type: 'property', key: 'user' }],
 * //   [{ type: 'property', key: 'user' }, { type: 'property', key: 'addresses' }]
 * // ]
 * ```
 */
export function getAncestors(path: Path): Path[] {
  const ancestors: Path[] = [];
  for (let i = 0; i <= path.length; i++) {
    ancestors.push(path.slice(0, i));
  }
  return ancestors;
}

/**
 * Check if one path is an ancestor of another.
 *
 * @param ancestor - Potential ancestor path
 * @param descendant - Potential descendant path
 * @returns True if ancestor is an ancestor of descendant
 *
 * @example
 * ```ts
 * isAncestor(
 *   [{ type: 'property', key: 'user' }],
 *   [{ type: 'property', key: 'user' }, { type: 'property', key: 'name' }]
 * )
 * // => true
 * ```
 */
export function isAncestor(ancestor: Path, descendant: Path): boolean {
  if (ancestor.length >= descendant.length) return false;

  for (let i = 0; i < ancestor.length; i++) {
    const a = ancestor[i];
    const d = descendant[i];

    if (a.type !== d.type) return false;
    if (a.type === 'property' && d.type === 'property' && a.key !== d.key) {
      return false;
    }
    if (a.type === 'index' && d.type === 'index' && a.index !== d.index) {
      return false;
    }
  }

  return true;
}

/**
 * Check if two paths are equal.
 *
 * @param path1 - First path
 * @param path2 - Second path
 * @returns True if paths are equal
 *
 * @example
 * ```ts
 * pathsEqual(
 *   [{ type: 'property', key: 'user' }],
 *   [{ type: 'property', key: 'user' }]
 * )
 * // => true
 * ```
 */
export function pathsEqual(path1: Path, path2: Path): boolean {
  if (path1.length !== path2.length) return false;

  for (let i = 0; i < path1.length; i++) {
    const p1 = path1[i];
    const p2 = path2[i];

    if (p1.type !== p2.type) return false;
    if (p1.type === 'property' && p2.type === 'property' && p1.key !== p2.key) {
      return false;
    }
    if (p1.type === 'index' && p2.type === 'index' && p1.index !== p2.index) {
      return false;
    }
  }

  return true;
}
