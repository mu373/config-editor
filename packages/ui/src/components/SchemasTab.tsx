import { useState, useCallback, useRef } from 'react';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { X, Plus, FileJson, Pencil, GripVertical } from 'lucide-react';
import { useSchemaStore } from '../store/schemaStore';
import MonacoEditor from '@monaco-editor/react';

function generateSchemaId(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function SchemasTab() {
  const {
    schemas,
    selectedSchemaId,
    setSelectedSchemaId,
    addSchema,
    updateSchema,
    removeSchema,
    reorderSchema,
  } = useSchemaStore();

  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draggedIndex, setDraggedIndex] = useState<number | null>(null);
  const [dragOverIndex, setDragOverIndex] = useState<number | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const selectedSchema = schemas.find((s) => s.id === selectedSchemaId);

  const handleAdd = useCallback(async () => {
    const value = inputValue.trim();
    if (!value) return;

    setError(null);
    setIsLoading(true);

    try {
      // Check if it's a URL
      if (value.startsWith('http://') || value.startsWith('https://')) {
        const response = await fetch(value);
        if (!response.ok) {
          throw new Error(`Failed to fetch: ${response.status}`);
        }
        const schema = await response.json();
        const name = schema.title || 'Imported Schema';
        const id = generateSchemaId(name) + '-' + Date.now();

        addSchema({
          id,
          name,
          description: schema.description,
          schema,
        });
        setSelectedSchemaId(id);
      } else {
        // Try to parse as JSON
        const schema = JSON.parse(value);
        const name = schema.title || 'Pasted Schema';
        const id = generateSchemaId(name) + '-' + Date.now();

        addSchema({
          id,
          name,
          description: schema.description,
          schema,
        });
        setSelectedSchemaId(id);
      }

      setInputValue('');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to add schema');
    } finally {
      setIsLoading(false);
    }
  }, [inputValue, addSchema, setSelectedSchemaId]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        handleAdd();
      }
    },
    [handleAdd]
  );

  const handleSchemaEdit = useCallback(
    (value: string | undefined) => {
      if (!selectedSchemaId || value === undefined) return;

      try {
        const schema = JSON.parse(value);
        updateSchema(selectedSchemaId, {
          schema,
          name: schema.title || selectedSchema?.name,
          description: schema.description,
        });
        setError(null);
      } catch {
        // Invalid JSON - don't update, but also don't show error while typing
      }
    },
    [selectedSchemaId, selectedSchema, updateSchema]
  );

  const handleRemove = useCallback(
    (id: string, e: React.MouseEvent) => {
      e.stopPropagation();
      if (
        window.confirm(
          'Are you sure you want to remove this schema? This cannot be undone.'
        )
      ) {
        removeSchema(id);
      }
    },
    [removeSchema]
  );

  const handleDragStart = useCallback(
    (e: React.DragEvent, index: number) => {
      setDraggedIndex(index);
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', String(index));
    },
    []
  );

  const handleDragOver = useCallback(
    (e: React.DragEvent, index: number) => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverIndex(index);
    },
    []
  );

  const handleDragLeave = useCallback(() => {
    setDragOverIndex(null);
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent, toIndex: number) => {
      e.preventDefault();
      if (draggedIndex !== null && draggedIndex !== toIndex) {
        reorderSchema(draggedIndex, toIndex);
      }
      setDraggedIndex(null);
      setDragOverIndex(null);
    },
    [draggedIndex, reorderSchema]
  );

  const handleDragEnd = useCallback(() => {
    setDraggedIndex(null);
    setDragOverIndex(null);
  }, []);

  return (
    <div className="h-full w-full bg-white flex">
      <PanelGroup direction="horizontal" autoSaveId="schemas-layout" className="h-full flex-1">
        {/* Left Panel - Schema List */}
        <Panel defaultSize={30} minSize={20} maxSize={50}>
          <div className="h-full flex flex-col border-r bg-gray-50">
            {/* Add Schema Input */}
            <div className="p-4 border-b bg-white">
              <div className="text-sm font-medium text-gray-700 mb-2">
                Add Schema
              </div>
              <div className="flex gap-2">
                <input
                  ref={inputRef}
                  type="text"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="URL or paste JSON..."
                  className="flex-1 px-3 py-2 text-sm border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  disabled={isLoading}
                />
                <button
                  onClick={handleAdd}
                  disabled={isLoading || !inputValue.trim()}
                  className="px-3 py-2 text-sm font-medium text-white bg-blue-500 rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-1"
                >
                  <Plus className="w-4 h-4" />
                  Add
                </button>
              </div>
              {error && (
                <div className="mt-2 text-xs text-red-600">{error}</div>
              )}
            </div>

            {/* Schema List */}
            <div className="flex-1 overflow-auto">
              <div className="p-4">
                <div className="text-sm font-medium text-gray-700 mb-2">
                  Saved Schemas
                </div>
                {schemas.length === 0 ? (
                  <div className="text-sm text-gray-400 py-4 text-center">
                    No schemas yet. Add one above.
                  </div>
                ) : (
                  <div className="space-y-0.5">
                    {schemas.map((schema, index) => (
                      <div
                        key={schema.id}
                        draggable
                        onDragStart={(e) => handleDragStart(e, index)}
                        onDragOver={(e) => handleDragOver(e, index)}
                        onDragLeave={handleDragLeave}
                        onDrop={(e) => handleDrop(e, index)}
                        onDragEnd={handleDragEnd}
                        onClick={() => setSelectedSchemaId(schema.id)}
                        className={`w-full flex items-center gap-1 px-1 py-1 text-sm group cursor-pointer select-none ${
                          schema.id === selectedSchemaId
                            ? 'bg-gray-200 text-gray-900'
                            : 'text-gray-600 hover:bg-gray-100'
                        } ${draggedIndex === index ? 'opacity-50' : ''} ${
                          dragOverIndex === index && draggedIndex !== index
                            ? 'border-t-2 border-blue-500'
                            : ''
                        }`}
                      >
                        <span className="cursor-grab active:cursor-grabbing p-0.5 opacity-0 group-hover:opacity-50 hover:!opacity-100">
                          <GripVertical className="w-3 h-3" />
                        </span>
                        <FileJson className="w-4 h-4 flex-shrink-0 text-gray-400" />
                        <span className="flex-1 text-left truncate">
                          {schema.name}
                        </span>
                        <span
                          onClick={(e) => handleRemove(schema.id, e)}
                          className="p-0.5 rounded hover:bg-gray-300 opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="w-3 h-3" />
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </Panel>

        <PanelResizeHandle className="w-1 bg-gray-200 hover:bg-blue-400 transition-colors cursor-col-resize" />

        {/* Right Panel - Schema Editor */}
        <Panel defaultSize={70} minSize={50}>
          <div className="h-full flex flex-col">
            {selectedSchema ? (
              <>
                <div className="px-4 py-3 border-b bg-gray-50">
                  <div className="flex items-center gap-0.5 max-w-md">
                    <input
                      type="text"
                      value={selectedSchema.name}
                      onChange={(e) =>
                        updateSchema(selectedSchema.id, { name: e.target.value })
                      }
                      className="text-sm font-medium text-gray-900 bg-transparent border-none outline-none min-w-0 rounded focus:bg-gray-200 transition-colors"
                      placeholder="Schema name"
                      size={selectedSchema.name.length || 12}
                    />
                    <Pencil className="w-2.5 h-2.5 text-gray-400 flex-shrink-0" />
                  </div>
                  <div className="max-w-md -mt-1">
                    <input
                      type="text"
                      value={selectedSchema.description || ''}
                      onChange={(e) =>
                        updateSchema(selectedSchema.id, {
                          description: e.target.value || undefined,
                        })
                      }
                      className="text-xs text-gray-500 bg-transparent border-none outline-none min-w-0 rounded focus:bg-gray-200 transition-colors"
                      placeholder="Description (optional)"
                      size={(selectedSchema.description || '').length || 20}
                    />
                  </div>
                </div>
                <div className="flex-1 min-h-0">
                  <MonacoEditor
                    language="json"
                    value={JSON.stringify(selectedSchema.schema, null, 2)}
                    onChange={handleSchemaEdit}
                    options={{
                      minimap: { enabled: false },
                      fontSize: 13,
                      lineNumbers: 'on',
                      scrollBeyondLastLine: false,
                      wordWrap: 'on',
                      automaticLayout: true,
                      tabSize: 2,
                    }}
                  />
                </div>
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center text-gray-400">
                Select a schema to view and edit
              </div>
            )}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}
