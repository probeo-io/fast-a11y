/**
 * fast-a11y — Fast, zero-DOM accessibility checker with axe-core compatible output.
 *
 * Usage:
 *   import { fastA11y } from "fast-a11y";
 *   const results = fastA11y(html, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
 */

import { parse, buildTree } from "./tree.js";
import { runRules } from "./rule-engine.js";
import { getAllRules } from "./rules/index.js";
import type { AxeResults, RunOptions } from "./types.js";

export type { AxeResults, RunOptions, ImpactValue, RuleResult, NodeResult, CheckResult, RelatedNode } from "./types.js";

const VERSION = "0.1.0";

export interface FastA11yOptions extends RunOptions {
  /** URL of the page being tested (included in output). */
  url?: string;
}

/**
 * Run accessibility checks on raw HTML.
 * Returns axe-core compatible AxeResults.
 */
export function fastA11y(html: string, options?: FastA11yOptions): AxeResults {
  const doc = parse(html);
  const allNodes = buildTree(doc);
  const rules = getAllRules();

  const { passes, violations, incomplete, inapplicable } = runRules(
    rules,
    allNodes,
    options,
  );

  return {
    testEngine: { name: "fast-a11y", version: VERSION },
    testRunner: { name: "fast-a11y" },
    testEnvironment: {
      userAgent: "",
      windowWidth: 0,
      windowHeight: 0,
    },
    url: options?.url || "",
    timestamp: new Date().toISOString(),
    toolOptions: options ? { ...options } : {},
    passes,
    violations,
    incomplete,
    inapplicable,
  };
}

export default fastA11y;
