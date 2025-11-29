import { Path } from './types';

/**
 * Get value at a path in an object.
 *
 * @param obj - Object to traverse
 * @param path - Path to the value
 * @returns Value at path, or undefined if not found
 *
 * @example
 * ```ts
 * const obj = { user: { name: 'John', addresses: [{ city: 'NYC' }] } };
 *
 * getValueAtPath(obj, [{ type: 'property', key: 'user' }, { type: 'property', key: 'name' }])
 * // => 'John'
 *
 * getValueAtPath(obj, [
 *   { type: 'property', key: 'user' },
 *   { type: 'property', key: 'addresses' },
 *   { type: 'index', index: 0 },
 *   { type: 'property', key: 'city' }
 * ])
 * // => 'NYC'
 * ```
 */
export function getValueAtPath(obj: unknown, path: Path): unknown {
  let current = obj;

  for (const segment of path) {
    if (current == null) return undefined;

    if (segment.type === 'property') {
      current = (current as any)[segment.key];
    } else {
      current = (current as any)[segment.index];
    }
  }

  return current;
}

/**
 * Set value at a path in an object (immutable).
 *
 * Creates a new object with the value set at the specified path.
 * All ancestor objects/arrays are cloned (shallow copy).
 *
 * @param obj - Object to update
 * @param path - Path to the value
 * @param value - New value to set
 * @returns New object with value set
 *
 * @example
 * ```ts
 * const obj = { user: { name: 'John' } };
 * const updated = setValueAtPath(obj, [
 *   { type: 'property', key: 'user' },
 *   { type: 'property', key: 'name' }
 * ], 'Jane');
 * // => { user: { name: 'Jane' } }
 * // obj is unchanged
 * ```
 */
export function setValueAtPath<T extends object>(
  obj: T,
  path: Path,
  value: unknown
): T {
  if (path.length === 0) return obj;

  const [first, ...rest] = path;
  const clone = Array.isArray(obj) ? [...obj] : { ...obj };

  if (rest.length === 0) {
    // Base case: set the value
    if (first.type === 'property') {
      (clone as any)[first.key] = value;
    } else {
      (clone as any)[first.index] = value;
    }
    return clone as T;
  }

  // Recursive case: navigate deeper
  const nextKey = first.type === 'property' ? first.key : first.index;
  const nextValue =
    (clone as any)[nextKey] ?? (rest[0].type === 'index' ? [] : {});
  (clone as any)[nextKey] = setValueAtPath(nextValue, rest, value);

  return clone as T;
}

/**
 * Delete value at a path in an object (immutable).
 *
 * Creates a new object with the value deleted at the specified path.
 * For objects, the property is deleted.
 * For arrays, the element is removed (splice).
 *
 * @param obj - Object to update
 * @param path - Path to delete
 * @returns New object with value deleted
 *
 * @example
 * ```ts
 * const obj = { user: { name: 'John', age: 30 } };
 * const updated = deleteAtPath(obj, [
 *   { type: 'property', key: 'user' },
 *   { type: 'property', key: 'age' }
 * ]);
 * // => { user: { name: 'John' } }
 * ```
 */
export function deleteAtPath<T extends object>(obj: T, path: Path): T {
  if (path.length === 0) return obj;
  if (path.length === 1) {
    const clone = Array.isArray(obj) ? [...obj] : { ...obj };
    const segment = path[0];

    if (segment.type === 'property') {
      delete (clone as any)[segment.key];
    } else if (Array.isArray(clone)) {
      clone.splice(segment.index, 1);
    }

    return clone as T;
  }

  // Recursive case
  return setValueAtPath(
    obj,
    path.slice(0, -1),
    deleteAtPath(
      getValueAtPath(obj, path.slice(0, -1)) as any,
      [path[path.length - 1]]
    )
  );
}

/**
 * Check if a path exists in an object.
 *
 * @param obj - Object to check
 * @param path - Path to check
 * @returns True if path exists
 *
 * @example
 * ```ts
 * const obj = { user: { name: 'John' } };
 * hasPath(obj, [{ type: 'property', key: 'user' }, { type: 'property', key: 'name' }])
 * // => true
 *
 * hasPath(obj, [{ type: 'property', key: 'user' }, { type: 'property', key: 'age' }])
 * // => false
 * ```
 */
export function hasPath(obj: unknown, path: Path): boolean {
  let current = obj;

  for (const segment of path) {
    if (current == null) return false;

    if (segment.type === 'property') {
      if (!Object.prototype.hasOwnProperty.call(current, segment.key)) {
        return false;
      }
      current = (current as any)[segment.key];
    } else {
      if (!Array.isArray(current) || segment.index >= current.length) {
        return false;
      }
      current = current[segment.index];
    }
  }

  return true;
}

/**
 * Move an array element from one index to another (immutable).
 *
 * @param obj - Object containing the array
 * @param arrayPath - Path to the array
 * @param fromIndex - Source index
 * @param toIndex - Destination index
 * @returns New object with array element moved
 *
 * @example
 * ```ts
 * const obj = { items: ['a', 'b', 'c'] };
 * const updated = moveArrayElement(obj, [{ type: 'property', key: 'items' }], 0, 2);
 * // => { items: ['b', 'c', 'a'] }
 * ```
 */
export function moveArrayElement<T extends object>(
  obj: T,
  arrayPath: Path,
  fromIndex: number,
  toIndex: number
): T {
  const array = getValueAtPath(obj, arrayPath);
  if (!Array.isArray(array)) {
    throw new Error('Path does not point to an array');
  }

  const newArray = [...array];
  const [element] = newArray.splice(fromIndex, 1);
  newArray.splice(toIndex, 0, element);

  return setValueAtPath(obj, arrayPath, newArray);
}
