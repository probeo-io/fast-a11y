# Changelog

All notable changes to this project will be documented in this file.

## [0.2.1] - 2026-10-17

### Fixed

- Scope implicit header/footer landmarks to their sectioning context and require an author-provided accessible name for form landmarks.
- Use author labels or title rather than control text when comparing form landmark names.
- Recognize native single-select option ownership without permitting ARIA options inside arbitrary comboboxes.
- Tag autocomplete-valid as WCAG 2.1 AA and correct landmark-unique help/description ordering.
- Require captions rather than subtitles for video-caption passes and accept case-insensitive track kinds. Missing captions remain manual-review results in `incomplete`.

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
