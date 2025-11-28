import { useState, useCallback, useEffect } from 'react';
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
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import {
  ChevronDown,
  ChevronRight,
  Plus,
  Trash2,
  GripVertical,
  ChevronsUpDown,
} from 'lucide-react';
import type { JSONSchema7 } from 'json-schema';
import { FormField, FieldDescription, ChildrenContainer, type GlobalExpandLevel } from './FormField';

interface SortableItemProps {
  id: string;
  index: number;
  summary?: string | null;
  children: React.ReactNode;
  onRemove: () => void;
}

// Extract summary value from an item based on x-summary-field schema extension
function getSummaryValue(
  item: unknown,
  itemSchema: JSONSchema7,
  rootSchema?: JSONSchema7
): string | null {
  if (!item || typeof item !== 'object') return null;

  const obj = item as Record<string, unknown>;

  // Check for x-summary-field (single field)
  const summaryField = (itemSchema as Record<string, unknown>)['x-summary-field'] as string | undefined;
  if (summaryField && obj[summaryField] !== undefined && obj[summaryField] !== null) {
    return String(obj[summaryField]);
  }

  // Check for x-summary-fields (multiple fields) with optional x-summary-format
  const summaryFields = (itemSchema as Record<string, unknown>)['x-summary-fields'] as string[] | undefined;
  if (summaryFields && summaryFields.length > 0) {
    const format = (itemSchema as Record<string, unknown>)['x-summary-format'] as string | undefined;
    if (format) {
      // Replace {fieldName} placeholders with values
      let result = format;
      for (const field of summaryFields) {
        const value = obj[field] !== undefined && obj[field] !== null ? String(obj[field]) : '';
        result = result.replace(new RegExp(`\\{${field}\\}`, 'g'), value);
      }
      return result;
    } else {
      // Just join the values
      const values = summaryFields
        .map(f => obj[f])
        .filter(v => v !== undefined && v !== null)
        .map(String);
      return values.length > 0 ? values.join(' | ') : null;
    }
  }

  return null;
}

