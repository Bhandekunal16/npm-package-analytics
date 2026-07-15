/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type ThemeMode = 'light' | 'dark' | 'system';
export type ColorTheme = 'indigo' | 'emerald' | 'rose' | 'violet' | 'sky';

export const THEME_MODE_KEY = 'npm_analytics_theme_mode';
export const COLOR_THEME_KEY = 'npm_analytics_color_theme';

export const COLOR_THEMES: { id: ColorTheme; label: string; color: string }[] = [
  { id: 'indigo', label: 'Indigo', color: '#4f46e5' },
  { id: 'emerald', label: 'Emerald', color: '#059669' },
  { id: 'rose', label: 'Rose', color: '#e11d48' },
  { id: 'violet', label: 'Violet', color: '#7c3aed' },
  { id: 'sky', label: 'Sky', color: '#0284c7' },
];

export const THEME_MODES: { id: ThemeMode; label: string }[] = [
  { id: 'light', label: 'Light' },
  { id: 'dark', label: 'Dark' },
  { id: 'system', label: 'System' },
];

export function isColorTheme(value: string | null): value is ColorTheme {
  return COLOR_THEMES.some((theme) => theme.id === value);
}

export function isThemeMode(value: string | null): value is ThemeMode {
  return THEME_MODES.some((mode) => mode.id === value);
}

export function resolveThemeMode(mode: ThemeMode): 'light' | 'dark' {
  if (mode === 'system') {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  }
  return mode;
}

export function applyTheme(mode: ThemeMode, colorTheme: ColorTheme) {
  const root = document.documentElement;
  const resolved = resolveThemeMode(mode);

  root.classList.toggle('dark', resolved === 'dark');
  root.setAttribute('data-color-theme', colorTheme);
}

export function readStoredThemeMode(): ThemeMode {
  const stored = localStorage.getItem(THEME_MODE_KEY);
  return isThemeMode(stored) ? stored : 'system';
}

export function readStoredColorTheme(): ColorTheme {
  const stored = localStorage.getItem(COLOR_THEME_KEY);
  return isColorTheme(stored) ? stored : 'indigo';
}
