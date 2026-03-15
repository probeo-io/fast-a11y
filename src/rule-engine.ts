/**
 * Rule engine — runs rules against the parsed tree,
 * collects results in axe-core compatible format.
 */

import type { FastNode } from "./tree.js";
import type { ImpactValue, NodeResult, CheckResult, RuleResult, RunOptions } from "./types.js";
import { RULE_META, type RuleMeta } from "./rule-meta.js";
import { getSelector, getOuterHTML } from "./tree.js";

/** A rule function receives all nodes and returns violations/passes/incomplete. */
export interface RuleCheck {
  ruleId: string;
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult;
}

export interface RuleRunResult {
  violations: FastNode[];
  passes: FastNode[];
  incomplete?: FastNode[];
  /** Per-node check details. Key is the node (by index in violations/passes/incomplete). */
  checkDetails?: Map<FastNode, NodeCheckDetail>;
}

export interface NodeCheckDetail {
  any?: CheckResult[];
  all?: CheckResult[];
  none?: CheckResult[];
}

/** Build a NodeResult from a FastNode. */
export function buildNodeResult(
  node: FastNode,
  impact: ImpactValue,
  detail?: NodeCheckDetail,
): NodeResult {
  const any = detail?.any || [];
  const all = detail?.all || [];
  const none = detail?.none || [];

  // Build failure summary
  let failureSummary: string | undefined;
  const failingAny = any.filter((c) => c.message);
  const failingAll = all.filter((c) => c.message);
  const failingNone = none.filter((c) => c.message);

  const parts: string[] = [];
  if (failingAny.length > 0) {
    parts.push("Fix any of the following:");
    for (const c of failingAny) parts.push(`  ${c.message}`);
  }
  if (failingAll.length > 0) {
    parts.push("Fix all of the following:");
    for (const c of failingAll) parts.push(`  ${c.message}`);
  }
  if (failingNone.length > 0) {
    parts.push("Fix all of the following:");
    for (const c of failingNone) parts.push(`  Element must not have: ${c.message}`);
  }
  if (parts.length > 0) failureSummary = parts.join("\n");

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
export function buildRuleResult(
  meta: RuleMeta,
  nodeResults: NodeResult[],
): RuleResult {
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
export function makeCheck(
  id: string,
  impact: ImpactValue,
  message: string,
  data?: any,
): CheckResult {
  return { id, impact, message, data: data ?? null, relatedNodes: [] };
}

/** Run all registered rules and produce categorized results. */
export function runRules(
  rules: RuleCheck[],
  allNodes: FastNode[],
  options?: RunOptions,
): {
  passes: RuleResult[];
  violations: RuleResult[];
  incomplete: RuleResult[];
  inapplicable: RuleResult[];
} {
  const passes: RuleResult[] = [];
  const violations: RuleResult[] = [];
  const incomplete: RuleResult[] = [];
  const inapplicable: RuleResult[] = [];

  for (const rule of rules) {
    const meta = RULE_META[rule.ruleId];
    if (!meta) continue;

    // Filter by runOnly
    if (options?.runOnly) {
      if (options.runOnly.type === "tag") {
        const hasMatch = meta.tags.some((t) => options.runOnly!.values.includes(t));
        if (!hasMatch) continue;
      } else if (options.runOnly.type === "rule") {
        if (!options.runOnly.values.includes(rule.ruleId)) continue;
      }
    }

    // Filter by rules enable/disable
    if (options?.rules) {
      const ruleConfig = options.rules[rule.ruleId];
      if (ruleConfig && !ruleConfig.enabled) continue;
    }

    const result = rule.run(allNodes, allNodes);

    // Build node results for violations
    const violationNodes = result.violations.map((n) =>
      buildNodeResult(n, meta.impact, result.checkDetails?.get(n))
    );

    // Build node results for passes
    const passNodes = result.passes.map((n) =>
      buildNodeResult(n, meta.impact, result.checkDetails?.get(n))
    );

    // Build node results for incomplete
    const incompleteNodes = (result.incomplete || []).map((n) =>
      buildNodeResult(n, meta.impact, result.checkDetails?.get(n))
    );

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
    if (
      violationNodes.length === 0 &&
      passNodes.length === 0 &&
      incompleteNodes.length === 0
    ) {
      inapplicable.push(buildRuleResult(meta, []));
    }
  }

  return { passes, violations, incomplete, inapplicable };
}
