import { describe, it, expect } from 'vitest';
import {
  getValueAtPath,
  setValueAtPath,
  deleteAtPath,
  hasPath,
  moveArrayElement,
} from './operations';

describe('getValueAtPath', () => {
  it('should return object for empty path', () => {
    const obj = { user: { name: 'John' } };
    expect(getValueAtPath(obj, [])).toBe(obj);
  });

  it('should get simple property', () => {
    const obj = { name: 'John' };
    expect(
      getValueAtPath(obj, [{ type: 'property', key: 'name' }])
    ).toBe('John');
  });

  it('should get nested property', () => {
    const obj = { user: { name: 'John' } };
    expect(
      getValueAtPath(obj, [
        { type: 'property', key: 'user' },
        { type: 'property', key: 'name' },
      ])
    ).toBe('John');
  });

  it('should get array element', () => {
    const obj = { users: ['John', 'Jane'] };
    expect(
      getValueAtPath(obj, [
        { type: 'property', key: 'users' },
        { type: 'index', index: 1 },
      ])
    ).toBe('Jane');
  });

  it('should get nested array property', () => {
    const obj = { users: [{ name: 'John' }, { name: 'Jane' }] };
    expect(
      getValueAtPath(obj, [
        { type: 'property', key: 'users' },
        { type: 'index', index: 1 },
        { type: 'property', key: 'name' },
      ])
    ).toBe('Jane');
  });

  it('should return undefined for missing property', () => {
    const obj = { user: { name: 'John' } };
    expect(
      getValueAtPath(obj, [{ type: 'property', key: 'admin' }])
    ).toBeUndefined();
  });

  it('should return undefined for missing nested property', () => {
    const obj = { user: { name: 'John' } };
    expect(
      getValueAtPath(obj, [
        { type: 'property', key: 'user' },
        { type: 'property', key: 'age' },
      ])
    ).toBeUndefined();
  });

  it('should return undefined for index out of bounds', () => {
    const obj = { users: ['John'] };
    expect(
      getValueAtPath(obj, [
        { type: 'property', key: 'users' },
        { type: 'index', index: 5 },
      ])
    ).toBeUndefined();
  });

  it('should handle null values', () => {
    const obj = { user: null };
    expect(
      getValueAtPath(obj, [
        { type: 'property', key: 'user' },
        { type: 'property', key: 'name' },
      ])
    ).toBeUndefined();
  });
});

