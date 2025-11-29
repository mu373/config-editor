import { describe, it, expect, beforeEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
import { userEvent } from '@testing-library/user-event';
import { SchemaPanel } from './index';
import { DocumentModel } from '@config-editor/core';
import type { JSONSchema7 } from 'json-schema';

describe('SchemaPanel Integration Tests', () => {
  let schema: JSONSchema7;
  let document: DocumentModel;

  beforeEach(() => {
    // Reset schema for each test
    schema = {
      type: 'object',
      properties: {
        name: { type: 'string', title: 'Name' },
        age: { type: 'number', title: 'Age' },
        email: { type: 'string', title: 'Email' },
        settings: {
          type: 'object',
          title: 'Settings',
          properties: {
            theme: { type: 'string', title: 'Theme' },
            notifications: { type: 'boolean', title: 'Notifications' },
          },
        },
        tags: {
          type: 'array',
          title: 'Tags',
          items: { type: 'string' },
        },
        users: {
          type: 'array',
          title: 'Users',
          items: {
            type: 'object',
            properties: {
              username: { type: 'string', title: 'Username' },
              role: { type: 'string', title: 'Role' },
            },
          },
        },
      },
      required: ['name'],
    };
  });

  describe('SchemaPanel → DocumentModel synchronization', () => {
    it('should update DocumentModel when form field changes', async () => {
      const initialData = {
        name: 'John',
        age: 30,
      };
      document = new DocumentModel(initialData, schema, 'yaml');

      const user = userEvent.setup();
      render(<SchemaPanel document={document} />);

      // Find the name input
      const nameInput = screen.getByDisplayValue('John');

      // Change the value
      await user.clear(nameInput);
      await user.type(nameInput, 'Jane');

      // Verify DocumentModel was updated
      await waitFor(() => {
        expect(document.getData().name).toBe('Jane');
      });
    });

    it('should update DocumentModel when nested object field changes', async () => {
      const initialData = {
        name: 'John',
        settings: {
          theme: 'dark',
          notifications: true,
        },
      };
      document = new DocumentModel(initialData, schema, 'yaml');

      const user = userEvent.setup();
      render(<SchemaPanel document={document} globalExpandLevel="all" />);

      // Find the theme input
      const themeInput = await screen.findByDisplayValue('dark');

      // Change the value
      await user.clear(themeInput);
      await user.type(themeInput, 'light');

      // Verify DocumentModel was updated
      await waitFor(() => {
        const data = document.getData();
        expect((data.settings as any)?.theme).toBe('light');
      });
    });

    it('should update DocumentModel when array element changes', async () => {
      const initialData = {
        name: 'John',
        tags: ['frontend', 'backend', 'devops'],
      };
      document = new DocumentModel(initialData, schema, 'yaml');

      const user = userEvent.setup();
      render(<SchemaPanel document={document} globalExpandLevel="all" />);

      // Find the first tag input
      const firstTagInput = await screen.findByDisplayValue('frontend');

      // Change the value
      await user.clear(firstTagInput);
      await user.type(firstTagInput, 'fullstack');

      // Verify DocumentModel was updated
      await waitFor(() => {
        const data = document.getData();
        expect((data.tags as any[])?.[0]).toBe('fullstack');
      });
    });
  });

  describe('DocumentModel → SchemaPanel synchronization', () => {
    it('should update form when DocumentModel data changes', async () => {
      const initialData = {
        name: 'John',
        age: 30,
      };
      document = new DocumentModel(initialData, schema, 'yaml');

      render(<SchemaPanel document={document} globalExpandLevel="all" />);

      // Verify initial value
      expect(screen.getByDisplayValue('John')).toBeInTheDocument();

      // Update document directly
      document.setData({ name: 'Jane', age: 31 });

      // Verify form updated
      await waitFor(() => {
        expect(screen.getByDisplayValue('Jane')).toBeInTheDocument();
      });
    });

    it('should update form when nested object in DocumentModel changes', async () => {
      const initialData = {
        name: 'John',
        settings: {
          theme: 'dark',
        },
      };
      document = new DocumentModel(initialData, schema, 'yaml');

      render(<SchemaPanel document={document} globalExpandLevel="all" />);

      // Verify initial value
      expect(screen.getByDisplayValue('dark')).toBeInTheDocument();

      // Update document directly
      document.setData({
        name: 'John',
        settings: {
          theme: 'light',
        },
      });

      // Verify form updated
      await waitFor(() => {
        expect(screen.getByDisplayValue('light')).toBeInTheDocument();
      });
    });

    it('should update form when array in DocumentModel changes', async () => {
      const initialData = {
        name: 'John',
        tags: ['frontend'],
      };
      document = new DocumentModel(initialData, schema, 'yaml');

      render(<SchemaPanel document={document} globalExpandLevel="all" />);

      // Verify initial value
      expect(screen.getByDisplayValue('frontend')).toBeInTheDocument();

      // Update document directly
      document.setData({
        name: 'John',
        tags: ['backend', 'devops'],
      });

      // Verify form updated
      await waitFor(() => {
        expect(screen.getByDisplayValue('backend')).toBeInTheDocument();
        expect(screen.getByDisplayValue('devops')).toBeInTheDocument();
        expect(screen.queryByDisplayValue('frontend')).not.toBeInTheDocument();
      });
    });
  });

  describe('Comment preservation', () => {
    it('should preserve YAML comments when updating through form', async () => {
      const yamlContent = `# User configuration
name: John  # User's full name
age: 30
# Settings section
settings:
  theme: dark  # UI theme
`;

      document = DocumentModel.deserialize(yamlContent, 'yaml', schema);

      const user = userEvent.setup();
      render(<SchemaPanel document={document} />);

      // Find and update the name field
      const nameInput = screen.getByDisplayValue('John');
      await user.clear(nameInput);
      await user.type(nameInput, 'Jane');

      // Serialize and check comments are preserved
      await waitFor(() => {
        const serialized = document.serialize();
        expect(serialized).toContain('# User configuration');
        expect(serialized).toContain("# User's full name");
        expect(serialized).toContain('# Settings section');
        expect(serialized).toContain('# UI theme');
        expect(serialized).toContain('Jane');
      });
    });

    it('should preserve JSON comments when updating through form', async () => {
      const jsoncContent = `{
  // User configuration
  "name": "John",  // User's full name
  "age": 30
}`;

      document = DocumentModel.deserialize(jsoncContent, 'jsonc', schema);

      const user = userEvent.setup();
      render(<SchemaPanel document={document} />);

      // Find and update the name field
      const nameInput = screen.getByDisplayValue('John');
      await user.clear(nameInput);
      await user.type(nameInput, 'Jane');

      // Serialize and check comments are preserved
      await waitFor(() => {
        const serialized = document.serialize();
        expect(serialized).toContain('// User configuration');
        expect(serialized).toContain("// User's full name");
        expect(serialized).toContain('Jane');
      });
    });
  });

  describe('Array editing end-to-end', () => {
    it('should handle updating array element correctly', async () => {
      const initialData = {
        name: 'John',
        tags: ['tag1', 'tag2', 'tag3'],
      };
      document = new DocumentModel(initialData, schema, 'yaml');

      const user = userEvent.setup();
      render(<SchemaPanel document={document} globalExpandLevel="all" />);

      // Find the second tag (index 1)
      const secondTag = await screen.findByDisplayValue('tag2');

      // Update it
      await user.clear(secondTag);
      await user.type(secondTag, 'updated-tag');

      // Verify the array was updated correctly
      await waitFor(() => {
        const data = document.getData();
        expect(data.tags).toEqual(['tag1', 'updated-tag', 'tag3']);
      });
    });
  });

  describe('Immutability', () => {
    it('should not mutate original data when form changes', async () => {
      const initialData = {
        name: 'John',
        settings: {
          theme: 'dark',
        },
      };
      document = new DocumentModel(initialData, schema, 'yaml');

      // Keep reference to original data
      const originalData = document.getData();
      const originalSettings = originalData.settings;

      const user = userEvent.setup();
      render(<SchemaPanel document={document} globalExpandLevel="all" />);

      // Update the theme
      const themeInput = await screen.findByDisplayValue('dark');
      await user.clear(themeInput);
      await user.type(themeInput, 'light');

      // Verify new data is different
      await waitFor(() => {
        const newData = document.getData();
        expect(newData).not.toBe(originalData);
        expect(newData.settings).not.toBe(originalSettings);
      });
    });
  });
});
