import { describe, it, expect } from 'vitest';
import {
  parseYaml,
  stringifyYaml,
  yamlToJson,
  jsonToYaml,
  updateYamlPreservingComments,
} from './yaml';

describe('parseYaml', () => {
  it('should parse valid YAML', () => {
    const yaml = 'name: test\nvalue: 123';
    const result = parseYaml(yaml);
    expect(result).toEqual({ name: 'test', value: 123 });
  });

  it('should handle dates as strings', () => {
    const yaml = 'date: 2023-01-01';
    const result = parseYaml(yaml) as any;
    expect(typeof result.date).toBe('string');
    expect(result.date).toBe('2023-01-01');
  });

  it('should handle nested objects', () => {
    const yaml = `
user:
  name: John
  age: 30
`.trim();
    const result = parseYaml(yaml);
    expect(result).toEqual({
      user: {
        name: 'John',
        age: 30,
      },
    });
  });

  it('should handle arrays', () => {
    const yaml = `
items:
  - apple
  - banana
  - orange
`.trim();
    const result = parseYaml(yaml);
    expect(result).toEqual({
      items: ['apple', 'banana', 'orange'],
    });
  });

  it('should handle boolean values', () => {
    const yaml = 'enabled: true\ndisabled: false';
    const result = parseYaml(yaml);
    expect(result).toEqual({ enabled: true, disabled: false });
  });

  it('should handle null values', () => {
    const yaml = 'value: null';
    const result = parseYaml(yaml);
    expect(result).toEqual({ value: null });
  });
});

describe('stringifyYaml', () => {
  it('should stringify simple object', () => {
    const obj = { name: 'test', value: 123 };
    const yaml = stringifyYaml(obj);
    expect(yaml).toContain('name: test');
    expect(yaml).toContain('value: 123');
  });

  it('should stringify nested objects', () => {
    const obj = {
      user: {
        name: 'John',
        age: 30,
      },
    };
    const yaml = stringifyYaml(obj);
    expect(yaml).toContain('user:');
    expect(yaml).toContain('name: John');
    expect(yaml).toContain('age: 30');
  });

  it('should stringify arrays', () => {
    const obj = {
      items: ['apple', 'banana', 'orange'],
    };
    const yaml = stringifyYaml(obj);
    expect(yaml).toContain('items:');
    expect(yaml).toContain('- apple');
    expect(yaml).toContain('- banana');
    expect(yaml).toContain('- orange');
  });

  it('should preserve property order', () => {
    const obj = { z: 1, a: 2, m: 3 };
    const yaml = stringifyYaml(obj);
    const lines = yaml.trim().split('\n');
    expect(lines[0]).toContain('z:');
    expect(lines[1]).toContain('a:');
    expect(lines[2]).toContain('m:');
  });

  it('should handle boolean values', () => {
    const obj = { enabled: true, disabled: false };
    const yaml = stringifyYaml(obj);
    expect(yaml).toContain('enabled: true');
    expect(yaml).toContain('disabled: false');
  });

  it('should handle null values', () => {
    const obj = { value: null };
    const yaml = stringifyYaml(obj);
    expect(yaml).toContain('value: null');
  });
});

describe('yamlToJson', () => {
  it('should convert YAML to JSON', () => {
    const yaml = 'name: test\nvalue: 123';
    const result = yamlToJson(yaml);
    expect(result).toEqual({ name: 'test', value: 123 });
  });

  it('should handle dates as strings', () => {
    const yaml = 'date: 2023-01-01';
    const result = yamlToJson(yaml) as any;
    expect(typeof result.date).toBe('string');
  });
});

describe('jsonToYaml', () => {
  it('should convert JSON to YAML', () => {
    const json = { name: 'test', value: 123 };
    const yaml = jsonToYaml(json);
    expect(yaml).toContain('name: test');
    expect(yaml).toContain('value: 123');
  });
});

