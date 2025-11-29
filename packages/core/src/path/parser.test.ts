import { describe, it, expect } from 'vitest';
import {
  parsePath,
  pathToString,
  getParent,
  getAncestors,
  isAncestor,
  pathsEqual,
} from './parser';

describe('parsePath', () => {
  it('should parse empty string', () => {
    expect(parsePath('')).toEqual([]);
  });

  it('should parse simple property path', () => {
    expect(parsePath('user')).toEqual([{ type: 'property', key: 'user' }]);
  });

  it('should parse nested property path', () => {
    expect(parsePath('user.name')).toEqual([
      { type: 'property', key: 'user' },
      { type: 'property', key: 'name' },
    ]);
  });

  it('should parse array index', () => {
    expect(parsePath('users[0]')).toEqual([
      { type: 'property', key: 'users' },
      { type: 'index', index: 0 },
    ]);
  });

  it('should parse multiple array indices', () => {
    expect(parsePath('matrix[0][1]')).toEqual([
      { type: 'property', key: 'matrix' },
      { type: 'index', index: 0 },
      { type: 'index', index: 1 },
    ]);
  });

  it('should parse complex path', () => {
    expect(parsePath('user.addresses[0].street')).toEqual([
      { type: 'property', key: 'user' },
      { type: 'property', key: 'addresses' },
      { type: 'index', index: 0 },
      { type: 'property', key: 'street' },
    ]);
  });

  it('should handle property names with underscores', () => {
    expect(parsePath('user_name.first_name')).toEqual([
      { type: 'property', key: 'user_name' },
      { type: 'property', key: 'first_name' },
    ]);
  });

  it('should handle property names with numbers', () => {
    expect(parsePath('user123.name456')).toEqual([
      { type: 'property', key: 'user123' },
      { type: 'property', key: 'name456' },
    ]);
  });
});

describe('pathToString', () => {
  it('should convert empty path', () => {
    expect(pathToString([])).toBe('');
  });

  it('should convert simple property path', () => {
    expect(pathToString([{ type: 'property', key: 'user' }])).toBe('user');
  });

  it('should convert nested property path', () => {
    expect(
      pathToString([
        { type: 'property', key: 'user' },
        { type: 'property', key: 'name' },
      ])
    ).toBe('user.name');
  });

  it('should convert array index', () => {
    expect(
      pathToString([
        { type: 'property', key: 'users' },
        { type: 'index', index: 0 },
      ])
    ).toBe('users[0]');
  });

  it('should convert multiple array indices', () => {
    expect(
      pathToString([
        { type: 'property', key: 'matrix' },
        { type: 'index', index: 0 },
        { type: 'index', index: 1 },
      ])
    ).toBe('matrix[0][1]');
  });

  it('should convert complex path', () => {
    expect(
      pathToString([
        { type: 'property', key: 'user' },
        { type: 'property', key: 'addresses' },
        { type: 'index', index: 0 },
        { type: 'property', key: 'street' },
      ])
    ).toBe('user.addresses[0].street');
  });

  it('should be inverse of parsePath', () => {
    const paths = [
      'user',
      'user.name',
      'users[0]',
      'matrix[0][1]',
      'user.addresses[0].street',
    ];

    for (const path of paths) {
      expect(pathToString(parsePath(path))).toBe(path);
    }
  });
});

describe('getParent', () => {
  it('should return empty array for empty path', () => {
    expect(getParent([])).toEqual([]);
  });

  it('should return empty array for single segment', () => {
    expect(getParent([{ type: 'property', key: 'user' }])).toEqual([]);
  });

  it('should return parent for nested path', () => {
    expect(
      getParent([
        { type: 'property', key: 'user' },
        { type: 'property', key: 'name' },
      ])
    ).toEqual([{ type: 'property', key: 'user' }]);
  });

  it('should return parent for complex path', () => {
    expect(
      getParent([
        { type: 'property', key: 'user' },
        { type: 'property', key: 'addresses' },
        { type: 'index', index: 0 },
      ])
    ).toEqual([
      { type: 'property', key: 'user' },
      { type: 'property', key: 'addresses' },
    ]);
  });
});

