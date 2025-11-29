import { describe, it, expect } from 'vitest';
import {
  resolveRef,
  getDefaultValue,
  getPropertySchema,
  getSchemaPropertyOrder,
} from './utils';
import type { JSONSchema7 } from 'json-schema';

describe('resolveRef', () => {
  it('should resolve $ref to schema definition', () => {
    const rootSchema: JSONSchema7 = {
      $defs: {
        Address: {
          type: 'object',
          properties: { street: { type: 'string' } },
        },
      },
    };
    const schema: JSONSchema7 = { $ref: '#/$defs/Address' };
    const resolved = resolveRef(schema, rootSchema);
    expect(resolved).toEqual(rootSchema.$defs!.Address);
  });

  it('should return schema unchanged if no $ref', () => {
    const schema: JSONSchema7 = { type: 'string' };
    const resolved = resolveRef(schema, {});
    expect(resolved).toBe(schema);
  });

  it('should throw on invalid $ref', () => {
    expect(() => resolveRef({ $ref: '#/$defs/Invalid' }, {})).toThrow(
      'Invalid $ref: #/$defs/Invalid'
    );
  });

  it('should resolve nested $ref paths', () => {
    const rootSchema: JSONSchema7 = {
      definitions: {
        nested: {
          deep: {
            value: { type: 'number' },
          },
        },
      },
    };
    const schema: JSONSchema7 = { $ref: '#/definitions/nested/deep/value' };
    const resolved = resolveRef(schema, rootSchema);
    expect(resolved).toEqual({ type: 'number' });
  });

  it('should handle $defs and definitions', () => {
    const rootSchema: JSONSchema7 = {
      $defs: {
        StringType: { type: 'string' },
      },
    };
    const schema: JSONSchema7 = { $ref: '#/$defs/StringType' };
    const resolved = resolveRef(schema, rootSchema);
    expect(resolved).toEqual({ type: 'string' });
  });
});

describe('getDefaultValue', () => {
  it('should return default if specified', () => {
    expect(getDefaultValue({ default: 'test' })).toBe('test');
  });

  it('should return default for number', () => {
    expect(getDefaultValue({ type: 'number', default: 42 })).toBe(42);
  });

  it('should return empty string for string type', () => {
    expect(getDefaultValue({ type: 'string' })).toBe('');
  });

  it('should return 0 for number type', () => {
    expect(getDefaultValue({ type: 'number' })).toBe(0);
  });

  it('should return 0 for integer type', () => {
    expect(getDefaultValue({ type: 'integer' })).toBe(0);
  });

  it('should return false for boolean type', () => {
    expect(getDefaultValue({ type: 'boolean' })).toBe(false);
  });

  it('should return empty array for array type', () => {
    expect(getDefaultValue({ type: 'array' })).toEqual([]);
  });

  it('should return empty object for object type', () => {
    expect(getDefaultValue({ type: 'object' })).toEqual({});
  });

  it('should return null for anyOf', () => {
    expect(
      getDefaultValue({
        anyOf: [{ type: 'string' }, { type: 'number' }],
      })
    ).toBe(null);
  });

  it('should return null for oneOf', () => {
    expect(
      getDefaultValue({
        oneOf: [{ type: 'string' }, { type: 'number' }],
      })
    ).toBe(null);
  });

  it('should handle nullable types (array of types with null)', () => {
    expect(getDefaultValue({ type: ['string', 'null'] })).toBe('');
    expect(getDefaultValue({ type: ['number', 'null'] })).toBe(0);
  });

  it('should return null for unknown type', () => {
    expect(getDefaultValue({})).toBe(null);
  });

  it('should resolve $ref before getting default', () => {
    const rootSchema: JSONSchema7 = {
      $defs: {
        StringType: { type: 'string', default: 'hello' },
      },
    };
    const schema: JSONSchema7 = { $ref: '#/$defs/StringType' };
    expect(getDefaultValue(schema, rootSchema)).toBe('hello');
  });

  it('should use type default when $ref has no default', () => {
    const rootSchema: JSONSchema7 = {
      $defs: {
        NumberType: { type: 'number' },
      },
    };
    const schema: JSONSchema7 = { $ref: '#/$defs/NumberType' };
    expect(getDefaultValue(schema, rootSchema)).toBe(0);
  });
});

