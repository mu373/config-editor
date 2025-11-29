import { useCallback, useMemo } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Editor } from './Editor';
import { SchemaPanel } from './SchemaPanel';
import { SchemasTab } from './SchemasTab';
import { SettingsTab } from './SettingsTab';
import { ErrorBoundary } from './ErrorBoundary';
import { useEditorStore } from '../store/editorStore';
import { useSettingsStore } from '../store/settingsStore';
import { DocumentModel, type SchemaPreset } from '@config-editor/core';

interface EditorLayoutProps {
  schemas?: SchemaPreset[];
  onNewTab?: (schemaId: string) => void;
}

export function EditorLayout({ schemas, onNewTab }: EditorLayoutProps) {
  const { tabs, activeTabId, setSchema } = useEditorStore();
  const { activeView } = useSettingsStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  // Create DocumentModel for the active tab (shared by Editor and SchemaPanel)
  const documentModel = useMemo(() => {
    if (!activeTab) return null;

    return DocumentModel.deserialize(
      activeTab.content,
      activeTab.format,
      activeTab.schema ?? {}
    );
  }, [activeTabId]); // Recreate when tab changes

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
              document={documentModel}
              schemaId={activeTab?.schemaId}
              schemas={schemas}
              onSchemaChange={handleSchemaChange}
            />
          </Panel>
          <PanelResizeHandle className="w-1 bg-border hover:bg-ring transition-colors cursor-col-resize" />
          <Panel defaultSize={70} minSize={30}>
            <Editor documentModel={documentModel} />
          </Panel>
        </PanelGroup>
      </div>
    </ErrorBoundary>
  );
}
