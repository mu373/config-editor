import type { JSONSchema7 } from 'json-schema';

export interface TreeNode {
  path: string;           // Full path like "services.web.ports[0]"
  key: string;            // Display key like "ports"
  title: string;          // Schema title or key
  type: 'object' | 'array' | 'dictionary' | 'primitive' | 'variant';
  hasValue: boolean;      // Whether this field has a value in current data
  isRequired: boolean;    // From schema.required
  children?: TreeNode[];  // Nested nodes
  itemCount?: number;     // For arrays: number of items
  isPlaceholder?: boolean; // For dictionary [key name] placeholder
  schemaType?: string;    // The actual schema type (string, number, etc)
  format?: string;        // Schema format (date, date-time, email, uri, etc)
  hasEnum?: boolean;      // Whether field has enum constraint
}

/**
 * Resolve a $ref in a schema
 */
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

/**
 * Resolve a nullable $ref pattern (anyOf: [$ref, null]) to get the actual schema
 * This expands patterns like: { anyOf: [{ $ref: "#/$defs/Foo" }, { type: "null" }] }
 * into the resolved Foo schema while preserving the parent's title/description
 */
function resolveNullableRef(schema: JSONSchema7, rootSchema: JSONSchema7): JSONSchema7 {
  const variants = schema.anyOf || schema.oneOf;
  if (!variants) return schema;

  // Find non-null variant (which may have a $ref)
  const nonNullVariant = (variants as JSONSchema7[]).find((v) => v.type !== 'null');
  if (!nonNullVariant) return schema;

  // If the non-null variant is a $ref, resolve it
  if (nonNullVariant.$ref) {
    const resolved = resolveRef(nonNullVariant, rootSchema);
    // Merge parent's title/description with resolved schema
    return {
      ...resolved,
      title: schema.title || resolved.title,
      description: schema.description || resolved.description,
    };
  }

  // If variant has inline properties, return it
  if (nonNullVariant.properties || nonNullVariant.type) {
    return {
      ...nonNullVariant,
      title: schema.title || nonNullVariant.title,
      description: schema.description || nonNullVariant.description,
    };
  }

  return schema;
}

/**
 * Get the effective type of a schema, handling anyOf/oneOf with null
 */
function getSchemaType(schema: JSONSchema7, rootSchema?: JSONSchema7): string | undefined {
  if (schema.type) {
    return Array.isArray(schema.type)
      ? schema.type.find((t) => t !== 'null')
      : schema.type;
  }

  // Check for anyOf/oneOf patterns
  if (schema.anyOf || schema.oneOf) {
    const variants = (schema.anyOf || schema.oneOf) as JSONSchema7[];
    const nonNullVariant = variants.find((v) => v.type !== 'null');
    if (nonNullVariant) {
      // If variant has a direct type, use it
      if (nonNullVariant.type) {
        return Array.isArray(nonNullVariant.type)
          ? nonNullVariant.type.find((t) => t !== 'null')
          : nonNullVariant.type;
      }
      // If variant is a $ref, resolve it and get its type
      if (nonNullVariant.$ref && rootSchema) {
        const resolved = resolveRef(nonNullVariant, rootSchema);
        return getSchemaType(resolved, rootSchema);
      }
    }
  }

  // Infer from properties or additionalProperties
  if (schema.properties || schema.additionalProperties) {
    return 'object';
  }
  if (schema.items) {
    return 'array';
  }

  return undefined;
}

/**
 * Check if schema represents a dictionary (object with additionalProperties or patternProperties)
 */
function isDictionary(schema: JSONSchema7, rootSchema?: JSONSchema7): boolean {
  const hasNoProperties = !schema.properties || Object.keys(schema.properties).length === 0;
  const hasAdditionalProps = schema.additionalProperties !== false && schema.additionalProperties !== undefined;
  const hasPatternProps = schema.patternProperties && Object.keys(schema.patternProperties).length > 0;
  return hasNoProperties && (hasAdditionalProps || hasPatternProps) && getSchemaType(schema, rootSchema) === 'object';
}

/**
 * Get the schema for dictionary values (from additionalProperties or patternProperties)
 */
function getDictionaryValueSchema(schema: JSONSchema7): JSONSchema7 {
  // Prefer additionalProperties if it's an object schema
  if (typeof schema.additionalProperties === 'object') {
    return schema.additionalProperties as JSONSchema7;
  }
  // Fall back to first patternProperties entry
  if (schema.patternProperties) {
    const patterns = Object.values(schema.patternProperties);
    if (patterns.length > 0) {
      return patterns[0] as JSONSchema7;
    }
  }
  return {} as JSONSchema7;
}

/**
 * Check if schema is a polymorphic type (anyOf/oneOf with multiple non-null variants)
 */
function isPolymorphic(schema: JSONSchema7): boolean {
  const variants = schema.anyOf || schema.oneOf;
  if (!variants) return false;

  const nonNullVariants = (variants as JSONSchema7[]).filter((v) => v.type !== 'null');
  return nonNullVariants.length > 1;
}

