import { useState, useCallback } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Editor } from './Editor';
import { SchemaPanel } from './SchemaPanel';
import { SchemasTab } from './SchemasTab';
import { useEditorStore } from '../store/editorStore';
import { useSchemaStore } from '../store/schemaStore';
import type { JSONSchema7 } from 'json-schema';
import type { SchemaPreset } from '@config-editor/core';

interface EditorLayoutProps {
  schemas?: SchemaPreset[];
  onNewTab?: (schemaId: string) => void;
}

export function EditorLayout({ schemas, onNewTab }: EditorLayoutProps) {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const { tabs, activeTabId, setContent, setSchema } = useEditorStore();
  const { schemasView } = useSchemaStore();
  const activeTab = tabs.find((t) => t.id === activeTabId);

  const handleFieldClick = useCallback((path: string) => {
    // For now, just log the path
    console.log('Field clicked:', path);
  }, []);

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

  // Show SchemasTab when schemasView is 'edit'
  if (schemasView === 'edit') {
    return <SchemasTab />;
  }

  return (
    <div className="h-full">
      <PanelGroup direction="horizontal" autoSaveId="editor-layout">
        {!isPanelCollapsed && (
          <>
            <Panel
              defaultSize={30}
              minSize={20}
              maxSize={50}
              collapsible
              onCollapse={() => setIsPanelCollapsed(true)}
            >
              <SchemaPanel
                schema={schema}
                schemaId={activeTab?.schemaId}
                schemas={schemas}
                onSchemaChange={handleSchemaChange}
                isCollapsed={isPanelCollapsed}
                onToggleCollapse={() => setIsPanelCollapsed(!isPanelCollapsed)}
                onFieldClick={handleFieldClick}
                content={activeTab?.content ?? ''}
                format={activeTab?.format ?? 'yaml'}
                onContentChange={handleContentChange}
              />
            </Panel>
            <PanelResizeHandle className="w-1 bg-border hover:bg-ring transition-colors cursor-col-resize" />
          </>
        )}

        {isPanelCollapsed && (
          <div className="h-full flex flex-col border-r border-border bg-background w-10 flex-shrink-0">
            <SchemaPanel
              schema={schema}
              schemaId={activeTab?.schemaId}
              schemas={schemas}
              onSchemaChange={handleSchemaChange}
              isCollapsed={true}
              onToggleCollapse={() => setIsPanelCollapsed(false)}
              content={activeTab?.content ?? ''}
              format={activeTab?.format ?? 'yaml'}
              onContentChange={handleContentChange}
            />
          </div>
        )}

        <Panel defaultSize={isPanelCollapsed ? 100 : 70} minSize={50}>
          <Editor />
        </Panel>
      </PanelGroup>
    </div>
  );
}
