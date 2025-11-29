import type { JSONSchema7 } from 'json-schema';

/**
 * Resolves a JSON Schema $ref to its definition.
 *
 * @param schema - Schema potentially containing a $ref
 * @param rootSchema - Root schema containing definitions
 * @returns Resolved schema
 * @throws Error if $ref is invalid
 *
 * @example
 * ```ts
 * const root = { $defs: { Address: { type: 'object' } } };
 * const resolved = resolveRef({ $ref: '#/$defs/Address' }, root);
 * // => { type: 'object' }
 * ```
 */
export function resolveRef(
  schema: JSONSchema7,
  rootSchema: JSONSchema7,
  maxDepth: number = 10
): JSONSchema7 {
  if (!schema.$ref) return schema;
  if (maxDepth <= 0) return schema; // Prevent infinite loops

  const segments = schema.$ref.replace(/^#\//, '').split('/');
  let current: any = rootSchema;

  for (const segment of segments) {
    current = current?.[segment];
    if (!current) {
      throw new Error(`Invalid $ref: ${schema.$ref}`);
    }
  }

  let resolved = current as JSONSchema7;

  // Recursively resolve if the result also has a $ref
  if (resolved.$ref) {
    const deepResolved = resolveRef(resolved, rootSchema, maxDepth - 1);
    // Merge: keep metadata from intermediate schema, type info from deep resolved
    resolved = {
      ...deepResolved,
      title: resolved.title || deepResolved.title,
      description: resolved.description || deepResolved.description,
    };
  }

  return resolved;
}

/**
 * Gets the default value for a schema based on its type.
 *
 * @param schema - The JSON schema
 * @param rootSchema - Root schema for resolving $refs
 * @returns Default value appropriate for the schema type
 *
 * @example
 * ```ts
 * getDefaultValue({ type: 'string' }) // => ''
 * getDefaultValue({ type: 'number' }) // => 0
 * getDefaultValue({ default: 'custom' }) // => 'custom'
 * ```
 */
export function getDefaultValue(
  schema: JSONSchema7,
  rootSchema?: JSONSchema7
): unknown {
  const resolved = rootSchema ? resolveRef(schema, rootSchema) : schema;

  if (resolved.default !== undefined) return resolved.default;

  // Handle nullable types (anyOf/oneOf with null)
  if (resolved.anyOf || resolved.oneOf) {
    return null;
  }

  const schemaType = Array.isArray(resolved.type)
    ? resolved.type.find((t) => t !== 'null')
    : resolved.type;

  if (schemaType === 'string') return '';
  if (schemaType === 'number' || schemaType === 'integer') return 0;
  if (schemaType === 'boolean') return false;
  if (schemaType === 'array') return [];
  if (schemaType === 'object') return {};
  return null;
}

/**
 * Gets the schema for a property of a parent schema.
 * Handles properties, patternProperties, and additionalProperties.
 *
 * @param parentSchema - The parent object schema
 * @param key - The property key to get the schema for
 * @param rootSchema - Root schema for resolving $refs
 * @returns Schema for the property, or undefined if not found
 *
 * @example
 * ```ts
 * const schema = {
 *   properties: { name: { type: 'string' } }
 * };
 * getPropertySchema(schema, 'name', schema) // => { type: 'string' }
 * ```
 */
export function getPropertySchema(
  parentSchema: JSONSchema7,
  key: string,
  rootSchema: JSONSchema7
): JSONSchema7 | undefined {
  const resolved = resolveRef(parentSchema, rootSchema);

  // Check direct properties first
  const propSchema = resolved.properties?.[key];
  if (propSchema && typeof propSchema === 'object') {
    return resolveRef(propSchema as JSONSchema7, rootSchema);
  }

  // Check patternProperties
  if (resolved.patternProperties) {
    for (const [pattern, patternSchema] of Object.entries(
      resolved.patternProperties
    )) {
      if (new RegExp(pattern).test(key) && typeof patternSchema === 'object') {
        return resolveRef(patternSchema as JSONSchema7, rootSchema);
      }
    }
  }

  // Check additionalProperties
  if (typeof resolved.additionalProperties === 'object') {
    return resolveRef(resolved.additionalProperties as JSONSchema7, rootSchema);
  }

  return undefined;
}

/**
 * Gets the property order from a schema.
 * Returns an array of property names in the order they appear in the schema.
 *
 * @param schema - The object schema
 * @param rootSchema - Root schema for resolving $refs
 * @returns Array of property names in schema order
 */
export function getSchemaPropertyOrder(
  schema: JSONSchema7 | undefined,
  rootSchema: JSONSchema7 | undefined
): string[] {
  if (!schema || !rootSchema) return [];

  const resolved = resolveRef(schema, rootSchema);
  if (!resolved.properties) return [];

  return Object.keys(resolved.properties);
}
