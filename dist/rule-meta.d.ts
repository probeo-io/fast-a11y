/**
 * Axe-core compatible rule metadata.
 * Each rule has its ID, tags, description, help text, and help URL
 * matching axe-core's output exactly.
 */
import type { ImpactValue } from "./types.js";
export interface RuleMeta {
    id: string;
    tags: string[];
    description: string;
    help: string;
    helpUrl: string;
    impact: ImpactValue;
}
export declare const RULE_META: Record<string, RuleMeta>;
//# sourceMappingURL=rule-meta.d.ts.map