/**
 * Get value at a specific path
 */
function getValueAtPath(value: unknown, path: string): unknown {
  if (path === '') return value;

  const parts = path.match(/[^.\[\]]+|\[\d+\]/g) ?? [];
  let current = value;

  for (const part of parts) {
    if (current === undefined || current === null) return undefined;

    if (part.startsWith('[') && part.endsWith(']')) {
      const index = parseInt(part.slice(1, -1), 10);
      current = Array.isArray(current) ? current[index] : undefined;
    } else {
      current = (current as Record<string, unknown>)[part];
    }
  }

  return current;
}

/**
 * Get the placeholder label for a dictionary based on schema
 */
function getDictionaryPlaceholder(schema: JSONSchema7): string {
  // Try to infer from title or property names
  const title = schema.title?.toLowerCase() || '';

  if (title.includes('service')) return '[service name]';
  if (title.includes('volume')) return '[volume name]';
  if (title.includes('network')) return '[network name]';
  if (title.includes('secret')) return '[secret name]';
  if (title.includes('config')) return '[config name]';

  return '[key]';
}

/**
 * Build tree nodes from a JSON schema
 */
export function buildTreeFromSchema(
  schema: JSONSchema7,
  value: Record<string, unknown>,
  rootSchema: JSONSchema7,
  parentPath: string = '',
  requiredFields: Set<string> = new Set(),
  visitedRefs: Set<string> = new Set()
): TreeNode[] {
  const nodes: TreeNode[] = [];
  const resolved = resolveRef(schema, rootSchema);

  // Track visited refs to avoid infinite loops
  if (schema.$ref) {
    if (visitedRefs.has(schema.$ref)) {
      return nodes;
    }
    visitedRefs = new Set(visitedRefs);
    visitedRefs.add(schema.$ref);
  }

  const schemaType = getSchemaType(resolved, rootSchema);

  // Handle object with properties
  if (resolved.properties) {
    const required = new Set(resolved.required || []);

    for (const [key, propSchema] of Object.entries(resolved.properties)) {
      const prop = propSchema as JSONSchema7;
      // First resolve top-level $ref, then expand nullable $ref patterns (anyOf: [$ref, null])
      let resolvedProp = resolveRef(prop, rootSchema);
      resolvedProp = resolveNullableRef(resolvedProp, rootSchema);
      const path = parentPath ? `${parentPath}.${key}` : key;
      const propValue = value?.[key];
      const hasValue = propValue !== undefined;
      const propType = getSchemaType(resolvedProp, rootSchema);

      const node: TreeNode = {
        path,
        key,
        title: resolvedProp.title || prop.title || key,
        type: getNodeType(resolvedProp, rootSchema),
        hasValue,
        isRequired: required.has(key) || requiredFields.has(key),
        schemaType: propType,
        format: resolvedProp.format,
        hasEnum: Array.isArray(resolvedProp.enum) && resolvedProp.enum.length > 0,
      };

      // Build children for complex types
      if (propType === 'object' && !isDictionary(resolvedProp, rootSchema)) {
        node.children = buildTreeFromSchema(
          resolvedProp,
          (propValue as Record<string, unknown>) || {},
          rootSchema,
          path,
          new Set(resolvedProp.required || []),
          visitedRefs
        );
      } else if (propType === 'object' && isDictionary(resolvedProp, rootSchema)) {
        // Dictionary: add placeholder + existing keys
        node.type = 'dictionary';
        node.children = buildDictionaryChildren(
          resolvedProp,
          (propValue as Record<string, unknown>) || {},
          rootSchema,
          path,
          visitedRefs
        );
      } else if (propType === 'array') {
        const items = Array.isArray(propValue) ? propValue : [];
        node.itemCount = items.length;
        node.children = buildArrayChildren(
          resolvedProp,
          items,
          rootSchema,
          path,
          visitedRefs
        );
      } else if (isPolymorphic(resolvedProp)) {
        node.type = 'variant';
        // For polymorphic types, show current variant's structure if value exists
        if (hasValue && typeof propValue === 'object' && propValue !== null) {
          node.children = buildTreeFromSchema(
            resolvedProp,
            propValue as Record<string, unknown>,
            rootSchema,
            path,
            new Set(),
            visitedRefs
          );
        }
      }

      nodes.push(node);
    }
  }

  return nodes;
}

/**
 * Determine the node type from schema
 */
function getNodeType(
  schema: JSONSchema7,
  rootSchema: JSONSchema7
): TreeNode['type'] {
  let resolved = resolveRef(schema, rootSchema);
  resolved = resolveNullableRef(resolved, rootSchema);
  const schemaType = getSchemaType(resolved, rootSchema);

  if (isPolymorphic(resolved)) return 'variant';
  if (isDictionary(resolved, rootSchema)) return 'dictionary';
  if (schemaType === 'array') return 'array';
  if (schemaType === 'object') return 'object';
  return 'primitive';
}

