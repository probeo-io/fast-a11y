/**
 * Structure rules: document-title, definition-list, dlitem, list, listitem,
 * heading-order, empty-heading, empty-table-header, duplicate-id,
 * duplicate-id-aria, nested-interactive, page-has-heading-one
 */
import { makeCheck } from "../rule-engine.js";
import { isHiddenOrAncestorHidden, findByTag, getNodeText, isInteractive, } from "../tree.js";
import { getAccessibleName } from "../utils/accessible-name.js";
/* ------------------------------------------------------------------ */
/*  document-title                                                     */
/* ------------------------------------------------------------------ */
const documentTitle = {
    ruleId: "document-title",
    run(nodes) {
        const violations = [];
        const passes = [];
        const checkDetails = new Map();
        const htmlNodes = findByTag(nodes, "html");
        if (htmlNodes.length === 0)
            return { violations, passes, checkDetails };
        const htmlNode = htmlNodes[0];
        const headNodes = findByTag(nodes, "head");
        const titleNodes = findByTag(nodes, "title");
        // Find <title> inside <head>
        const titleInHead = titleNodes.find((t) => {
            let p = t.parent;
            while (p) {
                if (p.tag === "head")
                    return true;
                p = p.parent;
            }
            return false;
        });
        if (titleInHead && getNodeText(titleInHead).trim()) {
            passes.push(htmlNode);
            checkDetails.set(htmlNode, {
                any: [makeCheck("document-title", "serious", "Document has a non-empty <title> element")],
            });
        }
        else {
            violations.push(htmlNode);
            checkDetails.set(htmlNode, {
                any: [makeCheck("document-title", "serious", titleInHead
                        ? "Document has an empty <title> element"
                        : "Document does not have a <title> element")],
            });
        }
        return { violations, passes, checkDetails };
    },
};
/* ------------------------------------------------------------------ */
/*  definition-list                                                    */
/* ------------------------------------------------------------------ */
const definitionList = {
    ruleId: "definition-list",
    run(nodes) {
        const violations = [];
        const passes = [];
        const checkDetails = new Map();
        const allowed = new Set(["dt", "dd", "div", "script", "template"]);
        for (const node of findByTag(nodes, "dl")) {
            if (isHiddenOrAncestorHidden(node))
                continue;
            // Check if this <dl> has a role override
            if (node.attrs.role && node.attrs.role !== "list" && node.attrs.role !== "none" && node.attrs.role !== "presentation") {
                passes.push(node);
                continue;
            }
            const invalidChildren = node.children.filter((c) => !allowed.has(c.tag));
            if (invalidChildren.length > 0) {
                violations.push(node);
                const badTags = invalidChildren.map((c) => "<" + c.tag + ">").join(", ");
                checkDetails.set(node, {
                    all: [makeCheck("definition-list", "serious", "List has invalid child element(s): " + badTags)],
                });
            }
            else {
                passes.push(node);
                checkDetails.set(node, {
                    all: [makeCheck("definition-list", "serious", "List has only allowed child elements")],
                });
            }
        }
        return { violations, passes, checkDetails };
    },
};
/* ------------------------------------------------------------------ */
/*  dlitem                                                             */
/* ------------------------------------------------------------------ */
const dlitem = {
    ruleId: "dlitem",
    run(nodes) {
        const violations = [];
        const passes = [];
        const checkDetails = new Map();
        for (const node of nodes) {
            if (node.tag !== "dt" && node.tag !== "dd")
                continue;
            if (isHiddenOrAncestorHidden(node))
                continue;
            // Walk up to find <dl> ancestor (may be wrapped in <div> per spec)
            let parent = node.parent;
            let foundDl = false;
            while (parent) {
                if (parent.tag === "dl") {
                    foundDl = true;
                    break;
                }
                // Spec allows <div> wrapper inside <dl>
                if (parent.tag === "div") {
                    parent = parent.parent;
                    continue;
                }
                break;
            }
            if (foundDl) {
                passes.push(node);
                checkDetails.set(node, {
                    any: [makeCheck("dlitem", "serious", "Element is contained by a <dl>")],
                });
            }
            else {
                violations.push(node);
                checkDetails.set(node, {
                    any: [makeCheck("dlitem", "serious", "Element is not contained by a <dl>")],
                });
            }
        }
        return { violations, passes, checkDetails };
    },
};
/* ------------------------------------------------------------------ */
/*  list                                                               */
/* ------------------------------------------------------------------ */
const list = {
    ruleId: "list",
    run(nodes) {
        const violations = [];
        const passes = [];
        const checkDetails = new Map();
        const allowed = new Set(["li", "script", "template"]);
        for (const node of nodes) {
            if (node.tag !== "ul" && node.tag !== "ol")
                continue;
            if (isHiddenOrAncestorHidden(node))
                continue;
            // If role is overridden, skip
            if (node.attrs.role && node.attrs.role !== "list") {
                passes.push(node);
                continue;
            }
            const invalidChildren = node.children.filter((c) => !allowed.has(c.tag));
            if (invalidChildren.length > 0) {
                violations.push(node);
                const badTags = invalidChildren.map((c) => "<" + c.tag + ">").join(", ");
                checkDetails.set(node, {
                    all: [makeCheck("list", "serious", "List has invalid child element(s): " + badTags)],
                });
            }
            else {
                passes.push(node);
                checkDetails.set(node, {
                    all: [makeCheck("list", "serious", "List has only allowed child elements")],
                });
            }
        }
        return { violations, passes, checkDetails };
    },
};
/* ------------------------------------------------------------------ */
/*  listitem                                                           */
/* ------------------------------------------------------------------ */
const listitem = {
    ruleId: "listitem",
    run(nodes) {
        const violations = [];
        const passes = [];
        const checkDetails = new Map();
        for (const node of findByTag(nodes, "li")) {
            if (isHiddenOrAncestorHidden(node))
                continue;
            const parent = node.parent;
            if (parent) {
                const parentTag = parent.tag;
                const parentRole = parent.attrs.role;
                if (parentTag === "ul" || parentTag === "ol" || parentTag === "menu" || parentRole === "list") {
                    passes.push(node);
                    checkDetails.set(node, {
                        any: [makeCheck("listitem", "serious", "Element is contained in a list")],
                    });
                    continue;
                }
            }
            violations.push(node);
            checkDetails.set(node, {
                any: [makeCheck("listitem", "serious", "Element is not contained in a <ul>, <ol>, or element with role=\"list\"")],
            });
        }
        return { violations, passes, checkDetails };
    },
};
/* ------------------------------------------------------------------ */
/*  heading-order                                                      */
/* ------------------------------------------------------------------ */
const headingOrder = {
    ruleId: "heading-order",
    run(nodes) {
        const violations = [];
        const passes = [];
        const checkDetails = new Map();
        const headings = nodes.filter((n) => /^h[1-6]$/.test(n.tag) && !isHiddenOrAncestorHidden(n));
        let prevLevel = 0;
        for (const node of headings) {
            const level = parseInt(node.tag.charAt(1), 10);
            if (prevLevel === 0 || level <= prevLevel + 1) {
                passes.push(node);
                checkDetails.set(node, {
                    any: [makeCheck("heading-order", "moderate", "Heading order is valid")],
                });
            }
            else {
                violations.push(node);
                checkDetails.set(node, {
                    any: [makeCheck("heading-order", "moderate", "Heading level jumps from h" + prevLevel + " to h" + level)],
                });
            }
            prevLevel = level;
        }
        return { violations, passes, checkDetails };
    },
};
/* ------------------------------------------------------------------ */
/*  empty-heading                                                      */
/* ------------------------------------------------------------------ */
const emptyHeading = {
    ruleId: "empty-heading",
    run(nodes, allNodes) {
        const violations = [];
        const passes = [];
        const checkDetails = new Map();
        const headings = nodes.filter((n) => /^h[1-6]$/.test(n.tag));
        for (const node of headings) {
            if (isHiddenOrAncestorHidden(node))
                continue;
            const name = getAccessibleName(node, allNodes);
            if (name) {
                passes.push(node);
                checkDetails.set(node, {
                    any: [makeCheck("empty-heading", "minor", "Heading has discernible text")],
                });
            }
            else {
                violations.push(node);
                checkDetails.set(node, {
                    any: [makeCheck("empty-heading", "minor", "Heading is empty")],
                });
            }
        }
        return { violations, passes, checkDetails };
    },
};
/* ------------------------------------------------------------------ */
/*  empty-table-header                                                 */
/* ------------------------------------------------------------------ */
const emptyTableHeader = {
    ruleId: "empty-table-header",
    run(nodes, allNodes) {
        const violations = [];
        const passes = [];
        const checkDetails = new Map();
        for (const node of findByTag(nodes, "th")) {
            if (isHiddenOrAncestorHidden(node))
                continue;
            const name = getAccessibleName(node, allNodes);
            if (name) {
                passes.push(node);
                checkDetails.set(node, {
                    any: [makeCheck("empty-table-header", "minor", "Table header has discernible text")],
                });
            }
            else {
                violations.push(node);
                checkDetails.set(node, {
                    any: [makeCheck("empty-table-header", "minor", "Table header is empty")],
                });
            }
        }
        return { violations, passes, checkDetails };
    },
};
/* ------------------------------------------------------------------ */
/*  duplicate-id                                                       */
/* ------------------------------------------------------------------ */
const duplicateId = {
    ruleId: "duplicate-id",
    run(nodes) {
        const violations = [];
        const passes = [];
        const checkDetails = new Map();
        const idMap = new Map();
        for (const node of nodes) {
            const id = node.attrs.id;
            if (!id)
                continue;
            const list = idMap.get(id);
            if (list) {
                list.push(node);
            }
            else {
                idMap.set(id, [node]);
            }
        }
        for (const [id, nodeList] of idMap) {
            if (nodeList.length > 1) {
                for (const node of nodeList) {
                    violations.push(node);
                    checkDetails.set(node, {
                        any: [makeCheck("duplicate-id", "minor", "Document has multiple elements with the same id attribute: " + id)],
                    });
                }
            }
            else {
                passes.push(nodeList[0]);
                checkDetails.set(nodeList[0], {
                    any: [makeCheck("duplicate-id", "minor", "Document has no elements with the same id")],
                });
            }
        }
        return { violations, passes, checkDetails };
    },
};
/* ------------------------------------------------------------------ */
/*  duplicate-id-aria                                                  */
/* ------------------------------------------------------------------ */
const duplicateIdAria = {
    ruleId: "duplicate-id-aria",
    run(nodes) {
        const violations = [];
        const passes = [];
        const checkDetails = new Map();
        // Collect all IDs referenced by aria-labelledby and aria-describedby
        const referencedIds = new Set();
        for (const node of nodes) {
            for (const attr of ["aria-labelledby", "aria-describedby"]) {
                const val = node.attrs[attr];
                if (val) {
                    for (const id of val.trim().split(/\s+/)) {
                        referencedIds.add(id);
                    }
                }
            }
        }
        if (referencedIds.size === 0)
            return { violations, passes, checkDetails };
        // Check for duplicates among referenced IDs
        const idMap = new Map();
        for (const node of nodes) {
            const id = node.attrs.id;
            if (!id || !referencedIds.has(id))
                continue;
            const list = idMap.get(id);
            if (list) {
                list.push(node);
            }
            else {
                idMap.set(id, [node]);
            }
        }
        for (const [id, nodeList] of idMap) {
            if (nodeList.length > 1) {
                for (const node of nodeList) {
                    violations.push(node);
                    checkDetails.set(node, {
                        any: [makeCheck("duplicate-id-aria", "critical", "Document has multiple elements referenced with ARIA with the same id attribute: " + id)],
                    });
                }
            }
            else {
                passes.push(nodeList[0]);
                checkDetails.set(nodeList[0], {
                    any: [makeCheck("duplicate-id-aria", "critical", "ARIA referenced id is unique")],
                });
            }
        }
        return { violations, passes, checkDetails };
    },
};
/* ------------------------------------------------------------------ */
/*  nested-interactive                                                 */
/* ------------------------------------------------------------------ */
const nestedInteractive = {
    ruleId: "nested-interactive",
    run(nodes) {
        const violations = [];
        const passes = [];
        const checkDetails = new Map();
        for (const node of nodes) {
            if (!isInteractive(node))
                continue;
            if (isHiddenOrAncestorHidden(node))
                continue;
            // Check if this interactive element contains other interactive elements
            const interactiveDescendants = findInteractiveDescendants(node);
            if (interactiveDescendants.length > 0) {
                violations.push(node);
                checkDetails.set(node, {
                    all: [makeCheck("nested-interactive", "serious", "Element has nested interactive element(s): " +
                            interactiveDescendants.map((d) => "<" + d.tag + ">").join(", "))],
                });
            }
            else {
                passes.push(node);
                checkDetails.set(node, {
                    all: [makeCheck("nested-interactive", "serious", "Element does not contain nested interactive elements")],
                });
            }
        }
        return { violations, passes, checkDetails };
    },
};
function findInteractiveDescendants(node) {
    const result = [];
    function walk(children) {
        for (const child of children) {
            if (isInteractive(child)) {
                result.push(child);
            }
            walk(child.children);
        }
    }
    walk(node.children);
    return result;
}
/* ------------------------------------------------------------------ */
/*  page-has-heading-one                                               */
/* ------------------------------------------------------------------ */
const pageHasHeadingOne = {
    ruleId: "page-has-heading-one",
    run(nodes, allNodes) {
        const violations = [];
        const passes = [];
        const checkDetails = new Map();
        const h1Nodes = findByTag(nodes, "h1").filter((n) => !isHiddenOrAncestorHidden(n));
        // Also check for role="heading" with aria-level="1"
        const roleHeadingOne = nodes.filter((n) => n.attrs.role === "heading" && n.attrs["aria-level"] === "1" && !isHiddenOrAncestorHidden(n));
        const allH1 = [...h1Nodes, ...roleHeadingOne];
        const htmlNodes = findByTag(nodes, "html");
        const target = htmlNodes[0] || nodes[0];
        if (!target)
            return { violations, passes, checkDetails };
        if (allH1.length > 0) {
            passes.push(target);
            checkDetails.set(target, {
                any: [makeCheck("page-has-heading-one", "moderate", "Page has at least one level-one heading")],
            });
        }
        else {
            violations.push(target);
            checkDetails.set(target, {
                any: [makeCheck("page-has-heading-one", "moderate", "Page does not have a level-one heading")],
            });
        }
        return { violations, passes, checkDetails };
    },
};
export const structureRules = [
    documentTitle,
    definitionList,
    dlitem,
    list,
    listitem,
    headingOrder,
    emptyHeading,
    emptyTableHeader,
    duplicateId,
    duplicateIdAria,
    nestedInteractive,
    pageHasHeadingOne,
];
//# sourceMappingURL=structure.js.map