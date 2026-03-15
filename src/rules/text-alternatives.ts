/**
 * Text alternative rules: image-alt, input-image-alt, object-alt,
 * role-img-alt, svg-img-alt, area-alt, server-side-image-map
 */

import type { FastNode } from "../tree.js";
import type { RuleCheck, RuleRunResult, NodeCheckDetail } from "../rule-engine.js";
import { makeCheck } from "../rule-engine.js";
import { isHiddenOrAncestorHidden, findByTag, getRole, getNodeText } from "../tree.js";
import { getAccessibleName } from "../utils/accessible-name.js";

/* ------------------------------------------------------------------ */
/*  image-alt                                                          */
/* ------------------------------------------------------------------ */
const imageAlt: RuleCheck = {
  ruleId: "image-alt",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of findByTag(nodes, "img")) {
      if (isHiddenOrAncestorHidden(node)) continue;

      const role = node.attrs.role;
      if (role === "none" || role === "presentation") {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("image-alt", "critical", "Element has role=\"" + role + "\"")],
        });
        continue;
      }

      const hasAlt = node.attrs.alt !== undefined;
      const hasAriaLabel = !!(node.attrs["aria-label"] && node.attrs["aria-label"].trim());
      const hasAriaLabelledby = !!(node.attrs["aria-labelledby"] && node.attrs["aria-labelledby"].trim());

      if (hasAlt || hasAriaLabel || hasAriaLabelledby) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("image-alt", "critical", "Element has alternative text")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("image-alt", "critical",
            "Element does not have an alt attribute, and does not have role=\"none\" or role=\"presentation\"")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  input-image-alt                                                    */
/* ------------------------------------------------------------------ */
const inputImageAlt: RuleCheck = {
  ruleId: "input-image-alt",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of findByTag(nodes, "input")) {
      if (isHiddenOrAncestorHidden(node)) continue;
      if ((node.attrs.type || "").toLowerCase() !== "image") continue;

      const name = getAccessibleName(node, allNodes);
      if (name) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("input-image-alt", "critical", "Element has an accessible name")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("input-image-alt", "critical",
            "Element has no accessible name")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  object-alt                                                         */
/* ------------------------------------------------------------------ */
const objectAlt: RuleCheck = {
  ruleId: "object-alt",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of findByTag(nodes, "object")) {
      if (isHiddenOrAncestorHidden(node)) continue;

      const hasAriaLabel = !!(node.attrs["aria-label"] && node.attrs["aria-label"].trim());
      const hasAriaLabelledby = !!(node.attrs["aria-labelledby"] && node.attrs["aria-labelledby"].trim());
      const hasTitle = !!(node.attrs.title && node.attrs.title.trim());
      const hasTextContent = !!getNodeText(node);
      const role = node.attrs.role;
      if (role === "none" || role === "presentation") {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("object-alt", "serious", "Element has role=\"" + role + "\"")],
        });
        continue;
      }

      if (hasAriaLabel || hasAriaLabelledby || hasTitle || hasTextContent) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("object-alt", "serious", "Element has alternative text")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("object-alt", "serious",
            "Element does not have alt text (aria-label, aria-labelledby, title, or text content)")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  role-img-alt                                                       */
/* ------------------------------------------------------------------ */
const roleImgAlt: RuleCheck = {
  ruleId: "role-img-alt",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      if (node.attrs.role !== "img") continue;

      const name = getAccessibleName(node, allNodes);
      if (name) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("role-img-alt", "serious", "Element has an accessible name")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("role-img-alt", "serious",
            "Element has no accessible name")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  svg-img-alt                                                        */
/* ------------------------------------------------------------------ */
const svgImgAlt: RuleCheck = {
  ruleId: "svg-img-alt",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of findByTag(nodes, "svg")) {
      if (isHiddenOrAncestorHidden(node)) continue;
      if (node.attrs.role !== "img") continue;

      const hasAriaLabel = !!(node.attrs["aria-label"] && node.attrs["aria-label"].trim());
      const hasAriaLabelledby = !!(node.attrs["aria-labelledby"] && node.attrs["aria-labelledby"].trim());
      const hasTitleChild = node.children.some((c) => c.tag === "title" && getNodeText(c));

      if (hasAriaLabel || hasAriaLabelledby || hasTitleChild) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("svg-img-alt", "serious", "Element has an accessible name")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("svg-img-alt", "serious",
            "Element has no accessible name")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  area-alt                                                           */
/* ------------------------------------------------------------------ */
const areaAlt: RuleCheck = {
  ruleId: "area-alt",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of findByTag(nodes, "area")) {
      if (isHiddenOrAncestorHidden(node)) continue;
      if (node.attrs.href === undefined) continue;

      const hasAlt = !!(node.attrs.alt && node.attrs.alt.trim());
      const hasAriaLabel = !!(node.attrs["aria-label"] && node.attrs["aria-label"].trim());
      const hasAriaLabelledby = !!(node.attrs["aria-labelledby"] && node.attrs["aria-labelledby"].trim());

      if (hasAlt || hasAriaLabel || hasAriaLabelledby) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("area-alt", "critical", "Element has alternative text")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("area-alt", "critical",
            "Element does not have alt text")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  server-side-image-map                                              */
/* ------------------------------------------------------------------ */
const serverSideImageMap: RuleCheck = {
  ruleId: "server-side-image-map",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of findByTag(nodes, "img")) {
      if (isHiddenOrAncestorHidden(node)) continue;

      if (node.attrs.ismap !== undefined) {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("server-side-image-map", "minor",
            "Element has ismap attribute — server-side image maps should not be used")],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("server-side-image-map", "minor",
            "Element does not use a server-side image map")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

export const textAlternativeRules: RuleCheck[] = [
  imageAlt,
  inputImageAlt,
  objectAlt,
  roleImgAlt,
  svgImgAlt,
  areaAlt,
  serverSideImageMap,
];
