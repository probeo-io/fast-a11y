# fast-a11y

Zero-DOM accessibility checker with axe-core compatible output.

## Build & Test

```bash
npm run build    # TypeScript compile to dist/
npm test         # vitest
```

## Architecture

- `src/index.ts` — Main entry: `fastA11y(html, options?)` returns `AxeResults`
- `src/tree.ts` — HTML parser (htmlparser2) and lightweight DOM tree walker
- `src/types.ts` — Axe-core compatible output types (AxeResults, RuleResult, NodeResult, etc.)
- `src/rule-engine.ts` — Rule runner, result builder, check/node/rule result construction
- `src/rule-meta.ts` — Metadata for all 86 rules (tags, description, help, helpUrl, impact)
- `src/utils/accessible-name.ts` — Simplified W3C Accessible Name Computation
- `src/rules/` — Rule implementations split by category:
  - `text-alternatives.ts` — image-alt, input-image-alt, object-alt, etc.
  - `language.ts` — html-has-lang, html-lang-valid, etc.
  - `structure.ts` — document-title, heading-order, duplicate-id, nested-interactive, etc.
  - `forms.ts` — label, button-name, select-name, autocomplete-valid, etc.
  - `aria.ts` — 25 ARIA rules with full lookup tables
  - `navigation.ts` — link-name, frame-title, bypass, tabindex, etc.
  - `media.ts` — meta-viewport, blink, marquee, video-caption, etc.
  - `tables.ts` — td-headers-attr, th-has-data-cells, scope-attr-valid, etc.
  - `landmarks.ts` — landmark-one-main, landmark-*-is-top-level, etc.
  - `color-contrast.ts` — Best-effort contrast checking via inline/style block parsing
  - `index.ts` — `getAllRules()` combines all rule files

## Key Design Decisions

- Output format MUST match axe-core's AxeResults exactly — this is a drop-in replacement
- Rules skip hidden elements using `isHiddenOrAncestorHidden()`
- Color contrast puts unresolvable colors in `incomplete[]`, not `violations[]`
- ~9 rules that truly need a rendered DOM are not implemented (color-contrast is best-effort)
- Package is scoped as `@probeo/fast-a11y`
- ESM-only, TypeScript with declarations

## Adding a New Rule

1. Add metadata to `src/rule-meta.ts` using the `meta()` helper
2. Implement `RuleCheck` in the appropriate `src/rules/*.ts` file
3. Add it to the exported array in that file
4. The rule is automatically picked up by `getAllRules()`
