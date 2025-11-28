import { X, Plus, ChevronDown, Settings } from 'lucide-react';
import { useEditorStore } from '../store/editorStore';
import type { SchemaPreset } from '@config-editor/core';

interface TabBarProps {
  schemas: SchemaPreset[];
  onNewTab: (schemaId: string) => void;
  onManageSchemas?: () => void;
  schemasViewActive?: boolean;
}

export function TabBar({
  schemas,
  onNewTab,
  onManageSchemas,
  schemasViewActive,
}: TabBarProps) {
  const { tabs, activeTabId, setActiveTab, closeTab } = useEditorStore();

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
      {/* New Tab Dropdown */}
      <div className="relative group">
        <button
          className="flex items-center gap-1 px-3 py-2 text-sm text-muted-foreground hover:bg-accent border-r border-border"
          title="New file"
        >
          <Plus className="w-4 h-4" />
          New
          <ChevronDown className="w-3 h-3" />
        </button>
        <div className="absolute left-0 top-full mt-0 bg-popover border border-border rounded-md shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50 min-w-[200px]">
          {schemas.map((schema) => (
            <button
              key={schema.id}
              onClick={() => onNewTab(schema.id)}
              className="block w-full text-left px-4 py-2 text-sm text-popover-foreground hover:bg-accent first:rounded-t-md last:rounded-b-md"
            >
              <div className="font-medium">{schema.name}</div>
              {schema.description && (
                <div className="text-xs text-muted-foreground mt-0.5">
                  {schema.description}
                </div>
              )}
            </button>
          ))}
          {schemas.length === 0 && (
            <div className="px-4 py-2 text-sm text-muted-foreground">
              No schemas registered
            </div>
          )}
          {onManageSchemas && (
            <>
              <div className="border-t border-border my-1" />
              <button
                onClick={onManageSchemas}
                className="flex items-center gap-2 w-full text-left px-4 py-2 text-sm text-muted-foreground hover:bg-accent last:rounded-b-md"
              >
                <Settings className="w-4 h-4" />
                Manage Schemas...
              </button>
            </>
          )}
        </div>
      </div>

      {/* Tab List */}
      <div className="flex-1 flex items-center overflow-x-auto">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-3 py-2 text-sm border-r border-border min-w-[120px] max-w-[200px] group ${
              tab.id === activeTabId && !schemasViewActive
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
        {schemasViewActive && (
          <button
            onClick={onManageSchemas}
            className="flex items-center gap-2 px-3 py-2 text-sm border-r border-border min-w-[120px] max-w-[200px] bg-background text-foreground border-b-2 border-b-primary"
          >
            <Settings className="w-4 h-4" />
            <span className="truncate flex-1 text-left">Schemas</span>
            <span
              onClick={(e) => {
                e.stopPropagation();
                onManageSchemas?.();
              }}
              className="p-0.5 rounded hover:bg-accent"
            >
              <X className="w-3 h-3" />
            </span>
          </button>
        )}
      </div>
    </div>
  );
}
