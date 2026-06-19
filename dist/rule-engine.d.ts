/**
 * Rule engine — runs rules against the parsed tree,
 * collects results in axe-core compatible format.
 */
import type { FastNode } from "./tree.js";
import type { ImpactValue, NodeResult, CheckResult, RuleResult, RunOptions } from "./types.js";
import { type RuleMeta } from "./rule-meta.js";
/** Optional context passed to rules — carries data that rules may need beyond the HTML tree. */
export interface RuleContext {
    /** Pre-fetched external stylesheet contents. The caller is responsible for fetching them. */
    externalStylesheets?: string[];
}
/** A rule function receives all nodes and returns violations/passes/incomplete. */
export interface RuleCheck {
    ruleId: string;
    run(nodes: FastNode[], allNodes: FastNode[], context?: RuleContext): RuleRunResult;
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
export declare function buildNodeResult(node: FastNode, impact: ImpactValue, detail?: NodeCheckDetail): NodeResult;
/** Build a RuleResult from metadata and node results. */
export declare function buildRuleResult(meta: RuleMeta, nodeResults: NodeResult[]): RuleResult;
/** Create a simple check result. */
export declare function makeCheck(id: string, impact: ImpactValue, message: string, data?: any): CheckResult;
/** Run all registered rules and produce categorized results. */
export declare function runRules(rules: RuleCheck[], allNodes: FastNode[], options?: RunOptions, context?: RuleContext): {
    passes: RuleResult[];
    violations: RuleResult[];
    incomplete: RuleResult[];
    inapplicable: RuleResult[];
};
//# sourceMappingURL=rule-engine.d.ts.map