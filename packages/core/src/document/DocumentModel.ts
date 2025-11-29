import type { JSONSchema7 } from 'json-schema';
import { SchemaResolver } from '../schema/resolver';
import { getValueAtPath, setValueAtPath, deleteAtPath } from '../path/operations';
import type { Path } from '../path/types';
import {
  parseYaml,
  stringifyYaml,
  updateYamlPreservingComments,
} from '../formats/yaml';
import {
  parseJson,
  stringifyJson,
  parseJsonc,
  stringifyJsonc,
  updateJsonPreservingComments,
  type Format,
} from '../formats/json';

// Re-export Format type for convenience
export type { Format };

export type DocumentListener = (doc: DocumentModel) => void;

/**
 * DocumentModel provides a single source of truth for document data.
 * It handles parsing, serialization, and change notifications.
 */
export class DocumentModel {
  private data: Record<string, unknown>;
  private schema: JSONSchema7;
  private format: Format;
  private listeners: Set<DocumentListener> = new Set();
  private resolver: SchemaResolver;
  private rawContent: string;

  constructor(
    data: Record<string, unknown>,
    schema: JSONSchema7,
    format: Format,
    rawContent: string = ''
  ) {
    this.data = data;
    this.schema = schema;
    this.format = format;
    this.resolver = new SchemaResolver(schema);
    this.rawContent = rawContent;
  }

  /**
   * Get value at a specific path in the document.
   */
  getValue(path: Path): unknown {
    return getValueAtPath(this.data, path);
  }

  /**
   * Set value at a specific path in the document.
   * This will trigger change notifications.
   */
  setValue(path: Path, value: unknown): void {
    this.data = setValueAtPath(this.data, path, value);
    this.updateRawContent();
    this.notifyListeners();
  }

  /**
   * Delete value at a specific path in the document.
   * This will trigger change notifications.
   */
  deleteValue(path: Path): void {
    this.data = deleteAtPath(this.data, path);
    this.updateRawContent();
    this.notifyListeners();
  }

  /**
   * Get the entire document data.
   */
  getData(): Record<string, unknown> {
    return this.data;
  }

  /**
   * Set the entire document data.
   * This will trigger change notifications.
   */
  setData(data: Record<string, unknown>): void {
    this.data = data;
    this.updateRawContent();
    this.notifyListeners();
  }

  /**
   * Get the document schema.
   */
  getSchema(): JSONSchema7 {
    return this.schema;
  }

  /**
   * Update the schema and recreate the resolver.
   */
  setSchema(schema: JSONSchema7): void {
    this.schema = schema;
    this.resolver = new SchemaResolver(schema);
    this.notifyListeners();
  }

  /**
   * Get the document format.
   */
  getFormat(): Format {
    return this.format;
  }

  /**
   * Change the document format.
   */
  setFormat(format: Format): void {
    this.format = format;
    this.updateRawContent();
    this.notifyListeners();
  }

  /**
   * Serialize the document to a string, preserving comments if possible.
   */
  serialize(): string {
    return this.rawContent || this.serializeWithoutComments();
  }

  /**
   * Serialize the document without comment preservation.
   */
  private serializeWithoutComments(): string {
    if (this.format === 'yaml') {
      return stringifyYaml(this.data);
    } else if (this.format === 'jsonc') {
      return stringifyJsonc(this.data);
    } else {
      return stringifyJson(this.data);
    }
  }

  /**
   * Update raw content with comment preservation.
   */
  private updateRawContent(): void {
    if (!this.rawContent) {
      this.rawContent = this.serializeWithoutComments();
      return;
    }

    try {
      if (this.format === 'yaml') {
        this.rawContent = updateYamlPreservingComments(this.rawContent, this.data);
      } else if (this.format === 'jsonc' || this.format === 'json') {
        this.rawContent = updateJsonPreservingComments(this.rawContent, this.data);
      }
    } catch (err) {
      // If comment preservation fails, fall back to regular serialization
      console.warn('Comment preservation failed, falling back to regular serialization', err);
      this.rawContent = this.serializeWithoutComments();
    }
  }

  /**
   * Deserialize content into a DocumentModel.
   */
  static deserialize(content: string, format: Format, schema: JSONSchema7): DocumentModel {
    let data: Record<string, unknown>;

    try {
      if (format === 'yaml') {
        data = parseYaml(content) as Record<string, unknown>;
      } else if (format === 'jsonc') {
        data = parseJsonc(content) as Record<string, unknown>;
      } else {
        data = parseJson(content) as Record<string, unknown>;
      }

      // Handle null or non-object results
      if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        data = {};
      }
    } catch (err) {
      console.error('Failed to parse document content', err);
      data = {};
    }

    return new DocumentModel(data, schema, format, content);
  }

  /**
   * Subscribe to document changes.
   * Returns an unsubscribe function.
   */
  subscribe(listener: DocumentListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Notify all listeners of changes.
   */
  private notifyListeners(): void {
    this.listeners.forEach((listener) => listener(this));
  }

  /**
   * Get the schema resolver for this document.
   */
  getResolver(): SchemaResolver {
    return this.resolver;
  }

  /**
   * Update the document from raw content string.
   * This is useful when the content is edited externally (e.g., Monaco editor).
   */
  updateFromContent(content: string): void {
    try {
      let data: Record<string, unknown>;

      if (this.format === 'yaml') {
        data = parseYaml(content) as Record<string, unknown>;
      } else if (this.format === 'jsonc') {
        data = parseJsonc(content) as Record<string, unknown>;
      } else {
        data = parseJson(content) as Record<string, unknown>;
      }

      // Handle null or non-object results
      if (data === null || typeof data !== 'object' || Array.isArray(data)) {
        data = {};
      }

      this.data = data;
      this.rawContent = content;
      this.notifyListeners();
    } catch (err) {
      // Parse error - don't update
      console.error('Failed to update from content', err);
    }
  }
}
