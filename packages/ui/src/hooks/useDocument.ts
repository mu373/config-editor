import { useState, useEffect, useMemo } from 'react';
import { DocumentModel, type Format } from '@config-editor/core';
import type { JSONSchema7 } from 'json-schema';

/**
 * React hook for managing a DocumentModel instance.
 * Creates a document from initial content and subscribes to changes.
 *
 * @param initialContent - The initial document content string
 * @param schema - JSON Schema for the document
 * @param format - Document format (yaml, json, or jsonc)
 * @returns The DocumentModel instance
 *
 * @example
 * ```tsx
 * function MyEditor() {
 *   const document = useDocument(yamlContent, schema, 'yaml');
 *
 *   const handleChange = (path, value) => {
 *     document.setValue(path, value);
 *   };
 *
 *   return <SchemaForm document={document} onChange={handleChange} />;
 * }
 * ```
 */
export function useDocument(
  initialContent: string,
  schema: JSONSchema7 | null,
  format: Format
): DocumentModel {
  // Create document instance only once on mount
  const document = useMemo(() => {
    return DocumentModel.deserialize(
      initialContent,
      format,
      schema ?? {}
    );
  }, []);

  // Update document when schema or format changes
  useEffect(() => {
    if (schema) {
      document.setSchema(schema);
    }
  }, [document, schema]);

  useEffect(() => {
    document.setFormat(format);
  }, [document, format]);

  return document;
}

/**
 * React hook for subscribing to DocumentModel changes.
 * Triggers a re-render whenever the document changes.
 *
 * @param document - The DocumentModel to subscribe to (can be null)
 * @returns The current document data, or empty object if no document
 *
 * @example
 * ```tsx
 * function MyComponent({ document }: { document: DocumentModel | null }) {
 *   const data = useDocumentData(document);
 *
 *   return <div>{JSON.stringify(data)}</div>;
 * }
 * ```
 */
export function useDocumentData(document: DocumentModel | null): Record<string, unknown> {
  const [data, setData] = useState(() => document?.getData() ?? {});

  useEffect(() => {
    if (!document) {
      setData({});
      return;
    }

    // Subscribe to document changes
    const unsubscribe = document.subscribe((doc) => {
      setData(doc.getData());
    });

    // Update to current data in case it changed before subscription
    setData(document.getData());

    return unsubscribe;
  }, [document]);

  return data;
}

/**
 * React hook for subscribing to DocumentModel serialization.
 * Triggers a re-render whenever the serialized content changes.
 *
 * @param document - The DocumentModel to subscribe to
 * @returns The current serialized content
 *
 * @example
 * ```tsx
 * function MonacoEditor({ document }: { document: DocumentModel }) {
 *   const content = useDocumentContent(document);
 *
 *   return <Monaco value={content} />;
 * }
 * ```
 */
export function useDocumentContent(document: DocumentModel): string {
  const [content, setContent] = useState(() => document.serialize());

  useEffect(() => {
    // Subscribe to document changes
    const unsubscribe = document.subscribe((doc) => {
      setContent(doc.serialize());
    });

    // Update to current content in case it changed before subscription
    setContent(document.serialize());

    return unsubscribe;
  }, [document]);

  return content;
}
