import { describe, it, expect } from 'vitest';
import { isValidObjectKey, sanitizeObjectKey } from './keys';

describe('isValidObjectKey', () => {
  it('should reject __proto__', () => {
    expect(isValidObjectKey('__proto__')).toBe(false);
  });

  it('should reject constructor', () => {
    expect(isValidObjectKey('constructor')).toBe(false);
  });

  it('should reject prototype', () => {
    expect(isValidObjectKey('prototype')).toBe(false);
  });

  it('should reject hasOwnProperty', () => {
    expect(isValidObjectKey('hasOwnProperty')).toBe(false);
  });

  it('should reject isPrototypeOf', () => {
    expect(isValidObjectKey('isPrototypeOf')).toBe(false);
  });

  it('should reject propertyIsEnumerable', () => {
    expect(isValidObjectKey('propertyIsEnumerable')).toBe(false);
  });

  it('should reject toLocaleString', () => {
    expect(isValidObjectKey('toLocaleString')).toBe(false);
  });

  it('should reject toString', () => {
    expect(isValidObjectKey('toString')).toBe(false);
  });

  it('should reject valueOf', () => {
    expect(isValidObjectKey('valueOf')).toBe(false);
  });

  it('should accept normal keys', () => {
    expect(isValidObjectKey('myKey')).toBe(true);
    expect(isValidObjectKey('userName')).toBe(true);
    expect(isValidObjectKey('config_value')).toBe(true);
  });

  it('should accept keys with numbers', () => {
    expect(isValidObjectKey('key123')).toBe(true);
    expect(isValidObjectKey('123')).toBe(true);
  });

  it('should accept empty string', () => {
    expect(isValidObjectKey('')).toBe(true);
  });

  it('should accept keys with special characters', () => {
    expect(isValidObjectKey('my-key')).toBe(true);
    expect(isValidObjectKey('my.key')).toBe(true);
    expect(isValidObjectKey('my_key')).toBe(true);
  });

  it('should be case-sensitive', () => {
    expect(isValidObjectKey('Constructor')).toBe(true);
    expect(isValidObjectKey('CONSTRUCTOR')).toBe(true);
    expect(isValidObjectKey('constructor')).toBe(false);
  });
});

describe('sanitizeObjectKey', () => {
  it('should return valid keys unchanged', () => {
    expect(sanitizeObjectKey('myKey')).toBe('myKey');
    expect(sanitizeObjectKey('userName')).toBe('userName');
    expect(sanitizeObjectKey('config_value')).toBe('config_value');
  });

  it('should throw on __proto__', () => {
    expect(() => sanitizeObjectKey('__proto__')).toThrow(
      'Invalid object key: __proto__ (reserved keyword)'
    );
  });

  it('should throw on constructor', () => {
    expect(() => sanitizeObjectKey('constructor')).toThrow(
      'Invalid object key: constructor (reserved keyword)'
    );
  });

  it('should throw on prototype', () => {
    expect(() => sanitizeObjectKey('prototype')).toThrow(
      'Invalid object key: prototype (reserved keyword)'
    );
  });

  it('should throw on hasOwnProperty', () => {
    expect(() => sanitizeObjectKey('hasOwnProperty')).toThrow(
      'Invalid object key: hasOwnProperty (reserved keyword)'
    );
  });

  it('should throw on isPrototypeOf', () => {
    expect(() => sanitizeObjectKey('isPrototypeOf')).toThrow(
      'Invalid object key: isPrototypeOf (reserved keyword)'
    );
  });

  it('should throw on propertyIsEnumerable', () => {
    expect(() => sanitizeObjectKey('propertyIsEnumerable')).toThrow(
      'Invalid object key: propertyIsEnumerable (reserved keyword)'
    );
  });

  it('should throw on toLocaleString', () => {
    expect(() => sanitizeObjectKey('toLocaleString')).toThrow(
      'Invalid object key: toLocaleString (reserved keyword)'
    );
  });

  it('should throw on toString', () => {
    expect(() => sanitizeObjectKey('toString')).toThrow(
      'Invalid object key: toString (reserved keyword)'
    );
  });

  it('should throw on valueOf', () => {
    expect(() => sanitizeObjectKey('valueOf')).toThrow(
      'Invalid object key: valueOf (reserved keyword)'
    );
  });

  it('should accept empty string', () => {
    expect(sanitizeObjectKey('')).toBe('');
  });

  it('should accept keys with numbers', () => {
    expect(sanitizeObjectKey('key123')).toBe('key123');
    expect(sanitizeObjectKey('123')).toBe('123');
  });

  it('should accept keys with special characters', () => {
    expect(sanitizeObjectKey('my-key')).toBe('my-key');
    expect(sanitizeObjectKey('my.key')).toBe('my.key');
    expect(sanitizeObjectKey('my_key')).toBe('my_key');
  });

  it('should be case-sensitive for allowed variations', () => {
    expect(sanitizeObjectKey('Constructor')).toBe('Constructor');
    expect(sanitizeObjectKey('CONSTRUCTOR')).toBe('CONSTRUCTOR');
  });
});
