/**
 * Rule engine — runs rules against the parsed tree,
 * collects results in axe-core compatible format.
 */
import { RULE_META } from "./rule-meta.js";
import { getSelector, getOuterHTML } from "./tree.js";
/** Build a NodeResult from a FastNode. */
export function buildNodeResult(node, impact, detail) {
    const any = detail?.any || [];
    const all = detail?.all || [];
    const none = detail?.none || [];
    // Build failure summary
    let failureSummary;
    const failingAny = any.filter((c) => c.message);
    const failingAll = all.filter((c) => c.message);
    const failingNone = none.filter((c) => c.message);
    const parts = [];
    if (failingAny.length > 0) {
        parts.push("Fix any of the following:");
        for (const c of failingAny)
            parts.push(`  ${c.message}`);
    }
    if (failingAll.length > 0) {
        parts.push("Fix all of the following:");
        for (const c of failingAll)
            parts.push(`  ${c.message}`);
    }
    if (failingNone.length > 0) {
        parts.push("Fix all of the following:");
        for (const c of failingNone)
            parts.push(`  Element must not have: ${c.message}`);
    }
    if (parts.length > 0)
        failureSummary = parts.join("\n");
    return {
        html: getOuterHTML(node),
        impact,
        target: [getSelector(node)],
        any,
        all,
        none,
        failureSummary,
    };
}
/** Build a RuleResult from metadata and node results. */
export function buildRuleResult(meta, nodeResults) {
    return {
        id: meta.id,
        impact: nodeResults.length > 0 ? meta.impact : null,
        tags: meta.tags,
        description: meta.description,
        help: meta.help,
        helpUrl: meta.helpUrl,
        nodes: nodeResults,
    };
}
/** Create a simple check result. */
export function makeCheck(id, impact, message, data) {
    return { id, impact, message, data: data ?? null, relatedNodes: [] };
}
/** Run all registered rules and produce categorized results. */
export function runRules(rules, allNodes, options, context) {
    const passes = [];
    const violations = [];
    const incomplete = [];
    const inapplicable = [];
    for (const rule of rules) {
        const meta = RULE_META[rule.ruleId];
        if (!meta)
            continue;
        // Filter by runOnly
        if (options?.runOnly) {
            if (options.runOnly.type === "tag") {
                const hasMatch = meta.tags.some((t) => options.runOnly.values.includes(t));
                if (!hasMatch)
                    continue;
            }
            else if (options.runOnly.type === "rule") {
                if (!options.runOnly.values.includes(rule.ruleId))
                    continue;
            }
        }
        // Filter by rules enable/disable
        if (options?.rules) {
            const ruleConfig = options.rules[rule.ruleId];
            if (ruleConfig && !ruleConfig.enabled)
                continue;
        }
        const result = rule.run(allNodes, allNodes, context);
        // Build node results for violations
        const violationNodes = result.violations.map((n) => buildNodeResult(n, meta.impact, result.checkDetails?.get(n)));
        // Build node results for passes
        const passNodes = result.passes.map((n) => buildNodeResult(n, meta.impact, result.checkDetails?.get(n)));
        // Build node results for incomplete
        const incompleteNodes = (result.incomplete || []).map((n) => buildNodeResult(n, meta.impact, result.checkDetails?.get(n)));
        if (violationNodes.length > 0) {
            violations.push(buildRuleResult(meta, violationNodes));
        }
        if (passNodes.length > 0) {
            passes.push(buildRuleResult(meta, passNodes));
        }
        if (incompleteNodes.length > 0) {
            incomplete.push(buildRuleResult(meta, incompleteNodes));
        }
        // If no nodes matched at all (no violations, passes, or incomplete), it's inapplicable
        if (violationNodes.length === 0 &&
            passNodes.length === 0 &&
            incompleteNodes.length === 0) {
            inapplicable.push(buildRuleResult(meta, []));
        }
    }
    return { passes, violations, incomplete, inapplicable };
}
//# sourceMappingURL=rule-engine.js.map