# config-editor

A JSON Schema-aware YAML/JSON editor featuring dual editing modes: raw text and form-based GUI.

## Features

- **Monaco Editor** with JSON Schema validation, autocompletion, and hover docs
- **Form-based GUI** for visual editing alongside raw text
- **YAML/JSON toggle** with seamless format conversion
- **Multi-tab interface** for editing multiple configs
- **Schema management** - load schemas from URL, paste JSON, or use bundled presets
- **Bidirectional sync** between Monaco and form editor

## Project Structure

```
packages/
  core/     # Schema loading, validation, format conversion
  ui/       # React components and stores
  web/      # Web app entry point
```

## Getting Started

```bash
pnpm install
pnpm dev
```

Open http://localhost:5173

## Adding Schemas

1. Click the dropdown next to "+ New"
2. Select "Manage Schemas..."
3. Paste a schema URL or JSON content
4. Click "Add"

Schemas are persisted in localStorage.

## License

[MIT Licence](https://github.com/mu373/config-editor/blob/main/LICENSE)
