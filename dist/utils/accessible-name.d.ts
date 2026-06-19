/**
 * Simplified Accessible Name Computation.
 * Follows the W3C Accessible Name and Description Computation algorithm,
 * simplified for static HTML analysis.
 *
 * Priority: aria-labelledby > aria-label > native label > alt/title > text content
 */
import type { FastNode } from "../tree.js";
/**
 * Compute the accessible name for a node.
 * Returns empty string if no accessible name can be determined.
 */
export declare function getAccessibleName(node: FastNode, allNodes: FastNode[]): string;
/**
 * Get accessible text content, including alt text from child images.
 * This is different from plain textContent — it resolves image alt text.
 */
export declare function getAccessibleText(node: FastNode, allNodes: FastNode[]): string;
//# sourceMappingURL=accessible-name.d.ts.map