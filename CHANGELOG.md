# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

### Added

- Exhaustive test suite (141 tests across 14 categories: images, links, headings, forms, ARIA, tables, language, semantic, media, navigation, landmarks, color contrast, rule filtering, edge cases)
- "See Also" cross-links to related packages

## [0.1.1] - 2026-03-26

### Added

- Initial release
- 86 WCAG rules via static HTML analysis — no browser, no DOM
- axe-core compatible `AxeResults` output format
- Rule filtering by WCAG tags or specific rule IDs
- Best-effort color contrast checking from inline styles and `<style>` blocks
- Drop-in replacement for axe-core + JSDOM workflows
