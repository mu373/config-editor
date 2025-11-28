import { useCallback, useEffect, useState } from 'react';
import {
  EditorLayout,
  Toolbar,
  TabBar,
  useEditorStore,
  useSchemaStore,
} from '@config-editor/ui';
import type { SchemaPreset } from '@config-editor/core';

// Try to load bundled schemas (dev mode only, may not exist in clean clone)
async function loadBundledSchemas(): Promise<SchemaPreset[]> {
  const schemas: SchemaPreset[] = [];

  try {
    const baseModelSchema = await import('./schemas/basemodel.json');
    schemas.push({
      id: 'basemodel',
      name: 'Base Model',
      description: 'Epidemic model configuration',
      schema: baseModelSchema.default as SchemaPreset['schema'],
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
    });
  } catch {
    // Schema not bundled
  }

  try {
    const modelsetCalibrationSchema = await import(
      './schemas/modelset_calibration.json'
    );
    schemas.push({
      id: 'modelset_calibration',
      name: 'ModelSet Calibration',
      description: 'Calibration configuration for model sets',
      schema: modelsetCalibrationSchema.default as SchemaPreset['schema'],
      defaultContent: `# ModelSet Calibration Configuration
modelset:
  name: my-calibration
`,
    });
  } catch {
    // Schema not bundled
  }

  try {
    const modelsetSamplingSchema = await import(
      './schemas/modelset_sampling.json'
    );
    schemas.push({
      id: 'modelset_sampling',
      name: 'ModelSet Sampling',
      description: 'Sampling configuration for model sets',
      schema: modelsetSamplingSchema.default as SchemaPreset['schema'],
      defaultContent: `# ModelSet Sampling Configuration
modelset:
  name: my-sampling
`,
    });
  } catch {
    // Schema not bundled
  }

  try {
    const outputSchema = await import('./schemas/output.json');
    schemas.push({
      id: 'output',
      name: 'Output',
      description: 'Output configuration',
      schema: outputSchema.default as SchemaPreset['schema'],
      defaultContent: `# Output Configuration
output:
  name: my-output
`,
    });
  } catch {
    // Schema not bundled
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
      <Toolbar
        defaultSchema={defaultPreset?.schema ?? null}
        defaultSchemaId={defaultPreset?.id ?? null}
      />
      <TabBar
        schemas={schemaPresets}
        onNewTab={handleNewTab}
        onManageSchemas={handleManageSchemas}
        schemasViewActive={schemasView === 'edit'}
      />
      <main className="flex-1 min-h-0">
        <EditorLayout schemas={schemaPresets} onNewTab={handleNewTab} />
      </main>
    </div>
  );
}
