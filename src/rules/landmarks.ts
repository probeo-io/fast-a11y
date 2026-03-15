/**
 * Landmark rules: landmark-one-main, landmark-no-duplicate-main,
 * landmark-no-duplicate-banner, landmark-no-duplicate-contentinfo,
 * landmark-banner-is-top-level, landmark-contentinfo-is-top-level,
 * landmark-complementary-is-top-level, landmark-main-is-top-level,
 * landmark-unique
 */

import type { FastNode } from "../tree.js";
import type { RuleCheck, RuleRunResult, NodeCheckDetail } from "../rule-engine.js";
import { makeCheck } from "../rule-engine.js";
import { isHiddenOrAncestorHidden, findByTag, getRole } from "../tree.js";
import { getAccessibleName } from "../utils/accessible-name.js";

/** All landmark roles. */
const LANDMARK_ROLES = new Set([
  "banner", "complementary", "contentinfo", "form", "main",
  "navigation", "region", "search",
]);

/** Get all nodes with a specific landmark role. */
function findLandmarksByRole(nodes: FastNode[], role: string): FastNode[] {
  return nodes.filter((n) => {
    if (isHiddenOrAncestorHidden(n)) return false;
    return getRole(n) === role;
  });
}

/** Check if a landmark node is nested inside another landmark. */
function isInsideLandmark(node: FastNode): boolean {
  let parent = node.parent;
  while (parent) {
    const parentRole = getRole(parent);
    if (parentRole && LANDMARK_ROLES.has(parentRole)) return true;
    parent = parent.parent;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  landmark-one-main                                                  */
/* ------------------------------------------------------------------ */
const landmarkOneMain: RuleCheck = {
  ruleId: "landmark-one-main",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    const htmlNodes = findByTag(nodes, "html");
    const target = htmlNodes[0] || nodes[0];
    if (!target) return { violations, passes, checkDetails };

    const mainLandmarks = findLandmarksByRole(nodes, "main");

    if (mainLandmarks.length >= 1) {
      passes.push(target);
      checkDetails.set(target, {
        any: [makeCheck("landmark-one-main", "moderate",
          "Document has a main landmark")],
      });
    } else {
      violations.push(target);
      checkDetails.set(target, {
        any: [makeCheck("landmark-one-main", "moderate",
          "Document does not have a main landmark")],
      });
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  Helper: no-duplicate landmark check                                */
/* ------------------------------------------------------------------ */
function noDuplicateLandmark(
  ruleId: string,
  role: string,
  impact: "moderate" | "serious" = "moderate",
): RuleCheck {
  return {
    ruleId,
    run(nodes: FastNode[]): RuleRunResult {
      const violations: FastNode[] = [];
      const passes: FastNode[] = [];
      const checkDetails = new Map<FastNode, NodeCheckDetail>();

      const landmarks = findLandmarksByRole(nodes, role);

      if (landmarks.length <= 1) {
        const htmlNodes = findByTag(nodes, "html");
        const target = htmlNodes[0] || nodes[0];
        if (target) {
          passes.push(target);
          checkDetails.set(target, {
            any: [makeCheck(ruleId, impact,
              "Document has at most one " + role + " landmark")],
          });
        }
      } else {
        // Report on each duplicate
        for (const node of landmarks) {
          violations.push(node);
          checkDetails.set(node, {
            any: [makeCheck(ruleId, impact,
              "Document has " + landmarks.length + " " + role + " landmarks — should have at most one")],
          });
        }
      }

      return { violations, passes, checkDetails };
    },
  };
}

const landmarkNoDuplicateMain = noDuplicateLandmark("landmark-no-duplicate-main", "main");
const landmarkNoDuplicateBanner = noDuplicateLandmark("landmark-no-duplicate-banner", "banner");
const landmarkNoDuplicateContentinfo = noDuplicateLandmark("landmark-no-duplicate-contentinfo", "contentinfo");

/* ------------------------------------------------------------------ */
/*  Helper: top-level landmark check                                   */
/* ------------------------------------------------------------------ */
function topLevelLandmark(
  ruleId: string,
  role: string,
): RuleCheck {
  return {
    ruleId,
    run(nodes: FastNode[]): RuleRunResult {
      const violations: FastNode[] = [];
      const passes: FastNode[] = [];
      const checkDetails = new Map<FastNode, NodeCheckDetail>();

      const landmarks = findLandmarksByRole(nodes, role);
      for (const node of landmarks) {
        if (isInsideLandmark(node)) {
          violations.push(node);
          checkDetails.set(node, {
            any: [makeCheck(ruleId, "moderate",
              role + " landmark is nested inside another landmark")],
          });
        } else {
          passes.push(node);
          checkDetails.set(node, {
            any: [makeCheck(ruleId, "moderate",
              role + " landmark is at the top level")],
          });
        }
      }

      return { violations, passes, checkDetails };
    },
  };
}

const landmarkBannerIsTopLevel = topLevelLandmark("landmark-banner-is-top-level", "banner");
const landmarkContentinfoIsTopLevel = topLevelLandmark("landmark-contentinfo-is-top-level", "contentinfo");
const landmarkComplementaryIsTopLevel = topLevelLandmark("landmark-complementary-is-top-level", "complementary");
const landmarkMainIsTopLevel = topLevelLandmark("landmark-main-is-top-level", "main");

/* ------------------------------------------------------------------ */
/*  landmark-unique                                                    */
/* ------------------------------------------------------------------ */
const landmarkUnique: RuleCheck = {
  ruleId: "landmark-unique",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    // Group landmarks by role
    const roleGroups = new Map<string, FastNode[]>();
    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      const role = getRole(node);
      if (!role || !LANDMARK_ROLES.has(role)) continue;

      const list = roleGroups.get(role);
      if (list) {
        list.push(node);
      } else {
        roleGroups.set(role, [node]);
      }
    }

    // For each role with multiple landmarks, check that they have unique labels
    for (const [role, landmarks] of roleGroups) {
      if (landmarks.length <= 1) {
        if (landmarks.length === 1) {
          passes.push(landmarks[0]);
          checkDetails.set(landmarks[0], {
            any: [makeCheck("landmark-unique", "moderate",
              "Landmark is unique — only one " + role + " landmark")],
          });
        }
        continue;
      }

      // Check for unique accessible names
      const nameMap = new Map<string, FastNode[]>();
      for (const node of landmarks) {
        const name = getAccessibleName(node, allNodes).toLowerCase().trim();
        const key = role + ":" + name;
        const list = nameMap.get(key);
        if (list) {
          list.push(node);
        } else {
          nameMap.set(key, [node]);
        }
      }

      for (const [key, nodeList] of nameMap) {
        if (nodeList.length > 1) {
          for (const node of nodeList) {
            violations.push(node);
            const name = getAccessibleName(node, allNodes);
            checkDetails.set(node, {
              any: [makeCheck("landmark-unique", "moderate",
                "Multiple " + role + " landmarks" +
                (name ? " with the same label \"" + name + "\"" : " without unique labels") +
                " — landmarks should have unique labels")],
            });
          }
        } else {
          passes.push(nodeList[0]);
          checkDetails.set(nodeList[0], {
            any: [makeCheck("landmark-unique", "moderate",
              "Landmark has a unique label among " + role + " landmarks")],
          });
        }
      }
    }

    return { violations, passes, checkDetails };
  },
};

export const landmarkRules: RuleCheck[] = [
  landmarkOneMain,
  landmarkNoDuplicateMain,
  landmarkNoDuplicateBanner,
  landmarkNoDuplicateContentinfo,
  landmarkBannerIsTopLevel,
  landmarkContentinfoIsTopLevel,
  landmarkComplementaryIsTopLevel,
  landmarkMainIsTopLevel,
  landmarkUnique,
];
