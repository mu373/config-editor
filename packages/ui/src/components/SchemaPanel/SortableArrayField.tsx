import { useCallback } from 'react';
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
  GripVertical,
  ChevronsUpDown,
} from 'lucide-react';
import type { JSONSchema7 } from 'json-schema';
import { resolveRef, getDefaultValue } from '@config-editor/core';
import { FormField, FieldDescription, ChildrenContainer, FieldLabel, ConfirmDeleteButton, type GlobalExpandLevel } from './FormField';
import { useTreeStore } from '../../store/treeStore';

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

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`flex items-start gap-2 group py-1 ${isDragging ? 'bg-muted rounded' : ''}`}
    >
      <button
        type="button"
        className="flex items-center justify-center w-6 h-7 text-muted-foreground/50 hover:text-muted-foreground cursor-grab active:cursor-grabbing flex-shrink-0"
        {...attributes}
        {...listeners}
      >
        <GripVertical className="w-4 h-4" />
      </button>
      <div className="flex-1 min-w-0">{children}</div>
      <ConfirmDeleteButton
        onDelete={onRemove}
        className="opacity-0 group-hover:opacity-100 transition-opacity"
      />
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
  /** Hide the header and render only the array content (for use inside DictionaryField) */
  hideHeader?: boolean;
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
  globalExpandLevel = null,
  hideHeader = false,
}: SortableArrayFieldProps) {
  const items = Array.isArray(value) ? value : [];

  // Use treeStore for ALL expansion state (centralized, path-based)
  const { isFormPathExpanded, toggleFormPath } = useTreeStore();

  const isExpanded = isFormPathExpanded(path, depth, globalExpandLevel);

  const setIsExpanded = () => {
    toggleFormPath(path);
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
    (itemPath: string, newValue: unknown) => {
      // Forward the change directly - DocumentModel handles the path
      onChange(itemPath, newValue);
    },
    [onChange]
  );

  const handleCollapseAll = useCallback(() => {
    // Collapse all array items by toggling their paths
    items.forEach((_, index) => {
      const itemPath = `${path}[${index}]`;
      if (isFormPathExpanded(itemPath, depth + 1, globalExpandLevel)) {
        toggleFormPath(itemPath);
      }
    });
  }, [items, path, depth, globalExpandLevel, isFormPathExpanded, toggleFormPath]);

  const handleExpandAll = useCallback(() => {
    // Expand all array items by toggling their paths
    items.forEach((_, index) => {
      const itemPath = `${path}[${index}]`;
      if (!isFormPathExpanded(itemPath, depth + 1, globalExpandLevel)) {
        toggleFormPath(itemPath);
      }
    });
  }, [items, path, depth, globalExpandLevel, isFormPathExpanded, toggleFormPath]);

  // When hideHeader is true, render just the array content without header
  // Used when embedded inside DictionaryField which already provides a header
  if (hideHeader) {
    return (
      <div>
        {items.length > 0 && itemsAreObjects && (
          <div className="flex items-center gap-2 mb-1">
            <button
              type="button"
              onClick={handleCollapseAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Collapse
            </button>
            <button
              type="button"
              onClick={handleExpandAll}
              className="text-xs text-muted-foreground hover:text-foreground"
            >
              Expand
            </button>
          </div>
        )}

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
                  name={`[${index}]`}
                  schema={resolvedItemSchema}
                  value={item}
                  path={`${path}[${index}]`}
                  onChange={handleItemChange}
                  depth={1}
                  rootSchema={rootSchema}
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
          className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 py-1"
        >
          <Plus className="w-3 h-3" />
          Add
        </button>
      </div>
    );
  }

  // At depth 0 (root level), children render at full width outside the header row
  // At deeper levels, children render inside the content area (indented)
  if (depth === 0) {
    return (
      <div data-field-path={path} className="py-2">
        {/* Header row: label with chevron | count and controls */}
        <div className="flex items-center gap-3 h-6">
          <div
            className="flex items-center gap-1 cursor-pointer"
            onClick={setIsExpanded}
          >
            <FieldLabel name={name} title={title} required={required} as="span" />
            {isExpanded ? (
              <ChevronDown className="w-3 h-3 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3 h-3 text-muted-foreground" />
            )}
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">({items.length} items)</span>
            {items.length > 0 && itemsAreObjects && (
              <>
                <span className="text-border">|</span>
                <button
                  type="button"
                  onClick={handleCollapseAll}
                  className="text-xs text-muted-foreground hover:text-foreground"
                >
                  Collapse
                </button>
                <button
                  type="button"
                  onClick={handleExpandAll}
                  className="text-xs text-muted-foreground hover:text-foreground"
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
                      name={`[${index}]`}
                      schema={resolvedItemSchema}
                      value={item}
                      path={`${path}[${index}]`}
                      onChange={handleItemChange}
                      depth={1}
                      rootSchema={rootSchema}
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
              className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 py-1"
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
    <div data-field-path={path} className="py-2">
      {/* Header row: label with chevron | count and controls */}
      <div className="flex items-center gap-3 h-6">
        <div
          className="flex items-center gap-1 cursor-pointer"
          onClick={setIsExpanded}
        >
          <FieldLabel name={name} title={title} required={required} as="span" />
          {isExpanded ? (
            <ChevronDown className="w-3 h-3 text-muted-foreground" />
          ) : (
            <ChevronRight className="w-3 h-3 text-muted-foreground" />
          )}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">({items.length} items)</span>
          {items.length > 0 && itemsAreObjects && (
            <>
              <span className="text-border">|</span>
              <button
                type="button"
                onClick={handleCollapseAll}
                className="text-xs text-muted-foreground hover:text-foreground"
              >
                Collapse
              </button>
              <button
                type="button"
                onClick={handleExpandAll}
                className="text-xs text-muted-foreground hover:text-foreground"
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
                    name={`[${index}]`}
                    schema={resolvedItemSchema}
                    value={item}
                    path={`${path}[${index}]`}
                    onChange={handleItemChange}
                    depth={0}
                    rootSchema={rootSchema}
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
            className="flex items-center gap-1 text-xs text-primary hover:text-primary/80 py-1"
          >
            <Plus className="w-3 h-3" />
            Add
          </button>
        </ChildrenContainer>
      )}
    </div>
  );
}
