/**
 * ARIA rules: aria-allowed-attr, aria-hidden-body, aria-hidden-focus,
 * aria-required-attr, aria-required-children, aria-required-parent,
 * aria-roles, aria-valid-attr, aria-valid-attr-value, aria-roledescription,
 * aria-input-field-name, aria-toggle-field-name, aria-command-name,
 * aria-meter-name, aria-progressbar-name, aria-tooltip-name,
 * aria-treeitem-name, aria-dialog-name, aria-text, aria-deprecated-role,
 * aria-prohibited-attr, aria-braille-equivalent, aria-allowed-role,
 * aria-conditional-attr, presentation-role-conflict
 */

import type { FastNode } from "../tree.js";
import type { RuleCheck, RuleRunResult, NodeCheckDetail } from "../rule-engine.js";
import { makeCheck } from "../rule-engine.js";
import {
  isHiddenOrAncestorHidden, findByTag, getRole, isFocusable,
} from "../tree.js";
import { getAccessibleName } from "../utils/accessible-name.js";

/* ================================================================== */
/*  Lookup tables                                                      */
/* ================================================================== */

/** All valid ARIA roles. */
const VALID_ROLES = new Set([
  "alert", "alertdialog", "application", "article", "banner", "blockquote",
  "button", "caption", "cell", "checkbox", "code", "columnheader", "combobox",
  "command", "comment", "complementary", "composite", "contentinfo", "definition",
  "deletion", "dialog", "directory", "document", "emphasis", "feed", "figure",
  "form", "generic", "grid", "gridcell", "group", "heading", "img", "input",
  "insertion", "landmark", "link", "list", "listbox", "listitem", "log", "main",
  "mark", "marquee", "math", "menu", "menubar", "menuitem", "menuitemcheckbox",
  "menuitemradio", "meter", "navigation", "none", "note", "option", "paragraph",
  "presentation", "progressbar", "radio", "radiogroup", "range", "region",
  "roletype", "row", "rowgroup", "rowheader", "scrollbar", "search", "searchbox",
  "section", "sectionhead", "select", "separator", "slider", "spinbutton",
  "status", "strong", "structure", "subscript", "superscript", "switch", "tab",
  "table", "tablist", "tabpanel", "term", "text", "textbox", "time", "timer",
  "toolbar", "tooltip", "tree", "treegrid", "treeitem", "widget", "window",
]);

/** Deprecated ARIA roles. */
const DEPRECATED_ROLES = new Set([
  "directory",
]);

/** Required attributes for each role. */
const REQUIRED_ATTRS: Record<string, string[]> = {
  checkbox: ["aria-checked"],
  combobox: ["aria-expanded"],
  heading: ["aria-level"],
  meter: ["aria-valuemin", "aria-valuemax", "aria-valuenow"],
  option: ["aria-selected"],
  radio: ["aria-checked"],
  scrollbar: ["aria-controls", "aria-valuenow"],
  separator: [], // Only when focusable: aria-valuenow
  slider: ["aria-valuenow"],
  spinbutton: ["aria-valuenow"],
  switch: ["aria-checked"],
};

/** Required children for each role. */
const REQUIRED_CHILDREN: Record<string, string[]> = {
  feed: ["article"],
  grid: ["row", "rowgroup"],
  list: ["listitem"],
  listbox: ["option", "group"],
  menu: ["menuitem", "menuitemcheckbox", "menuitemradio", "group"],
  menubar: ["menuitem", "menuitemcheckbox", "menuitemradio", "group"],
  radiogroup: ["radio"],
  row: ["cell", "columnheader", "gridcell", "rowheader"],
  rowgroup: ["row"],
  tablist: ["tab"],
  table: ["row", "rowgroup"],
  tree: ["treeitem", "group"],
  treegrid: ["row", "rowgroup"],
};

/** Required parent for each role. */
const REQUIRED_PARENT: Record<string, string[]> = {
  caption: ["figure", "grid", "listbox", "table", "tablist", "tree", "treegrid"],
  cell: ["row"],
  columnheader: ["row"],
  gridcell: ["row"],
  listitem: ["list", "group"],
  menuitem: ["menu", "menubar", "group"],
  menuitemcheckbox: ["menu", "menubar", "group"],
  menuitemradio: ["menu", "menubar", "group"],
  option: ["listbox", "group"],
  row: ["grid", "rowgroup", "table", "treegrid"],
  rowheader: ["row"],
  tab: ["tablist"],
  treeitem: ["tree", "group"],
};

/** Global ARIA attributes allowed on all roles. */
const GLOBAL_ARIA_ATTRS = new Set([
  "aria-atomic", "aria-braillelabel", "aria-brailleroledescription",
  "aria-busy", "aria-controls", "aria-current", "aria-describedby",
  "aria-description", "aria-details", "aria-disabled", "aria-dropeffect",
  "aria-errormessage", "aria-flowto", "aria-grabbed", "aria-haspopup",
  "aria-hidden", "aria-invalid", "aria-keyshortcuts", "aria-label",
  "aria-labelledby", "aria-live", "aria-owns", "aria-relevant",
  "aria-roledescription",
]);

