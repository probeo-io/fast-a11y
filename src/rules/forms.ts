/**
 * Form rules: label, select-name, input-button-name, button-name,
 * form-field-multiple-labels, autocomplete-valid, label-title-only
 */

import type { FastNode } from "../tree.js";
import type { RuleCheck, RuleRunResult, NodeCheckDetail } from "../rule-engine.js";
import { makeCheck } from "../rule-engine.js";
import { isHiddenOrAncestorHidden, findByTag } from "../tree.js";
import { getAccessibleName } from "../utils/accessible-name.js";

/** Autocomplete tokens from the HTML spec. */
const AUTOCOMPLETE_TOKENS = new Set([
  // Section names
  "shipping", "billing",
  // Contact types
  "home", "work", "mobile", "fax", "pager",
  // Field names
  "name", "honorific-prefix", "given-name", "additional-name",
  "family-name", "honorific-suffix", "nickname", "username",
  "new-password", "current-password", "one-time-code",
  "organization-title", "organization",
  "street-address", "address-line1", "address-line2", "address-line3",
  "address-level4", "address-level3", "address-level2", "address-level1",
  "country", "country-name", "postal-code",
  "cc-name", "cc-given-name", "cc-additional-name", "cc-family-name",
  "cc-number", "cc-exp", "cc-exp-month", "cc-exp-year",
  "cc-csc", "cc-type",
  "transaction-currency", "transaction-amount",
  "language", "bday", "bday-day", "bday-month", "bday-year",
  "sex", "url", "photo",
  "tel", "tel-country-code", "tel-national", "tel-area-code",
  "tel-local", "tel-local-prefix", "tel-local-suffix", "tel-extension",
  "email", "impp",
  // Special values
  "on", "off",
  // webauthn
  "webauthn",
]);

/** Input types that support autocomplete. */
const AUTOCOMPLETE_INPUT_TYPES = new Set([
  "text", "search", "url", "tel", "email", "password",
  "date", "month", "week", "time", "datetime-local",
  "number", "range", "color",
]);

