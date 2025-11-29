import { memo } from 'react';
import {
  ChevronRight,
  ChevronDown,
  Folder,
  List,
  Braces,
  Files,
  // Primitive type icons
  Type,
  Hash,
  ToggleLeft,
  Calendar,
  Link,
  Mail,
  Clock,
  ListFilter,
  FileText,
} from 'lucide-react';
import { cn } from '../../lib/utils';
import type { TreeNode } from './treeUtils';
import { useTreeStore } from '../../store/treeStore';

interface SchemaTreeNodeProps {
  node: TreeNode;
  depth: number;
  onSelect: (path: string, hasValue: boolean, isPlaceholder: boolean) => void;
}

const typeIcons: Record<TreeNode['type'], React.ComponentType<{ className?: string }>> = {
  object: Folder,
  array: List,
  dictionary: Braces,
  primitive: FileText,
  variant: Files,
};

/**
 * Get a more specific icon for primitive types based on schemaType and format
 */
function getPrimitiveIcon(node: TreeNode): React.ComponentType<{ className?: string }> {
  // Enum takes precedence - shows a dropdown/select
  if (node.hasEnum) {
    return ListFilter;
  }

  // Check format first for more specific icons
  if (node.format) {
    switch (node.format) {
      case 'date':
      case 'date-time':
        return Calendar;
      case 'time':
        return Clock;
      case 'uri':
      case 'uri-reference':
      case 'uri-template':
        return Link;
      case 'email':
        return Mail;
    }
  }

  // Fall back to schemaType
  switch (node.schemaType) {
    case 'string':
      return Type;
    case 'number':
    case 'integer':
      return Hash;
    case 'boolean':
      return ToggleLeft;
    default:
      return FileText;
  }
}

function SchemaTreeNodeImpl({ node, depth, onSelect }: SchemaTreeNodeProps) {
  const toggleTreeNode = useTreeStore((s) => s.toggleTreeNode);
  const selectedPath = useTreeStore((s) => s.selectedPath);
  // Subscribe to expandedTreePaths so component re-renders when it changes
  const expandedTreePaths = useTreeStore((s) => s.expandedTreePaths);

  const hasChildren = node.children && node.children.length > 0;
  const isExpanded = expandedTreePaths.has(node.path);
  const isSelected = selectedPath === node.path;

  // Use detailed icons for primitives, otherwise use type icons
  const Icon = node.type === 'primitive'
    ? getPrimitiveIcon(node)
    : typeIcons[node.type];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // If has children and collapsed, expand it in the tree
    if (hasChildren && !isExpanded) {
      toggleTreeNode(node.path);
    }
    // onSelect calls expandFormAncestors which expands the target and ancestors
    onSelect(node.path, node.hasValue, node.isPlaceholder || false);
  };

  const handleChevronClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Chevron toggles expand/collapse without navigating
    if (hasChildren) {
      toggleTreeNode(node.path);
    }
  };

  return (
    <div>
      <button
        type="button"
        onClick={handleClick}
        className={cn(
          'w-full flex items-center gap-1 px-1.5 py-0.5 text-left text-sm rounded transition-colors',
          'hover:bg-muted',
          isSelected && 'font-medium',
          node.isPlaceholder && 'italic text-muted-foreground'
        )}
        style={{
          paddingLeft: `${depth * 12 + 4}px`,
          ...(node.hasValue && !isSelected ? { backgroundColor: 'oklch(from var(--tree-accent) l c h / 0.08)' } : {}),
          ...(isSelected ? { backgroundColor: 'oklch(from var(--tree-accent) l c h / 0.15)', color: 'var(--tree-accent)' } : {}),
        }}
      >
        {/* Chevron for expandable nodes */}
        <span
          className={cn(
            'w-4 h-4 flex items-center justify-center shrink-0',
            !hasChildren && 'invisible'
          )}
          onClick={handleChevronClick}
        >
          {hasChildren && (
            isExpanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-muted-foreground" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
            )
          )}
        </span>

        {/* Type icon */}
        <span
          className="shrink-0"
          style={{
            color: node.hasValue ? 'var(--tree-accent-light)' : undefined,
          }}
        >
          <Icon className={cn('w-3.5 h-3.5', !node.hasValue && 'text-muted-foreground')} />
        </span>

        {/* Label */}
        <span className="truncate flex-1">
          {node.title}
        </span>

        {/* Array item count */}
        {node.type === 'array' && node.itemCount !== undefined && (
          <span className="text-xs text-muted-foreground shrink-0">
            ({node.itemCount})
          </span>
        )}

        {/* Dictionary key count */}
        {node.type === 'dictionary' && node.children && (
          <span className="text-xs text-muted-foreground shrink-0">
            ({node.children.filter((c) => !c.isPlaceholder).length})
          </span>
        )}
      </button>

      {/* Children */}
      {hasChildren && isExpanded && (
        <div>
          {node.children!.map((child) => (
            <SchemaTreeNode
              key={child.path}
              node={child}
              depth={depth + 1}
              onSelect={onSelect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

export const SchemaTreeNode = memo(SchemaTreeNodeImpl);
