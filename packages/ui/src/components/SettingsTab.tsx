import { useSettingsStore, type MonacoTheme } from '../store/settingsStore';

const themes: { value: MonacoTheme; label: string; description: string }[] = [
  { value: 'vs', label: 'Light', description: 'Default light theme' },
  { value: 'vs-dark', label: 'Dark', description: 'Default dark theme' },
  { value: 'monokai', label: 'Monokai', description: 'Classic Monokai theme' },
  { value: 'dracula', label: 'Dracula', description: 'Dracula theme' },
  { value: 'solarized-dark', label: 'Solarized Dark', description: 'Solarized dark theme' },
  { value: 'solarized-light', label: 'Solarized Light', description: 'Solarized light theme' },
  { value: 'hc-black', label: 'High Contrast', description: 'High contrast dark' },
  { value: 'hc-light', label: 'High Contrast Light', description: 'High contrast light' },
];

export function SettingsTab() {
  const { settings, setMonacoTheme } = useSettingsStore();

  return (
    <div className="h-full w-full bg-background">
      <div className="max-w-2xl mx-auto p-6">
        <h1 className="text-lg font-semibold text-foreground mb-6">Settings</h1>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-foreground mb-3">Editor Theme</h2>
          <div className="space-y-2">
            {themes.map((theme) => (
              <label
                key={theme.value}
                className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
                  settings.monacoTheme === theme.value
                    ? 'border-primary bg-accent'
                    : 'border-border hover:bg-accent/50'
                }`}
              >
                <input
                  type="radio"
                  name="monacoTheme"
                  value={theme.value}
                  checked={settings.monacoTheme === theme.value}
                  onChange={() => setMonacoTheme(theme.value)}
                  className="sr-only"
                />
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    settings.monacoTheme === theme.value
                      ? 'border-primary'
                      : 'border-muted-foreground'
                  }`}
                >
                  {settings.monacoTheme === theme.value && (
                    <div className="w-2 h-2 rounded-full bg-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <div className="text-sm font-medium text-foreground">{theme.label}</div>
                  <div className="text-xs text-muted-foreground">{theme.description}</div>
                </div>
              </label>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
