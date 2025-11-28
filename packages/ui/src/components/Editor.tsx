import { useRef, useEffect, useCallback } from 'react';
import MonacoEditor, { type Monaco } from '@monaco-editor/react';
import { configureMonacoYaml } from 'monaco-yaml';
import type { editor } from 'monaco-editor';
import { useEditorStore } from '../store/editorStore';
import {
  parseYaml,
  stringifyYaml,
  parseJson,
  stringifyJson,
  type Format,
} from '@config-editor/core';

export function Editor() {
  const { tabs, activeTabId, setContent, setFormat } = useEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const editorRef = useRef<editor.IStandaloneCodeEditor | null>(null);
  const monacoRef = useRef<Monaco | null>(null);

  const handleEditorDidMount = (
    editor: editor.IStandaloneCodeEditor,
    monaco: Monaco
  ) => {
    editorRef.current = editor;
    monacoRef.current = monaco;
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

  const handleChange = (value: string | undefined) => {
    if (value !== undefined) {
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

  if (!activeTab) {
    return (
      <div className="h-full w-full flex items-center justify-center bg-gray-50 text-gray-500">
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
      <div className="flex items-center justify-end px-3 h-10 border-b bg-gray-50">
        <div className="flex items-center bg-gray-200 rounded p-0.5">
          <button
            onClick={() => handleFormatToggle('yaml')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              activeTab.format === 'yaml'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title="YAML format"
          >
            YAML
          </button>
          <button
            onClick={() => handleFormatToggle('json')}
            className={`px-2 py-1 text-xs rounded transition-colors ${
              activeTab.format === 'json'
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
            title="JSON format"
          >
            JSON
          </button>
        </div>
      </div>

      {/* Monaco Editor */}
      <div className="flex-1 min-h-0">
        <MonacoEditor
          key={activeTabId} // Force remount on tab change for clean state
          height="100%"
          language={language}
          value={activeTab.content}
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
          theme="vs-light"
        />
      </div>
    </div>
  );
}
