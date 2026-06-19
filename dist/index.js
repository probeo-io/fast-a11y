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
const VERSION = "0.2.0";
/**
 * Run accessibility checks on raw HTML.
 * Returns axe-core compatible AxeResults.
 */
export function fastA11y(html, options) {
    const doc = parse(html);
    const allNodes = buildTree(doc);
    const rules = getAllRules();
    const context = { externalStylesheets: options?.externalStylesheets };
    const { passes, violations, incomplete, inapplicable } = runRules(rules, allNodes, options, context);
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
//# sourceMappingURL=index.js.map