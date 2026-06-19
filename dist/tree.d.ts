/**
 * Lightweight DOM tree built from htmlparser2 output.
 * Provides parent/child traversal, attribute access, text extraction,
 * CSS selector generation, and outerHTML snippets.
 */
import type { Document, Element, Node, Text, ChildNode } from "domhandler";
export type { Document, Element, Node, Text, ChildNode };
export interface FastNode {
    /** Original domhandler node */
    raw: Element;
    /** Tag name (lowercase) */
    tag: string;
    /** Attributes map */
    attrs: Record<string, string>;
    /** Parent FastNode, null for root elements */
    parent: FastNode | null;
    /** Child FastNodes (element children only) */
    children: FastNode[];
    /** All child nodes including text */
    childNodes: ChildNode[];
    /** Depth in tree (0 = root) */
    depth: number;
}
/** Parse HTML string into a domhandler Document. */
export declare function parse(html: string): Document;
/** Build a flat list of FastNodes from a Document for easy iteration. */
export declare function buildTree(doc: Document): FastNode[];
/** Get text content of an element (recursive, like textContent). */
export declare function getTextContent(node: FastNode | Element | ChildNode): string;
/** Get text content from a FastNode. */
export declare function getNodeText(node: FastNode): string;
/** Generate a CSS selector path for a node (for axe-compatible target[]). */
export declare function getSelector(node: FastNode): string;
/** Generate an outerHTML snippet for a node (truncated for readability). */
export declare function getOuterHTML(node: FastNode, maxLength?: number): string;
/** Find all nodes matching a tag name. */
export declare function findByTag(nodes: FastNode[], tag: string): FastNode[];
/** Find all nodes matching a CSS selector (simple: tag, #id, .class, [attr]). */
export declare function querySelectorAll(nodes: FastNode[], selector: string): FastNode[];
/** Find a node by ID. */
export declare function findById(nodes: FastNode[], id: string): FastNode | undefined;
/** Check if a node has a specific role (explicit or implicit). */
export declare function getRole(node: FastNode): string | undefined;
/** Check if a node is focusable. */
export declare function isFocusable(node: FastNode): boolean;
/** Check if a node is interactive. */
export declare function isInteractive(node: FastNode): boolean;
/** Check if a node is hidden via static analysis. */
export declare function isHidden(node: FastNode): boolean;
/** Check if a node or any ancestor is hidden. */
export declare function isHiddenOrAncestorHidden(node: FastNode): boolean;
//# sourceMappingURL=tree.d.ts.map