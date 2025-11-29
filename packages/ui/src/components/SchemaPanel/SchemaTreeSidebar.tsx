import { useMemo } from 'react';
import type { JSONSchema7 } from 'json-schema';
import { Filter } from 'lucide-react';
import { Toggle } from '../../components/ui/toggle';
import { SchemaTreeNode } from './SchemaTreeNode';
import { buildTreeFromSchema, filterPopulatedNodes } from './treeUtils';
import { useTreeStore } from '../../store/treeStore';

interface SchemaTreeSidebarProps {
  schema: JSONSchema7;
  value: Record<string, unknown>;
  onNavigate: (path: string, hasValue: boolean, isPlaceholder: boolean) => void;
}

export function SchemaTreeSidebar({ schema, value, onNavigate }: SchemaTreeSidebarProps) {
  const { showPopulatedOnly, setShowPopulatedOnly, setSelectedPath } = useTreeStore();

  // Build tree from schema
  const treeNodes = useMemo(() => {
    return buildTreeFromSchema(schema, value, schema);
  }, [schema, value]);

  // Filter to populated only if enabled
  const displayNodes = useMemo(() => {
    if (showPopulatedOnly) {
      return filterPopulatedNodes(treeNodes);
    }
    return treeNodes;
  }, [treeNodes, showPopulatedOnly]);

  const handleSelect = (path: string, hasValue: boolean, isPlaceholder: boolean) => {
    setSelectedPath(path);
    onNavigate(path, hasValue, isPlaceholder);
  };

  return (
    <div className="h-full flex flex-col bg-background">
      {/* Header */}
      <div className="flex items-center justify-between px-2 h-8 border-b border-border bg-muted/50 shrink-0">
        <span className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
          Structure
        </span>
        <Toggle
          size="sm"
          pressed={showPopulatedOnly}
          onPressedChange={setShowPopulatedOnly}
          title="Show populated fields only"
          className="h-6 w-6 p-0"
        >
          <Filter className="w-3 h-3" />
        </Toggle>
      </div>

      {/* Tree content */}
      <div className="flex-1 overflow-auto py-1">
        {displayNodes.length === 0 ? (
          <div className="px-3 py-4 text-xs text-muted-foreground text-center">
            {showPopulatedOnly
              ? 'No populated fields'
              : 'No properties in schema'}
          </div>
        ) : (
          displayNodes.map((node) => (
            <SchemaTreeNode
              key={node.path}
              node={node}
              depth={0}
              onSelect={handleSelect}
            />
          ))
        )}
      </div>
    </div>
  );
}