describe('setValueAtPath', () => {
  it('should return object for empty path', () => {
    const obj = { user: { name: 'John' } };
    expect(setValueAtPath(obj, [], 'test')).toBe(obj);
  });

  it('should set simple property', () => {
    const obj = { name: 'John' };
    const result = setValueAtPath(obj, [{ type: 'property', key: 'name' }], 'Jane');
    expect(result).toEqual({ name: 'Jane' });
    expect(obj.name).toBe('John'); // Original unchanged
  });

  it('should set nested property', () => {
    const obj = { user: { name: 'John', age: 30 } };
    const result = setValueAtPath(
      obj,
      [
        { type: 'property', key: 'user' },
        { type: 'property', key: 'name' },
      ],
      'Jane'
    );
    expect(result).toEqual({ user: { name: 'Jane', age: 30 } });
    expect(obj.user.name).toBe('John'); // Original unchanged
  });

  it('should set array element', () => {
    const obj = { users: ['John', 'Jane'] };
    const result = setValueAtPath(
      obj,
      [
        { type: 'property', key: 'users' },
        { type: 'index', index: 1 },
      ],
      'Jack'
    );
    expect(result).toEqual({ users: ['John', 'Jack'] });
    expect(obj.users[1]).toBe('Jane'); // Original unchanged
  });

  it('should set nested array property', () => {
    const obj = { users: [{ name: 'John' }, { name: 'Jane' }] };
    const result = setValueAtPath(
      obj,
      [
        { type: 'property', key: 'users' },
        { type: 'index', index: 1 },
        { type: 'property', key: 'name' },
      ],
      'Jack'
    );
    expect(result).toEqual({
      users: [{ name: 'John' }, { name: 'Jack' }],
    });
    expect(obj.users[1].name).toBe('Jane'); // Original unchanged
  });

  it('should add new property', () => {
    const obj = { name: 'John' };
    const result = setValueAtPath(obj, [{ type: 'property', key: 'age' }], 30);
    expect(result).toEqual({ name: 'John', age: 30 });
  });

  it('should create nested structure if missing', () => {
    const obj = {} as any;
    const result = setValueAtPath(
      obj,
      [
        { type: 'property', key: 'user' },
        { type: 'property', key: 'name' },
      ],
      'John'
    );
    expect(result).toEqual({ user: { name: 'John' } });
  });

  it('should create array if missing', () => {
    const obj = {} as any;
    const result = setValueAtPath(
      obj,
      [
        { type: 'property', key: 'users' },
        { type: 'index', index: 0 },
      ],
      'John'
    );
    expect(result).toEqual({ users: ['John'] });
  });

  it('should preserve immutability - objects not shared', () => {
    const obj = { user: { name: 'John' } };
    const result = setValueAtPath(
      obj,
      [
        { type: 'property', key: 'user' },
        { type: 'property', key: 'age' },
      ],
      30
    );
    expect(result.user).not.toBe(obj.user);
    expect(result).not.toBe(obj);
  });

  it('should preserve immutability - arrays not shared', () => {
    const obj = { users: ['John'] };
    const result = setValueAtPath(
      obj,
      [
        { type: 'property', key: 'users' },
        { type: 'index', index: 0 },
      ],
      'Jane'
    );
    expect(result.users).not.toBe(obj.users);
    expect(result).not.toBe(obj);
  });
});

describe('deleteAtPath', () => {
  it('should return object for empty path', () => {
    const obj = { user: { name: 'John' } };
    expect(deleteAtPath(obj, [])).toBe(obj);
  });

  it('should delete simple property', () => {
    const obj = { name: 'John', age: 30 };
    const result = deleteAtPath(obj, [{ type: 'property', key: 'age' }]);
    expect(result).toEqual({ name: 'John' });
    expect(obj.age).toBe(30); // Original unchanged
  });

  it('should delete nested property', () => {
    const obj = { user: { name: 'John', age: 30 } };
    const result = deleteAtPath(obj, [
      { type: 'property', key: 'user' },
      { type: 'property', key: 'age' },
    ]);
    expect(result).toEqual({ user: { name: 'John' } });
    expect(obj.user.age).toBe(30); // Original unchanged
  });

  it('should delete array element', () => {
    const obj = { users: ['John', 'Jane', 'Jack'] };
    const result = deleteAtPath(obj, [
      { type: 'property', key: 'users' },
      { type: 'index', index: 1 },
    ]);
    expect(result).toEqual({ users: ['John', 'Jack'] });
    expect(obj.users).toHaveLength(3); // Original unchanged
  });

  it('should delete nested array property', () => {
    const obj = { users: [{ name: 'John', age: 30 }] };
    const result = deleteAtPath(obj, [
      { type: 'property', key: 'users' },
      { type: 'index', index: 0 },
      { type: 'property', key: 'age' },
    ]);
    expect(result).toEqual({ users: [{ name: 'John' }] });
    expect(obj.users[0].age).toBe(30); // Original unchanged
  });

  it('should preserve immutability', () => {
    const obj = { user: { name: 'John', age: 30 } };
    const result = deleteAtPath(obj, [
      { type: 'property', key: 'user' },
      { type: 'property', key: 'age' },
    ]);
    expect(result.user).not.toBe(obj.user);
    expect(result).not.toBe(obj);
  });
});

