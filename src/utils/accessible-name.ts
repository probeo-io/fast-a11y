/**
 * Simplified Accessible Name Computation.
 * Follows the W3C Accessible Name and Description Computation algorithm,
 * simplified for static HTML analysis.
 *
 * Priority: aria-labelledby > aria-label > native label > alt/title > text content
 */

import type { FastNode } from "../tree.js";
import { findById, getNodeText, getTextContent } from "../tree.js";

/**
 * Compute the accessible name for a node.
 * Returns empty string if no accessible name can be determined.
 */
export function getAccessibleName(node: FastNode, allNodes: FastNode[]): string {
  // 1. aria-labelledby — resolve referenced IDs, concatenate
  const labelledBy = node.attrs["aria-labelledby"];
  if (labelledBy) {
    const ids = labelledBy.trim().split(/\s+/);
    const parts: string[] = [];
    for (const id of ids) {
      const referenced = findById(allNodes, id);
      if (referenced) {
        parts.push(getNodeText(referenced));
      }
    }
    const result = parts.join(" ").trim();
    if (result) return result;
  }

  // 2. aria-label
  const ariaLabel = node.attrs["aria-label"];
  if (ariaLabel && ariaLabel.trim()) return ariaLabel.trim();

  // 3. Native labelling mechanisms
  const nativeName = getNativeName(node, allNodes);
  if (nativeName) return nativeName;

  // 4. title attribute (last resort)
  const title = node.attrs.title;
  if (title && title.trim()) return title.trim();

  return "";
}

/** Get name from native HTML labelling mechanisms. */
function getNativeName(node: FastNode, allNodes: FastNode[]): string {
  const tag = node.tag;

  // <img>, <input type="image"> — alt attribute
  if (tag === "img" || (tag === "input" && node.attrs.type === "image")) {
    const alt = node.attrs.alt;
    if (alt !== undefined) return alt.trim();
  }

  // <input>, <select>, <textarea> — associated <label>
  if (tag === "input" || tag === "select" || tag === "textarea") {
    const id = node.attrs.id;
    if (id) {
      // Find <label for="id">
      const label = allNodes.find(
        (n) => n.tag === "label" && n.attrs.for === id
      );
      if (label) {
        const text = getNodeText(label);
        if (text) return text;
      }
    }

    // Check if wrapped in <label>
    let parent = node.parent;
    while (parent) {
      if (parent.tag === "label") {
        const text = getLabelTextExcludingInput(parent, node);
        if (text) return text;
      }
      parent = parent.parent;
    }

    // <input> value for buttons
    if (tag === "input") {
      const type = (node.attrs.type || "").toLowerCase();
      if (type === "submit") return node.attrs.value || "Submit";
      if (type === "reset") return node.attrs.value || "Reset";
      if (type === "button") return node.attrs.value || "";
      if (type === "image") return node.attrs.alt || node.attrs.value || "";
    }

    // Placeholder as last resort (not a proper accessible name, but commonly used)
    const placeholder = node.attrs.placeholder;
    if (placeholder) return placeholder.trim();

    return "";
  }

  // <fieldset> — <legend>
  if (tag === "fieldset") {
    const legend = node.children.find((c) => c.tag === "legend");
    if (legend) return getNodeText(legend);
  }

  // <table> — <caption>
  if (tag === "table") {
    const caption = node.children.find((c) => c.tag === "caption");
    if (caption) return getNodeText(caption);
  }

  // <figure> — <figcaption>
  if (tag === "figure") {
    const figcaption = node.children.find((c) => c.tag === "figcaption");
    if (figcaption) return getNodeText(figcaption);
  }

  // <a>, <button>, headings, etc. — text content (including alt text from child images)
  if (tag === "a" || tag === "button" || /^h[1-6]$/.test(tag) || tag === "summary" || tag === "legend" || tag === "caption" || tag === "option") {
    return getAccessibleText(node, allNodes);
  }

  // Generic: text content
  const text = getNodeText(node);
  if (text) return text;

  return "";
}

/**
 * Get accessible text content, including alt text from child images.
 * This is different from plain textContent — it resolves image alt text.
 */
export function getAccessibleText(node: FastNode, allNodes: FastNode[]): string {
  const parts: string[] = [];

  for (const child of node.childNodes) {
    if ((child as any).type === "text") {
      parts.push((child as any).data);
    } else if ((child as any).type === "tag") {
      const el = child as any;
      const tag = el.tagName?.toLowerCase();

      if (tag === "img") {
        const alt = el.attribs?.alt;
        if (alt) parts.push(alt);
      } else if (tag === "svg") {
        // Check for <title> child in SVG
        const svgTitle = (el.childNodes || []).find(
          (c: any) => c.type === "tag" && c.tagName?.toLowerCase() === "title"
        );
        if (svgTitle) {
          parts.push(getTextContent(svgTitle));
        }
      } else {
        // Find the FastNode for this element
        const fastChild = allNodes.find((n) => n.raw === el);
        if (fastChild) {
          parts.push(getAccessibleText(fastChild, allNodes));
        } else {
          parts.push(getTextContent(el));
        }
      }
    }
  }

  return parts.join("").trim();
}

/** Get label text excluding the input element's own text. */
function getLabelTextExcludingInput(label: FastNode, input: FastNode): string {
  const parts: string[] = [];

  function walk(node: FastNode) {
    for (const child of node.childNodes) {
      if ((child as any).type === "text") {
        parts.push((child as any).data);
      } else if ((child as any).type === "tag") {
        const childFast = node.children.find((c) => c.raw === child);
        if (childFast && childFast !== input) {
          walk(childFast);
        }
      }
    }
  }

  walk(label);
  return parts.join("").trim();
}
