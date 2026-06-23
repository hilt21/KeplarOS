/**
 * Theme definitions (F2-09).
 *
 * Each entry is a partial subset of `--color-*` overrides that map to
 * a `[data-theme="..."]` CSS selector block in `globals.css`. Spacing,
 * radius, motion, and font tokens are shared (never themed).
 *
 * The CSS overrides for these themes are added to `globals.css`
 * separately. This file only exposes the data + order to TypeScript.
 */

export const themes = {
  "dark-codex": {
    label: "Dark Codex",
    swatch: "#0b0f19",
  },
  "dark-solarized": {
    label: "Dark Solarized",
    swatch: "#002b36",
  },
  "light-paper": {
    label: "Light Paper",
    swatch: "#fdf6e3",
  },
  "dark-monokai": {
    label: "Dark Monokai",
    swatch: "#1e1f1c",
  },
} as const;

export const themeOrder = [
  "dark-codex",
  "dark-solarized",
  "light-paper",
  "dark-monokai",
] as const satisfies readonly (keyof typeof themes)[];