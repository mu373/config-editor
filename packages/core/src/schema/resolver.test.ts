import { describe, it, expect, beforeEach } from 'vitest';
import { SchemaResolver } from './resolver';
import type { JSONSchema7 } from 'json-schema';

describe('SchemaResolver', () => {
  const rootSchema: JSONSchema7 = {
    $defs: {
      Address: {
        type: 'object',
        properties: {
          street: { type: 'string' },
          city: { type: 'string' },
          zipCode: { type: 'string' },
        },
      },
      Person: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          address: { $ref: '#/$defs/Address' },
        },
      },
      Company: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          employees: {
            type: 'array',
            items: { $ref: '#/$defs/Person' },
          },
        },
      },
    },
  };

  let resolver: SchemaResolver;

  beforeEach(() => {
    resolver = new SchemaResolver(rootSchema);
  });

  describe('resolve', () => {
    it('should return schema unchanged if no $ref', () => {
      const schema: JSONSchema7 = { type: 'string' };
      const resolved = resolver.resolve(schema);
      expect(resolved).toBe(schema);
    });

    it('should resolve $ref to definition', () => {
      const schema: JSONSchema7 = { $ref: '#/$defs/Address' };
      const resolved = resolver.resolve(schema);
      expect(resolved).toEqual(rootSchema.$defs!.Address);
    });

    it('should resolve nested $ref', () => {
      const schema: JSONSchema7 = { $ref: '#/$defs/Person' };
      const resolved = resolver.resolve(schema);
      expect(resolved).toEqual(rootSchema.$defs!.Person);
    });

    it('should cache resolved schemas', () => {
      const schema: JSONSchema7 = { $ref: '#/$defs/Address' };
      const resolved1 = resolver.resolve(schema);
      const resolved2 = resolver.resolve(schema);
      expect(resolved1).toBe(resolved2); // Same reference = cached
    });

    it('should throw on invalid $ref', () => {
      const schema: JSONSchema7 = { $ref: '#/$defs/Invalid' };
      expect(() => resolver.resolve(schema)).toThrow('Invalid $ref: #/$defs/Invalid');
    });

    it('should handle definitions keyword', () => {
      const customSchema: JSONSchema7 = {
        definitions: {
          Test: { type: 'string' },
        },
      };
      const customResolver = new SchemaResolver(customSchema);
      const resolved = customResolver.resolve({ $ref: '#/definitions/Test' });
      expect(resolved).toEqual({ type: 'string' });
    });

    it('should resolve deeply nested $ref paths', () => {
      const deepSchema: any = {
        level1: {
          level2: {
            level3: {
              value: { type: 'number' },
            },
          },
        },
      };
      const deepResolver = new SchemaResolver(deepSchema);
      const resolved = deepResolver.resolve({ $ref: '#/level1/level2/level3/value' });
      expect(resolved).toEqual({ type: 'number' });
    });
  });

  describe('getPropertySchema', () => {
    it('should get direct property schema', () => {
      const personSchema = rootSchema.$defs!.Person as JSONSchema7;
      const nameSchema = resolver.getPropertySchema(personSchema, 'name');
      expect(nameSchema).toEqual({ type: 'string' });
    });

    it('should resolve property with $ref', () => {
      const personSchema = rootSchema.$defs!.Person as JSONSchema7;
      const addressSchema = resolver.getPropertySchema(personSchema, 'address');
      expect(addressSchema).toEqual(rootSchema.$defs!.Address);
    });

    it('should return undefined for missing property', () => {
      const personSchema = rootSchema.$defs!.Person as JSONSchema7;
      const result = resolver.getPropertySchema(personSchema, 'nonexistent');
      expect(result).toBeUndefined();
    });

    it('should handle patternProperties', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        patternProperties: {
          '^[0-9]+$': { type: 'number' },
        },
      };
      const customResolver = new SchemaResolver(schema);
      const result = customResolver.getPropertySchema(schema, '123');
      expect(result).toEqual({ type: 'number' });
    });

    it('should handle additionalProperties', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
        },
        additionalProperties: { type: 'boolean' },
      };
      const customResolver = new SchemaResolver(schema);
      const result = customResolver.getPropertySchema(schema, 'extra');
      expect(result).toEqual({ type: 'boolean' });
    });

    it('should prefer direct properties over patternProperties', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          '123': { type: 'string' },
        },
        patternProperties: {
          '^[0-9]+$': { type: 'number' },
        },
      };
      const customResolver = new SchemaResolver(schema);
      const result = customResolver.getPropertySchema(schema, '123');
      expect(result).toEqual({ type: 'string' });
    });

    it('should prefer patternProperties over additionalProperties', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        patternProperties: {
          '^[0-9]+$': { type: 'number' },
        },
        additionalProperties: { type: 'boolean' },
      };
      const customResolver = new SchemaResolver(schema);
      const result = customResolver.getPropertySchema(schema, '123');
      expect(result).toEqual({ type: 'number' });
    });

    it('should resolve parent schema $ref before getting property', () => {
      const schema: JSONSchema7 = { $ref: '#/$defs/Person' };
      const nameSchema = resolver.getPropertySchema(schema, 'name');
      expect(nameSchema).toEqual({ type: 'string' });
    });
  });

  describe('getDefaultValue', () => {
    it('should return schema default if specified', () => {
      const schema: JSONSchema7 = { type: 'string', default: 'test' };
      expect(resolver.getDefaultValue(schema)).toBe('test');
    });

    it('should return empty string for string type', () => {
      const schema: JSONSchema7 = { type: 'string' };
      expect(resolver.getDefaultValue(schema)).toBe('');
    });

    it('should return 0 for number type', () => {
      const schema: JSONSchema7 = { type: 'number' };
      expect(resolver.getDefaultValue(schema)).toBe(0);
    });

    it('should return 0 for integer type', () => {
      const schema: JSONSchema7 = { type: 'integer' };
      expect(resolver.getDefaultValue(schema)).toBe(0);
    });

    it('should return false for boolean type', () => {
      const schema: JSONSchema7 = { type: 'boolean' };
      expect(resolver.getDefaultValue(schema)).toBe(false);
    });

    it('should return empty array for array type', () => {
      const schema: JSONSchema7 = { type: 'array' };
      expect(resolver.getDefaultValue(schema)).toEqual([]);
    });

    it('should return empty object for object type', () => {
      const schema: JSONSchema7 = { type: 'object' };
      expect(resolver.getDefaultValue(schema)).toEqual({});
    });

    it('should return null for nullable types (anyOf)', () => {
      const schema: JSONSchema7 = {
        anyOf: [{ type: 'string' }, { type: 'null' }],
      };
      expect(resolver.getDefaultValue(schema)).toBeNull();
    });

    it('should return null for nullable types (oneOf)', () => {
      const schema: JSONSchema7 = {
        oneOf: [{ type: 'string' }, { type: 'null' }],
      };
      expect(resolver.getDefaultValue(schema)).toBeNull();
    });

    it('should handle array type with null', () => {
      const schema: JSONSchema7 = {
        type: ['string', 'null'],
      };
      expect(resolver.getDefaultValue(schema)).toBe('');
    });

    it('should return null for unknown type', () => {
      const schema: JSONSchema7 = {};
      expect(resolver.getDefaultValue(schema)).toBeNull();
    });

    it('should resolve $ref before getting default', () => {
      const customSchema: JSONSchema7 = {
        $defs: {
          StringWithDefault: {
            type: 'string',
            default: 'default value',
          },
        },
      };
      const customResolver = new SchemaResolver(customSchema);
      const value = customResolver.getDefaultValue({
        $ref: '#/$defs/StringWithDefault',
      });
      expect(value).toBe('default value');
    });
  });

  describe('getPropertyOrder', () => {
    it('should return empty array if no properties', () => {
      const schema: JSONSchema7 = { type: 'object' };
      expect(resolver.getPropertyOrder(schema)).toEqual([]);
    });

    it('should return properties in definition order', () => {
      const schema: JSONSchema7 = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          email: { type: 'string' },
        },
      };
      const customResolver = new SchemaResolver(schema);
      expect(customResolver.getPropertyOrder(schema)).toEqual([
        'name',
        'age',
        'email',
      ]);
    });

    it('should use x-order extension if available', () => {
      const schema: any = {
        type: 'object',
        properties: {
          name: { type: 'string' },
          age: { type: 'number' },
          email: { type: 'string' },
        },
        'x-order': ['email', 'name', 'age'],
      };
      const customResolver = new SchemaResolver(schema);
      expect(customResolver.getPropertyOrder(schema)).toEqual([
        'email',
        'name',
        'age',
      ]);
    });

    it('should resolve $ref before getting property order', () => {
      const personSchema = rootSchema.$defs!.Person as JSONSchema7;
      const order = resolver.getPropertyOrder({ $ref: '#/$defs/Person' });
      expect(order).toEqual(Object.keys(personSchema.properties!));
    });
  });

  describe('clearCache', () => {
    it('should clear the cache', () => {
      const schema: JSONSchema7 = { $ref: '#/$defs/Address' };
      const resolved1 = resolver.resolve(schema);
      resolver.clearCache();
      const resolved2 = resolver.resolve(schema);
      // After clearing cache, should resolve again (may or may not be same reference)
      expect(resolved2).toEqual(rootSchema.$defs!.Address);
    });
  });

  describe('getRootSchema', () => {
    it('should return the root schema', () => {
      expect(resolver.getRootSchema()).toBe(rootSchema);
    });
  });
});
