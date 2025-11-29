import { describe, it, expect } from 'vitest';
import { parsePath, setValueAtPath } from '@config-editor/core';

describe('SchemaForm path handling', () => {
  describe('setValueAtPath with parsePath (core utilities)', () => {
    it('should handle simple property paths', () => {
      const obj = { name: 'old' };
      const path = parsePath('name');
      const result = setValueAtPath(obj, path, 'new');
      expect(result).toEqual({ name: 'new' });
    });

    it('should handle nested object paths', () => {
      const obj = { user: { name: 'old' } };
      const path = parsePath('user.name');
      const result = setValueAtPath(obj, path, 'new');
      expect(result).toEqual({ user: { name: 'new' } });
    });

    it('should handle array index paths', () => {
      const obj = { items: ['a', 'b', 'c'] };
      const path = parsePath('items[0]');
      const result = setValueAtPath(obj, path, 'new');
      expect(result).toEqual({ items: ['new', 'b', 'c'] });
    });

    it('should handle nested array object paths', () => {
      const obj = { users: [{ name: 'old' }] };
      const path = parsePath('users[0].name');
      const result = setValueAtPath(obj, path, 'new');
      expect(result).toEqual({ users: [{ name: 'new' }] });
    });

    it('should not mutate original object', () => {
      const obj = { user: { name: 'old' } };
      const path = parsePath('user.name');
      const result = setValueAtPath(obj, path, 'new');
      expect(obj.user.name).toBe('old'); // unchanged
      expect(result.user.name).toBe('new');
    });

    it('should create missing intermediate objects', () => {
      const obj = {};
      const path = parsePath('user.name');
      const result = setValueAtPath(obj, path, 'new');
      expect(result).toEqual({ user: { name: 'new' } });
    });

    it('should create missing intermediate arrays', () => {
      const obj = {};
      const path = parsePath('items[0]');
      const result = setValueAtPath(obj, path, 'value');
      expect(result).toEqual({ items: ['value'] });
    });

    it('should handle complex nested paths', () => {
      const obj = {
        config: {
          servers: [
            { host: 'localhost', port: 8080 }
          ]
        }
      };
      const path = parsePath('config.servers[0].port');
      const result = setValueAtPath(obj, path, 3000);
      expect(result).toEqual({
        config: {
          servers: [
            { host: 'localhost', port: 3000 }
          ]
        }
      });
      // Original unchanged
      expect((obj.config.servers[0] as any).port).toBe(8080);
    });

    it('should handle array of arrays', () => {
      const obj = { matrix: [['a', 'b'], ['c', 'd']] };
      const path = parsePath('matrix[1][0]');
      const result = setValueAtPath(obj, path, 'x');
      expect(result).toEqual({ matrix: [['a', 'b'], ['x', 'd']] });
    });

    it('should handle updating middle array element', () => {
      const obj = { items: ['a', 'b', 'c', 'd'] };
      const path = parsePath('items[2]');
      const result = setValueAtPath(obj, path, 'X');
      expect(result).toEqual({ items: ['a', 'b', 'X', 'd'] });
    });

    it('should preserve other properties when updating nested value', () => {
      const obj = {
        user: { name: 'John', age: 30, email: 'john@example.com' },
        status: 'active'
      };
      const path = parsePath('user.age');
      const result = setValueAtPath(obj, path, 31);
      expect(result).toEqual({
        user: { name: 'John', age: 31, email: 'john@example.com' },
        status: 'active'
      });
    });

    it('should handle empty path', () => {
      const obj = { name: 'test' };
      const path = parsePath('');
      const result = setValueAtPath(obj, path, 'new');
      expect(result).toBe(obj); // Should return original when path is empty
    });
  });

  describe('parsePath', () => {
    it('should parse simple property', () => {
      expect(parsePath('name')).toEqual([
        { type: 'property', key: 'name' }
      ]);
    });

    it('should parse nested properties', () => {
      expect(parsePath('user.name')).toEqual([
        { type: 'property', key: 'user' },
        { type: 'property', key: 'name' }
      ]);
    });

    it('should parse array index', () => {
      expect(parsePath('items[0]')).toEqual([
        { type: 'property', key: 'items' },
        { type: 'index', index: 0 }
      ]);
    });

    it('should parse nested array and object', () => {
      expect(parsePath('users[0].name')).toEqual([
        { type: 'property', key: 'users' },
        { type: 'index', index: 0 },
        { type: 'property', key: 'name' }
      ]);
    });

    it('should parse array of arrays', () => {
      expect(parsePath('matrix[0][1]')).toEqual([
        { type: 'property', key: 'matrix' },
        { type: 'index', index: 0 },
        { type: 'index', index: 1 }
      ]);
    });

    it('should handle empty string', () => {
      expect(parsePath('')).toEqual([]);
    });
  });
});
