# config-editor

A JSON Schema-aware YAML/JSON editor featuring dual editing modes: raw text and form-based GUI.

Available at: https://config-editor.vercel.app/

## Features

- **Monaco Editor** with JSON Schema validation, autocompletion, and hover docs
- **Form-based GUI** for visual editing alongside raw text
- **YAML/JSON support**: seamlessly use formats you need
- **Multi-tab interface** for editing multiple configs
- **Schema management**: load schemas from URL, paste JSON, or use bundled presets
- **Bidirectional sync** between text editor and GUI form

## Use Cases

Use **config-editor** whenever you want to edit **JSON/YAML config** files and benefit from **JSON Schema**-based validation, safety, and collaboration. Example use cases include:

- **Application and service configs**: `config.yml`, `settings.json`, feature flags, and per-environment files
- **Infrastructure as Code (IaC) and orchestration**: Kubernetes manifests, Docker Compose files, Ansible playbooks, and cloud stack templates (e.g. AWS CloudFormation/SAM in YAML/JSON)
- **CI/CD and platform configs**: pipeline definitions (e.g. GitHub Actions, GitLab CI, Azure Pipelines), alert rules, dashboards, logging/metrics configs
- **API specifications**: OpenAPI/Swagger and AsyncAPI definitions written in YAML or JSON
- **ML and experiment configs**: Hydra/OmegaConf experiment settings, Weights & Biases sweep configs, DVC (`dvc.yaml`) pipelines, and other YAML/JSON-based experiment definitions
- **Scientific workflows and robotics**: Snakemake `config.yaml`, CWL workflow/input files, ROS/ROS 2 parameter files, and similar structured configs
- **Mixed expert / non-expert editing**: experts use raw Monaco editing while collaborators use a safer form-based GUI backed by the same schema


## Project Structure

```
packages/
  core/     # Schema loading, validation, format conversion
  ui/       # React components and stores
  web/      # Web app entry point
```

## Getting Started

Available at: https://config-editor.vercel.app/

For development:

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
