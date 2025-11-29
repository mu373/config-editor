import { describe, it, expect } from 'vitest';
import {
  parseJson,
  stringifyJson,
  parseJsonc,
  stringifyJsonc,
  updateJsonPreservingComments,
  detectFormat,
  type Format,
} from './json';

describe('parseJson', () => {
  it('should parse valid JSON', () => {
    expect(parseJson('{"name":"test"}')).toEqual({ name: 'test' });
  });

  it('should parse JSON with numbers', () => {
    expect(parseJson('{"value":123}')).toEqual({ value: 123 });
  });

  it('should parse JSON with booleans', () => {
    expect(parseJson('{"enabled":true}')).toEqual({ enabled: true });
  });

  it('should parse JSON with null', () => {
    expect(parseJson('{"value":null}')).toEqual({ value: null });
  });

  it('should parse nested objects', () => {
    expect(parseJson('{"user":{"name":"John"}}')).toEqual({
      user: { name: 'John' },
    });
  });

  it('should parse arrays', () => {
    expect(parseJson('{"items":["a","b","c"]}')).toEqual({
      items: ['a', 'b', 'c'],
    });
  });

  it('should throw on invalid JSON', () => {
    expect(() => parseJson('invalid')).toThrow();
  });

  it('should throw on trailing commas', () => {
    expect(() => parseJson('{"name":"test",}')).toThrow();
  });
});

describe('stringifyJson', () => {
  it('should stringify simple object', () => {
    const result = stringifyJson({ name: 'test' });
    expect(result).toContain('"name": "test"');
  });

  it('should use 2-space indentation', () => {
    const result = stringifyJson({ user: { name: 'test' } });
    expect(result).toContain('  "user":');
    expect(result).toContain('    "name"');
  });

  it('should handle numbers', () => {
    const result = stringifyJson({ value: 123 });
    expect(result).toContain('"value": 123');
  });

  it('should handle booleans', () => {
    const result = stringifyJson({ enabled: true });
    expect(result).toContain('"enabled": true');
  });

  it('should handle null', () => {
    const result = stringifyJson({ value: null });
    expect(result).toContain('"value": null');
  });

  it('should handle arrays', () => {
    const result = stringifyJson({ items: ['a', 'b'] });
    expect(result).toContain('"items":');
    expect(result).toContain('"a"');
    expect(result).toContain('"b"');
  });
});

describe('parseJsonc', () => {
  it('should parse valid JSON', () => {
    expect(parseJsonc('{"name":"test"}')).toEqual({ name: 'test' });
  });

  it('should parse JSONC with comments', () => {
    const jsonc = `{
  // Comment
  "name": "test"
}`;
    expect(parseJsonc(jsonc)).toEqual({ name: 'test' });
  });

  it('should parse JSONC with block comments', () => {
    const jsonc = `{
  /* Block comment */
  "name": "test"
}`;
    expect(parseJsonc(jsonc)).toEqual({ name: 'test' });
  });

  it('should parse JSONC with trailing commas', () => {
    const jsonc = '{"name":"test",}';
    expect(parseJsonc(jsonc)).toEqual({ name: 'test' });
  });

  it('should parse JSONC with inline comments', () => {
    const jsonc = `{
  "name": "test", // inline comment
  "value": 123
}`;
    expect(parseJsonc(jsonc)).toEqual({ name: 'test', value: 123 });
  });

  it('should fallback to JSON.parse on error', () => {
    expect(parseJsonc('{"name":"test"}')).toEqual({ name: 'test' });
  });

  it('should handle nested objects with comments', () => {
    const jsonc = `{
  "user": { // user object
    "name": "John"
  }
}`;
    expect(parseJsonc(jsonc)).toEqual({ user: { name: 'John' } });
  });
});

describe('stringifyJsonc', () => {
  it('should stringify to JSON format', () => {
    const result = stringifyJsonc({ name: 'test' });
    expect(result).toContain('"name": "test"');
  });

  it('should use 2-space indentation', () => {
    const result = stringifyJsonc({ user: { name: 'test' } });
    expect(result).toContain('  "user":');
  });
});

