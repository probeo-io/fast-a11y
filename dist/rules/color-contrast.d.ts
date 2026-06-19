/**
 * Color contrast rule: best-effort static analysis.
 *
 * Parses inline styles and <style> blocks to determine foreground/background
 * colors, then computes WCAG contrast ratios. Unresolvable colors go to
 * incomplete[] rather than violations.
 */
import type { RuleCheck } from "../rule-engine.js";
export declare const colorContrastRules: RuleCheck[];
//# sourceMappingURL=color-contrast.d.ts.map