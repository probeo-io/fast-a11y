/**
 * Basic usage examples for fast-a11y
 *
 * Run with:
 *   npx tsx examples/basic.ts
 */

import { fastA11y } from "../src/index.js";

// ── Check a page for violations ──────────────────────────────────────────────

function checkPage() {
  console.log("=== Check Page for Violations ===\n");

  const html = `<!DOCTYPE html>
<html>
<head><title>Test Page</title></head>
<body>
  <img src="hero.jpg">
  <a href="/about"></a>
  <input type="text">
  <button></button>
</body>
</html>`;

  const results = fastA11y(html);

  console.log(`Violations: ${results.violations.length}`);
  console.log(`Passes: ${results.passes.length}`);
  console.log(`Incomplete: ${results.incomplete.length}\n`);

  for (const v of results.violations) {
    console.log(`  [${v.impact}] ${v.id}: ${v.description}`);
    console.log(`  Nodes: ${v.nodes.length}\n`);
  }
}

// ── Check a clean page ───────────────────────────────────────────────────────

function checkCleanPage() {
  console.log("=== Clean Page ===\n");

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <title>Accessible Page</title>
</head>
<body>
  <main>
    <h1>Welcome</h1>
    <img src="photo.jpg" alt="A sunset over the ocean">
    <a href="/about">About us</a>
    <button>Submit</button>
    <label for="name">Name</label>
    <input id="name" type="text">
  </main>
</body>
</html>`;

  const results = fastA11y(html);

  console.log(`Violations: ${results.violations.length}`);
  console.log(`Passes: ${results.passes.length}`);
  if (results.violations.length === 0) {
    console.log("No accessibility violations found.");
  }
  console.log();
}

// ── Filter by impact level ───────────────────────────────────────────────────

function filterByImpact() {
  console.log("=== Filter Critical Only ===\n");

  const html = `<!DOCTYPE html>
<html>
<body>
  <img src="a.jpg">
  <img src="b.jpg" alt="">
  <a href="/x"></a>
</body>
</html>`;

  const results = fastA11y(html);

  const critical = results.violations.filter(v => v.impact === "critical");
  const serious = results.violations.filter(v => v.impact === "serious");

  console.log(`Critical: ${critical.length}`);
  for (const v of critical) {
    console.log(`  ${v.id}: ${v.nodes.length} instances`);
  }
  console.log(`Serious: ${serious.length}`);
  for (const v of serious) {
    console.log(`  ${v.id}: ${v.nodes.length} instances`);
  }
  console.log();
}

// ── Run examples ─────────────────────────────────────────────────────────────

const example = process.argv[2];

const examples: Record<string, () => void> = {
  check: checkPage,
  clean: checkCleanPage,
  filter: filterByImpact,
};

if (example && examples[example]) {
  examples[example]();
} else if (!example) {
  for (const fn of Object.values(examples)) {
    fn();
  }
} else {
  console.log(`Unknown example: ${example}`);
  console.log(`Available: ${Object.keys(examples).join(", ")}`);
}
