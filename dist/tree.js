/**
 * Lightweight DOM tree built from htmlparser2 output.
 * Provides parent/child traversal, attribute access, text extraction,
 * CSS selector generation, and outerHTML snippets.
 */
import { parseDocument } from "htmlparser2";
/** Parse HTML string into a domhandler Document. */
export function parse(html) {
    return parseDocument(html, {
        decodeEntities: true,
        recognizeSelfClosing: true,
    });
}
/** Build a flat list of FastNodes from a Document for easy iteration. */
export function buildTree(doc) {
    const nodes = [];
    function walk(children, parent, depth) {
        for (const child of children) {
            if (child.type !== "tag" && child.type !== "script" && child.type !== "style")
                continue;
            const el = child;
            const node = {
                raw: el,
                tag: el.tagName.toLowerCase(),
                attrs: el.attribs || {},
                parent,
                children: [],
                childNodes: el.childNodes || [],
                depth,
            };
            if (parent)
                parent.children.push(node);
            nodes.push(node);
            walk(el.childNodes || [], node, depth + 1);
        }
    }
    walk(doc.childNodes || [], null, 0);
    return nodes;
}
/** Get text content of an element (recursive, like textContent). */
export function getTextContent(node) {
    if ("data" in node && node.type === "text") {
        return node.data;
    }
    const children = "childNodes" in node
        ? node.childNodes
        : "children" in node && Array.isArray(node.children)
            ? node.children
            : [];
    let text = "";
    for (const child of children) {
        if (child.type === "text") {
            text += child.data;
        }
        else if (child.type === "tag") {
            text += getTextContent(child);
        }
    }
    return text;
}
/** Get text content from a FastNode. */
export function getNodeText(node) {
    return getTextContent(node.raw).trim();
}
/** Generate a CSS selector path for a node (for axe-compatible target[]). */
export function getSelector(node) {
    const parts = [];
    let current = node;
    while (current) {
        let selector = current.tag;
        if (current.attrs.id) {
            selector = `#${cssEscape(current.attrs.id)}`;
            parts.unshift(selector);
            break;
        }
        // Add nth-child if there are siblings with the same tag
        if (current.parent) {
            const sameTagSiblings = current.parent.children.filter((c) => c.tag === current.tag);
            if (sameTagSiblings.length > 1) {
                const idx = sameTagSiblings.indexOf(current) + 1;
                selector += `:nth-child(${idx})`;
            }
        }
        parts.unshift(selector);
        current = current.parent;
    }
    return parts.join(" > ");
}
/** Generate an outerHTML snippet for a node (truncated for readability). */
export function getOuterHTML(node, maxLength = 250) {
    const tag = node.tag;
    const attrStr = Object.entries(node.attrs)
        .map(([k, v]) => v === "" ? k : `${k}="${escapeAttr(v)}"`)
        .join(" ");
    const open = attrStr ? `<${tag} ${attrStr}>` : `<${tag}>`;
    // Self-closing tags
    const voidTags = new Set([
        "area", "base", "br", "col", "embed", "hr", "img", "input",
        "link", "meta", "param", "source", "track", "wbr",
    ]);
    if (voidTags.has(tag)) {
        return open.length > maxLength ? open.slice(0, maxLength) + "..." : open;
    }
    const innerText = getNodeText(node);
    const inner = innerText.length > 50 ? innerText.slice(0, 50) + "..." : innerText;
    const full = `${open}${inner}</${tag}>`;
    return full.length > maxLength ? full.slice(0, maxLength) + "..." : full;
}
/** Find all nodes matching a tag name. */
export function findByTag(nodes, tag) {
    return nodes.filter((n) => n.tag === tag);
}
/** Find all nodes matching a CSS selector (simple: tag, #id, .class, [attr]). */
export function querySelectorAll(nodes, selector) {
    // Simple selector matching — handles tag, #id, .class, [attr], [attr=val]
    const parts = parseSimpleSelector(selector);
    return nodes.filter((n) => matchesSelector(n, parts));
}
function parseSimpleSelector(selector) {
    const parts = { classes: [], attrs: [] };
    let s = selector.trim();
    // Tag
    const tagMatch = s.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
    if (tagMatch) {
        parts.tag = tagMatch[1].toLowerCase();
        s = s.slice(tagMatch[0].length);
    }
    // ID
    const idMatch = s.match(/#([a-zA-Z0-9_-]+)/);
    if (idMatch) {
        parts.id = idMatch[1];
        s = s.replace(idMatch[0], "");
    }
    // Classes
    const classRegex = /\.([a-zA-Z0-9_-]+)/g;
    let cm;
    while ((cm = classRegex.exec(s)) !== null) {
        parts.classes.push(cm[1]);
    }
    // Attributes
    const attrRegex = /\[([a-zA-Z0-9_-]+)(?:([~|^$*]?=)"?([^"\]]*)"?)?\]/g;
    let am;
    while ((am = attrRegex.exec(s)) !== null) {
        parts.attrs.push({ name: am[1], op: am[2], value: am[3] });
    }
    return parts;
}
function matchesSelector(node, parts) {
    if (parts.tag && node.tag !== parts.tag)
        return false;
    if (parts.id && node.attrs.id !== parts.id)
        return false;
    for (const cls of parts.classes) {
        const classes = (node.attrs.class || "").split(/\s+/);
        if (!classes.includes(cls))
            return false;
    }
    for (const attr of parts.attrs) {
        const val = node.attrs[attr.name];
        if (val === undefined)
            return false;
        if (attr.op === "=" && val !== attr.value)
            return false;
        if (attr.op === "~=" && !val.split(/\s+/).includes(attr.value))
            return false;
        if (attr.op === "|=" && val !== attr.value && !val.startsWith(attr.value + "-"))
            return false;
        if (attr.op === "^=" && !val.startsWith(attr.value))
            return false;
        if (attr.op === "$=" && !val.endsWith(attr.value))
            return false;
        if (attr.op === "*=" && !val.includes(attr.value))
            return false;
    }
    return true;
}
/** Find a node by ID. */
export function findById(nodes, id) {
    return nodes.find((n) => n.attrs.id === id);
}
/** Check if a node has a specific role (explicit or implicit). */
export function getRole(node) {
    if (node.attrs.role)
        return node.attrs.role;
    // Implicit roles for common elements
    const implicitRoles = {
        a: (n) => n.attrs.href !== undefined ? "link" : undefined,
        article: "article",
        aside: "complementary",
        button: "button",
        details: "group",
        dialog: "dialog",
        footer: "contentinfo",
        form: "form",
        h1: "heading",
        h2: "heading",
        h3: "heading",
        h4: "heading",
        h5: "heading",
        h6: "heading",
        header: "banner",
        hr: "separator",
        img: (n) => n.attrs.alt === "" ? "presentation" : "img",
        input: (n) => {
            const type = (n.attrs.type || "text").toLowerCase();
            const typeRoles = {
                button: "button",
                checkbox: "checkbox",
                email: "textbox",
                image: "button",
                number: "spinbutton",
                radio: "radio",
                range: "slider",
                reset: "button",
                search: "searchbox",
                submit: "button",
                tel: "textbox",
                text: "textbox",
                url: "textbox",
            };
            return typeRoles[type];
        },
        li: "listitem",
        main: "main",
        math: "math",
        menu: "list",
        nav: "navigation",
        ol: "list",
        optgroup: "group",
        option: "option",
        output: "status",
        progress: "progressbar",
        section: (n) => n.attrs["aria-label"] || n.attrs["aria-labelledby"] ? "region" : undefined,
        select: (n) => n.attrs.multiple !== undefined || (parseInt(n.attrs.size || "1") > 1) ? "listbox" : "combobox",
        summary: "button",
        table: "table",
        tbody: "rowgroup",
        td: "cell",
        textarea: "textbox",
        tfoot: "rowgroup",
        th: (n) => n.attrs.scope === "col" ? "columnheader" : "rowheader",
        thead: "rowgroup",
        tr: "row",
        ul: "list",
    };
    const mapping = implicitRoles[node.tag];
    if (typeof mapping === "function")
        return mapping(node);
    return mapping;
}
/** Check if a node is focusable. */
export function isFocusable(node) {
    // Explicitly non-focusable
    if (node.attrs.disabled !== undefined)
        return false;
    if (node.attrs.tabindex === "-1")
        return false;
    // Has positive tabindex
    if (node.attrs.tabindex !== undefined)
        return true;
    // Natively focusable elements
    const focusableTags = new Set(["a", "button", "input", "select", "textarea", "summary"]);
    if (focusableTags.has(node.tag)) {
        if (node.tag === "a" && node.attrs.href === undefined)
            return false;
        return true;
    }
    return false;
}
/** Check if a node is interactive. */
export function isInteractive(node) {
    const interactiveTags = new Set(["a", "button", "input", "select", "textarea", "summary", "details"]);
    if (interactiveTags.has(node.tag)) {
        if (node.tag === "a" && node.attrs.href === undefined)
            return false;
        if (node.tag === "input" && node.attrs.type === "hidden")
            return false;
        return true;
    }
    if (node.attrs.tabindex !== undefined && node.attrs.tabindex !== "-1")
        return true;
    const role = node.attrs.role;
    if (role) {
        const interactiveRoles = new Set([
            "button", "link", "checkbox", "radio", "tab", "switch",
            "menuitem", "menuitemcheckbox", "menuitemradio", "option",
            "combobox", "textbox", "searchbox", "spinbutton", "slider",
        ]);
        if (interactiveRoles.has(role))
            return true;
    }
    return false;
}
/** Check if a node is hidden via static analysis. */
export function isHidden(node) {
    if (node.attrs.hidden !== undefined)
        return true;
    if (node.attrs["aria-hidden"] === "true")
        return true;
    if (node.tag === "input" && node.attrs.type === "hidden")
        return true;
    const style = node.attrs.style || "";
    if (/display\s*:\s*none/i.test(style))
        return true;
    if (/visibility\s*:\s*hidden/i.test(style))
        return true;
    return false;
}
/** Check if a node or any ancestor is hidden. */
export function isHiddenOrAncestorHidden(node) {
    let current = node;
    while (current) {
        if (isHidden(current))
            return true;
        current = current.parent;
    }
    return false;
}
/** Escape a string for use in a CSS selector. */
function cssEscape(str) {
    return str.replace(/([^\w-])/g, "\\$1");
}
/** Escape a string for use in an HTML attribute. */
function escapeAttr(str) {
    return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
//# sourceMappingURL=tree.js.map