/** Check if a form element is a type that should have a label. */
function isLabelableInput(node: FastNode): boolean {
  if (node.tag === "select" || node.tag === "textarea") return true;
  if (node.tag === "input") {
    const type = (node.attrs.type || "text").toLowerCase();
    // Hidden inputs, submit/reset/button/image buttons don't need labels this way
    return type !== "hidden" && type !== "submit" && type !== "reset" &&
           type !== "button" && type !== "image";
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  label                                                              */
/* ------------------------------------------------------------------ */
const label: RuleCheck = {
  ruleId: "label",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (!isLabelableInput(node)) continue;
      if (isHiddenOrAncestorHidden(node)) continue;

      // Skip if role overrides native semantics to non-form role
      const role = node.attrs.role;
      if (role === "presentation" || role === "none") continue;

      const name = getAccessibleName(node, allNodes);
      if (name) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("label", "critical", "Element has an accessible name")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("label", "critical",
            "Form element does not have an accessible name")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  select-name                                                        */
/* ------------------------------------------------------------------ */
const selectName: RuleCheck = {
  ruleId: "select-name",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of findByTag(nodes, "select")) {
      if (isHiddenOrAncestorHidden(node)) continue;

      const name = getAccessibleName(node, allNodes);
      if (name) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("select-name", "critical", "Element has an accessible name")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("select-name", "critical",
            "Select element does not have an accessible name")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  input-button-name                                                  */
/* ------------------------------------------------------------------ */
const inputButtonName: RuleCheck = {
  ruleId: "input-button-name",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    const buttonTypes = new Set(["submit", "reset", "button"]);

    for (const node of findByTag(nodes, "input")) {
      if (isHiddenOrAncestorHidden(node)) continue;
      const type = (node.attrs.type || "").toLowerCase();
      if (!buttonTypes.has(type)) continue;

      const name = getAccessibleName(node, allNodes);
      if (name) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("input-button-name", "critical", "Element has discernible text")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("input-button-name", "critical",
            "Element does not have discernible text")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  button-name                                                        */
/* ------------------------------------------------------------------ */
const buttonName: RuleCheck = {
  ruleId: "button-name",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;

      // Match <button> and elements with role="button"
      const isButton = node.tag === "button" || node.attrs.role === "button";
      if (!isButton) continue;
      // Skip <input type="button"> — handled by input-button-name
      if (node.tag === "input") continue;

      const name = getAccessibleName(node, allNodes);
      if (name) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("button-name", "critical", "Element has an accessible name")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("button-name", "critical",
            "Element does not have an accessible name")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  form-field-multiple-labels                                         */
/* ------------------------------------------------------------------ */
const formFieldMultipleLabels: RuleCheck = {
  ruleId: "form-field-multiple-labels",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    // Build a map of id -> count of <label for="id">
    const labelForCount = new Map<string, number>();
    for (const node of findByTag(nodes, "label")) {
      const forAttr = node.attrs.for;
      if (forAttr) {
        labelForCount.set(forAttr, (labelForCount.get(forAttr) || 0) + 1);
      }
    }

    // Check each form field
    for (const node of nodes) {
      if (!isLabelableInput(node)) continue;
      if (isHiddenOrAncestorHidden(node)) continue;
      const id = node.attrs.id;
      if (!id) continue;

      const count = labelForCount.get(id) || 0;
      if (count > 1) {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("form-field-multiple-labels", "moderate",
            "Element has " + count + " label elements associated via for attribute")],
        });
      } else if (count === 1) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("form-field-multiple-labels", "moderate",
            "Element has a single label")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  autocomplete-valid                                                 */
/* ------------------------------------------------------------------ */
const autocompleteValid: RuleCheck = {
  ruleId: "autocomplete-valid",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;

      const autocomplete = node.attrs.autocomplete;
      if (autocomplete === undefined) continue;

      // Only check on appropriate elements
      if (node.tag === "input") {
        const type = (node.attrs.type || "text").toLowerCase();
        if (!AUTOCOMPLETE_INPUT_TYPES.has(type) && type !== "hidden") continue;
      } else if (node.tag !== "select" && node.tag !== "textarea") {
        continue;
      }

      const value = autocomplete.trim().toLowerCase();
      if (!value) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("autocomplete-valid", "serious",
            "Element has an empty autocomplete attribute")],
        });
        continue;
      }

      // Parse the autocomplete value: optional section, optional contact, field name
      const tokens = value.split(/\s+/);
      let valid = true;

      for (const token of tokens) {
        // Section names start with "section-"
        if (token.startsWith("section-")) continue;
        if (!AUTOCOMPLETE_TOKENS.has(token)) {
          valid = false;
          break;
        }
      }

      if (valid) {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("autocomplete-valid", "serious",
            "Element has a valid autocomplete value")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("autocomplete-valid", "serious",
            "Element has an invalid autocomplete value: " + autocomplete)],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  label-title-only                                                   */
/* ------------------------------------------------------------------ */
const labelTitleOnly: RuleCheck = {
  ruleId: "label-title-only",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (!isLabelableInput(node)) continue;
      if (isHiddenOrAncestorHidden(node)) continue;

      const hasAriaLabel = !!(node.attrs["aria-label"] && node.attrs["aria-label"].trim());
      const hasAriaLabelledby = !!(node.attrs["aria-labelledby"] && node.attrs["aria-labelledby"].trim());
      const hasTitle = !!(node.attrs.title && node.attrs.title.trim());

      // Check for <label> association
      let hasLabel = false;
      const id = node.attrs.id;
      if (id) {
        hasLabel = allNodes.some((n) => n.tag === "label" && n.attrs.for === id);
      }
      if (!hasLabel) {
        // Check wrapping label
        let p = node.parent;
        while (p) {
          if (p.tag === "label") { hasLabel = true; break; }
          p = p.parent;
        }
      }

      if (hasLabel || hasAriaLabel || hasAriaLabelledby) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("label-title-only", "serious",
            "Element has a proper label mechanism")],
        });
      } else if (hasTitle) {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("label-title-only", "serious",
            "Element is labeled only by the title attribute")],
        });
      }
      // If no title and no label, the "label" rule covers it
    }

    return { violations, passes, checkDetails };
  },
};

export const formRules: RuleCheck[] = [
  label,
  selectName,
  inputButtonName,
  buttonName,
  formFieldMultipleLabels,
  autocompleteValid,
  labelTitleOnly,
];
