# Changelog

All notable changes to this project will be documented in this file.

## [0.2.0] - 2026-06-01

### Added

- **External stylesheet support** — pass pre-fetched CSS via `externalStylesheets` option; fast-a11y resolves colors and font sizes from external CSS without making network requests
- **CSS variable resolution** — resolves `var(--token)` in color and font-size values; handles chained variables (`--text: var(--brand-dark)`), fallbacks (`var(--a, #333)`), and design system token patterns (Tailwind v4, Bootstrap 5, WordPress presets)
- **WCAG level grading** — contrast results now include `wcagLevel: "AA" | "AAA" | "fail"` in check data; no longer a binary pass/fail
- **Font-size variable resolution** — `font-size: var(--text-xl)` correctly feeds the large-text threshold check (affects AA vs AAA grading)
- Color contrast test suite (30 tests covering variable resolution, external stylesheets, grading, Tailwind/Bootstrap patterns, real-world design token chains)

### Changed

- Contrast check data object now includes `wcagLevel` on all resolved nodes
- Violation messages updated to reference WCAG AA explicitly and include `requiredRatio`
- Version reported in `testEngine.version` updated to `0.2.0`

## [0.1.1] - 2026-03-26

### Added

- Initial release
- 86 WCAG rules via static HTML analysis — no browser, no DOM
- axe-core compatible `AxeResults` output format
- Rule filtering by WCAG tags or specific rule IDs
- Best-effort color contrast checking from inline styles and `<style>` blocks
- Drop-in replacement for axe-core + JSDOM workflows
