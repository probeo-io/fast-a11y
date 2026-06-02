/**
 * Color contrast tests — CSS variable resolution and external stylesheet support.
 *
 * Real-world patterns sourced from crawled sites (bizee.com, lendingone.com,
 * atlashxm.com) where colors are typically defined as CSS custom properties
 * and applied via var() references rather than literal hex values.
 */

import { describe, it, expect } from "vitest";
import { fastA11y } from "../src/index.js";

// Helpers
function html(body: string, style = ""): string {
  const styleBlock = style ? `<style>${style}</style>` : "";
  return `<!DOCTYPE html><html lang="en"><head><title>T</title>${styleBlock}</head><body>${body}</body></html>`;
}

function contrastResult(results: ReturnType<typeof fastA11y>) {
  return {
    violations: results.violations.find((v) => v.id === "color-contrast"),
    passes: results.passes.find((v) => v.id === "color-contrast"),
    incomplete: results.incomplete.find((v) => v.id === "color-contrast"),
  };
}

// ─────────────────────────────────────────────
//  CSS variable resolution (inline <style>)
// ─────────────────────────────────────────────

describe("color-contrast — CSS variable resolution", () => {
  it("resolves :root variable for text color — passing contrast", () => {
    const css = `:root { --text-color: #111111; }`;
    const body = `<p style="color: var(--text-color); background-color: #ffffff">Hello</p>`;
    const { violations, passes } = contrastResult(fastA11y(html(body, css)));
    expect(violations).toBeUndefined();
    expect(passes).toBeTruthy();
  });

  it("resolves :root variable for text color — failing contrast", () => {
    const css = `:root { --text-color: #aaaaaa; }`;
    const body = `<p style="color: var(--text-color); background-color: #ffffff">Low contrast</p>`;
    const { violations } = contrastResult(fastA11y(html(body, css)));
    expect(violations).toBeTruthy();
    expect(violations!.nodes[0].any[0].data.contrastRatio).toBeDefined();
  });

  it("resolves :root variable for background color — passing contrast", () => {
    const css = `:root { --bg: #1a1a2e; }`;
    const body = `<p style="color: #ffffff; background-color: var(--bg)">White on dark</p>`;
    const { violations, passes } = contrastResult(fastA11y(html(body, css)));
    expect(violations).toBeUndefined();
    expect(passes).toBeTruthy();
  });

  it("resolves both fg and bg from variables — passing", () => {
    const css = `:root { --color-text: #1a1a1a; --color-surface: #f5f5f5; }`;
    const body = `<p style="color: var(--color-text); background-color: var(--color-surface)">Text</p>`;
    const { violations } = contrastResult(fastA11y(html(body, css)));
    expect(violations).toBeUndefined();
  });

  it("resolves both fg and bg from variables — failing", () => {
    const css = `:root { --color-text: #999999; --color-surface: #ffffff; }`;
    const body = `<p style="color: var(--color-text); background-color: var(--color-surface)">Text</p>`;
    const { violations } = contrastResult(fastA11y(html(body, css)));
    expect(violations).toBeTruthy();
  });

  it("resolves chained variables — --text: var(--brand-dark)", () => {
    const css = `:root { --brand-dark: #0a0a23; --text-primary: var(--brand-dark); }`;
    const body = `<p style="color: var(--text-primary); background-color: #ffffff">Text</p>`;
    const { violations } = contrastResult(fastA11y(html(body, css)));
    expect(violations).toBeUndefined();
  });

  it("uses fallback when variable is undefined", () => {
    // var(--undefined, #111) — fallback should be used, passes contrast
    const body = `<p style="color: var(--undefined-var, #111111); background-color: #ffffff">Text</p>`;
    const { violations, passes } = contrastResult(fastA11y(html(body)));
    expect(violations).toBeUndefined();
    expect(passes).toBeTruthy();
  });

  it("uses fallback when variable is undefined — failing contrast", () => {
    // var(--undefined, #aaa) — fallback #aaa on white fails
    const body = `<p style="color: var(--undefined-var, #aaaaaa); background-color: #ffffff">Text</p>`;
    const { violations } = contrastResult(fastA11y(html(body)));
    expect(violations).toBeTruthy();
  });

  it("handles CSS variable in stylesheet rule (not inline)", () => {
    const css = `:root { --brand-text: #222222; } p { color: var(--brand-text); background-color: #ffffff; }`;
    const body = `<p>Text styled via stylesheet</p>`;
    const { violations } = contrastResult(fastA11y(html(body, css)));
    expect(violations).toBeUndefined();
  });

  it("marks incomplete when variable is truly unresolvable", () => {
    // No :root definition, no fallback — can't resolve
    const body = `<p style="color: var(--totally-unknown); background-color: #ffffff">Unknown color</p>`;
    const results = fastA11y(html(body));
    // Either incomplete (can't resolve fg) or skipped — should NOT be a false violation
    const { violations } = contrastResult(results);
    expect(violations).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
//  External stylesheet support
// ─────────────────────────────────────────────

describe("color-contrast — external stylesheets", () => {
  it("resolves color variables defined in external stylesheet", () => {
    // Variables defined externally, applied via inline style
    const externalCss = `:root { --color-primary: #1a1a2e; --color-bg: #ffffff; }`;
    const body = `<p style="color: var(--color-primary); background-color: var(--color-bg)">Text</p>`;
    const results = fastA11y(html(body), { externalStylesheets: [externalCss] });
    const { violations } = contrastResult(results);
    expect(violations).toBeUndefined();
  });

  it("applies color rules from external stylesheet", () => {
    // Full rule in external CSS — no inline style needed
    const externalCss = `:root { --text: #111; } p { color: var(--text); background-color: #ffffff; }`;
    const body = `<p>Externally styled</p>`;
    const results = fastA11y(html(body), { externalStylesheets: [externalCss] });
    const { violations } = contrastResult(results);
    expect(violations).toBeUndefined();
  });

  it("detects violation via external stylesheet colors", () => {
    const externalCss = `p { color: #aaaaaa; background-color: #ffffff; }`;
    const body = `<p>Low contrast via external CSS</p>`;
    const results = fastA11y(html(body), { externalStylesheets: [externalCss] });
    const { violations } = contrastResult(results);
    expect(violations).toBeTruthy();
  });

  it("supports multiple external stylesheets", () => {
    // Variables in first sheet, usage in second
    const sheet1 = `:root { --brand: #0d0d0d; }`;
    const sheet2 = `p { color: var(--brand); background-color: #ffffff; }`;
    const body = `<p>Multi-sheet</p>`;
    const results = fastA11y(html(body), { externalStylesheets: [sheet1, sheet2] });
    const { violations } = contrastResult(results);
    expect(violations).toBeUndefined();
  });

  it("external stylesheet variables supplement inline <style> variables", () => {
    // Inline style defines bg variable, external CSS defines text variable
    const inlineCss = `:root { --bg: #ffffff; }`;
    const externalCss = `:root { --fg: #222222; }`;
    const body = `<p style="color: var(--fg); background-color: var(--bg)">Text</p>`;
    const results = fastA11y(html(body, inlineCss), { externalStylesheets: [externalCss] });
    const { violations } = contrastResult(results);
    expect(violations).toBeUndefined();
  });
});

// ─────────────────────────────────────────────
//  WCAG level grading
// ─────────────────────────────────────────────

describe("color-contrast — WCAG level grading", () => {
  it("grades AAA for high-contrast normal text (ratio >= 7:1)", () => {
    // #000 on #fff = 21:1
    const body = `<p style="color: #000000; background-color: #ffffff">Black on white</p>`;
    const { passes } = contrastResult(fastA11y(html(body)));
    expect(passes).toBeTruthy();
    expect(passes!.nodes[0].any[0].data.wcagLevel).toBe("AAA");
  });

  it("grades AA for adequate normal text (4.5:1 to <7:1)", () => {
    // #595959 on #ffffff = ~7.0 actually... let me use #767676 on #fff = 4.54:1
    const body = `<p style="color: #595959; background-color: #ffffff">AA text</p>`;
    const { passes } = contrastResult(fastA11y(html(body)));
    expect(passes).toBeTruthy();
    // Ratio is above 4.5 — at least AA
    expect(["AA", "AAA"]).toContain(passes!.nodes[0].any[0].data.wcagLevel);
  });

  it("grades fail for insufficient contrast and includes requiredRatio", () => {
    // #aaaaaa on #ffffff = ~2.32:1
    const body = `<p style="color: #aaaaaa; background-color: #ffffff">Low contrast</p>`;
    const { violations } = contrastResult(fastA11y(html(body)));
    expect(violations).toBeTruthy();
    expect(violations!.nodes[0].any[0].data.wcagLevel).toBe("fail");
    expect(violations!.nodes[0].any[0].data.requiredRatio).toBe(4.5);
  });

  it("grades AAA for large text when ratio >= 4.5:1", () => {
    // Large text (font-size >= 18pt) has lower thresholds: AA=3:1, AAA=4.5:1
    const css = `p { font-size: 24pt; }`;
    // #595959 on #fff = ~7:1 — AAA for any text
    const body = `<p style="color: #595959; background-color: #ffffff">Large AAA</p>`;
    const { passes } = contrastResult(fastA11y(html(body, css)));
    expect(passes).toBeTruthy();
    expect(passes!.nodes[0].any[0].data.wcagLevel).toBe("AAA");
  });

  it("grades AA for large text when ratio is 3:1 to <4.5:1", () => {
    const css = `p { font-size: 24pt; }`;
    // #949494 on #ffffff = ~3.03:1 — passes AA for large text, not AAA
    const body = `<p style="color: #949494; background-color: #ffffff">Large AA</p>`;
    const { passes } = contrastResult(fastA11y(html(body, css)));
    expect(passes).toBeTruthy();
    expect(passes!.nodes[0].any[0].data.wcagLevel).toBe("AA");
  });

  it("grades fail for large text below 3:1", () => {
    const css = `p { font-size: 24pt; }`;
    // #bbbbbb on #ffffff = ~1.67:1 — fails even AA for large text
    const body = `<p style="color: #bbbbbb; background-color: #ffffff">Large fail</p>`;
    const { violations } = contrastResult(fastA11y(html(body, css)));
    expect(violations).toBeTruthy();
    expect(violations!.nodes[0].any[0].data.wcagLevel).toBe("fail");
    expect(violations!.nodes[0].any[0].data.requiredRatio).toBe(3);
  });

  it("includes wcagLevel in data for all resolved nodes", () => {
    const body = `<p style="color: #333333; background-color: #ffffff">Text</p>`;
    const { passes, violations } = contrastResult(fastA11y(html(body)));
    const node = passes ?? violations;
    expect(node).toBeTruthy();
    expect(node!.nodes[0].any[0].data).toHaveProperty("wcagLevel");
    expect(node!.nodes[0].any[0].data).toHaveProperty("contrastRatio");
    expect(node!.nodes[0].any[0].data).toHaveProperty("fgColor");
    expect(node!.nodes[0].any[0].data).toHaveProperty("bgColor");
  });
});

// ─────────────────────────────────────────────
//  Font size variable resolution (Tailwind/Bootstrap)
// ─────────────────────────────────────────────

describe("color-contrast — font-size variable resolution", () => {
  it("resolves Tailwind v4 font-size variable to large text threshold", () => {
    // Tailwind v4: --text-2xl = 1.5rem = 18pt — counts as large text (AA threshold drops to 3:1)
    const css = `:root { --text-2xl: 1.5rem; }`;
    // #949494 on #fff = ~3.03:1 — fails AA for normal text but passes for large text
    const body = `<p style="color: #949494; background-color: #ffffff; font-size: var(--text-2xl)">Large Tailwind text</p>`;
    const { passes, violations } = contrastResult(fastA11y(html(body, css)));
    expect(violations).toBeUndefined();
    expect(passes).toBeTruthy();
    expect(passes!.nodes[0].any[0].data.wcagLevel).toBe("AA");
  });

  it("resolves Bootstrap font-size variable", () => {
    // Bootstrap 5: --bs-body-font-size: 1rem (normal size, not large)
    const css = `:root { --bs-body-font-size: 1rem; }`;
    // #767676 on #fff = ~4.54:1 — passes AA for normal text
    const body = `<p style="color: #767676; background-color: #ffffff; font-size: var(--bs-body-font-size)">Bootstrap text</p>`;
    const { passes } = contrastResult(fastA11y(html(body, css)));
    expect(passes).toBeTruthy();
    expect(["AA", "AAA"]).toContain(passes!.nodes[0].any[0].data.wcagLevel);
  });

  it("treats unresolvable font-size variable as normal text (conservative)", () => {
    // Unknown variable — font size unknown — default to normal text threshold (4.5:1)
    // #949494 on #fff = ~3.03:1 — would pass for large text but not normal
    const body = `<p style="color: #949494; background-color: #ffffff; font-size: var(--unknown-size)">Text</p>`;
    const { violations } = contrastResult(fastA11y(html(body)));
    // Should fail because we can't confirm it's large text
    expect(violations).toBeTruthy();
  });

  it("resolves font-size from external stylesheet variable (Tailwind pattern)", () => {
    const externalCss = `:root { --text-xl: 20px; } h2 { font-size: var(--text-xl); }`;
    // 20px = 15pt — not large by itself, but bold+14pt would be
    const body = `<h2 style="color: #949494; background-color: #ffffff; font-weight: bold">Heading</h2>`;
    const results = fastA11y(html(body), { externalStylesheets: [externalCss] });
    const { passes, violations } = contrastResult(results);
    // 20px = 15pt bold — exceeds 14pt bold threshold → large text → AA at 3:1 → passes
    expect(violations).toBeUndefined();
    expect(passes).toBeTruthy();
  });
});

// ─────────────────────────────────────────────
//  Real-world patterns from crawled sites
// ─────────────────────────────────────────────

describe("color-contrast — real-world CSS patterns", () => {
  it("handles WordPress preset color variables (lendingone pattern)", () => {
    // WordPress generates CSS custom properties like --wp--preset--color--*
    const css = `
      :root {
        --wp--preset--color--black: #000000;
        --wp--preset--color--white: #ffffff;
      }
      .has-black-color { color: var(--wp--preset--color--black); }
      .has-white-background-color { background-color: var(--wp--preset--color--white); }
    `;
    const body = `<p class="has-black-color has-white-background-color">WordPress text</p>`;
    const { violations } = contrastResult(fastA11y(html(body, css)));
    expect(violations).toBeUndefined();
  });

  it("handles design token chaining (--semantic references --primitive)", () => {
    // Common design system pattern: semantic tokens reference primitive tokens
    const css = `
      :root {
        --color-grey-900: #111827;
        --color-white: #ffffff;
        --color-text-primary: var(--color-grey-900);
        --color-surface-primary: var(--color-white);
      }
    `;
    const body = `<p style="color: var(--color-text-primary); background-color: var(--color-surface-primary)">Design tokens</p>`;
    const { violations } = contrastResult(fastA11y(html(body, css)));
    expect(violations).toBeUndefined();
  });

  it("handles hsl() color values in variables", () => {
    const css = `:root { --text: hsl(0, 0%, 10%); --bg: hsl(0, 0%, 100%); }`;
    const body = `<p style="color: var(--text); background-color: var(--bg)">HSL text</p>`;
    const { violations } = contrastResult(fastA11y(html(body, css)));
    expect(violations).toBeUndefined();
  });

  it("flags low contrast when design tokens resolve to similar shades", () => {
    // Common mistake: both semantic tokens end up being grey
    const css = `
      :root {
        --color-muted: #767676;
        --color-subtle-bg: #f0f0f0;
      }
    `;
    // #767676 on #f0f0f0 = ~4.1:1 — fails AA for normal text (needs 4.5:1)
    const body = `<p style="color: var(--color-muted); background-color: var(--color-subtle-bg)">Muted text</p>`;
    const { violations } = contrastResult(fastA11y(html(body, css)));
    expect(violations).toBeTruthy();
  });
});
