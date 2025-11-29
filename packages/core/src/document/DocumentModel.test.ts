import { describe, it, expect, vi } from 'vitest';
import { DocumentModel } from './DocumentModel';
import type { JSONSchema7 } from 'json-schema';

describe('DocumentModel', () => {
  const simpleSchema: JSONSchema7 = {
    type: 'object',
    properties: {
      name: { type: 'string' },
      age: { type: 'number' },
      active: { type: 'boolean' },
    },
  };

  const nestedSchema: JSONSchema7 = {
    type: 'object',
    properties: {
      user: {
        type: 'object',
        properties: {
          name: { type: 'string' },
          address: {
            type: 'object',
            properties: {
              street: { type: 'string' },
              city: { type: 'string' },
            },
          },
        },
      },
      tags: {
        type: 'array',
        items: { type: 'string' },
      },
    },
  };

  describe('constructor', () => {
    it('should create a document with initial data', () => {
      const data = { name: 'John', age: 30 };
      const doc = new DocumentModel(data, simpleSchema, 'json');

      expect(doc.getData()).toEqual(data);
      expect(doc.getSchema()).toEqual(simpleSchema);
      expect(doc.getFormat()).toBe('json');
    });

    it('should create a schema resolver', () => {
      const doc = new DocumentModel({}, simpleSchema, 'json');
      const resolver = doc.getResolver();

      expect(resolver).toBeDefined();
    });
  });

  describe('deserialize', () => {
    it('should deserialize JSON content', () => {
      const content = '{"name":"John","age":30}';
      const doc = DocumentModel.deserialize(content, 'json', simpleSchema);

      expect(doc.getData()).toEqual({ name: 'John', age: 30 });
      expect(doc.getFormat()).toBe('json');
    });

    it('should deserialize JSONC content with comments', () => {
      const content = `{
  // Name field
  "name": "John",
  "age": 30 // Age in years
}`;
      const doc = DocumentModel.deserialize(content, 'jsonc', simpleSchema);

      expect(doc.getData()).toEqual({ name: 'John', age: 30 });
      expect(doc.getFormat()).toBe('jsonc');
    });

    it('should deserialize YAML content', () => {
      const content = 'name: John\nage: 30';
      const doc = DocumentModel.deserialize(content, 'yaml', simpleSchema);

      expect(doc.getData()).toEqual({ name: 'John', age: 30 });
      expect(doc.getFormat()).toBe('yaml');
    });

    it('should handle invalid JSON gracefully', () => {
      const content = '{invalid json}';
      const doc = DocumentModel.deserialize(content, 'json', simpleSchema);

      expect(doc.getData()).toEqual({});
    });

    it('should handle null values', () => {
      const content = 'null';
      const doc = DocumentModel.deserialize(content, 'json', simpleSchema);

      expect(doc.getData()).toEqual({});
    });

    it('should handle array values', () => {
      const content = '[1, 2, 3]';
      const doc = DocumentModel.deserialize(content, 'json', simpleSchema);

      expect(doc.getData()).toEqual({});
    });

    it('should preserve raw content', () => {
      const content = '{"name":"John","age":30}';
      const doc = DocumentModel.deserialize(content, 'json', simpleSchema);

      expect(doc.serialize()).toBe(content);
    });
  });

  describe('serialize', () => {
    it('should serialize to JSON', () => {
      const doc = new DocumentModel({ name: 'John', age: 30 }, simpleSchema, 'json');
      const serialized = doc.serialize();

      expect(JSON.parse(serialized)).toEqual({ name: 'John', age: 30 });
    });

    it('should serialize to YAML', () => {
      const doc = new DocumentModel({ name: 'John', age: 30 }, simpleSchema, 'yaml');
      const serialized = doc.serialize();

      expect(serialized).toContain('name: John');
      expect(serialized).toContain('age: 30');
    });

    it('should preserve comments in JSONC after updates', () => {
      const content = `{
  // Name field
  "name": "John",
  "age": 30
}`;
      const doc = DocumentModel.deserialize(content, 'jsonc', simpleSchema);

      // Update a field
      doc.setValue([{ type: 'property', key: 'name' }], 'Jane');

      const serialized = doc.serialize();
      expect(serialized).toContain('// Name field');
      expect(serialized).toContain('Jane');
    });

    it('should preserve comments in YAML after updates', () => {
      const content = `# User information
name: John
age: 30 # Age in years`;

      const doc = DocumentModel.deserialize(content, 'yaml', simpleSchema);

      // Update a field
      doc.setValue([{ type: 'property', key: 'name' }], 'Jane');

      const serialized = doc.serialize();
      expect(serialized).toContain('# User information');
      expect(serialized).toContain('Jane');
    });
  });

  describe('getValue', () => {
    it('should get value at simple path', () => {
      const doc = new DocumentModel({ name: 'John', age: 30 }, simpleSchema, 'json');
      const value = doc.getValue([{ type: 'property', key: 'name' }]);

      expect(value).toBe('John');
    });

    it('should get value at nested path', () => {
      const data = {
        user: {
          name: 'John',
          address: { street: '123 Main St', city: 'Boston' },
        },
      };
      const doc = new DocumentModel(data, nestedSchema, 'json');

      const value = doc.getValue([
        { type: 'property', key: 'user' },
        { type: 'property', key: 'address' },
        { type: 'property', key: 'city' },
      ]);

      expect(value).toBe('Boston');
    });

    it('should get value at array index', () => {
      const data = { tags: ['red', 'green', 'blue'] };
      const doc = new DocumentModel(data, nestedSchema, 'json');

      const value = doc.getValue([
        { type: 'property', key: 'tags' },
        { type: 'index', index: 1 },
      ]);

      expect(value).toBe('green');
    });

    it('should return undefined for non-existent path', () => {
      const doc = new DocumentModel({ name: 'John' }, simpleSchema, 'json');
      const value = doc.getValue([{ type: 'property', key: 'missing' }]);

      expect(value).toBeUndefined();
    });
  });

  describe('setValue', () => {
    it('should set value at simple path', () => {
      const doc = new DocumentModel({ name: 'John', age: 30 }, simpleSchema, 'json');

      doc.setValue([{ type: 'property', key: 'name' }], 'Jane');

      expect(doc.getData()).toEqual({ name: 'Jane', age: 30 });
    });

    it('should set value at nested path', () => {
      const data = {
        user: {
          name: 'John',
          address: { street: '123 Main St', city: 'Boston' },
        },
      };
      const doc = new DocumentModel(data, nestedSchema, 'json');

      doc.setValue(
        [
          { type: 'property', key: 'user' },
          { type: 'property', key: 'address' },
          { type: 'property', key: 'city' },
        ],
        'New York'
      );

      expect(doc.getData().user).toEqual({
        name: 'John',
        address: { street: '123 Main St', city: 'New York' },
      });
    });

    it('should set value at array index', () => {
      const data = { tags: ['red', 'green', 'blue'] };
      const doc = new DocumentModel(data, nestedSchema, 'json');

      doc.setValue(
        [
          { type: 'property', key: 'tags' },
          { type: 'index', index: 1 },
        ],
        'yellow'
      );

      expect(doc.getData().tags).toEqual(['red', 'yellow', 'blue']);
    });

    it('should trigger listener notifications', () => {
      const doc = new DocumentModel({ name: 'John' }, simpleSchema, 'json');
      const listener = vi.fn();

      doc.subscribe(listener);
      doc.setValue([{ type: 'property', key: 'name' }], 'Jane');

      expect(listener).toHaveBeenCalledWith(doc);
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it('should create intermediate objects if needed', () => {
      const doc = new DocumentModel({}, nestedSchema, 'json');

      doc.setValue(
        [
          { type: 'property', key: 'user' },
          { type: 'property', key: 'address' },
          { type: 'property', key: 'city' },
        ],
        'Boston'
      );

      expect(doc.getData()).toEqual({
        user: {
          address: {
            city: 'Boston',
          },
        },
      });
    });
  });

  describe('deleteValue', () => {
    it('should delete value at simple path', () => {
      const doc = new DocumentModel({ name: 'John', age: 30 }, simpleSchema, 'json');

      doc.deleteValue([{ type: 'property', key: 'age' }]);

      expect(doc.getData()).toEqual({ name: 'John' });
    });

    it('should delete value at nested path', () => {
      const data = {
        user: {
          name: 'John',
          address: { street: '123 Main St', city: 'Boston' },
        },
      };
      const doc = new DocumentModel(data, nestedSchema, 'json');

      doc.deleteValue([
        { type: 'property', key: 'user' },
        { type: 'property', key: 'address' },
        { type: 'property', key: 'city' },
      ]);

      expect(doc.getData().user).toEqual({
        name: 'John',
        address: { street: '123 Main St' },
      });
    });

    it('should delete array element', () => {
      const data = { tags: ['red', 'green', 'blue'] };
      const doc = new DocumentModel(data, nestedSchema, 'json');

      doc.deleteValue([
        { type: 'property', key: 'tags' },
        { type: 'index', index: 1 },
      ]);

      expect(doc.getData().tags).toEqual(['red', 'blue']);
    });

    it('should trigger listener notifications', () => {
      const doc = new DocumentModel({ name: 'John', age: 30 }, simpleSchema, 'json');
      const listener = vi.fn();

      doc.subscribe(listener);
      doc.deleteValue([{ type: 'property', key: 'age' }]);

      expect(listener).toHaveBeenCalledWith(doc);
      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('setData', () => {
    it('should replace entire data object', () => {
      const doc = new DocumentModel({ name: 'John' }, simpleSchema, 'json');

      doc.setData({ name: 'Jane', age: 25 });

      expect(doc.getData()).toEqual({ name: 'Jane', age: 25 });
    });

    it('should trigger listener notifications', () => {
      const doc = new DocumentModel({ name: 'John' }, simpleSchema, 'json');
      const listener = vi.fn();

      doc.subscribe(listener);
      doc.setData({ name: 'Jane' });

      expect(listener).toHaveBeenCalledWith(doc);
    });
  });

  describe('setSchema', () => {
    it('should update schema', () => {
      const doc = new DocumentModel({}, simpleSchema, 'json');
      const newSchema: JSONSchema7 = {
        type: 'object',
        properties: {
          title: { type: 'string' },
        },
      };

      doc.setSchema(newSchema);

      expect(doc.getSchema()).toEqual(newSchema);
    });

    it('should recreate resolver with new schema', () => {
      const doc = new DocumentModel({}, simpleSchema, 'json');
      const oldResolver = doc.getResolver();

      doc.setSchema({
        type: 'object',
        properties: { title: { type: 'string' } },
      });

      const newResolver = doc.getResolver();
      expect(newResolver).not.toBe(oldResolver);
    });

    it('should trigger listener notifications', () => {
      const doc = new DocumentModel({}, simpleSchema, 'json');
      const listener = vi.fn();

      doc.subscribe(listener);
      doc.setSchema({ type: 'object' });

      expect(listener).toHaveBeenCalledWith(doc);
    });
  });

  describe('setFormat', () => {
    it('should change format', () => {
      const doc = new DocumentModel({ name: 'John' }, simpleSchema, 'json');

      doc.setFormat('yaml');

      expect(doc.getFormat()).toBe('yaml');
    });

    it('should update serialization format', () => {
      const doc = new DocumentModel({ name: 'John' }, simpleSchema, 'json');

      doc.setFormat('yaml');
      const serialized = doc.serialize();

      expect(serialized).toContain('name: John');
    });

    it('should trigger listener notifications', () => {
      const doc = new DocumentModel({}, simpleSchema, 'json');
      const listener = vi.fn();

      doc.subscribe(listener);
      doc.setFormat('yaml');

      expect(listener).toHaveBeenCalledWith(doc);
    });
  });

  describe('subscribe/unsubscribe', () => {
    it('should notify listener on changes', () => {
      const doc = new DocumentModel({ name: 'John' }, simpleSchema, 'json');
      const listener = vi.fn();

      doc.subscribe(listener);
      doc.setValue([{ type: 'property', key: 'name' }], 'Jane');

      expect(listener).toHaveBeenCalledWith(doc);
    });

    it('should support multiple listeners', () => {
      const doc = new DocumentModel({ name: 'John' }, simpleSchema, 'json');
      const listener1 = vi.fn();
      const listener2 = vi.fn();

      doc.subscribe(listener1);
      doc.subscribe(listener2);
      doc.setValue([{ type: 'property', key: 'name' }], 'Jane');

      expect(listener1).toHaveBeenCalledWith(doc);
      expect(listener2).toHaveBeenCalledWith(doc);
    });

    it('should unsubscribe listener', () => {
      const doc = new DocumentModel({ name: 'John' }, simpleSchema, 'json');
      const listener = vi.fn();

      const unsubscribe = doc.subscribe(listener);
      unsubscribe();

      doc.setValue([{ type: 'property', key: 'name' }], 'Jane');

      expect(listener).not.toHaveBeenCalled();
    });

    it('should not notify after unsubscribe', () => {
      const doc = new DocumentModel({ name: 'John' }, simpleSchema, 'json');
      const listener = vi.fn();

      const unsubscribe = doc.subscribe(listener);
      doc.setValue([{ type: 'property', key: 'name' }], 'Jane');

      expect(listener).toHaveBeenCalledTimes(1);

      unsubscribe();
      doc.setValue([{ type: 'property', key: 'name' }], 'Bob');

      expect(listener).toHaveBeenCalledTimes(1);
    });
  });

  describe('updateFromContent', () => {
    it('should update data from JSON content', () => {
      const doc = new DocumentModel({ name: 'John' }, simpleSchema, 'json');

      doc.updateFromContent('{"name":"Jane","age":25}');

      expect(doc.getData()).toEqual({ name: 'Jane', age: 25 });
    });

    it('should update data from YAML content', () => {
      const doc = new DocumentModel({ name: 'John' }, simpleSchema, 'yaml');

      doc.updateFromContent('name: Jane\nage: 25');

      expect(doc.getData()).toEqual({ name: 'Jane', age: 25 });
    });

    it('should trigger listener notifications', () => {
      const doc = new DocumentModel({ name: 'John' }, simpleSchema, 'json');
      const listener = vi.fn();

      doc.subscribe(listener);
      doc.updateFromContent('{"name":"Jane"}');

      expect(listener).toHaveBeenCalledWith(doc);
    });

    it('should not update on invalid content', () => {
      const doc = new DocumentModel({ name: 'John' }, simpleSchema, 'json');
      const listener = vi.fn();

      doc.subscribe(listener);
      doc.updateFromContent('{invalid}');

      expect(doc.getData()).toEqual({ name: 'John' });
      expect(listener).not.toHaveBeenCalled();
    });

    it('should handle null values', () => {
      const doc = new DocumentModel({ name: 'John' }, simpleSchema, 'json');

      doc.updateFromContent('null');

      expect(doc.getData()).toEqual({});
    });

    it('should preserve raw content for serialization', () => {
      const doc = new DocumentModel({ name: 'John' }, simpleSchema, 'json');
      const content = '{"name":"Jane","age":25}';

      doc.updateFromContent(content);

      expect(doc.serialize()).toBe(content);
    });
  });

  describe('comment preservation', () => {
    it('should preserve YAML comments across multiple updates', () => {
      const content = `# User config
name: John # Full name
age: 30`;

      const doc = DocumentModel.deserialize(content, 'yaml', simpleSchema);

      doc.setValue([{ type: 'property', key: 'name' }], 'Jane');
      doc.setValue([{ type: 'property', key: 'age' }], 31);

      const serialized = doc.serialize();
      expect(serialized).toContain('# User config');
      expect(serialized).toContain('# Full name');
      expect(serialized).toContain('Jane');
      expect(serialized).toContain('31');
    });

    it('should preserve JSONC comments across multiple updates', () => {
      const content = `{
  // User config
  "name": "John", // Full name
  "age": 30
}`;

      const doc = DocumentModel.deserialize(content, 'jsonc', simpleSchema);

      doc.setValue([{ type: 'property', key: 'name' }], 'Jane');
      doc.setValue([{ type: 'property', key: 'age' }], 31);

      const serialized = doc.serialize();
      expect(serialized).toContain('// User config');
      expect(serialized).toContain('// Full name');
      expect(serialized).toContain('Jane');
    });

    it('should handle new fields being added', () => {
      const content = `# User config
name: John`;

      const doc = DocumentModel.deserialize(content, 'yaml', simpleSchema);

      doc.setValue([{ type: 'property', key: 'age' }], 30);

      const serialized = doc.serialize();
      expect(serialized).toContain('# User config');
      expect(serialized).toContain('name: John');
      expect(serialized).toContain('age: 30');
    });

    it('should handle fields being deleted', () => {
      const content = `# User config
name: John
age: 30`;

      const doc = DocumentModel.deserialize(content, 'yaml', simpleSchema);

      doc.deleteValue([{ type: 'property', key: 'age' }]);

      const serialized = doc.serialize();
      expect(serialized).toContain('# User config');
      expect(serialized).toContain('name: John');
      expect(serialized).not.toContain('age');
    });
  });
});
