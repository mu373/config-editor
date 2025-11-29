import { X, Menu, Settings, Download, FilePlus, FolderOpen, Cog } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import { useSettingsStore, type ActiveView } from '../store/settingsStore';
import { detectFormat, type JSONSchema, type SchemaPreset } from '@config-editor/core';
import {
  Menubar,
  MenubarContent,
  MenubarItem,
  MenubarMenu,
  MenubarSeparator,
  MenubarSub,
  MenubarSubContent,
  MenubarSubTrigger,
  MenubarTrigger,
} from './ui/menubar';

interface TabBarProps {
  schemas: SchemaPreset[];
  onNewTab: (schemaId: string) => void;
  defaultSchema?: JSONSchema | null;
  defaultSchemaId?: string | null;
}

export function TabBar({
  schemas,
  onNewTab,
  defaultSchema,
  defaultSchemaId,
}: TabBarProps) {
  const { tabs, activeTabId, setActiveTab, closeTab, addTab } = useEditorStore();
  const {
    activeView,
    setActiveView,
    schemasTabOpen,
    settingsTabOpen,
    openSchemasTab,
    closeSchemasTab,
    openSettingsTab,
    closeSettingsTab,
  } = useSettingsStore();

  const handleOpenFile = () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.yaml,.yml,.json';
    input.onchange = async (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const text = await file.text();
      const detected = detectFormat(text);

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
    const activeTab = tabs.find((t) => t.id === activeTabId);
    if (!activeTab) return;

    const extension = activeTab.format === 'json' ? '.json' : '.yaml';
    const fileName = activeTab.fileName || `untitled${extension}`;
    const mimeType = activeTab.format === 'json' ? 'application/json' : 'text/yaml';

    const blob = new Blob([activeTab.content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleCloseTab = (
    e: React.MouseEvent,
    tabId: string,
    isDirty: boolean
  ) => {
    e.stopPropagation();
    if (isDirty) {
      const confirmed = window.confirm(
        'You have unsaved changes. Close anyway?'
      );
      if (!confirmed) return;
    }
    closeTab(tabId);
  };

  return (
    <div className="flex items-center border-b border-border bg-muted min-h-[40px]">
      {/* Hamburger Menu */}
      <Menubar className="border-0 rounded-none bg-transparent shadow-none h-auto p-0">
        <MenubarMenu>
          <MenubarTrigger className="px-3 py-2 rounded-none border-r border-border data-[state=open]:bg-accent">
            <Menu className="size-4" />
          </MenubarTrigger>
          <MenubarContent align="start" sideOffset={8} alignOffset={8}>
            <MenubarSub>
              <MenubarSubTrigger>
                <FilePlus className="size-4" />
                New File with Schema
              </MenubarSubTrigger>
              <MenubarSubContent>
                {schemas.map((schema) => (
                  <MenubarItem key={schema.id} onClick={() => onNewTab(schema.id)}>
                    {schema.name}
                  </MenubarItem>
                ))}
                {schemas.length === 0 && (
                  <MenubarItem disabled>No schemas registered</MenubarItem>
                )}
              </MenubarSubContent>
            </MenubarSub>
            <MenubarItem onClick={handleOpenFile}>
              <FolderOpen className="size-4" />
              Open File...
            </MenubarItem>
            <MenubarItem onClick={handleDownload} disabled={!activeTabId}>
              <Download className="size-4" />
              Download
            </MenubarItem>
            <MenubarSeparator />
            <MenubarItem onClick={openSchemasTab}>
              <Settings className="size-4" />
              Manage Schemas...
            </MenubarItem>
            <MenubarItem onClick={openSettingsTab}>
              <Cog className="size-4" />
              Settings...
            </MenubarItem>
          </MenubarContent>
        </MenubarMenu>
      </Menubar>

      {/* Tab List */}
      <div className="flex-1 flex items-center overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setActiveView('editor');
            }}
            className={`flex items-center gap-2 px-3 py-2 text-sm border-r border-border min-w-[120px] max-w-[200px] group ${
              tab.id === activeTabId && activeView === 'editor'
                ? 'bg-background text-foreground border-b-2 border-b-primary'
                : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <span className="truncate flex-1 text-left">
              {tab.fileName || 'Untitled'}
            </span>
            {tab.isDirty && (
              <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
            )}
            <span
              onClick={(e) => handleCloseTab(e, tab.id, tab.isDirty)}
              className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </span>
          </button>
        ))}

        {/* Schemas Tab */}
        {schemasTabOpen && (
          <button
            onClick={() => setActiveView('schemas')}
            className={`flex items-center gap-2 px-3 py-2 text-sm border-r border-border min-w-[120px] max-w-[200px] group ${
              activeView === 'schemas'
                ? 'bg-background text-foreground border-b-2 border-b-primary'
                : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <Settings className="w-4 h-4" />
            <span className="truncate flex-1 text-left">Schemas</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                closeSchemasTab();
              }}
              className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </span>
          </button>
        )}

        {/* Settings Tab */}
        {settingsTabOpen && (
          <button
            onClick={() => setActiveView('settings')}
            className={`flex items-center gap-2 px-3 py-2 text-sm border-r border-border min-w-[120px] max-w-[200px] group ${
              activeView === 'settings'
                ? 'bg-background text-foreground border-b-2 border-b-primary'
                : 'text-muted-foreground hover:bg-accent'
            }`}
          >
            <Cog className="w-4 h-4" />
            <span className="truncate flex-1 text-left">Settings</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                closeSettingsTab();
              }}
              className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
            >
              <X className="w-3 h-3" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
