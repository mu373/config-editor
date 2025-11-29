import type { editor } from 'monaco-editor';

export const monokaiTheme: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'F8F8F2', background: '272822' },
    { token: 'comment', foreground: '75715E' },
    { token: 'string', foreground: 'E6DB74' },
    { token: 'number', foreground: 'AE81FF' },
    { token: 'keyword', foreground: 'F92672' },
    { token: 'operator', foreground: 'F92672' },
    { token: 'type', foreground: '66D9EF', fontStyle: 'italic' },
    { token: 'type.identifier', foreground: 'A6E22E' },
    { token: 'delimiter', foreground: 'F8F8F2' },
    { token: 'delimiter.bracket', foreground: 'F8F8F2' },
    { token: 'key', foreground: 'F92672' },
    { token: 'string.key.json', foreground: 'F92672' },
    { token: 'string.value.json', foreground: 'E6DB74' },
    { token: 'constant', foreground: 'AE81FF' },
    { token: 'tag', foreground: 'F92672' },
    { token: 'attribute.name', foreground: 'A6E22E' },
    { token: 'attribute.value', foreground: 'E6DB74' },
  ],
  colors: {
    'editor.background': '#272822',
    'editor.foreground': '#F8F8F2',
    'editorCursor.foreground': '#F8F8F0',
    'editor.lineHighlightBackground': '#3E3D32',
    'editorLineNumber.foreground': '#90908A',
    'editorLineNumber.activeForeground': '#F8F8F2',
    'editor.selectionBackground': '#49483E',
    'editor.inactiveSelectionBackground': '#49483E80',
    'editorIndentGuide.background': '#3B3A32',
    'editorIndentGuide.activeBackground': '#767166',
    'editorWhitespace.foreground': '#464741',
    'editorBracketMatch.background': '#3B3A3280',
    'editorBracketMatch.border': '#75715E',
  },
};

export const draculaTheme: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: 'F8F8F2', background: '282A36' },
    { token: 'comment', foreground: '6272A4' },
    { token: 'string', foreground: 'F1FA8C' },
    { token: 'number', foreground: 'BD93F9' },
    { token: 'keyword', foreground: 'FF79C6' },
    { token: 'operator', foreground: 'FF79C6' },
    { token: 'type', foreground: '8BE9FD', fontStyle: 'italic' },
    { token: 'type.identifier', foreground: '50FA7B' },
    { token: 'delimiter', foreground: 'F8F8F2' },
    { token: 'delimiter.bracket', foreground: 'F8F8F2' },
    { token: 'key', foreground: '8BE9FD' },
    { token: 'string.key.json', foreground: '8BE9FD' },
    { token: 'string.value.json', foreground: 'F1FA8C' },
    { token: 'constant', foreground: 'BD93F9' },
    { token: 'tag', foreground: 'FF79C6' },
    { token: 'attribute.name', foreground: '50FA7B' },
    { token: 'attribute.value', foreground: 'F1FA8C' },
  ],
  colors: {
    'editor.background': '#282A36',
    'editor.foreground': '#F8F8F2',
    'editorCursor.foreground': '#F8F8F0',
    'editor.lineHighlightBackground': '#44475A',
    'editorLineNumber.foreground': '#6272A4',
    'editorLineNumber.activeForeground': '#F8F8F2',
    'editor.selectionBackground': '#44475A',
    'editor.inactiveSelectionBackground': '#44475A80',
    'editorIndentGuide.background': '#3B3F51',
    'editorIndentGuide.activeBackground': '#6272A4',
    'editorWhitespace.foreground': '#424450',
    'editorBracketMatch.background': '#44475A80',
    'editorBracketMatch.border': '#6272A4',
  },
};

// Solarized palette (Ethan Schoonover)
// Base colors: base03 #002b36, base02 #073642, base01 #586e75, base00 #657b83
//              base0 #839496, base1 #93a1a1, base2 #eee8d5, base3 #fdf6e3
// Accents: yellow #b58900, orange #cb4b16, red #dc322f, magenta #d33682
//          violet #6c71c4, blue #268bd2, cyan #2aa198, green #859900

