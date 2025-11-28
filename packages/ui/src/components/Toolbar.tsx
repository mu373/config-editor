import { FileUp, Download } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { detectFormat, type JSONSchema } from '@config-editor/core';

interface ToolbarProps {
  defaultSchema?: JSONSchema;
  defaultSchemaId?: string;
}

export function Toolbar({ defaultSchema, defaultSchemaId }: ToolbarProps) {
  const { tabs, activeTabId, addTab, markClean } = useEditorStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleOpenFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const text = await file.text();
      const detected = detectFormat(text);

      // Create a new tab for the opened file
      addTab({
        fileName: file.name,
        content: text,
        format: detected,
        schema: defaultSchema ?? null,
        schemaId: defaultSchemaId ?? null,
        isDirty: false,
      });
    };
    input.click();
  };

  const handleDownload = () => {
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
  };

  return (
    <div className="flex items-center gap-2 px-4 py-2 border-b bg-white">
      <button
        onClick={handleOpenFile}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors"
        title="Open File"
      >
        <FileUp className="w-4 h-4" />
        Open
      </button>

      <button
        onClick={handleDownload}
        disabled={!activeTab}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-100 rounded-md transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        title="Download"
      >
        <Download className="w-4 h-4" />
        Download
      </button>

      <div className="flex-1" />

      {activeTab && (
        <span className="text-sm text-gray-600">
          {activeTab.fileName || 'Untitled'}
          {activeTab.isDirty && <span className="text-orange-500 ml-1">●</span>}
        </span>
      )}
    </div>
  );
}
