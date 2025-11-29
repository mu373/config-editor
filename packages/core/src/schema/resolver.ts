import type { JSONSchema7 } from 'json-schema';

/**
 * SchemaResolver provides efficient schema resolution with caching.
 * It handles $ref resolution, property schema lookup, and default value generation.
 *
 * @example
 * ```ts
 * const resolver = new SchemaResolver(rootSchema);
 * const addressSchema = resolver.resolve({ $ref: '#/$defs/Address' });
 * const defaultValue = resolver.getDefaultValue({ type: 'string' });
 * ```
 */
export class SchemaResolver {
  private cache = new Map<string, JSONSchema7>();

  constructor(private rootSchema: JSONSchema7) {}

  /**
   * Resolve a schema, following $ref if present.
   * Results are cached for performance.
   *
   * @param schema - Schema potentially containing a $ref
   * @returns Resolved schema
   * @throws Error if $ref is invalid
   *
   * @example
   * ```ts
   * const resolver = new SchemaResolver(rootSchema);
   * const resolved = resolver.resolve({ $ref: '#/$defs/Address' });
   * ```
   */
  resolve(schema: JSONSchema7): JSONSchema7 {
    if (!schema.$ref) return schema;

    if (this.cache.has(schema.$ref)) {
      return this.cache.get(schema.$ref)!;
    }

    const resolved = this.resolveInternal(schema.$ref);
    this.cache.set(schema.$ref, resolved);
    return resolved;
  }

  private resolveInternal(ref: string): JSONSchema7 {
    const segments = ref.replace(/^#\//, '').split('/');
    let current: any = this.rootSchema;

    for (const segment of segments) {
      current = current?.[segment];
      if (!current) {
        throw new Error(`Invalid $ref: ${ref}`);
      }
    }

    return current as JSONSchema7;
  }

  /**
   * Get schema for a property of a parent schema.
   *
   * @param parentSchema - Parent schema containing properties
   * @param key - Property key to look up
   * @returns Schema for the property, or undefined if not found
   *
   * @example
   * ```ts
   * const resolver = new SchemaResolver(rootSchema);
   * const nameSchema = resolver.getPropertySchema(personSchema, 'name');
   * ```
   */
  getPropertySchema(
    parentSchema: JSONSchema7,
    key: string
  ): JSONSchema7 | undefined {
    const resolved = this.resolve(parentSchema);

    // Direct properties
    const propSchema = resolved.properties?.[key];
    if (propSchema && typeof propSchema === 'object') {
      return this.resolve(propSchema as JSONSchema7);
    }

    // Pattern properties
    if (resolved.patternProperties) {
      for (const [pattern, patternSchema] of Object.entries(
        resolved.patternProperties
      )) {
        if (
          new RegExp(pattern).test(key) &&
          typeof patternSchema === 'object'
        ) {
          return this.resolve(patternSchema as JSONSchema7);
        }
      }
    }

    // Additional properties
    if (typeof resolved.additionalProperties === 'object') {
      return this.resolve(resolved.additionalProperties as JSONSchema7);
    }

    return undefined;
  }

  /**
   * Get default value based on schema type.
   *
   * @param schema - Schema to get default value for
   * @returns Default value based on schema type and default property
   *
   * @example
   * ```ts
   * const resolver = new SchemaResolver(rootSchema);
   * resolver.getDefaultValue({ type: 'string' }) // => ''
   * resolver.getDefaultValue({ type: 'number' }) // => 0
   * resolver.getDefaultValue({ default: 'test' }) // => 'test'
   * ```
   */
  getDefaultValue(schema: JSONSchema7): unknown {
    const resolved = this.resolve(schema);

    if (resolved.default !== undefined) return resolved.default;

    // Handle nullable types
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
   * Get array of property keys in order defined by schema.
   * Uses x-order extension if available, otherwise properties order.
   *
   * @param schema - Schema to get property order from
   * @returns Array of property keys in order
   *
   * @example
   * ```ts
   * const resolver = new SchemaResolver(rootSchema);
   * const order = resolver.getPropertyOrder(schema);
   * // => ['name', 'email', 'age']
   * ```
   */
  getPropertyOrder(schema: JSONSchema7): string[] {
    const resolved = this.resolve(schema);

    // Check for x-order extension
    const xOrder = (resolved as any)['x-order'];
    if (Array.isArray(xOrder)) {
      return xOrder;
    }

    // Fall back to properties key order
    if (resolved.properties) {
      return Object.keys(resolved.properties);
    }

    return [];
  }

  /**
   * Clear the resolution cache.
   * Useful when the root schema changes.
   *
   * @example
   * ```ts
   * const resolver = new SchemaResolver(rootSchema);
   * // ... use resolver
   * resolver.clearCache();
   * ```
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get the root schema.
   *
   * @returns Root schema
   */
  getRootSchema(): JSONSchema7 {
    return this.rootSchema;
  }
}
