/**
 * Navigation rules: link-name, frame-title, frame-title-unique,
 * bypass, tabindex, accesskeys, region
 */

import type { FastNode } from "../tree.js";
import type { RuleCheck, RuleRunResult, NodeCheckDetail } from "../rule-engine.js";
import { makeCheck } from "../rule-engine.js";
import {
  isHiddenOrAncestorHidden, findByTag, getRole,
} from "../tree.js";
import { getAccessibleName } from "../utils/accessible-name.js";

/** Landmark roles. */
const LANDMARK_ROLES = new Set([
  "banner", "complementary", "contentinfo", "form", "main",
  "navigation", "region", "search",
]);

/* ------------------------------------------------------------------ */
/*  link-name                                                          */
/* ------------------------------------------------------------------ */
const linkName: RuleCheck = {
  ruleId: "link-name",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;

      // Match <a href>, <area href>, and elements with role="link"
      const isLink =
        (node.tag === "a" && node.attrs.href !== undefined) ||
        node.attrs.role === "link";
      if (!isLink) continue;

      const name = getAccessibleName(node, allNodes);
      if (name) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("link-name", "serious", "Element has discernible text")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("link-name", "serious",
            "Element does not have discernible text")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  frame-title                                                        */
/* ------------------------------------------------------------------ */
const frameTitle: RuleCheck = {
  ruleId: "frame-title",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (node.tag !== "iframe" && node.tag !== "frame") continue;
      if (isHiddenOrAncestorHidden(node)) continue;

      // Skip hidden iframes (aria-hidden or role="presentation")
      const role = node.attrs.role;
      if (role === "none" || role === "presentation") continue;

      const title = node.attrs.title;
      if (title && title.trim()) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("frame-title", "serious",
            "Element has a title attribute: \"" + title.trim() + "\"")],
        });
      } else {
        // Also check aria-label and aria-labelledby
        const hasAriaLabel = !!(node.attrs["aria-label"] && node.attrs["aria-label"].trim());
        const hasAriaLabelledby = !!(node.attrs["aria-labelledby"] && node.attrs["aria-labelledby"].trim());

        if (hasAriaLabel || hasAriaLabelledby) {
          passes.push(node);
          checkDetails.set(node, {
            any: [makeCheck("frame-title", "serious",
              "Element has an accessible name via ARIA")],
          });
        } else {
          violations.push(node);
          checkDetails.set(node, {
            any: [makeCheck("frame-title", "serious",
              "Element does not have an accessible name")],
          });
        }
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  frame-title-unique                                                 */
/* ------------------------------------------------------------------ */
const frameTitleUnique: RuleCheck = {
  ruleId: "frame-title-unique",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    const frames = nodes.filter(
      (n) => (n.tag === "iframe" || n.tag === "frame") && !isHiddenOrAncestorHidden(n)
    );

    // Group by title
    const titleMap = new Map<string, FastNode[]>();
    for (const node of frames) {
      const title = (node.attrs.title || "").trim().toLowerCase();
      if (!title) continue;
      const list = titleMap.get(title);
      if (list) {
        list.push(node);
      } else {
        titleMap.set(title, [node]);
      }
    }

    for (const [title, frameList] of titleMap) {
      if (frameList.length > 1) {
        // Check if the src attributes are different
        const srcs = new Set(frameList.map((f) => f.attrs.src || ""));
        if (srcs.size > 1) {
          // Same title, different src = violation
          for (const node of frameList) {
            violations.push(node);
            checkDetails.set(node, {
              any: [makeCheck("frame-title-unique", "serious",
                "Multiple frames have the same title \"" + title + "\" but different content")],
            });
          }
        } else {
          for (const node of frameList) {
            passes.push(node);
            checkDetails.set(node, {
              any: [makeCheck("frame-title-unique", "serious",
                "Frames with same title have same source")],
            });
          }
        }
      } else {
        passes.push(frameList[0]);
        checkDetails.set(frameList[0], {
          any: [makeCheck("frame-title-unique", "serious", "Frame title is unique")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  bypass                                                             */
/* ------------------------------------------------------------------ */
const bypass: RuleCheck = {
  ruleId: "bypass",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const incomplete: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    const htmlNodes = findByTag(nodes, "html");
    const target = htmlNodes[0] || nodes[0];
    if (!target) return { violations, passes, checkDetails };

    // Check for skip links: an <a> early in the document that links to an ID on the page
    const hasSkipLink = nodes.some((n) => {
      if (n.tag !== "a" || !n.attrs.href) return false;
      const href = n.attrs.href;
      if (!href.startsWith("#") || href.length < 2) return false;
      // Check that the target ID exists
      const targetId = href.slice(1);
      return allNodes.some((t) => t.attrs.id === targetId);
    });

    // Check for landmarks
    const hasLandmarks = nodes.some((n) => {
      const role = getRole(n);
      return role && LANDMARK_ROLES.has(role);
    });

    // Check for headings
    const hasHeadings = nodes.some((n) => /^h[1-6]$/.test(n.tag) && !isHiddenOrAncestorHidden(n));

    if (hasSkipLink || hasLandmarks || hasHeadings) {
      passes.push(target);
      const methods: string[] = [];
      if (hasSkipLink) methods.push("skip link");
      if (hasLandmarks) methods.push("landmarks");
      if (hasHeadings) methods.push("headings");
      checkDetails.set(target, {
        any: [makeCheck("bypass", "serious",
          "Page has mechanism to bypass repeated blocks: " + methods.join(", "))],
      });
    } else {
      violations.push(target);
      checkDetails.set(target, {
        any: [makeCheck("bypass", "serious",
          "Page does not have a mechanism to bypass repeated blocks")],
      });
    }

    return { violations, passes, incomplete, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  tabindex                                                           */
/* ------------------------------------------------------------------ */
const tabindex: RuleCheck = {
  ruleId: "tabindex",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      if (node.attrs.tabindex === undefined) continue;

      const value = parseInt(node.attrs.tabindex, 10);
      if (isNaN(value)) continue;

      if (value > 0) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("tabindex", "serious",
            "Element has a tabindex greater than 0: tabindex=\"" + node.attrs.tabindex + "\"")],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("tabindex", "serious",
            "Element has appropriate tabindex value")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  accesskeys                                                         */
/* ------------------------------------------------------------------ */
const accesskeys: RuleCheck = {
  ruleId: "accesskeys",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    const keyMap = new Map<string, FastNode[]>();
    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      const key = node.attrs.accesskey;
      if (!key) continue;

      const normalizedKey = key.toLowerCase();
      const list = keyMap.get(normalizedKey);
      if (list) {
        list.push(node);
      } else {
        keyMap.set(normalizedKey, [node]);
      }
    }

    for (const [key, nodeList] of keyMap) {
      if (nodeList.length > 1) {
        for (const node of nodeList) {
          violations.push(node);
          checkDetails.set(node, {
            any: [makeCheck("accesskeys", "serious",
              "accesskey value \"" + key + "\" is not unique")],
          });
        }
      } else {
        passes.push(nodeList[0]);
        checkDetails.set(nodeList[0], {
          any: [makeCheck("accesskeys", "serious", "accesskey value is unique")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  region                                                             */
/* ------------------------------------------------------------------ */
const region: RuleCheck = {
  ruleId: "region",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    // Tags that should be ignored for the region check
    const ignoredTags = new Set([
      "html", "head", "body", "script", "style", "link", "meta", "title",
      "noscript", "template", "base",
    ]);

    // Find all landmark nodes
    const landmarkNodes = new Set<FastNode>();
    for (const node of nodes) {
      const role = getRole(node);
      if (role && LANDMARK_ROLES.has(role)) {
        landmarkNodes.add(node);
      }
    }

    // If no landmarks exist at all, skip this rule (nothing to report)
    if (landmarkNodes.size === 0) return { violations, passes, checkDetails };

    /** Check if a node is inside a landmark. */
    function isInsideLandmark(node: FastNode): boolean {
      let current: FastNode | null = node;
      while (current) {
        if (landmarkNodes.has(current)) return true;
        current = current.parent;
      }
      return false;
    }

    // Check body's direct children (top-level elements) that are not landmarks
    const bodyNodes = findByTag(nodes, "body");
    if (bodyNodes.length === 0) return { violations, passes, checkDetails };

    for (const node of nodes) {
      if (ignoredTags.has(node.tag)) continue;
      if (isHiddenOrAncestorHidden(node)) continue;

      // Only check visible, non-empty elements that have text content
      // and are direct children of body (or its non-landmark descendants)
      if (!isInsideLandmark(node)) {
        // Check if this is a top-level content element (direct child of body or
        // inside a non-landmark wrapper that's a direct child of body)
        let isTopLevel = false;
        let p = node.parent;
        while (p) {
          if (p.tag === "body") { isTopLevel = true; break; }
          const pRole = getRole(p);
          if (pRole && LANDMARK_ROLES.has(pRole)) break;
          p = p.parent;
        }

        if (isTopLevel && landmarkNodes.has(node)) {
          passes.push(node);
          checkDetails.set(node, {
            any: [makeCheck("region", "moderate", "Element is a landmark")],
          });
        } else if (isTopLevel && node.parent?.tag === "body") {
          // Only flag direct children of body that are not landmarks
          violations.push(node);
          checkDetails.set(node, {
            any: [makeCheck("region", "moderate",
              "Element is not contained within a landmark region")],
          });
        }
      }
    }

    return { violations, passes, checkDetails };
  },
};

export const navigationRules: RuleCheck[] = [
  linkName,
  frameTitle,
  frameTitleUnique,
  bypass,
  tabindex,
  accesskeys,
  region,
];