/**
 * Build children for dictionary types
 */
function buildDictionaryChildren(
  schema: JSONSchema7,
  value: Record<string, unknown>,
  rootSchema: JSONSchema7,
  parentPath: string,
  visitedRefs: Set<string>
): TreeNode[] {
  const children: TreeNode[] = [];
  const resolved = resolveRef(schema, rootSchema);

  // Add placeholder node for adding new keys
  const placeholder: TreeNode = {
    path: `${parentPath}.__placeholder__`,
    key: getDictionaryPlaceholder(resolved),
    title: getDictionaryPlaceholder(resolved),
    type: 'primitive',
    hasValue: false,
    isRequired: false,
    isPlaceholder: true,
  };
  children.push(placeholder);

  // Add existing keys - use getDictionaryValueSchema to handle patternProperties
  const valueSchema = getDictionaryValueSchema(resolved);

  for (const key of Object.keys(value || {})) {
    const path = `${parentPath}.${key}`;
    const itemValue = value[key];
    const resolvedItem = resolveRef(valueSchema, rootSchema);
    const itemType = getSchemaType(resolvedItem, rootSchema);

    const node: TreeNode = {
      path,
      key,
      title: key,
      type: getNodeType(resolvedItem, rootSchema),
      hasValue: true,
      isRequired: false,
      schemaType: itemType,
    };

    // Build children for nested objects
    if (itemType === 'object' && typeof itemValue === 'object' && itemValue !== null) {
      if (isDictionary(resolvedItem, rootSchema)) {
        node.type = 'dictionary';
        node.children = buildDictionaryChildren(
          resolvedItem,
          itemValue as Record<string, unknown>,
          rootSchema,
          path,
          visitedRefs
        );
      } else {
        node.children = buildTreeFromSchema(
          resolvedItem,
          itemValue as Record<string, unknown>,
          rootSchema,
          path,
          new Set(resolvedItem.required || []),
          visitedRefs
        );
      }
    } else if (itemType === 'array' && Array.isArray(itemValue)) {
      node.itemCount = itemValue.length;
      node.children = buildArrayChildren(
        resolvedItem,
        itemValue,
        rootSchema,
        path,
        visitedRefs
      );
    }

    children.push(node);
  }

  return children;
}

/**
 * Build children for array types
 */
function buildArrayChildren(
  schema: JSONSchema7,
  value: unknown[],
  rootSchema: JSONSchema7,
  parentPath: string,
  visitedRefs: Set<string>
): TreeNode[] {
  const children: TreeNode[] = [];
  const resolved = resolveRef(schema, rootSchema);

  const itemsSchema =
    resolved.items && !Array.isArray(resolved.items)
      ? (resolved.items as JSONSchema7)
      : ({} as JSONSchema7);

  const resolvedItems = resolveRef(itemsSchema, rootSchema);
  const itemType = getSchemaType(resolvedItems, rootSchema);

  for (let i = 0; i < value.length; i++) {
    const path = `${parentPath}[${i}]`;
    const itemValue = value[i];

    const node: TreeNode = {
      path,
      key: `[${i}]`,
      title: `[${i}]`,
      type: getNodeType(resolvedItems, rootSchema),
      hasValue: true,
      isRequired: false,
      schemaType: itemType,
    };

    // Build children for nested objects
    if (itemType === 'object' && typeof itemValue === 'object' && itemValue !== null) {
      if (isDictionary(resolvedItems, rootSchema)) {
        node.type = 'dictionary';
        node.children = buildDictionaryChildren(
          resolvedItems,
          itemValue as Record<string, unknown>,
          rootSchema,
          path,
          visitedRefs
        );
      } else {
        node.children = buildTreeFromSchema(
          resolvedItems,
          itemValue as Record<string, unknown>,
          rootSchema,
          path,
          new Set(resolvedItems.required || []),
          visitedRefs
        );
      }
    } else if (itemType === 'array' && Array.isArray(itemValue)) {
      node.itemCount = itemValue.length;
      node.children = buildArrayChildren(
        resolvedItems,
        itemValue,
        rootSchema,
        path,
        visitedRefs
      );
    }

    children.push(node);
  }

  return children;
}

/**
 * Filter tree to show only nodes with values (and their ancestors)
 */
export function filterPopulatedNodes(nodes: TreeNode[]): TreeNode[] {
  return nodes.reduce<TreeNode[]>((acc, node) => {
    if (node.isPlaceholder) {
      // Don't include placeholders in filtered view
      return acc;
    }

    if (node.children) {
      const filteredChildren = filterPopulatedNodes(node.children);
      if (filteredChildren.length > 0 || node.hasValue) {
        acc.push({
          ...node,
          children: filteredChildren.length > 0 ? filteredChildren : undefined,
        });
      }
    } else if (node.hasValue) {
      acc.push(node);
    }

    return acc;
  }, []);
}
