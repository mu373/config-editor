import { useCallback, useEffect, useState } from 'react';
import {
  EditorLayout,
  TabBar,
  useEditorStore,
  useSchemaStore,
} from '@config-editor/ui';
import type { SchemaPreset } from '@config-editor/core';

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
};

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
    schemasView,
    setSchemasView,
  } = useSchemaStore();
  const [isLoading, setIsLoading] = useState(true);

  // Hydrate schemas on mount
  useEffect(() => {
    async function initSchemas() {
      // First hydrate from localStorage
      hydrateFromStorage();

      // Then load bundled schemas and merge (won't overwrite user schemas)
      const bundled = await loadBundledSchemas();
      if (bundled.length > 0) {
        mergeBundledSchemas(bundled);
      }

      setIsLoading(false);
    }
    initSchemas();
  }, [hydrateFromStorage, mergeBundledSchemas]);

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

  const handleManageSchemas = useCallback(() => {
    setSchemasView(schemasView === 'edit' ? 'list' : 'edit');
  }, [schemasView, setSchemasView]);

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
        onNewTab={handleNewTab}
        onManageSchemas={handleManageSchemas}
        schemasViewActive={schemasView === 'edit'}
        defaultSchema={defaultPreset?.schema ?? null}
        defaultSchemaId={defaultPreset?.id ?? null}
      />
      <main className="flex-1 min-h-0">
        <EditorLayout schemas={schemaPresets} onNewTab={handleNewTab} />
      </main>
    </div>
  );
}