describe('hasPath', () => {
  it('should return true for empty path', () => {
    expect(hasPath({ user: { name: 'John' } }, [])).toBe(true);
  });

  it('should return true for existing property', () => {
    const obj = { name: 'John' };
    expect(hasPath(obj, [{ type: 'property', key: 'name' }])).toBe(true);
  });

  it('should return true for existing nested property', () => {
    const obj = { user: { name: 'John' } };
    expect(
      hasPath(obj, [
        { type: 'property', key: 'user' },
        { type: 'property', key: 'name' },
      ])
    ).toBe(true);
  });

  it('should return true for existing array element', () => {
    const obj = { users: ['John', 'Jane'] };
    expect(
      hasPath(obj, [
        { type: 'property', key: 'users' },
        { type: 'index', index: 1 },
      ])
    ).toBe(true);
  });

  it('should return false for missing property', () => {
    const obj = { name: 'John' };
    expect(hasPath(obj, [{ type: 'property', key: 'age' }])).toBe(false);
  });

  it('should return false for missing nested property', () => {
    const obj = { user: { name: 'John' } };
    expect(
      hasPath(obj, [
        { type: 'property', key: 'user' },
        { type: 'property', key: 'age' },
      ])
    ).toBe(false);
  });

  it('should return false for index out of bounds', () => {
    const obj = { users: ['John'] };
    expect(
      hasPath(obj, [
        { type: 'property', key: 'users' },
        { type: 'index', index: 5 },
      ])
    ).toBe(false);
  });

  it('should return false for null values', () => {
    const obj = { user: null };
    expect(
      hasPath(obj, [
        { type: 'property', key: 'user' },
        { type: 'property', key: 'name' },
      ])
    ).toBe(false);
  });

  it('should handle value 0 correctly', () => {
    const obj = { count: 0 };
    expect(hasPath(obj, [{ type: 'property', key: 'count' }])).toBe(true);
  });

  it('should handle value false correctly', () => {
    const obj = { enabled: false };
    expect(hasPath(obj, [{ type: 'property', key: 'enabled' }])).toBe(true);
  });

  it('should handle empty string correctly', () => {
    const obj = { name: '' };
    expect(hasPath(obj, [{ type: 'property', key: 'name' }])).toBe(true);
  });
});

describe('moveArrayElement', () => {
  it('should move element forward', () => {
    const obj = { items: ['a', 'b', 'c', 'd'] };
    const result = moveArrayElement(
      obj,
      [{ type: 'property', key: 'items' }],
      0,
      2
    );
    expect(result).toEqual({ items: ['b', 'c', 'a', 'd'] });
    expect(obj.items[0]).toBe('a'); // Original unchanged
  });

  it('should move element backward', () => {
    const obj = { items: ['a', 'b', 'c', 'd'] };
    const result = moveArrayElement(
      obj,
      [{ type: 'property', key: 'items' }],
      2,
      0
    );
    expect(result).toEqual({ items: ['c', 'a', 'b', 'd'] });
  });

  it('should move to end', () => {
    const obj = { items: ['a', 'b', 'c'] };
    const result = moveArrayElement(
      obj,
      [{ type: 'property', key: 'items' }],
      0,
      2
    );
    expect(result).toEqual({ items: ['b', 'c', 'a'] });
  });

  it('should handle nested array', () => {
    const obj = { data: { items: ['a', 'b', 'c'] } };
    const result = moveArrayElement(
      obj,
      [
        { type: 'property', key: 'data' },
        { type: 'property', key: 'items' },
      ],
      0,
      2
    );
    expect(result).toEqual({ data: { items: ['b', 'c', 'a'] } });
  });

  it('should throw for non-array path', () => {
    const obj = { name: 'John' };
    expect(() =>
      moveArrayElement(obj, [{ type: 'property', key: 'name' }], 0, 1)
    ).toThrow('Path does not point to an array');
  });

  it('should preserve immutability', () => {
    const obj = { items: ['a', 'b', 'c'] };
    const result = moveArrayElement(
      obj,
      [{ type: 'property', key: 'items' }],
      0,
      2
    );
    expect(result).not.toBe(obj);
    expect(result.items).not.toBe(obj.items);
  });
});