/** All valid ARIA attributes. */
const VALID_ARIA_ATTRS = new Set([
  ...GLOBAL_ARIA_ATTRS,
  "aria-activedescendant", "aria-autocomplete", "aria-checked",
  "aria-colcount", "aria-colindex", "aria-colindextext", "aria-colspan",
  "aria-expanded", "aria-level", "aria-modal", "aria-multiline",
  "aria-multiselectable", "aria-orientation", "aria-placeholder",
  "aria-posinset", "aria-pressed", "aria-readonly", "aria-required",
  "aria-rowcount", "aria-rowindex", "aria-rowindextext", "aria-rowspan",
  "aria-selected", "aria-setsize", "aria-sort",
  "aria-valuemax", "aria-valuemin", "aria-valuenow", "aria-valuetext",
]);

/** Role-specific allowed attributes (in addition to global). */
const ROLE_ALLOWED_ATTRS: Record<string, string[]> = {
  alert: [],
  alertdialog: ["aria-modal"],
  application: ["aria-activedescendant", "aria-expanded"],
  article: ["aria-expanded"],
  banner: [],
  button: ["aria-expanded", "aria-pressed"],
  cell: ["aria-colindex", "aria-colspan", "aria-rowindex", "aria-rowspan", "aria-colindextext", "aria-rowindextext"],
  checkbox: ["aria-checked", "aria-expanded", "aria-readonly", "aria-required"],
  columnheader: ["aria-colindex", "aria-colspan", "aria-expanded", "aria-readonly", "aria-required", "aria-rowindex", "aria-rowspan", "aria-selected", "aria-sort", "aria-colindextext", "aria-rowindextext"],
  combobox: ["aria-activedescendant", "aria-autocomplete", "aria-expanded", "aria-readonly", "aria-required"],
  complementary: [],
  contentinfo: [],
  definition: [],
  dialog: ["aria-modal"],
  document: ["aria-expanded"],
  feed: [],
  figure: [],
  form: [],
  grid: ["aria-activedescendant", "aria-colcount", "aria-expanded", "aria-level", "aria-multiselectable", "aria-readonly", "aria-rowcount"],
  gridcell: ["aria-colindex", "aria-colspan", "aria-expanded", "aria-readonly", "aria-required", "aria-rowindex", "aria-rowspan", "aria-selected", "aria-colindextext", "aria-rowindextext"],
  group: ["aria-activedescendant", "aria-expanded"],
  heading: ["aria-expanded", "aria-level"],
  img: [],
  link: ["aria-expanded"],
  list: [],
  listbox: ["aria-activedescendant", "aria-expanded", "aria-multiselectable", "aria-orientation", "aria-readonly", "aria-required"],
  listitem: ["aria-expanded", "aria-level", "aria-posinset", "aria-setsize"],
  log: [],
  main: [],
  math: [],
  menu: ["aria-activedescendant", "aria-orientation"],
  menubar: ["aria-activedescendant", "aria-orientation"],
  menuitem: ["aria-expanded", "aria-posinset", "aria-setsize"],
  menuitemcheckbox: ["aria-checked", "aria-expanded", "aria-posinset", "aria-setsize"],
  menuitemradio: ["aria-checked", "aria-expanded", "aria-posinset", "aria-setsize"],
  meter: ["aria-valuemax", "aria-valuemin", "aria-valuenow", "aria-valuetext"],
  navigation: [],
  none: [],
  note: [],
  option: ["aria-checked", "aria-posinset", "aria-selected", "aria-setsize"],
  presentation: [],
  progressbar: ["aria-valuemax", "aria-valuemin", "aria-valuenow", "aria-valuetext"],
  radio: ["aria-checked", "aria-posinset", "aria-setsize"],
  radiogroup: ["aria-activedescendant", "aria-expanded", "aria-orientation", "aria-readonly", "aria-required"],
  region: [],
  row: ["aria-activedescendant", "aria-colindex", "aria-expanded", "aria-level", "aria-posinset", "aria-rowindex", "aria-selected", "aria-setsize", "aria-colindextext", "aria-rowindextext"],
  rowgroup: [],
  rowheader: ["aria-colindex", "aria-colspan", "aria-expanded", "aria-readonly", "aria-required", "aria-rowindex", "aria-rowspan", "aria-selected", "aria-sort", "aria-colindextext", "aria-rowindextext"],
  scrollbar: ["aria-controls", "aria-orientation", "aria-valuemax", "aria-valuemin", "aria-valuenow", "aria-valuetext"],
  search: [],
  searchbox: ["aria-activedescendant", "aria-autocomplete", "aria-multiline", "aria-placeholder", "aria-readonly", "aria-required"],
  separator: ["aria-orientation", "aria-valuemax", "aria-valuemin", "aria-valuenow", "aria-valuetext"],
  slider: ["aria-orientation", "aria-readonly", "aria-valuemax", "aria-valuemin", "aria-valuenow", "aria-valuetext"],
  spinbutton: ["aria-readonly", "aria-required", "aria-valuemax", "aria-valuemin", "aria-valuenow", "aria-valuetext"],
  status: [],
  switch: ["aria-checked", "aria-readonly", "aria-required"],
  tab: ["aria-expanded", "aria-posinset", "aria-selected", "aria-setsize"],
  table: ["aria-colcount", "aria-rowcount"],
  tablist: ["aria-activedescendant", "aria-multiselectable", "aria-orientation"],
  tabpanel: [],
  term: [],
  textbox: ["aria-activedescendant", "aria-autocomplete", "aria-multiline", "aria-placeholder", "aria-readonly", "aria-required"],
  timer: [],
  toolbar: ["aria-activedescendant", "aria-orientation"],
  tooltip: [],
  tree: ["aria-activedescendant", "aria-multiselectable", "aria-orientation", "aria-required"],
  treegrid: ["aria-activedescendant", "aria-colcount", "aria-expanded", "aria-level", "aria-multiselectable", "aria-orientation", "aria-readonly", "aria-required", "aria-rowcount"],
  treeitem: ["aria-checked", "aria-expanded", "aria-level", "aria-posinset", "aria-selected", "aria-setsize"],
};

