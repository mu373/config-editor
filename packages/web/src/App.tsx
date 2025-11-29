import { useCallback, useEffect, useState } from 'react';
import {
  EditorLayout,
  TabBar,
  useEditorStore,
  useSchemaStore,
  useSettingsStore,
} from '@config-editor/ui';
import type { SchemaPreset } from '@config-editor/core';

interface SampleFile {
  id: string;
  name: string;
  schemaId: string;
  content: string;
  format: 'yaml' | 'json';
}


const schemaDefaults: Record<
  string,
  { name: string; description: string; defaultContent?: string }
> = {
  basemodel: {
    name: 'Base Model',
    description: 'Epidemic model configuration',
    defaultContent: `# Base Model Configuration
model:
  name: my-model
  timespan:
    start_date: "2024-01-01"
    end_date: "2024-12-31"
    delta_t: 1
  population:
    name: US
    age_groups:
      - "0-4"
      - "5-17"
      - "18-49"
      - "50-64"
      - "65+"
  compartments:
    - id: S
      label: Susceptible
    - id: I
      label: Infected
    - id: R
      label: Recovered
  transitions:
    - type: mediated
      source: S
      target: I
      mediator: I
      rate: beta
    - type: spontaneous
      source: I
      target: R
      rate: gamma
  parameters:
    beta:
      type: scalar
      value: 0.3
    gamma:
      type: scalar
      value: 0.1
`,
  },
  modelset_calibration: {
    name: 'ModelSet Calibration',
    description: 'Calibration configuration for model sets',
    defaultContent: `# ModelSet Calibration Configuration
modelset:
  name: my-calibration
`,
  },
  modelset_sampling: {
    name: 'ModelSet Sampling',
    description: 'Sampling configuration for model sets',
    defaultContent: `# ModelSet Sampling Configuration
modelset:
  name: my-sampling
`,
  },
  output: {
    name: 'Output',
    description: 'Output configuration',
    defaultContent: `# Output Configuration
output:
  name: my-output
`,
  },
  'docker-compose': {
    name: 'Docker Compose',
    description: 'Docker Compose configuration',
    defaultContent: `services:
  web:
    image: nginx:latest
    ports:
      - "80:80"
`,
  },
  'github-workflow': {
    name: 'GitHub Actions',
    description: 'GitHub Actions workflow configuration',
    defaultContent: `name: CI
on: [push]
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
`,
  },
};

// Load bundled sample files
async function loadBundledSamples(): Promise<SampleFile[]> {
  const modules = import.meta.glob('./samples/*.{yaml,yml,json}', {
    eager: true,
    query: '?raw',
    import: 'default',
  });
  const samples: SampleFile[] = [];

  for (const [path, content] of Object.entries(modules)) {
    const fileName = path.split('/').pop();
    if (!fileName) continue;

    // Extract schema ID: "docker-compose.sample.yaml" → "docker-compose"
    const match = fileName.match(/^(.+?)\.sample\.(yaml|yml|json)$/);
    if (match) {
      const schemaId = match[1];
      const format = match[2] === 'json' ? 'json' : 'yaml';
      const meta = schemaDefaults[schemaId];

      samples.push({
        id: `${schemaId}-sample`,
        name: meta?.name ?? schemaId,
        schemaId,
        content: content as string,
        format,
      });
    }
  }

  return samples;
}

// Load only bundled schemas that actually exist (Vercel build may not include any)
async function loadBundledSchemas(): Promise<SchemaPreset[]> {
  const modules = import.meta.glob('./schemas/*.json', { eager: true });
  const schemas: SchemaPreset[] = [];

  for (const [path, mod] of Object.entries(modules)) {
    const fileName = path.split('/').pop();
    if (!fileName) continue;

    const id = fileName.replace('.json', '');
    const schemaModule = mod as { default?: SchemaPreset['schema'] };
    if (!schemaModule.default) continue;

    const meta =
      schemaDefaults[id] ?? { name: id, description: `${id} schema` };

    schemas.push({
      id,
      name: meta.name,
      description: meta.description,
      schema: schemaModule.default,
      defaultContent: meta.defaultContent ?? '',
    });
  }

  return schemas;
}

export default function App() {
  const { addTab } = useEditorStore();
  const {
    schemas: schemaPresets,
    hydrateFromStorage,
    mergeBundledSchemas,
  } = useSchemaStore();
  const { hydrateFromStorage: hydrateSettings } = useSettingsStore();
  const [isLoading, setIsLoading] = useState(true);
  const [samples, setSamples] = useState<SampleFile[]>([]);

  // Hydrate schemas and settings on mount
  useEffect(() => {
    async function initSchemas() {
      // First hydrate from localStorage
      hydrateFromStorage();
      hydrateSettings();

      // Then load bundled schemas and samples and merge (won't overwrite user schemas)
      const bundled = await loadBundledSchemas();
      const bundledSamples = await loadBundledSamples();

      if (bundled.length > 0) {
        mergeBundledSchemas(bundled);
      }
      setSamples(bundledSamples);

      setIsLoading(false);
    }
    initSchemas();
  }, [hydrateFromStorage, hydrateSettings, mergeBundledSchemas]);

  const handleNewTab = useCallback(
    (schemaId: string) => {
      const preset = schemaPresets.find(
        (preset: SchemaPreset) => preset.id === schemaId
      );
      if (!preset) return;

      addTab({
        fileName: null,
        content: preset.defaultContent || '',
        format: 'yaml',
        schema: preset.schema,
        schemaId: preset.id,
        isDirty: false,
      });
    },
    [addTab, schemaPresets]
  );

  const handleOpenSample = useCallback(
    (sample: SampleFile) => {
      const schema = schemaPresets.find((p) => p.id === sample.schemaId);
      addTab({
        fileName: `${sample.name}.${sample.format === 'json' ? 'json' : 'yaml'}`,
        content: sample.content,
        format: sample.format,
        schema: schema?.schema ?? null,
        schemaId: sample.schemaId,
        isDirty: false,
      });
    },
    [addTab, schemaPresets]
  );

  const defaultPreset = schemaPresets[0];

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-gray-50">
        <div className="text-gray-500">Loading schemas...</div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-gray-50">
      <TabBar
        schemas={schemaPresets}
        samples={samples}
        onNewTab={handleNewTab}
        onOpenSample={handleOpenSample}
        defaultSchema={defaultPreset?.schema ?? null}
        defaultSchemaId={defaultPreset?.id ?? null}
      />
      <main className="flex-1 min-h-0">
        <EditorLayout schemas={schemaPresets} onNewTab={handleNewTab} />
      </main>
    </div>
  );
}
