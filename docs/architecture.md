# Architecture

This document describes the core architecture of the Config Editor.

## Overview

Config Editor is a JSON Schema-aware YAML/JSON editor with dual editing modes:
- **Monaco Editor**: Raw text editing with syntax highlighting and validation
- **Schema Panel**: Form-based GUI generated from JSON Schema

Both views are synchronized through a shared `DocumentModel`.

```
┌─────────────────────────────────────────────────┐
│                EditorLayout                      │
│  ┌──────────────┐         ┌──────────────┐      │
│  │ Monaco Editor│         │ Schema Panel │      │
│  │   (text)     │         │   (form)     │      │
│  └──────┬───────┘         └──────┬───────┘      │
│         │                        │              │
│         └────────┬───────────────┘              │
│                  ▼                              │
│         ┌─────────────────┐                     │
│         │  DocumentModel  │ ← Single source     │
│         │                 │   of truth          │
│         └────────┬────────┘                     │
│                  │                              │
└──────────────────┼──────────────────────────────┘
                   ▼
          ┌────────────────┐
          │  Core Package  │
          │ - SchemaResolver│
          │ - Path utilities│
          │ - Serializers   │
          └────────────────┘
```

## DocumentModel

`DocumentModel` is the single source of truth for document state. Both Monaco and SchemaPanel observe and update this model.

```typescript
// packages/core/src/document/DocumentModel.ts

class DocumentModel {
  // Read/write operations
  getData(): Record<string, unknown>
  setData(data: Record<string, unknown>): void
  getValue(path: Path): unknown
  setValue(path: Path, value: unknown): void
  deleteValue(path: Path): void

  // Serialization (preserves comments)
  serialize(): string
  updateFromContent(content: string): void

  // Observer pattern
  subscribe(listener: () => void): () => void
}
```

**Key behaviors:**
- `setValue()` triggers observer notifications
- `serialize()` preserves YAML/JSONC comments when possible
- `updateFromContent()` is used when Monaco content changes

## Path Abstraction

Paths are represented as typed segments, not strings.

```typescript
// packages/core/src/path/types.ts

type PathSegment =
  | { type: 'property'; key: string }
  | { type: 'index'; index: number };

type Path = PathSegment[];
```

**Utilities:**
- `parsePath("user.addresses[0].city")` → typed Path
- `pathToString(path)` → string representation
- `getValueAtPath(obj, path)` → value at path
- `setValueAtPath(obj, path, value)` → new object (immutable)
- `deleteAtPath(obj, path)` → new object (immutable)

All path operations are **immutable** - they return new objects rather than mutating.

## Schema Resolution

`SchemaResolver` handles JSON Schema `$ref` resolution with caching.

```typescript
// packages/core/src/schema/resolver.ts

class SchemaResolver {
  constructor(rootSchema: JSONSchema7)

  resolve(schema: JSONSchema7): JSONSchema7      // Follow $ref
  getPropertySchema(parent, key): JSONSchema7    // Get property schema
  getDefaultValue(schema): unknown               // Type-based defaults
  clearCache(): void
}
```

**Resolution order for properties:**
1. `properties[key]`
2. `patternProperties` (regex match)
3. `additionalProperties`

## Synchronization

### Monaco → DocumentModel

The `useMonacoSync` hook handles synchronization:

```typescript
// packages/ui/src/hooks/useMonacoSync.ts

function useMonacoSync(document: DocumentModel, editorRef: RefObject<Monaco.Editor>)
```

- **Debounced** (300ms) to avoid excessive updates while typing
- Parses content and calls `document.updateFromContent()`
- Preserves cursor position and scroll state

### DocumentModel → Monaco

When `DocumentModel` changes (e.g., from SchemaPanel edits):
- Subscribers are notified
- Monaco receives new content via `executeEdits()` (preserves undo stack)
- Cursor/selection is restored

### DocumentModel → SchemaPanel

```typescript
// packages/ui/src/hooks/useDocument.ts

function useDocumentData(document: DocumentModel | null): Record<string, unknown>
```

- Returns reactive data that updates when document changes
- SchemaPanel re-renders with new data

## State Management

### editorStore (Zustand)

Manages editor tabs and their metadata:
- `tabs[]` - Open tabs with id, name, format, schemaId
- `activeTabId` - Currently active tab
- `updateTabContent()` - Updates tab content

### treeStore (Zustand)

Manages navigation and expansion state:
- `selectedPath` - Currently selected path in tree/form
- `expandedFormPaths` - Set of expanded paths
- `globalExpandLevel` - Default expansion depth
- `isFormPathExpanded(path)` - Check if path is expanded
- `toggleFormPath(path)` - Toggle expansion

