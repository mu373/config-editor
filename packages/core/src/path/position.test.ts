import { describe, it, expect } from 'vitest';
import { getPathAtPosition, getPathAtPositionYaml, getPathAtPositionJson } from './position';

describe('getPathAtPositionYaml', () => {
  const yaml = `name: test
user:
  email: foo@bar.com
  addresses:
    - street: Main St
      city: NYC
    - street: Second St
      city: LA
items:
  - one
  - two
`;

  it('returns path for top-level key', () => {
    expect(getPathAtPositionYaml(yaml, { lineNumber: 1, column: 1 })).toBe('name');
    expect(getPathAtPositionYaml(yaml, { lineNumber: 1, column: 5 })).toBe('name');
  });

  it('returns path for nested object key', () => {
    expect(getPathAtPositionYaml(yaml, { lineNumber: 3, column: 3 })).toBe('user.email');
    expect(getPathAtPositionYaml(yaml, { lineNumber: 3, column: 10 })).toBe('user.email');
  });

  it('returns path for array item in nested object', () => {
    expect(getPathAtPositionYaml(yaml, { lineNumber: 5, column: 7 })).toBe('user.addresses[0].street');
    expect(getPathAtPositionYaml(yaml, { lineNumber: 6, column: 7 })).toBe('user.addresses[0].city');
    expect(getPathAtPositionYaml(yaml, { lineNumber: 7, column: 7 })).toBe('user.addresses[1].street');
  });

  it('returns path for parent object when on parent key', () => {
    expect(getPathAtPositionYaml(yaml, { lineNumber: 2, column: 1 })).toBe('user');
    expect(getPathAtPositionYaml(yaml, { lineNumber: 4, column: 3 })).toBe('user.addresses');
  });

  it('returns path for scalar array items', () => {
    expect(getPathAtPositionYaml(yaml, { lineNumber: 10, column: 5 })).toBe('items[0]');
    expect(getPathAtPositionYaml(yaml, { lineNumber: 11, column: 5 })).toBe('items[1]');
  });
});

describe('getPathAtPositionJson', () => {
  const json = `{
  "name": "test",
  "user": {
    "email": "foo@bar.com",
    "addresses": [
      { "street": "Main St", "city": "NYC" },
      { "street": "Second St", "city": "LA" }
    ]
  },
  "items": ["one", "two"]
}`;

  it('returns path for top-level key', () => {
    expect(getPathAtPositionJson(json, { lineNumber: 2, column: 5 })).toBe('name');
  });

  it('returns path for nested object key', () => {
    expect(getPathAtPositionJson(json, { lineNumber: 4, column: 6 })).toBe('user.email');
  });

  it('returns path for array item', () => {
    expect(getPathAtPositionJson(json, { lineNumber: 6, column: 10 })).toBe('user.addresses[0].street');
  });
});

describe('getPathAtPosition', () => {
  it('uses yaml parser for yaml format', () => {
    const yaml = 'name: test\n';
    expect(getPathAtPosition(yaml, { lineNumber: 1, column: 1 }, 'yaml')).toBe('name');
  });

  it('uses json parser for json format', () => {
    const json = '{"name": "test"}';
    expect(getPathAtPosition(json, { lineNumber: 1, column: 3 }, 'json')).toBe('name');
  });

  it('uses json parser for jsonc format', () => {
    const jsonc = '{"name": "test" /* comment */}';
    expect(getPathAtPosition(jsonc, { lineNumber: 1, column: 3 }, 'jsonc')).toBe('name');
  });
});
