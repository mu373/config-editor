import { useSettingsStore, type MonacoTheme, type AccentColor } from '../store/settingsStore';

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

// Accent color options with CSS background colors for preview
const accentColors: { value: AccentColor; label: string; color: string }[] = [
  // Gray scale
  { value: 'slate', label: 'Slate', color: 'oklch(0.554 0.046 257.417)' },
  { value: 'gray', label: 'Gray', color: 'oklch(0.551 0.027 264.364)' },
  { value: 'zinc', label: 'Zinc', color: 'oklch(0.552 0.016 285.938)' },
  { value: 'neutral', label: 'Neutral', color: 'oklch(0.556 0 0)' },
  { value: 'stone', label: 'Stone', color: 'oklch(0.553 0.013 58.071)' },
  // Warm colors
  { value: 'red', label: 'Red', color: 'oklch(0.637 0.237 25.331)' },
  { value: 'orange', label: 'Orange', color: 'oklch(0.705 0.213 47.604)' },
  { value: 'amber', label: 'Amber', color: 'oklch(0.769 0.188 70.08)' },
  { value: 'yellow', label: 'Yellow', color: 'oklch(0.852 0.199 91.936)' },
  { value: 'lime', label: 'Lime', color: 'oklch(0.841 0.238 128.85)' },
  // Green colors
  { value: 'green', label: 'Green', color: 'oklch(0.723 0.219 149.579)' },
  { value: 'emerald', label: 'Emerald', color: 'oklch(0.696 0.17 162.48)' },
  { value: 'teal', label: 'Teal', color: 'oklch(0.704 0.14 182.503)' },
  { value: 'cyan', label: 'Cyan', color: 'oklch(0.715 0.143 215.221)' },
  { value: 'sky', label: 'Sky', color: 'oklch(0.685 0.169 237.323)' },
  // Blue colors
  { value: 'blue', label: 'Blue', color: 'oklch(0.623 0.214 259.815)' },
  { value: 'indigo', label: 'Indigo', color: 'oklch(0.585 0.233 277.117)' },
  { value: 'violet', label: 'Violet', color: 'oklch(0.606 0.25 292.717)' },
  // Purple/Pink colors
  { value: 'purple', label: 'Purple', color: 'oklch(0.627 0.265 303.9)' },
  { value: 'fuchsia', label: 'Fuchsia', color: 'oklch(0.667 0.295 322.15)' },
  { value: 'pink', label: 'Pink', color: 'oklch(0.656 0.241 354.308)' },
  { value: 'rose', label: 'Rose', color: 'oklch(0.645 0.246 16.439)' },
];

export function SettingsTab() {
  const { settings, setMonacoTheme, setJsonIncludeComments, setAccentColor } = useSettingsStore();

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

        <section className="mb-8">
          <h2 className="text-sm font-medium text-foreground mb-3">Accent Color</h2>
          <p className="text-xs text-muted-foreground mb-3">
            Color used to highlight populated fields in the schema tree sidebar
          </p>
          <div className="flex flex-wrap gap-2">
            {accentColors.map((color) => (
              <button
                key={color.value}
                type="button"
                onClick={() => setAccentColor(color.value)}
                className={`w-8 h-8 rounded-full border-2 transition-all ${
                  settings.accentColor === color.value
                    ? 'border-foreground scale-110'
                    : 'border-transparent hover:scale-105'
                }`}
                style={{ backgroundColor: color.color }}
                title={color.label}
              />
            ))}
          </div>
        </section>

        <section className="mb-8">
          <h2 className="text-sm font-medium text-foreground mb-3">JSON Format</h2>
          <label
            className={`flex items-center gap-3 p-3 rounded border cursor-pointer transition-colors ${
              settings.jsonIncludeComments
                ? 'border-primary bg-accent'
                : 'border-border hover:bg-accent/50'
            }`}
          >
            <input
              type="checkbox"
              checked={settings.jsonIncludeComments}
              onChange={(e) => setJsonIncludeComments(e.target.checked)}
              className="sr-only"
            />
            <div
              className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                settings.jsonIncludeComments
                  ? 'border-primary bg-primary'
                  : 'border-muted-foreground'
              }`}
            >
              {settings.jsonIncludeComments && (
                <svg
                  className="w-3 h-3 text-primary-foreground"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
              )}
            </div>
            <div className="flex-1">
              <div className="text-sm font-medium text-foreground">Include Comments</div>
              <div className="text-xs text-muted-foreground">
                Enable JSONC format (JSON with Comments) for JSON files
              </div>
            </div>
          </label>
        </section>
      </div>
    </div>
  );
}
