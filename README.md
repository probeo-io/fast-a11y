# fast-a11y

Fast, zero-DOM accessibility checker with **axe-core compatible output**. Runs on raw HTML using static analysis — no browser, no JSDOM, no Puppeteer.

## Why?

axe-core is the gold standard for accessibility testing, but it requires a full DOM environment (JSDOM or a real browser). For crawlers, CI pipelines, and build tools processing thousands of pages, that's a memory and performance bottleneck.

**fast-a11y** implements 86 WCAG rules using only an HTML parser. It returns the exact same output format as axe-core, so it's a drop-in replacement.

| | axe-core + JSDOM | fast-a11y |
|---|---|---|
| 1000 elements | ~200-500MB, ~2-5s | ~5MB, ~30ms |
| Requires browser/DOM | Yes | No |
| Output format | AxeResults | AxeResults (identical) |
| WCAG rules | ~95 | 86 |

## Install

```bash
npm install fast-a11y
```

## Usage

```typescript
import { fastA11y } from "fast-a11y";

const html = `<!DOCTYPE html>
<html lang="en">
<head><title>My Page</title></head>
<body>
  <img src="photo.jpg">
  <a href="/page"></a>
</body>
</html>`;

const results = fastA11y(html);

console.log(results.violations);
// [
//   { id: "image-alt", impact: "critical", nodes: [...] },
//   { id: "link-name", impact: "serious", nodes: [...] },
// ]
```

## Options

```typescript
const results = fastA11y(html, {
  // Filter by WCAG tags (same as axe-core)
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },

  // Or filter by specific rules
  runOnly: { type: "rule", values: ["image-alt", "link-name"] },

  // Disable specific rules
  rules: { "color-contrast": { enabled: false } },

  // Include URL in output
  url: "https://example.com/page",
});
```

## Output Format

The output is **identical** to axe-core's `AxeResults`:

```typescript
interface AxeResults {
  testEngine: { name: "fast-a11y", version: string };
  testRunner: { name: "fast-a11y" };
  testEnvironment: { userAgent: string, windowWidth: number, windowHeight: number };
  url: string;
  timestamp: string;
  toolOptions: object;
  passes: RuleResult[];
  violations: RuleResult[];
  incomplete: RuleResult[];
  inapplicable: RuleResult[];
}
```

Each `RuleResult` contains `id`, `impact`, `tags`, `description`, `help`, `helpUrl`, and `nodes[]` — exactly matching axe-core.

## Rules Covered (86)

### Text Alternatives
`image-alt`, `input-image-alt`, `object-alt`, `role-img-alt`, `svg-img-alt`, `area-alt`, `server-side-image-map`

### Language
`html-has-lang`, `html-lang-valid`, `html-xml-lang-mismatch`, `valid-lang`

### Structure
`document-title`, `definition-list`, `dlitem`, `list`, `listitem`, `heading-order`, `empty-heading`, `empty-table-header`, `duplicate-id`, `duplicate-id-aria`, `nested-interactive`, `page-has-heading-one`

### Forms
`label`, `select-name`, `input-button-name`, `button-name`, `form-field-multiple-labels`, `autocomplete-valid`, `label-title-only`

### ARIA (25 rules)
`aria-allowed-attr`, `aria-allowed-role`, `aria-hidden-body`, `aria-hidden-focus`, `aria-required-attr`, `aria-required-children`, `aria-required-parent`, `aria-roles`, `aria-valid-attr`, `aria-valid-attr-value`, `aria-roledescription`, `aria-input-field-name`, `aria-toggle-field-name`, `aria-command-name`, `aria-meter-name`, `aria-progressbar-name`, `aria-tooltip-name`, `aria-treeitem-name`, `aria-dialog-name`, `aria-text`, `aria-deprecated-role`, `aria-prohibited-attr`, `aria-braille-equivalent`, `aria-conditional-attr`, `presentation-role-conflict`

### Navigation
`link-name`, `frame-title`, `frame-title-unique`, `bypass`, `tabindex`, `accesskeys`, `region`

### Media & Time
`blink`, `marquee`, `meta-refresh`, `meta-refresh-no-exceptions`, `meta-viewport`, `meta-viewport-large`, `no-autoplay-audio`, `video-caption`

### Tables
`td-headers-attr`, `th-has-data-cells`, `td-has-header`, `table-duplicate-name`, `table-fake-caption`, `scope-attr-valid`

### Landmarks
`landmark-one-main`, `landmark-no-duplicate-main`, `landmark-no-duplicate-banner`, `landmark-no-duplicate-contentinfo`, `landmark-banner-is-top-level`, `landmark-contentinfo-is-top-level`, `landmark-complementary-is-top-level`, `landmark-main-is-top-level`, `landmark-unique`

### Color Contrast (best-effort)
`color-contrast` — Checks inline styles and `<style>` blocks. Colors that can't be resolved statically (external CSS, var(), background images) are reported as `incomplete` rather than violations.

## Rules NOT Covered (~9)

These rules fundamentally require a rendered DOM:

- `target-size` — requires `getBoundingClientRect()`
- `link-in-text-block` — requires computed styles
- `css-orientation-lock` — requires CSS media query analysis
- `p-as-heading` — requires computed font styling
- `scrollable-region-focusable` — requires overflow computation
- `focus-order-semantics` — requires tab order computation
- `hidden-content` — requires full visibility computation
- `label-content-name-mismatch` — requires rendered visible text
- `frame-tested` — runtime axe concept

## Replacing axe-core

If you're currently using axe-core with JSDOM:

```typescript
// Before (axe-core + JSDOM)
import { JSDOM } from "jsdom";
import axe from "axe-core";

const dom = new JSDOM(html, { runScripts: "outside-only" });
dom.window.eval(axe.source);
const results = await dom.window.axe.run(dom.window.document, {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
});

// After (fast-a11y)
import { fastA11y } from "fast-a11y";

const results = fastA11y(html, {
  runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
});
```

Same output format. No async. No DOM. 100x less memory.

## See Also

| Package | Description |
|---|---|
| [fast-a11y-py](https://github.com/probeo-io/fast-a11y-py) | Python version of this package |
| [@probeo/workflow](https://github.com/probeo-io/workflow) | Stage-based pipeline engine -- use fast-a11y as a step |

## License

MIT