/** Prohibited ARIA attributes per role. */
const PROHIBITED_ATTRS: Record<string, string[]> = {
  caption: ["aria-label", "aria-labelledby"],
  code: ["aria-label", "aria-labelledby"],
  definition: ["aria-label", "aria-labelledby"],
  deletion: ["aria-label", "aria-labelledby"],
  emphasis: ["aria-label", "aria-labelledby"],
  generic: ["aria-label", "aria-labelledby", "aria-roledescription"],
  insertion: ["aria-label", "aria-labelledby"],
  none: ["aria-label", "aria-labelledby"],
  paragraph: ["aria-label", "aria-labelledby"],
  presentation: ["aria-label", "aria-labelledby"],
  strong: ["aria-label", "aria-labelledby"],
  subscript: ["aria-label", "aria-labelledby"],
  superscript: ["aria-label", "aria-labelledby"],
};

/** Roles that are appropriate for aria-roledescription. */
const ROLEDESCRIPTION_SUPPORTED_ROLES = new Set([
  "alert", "alertdialog", "application", "article", "banner", "button",
  "cell", "checkbox", "columnheader", "combobox", "complementary",
  "contentinfo", "definition", "dialog", "document", "feed", "figure",
  "form", "grid", "gridcell", "group", "heading", "img", "landmark",
  "link", "list", "listbox", "listitem", "log", "main", "marquee",
  "math", "menu", "menubar", "menuitem", "menuitemcheckbox", "menuitemradio",
  "meter", "navigation", "note", "option", "progressbar", "radio",
  "radiogroup", "region", "row", "rowgroup", "rowheader", "scrollbar",
  "search", "searchbox", "separator", "slider", "spinbutton", "status",
  "switch", "tab", "table", "tablist", "tabpanel", "term", "textbox",
  "timer", "toolbar", "tooltip", "tree", "treegrid", "treeitem",
]);

/** Elements that cannot have any ARIA role. */
const NO_ROLE_ELEMENTS = new Set(["col", "colgroup", "head", "html", "meta", "script", "style"]);

/** Boolean ARIA attributes that accept "true" or "false" only. */
const BOOLEAN_ATTRS = new Set([
  "aria-atomic", "aria-busy", "aria-disabled", "aria-grabbed", "aria-hidden",
  "aria-modal", "aria-multiline", "aria-multiselectable", "aria-readonly",
  "aria-required",
]);

/** Tri-state attributes. */
const TRISTATE_ATTRS = new Set(["aria-checked", "aria-pressed"]);

/** Token attributes and their valid values. */
const TOKEN_ATTRS: Record<string, string[]> = {
  "aria-autocomplete": ["inline", "list", "both", "none"],
  "aria-current": ["page", "step", "location", "date", "time", "true", "false"],
  "aria-dropeffect": ["copy", "execute", "link", "move", "none", "popup"],
  "aria-haspopup": ["true", "false", "menu", "listbox", "tree", "grid", "dialog"],
  "aria-invalid": ["grammar", "false", "spelling", "true"],
  "aria-live": ["assertive", "off", "polite"],
  "aria-orientation": ["horizontal", "vertical", "undefined"],
  "aria-relevant": ["additions", "all", "removals", "text"],
  "aria-sort": ["ascending", "descending", "none", "other"],
  "aria-expanded": ["true", "false", "undefined"],
  "aria-selected": ["true", "false", "undefined"],
};

