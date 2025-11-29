import { useEffect, useRef } from 'react';
import type { editor } from 'monaco-editor';
import { DocumentModel } from '@config-editor/core';

/**
 * Hook to synchronize a DocumentModel with a Monaco Editor instance.
 * Handles bidirectional sync with debouncing and cursor preservation.
 *
 * @param document - The DocumentModel to sync
 * @param editor - The Monaco Editor instance
 * @param debounceMs - Debounce delay in milliseconds (default: 300)
 *
 * @example
 * ```tsx
 * function MonacoEditor({ document }: { document: DocumentModel }) {
 *   const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
 *
 *   useMonacoSync(document, editorRef.current);
 *
 *   return <Monaco onMount={(e) => editorRef.current = e} />;
 * }
 * ```
 */
export function useMonacoSync(
  document: DocumentModel | null,
  editor: editor.IStandaloneCodeEditor | null,
  debounceMs: number = 150
): void {
  const debounceRef = useRef<NodeJS.Timeout>();
  const isUpdatingFromDocumentRef = useRef(false);

  // Monaco → Document (user types in editor)
  useEffect(() => {
    if (!editor || !document) return;

    const disposable = editor.onDidChangeModelContent(() => {
      // Skip if this change came from document subscription
      if (isUpdatingFromDocumentRef.current) return;

      const content = editor.getValue();

      clearTimeout(debounceRef.current);
      debounceRef.current = setTimeout(() => {
        try {
          // Update document from Monaco content
          document.updateFromContent(content);
        } catch (err) {
          // Parse error - don't update document
          console.error('Failed to parse Monaco content:', err);
        }
      }, debounceMs);
    });

    return () => {
      disposable.dispose();
      clearTimeout(debounceRef.current);
    };
  }, [document, editor, debounceMs]);

  // Document → Monaco (changes from SchemaPanel or external source)
  useEffect(() => {
    if (!editor || !document) return;

    const unsubscribe = document.subscribe((doc) => {
      const newContent = doc.serialize();
      const currentContent = editor.getValue();

      // Only update if content actually changed
      if (newContent === currentContent) return;

      // Mark that we're updating from document to prevent feedback loop
      isUpdatingFromDocumentRef.current = true;

      const model = editor.getModel();
      if (!model) {
        isUpdatingFromDocumentRef.current = false;
        return;
      }

      // Save cursor position, scroll, and selections
      const position = editor.getPosition();
      const scrollTop = editor.getScrollTop();
      const selections = editor.getSelections();

      // Use executeEdits for smoother update (preserves undo/redo stack)
      editor.executeEdits('document-sync', [
        {
          range: model.getFullModelRange(),
          text: newContent,
          forceMoveMarkers: true,
        },
      ]);

      // Restore position and scroll
      if (selections && selections.length > 0) {
        editor.setSelections(selections);
      } else if (position) {
        const lineCount = model.getLineCount();
        const newPosition = {
          lineNumber: Math.min(position.lineNumber, lineCount),
          column: Math.min(
            position.column,
            model.getLineMaxColumn(Math.min(position.lineNumber, lineCount))
          ),
        };
        editor.setPosition(newPosition);
      }
      editor.setScrollTop(scrollTop);

      // Reset flag after a tick to allow Monaco's change event to fire
      setTimeout(() => {
        isUpdatingFromDocumentRef.current = false;
      }, 0);
    });

    return unsubscribe;
  }, [document, editor]);
}