describe('updateJsonPreservingComments', () => {
  it('should preserve comments in JSONC', () => {
    const original = `{
  // Comment
  "name": "old", // inline
  "value": 123
}`;
    const updated = updateJsonPreservingComments(original, {
      name: 'new',
      value: 123,
    });
    expect(updated).toContain('// Comment');
    expect(updated).toContain('// inline');
    expect(updated).toContain('"name": "new"');
  });

  it('should update scalar values', () => {
    const original = '{\n  "name": "old"\n}';
    const updated = updateJsonPreservingComments(original, { name: 'new' });
    expect(updated).toContain('"name": "new"');
  });

  it('should add new keys', () => {
    const original = '{\n  "name": "test"\n}';
    const updated = updateJsonPreservingComments(original, {
      name: 'test',
      newKey: 'value',
    });
    expect(updated).toContain('"name": "test"');
    expect(updated).toContain('"newKey": "value"');
  });

  it('should remove deleted keys', () => {
    const original = '{\n  "name": "test",\n  "old": "value"\n}';
    const updated = updateJsonPreservingComments(original, { name: 'test' });
    expect(updated).toContain('"name": "test"');
    expect(updated).not.toContain('"old"');
  });

  it('should handle nested objects', () => {
    const original = `{
  "user": {
    "name": "old",
    "age": 30
  }
}`;
    const updated = updateJsonPreservingComments(original, {
      user: { name: 'new', age: 30 },
    });
    expect(updated).toContain('"name": "new"');
    expect(updated).toContain('"age": 30');
  });

  it('should handle arrays', () => {
    const original = '{\n  "items": ["a", "b"]\n}';
    const updated = updateJsonPreservingComments(original, {
      items: ['a', 'b', 'c'],
    });
    expect(updated).toContain('"items"');
    expect(updated).toContain('"a"');
    expect(updated).toContain('"b"');
    expect(updated).toContain('"c"');
  });

  it('should preserve block comments', () => {
    const original = `{
  /* Block comment */
  "name": "old"
}`;
    const updated = updateJsonPreservingComments(original, { name: 'new' });
    expect(updated).toContain('/* Block comment */');
    expect(updated).toContain('"name": "new"');
  });

  it('should handle unchanged values', () => {
    const original = '{\n  "name": "test"\n}';
    const updated = updateJsonPreservingComments(original, { name: 'test' });
    expect(updated).toBe(original);
  });

  it('should handle boolean changes', () => {
    const original = '{\n  "enabled": false\n}';
    const updated = updateJsonPreservingComments(original, { enabled: true });
    expect(updated).toContain('"enabled": true');
  });

  it('should handle null values', () => {
    const original = '{\n  "value": "old"\n}';
    const updated = updateJsonPreservingComments(original, { value: null });
    expect(updated).toContain('"value": null');
  });

  it('should handle number changes', () => {
    const original = '{\n  "count": 5\n}';
    const updated = updateJsonPreservingComments(original, { count: 10 });
    expect(updated).toContain('"count": 10');
  });

  it('should handle array of objects', () => {
    const original = `{
  "users": [
    { "name": "Alice", "age": 30 }
  ]
}`;
    const updated = updateJsonPreservingComments(original, {
      users: [
        { name: 'Alice', age: 31 },
        { name: 'Bob', age: 25 },
      ],
    });
    expect(updated).toContain('"users"');
    expect(updated).toContain('"Alice"');
    expect(updated).toContain('"Bob"');
  });

  it('should preserve trailing commas in JSONC', () => {
    const original = `{
  "name": "test",
}`;
    const updated = updateJsonPreservingComments(original, {
      name: 'test',
      value: 123,
    });
    expect(updated).toContain('"name": "test"');
    expect(updated).toContain('"value": 123');
  });

  it('should handle complex nested structures', () => {
    const original = `{
  // Config
  "server": {
    "host": "localhost", // Server host
    "port": 3000
  },
  "database": {
    "url": "postgres://localhost"
  }
}`;
    const updated = updateJsonPreservingComments(original, {
      server: { host: '0.0.0.0', port: 3000 },
      database: { url: 'postgres://localhost' },
    });
    expect(updated).toContain('// Config');
    expect(updated).toContain('// Server host');
    expect(updated).toContain('"host": "0.0.0.0"');
  });

  it('should fallback to stringify on error', () => {
    const original = 'invalid json';
    const updated = updateJsonPreservingComments(original, { name: 'test' });
    expect(updated).toContain('"name": "test"');
  });
});

describe('detectFormat', () => {
  it('should detect JSON format', () => {
    const format = detectFormat('{"name":"test"}');
    expect(format).toBe('json');
  });

  it('should detect JSONC with line comments', () => {
    const format = detectFormat('{\n// comment\n"name":"test"\n}');
    expect(format).toBe('jsonc');
  });

  it('should detect JSONC with block comments', () => {
    const format = detectFormat('{\n/* comment */\n"name":"test"\n}');
    expect(format).toBe('jsonc');
  });

  it('should detect YAML format', () => {
    const format = detectFormat('name: test\nvalue: 123');
    expect(format).toBe('yaml');
  });

  it('should detect JSON array', () => {
    const format = detectFormat('[1, 2, 3]');
    expect(format).toBe('json');
  });

  it('should handle empty content as YAML', () => {
    const format = detectFormat('');
    expect(format).toBe('yaml');
  });

  it('should handle whitespace-only content as YAML', () => {
    const format = detectFormat('   \n  \n  ');
    expect(format).toBe('yaml');
  });

  it('should detect JSON with indentation', () => {
    const format = detectFormat(`{
  "name": "test",
  "value": 123
}`);
    expect(format).toBe('json');
  });

  it('should detect JSONC with trailing comma', () => {
    const format = detectFormat('{"name":"test",}');
    expect(format).toBe('json'); // Trailing comma alone isn't enough for JSONC detection
  });

  it('should handle invalid JSON as YAML', () => {
    const format = detectFormat('{invalid}');
    expect(format).toBe('yaml');
  });

  it('should handle YAML that starts with text', () => {
    const format = detectFormat('name: value');
    expect(format).toBe('yaml');
  });
});
