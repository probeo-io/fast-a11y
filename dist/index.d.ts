/**
 * fast-a11y — Fast, zero-DOM accessibility checker with axe-core compatible output.
 *
 * Usage:
 *   import { fastA11y } from "fast-a11y";
 *   const results = fastA11y(html, { runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] } });
 */
import type { AxeResults, RunOptions } from "./types.js";
export type { AxeResults, RunOptions, ImpactValue, RuleResult, NodeResult, CheckResult, RelatedNode } from "./types.js";
export interface FastA11yOptions extends RunOptions {
    /** URL of the page being tested (included in output). */
    url?: string;
    /**
     * Pre-fetched external stylesheet contents for improved color contrast analysis.
     * The caller fetches <link rel="stylesheet"> URLs; fast-a11y stays zero-network.
     */
    externalStylesheets?: string[];
}
/**
 * Run accessibility checks on raw HTML.
 * Returns axe-core compatible AxeResults.
 */
export declare function fastA11y(html: string, options?: FastA11yOptions): AxeResults;
export default fastA11y;
//# sourceMappingURL=index.d.ts.map