export const solarizedDarkTheme: editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', foreground: '839496', background: '002b36' },
    { token: 'comment', foreground: '586e75' },
    { token: 'string', foreground: '2aa198' },
    { token: 'number', foreground: 'd33682' },
    { token: 'keyword', foreground: '859900' },
    { token: 'operator', foreground: '859900' },
    { token: 'type', foreground: 'b58900' },
    { token: 'type.identifier', foreground: '268bd2' },
    { token: 'delimiter', foreground: '839496' },
    { token: 'delimiter.bracket', foreground: '839496' },
    { token: 'key', foreground: '268bd2' },
    { token: 'string.key.json', foreground: '268bd2' },
    { token: 'string.value.json', foreground: '2aa198' },
    { token: 'constant', foreground: 'cb4b16' },
    { token: 'tag', foreground: '268bd2' },
    { token: 'attribute.name', foreground: '93a1a1' },
    { token: 'attribute.value', foreground: '2aa198' },
  ],
  colors: {
    'editor.background': '#002b36',
    'editor.foreground': '#839496',
    'editorCursor.foreground': '#839496',
    'editor.lineHighlightBackground': '#073642',
    'editorLineNumber.foreground': '#586e75',
    'editorLineNumber.activeForeground': '#839496',
    'editor.selectionBackground': '#073642',
    'editor.inactiveSelectionBackground': '#07364280',
    'editorIndentGuide.background': '#073642',
    'editorIndentGuide.activeBackground': '#586e75',
    'editorWhitespace.foreground': '#073642',
    'editorBracketMatch.background': '#07364280',
    'editorBracketMatch.border': '#586e75',
  },
};

export const solarizedLightTheme: editor.IStandaloneThemeData = {
  base: 'vs',
  inherit: true,
  rules: [
    { token: '', foreground: '657b83', background: 'fdf6e3' },
    { token: 'comment', foreground: '93a1a1' },
    { token: 'string', foreground: '2aa198' },
    { token: 'number', foreground: 'd33682' },
    { token: 'keyword', foreground: '859900' },
    { token: 'operator', foreground: '859900' },
    { token: 'type', foreground: 'b58900' },
    { token: 'type.identifier', foreground: '268bd2' },
    { token: 'delimiter', foreground: '657b83' },
    { token: 'delimiter.bracket', foreground: '657b83' },
    { token: 'key', foreground: '268bd2' },
    { token: 'string.key.json', foreground: '268bd2' },
    { token: 'string.value.json', foreground: '2aa198' },
    { token: 'constant', foreground: 'cb4b16' },
    { token: 'tag', foreground: '268bd2' },
    { token: 'attribute.name', foreground: '586e75' },
    { token: 'attribute.value', foreground: '2aa198' },
  ],
  colors: {
    'editor.background': '#fdf6e3',
    'editor.foreground': '#657b83',
    'editorCursor.foreground': '#657b83',
    'editor.lineHighlightBackground': '#eee8d5',
    'editorLineNumber.foreground': '#93a1a1',
    'editorLineNumber.activeForeground': '#657b83',
    'editor.selectionBackground': '#eee8d5',
    'editor.inactiveSelectionBackground': '#eee8d580',
    'editorIndentGuide.background': '#eee8d5',
    'editorIndentGuide.activeBackground': '#93a1a1',
    'editorWhitespace.foreground': '#eee8d5',
    'editorBracketMatch.background': '#eee8d580',
    'editorBracketMatch.border': '#93a1a1',
  },
};

export function registerCustomThemes(monaco: { editor: typeof editor }) {
  monaco.editor.defineTheme('monokai', monokaiTheme);
  monaco.editor.defineTheme('dracula', draculaTheme);
  monaco.editor.defineTheme('solarized-dark', solarizedDarkTheme);
  monaco.editor.defineTheme('solarized-light', solarizedLightTheme);
}
