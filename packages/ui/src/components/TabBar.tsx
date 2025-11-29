import { X, Menu, Settings, Download, FilePlus, FolderOpen, Cog } from 'lucide-react';
import { useEditorStore, type Tab, SCHEMAS_TAB_ID, SETTINGS_TAB_ID } from '../store/editorStore';
import { useSettingsStore, type ActiveView } from '../store/settingsStore';
import { useEffect } from 'react';
import { detectFormat, type JSONSchema, type SchemaPreset } from '@config-editor/core';
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
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

interface SortableTabProps {
  id: string;
  isActive: boolean;
  onSelect: () => void;
  onClose: (e: React.MouseEvent) => void;
  icon?: React.ReactNode;
  label: string;
  isDirty?: boolean;
}

function SortableTab({ id, isActive, onSelect, onClose, icon, label, isDirty }: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 50 : undefined,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <button
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={`flex items-center gap-2 px-3 py-2 text-sm border-r border-border min-w-[120px] max-w-[200px] group cursor-grab active:cursor-grabbing ${
        isActive
          ? 'bg-background text-foreground border-b-2 border-b-primary'
          : 'text-muted-foreground hover:bg-accent'
      } ${isDragging ? 'bg-muted' : ''}`}
      {...attributes}
      {...listeners}
    >
      {icon}
      <span className="truncate flex-1 text-left">{label}</span>
      {isDirty && (
        <span className="w-2 h-2 rounded-full bg-orange-400 flex-shrink-0" />
      )}
      <span
        onClick={onClose}
        className="p-0.5 rounded hover:bg-accent opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0"
      >
        <X className="w-3 h-3" />
      </span>
    </button>
  );
}

interface SampleFile {
  id: string;
  name: string;
  schemaId: string;
  content: string;
  format: 'yaml' | 'json';
}

interface TabBarProps {
  schemas: SchemaPreset[];
  samples: SampleFile[];
  onNewTab: (schemaId: string) => void;
  onOpenSample: (sample: SampleFile) => void;
  defaultSchema?: JSONSchema | null;
  defaultSchemaId?: string | null;
}

export function TabBar({
  schemas,
  samples,
  onNewTab,
  onOpenSample,
  defaultSchema,
  defaultSchemaId,
}: TabBarProps) {
  const { tabs, activeTabId, setActiveTab, closeTab, addTab, reorderTabs, tabOrder, addToTabOrder, removeFromTabOrder } = useEditorStore();
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

  // Add/remove special tabs from tabOrder when they open/close
  useEffect(() => {
    if (schemasTabOpen) {
      addToTabOrder(SCHEMAS_TAB_ID);
    } else {
      removeFromTabOrder(SCHEMAS_TAB_ID);
    }
  }, [schemasTabOpen, addToTabOrder, removeFromTabOrder]);

  useEffect(() => {
    if (settingsTabOpen) {
      addToTabOrder(SETTINGS_TAB_ID);
    } else {
      removeFromTabOrder(SETTINGS_TAB_ID);
    }
  }, [settingsTabOpen, addToTabOrder, removeFromTabOrder]);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Build the ordered list of all visible tabs
  const tabsById = new Map(tabs.map((tab) => [tab.id, tab]));
  const orderedTabIds = tabOrder.filter((id) => {
    if (id === SCHEMAS_TAB_ID) return schemasTabOpen;
    if (id === SETTINGS_TAB_ID) return settingsTabOpen;
    return tabsById.has(id);
  });

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      reorderTabs(active.id as string, over.id as string);
    }
  };

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
                {samples.length > 0 && (
                  <>
                    <MenubarSeparator />
                    <MenubarSub>
                      <MenubarSubTrigger>Samples</MenubarSubTrigger>
                      <MenubarSubContent>
                        {samples.map((sample) => (
                          <MenubarItem key={sample.id} onClick={() => onOpenSample(sample)}>
                            {sample.name}
                          </MenubarItem>
                        ))}
                      </MenubarSubContent>
                    </MenubarSub>
                  </>
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
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext items={orderedTabIds} strategy={horizontalListSortingStrategy}>
            {orderedTabIds.map((tabId) => {
              // Schemas Tab
              if (tabId === SCHEMAS_TAB_ID) {
                return (
                  <SortableTab
                    key={SCHEMAS_TAB_ID}
                    id={SCHEMAS_TAB_ID}
                    isActive={activeView === 'schemas'}
                    onSelect={() => setActiveView('schemas')}
                    onClose={(e) => {
                      e.stopPropagation();
                      closeSchemasTab();
                    }}
                    icon={<Settings className="w-4 h-4" />}
                    label="Schemas"
                  />
                );
              }

              // Settings Tab
              if (tabId === SETTINGS_TAB_ID) {
                return (
                  <SortableTab
                    key={SETTINGS_TAB_ID}
                    id={SETTINGS_TAB_ID}
                    isActive={activeView === 'settings'}
                    onSelect={() => setActiveView('settings')}
                    onClose={(e) => {
                      e.stopPropagation();
                      closeSettingsTab();
                    }}
                    icon={<Cog className="w-4 h-4" />}
                    label="Settings"
                  />
                );
              }

              // Editor Tab
              const tab = tabsById.get(tabId);
              if (!tab) return null;

              return (
                <SortableTab
                  key={tab.id}
                  id={tab.id}
                  isActive={tab.id === activeTabId && activeView === 'editor'}
                  onSelect={() => {
                    setActiveTab(tab.id);
                    setActiveView('editor');
                  }}
                  onClose={(e) => handleCloseTab(e, tab.id, tab.isDirty)}
                  label={tab.fileName!}
                  isDirty={tab.isDirty}
                />
              );
            })}
          </SortableContext>
        </DndContext>
      </div>
    </div>
  );
}