function SortableItem({ id, index, summary, children, onRemove }: SortableItemProps) {
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

  // Display index with optional summary preview
  const label = summary ? `${index}: ${summary}` : `${index}`;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 mb-2 group ${isDragging ? 'bg-gray-50 rounded' : ''}`}
    >
      <div className="flex items-center justify-center h-6 w-6">
        <button
          type="button"
          className="text-gray-300 hover:text-gray-500 cursor-grab active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="w-4 h-4" />
        </button>
      </div>
      <div className="flex-1">{children}</div>
      <div className="flex items-center justify-center h-6 w-6">
        <button
          type="button"
          onClick={onRemove}
          className="text-gray-400 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

interface SortableArrayFieldProps {
  name: string;
  schema: JSONSchema7;
  value: unknown[];
  path: string;
  required?: boolean;
  onChange: (path: string, value: unknown) => void;
  depth?: number;
  rootSchema?: JSONSchema7;
  /** Global expand level - used as initial default only */
  globalExpandLevel?: GlobalExpandLevel;
}

function resolveRef(schema: JSONSchema7, rootSchema: JSONSchema7): JSONSchema7 {
  if (!schema.$ref) return schema;

  const refPath = schema.$ref.replace('#/', '').split('/');
  let resolved: Record<string, unknown> = rootSchema as Record<string, unknown>;

  for (const part of refPath) {
    resolved = resolved[part] as Record<string, unknown>;
    if (!resolved) return schema;
  }

  return resolved as JSONSchema7;
}

function getDefaultValue(schema: JSONSchema7): unknown {
  if (schema.default !== undefined) return schema.default;
  if (schema.type === 'string') return '';
  if (schema.type === 'number' || schema.type === 'integer') return 0;
  if (schema.type === 'boolean') return false;
  if (schema.type === 'array') return [];
  if (schema.type === 'object') return {};
  return null;
}

export function SortableArrayField({
  name,
  schema,
  value,
  path,
  required = false,
  onChange,
  depth = 0,
  rootSchema,
  globalExpandLevel,
}: SortableArrayFieldProps) {
  const items = value ?? [];

  // Track if user has manually toggled this field
  const [hasBeenManuallyToggled, setHasBeenManuallyToggled] = useState(false);
  const [isExpandedLocal, setIsExpandedLocal] = useState(() => depth < 2);
  const [expandedItems, setExpandedItems] = useState<Set<number>>(new Set());
  // Track which array items have been manually toggled (by index)
  const [manuallyToggledItems, setManuallyToggledItems] = useState<Set<number>>(new Set());

  // Calculate whether this field should be expanded based on globalExpandLevel
  const shouldExpandByLevel = (level: GlobalExpandLevel) => {
    if (level === 'all') return true;
    if (level !== null && level !== undefined) {
      return depth < level;
    }
    return null; // null means no opinion from global level
  };

  // When globalExpandLevel changes, update expansion state
  // but only if user hasn't manually toggled this field
  useEffect(() => {
    if (hasBeenManuallyToggled) return;

    const shouldExpand = shouldExpandByLevel(globalExpandLevel);
    if (shouldExpand !== null) {
      setIsExpandedLocal(shouldExpand);
    }
  }, [globalExpandLevel, hasBeenManuallyToggled, depth]);

  // When globalExpandLevel changes, update array item expansion states
  // but only for items that haven't been manually toggled
  useEffect(() => {
    if (globalExpandLevel === null) return;

    // For array items, their depth is depth + 1 (since array itself is at depth)
    const itemDepth = depth + 1;
    const shouldItemsExpand = globalExpandLevel === 'all' || itemDepth < globalExpandLevel;

    setExpandedItems(prev => {
      const next = new Set(prev);
      items.forEach((_, index) => {
        // Only update items that haven't been manually toggled
        if (!manuallyToggledItems.has(index)) {
          if (shouldItemsExpand) {
            next.add(index);
          } else {
            next.delete(index);
          }
        }
      });
      return next;
    });
  }, [globalExpandLevel, items.length, depth, manuallyToggledItems]);

  const isExpanded = isExpandedLocal;

  const setIsExpanded = (expanded: boolean) => {
    setHasBeenManuallyToggled(true);
    setIsExpandedLocal(expanded);
  };
  const itemSchema = schema.items as JSONSchema7;
  const resolvedItemSchema = rootSchema
    ? resolveRef(itemSchema, rootSchema)
    : itemSchema;

  // Is item schema an object? (for collapse/expand all)
  const itemsAreObjects =
    resolvedItemSchema.type === 'object' || resolvedItemSchema.properties;

  const title = schema.title || name;
  const description = schema.description;

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Generate stable IDs for each item
  const itemIds = items.map((_, index) => `item-${index}`);

  const handleDragEnd = useCallback(
    (event: DragEndEvent) => {
      const { active, over } = event;

      if (over && active.id !== over.id) {
        const oldIndex = itemIds.indexOf(active.id as string);
        const newIndex = itemIds.indexOf(over.id as string);
        const newItems = arrayMove([...items], oldIndex, newIndex);
        onChange(path, newItems);
      }
    },
    [items, itemIds, onChange, path]
  );

  const handleAddItem = useCallback(() => {
    const newItem = getDefaultValue(resolvedItemSchema);
    onChange(path, [...items, newItem]);
  }, [items, onChange, path, resolvedItemSchema]);

  const handleRemoveItem = useCallback(
    (index: number) => {
      const newItems = items.filter((_, i) => i !== index);
      onChange(path, newItems);
    },
    [items, onChange, path]
  );

  const handleItemChange = useCallback(
    (index: number, newValue: unknown) => {
      const newItems = [...items];
      newItems[index] = newValue;
      onChange(path, newItems);
    },
    [items, onChange, path]
  );

  const handleCollapseAll = useCallback(() => {
    setExpandedItems(new Set());
  }, []);

  const handleExpandAll = useCallback(() => {
    setExpandedItems(new Set(items.map((_, i) => i)));
  }, [items]);

  // At depth 0 (root level), children render at full width outside the header row
  // At deeper levels, children render inside the content area (indented)
  if (depth === 0) {
    return (
      <div className="mb-2">
        {/* Header row: label with chevron | count and controls */}
        <div className="flex items-center gap-3 h-6">
          <div
            className="flex items-center gap-1 cursor-pointer"
            onClick={() => setIsExpanded(!isExpanded)}
          >
            <span className="text-sm font-medium text-gray-700">
              {title}
              {required && <span className="text-red-500 ml-0.5">*</span>}
            </span>
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-gray-400" />
            ) : (
              <ChevronRight className="w-3 h-3 text-gray-400" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400">({items.length} items)</span>
            {items.length > 0 && itemsAreObjects && (
              <>
                <span className="text-gray-300">|</span>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Collapse
                </button>
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="text-xs text-gray-500 hover:text-gray-700"
                >
                  Expand
                </button>
              </>
            )}
          </div>
        </div>
        {description && (
          <FieldDescription>{description}</FieldDescription>
        )}

        {/* Children render at full width outside the header row */}
        {isExpanded && (
          <ChildrenContainer>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={itemIds}
                strategy={verticalListSortingStrategy}
              >
                {items.map((item, index) => (
                  <SortableItem
                    key={itemIds[index]}
                    id={itemIds[index]}
                    index={index}
                    summary={getSummaryValue(item, resolvedItemSchema, rootSchema)}
                    onRemove={() => handleRemoveItem(index)}
                  >
                    <FormField
                      name={`${index}`}
                      schema={resolvedItemSchema}
                      value={item}
                      path={`${path}[${index}]`}
                      onChange={(_, newValue) => handleItemChange(index, newValue)}
                      depth={1}
                      rootSchema={rootSchema}
                      isExpandedControlled={itemsAreObjects ? expandedItems.has(index) : undefined}
                      onExpandedChange={itemsAreObjects ? (expanded) => {
                        // Mark this item as manually toggled
                        setManuallyToggledItems(prev => new Set(prev).add(index));
                        setExpandedItems(prev => {
                          const next = new Set(prev);
                          if (expanded) {
                            next.add(index);
                          } else {
                            next.delete(index);
                          }
                          return next;
                        });
                      } : undefined}
                      summaryLabel={getSummaryValue(item, resolvedItemSchema, rootSchema)}
                      globalExpandLevel={globalExpandLevel}
                                          />
                  </SortableItem>
                ))}
              </SortableContext>
            </DndContext>

            <button
              type="button"
              onClick={handleAddItem}
              className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 py-1"
            >
              <Plus className="w-3 h-3" />
              Add
            </button>
          </ChildrenContainer>
        )}
      </div>
    );
  }

  // Deeper levels: children inside content area (indented)
  return (
    <div className="mb-2">
      {/* Header row: label with chevron | count and controls */}
      <div className="flex items-center gap-3 h-6">
        <div
          className="flex items-center gap-1 cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <span className="text-sm font-medium text-gray-700">
            {title}
            {required && <span className="text-red-500 ml-0.5">*</span>}
          </span>
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-gray-400" />
          ) : (
            <ChevronRight className="w-3 h-3 text-gray-400" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400">({items.length} items)</span>
          {items.length > 0 && itemsAreObjects && (
            <>
              <span className="text-gray-300">|</span>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Collapse
              </button>
              <button
                type="button"
                onClick={handleExpandAll}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Expand
              </button>
            </>
          )}
        </div>
      </div>
      {description && (
        <FieldDescription>{description}</FieldDescription>
      )}

      {isExpanded && (
        <ChildrenContainer>
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext
              items={itemIds}
              strategy={verticalListSortingStrategy}
            >
              {items.map((item, index) => (
                <SortableItem
                  key={itemIds[index]}
                  id={itemIds[index]}
                  index={index}
                  summary={getSummaryValue(item, resolvedItemSchema, rootSchema)}
                  onRemove={() => handleRemoveItem(index)}
                >
                  <FormField
                    name={`${index}`}
                    schema={resolvedItemSchema}
                    value={item}
                    path={`${path}[${index}]`}
                    onChange={(_, newValue) => handleItemChange(index, newValue)}
                    depth={0}
                    rootSchema={rootSchema}
                    isExpandedControlled={itemsAreObjects ? expandedItems.has(index) : undefined}
                    onExpandedChange={itemsAreObjects ? (expanded) => {
                      // Mark this item as manually toggled
                      setManuallyToggledItems(prev => new Set(prev).add(index));
                      setExpandedItems(prev => {
                        const next = new Set(prev);
                        if (expanded) {
                          next.add(index);
                        } else {
                          next.delete(index);
                        }
                        return next;
                      });
                    } : undefined}
                    summaryLabel={getSummaryValue(item, resolvedItemSchema, rootSchema)}
                    globalExpandLevel={globalExpandLevel}
                  />
                </SortableItem>
              ))}
            </SortableContext>
          </DndContext>

          <button
            type="button"
            onClick={handleAddItem}
            className="flex items-center gap-1 text-xs text-blue-600 hover:text-blue-700 py-1"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </ChildrenContainer>
      )}
    </div>
  );
}
