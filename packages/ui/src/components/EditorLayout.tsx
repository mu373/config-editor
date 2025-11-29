import { useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Editor } from './Editor';
import { SchemaPanel } from './SchemaPanel';
import { SchemasTab } from './SchemasTab';
import { SettingsTab } from './SettingsTab';
import { ErrorBoundary } from './ErrorBoundary';
import { useEditorStore } from '../store/editorStore';
import { useSettingsStore } from '../store/settingsStore';
import type { JSONSchema7 } from 'json-schema';
import type { SchemaPreset } from '@config-editor/core';

interface EditorLayoutProps {
  schemas?: SchemaPreset[];
  onNewTab?: (schemaId: string) => void;
}

export function EditorLayout({ schemas, onNewTab }: EditorLayoutProps) {
  const { tabs, activeTabId, setContent, setSchema } = useEditorStore();
  const { activeView } = useSettingsStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleContentChange = useCallback(
    (newContent: string) => {
      setContent(newContent);
    },
    [setContent]
  );

  const handleSchemaChange = useCallback(
    (schemaId: string) => {
      // If no active tab or no schema currently set, create a new tab
      if (!activeTab || !activeTab.schemaId) {
        if (onNewTab) {
          onNewTab(schemaId);
        }
        return;
      }
      // Otherwise, update the current tab's schema
      const preset = schemas?.find((s) => s.id === schemaId);
      if (preset) {
        setSchema(preset.schema, preset.id);
      }
    },
    [schemas, setSchema, activeTab, onNewTab]
  );

  const schema = activeTab?.schema as JSONSchema7 | null;

  // Show SettingsTab when activeView is 'settings'
  if (activeView === 'settings') {
    return <SettingsTab />;
  }

  // Show SchemasTab when activeView is 'schemas'
  if (activeView === 'schemas') {
    return <SchemasTab />;
  }

  return (
    <ErrorBoundary>
      <div className="h-full">
        <PanelGroup direction="horizontal" autoSaveId="editor-layout">
          <Panel
            defaultSize={30}
            minSize={15}
            maxSize={70}
          >
            <SchemaPanel
              schema={schema}
              schemaId={activeTab?.schemaId}
              schemas={schemas}
              onSchemaChange={handleSchemaChange}
              content={activeTab?.content ?? ''}
              format={activeTab?.format ?? 'yaml'}
              onContentChange={handleContentChange}
            />
          </Panel>
          <PanelResizeHandle className="w-1 bg-border hover:bg-ring transition-colors cursor-col-resize" />
          <Panel defaultSize={70} minSize={30}>
            <Editor />
          </Panel>
        </PanelGroup>
      </div>
    </ErrorBoundary>
  );
}