/** Get all aria-* attributes from a node. */
function getAriaAttrs(node: FastNode): Array<[string, string]> {
  const result: Array<[string, string]> = [];
  for (const [key, value] of Object.entries(node.attrs)) {
    if (key.startsWith("aria-")) {
      result.push([key, value]);
    }
  }
  return result;
}

/** Get effective role, falling back to implicit. */
function getEffectiveRole(node: FastNode): string | undefined {
  return getRole(node);
}

/** Check if a node or any descendant is focusable. */
function hasFocusableDescendant(node: FastNode): boolean {
  for (const child of node.children) {
    if (isFocusable(child)) return true;
    if (hasFocusableDescendant(child)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  aria-allowed-attr                                                  */
/* ------------------------------------------------------------------ */
const ariaAllowedAttr: RuleCheck = {
  ruleId: "aria-allowed-attr",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      const ariaAttrs = getAriaAttrs(node);
      if (ariaAttrs.length === 0) continue;

      const role = getEffectiveRole(node);
      if (!role) {
        // No role — only global attributes allowed
        const disallowed = ariaAttrs.filter(([attr]) => !GLOBAL_ARIA_ATTRS.has(attr));
        if (disallowed.length > 0) {
          violations.push(node);
          checkDetails.set(node, {
            all: [makeCheck("aria-allowed-attr", "critical",
              "ARIA attribute(s) not allowed: " + disallowed.map(([a]) => a).join(", "))],
          });
        } else {
          passes.push(node);
        }
        continue;
      }

      const allowed = new Set([
        ...GLOBAL_ARIA_ATTRS,
        ...(ROLE_ALLOWED_ATTRS[role] || []),
        ...(REQUIRED_ATTRS[role] || []),
      ]);

      const disallowed = ariaAttrs.filter(([attr]) => !allowed.has(attr));
      if (disallowed.length > 0) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-allowed-attr", "critical",
            "ARIA attribute(s) not allowed for role \"" + role + "\": " +
            disallowed.map(([a]) => a).join(", "))],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-allowed-attr", "critical",
            "ARIA attributes are allowed for role \"" + role + "\"")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  aria-hidden-body                                                   */
/* ------------------------------------------------------------------ */
const ariaHiddenBody: RuleCheck = {
  ruleId: "aria-hidden-body",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of findByTag(nodes, "body")) {
      if (node.attrs["aria-hidden"] === "true") {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-hidden-body", "critical",
            "aria-hidden=\"true\" must not be present on the document body")],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-hidden-body", "critical",
            "Document body does not have aria-hidden")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  aria-hidden-focus                                                  */
/* ------------------------------------------------------------------ */
const ariaHiddenFocus: RuleCheck = {
  ruleId: "aria-hidden-focus",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (node.attrs["aria-hidden"] !== "true") continue;

      // Check if this node itself is focusable (tabindex !== -1 makes it focusable
      // but aria-hidden should prevent focus — we flag elements that are
      // focusable with tabindex >= 0 or natively focusable)
      const selfFocusable = isFocusable(node);
      const descendantFocusable = hasFocusableDescendant(node);

      if (selfFocusable || descendantFocusable) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-hidden-focus", "serious",
            selfFocusable
              ? "Element with aria-hidden=\"true\" is focusable"
              : "Element with aria-hidden=\"true\" contains focusable elements")],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-hidden-focus", "serious",
            "Element with aria-hidden=\"true\" has no focusable content")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  aria-required-attr                                                 */
/* ------------------------------------------------------------------ */
const ariaRequiredAttr: RuleCheck = {
  ruleId: "aria-required-attr",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      const role = node.attrs.role;
      if (!role) continue;
      if (!VALID_ROLES.has(role)) continue;

      const required = REQUIRED_ATTRS[role];
      if (!required || required.length === 0) continue;

      // Skip native elements that implicitly provide the required state
      // e.g., <input type="checkbox"> implicitly has aria-checked
      if (node.tag === "input" && (role === "checkbox" || role === "radio" || role === "switch")) continue;
      if (node.tag === "select" && role === "combobox") continue;
      if (node.tag === "option") continue;
      // headings have implicit level from h1-h6
      if (/^h[1-6]$/.test(node.tag) && role === "heading") continue;

      const missing = required.filter((attr) => node.attrs[attr] === undefined);
      if (missing.length > 0) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-required-attr", "critical",
            "Required ARIA attribute(s) missing for role \"" + role + "\": " + missing.join(", "))],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-required-attr", "critical",
            "All required ARIA attributes are present")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  aria-required-children                                             */