describe('getAncestors', () => {
  it('should return only empty array for empty path', () => {
    expect(getAncestors([])).toEqual([[]]);
  });

  it('should return ancestors for simple path', () => {
    expect(getAncestors([{ type: 'property', key: 'user' }])).toEqual([
      [],
      [{ type: 'property', key: 'user' }],
    ]);
  });

  it('should return all ancestors for nested path', () => {
    expect(
      getAncestors([
        { type: 'property', key: 'user' },
        { type: 'property', key: 'addresses' },
        { type: 'index', index: 0 },
      ])
    ).toEqual([
      [],
      [{ type: 'property', key: 'user' }],
      [
        { type: 'property', key: 'user' },
        { type: 'property', key: 'addresses' },
      ],
      [
        { type: 'property', key: 'user' },
        { type: 'property', key: 'addresses' },
        { type: 'index', index: 0 },
      ],
    ]);
  });
});

describe('isAncestor', () => {
  it('should return false for equal paths', () => {
    const path = [{ type: 'property' as const, key: 'user' }];
    expect(isAncestor(path, path)).toBe(false);
  });

  it('should return false when ancestor is longer', () => {
    expect(
      isAncestor(
        [
          { type: 'property', key: 'user' },
          { type: 'property', key: 'name' },
        ],
        [{ type: 'property', key: 'user' }]
      )
    ).toBe(false);
  });

  it('should return true for direct ancestor', () => {
    expect(
      isAncestor(
        [{ type: 'property', key: 'user' }],
        [
          { type: 'property', key: 'user' },
          { type: 'property', key: 'name' },
        ]
      )
    ).toBe(true);
  });

  it('should return true for nested ancestor', () => {
    expect(
      isAncestor(
        [{ type: 'property', key: 'user' }],
        [
          { type: 'property', key: 'user' },
          { type: 'property', key: 'addresses' },
          { type: 'index', index: 0 },
        ]
      )
    ).toBe(true);
  });

  it('should return false for different paths', () => {
    expect(
      isAncestor(
        [{ type: 'property', key: 'user' }],
        [{ type: 'property', key: 'admin' }]
      )
    ).toBe(false);
  });

  it('should handle array indices correctly', () => {
    expect(
      isAncestor(
        [
          { type: 'property', key: 'users' },
          { type: 'index', index: 0 },
        ],
        [
          { type: 'property', key: 'users' },
          { type: 'index', index: 0 },
          { type: 'property', key: 'name' },
        ]
      )
    ).toBe(true);
  });

  it('should return false for different array indices', () => {
    expect(
      isAncestor(
        [
          { type: 'property', key: 'users' },
          { type: 'index', index: 0 },
        ],
        [
          { type: 'property', key: 'users' },
          { type: 'index', index: 1 },
        ]
      )
    ).toBe(false);
  });
});

describe('pathsEqual', () => {
  it('should return true for empty paths', () => {
    expect(pathsEqual([], [])).toBe(true);
  });

  it('should return true for equal simple paths', () => {
    expect(
      pathsEqual(
        [{ type: 'property', key: 'user' }],
        [{ type: 'property', key: 'user' }]
      )
    ).toBe(true);
  });

  it('should return true for equal complex paths', () => {
    expect(
      pathsEqual(
        [
          { type: 'property', key: 'user' },
          { type: 'property', key: 'addresses' },
          { type: 'index', index: 0 },
        ],
        [
          { type: 'property', key: 'user' },
          { type: 'property', key: 'addresses' },
          { type: 'index', index: 0 },
        ]
      )
    ).toBe(true);
  });

  it('should return false for different lengths', () => {
    expect(
      pathsEqual(
        [{ type: 'property', key: 'user' }],
        [
          { type: 'property', key: 'user' },
          { type: 'property', key: 'name' },
        ]
      )
    ).toBe(false);
  });

  it('should return false for different property keys', () => {
    expect(
      pathsEqual(
        [{ type: 'property', key: 'user' }],
        [{ type: 'property', key: 'admin' }]
      )
    ).toBe(false);
  });

  it('should return false for different array indices', () => {
    expect(
      pathsEqual(
        [{ type: 'index', index: 0 }],
        [{ type: 'index', index: 1 }]
      )
    ).toBe(false);
  });

  it('should return false for different segment types', () => {
    expect(
      pathsEqual(
        [{ type: 'property', key: '0' }],
        [{ type: 'index', index: 0 }]
      )
    ).toBe(false);
  });
});