describe('updateYamlPreservingComments', () => {
  it('should preserve comments when updating values', () => {
    const original = `# This is a comment
name: old # inline comment
value: 123`;
    const updated = updateYamlPreservingComments(original, {
      name: 'new',
      value: 123,
    });
    expect(updated).toContain('# This is a comment');
    expect(updated).toContain('# inline comment');
    expect(updated).toContain('name: new');
  });

  it('should preserve inline comments with spacing', () => {
    const original = `name: old    # inline comment with spacing`;
    const updated = updateYamlPreservingComments(original, {
      name: 'new',
    });
    expect(updated).toContain('name: new');
    expect(updated).toContain('# inline comment with spacing');
  });

  it('should add new keys at the end', () => {
    const original = 'name: test';
    const updated = updateYamlPreservingComments(original, {
      name: 'test',
      newKey: 'value',
    });
    expect(updated).toContain('name: test');
    expect(updated).toContain('newKey: value');
  });

  it('should remove deleted keys', () => {
    const original = 'name: test\nold: value';
    const updated = updateYamlPreservingComments(original, { name: 'test' });
    expect(updated).toContain('name: test');
    expect(updated).not.toContain('old');
  });

  it('should handle nested objects', () => {
    const original = `user:
  name: old
  age: 30`;
    const updated = updateYamlPreservingComments(original, {
      user: {
        name: 'new',
        age: 30,
      },
    });
    expect(updated).toContain('name: new');
    expect(updated).toContain('age: 30');
  });

  it('should handle arrays', () => {
    const original = `items:
  - apple
  - banana`;
    const updated = updateYamlPreservingComments(original, {
      items: ['apple', 'banana', 'orange'],
    });
    expect(updated).toContain('- apple');
    expect(updated).toContain('- banana');
    expect(updated).toContain('- orange');
  });

  it('should return original when values are unchanged', () => {
    const original = 'name: test\nvalue: 123';
    const updated = updateYamlPreservingComments(original, {
      name: 'test',
      value: 123,
    });
    expect(updated).toBe(original);
  });

  it('should handle boolean values', () => {
    const original = 'enabled: false';
    const updated = updateYamlPreservingComments(original, { enabled: true });
    expect(updated).toContain('enabled: true');
  });

  it('should handle null values', () => {
    const original = 'value: old';
    const updated = updateYamlPreservingComments(original, { value: null });
    expect(updated).toContain('value: null');
  });

  it('should handle number changes', () => {
    const original = 'count: 5';
    const updated = updateYamlPreservingComments(original, { count: 10 });
    expect(updated).toContain('count: 10');
  });

  it('should preserve comments on unchanged keys', () => {
    const original = `# Header comment
name: test  # This should stay
value: 123  # This too`;
    const updated = updateYamlPreservingComments(original, {
      name: 'changed',
      value: 123,
    });
    expect(updated).toContain('# Header comment');
    expect(updated).toContain('# This should stay');
    expect(updated).toContain('# This too');
    expect(updated).toContain('name: changed');
  });

  it('should handle adding keys to empty object', () => {
    const original = '';
    const updated = updateYamlPreservingComments(original, {
      name: 'test',
      value: 123,
    });
    expect(updated).toContain('name: test');
    expect(updated).toContain('value: 123');
  });

  it('should handle removing all keys', () => {
    const original = 'name: test\nvalue: 123';
    const updated = updateYamlPreservingComments(original, {});
    expect(updated).not.toContain('name:');
    expect(updated).not.toContain('value:');
  });

  it('should handle empty arrays', () => {
    const original = 'items:\n  - apple';
    const updated = updateYamlPreservingComments(original, { items: [] });
    expect(updated).toContain('items: []');
  });

  it('should handle empty objects', () => {
    const original = 'user:\n  name: test';
    const updated = updateYamlPreservingComments(original, { user: {} });
    // Empty objects can be represented as `user: {}` or just `user:` in YAML
    // The implementation should remove all nested properties
    expect(updated).toMatch(/user:\s*(\{\})?/);
    expect(updated).not.toContain('name: test');
  });

  it('should handle complex nested structures', () => {
    const original = `# Config file
server:
  host: localhost  # Server host
  port: 3000       # Server port
database:
  url: postgres://localhost
  pool:
    min: 2
    max: 10`;

    const updated = updateYamlPreservingComments(original, {
      server: {
        host: '0.0.0.0',
        port: 3000,
      },
      database: {
        url: 'postgres://localhost',
        pool: {
          min: 5,
          max: 10,
        },
      },
    });

    expect(updated).toContain('# Config file');
    expect(updated).toContain('# Server host');
    expect(updated).toContain('# Server port');
    expect(updated).toContain('host: 0.0.0.0');
    expect(updated).toContain('min: 5');
  });

  it('should handle strings that need quoting', () => {
    const original = 'key: value';
    const updated = updateYamlPreservingComments(original, {
      key: 'value with: colon',
    });
    expect(updated).toContain('"value with: colon"');
  });

  it('should handle array of objects', () => {
    const original = `users:
  - name: Alice
    age: 30`;
    const updated = updateYamlPreservingComments(original, {
      users: [
        { name: 'Alice', age: 31 },
        { name: 'Bob', age: 25 },
      ],
    });
    expect(updated).toContain('- name: Alice');
    expect(updated).toContain('age: 31');
    expect(updated).toContain('- name: Bob');
    expect(updated).toContain('age: 25');
  });
});