/* ------------------------------------------------------------------ */
const ariaRequiredChildren: RuleCheck = {
  ruleId: "aria-required-children",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const incomplete: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      const role = getEffectiveRole(node);
      if (!role) continue;

      const requiredChildren = REQUIRED_CHILDREN[role];
      if (!requiredChildren || requiredChildren.length === 0) continue;

      // Check if any descendant has one of the required roles
      const hasRequiredChild = hasDescendantWithRole(node, requiredChildren);

      // If the element uses aria-owns, mark as incomplete (can't fully resolve)
      if (node.attrs["aria-owns"]) {
        incomplete.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-required-children", "critical",
            "Element uses aria-owns — cannot fully verify required children")],
        });
        continue;
      }

      if (hasRequiredChild) {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-required-children", "critical",
            "Element has required child role(s)")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-required-children", "critical",
            "Required child role(s) missing for role \"" + role + "\": " +
            requiredChildren.join(", "))],
        });
      }
    }

    return { violations, passes, incomplete, checkDetails };
  },
};

function hasDescendantWithRole(node: FastNode, roles: string[]): boolean {
  for (const child of node.children) {
    const childRole = getEffectiveRole(child);
    if (childRole && roles.includes(childRole)) return true;
    if (hasDescendantWithRole(child, roles)) return true;
  }
  return false;
}

/* ------------------------------------------------------------------ */
/*  aria-required-parent                                               */
/* ------------------------------------------------------------------ */
const ariaRequiredParent: RuleCheck = {
  ruleId: "aria-required-parent",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      const role = getEffectiveRole(node);
      if (!role) continue;

      const requiredParents = REQUIRED_PARENT[role];
      if (!requiredParents || requiredParents.length === 0) continue;

      // Walk up ancestors to find required parent role
      let found = false;
      let current = node.parent;
      while (current) {
        const parentRole = getEffectiveRole(current);
        if (parentRole && requiredParents.includes(parentRole)) {
          found = true;
          break;
        }
        current = current.parent;
      }

      if (found) {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-required-parent", "critical",
            "Element has the required parent role")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-required-parent", "critical",
            "Required parent role missing for role \"" + role + "\": " +
            requiredParents.join(", "))],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  aria-roles                                                         */
/* ------------------------------------------------------------------ */
const ariaRoles: RuleCheck = {
  ruleId: "aria-roles",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      const role = node.attrs.role;
      if (!role) continue;

      // Multiple roles: only the first valid one is used, but all must be valid
      const roles = role.trim().split(/\s+/);
      const invalidRoles = roles.filter((r) => !VALID_ROLES.has(r));

      if (invalidRoles.length > 0) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-roles", "critical",
            "Invalid ARIA role(s): " + invalidRoles.join(", "))],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-roles", "critical",
            "ARIA role is valid")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  aria-valid-attr                                                    */
/* ------------------------------------------------------------------ */
const ariaValidAttr: RuleCheck = {
  ruleId: "aria-valid-attr",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      const ariaAttrs = getAriaAttrs(node);
      if (ariaAttrs.length === 0) continue;

      const invalid = ariaAttrs.filter(([attr]) => !VALID_ARIA_ATTRS.has(attr));
      if (invalid.length > 0) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-valid-attr", "critical",
            "Invalid ARIA attribute(s): " + invalid.map(([a]) => a).join(", "))],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-valid-attr", "critical",
            "All ARIA attributes are valid")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  aria-valid-attr-value                                              */