describe('getPropertySchema', () => {
  it('should get direct property schema', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
      },
    };
    const nameSchema = getPropertySchema(schema, 'name', schema);
    expect(nameSchema).toEqual({ type: 'string' });
  });

  it('should resolve property with $ref', () => {
    const rootSchema: JSONSchema7 = {
      $defs: {
        Address: {
          type: 'object',
          properties: { street: { type: 'string' } },
        },
      },
      properties: {
        address: { $ref: '#/$defs/Address' },
      },
    };
    const addressSchema = getPropertySchema(rootSchema, 'address', rootSchema);
    expect(addressSchema).toEqual(rootSchema.$defs!.Address);
  });

  it('should match patternProperties', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      patternProperties: {
        '^[a-z]+$': { type: 'string' },
        '^[0-9]+$': { type: 'number' },
      },
    };
    const stringSchema = getPropertySchema(schema, 'hello', schema);
    expect(stringSchema).toEqual({ type: 'string' });

    const numberSchema = getPropertySchema(schema, '123', schema);
    expect(numberSchema).toEqual({ type: 'number' });
  });

  it('should fall back to additionalProperties', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      additionalProperties: { type: 'boolean' },
    };
    const additionalSchema = getPropertySchema(schema, 'other', schema);
    expect(additionalSchema).toEqual({ type: 'boolean' });
  });

  it('should resolve additionalProperties $ref', () => {
    const rootSchema: JSONSchema7 = {
      $defs: {
        DynamicValue: { type: 'string' },
      },
      type: 'object',
      additionalProperties: { $ref: '#/$defs/DynamicValue' },
    };
    const schema = getPropertySchema(rootSchema, 'anyKey', rootSchema);
    expect(schema).toEqual({ type: 'string' });
  });

  it('should return undefined for non-existent property', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      additionalProperties: false,
    };
    const result = getPropertySchema(schema, 'nonexistent', schema);
    expect(result).toBeUndefined();
  });

  it('should resolve parent schema $ref', () => {
    const rootSchema: JSONSchema7 = {
      $defs: {
        Person: {
          type: 'object',
          properties: {
            name: { type: 'string' },
          },
        },
      },
    };
    const parentSchema: JSONSchema7 = { $ref: '#/$defs/Person' };
    const nameSchema = getPropertySchema(parentSchema, 'name', rootSchema);
    expect(nameSchema).toEqual({ type: 'string' });
  });

  it('should prioritize properties over patternProperties', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        name: { type: 'string' },
      },
      patternProperties: {
        '.*': { type: 'number' },
      },
    };
    const nameSchema = getPropertySchema(schema, 'name', schema);
    expect(nameSchema).toEqual({ type: 'string' });
  });

  it('should prioritize patternProperties over additionalProperties', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      patternProperties: {
        '^[a-z]+$': { type: 'string' },
      },
      additionalProperties: { type: 'number' },
    };
    const stringSchema = getPropertySchema(schema, 'hello', schema);
    expect(stringSchema).toEqual({ type: 'string' });

    const numberSchema = getPropertySchema(schema, 'CAPS', schema);
    expect(numberSchema).toEqual({ type: 'number' });
  });
});

describe('getSchemaPropertyOrder', () => {
  it('should return properties in order', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: {
        name: { type: 'string' },
        age: { type: 'number' },
        email: { type: 'string' },
      },
    };
    const order = getSchemaPropertyOrder(schema, schema);
    expect(order).toEqual(['name', 'age', 'email']);
  });

  it('should return empty array for schema without properties', () => {
    const schema: JSONSchema7 = {
      type: 'object',
    };
    const order = getSchemaPropertyOrder(schema, schema);
    expect(order).toEqual([]);
  });

  it('should return empty array for undefined schema', () => {
    const order = getSchemaPropertyOrder(undefined, undefined);
    expect(order).toEqual([]);
  });

  it('should return empty array for undefined rootSchema', () => {
    const schema: JSONSchema7 = {
      type: 'object',
      properties: { name: { type: 'string' } },
    };
    const order = getSchemaPropertyOrder(schema, undefined);
    expect(order).toEqual([]);
  });

  it('should resolve $ref before getting property order', () => {
    const rootSchema: JSONSchema7 = {
      $defs: {
        Person: {
          type: 'object',
          properties: {
            firstName: { type: 'string' },
            lastName: { type: 'string' },
          },
        },
      },
    };
    const schema: JSONSchema7 = { $ref: '#/$defs/Person' };
    const order = getSchemaPropertyOrder(schema, rootSchema);
    expect(order).toEqual(['firstName', 'lastName']);
  });
});
