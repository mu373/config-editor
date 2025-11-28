import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import type { JSONSchema7 } from 'json-schema';

interface SchemaTreeProps {
  schema: JSONSchema7;
  path?: string;
  onFieldClick?: (path: string) => void;
}

interface SchemaNodeProps {
  name: string;
  schema: JSONSchema7;
  path: string;
  required?: boolean;
  onFieldClick?: (path: string) => void;
  depth?: number;
}

function getTypeLabel(schema: JSONSchema7): string {
  if (schema.type) {
    if (Array.isArray(schema.type)) {
      return schema.type.filter((t) => t !== 'null').join(' | ');
    }
    return schema.type;
  }
  if (schema.anyOf || schema.oneOf) {
    return 'union';
  }
  if (schema.$ref) {
    const refParts = schema.$ref.split('/');
    return refParts[refParts.length - 1];
  }
  return 'any';
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

function SchemaNode({
  name,
  schema,
  path,
  required = false,
  onFieldClick,
  depth = 0,
}: SchemaNodeProps) {
  const [isExpanded, setIsExpanded] = useState(depth < 2);

  const hasChildren =
    schema.type === 'object' ||
    schema.type === 'array' ||
    schema.properties ||
    schema.items ||
    schema.anyOf ||
    schema.oneOf;

  const typeLabel = getTypeLabel(schema);
  const title = schema.title || name;
  const description = schema.description;

  const handleClick = () => {
    if (hasChildren) {
      setIsExpanded(!isExpanded);
    }
    if (onFieldClick) {
      onFieldClick(path);
    }
  };

  return (
    <div className="select-none">
      <div
        onClick={handleClick}
        className={`flex items-center gap-1 py-1 px-2 hover:bg-gray-100 cursor-pointer rounded text-sm ${
          depth === 0 ? 'font-medium' : ''
        }`}
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        {hasChildren ? (
          <span className="w-4 h-4 flex items-center justify-center text-gray-400">
            {isExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
          </span>
        ) : (
          <span className="w-4" />
        )}

        <span className="text-gray-800">
          {title}
          {required && <span className="text-red-500 ml-0.5">*</span>}
        </span>

        <span className="text-gray-400 text-xs ml-auto">{typeLabel}</span>
      </div>

      {description && isExpanded && (
        <div
          className="text-xs text-gray-500 py-0.5 px-2"
          style={{ paddingLeft: `${depth * 16 + 28}px` }}
        >
          {description}
        </div>
      )}

      {isExpanded && schema.properties && (
        <div>
          {Object.entries(schema.properties).map(([key, propSchema]) => (
            <SchemaNode
              key={key}
              name={key}
              schema={propSchema as JSONSchema7}
              path={path ? `${path}.${key}` : key}
              required={schema.required?.includes(key)}
              onFieldClick={onFieldClick}
              depth={depth + 1}
            />
          ))}
        </div>
      )}

      {isExpanded && schema.items && !Array.isArray(schema.items) && (
        <SchemaNode
          name="[items]"
          schema={schema.items as JSONSchema7}
          path={`${path}[]`}
          onFieldClick={onFieldClick}
          depth={depth + 1}
        />
      )}

      {isExpanded && schema.additionalProperties && typeof schema.additionalProperties === 'object' && (
        <SchemaNode
          name="[key]"
          schema={schema.additionalProperties as JSONSchema7}
          path={`${path}.<key>`}
          onFieldClick={onFieldClick}
          depth={depth + 1}
        />
      )}

      {isExpanded && (schema.anyOf || schema.oneOf) && (
        <div className="text-xs text-gray-400 py-1" style={{ paddingLeft: `${(depth + 1) * 16 + 8}px` }}>
          One of:
          {(schema.anyOf || schema.oneOf)?.map((variant, i) => (
            <span key={i} className="ml-2">
              {getTypeLabel(variant as JSONSchema7)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

export function SchemaTree({ schema, path = '', onFieldClick }: SchemaTreeProps) {
  // Resolve $defs/definitions references for the root level
  const rootProperties = schema.properties;

  if (!rootProperties) {
    return (
      <div className="p-4 text-sm text-gray-500">
        No properties defined in schema
      </div>
    );
  }

  return (
    <div className="py-2">
      {Object.entries(rootProperties).map(([key, propSchema]) => {
        let resolved = propSchema as JSONSchema7;
        if (resolved.$ref) {
          resolved = resolveRef(resolved, schema);
        }
        return (
          <SchemaNode
            key={key}
            name={key}
            schema={resolved}
            path={key}
            required={schema.required?.includes(key)}
            onFieldClick={onFieldClick}
            depth={0}
          />
        );
      })}
    </div>
  );
}