/* ------------------------------------------------------------------ */
const ariaValidAttrValue: RuleCheck = {
  ruleId: "aria-valid-attr-value",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      const ariaAttrs = getAriaAttrs(node);
      if (ariaAttrs.length === 0) continue;

      const invalidAttrs: string[] = [];

      for (const [attr, value] of ariaAttrs) {
        if (!VALID_ARIA_ATTRS.has(attr)) continue; // aria-valid-attr handles unknown attrs

        // Boolean attributes
        if (BOOLEAN_ATTRS.has(attr)) {
          if (value !== "true" && value !== "false") {
            invalidAttrs.push(attr + "=\"" + value + "\"");
          }
          continue;
        }

        // Tri-state
        if (TRISTATE_ATTRS.has(attr)) {
          if (value !== "true" && value !== "false" && value !== "mixed") {
            invalidAttrs.push(attr + "=\"" + value + "\"");
          }
          continue;
        }

        // Token attributes
        if (TOKEN_ATTRS[attr]) {
          const validValues = TOKEN_ATTRS[attr];
          // aria-relevant can have space-separated values
          if (attr === "aria-relevant") {
            const tokens = value.trim().split(/\s+/);
            for (const t of tokens) {
              if (!validValues.includes(t)) {
                invalidAttrs.push(attr + "=\"" + value + "\"");
                break;
              }
            }
          } else if (!validValues.includes(value)) {
            invalidAttrs.push(attr + "=\"" + value + "\"");
          }
          continue;
        }

        // Numeric attributes
        if (attr === "aria-level" || attr === "aria-posinset" || attr === "aria-setsize" ||
            attr === "aria-colcount" || attr === "aria-colindex" || attr === "aria-colspan" ||
            attr === "aria-rowcount" || attr === "aria-rowindex" || attr === "aria-rowspan") {
          if (value.trim() && isNaN(parseInt(value.trim(), 10))) {
            invalidAttrs.push(attr + "=\"" + value + "\"");
          }
          continue;
        }

        // Numeric (float) attributes
        if (attr === "aria-valuemax" || attr === "aria-valuemin" || attr === "aria-valuenow") {
          if (value.trim() && isNaN(parseFloat(value.trim()))) {
            invalidAttrs.push(attr + "=\"" + value + "\"");
          }
          continue;
        }

        // ID reference attributes — check they are not empty
        if (attr === "aria-activedescendant" || attr === "aria-controls" ||
            attr === "aria-errormessage" || attr === "aria-flowto" ||
            attr === "aria-owns" || attr === "aria-details") {
          if (!value.trim()) {
            invalidAttrs.push(attr + " (empty value)");
          }
          continue;
        }

        // ID reference list attributes
        if (attr === "aria-labelledby" || attr === "aria-describedby") {
          if (!value.trim()) {
            invalidAttrs.push(attr + " (empty value)");
          }
          continue;
        }
      }

      if (invalidAttrs.length > 0) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-valid-attr-value", "critical",
            "Invalid ARIA attribute value(s): " + invalidAttrs.join(", "))],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-valid-attr-value", "critical",
            "All ARIA attribute values are valid")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  aria-roledescription                                               */
/* ------------------------------------------------------------------ */
const ariaRoledescription: RuleCheck = {
  ruleId: "aria-roledescription",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      if (node.attrs["aria-roledescription"] === undefined) continue;

      const role = getEffectiveRole(node);
      if (role && ROLEDESCRIPTION_SUPPORTED_ROLES.has(role)) {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-roledescription", "serious",
            "aria-roledescription is used on an element with a valid role")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-roledescription", "serious",
            "aria-roledescription is used on an element without an appropriate role")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  Helper: accessible name check for a set of roles                   */
/* ------------------------------------------------------------------ */
function ariaNameCheck(
  ruleId: string,
  impact: "serious" | "critical",
  targetRoles: string[],
): RuleCheck {
  return {
    ruleId,
    run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
      const violations: FastNode[] = [];
      const passes: FastNode[] = [];
      const checkDetails = new Map<FastNode, NodeCheckDetail>();

      for (const node of nodes) {
        if (isHiddenOrAncestorHidden(node)) continue;
        const role = getEffectiveRole(node);
        if (!role || !targetRoles.includes(role)) continue;

        const name = getAccessibleName(node, allNodes);
        if (name) {
          passes.push(node);
          checkDetails.set(node, {
            any: [makeCheck(ruleId, impact, "Element has an accessible name")],
          });
        } else {
          violations.push(node);
          checkDetails.set(node, {
            any: [makeCheck(ruleId, impact,
              "Element with role=\"" + role + "\" does not have an accessible name")],
          });
        }
      }

      return { violations, passes, checkDetails };
    },
  };
}

const ariaInputFieldName = ariaNameCheck("aria-input-field-name", "serious",
  ["combobox", "listbox", "searchbox", "spinbutton", "textbox"]);

const ariaToggleFieldName = ariaNameCheck("aria-toggle-field-name", "serious",
  ["checkbox", "menu", "menuitemcheckbox", "menuitemradio", "radio", "radiogroup", "switch"]);

const ariaCommandName = ariaNameCheck("aria-command-name", "serious",
  ["button", "link", "menuitem"]);

const ariaMeterName = ariaNameCheck("aria-meter-name", "serious", ["meter"]);
const ariaProgressbarName = ariaNameCheck("aria-progressbar-name", "serious", ["progressbar"]);
const ariaTooltipName = ariaNameCheck("aria-tooltip-name", "serious", ["tooltip"]);
const ariaTreeitemName = ariaNameCheck("aria-treeitem-name", "serious", ["treeitem"]);
const ariaDialogName = ariaNameCheck("aria-dialog-name", "serious", ["dialog", "alertdialog"]);

/* ------------------------------------------------------------------ */
/*  aria-text                                                          */
/* ------------------------------------------------------------------ */
const ariaText: RuleCheck = {
  ruleId: "aria-text",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      if (node.attrs.role !== "text") continue;

      if (hasFocusableDescendant(node)) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-text", "serious",
            "Element with role=\"text\" has focusable descendants")],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-text", "serious",
            "Element with role=\"text\" has no focusable descendants")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  aria-deprecated-role                                               */
