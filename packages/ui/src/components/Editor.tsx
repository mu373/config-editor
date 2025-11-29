import { useRef, useEffect, useCallback } from 'react';
import MonacoEditor, { type Monaco } from '@monaco-editor/react';
import { configureMonacoYaml } from 'monaco-yaml';
import type { editor } from 'monaco-editor';
import { Download } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useSettingsStore } from '../store/settingsStore';
import { ToggleGroup, ToggleGroupItem } from './ui/toggle-group';
import { Button } from './ui/button';
import {
  parseYaml,
  stringifyYaml,
  parseJson,
  stringifyJson,
  type Format,
} from '@config-editor/core';

export function Editor() {
  const { tabs, activeTabId, setContent, setFormat, markClean } = useEditorStore();
  const { settings } = useSettingsStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);
  // Track the last content we synced TO Monaco (from external source)
  const lastSyncedContentRef = useRef<string | null>(null);
  // Track content that Monaco has (including user edits)
  const lastMonacoContentRef = useRef<string | null>(null);
  // Flag to prevent feedback loop when we're updating from store
  const isUpdatingFromStoreRef = useRef(false);

  const handleEditorDidMount = (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
    // Initialize content tracking with what Monaco starts with
    const initialContent = editor.getValue();
    lastMonacoContentRef.current = initialContent;
    lastSyncedContentRef.current = initialContent;
  };

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

  // Sync external content changes (e.g. from SchemaPanel) to Monaco
  // Only sync if the change came from outside Monaco (not from user typing)
  useEffect(() => {
    const editor = editorRef.current;
    if (!editor || !activeTab) return;

    const storeContent = activeTab.content;

    // Skip if we're in the middle of an update cycle
    if (isUpdatingFromStoreRef.current) {
      return;
    }

    // Skip if this content matches what Monaco already has
    // (meaning this update originated from Monaco itself)
    if (storeContent === lastMonacoContentRef.current) {
      return;
    }

    const model = editor.getModel();
    if (!model) return;

    isUpdatingFromStoreRef.current = true;

    // Save cursor/scroll position
    const position = editor.getPosition();
    const scrollTop = editor.getScrollTop();
    const selections = editor.getSelections();

    // Use executeEdits for smoother update
    editor.executeEdits('schema-panel-sync', [
      {
        range: model.getFullModelRange(),
        text: storeContent,
        forceMoveMarkers: true,
      },
    ]);

    // Update our tracking refs
    lastSyncedContentRef.current = storeContent;
    lastMonacoContentRef.current = storeContent;

    // Restore position and scroll
    if (selections && selections.length > 0) {
      editor.setSelections(selections);
    } else if (position) {
      const lineCount = model.getLineCount();
      const newPosition = {
        lineNumber: Math.min(position.lineNumber, lineCount),
        column: Math.min(position.column, model.getLineMaxColumn(Math.min(position.lineNumber, lineCount))),
      };
      editor.setPosition(newPosition);
    }
    editor.setScrollTop(scrollTop);

    isUpdatingFromStoreRef.current = false;
  }, [activeTab?.content]);

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
      // Track what Monaco now has before updating store
      lastMonacoContentRef.current = value;
      setContent(value);
    }
  };

  const handleFormatToggle = useCallback(
    (newFormat: Format) => {
      if (!activeTab || newFormat === activeTab.format) return;

      try {
        if (activeTab.format === 'yaml' && newFormat === 'json') {
          const parsed = parseYaml(activeTab.content);
          setContent(stringifyJson(parsed));
        } else if (activeTab.format === 'json' && newFormat === 'yaml') {
          const parsed = parseJson(activeTab.content);
          setContent(stringifyYaml(parsed));
        }
        setFormat(newFormat);
      } catch (err) {
        console.error('Format conversion error:', err);
        alert('Cannot convert: content has syntax errors');
      }
    },
    [activeTab, setContent, setFormat]
  );

  const handleDownload = useCallback(() => {
    if (!activeTab) return;
    const ext = activeTab.format === 'json' ? 'json' : 'yaml';
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

  const language = activeTab.format === 'json' ? 'json' : 'yaml';

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
          <ToggleGroupItem value="json" title="JSON format" className="text-xs">
            JSON
          </ToggleGroupItem>
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
          onChange={handleChange}
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
