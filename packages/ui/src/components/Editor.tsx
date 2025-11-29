import { useRef, useEffect, useCallback } from 'react';
import MonacoEditor, { type Monaco } from '@monaco-editor/react';
import { configureMonacoYaml } from 'monaco-yaml';
import type { editor } from 'monaco-editor';
import { Download } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useSettingsStore } from '../store/settingsStore';
import { registerCustomThemes } from '../lib/monacoThemes';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Button } from './ui/button';
import { DocumentModel, type Format, getPathAtPosition } from '@config-editor/core';
import { useMonacoSync } from '../hooks/useMonacoSync';
import { useFormNavigation } from '../hooks/useFormNavigation';

interface EditorProps {
  documentModel: DocumentModel | null;
}

export function Editor({ documentModel }: EditorProps) {
  const { tabs, activeTabId, setContent, setFormat, markClean } = useEditorStore();
  const { settings } = useSettingsStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);
  const { navigateToPath } = useFormNavigation();

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  // Update documentModel when tab content/schema/format changes from store
  useEffect(() => {
    if (!documentModel || !activeTab) return;

    documentModel.updateFromContent(activeTab.content);
  }, [documentModel, activeTab?.content]);

  useEffect(() => {
    if (!documentModel || !activeTab?.schema) return;

    documentModel.setSchema(activeTab.schema);
  }, [documentModel, activeTab?.schema]);

  useEffect(() => {
    if (!documentModel || !activeTab) return;

    documentModel.setFormat(activeTab.format);
  }, [documentModel, activeTab?.format]);

  // Subscribe to documentModel changes and sync to store
  useEffect(() => {
    if (!documentModel) return;

    const unsubscribe = documentModel.subscribe((doc) => {
      const newContent = doc.serialize();
      setContent(newContent);
    });

    return unsubscribe;
  }, [documentModel, setContent]);

  // Sync documentModel with Monaco editor
  useMonacoSync(documentModel, editorRef.current);

  const handleEditorDidMount = (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // Register custom themes
    registerCustomThemes(monaco);
  };

  // Cmd/Ctrl+click handler for navigating to form fields
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activeTab) return;

    const disposable = editor.onMouseDown((e) => {
      // Check for Cmd (Mac) or Ctrl (Windows/Linux)
      // metaKey is Cmd on Mac, ctrlKey is Ctrl on Windows/Linux
      const isMac = navigator.platform.toUpperCase().indexOf('MAC') >= 0;
      const modifierPressed = isMac ? e.event.metaKey : e.event.ctrlKey;
      if (!modifierPressed) return;

      // Get position from the mouse event
      const position = e.target.position;
      if (!position) return;

      // Get the content and format
      const content = editor.getValue();
      const format = activeTab.format;

      // Get the path at the cursor position
      const path = getPathAtPosition(content, position, format);
      if (!path) return;

      // Navigate to the form field
      navigateToPath(path);

      // Prevent default behavior (e.g., go to definition)
      e.event.preventDefault();
      e.event.stopPropagation();
    });

    return () => disposable.dispose();
  }, [activeTab?.format, navigateToPath]);

  // Update schema in monaco-yaml when active tab changes
  useEffect(() => {
    if (monacoRef.current && activeTab?.schema) {
      configureMonacoYaml(monacoRef.current, {
        enableSchemaRequest: false,
        schemas: [
          {
            uri: `file:///schema-${activeTabId}.json`,
            fileMatch: ['*'],
            schema: activeTab.schema as Record<string, unknown>,
          },
        ],
      });
    } else if (monacoRef.current) {
      // Clear schema when no active tab or no schema
      configureMonacoYaml(monacoRef.current, {
        enableSchemaRequest: false,
        schemas: [],
      });
    }
  }, [activeTab?.schema, activeTabId]);

  const handleFormatToggle = useCallback(
    (newFormat: Format) => {
      if (!activeTab || !documentModel || newFormat === activeTab.format) return;

      try {
        // DocumentModel handles format conversion internally
        documentModel.setFormat(newFormat);
        setFormat(newFormat);
      } catch (err) {
        console.error('Format conversion error:', err);
        alert('Cannot convert: content has syntax errors');
      }
    },
    [activeTab, documentModel, setFormat]
  );

  const handleDownload = useCallback(() => {
    if (!activeTab) return;
    const ext = activeTab.format === 'yaml' ? 'yaml' : 'json';
    const defaultName = activeTab.fileName || `config.${ext}`;
    const blob = new Blob([activeTab.content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = defaultName;
    a.click();
    URL.revokeObjectURL(url);
    markClean();
  }, [activeTab, markClean]);

  if (!activeTab) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-muted text-muted-foreground">
        <div className="text-center">
          <p className="text-lg">No file open</p>
          <p className="text-sm mt-2">
            Click "+ New" to create a new configuration file
          </p>
        </div>
      </div>
    );
  }

  const language = activeTab.format === 'yaml' ? 'yaml' : 'json';

  return (
    <div className="h-full w-full flex flex-col">
      {/* Header - matching SchemaPanel style */}
      <div className="flex items-center justify-end gap-2 px-3 h-10 border-b border-border bg-muted">
        <ToggleGroup
          type="single"
          value={activeTab.format}
          onValueChange={(value) => value && handleFormatToggle(value as Format)}
          variant="outline"
          size="sm"
        >
          <ToggleGroupItem value="yaml" title="YAML format" className="text-xs">
            YAML
          </ToggleGroupItem>
          {settings.jsonIncludeComments ? (
            <ToggleGroupItem value="jsonc" title="JSONC format (JSON with Comments)" className="text-xs">
              JSONC
            </ToggleGroupItem>
          ) : (
            <ToggleGroupItem value="json" title="JSON format" className="text-xs">
              JSON
            </ToggleGroupItem>
          )}
        </ToggleGroup>
        <Button
          variant="outline"
          size="icon-sm"
          onClick={handleDownload}
          title="Download"
        >
          <Download className="size-3.5" />
        </Button>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <MonacoEditor
          key={activeTabId} // Force remount on tab change for clean state
          height="100%"
          language={language}
          defaultValue={activeTab.content}
          onMount={handleEditorDidMount}
          options={{
            minimap: { enabled: false },
            fontSize: 14,
            lineNumbers: 'on',
            scrollBeyondLastLine: false,
            wordWrap: 'on',
            tabSize: 2,
            automaticLayout: true,
          }}
          theme={settings.monacoTheme}
        />
      </div>
    </div>
  );
}