/* ------------------------------------------------------------------ */
const ariaDeprecatedRole: RuleCheck = {
  ruleId: "aria-deprecated-role",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      const role = node.attrs.role;
      if (!role) continue;

      if (DEPRECATED_ROLES.has(role)) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-deprecated-role", "minor",
            "Role \"" + role + "\" is deprecated")],
        });
      } else if (VALID_ROLES.has(role)) {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-deprecated-role", "minor",
            "Role is not deprecated")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  aria-prohibited-attr                                               */
/* ------------------------------------------------------------------ */
const ariaProhibitedAttr: RuleCheck = {
  ruleId: "aria-prohibited-attr",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      const role = getEffectiveRole(node);
      if (!role) continue;

      const prohibited = PROHIBITED_ATTRS[role];
      if (!prohibited || prohibited.length === 0) continue;

      const present = prohibited.filter((attr) => node.attrs[attr] !== undefined);
      if (present.length > 0) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-prohibited-attr", "serious",
            "Prohibited ARIA attribute(s) for role \"" + role + "\": " + present.join(", "))],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-prohibited-attr", "serious",
            "No prohibited ARIA attributes used")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  aria-braille-equivalent                                            */
/* ------------------------------------------------------------------ */
const ariaBrailleEquivalent: RuleCheck = {
  ruleId: "aria-braille-equivalent",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;

      const hasBrailleLabel = node.attrs["aria-braillelabel"] !== undefined;
      const hasBrailleRoledescription = node.attrs["aria-brailleroledescription"] !== undefined;

      if (!hasBrailleLabel && !hasBrailleRoledescription) continue;

      const issues: string[] = [];

      if (hasBrailleLabel) {
        const name = getAccessibleName(node, allNodes);
        if (!name) {
          issues.push("aria-braillelabel is used without a non-braille accessible name");
        }
      }

      if (hasBrailleRoledescription) {
        if (!node.attrs["aria-roledescription"]) {
          issues.push("aria-brailleroledescription is used without aria-roledescription");
        }
      }

      if (issues.length > 0) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-braille-equivalent", "serious", issues.join("; "))],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-braille-equivalent", "serious",
            "Braille attributes have non-braille equivalents")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  aria-allowed-role                                                  */
/* ------------------------------------------------------------------ */
/** Elements that can take any role. */
const ANY_ROLE_ELEMENTS = new Set(["div", "span"]);

/** Mapping of elements to their allowed explicit roles. */
const ELEMENT_ALLOWED_ROLES: Record<string, string[] | "*"> = {
  a: ["button", "checkbox", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "radio", "switch", "tab", "treeitem", "doc-backlink", "doc-biblioref", "doc-glossref", "doc-noteref"],
  article: ["application", "document", "feed", "main", "none", "presentation", "region"],
  aside: ["doc-dedication", "doc-example", "doc-footnote", "doc-glossary", "doc-pullquote", "doc-tip", "feed", "none", "note", "presentation", "region", "search"],
  blockquote: ["*"],
  button: ["checkbox", "combobox", "link", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "radio", "switch", "tab"],
  details: ["group"],
  div: "*",
  dl: ["group", "list", "none", "presentation"],
  fieldset: ["group", "none", "presentation", "radiogroup"],
  footer: ["contentinfo", "doc-footnote", "group", "none", "presentation"],
  form: ["none", "presentation", "search"],
  h1: ["doc-subtitle", "none", "presentation", "tab"],
  h2: ["doc-subtitle", "none", "presentation", "tab"],
  h3: ["doc-subtitle", "none", "presentation", "tab"],
  h4: ["doc-subtitle", "none", "presentation", "tab"],
  h5: ["doc-subtitle", "none", "presentation", "tab"],
  h6: ["doc-subtitle", "none", "presentation", "tab"],
  header: ["banner", "group", "none", "presentation"],
  hr: ["doc-pagebreak", "none", "presentation", "separator"],
  img: ["button", "checkbox", "link", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "progressbar", "radio", "scrollbar", "separator", "slider", "switch", "tab", "treeitem", "doc-cover", "img", "none", "presentation"],
  input: "*",
  li: ["doc-biblioentry", "doc-endnote", "menuitem", "menuitemcheckbox", "menuitemradio", "option", "none", "presentation", "radio", "separator", "tab", "treeitem"],
  main: ["*"],
  nav: ["doc-index", "doc-pagelist", "doc-toc", "menu", "menubar", "none", "presentation", "tablist"],
  ol: ["directory", "group", "listbox", "menu", "menubar", "none", "presentation", "radiogroup", "tablist", "toolbar", "tree"],
  p: ["*"],
  section: ["alert", "alertdialog", "application", "banner", "complementary", "contentinfo", "dialog", "doc-abstract", "doc-acknowledgments", "doc-afterword", "doc-appendix", "doc-bibliography", "doc-chapter", "doc-colophon", "doc-conclusion", "doc-credit", "doc-credits", "doc-dedication", "doc-endnotes", "doc-epilogue", "doc-errata", "doc-example", "doc-foreword", "doc-glossary", "doc-index", "doc-introduction", "doc-notice", "doc-pagelist", "doc-part", "doc-preface", "doc-prologue", "doc-pullquote", "doc-qna", "doc-toc", "document", "feed", "group", "log", "main", "marquee", "navigation", "none", "note", "presentation", "region", "search", "status", "tabpanel"],
  select: ["menu"],
  span: "*",
  table: ["*"],
  td: ["*"],
  textarea: ["*"],
  th: ["*"],
  tr: ["*"],
  ul: ["directory", "group", "listbox", "menu", "menubar", "none", "presentation", "radiogroup", "tablist", "toolbar", "tree"],
};

