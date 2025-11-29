/**
 * Validation utilities for object keys to prevent prototype pollution attacks.
 */

/**
 * Set of forbidden object keys that could lead to prototype pollution
 * or other security vulnerabilities.
 */
const FORBIDDEN_KEYS = new Set([
  '__proto__',
  'constructor',
  'prototype',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'toString',
  'valueOf',
]);

/**
 * Check if an object key is valid and safe to use.
 *
 * @param key - The key to validate
 * @returns true if the key is valid, false if it's a forbidden keyword
 *
 * @example
 * ```ts
 * isValidObjectKey('myKey')      // => true
 * isValidObjectKey('__proto__')  // => false
 * isValidObjectKey('constructor') // => false
 * ```
 */
export function isValidObjectKey(key: string): boolean {
  return !FORBIDDEN_KEYS.has(key);
}

/**
 * Sanitize an object key by checking if it's valid.
 * Throws an error if the key is forbidden.
 *
 * @param key - The key to sanitize
 * @returns The same key if valid
 * @throws Error if the key is a reserved keyword
 *
 * @example
 * ```ts
 * sanitizeObjectKey('myKey')      // => 'myKey'
 * sanitizeObjectKey('__proto__')  // => throws Error
 * ```
 */
export function sanitizeObjectKey(key: string): string {
  if (!isValidObjectKey(key)) {
    throw new Error(`Invalid object key: ${key} (reserved keyword)`);
  }
  return key;
}