### schemaStore (Zustand)

Manages available schemas:
- `schemas[]` - List of schema presets
- `getSchema(id)` - Get schema by ID

## Comment Preservation

YAML and JSONC comments are preserved when editing via the Schema Panel.

```typescript
// packages/core/src/formats/yaml.ts
updateYamlPreservingComments(original: string, newData: object, schema?: JSONSchema7): string

// packages/core/src/formats/json.ts
updateJsonPreservingComments(original: string, newData: object): string
```

### YAML Comments

The YAML algorithm uses **line-by-line string manipulation**:

1. **Parse original** - Split into lines, identify keys and their indentation levels
2. **Track comments** - Associate comments with their adjacent keys (both header and inline)
3. **Compare values** - Detect which keys changed, were added, or were removed
4. **Update in place** - Modify only the changed values while preserving surrounding text

### Comment Types Preserved

```yaml
# Header comment (preserved)
server:
  host: localhost  # Inline comment (preserved)
  port: 3000       # Another inline (preserved)
```

- **Header comments**: Lines starting with `#` above a key
- **Inline comments**: `# text` after a value on the same line
- **Spacing**: Original whitespace between value and inline comment is maintained

### Behaviors

| Operation | Comment Behavior |
|-----------|-----------------|
| Update scalar value | Inline comment preserved |
| Update nested object | Recurse, preserve all nested comments |
| Update array | Replace entire array block (comments in array items not preserved) |
| Add new key | Inserted without comments, respects schema property order if available |
| Delete key | Key and all associated comments removed |
| No changes | Returns original string unchanged |

**Limitations:**
- Array item comments may be lost when array is modified
- Comments on deleted-then-re-added keys are lost
- Multiline strings, anchors/aliases not fully supported

### JSONC Comments

JSONC (JSON with Comments) uses the `jsonc-parser` library for **AST-based editing**:

```jsonc
{
  // Line comment (preserved)
  "server": {
    "host": "localhost", /* Block comment (preserved) */
    "port": 3000,  // Trailing comma allowed
  }
}
```

**How it works:**
1. Parse original with `jsonc-parser` (tolerates comments and trailing commas)
2. Generate minimal edit operations by comparing old vs new values
3. Apply edits via `jsonc.applyEdits()` which preserves surrounding text

**Supported features:**
- Line comments (`// comment`)
- Block comments (`/* comment */`)
- Trailing commas
- Nested object/array comments

**Behaviors:**

| Operation | Comment Behavior |
|-----------|-----------------|
| Update scalar | Comments on same line preserved |
| Update object | Recurse, preserve nested comments |
| Update array (same length) | Recurse into each element |
| Update array (length changed) | Replace entire array |
| Add new key | Added without comments |
| Delete key | Key and adjacent comments removed |

### Format Detection

The format is auto-detected:

```typescript
detectFormat(content: string): 'yaml' | 'json' | 'jsonc'
```

- Starts with `{` or `[` → try JSON/JSONC
- Contains `//` or `/*` → JSONC
- Otherwise → YAML

### Fallback

If comment preservation fails, the system falls back to standard serialization (comments lost but output valid).

## Key Validation

Dictionary keys are validated to prevent prototype pollution:

```typescript
// packages/core/src/validation/keys.ts

isValidObjectKey(key: string): boolean
```

Forbidden keys: `__proto__`, `constructor`, `prototype`, etc.

## Package Structure

```
packages/
  core/           # No UI dependencies
    src/
      document/   # DocumentModel
      path/       # Path utilities
      schema/     # SchemaResolver, utils
      formats/    # YAML/JSON serializers
      validation/ # Key validation

  ui/             # React components
    src/
      components/
        Editor.tsx
        EditorLayout.tsx
        SchemaPanel/
          index.tsx
          SchemaForm.tsx
          FormField/
      hooks/
        useDocument.ts
        useMonacoSync.ts
      store/
        editorStore.ts
        treeStore.ts
        schemaStore.ts

  web/            # Vite app entry point
```

## Data Flow Example

**User edits a field in SchemaPanel:**

1. `FormField` calls `onChange(path, value)`
2. `SchemaForm.handleFieldChange()` converts string path to typed `Path`
3. `document.setValue(path, value)` updates data immutably
4. `DocumentModel` notifies subscribers
5. Monaco receives serialized content (comments preserved)
6. SchemaPanel re-renders with new data

**User types in Monaco:**

1. Monaco `onDidChangeModelContent` fires
2. `useMonacoSync` debounces (300ms)
3. `document.updateFromContent(newContent)` parses and updates
4. `DocumentModel` notifies subscribers
5. SchemaPanel re-renders with new data