const ariaAllowedRole: RuleCheck = {
  ruleId: "aria-allowed-role",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      const role = node.attrs.role;
      if (!role) continue;
      if (!VALID_ROLES.has(role)) continue; // aria-roles handles invalid roles
      if (NO_ROLE_ELEMENTS.has(node.tag)) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-allowed-role", "minor",
            "Element <" + node.tag + "> cannot have a role attribute")],
        });
        continue;
      }

      const allowed = ELEMENT_ALLOWED_ROLES[node.tag];
      if (allowed === undefined || allowed === "*") {
        // Element not in restrictive list or accepts any role
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-allowed-role", "minor", "Role is allowed for this element")],
        });
        continue;
      }

      if (Array.isArray(allowed) && (allowed.includes(role) || allowed.includes("*"))) {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-allowed-role", "minor", "Role is allowed for this element")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-allowed-role", "minor",
            "Role \"" + role + "\" is not allowed on <" + node.tag + ">")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  aria-conditional-attr                                              */
/* ------------------------------------------------------------------ */
const ariaConditionalAttr: RuleCheck = {
  ruleId: "aria-conditional-attr",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      const role = getEffectiveRole(node);
      if (!role) continue;

      const issues: string[] = [];

      // checkbox with aria-checked="false" should not have aria-required
      // separator that is not focusable should not have value attributes
      if (role === "separator" && !isFocusable(node)) {
        const valueAttrs = ["aria-valuenow", "aria-valuemin", "aria-valuemax", "aria-valuetext"];
        const present = valueAttrs.filter((a) => node.attrs[a] !== undefined);
        if (present.length > 0) {
          issues.push("Non-focusable separator should not have: " + present.join(", "));
        }
      }

      if (issues.length > 0) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("aria-conditional-attr", "serious", issues.join("; "))],
        });
      } else {
        const ariaAttrs = getAriaAttrs(node);
        if (ariaAttrs.length > 0) {
          passes.push(node);
          checkDetails.set(node, {
            all: [makeCheck("aria-conditional-attr", "serious",
              "ARIA attributes are used correctly for the role")],
          });
        }
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  presentation-role-conflict                                         */
/* ------------------------------------------------------------------ */
const presentationRoleConflict: RuleCheck = {
  ruleId: "presentation-role-conflict",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (isHiddenOrAncestorHidden(node)) continue;
      const role = node.attrs.role;
      if (role !== "none" && role !== "presentation") continue;

      const hasTabindex = node.attrs.tabindex !== undefined && node.attrs.tabindex !== "-1";
      const hasGlobalAria = getAriaAttrs(node).some(([attr]) =>
        GLOBAL_ARIA_ATTRS.has(attr) && attr !== "aria-hidden"
      );

      if (hasTabindex || hasGlobalAria) {
        violations.push(node);
        const reasons: string[] = [];
        if (hasTabindex) reasons.push("has tabindex");
        if (hasGlobalAria) reasons.push("has global ARIA attributes");
        checkDetails.set(node, {
          all: [makeCheck("presentation-role-conflict", "minor",
            "Element with role=\"" + role + "\" " + reasons.join(" and "))],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("presentation-role-conflict", "minor",
            "Element with role=\"" + role + "\" correctly has no global ARIA or tabindex")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

export const ariaRules: RuleCheck[] = [
  ariaAllowedAttr,
  ariaHiddenBody,
  ariaHiddenFocus,
  ariaRequiredAttr,
  ariaRequiredChildren,
  ariaRequiredParent,
  ariaRoles,
  ariaValidAttr,
  ariaValidAttrValue,
  ariaRoledescription,
  ariaInputFieldName,
  ariaToggleFieldName,
  ariaCommandName,
  ariaMeterName,
  ariaProgressbarName,
  ariaTooltipName,
  ariaTreeitemName,
  ariaDialogName,
  ariaText,
  ariaDeprecatedRole,
  ariaProhibitedAttr,
  ariaBrailleEquivalent,
  ariaAllowedRole,
  ariaConditionalAttr,
  presentationRoleConflict,
];
