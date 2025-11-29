/**
 * Path abstraction for type-safe navigation through nested data structures.
 *
 * A Path is an array of segments, where each segment can be either:
 * - A property access (object key)
 * - An array index access
 *
 * @example
 * "user.addresses[0].street" is represented as:
 * [
 *   { type: 'property', key: 'user' },
 *   { type: 'property', key: 'addresses' },
 *   { type: 'index', index: 0 },
 *   { type: 'property', key: 'street' }
 * ]
 */

export type PathSegment =
  | { type: 'property'; key: string }
  | { type: 'index'; index: number };

export type Path = PathSegment[];
