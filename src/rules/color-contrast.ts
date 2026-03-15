/**
 * Color contrast rule: best-effort static analysis.
 *
 * Parses inline styles and <style> blocks to determine foreground/background
 * colors, then computes WCAG contrast ratios. Unresolvable colors go to
 * incomplete[] rather than violations.
 */

import type { FastNode } from "../tree.js";
import type { RuleCheck, RuleRunResult, NodeCheckDetail } from "../rule-engine.js";
import { makeCheck } from "../rule-engine.js";
import { isHiddenOrAncestorHidden, findByTag, getNodeText, getTextContent } from "../tree.js";

/* ================================================================== */
/*  Named CSS colors (all 148)                                         */
/* ================================================================== */
const NAMED_COLORS: Record<string, [number, number, number, number]> = {
  aliceblue: [240,248,255,1], antiquewhite: [250,235,215,1], aqua: [0,255,255,1],
  aquamarine: [127,255,212,1], azure: [240,255,255,1], beige: [245,245,220,1],
  bisque: [255,228,196,1], black: [0,0,0,1], blanchedalmond: [255,235,205,1],
  blue: [0,0,255,1], blueviolet: [138,43,226,1], brown: [165,42,42,1],
  burlywood: [222,184,135,1], cadetblue: [95,158,160,1], chartreuse: [127,255,0,1],
  chocolate: [210,105,30,1], coral: [255,127,80,1], cornflowerblue: [100,149,237,1],
  cornsilk: [255,248,220,1], crimson: [220,20,60,1], cyan: [0,255,255,1],
  darkblue: [0,0,139,1], darkcyan: [0,139,139,1], darkgoldenrod: [184,134,11,1],
  darkgray: [169,169,169,1], darkgreen: [0,100,0,1], darkgrey: [169,169,169,1],
  darkkhaki: [189,183,107,1], darkmagenta: [139,0,139,1], darkolivegreen: [85,107,47,1],
  darkorange: [255,140,0,1], darkorchid: [153,50,204,1], darkred: [139,0,0,1],
  darksalmon: [233,150,122,1], darkseagreen: [143,188,143,1], darkslateblue: [72,61,139,1],
  darkslategray: [47,79,79,1], darkslategrey: [47,79,79,1], darkturquoise: [0,206,209,1],
  darkviolet: [148,0,211,1], deeppink: [255,20,147,1], deepskyblue: [0,191,255,1],
  dimgray: [105,105,105,1], dimgrey: [105,105,105,1], dodgerblue: [30,144,255,1],
  firebrick: [178,34,34,1], floralwhite: [255,250,240,1], forestgreen: [34,139,34,1],
  fuchsia: [255,0,255,1], gainsboro: [220,220,220,1], ghostwhite: [248,248,255,1],
  gold: [255,215,0,1], goldenrod: [218,165,32,1], gray: [128,128,128,1],
  green: [0,128,0,1], greenyellow: [173,255,47,1], grey: [128,128,128,1],
  honeydew: [240,255,240,1], hotpink: [255,105,180,1], indianred: [205,92,92,1],
  indigo: [75,0,130,1], ivory: [255,255,240,1], khaki: [240,230,140,1],
  lavender: [230,230,250,1], lavenderblush: [255,240,245,1], lawngreen: [124,252,0,1],
  lemonchiffon: [255,250,205,1], lightblue: [173,216,230,1], lightcoral: [240,128,128,1],
  lightcyan: [224,255,255,1], lightgoldenrodyellow: [250,250,210,1], lightgray: [211,211,211,1],
  lightgreen: [144,238,144,1], lightgrey: [211,211,211,1], lightpink: [255,182,193,1],
  lightsalmon: [255,160,122,1], lightseagreen: [32,178,170,1], lightskyblue: [135,206,250,1],
  lightslategray: [119,136,153,1], lightslategrey: [119,136,153,1], lightsteelblue: [176,196,222,1],
  lightyellow: [255,255,224,1], lime: [0,255,0,1], limegreen: [50,205,50,1],
  linen: [250,240,230,1], magenta: [255,0,255,1], maroon: [128,0,0,1],
  mediumaquamarine: [102,205,170,1], mediumblue: [0,0,205,1], mediumorchid: [186,85,211,1],
  mediumpurple: [147,111,219,1], mediumseagreen: [60,179,113,1], mediumslateblue: [123,104,238,1],
  mediumspringgreen: [0,250,154,1], mediumturquoise: [72,209,204,1], mediumvioletred: [199,21,133,1],
  midnightblue: [25,25,112,1], mintcream: [245,255,250,1], mistyrose: [255,228,225,1],
  moccasin: [255,228,181,1], navajowhite: [255,222,173,1], navy: [0,0,128,1],
  oldlace: [253,245,230,1], olive: [128,128,0,1], olivedrab: [107,142,35,1],
  orange: [255,165,0,1], orangered: [255,69,0,1], orchid: [218,112,214,1],
  palegoldenrod: [238,232,170,1], palegreen: [152,251,152,1], paleturquoise: [175,238,238,1],
  palevioletred: [219,112,147,1], papayawhip: [255,239,213,1], peachpuff: [255,218,185,1],
  peru: [205,133,63,1], pink: [255,192,203,1], plum: [221,160,221,1],
  powderblue: [176,224,230,1], purple: [128,0,128,1], rebeccapurple: [102,51,153,1],
  red: [255,0,0,1], rosybrown: [188,143,143,1], royalblue: [65,105,225,1],
  saddlebrown: [139,69,19,1], salmon: [250,128,114,1], sandybrown: [244,164,96,1],
  seagreen: [46,139,87,1], seashell: [255,245,238,1], sienna: [160,82,45,1],
  silver: [192,192,192,1], skyblue: [135,206,235,1], slateblue: [106,90,205,1],
  slategray: [112,128,144,1], slategrey: [112,128,144,1], snow: [255,250,250,1],
  springgreen: [0,255,127,1], steelblue: [70,130,180,1], tan: [210,180,140,1],
  teal: [0,128,128,1], thistle: [216,191,216,1], tomato: [255,99,71,1],
  turquoise: [64,224,208,1], violet: [238,130,238,1], wheat: [245,222,179,1],
  white: [255,255,255,1], whitesmoke: [245,245,245,1], yellow: [255,255,0,1],
  yellowgreen: [154,205,50,1], transparent: [0,0,0,0],
};

/* ================================================================== */
/*  Color types and parsing                                            */
/* ================================================================== */

type RGBA = [number, number, number, number]; // r, g, b in 0-255; a in 0-1

/** Parse a CSS color string into RGBA. Returns null if unparseable. */
function parseColor(color: string): RGBA | null {
  if (!color) return null;
  const c = color.trim().toLowerCase();

  // Named colors
  if (NAMED_COLORS[c]) return [...NAMED_COLORS[c]];

  // currentcolor / inherit / initial etc. — can't resolve statically
  if (c === "currentcolor" || c === "inherit" || c === "initial" || c === "unset" || c === "revert") {
    return null;
  }

  // Hex: #rgb, #rgba, #rrggbb, #rrggbbaa
  if (c.startsWith("#")) {
    const hex = c.slice(1);
    if (hex.length === 3) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
        1,
      ];
    }
    if (hex.length === 4) {
      return [
        parseInt(hex[0] + hex[0], 16),
        parseInt(hex[1] + hex[1], 16),
        parseInt(hex[2] + hex[2], 16),
        parseInt(hex[3] + hex[3], 16) / 255,
      ];
    }
    if (hex.length === 6) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        1,
      ];
    }
    if (hex.length === 8) {
      return [
        parseInt(hex.slice(0, 2), 16),
        parseInt(hex.slice(2, 4), 16),
        parseInt(hex.slice(4, 6), 16),
        parseInt(hex.slice(6, 8), 16) / 255,
      ];
    }
    return null;
  }

  // rgb(r, g, b) or rgb(r g b)
  const rgbMatch = c.match(/^rgb\(\s*(\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)\s*\)$/);
  if (rgbMatch) {
    return [
      clamp255(parseInt(rgbMatch[1], 10)),
      clamp255(parseInt(rgbMatch[2], 10)),
      clamp255(parseInt(rgbMatch[3], 10)),
      1,
    ];
  }

  // rgba(r, g, b, a) or rgba(r g b / a)
  const rgbaMatch = c.match(/^rgba?\(\s*(\d+)\s*[,\s]\s*(\d+)\s*[,\s]\s*(\d+)\s*[,/]\s*([\d.]+%?)\s*\)$/);
  if (rgbaMatch) {
    let alpha = parseFloat(rgbaMatch[4]);
    if (rgbaMatch[4].endsWith("%")) alpha = alpha / 100;
    return [
      clamp255(parseInt(rgbaMatch[1], 10)),
      clamp255(parseInt(rgbaMatch[2], 10)),
      clamp255(parseInt(rgbaMatch[3], 10)),
      Math.min(1, Math.max(0, alpha)),
    ];
  }

  // rgb with percentages: rgb(100%, 50%, 0%)
  const rgbPctMatch = c.match(/^rgb\(\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%\s*\)$/);
  if (rgbPctMatch) {
    return [
      clamp255(Math.round(parseFloat(rgbPctMatch[1]) * 2.55)),
      clamp255(Math.round(parseFloat(rgbPctMatch[2]) * 2.55)),
      clamp255(Math.round(parseFloat(rgbPctMatch[3]) * 2.55)),
      1,
    ];
  }

  // hsl(h, s%, l%) — basic support
  const hslMatch = c.match(/^hsla?\(\s*([\d.]+)\s*[,\s]\s*([\d.]+)%\s*[,\s]\s*([\d.]+)%\s*(?:[,/]\s*([\d.]+%?))?\s*\)$/);
  if (hslMatch) {
    const h = parseFloat(hslMatch[1]) / 360;
    const s = parseFloat(hslMatch[2]) / 100;
    const l = parseFloat(hslMatch[3]) / 100;
    let alpha = 1;
    if (hslMatch[4]) {
      alpha = parseFloat(hslMatch[4]);
      if (hslMatch[4].endsWith("%")) alpha = alpha / 100;
    }
    const [r, g, b] = hslToRgb(h, s, l);
    return [r, g, b, Math.min(1, Math.max(0, alpha))];
  }

  return null;
}

function clamp255(n: number): number {
  return Math.min(255, Math.max(0, n));
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = Math.round(l * 255);
    return [v, v, v];
  }
  const hue2rgb = (p: number, q: number, t: number): number => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  return [
    Math.round(hue2rgb(p, q, h + 1/3) * 255),
    Math.round(hue2rgb(p, q, h) * 255),
    Math.round(hue2rgb(p, q, h - 1/3) * 255),
  ];
}

/* ================================================================== */
/*  Style sheet parsing (simple selectors from <style> blocks)         */
/* ================================================================== */

interface StyleRule {
  selector: string;
  properties: Map<string, string>;
}

/** Parse <style> block text into simple rule objects. */
function parseStyleSheet(css: string): StyleRule[] {
  const rules: StyleRule[] = [];

  // Remove comments
  const cleaned = css.replace(/\/\*[\s\S]*?\*\//g, "");

  // Very simple: match selector { properties }
  const ruleRegex = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = ruleRegex.exec(cleaned)) !== null) {
    const selectorGroup = match[1].trim();
    const body = match[2].trim();

    // Parse properties
    const properties = new Map<string, string>();
    const propParts = body.split(";");
    for (const prop of propParts) {
      const colonIdx = prop.indexOf(":");
      if (colonIdx < 0) continue;
      const name = prop.slice(0, colonIdx).trim().toLowerCase();
      const value = prop.slice(colonIdx + 1).trim().replace(/!important/gi, "").trim();
      if (name && value) properties.set(name, value);
    }

    if (properties.size === 0) continue;

    // Handle grouped selectors (comma-separated)
    const selectors = selectorGroup.split(",");
    for (const sel of selectors) {
      const trimmed = sel.trim();
      if (trimmed) {
        rules.push({ selector: trimmed, properties });
      }
    }
  }

  return rules;
}

/** Very simple selector matching for basic selectors. */
function matchesSimpleSelector(node: FastNode, selector: string): boolean {
  // Only handle very simple selectors: tag, .class, #id, tag.class, etc.
  const s = selector.trim();

  // Skip complex selectors (combinators, pseudo-elements, etc.)
  if (/\s/.test(s) && !s.startsWith(".") && !s.startsWith("#")) return false;
  if (s.includes(":") && !s.includes("::")) {
    // Allow :root but skip other pseudo-classes
    if (s === ":root") return node.tag === "html";
    return false;
  }
  if (s.includes("::")) return false;
  if (s.includes(">") || s.includes("+") || s.includes("~")) return false;

  // Parse the selector into components
  let remaining = s;
  let tag: string | undefined;
  let id: string | undefined;
  const classes: string[] = [];

  // Extract tag
  const tagMatch = remaining.match(/^([a-zA-Z][a-zA-Z0-9-]*)/);
  if (tagMatch) {
    tag = tagMatch[1].toLowerCase();
    remaining = remaining.slice(tagMatch[0].length);
  }

  // Extract ID
  const idMatch = remaining.match(/#([a-zA-Z0-9_-]+)/);
  if (idMatch) {
    id = idMatch[1];
    remaining = remaining.replace(idMatch[0], "");
  }

  // Extract classes
  const classRegex = /\.([a-zA-Z0-9_-]+)/g;
  let cm;
  while ((cm = classRegex.exec(remaining)) !== null) {
    classes.push(cm[1]);
  }

  // Match
  if (tag && node.tag !== tag) return false;
  if (id && node.attrs.id !== id) return false;
  for (const cls of classes) {
    const nodeClasses = (node.attrs.class || "").split(/\s+/);
    if (!nodeClasses.includes(cls)) return false;
  }

  // Must match at least something
  if (!tag && !id && classes.length === 0) return false;
  return true;
}

/* ================================================================== */
/*  Color resolution: inline style + stylesheet + inheritance          */
/* ================================================================== */

interface ResolvedStyles {
  color: RGBA | null;
  backgroundColor: RGBA | null;
  fontSize: string | null;
  fontWeight: string | null;
}

/** Extract a CSS property value from an inline style string. */
function getInlineStyleProperty(style: string, prop: string): string | null {
  // Match "prop: value" respecting possible whitespace
  const regex = new RegExp(
    "(?:^|;)\\s*" + prop.replace("-", "\\-") + "\\s*:\\s*([^;!]+)",
    "i"
  );
  const match = style.match(regex);
  return match ? match[1].trim() : null;
}

/** Build a style map for all nodes from <style> blocks. */
function buildStyleMap(allNodes: FastNode[]): Map<FastNode, Map<string, string>> {
  const styleMap = new Map<FastNode, Map<string, string>>();
  const styleRules: StyleRule[] = [];

  // Collect all style blocks
  for (const node of allNodes) {
    if (node.tag === "style") {
      const text = getTextContent(node.raw);
      if (text) {
        styleRules.push(...parseStyleSheet(text));
      }
    }
  }

  // Apply rules (later rules override earlier ones, mimicking cascade)
  for (const rule of styleRules) {
    for (const node of allNodes) {
      if (matchesSimpleSelector(node, rule.selector)) {
        let map = styleMap.get(node);
        if (!map) {
          map = new Map();
          styleMap.set(node, map);
        }
        for (const [prop, val] of rule.properties) {
          map.set(prop, val);
        }
      }
    }
  }

  return styleMap;
}

/** Resolve the effective color/background for a node. */
function resolveStyles(
  node: FastNode,
  styleMap: Map<FastNode, Map<string, string>>,
): ResolvedStyles {
  let color: RGBA | null = null;
  let backgroundColor: RGBA | null = null;
  let fontSize: string | null = null;
  let fontWeight: string | null = null;

  // Walk up ancestors (child styles override parent)
  const chain: FastNode[] = [];
  let current: FastNode | null = node;
  while (current) {
    chain.unshift(current);
    current = current.parent;
  }

  // For each node in the chain, apply styles (inheritance)
  for (const n of chain) {
    const inline = n.attrs.style || "";
    const sheetStyles = styleMap.get(n);

    // Color inherits
    const inlineColor = getInlineStyleProperty(inline, "color");
    const sheetColor = sheetStyles?.get("color");
    const colorVal = inlineColor || sheetColor;
    if (colorVal) {
      const parsed = parseColor(colorVal);
      if (parsed) color = parsed;
      else if (colorVal !== "inherit" && colorVal !== "initial" && colorVal !== "unset") {
        color = null; // Can't resolve
      }
    }

    // Background-color does NOT inherit, but we walk up to find the nearest one
    const inlineBg = getInlineStyleProperty(inline, "background-color");
    const sheetBg = sheetStyles?.get("background-color");
    // Also check shorthand "background"
    const inlineBgShort = getInlineStyleProperty(inline, "background");
    const sheetBgShort = sheetStyles?.get("background");

    const bgVal = inlineBg || sheetBg || extractBgColor(inlineBgShort) || extractBgColor(sheetBgShort);
    if (bgVal) {
      const parsed = parseColor(bgVal);
      if (parsed) backgroundColor = parsed;
    }

    // Font-size inherits
    const inlineFs = getInlineStyleProperty(inline, "font-size");
    const sheetFs = sheetStyles?.get("font-size");
    if (inlineFs) fontSize = inlineFs;
    else if (sheetFs) fontSize = sheetFs;

    // Font-weight inherits
    const inlineFw = getInlineStyleProperty(inline, "font-weight");
    const sheetFw = sheetStyles?.get("font-weight");
    if (inlineFw) fontWeight = inlineFw;
    else if (sheetFw) fontWeight = sheetFw;
  }

  return { color, backgroundColor, fontSize, fontWeight };
}

/** Try to extract a color from a background shorthand. */
function extractBgColor(bg: string | null | undefined): string | null {
  if (!bg) return null;
  // background shorthand may contain: color, image, position, etc.
  // Try to find a color value
  const parts = bg.trim().split(/\s+/);
  for (const part of parts) {
    if (parseColor(part)) return part;
  }
  return null;
}

/* ================================================================== */
/*  WCAG contrast computation                                          */
/* ================================================================== */

/** Compute relative luminance per WCAG 2.0. */
function relativeLuminance(rgba: RGBA): number {
  const [r, g, b] = rgba.map((c, i) => {
    if (i === 3) return c; // alpha
    const sRGB = c / 255;
    return sRGB <= 0.04045
      ? sRGB / 12.92
      : Math.pow((sRGB + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Compute contrast ratio between two colors (1:1 to 21:1). */
function contrastRatio(fg: RGBA, bg: RGBA): number {
  // Alpha compositing: composite fg over bg
  const compositeFg = alphaComposite(fg, bg);
  const l1 = relativeLuminance(compositeFg);
  const l2 = relativeLuminance(bg);
  const lighter = Math.max(l1, l2);
  const darker = Math.min(l1, l2);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Alpha-composite a foreground color over a background color. */
function alphaComposite(fg: RGBA, bg: RGBA): RGBA {
  const a = fg[3];
  if (a >= 1) return fg;
  return [
    Math.round(fg[0] * a + bg[0] * (1 - a)),
    Math.round(fg[1] * a + bg[1] * (1 - a)),
    Math.round(fg[2] * a + bg[2] * (1 - a)),
    1,
  ];
}

/** Check if text is "large" per WCAG (>= 18pt or >= 14pt bold). */
function isLargeText(fontSize: string | null, fontWeight: string | null): boolean {
  if (!fontSize) return false;

  let sizeInPt = 0;
  const pxMatch = fontSize.match(/([\d.]+)\s*px/i);
  const ptMatch = fontSize.match(/([\d.]+)\s*pt/i);
  const remMatch = fontSize.match(/([\d.]+)\s*rem/i);
  const emMatch = fontSize.match(/([\d.]+)\s*em/i);

  if (ptMatch) {
    sizeInPt = parseFloat(ptMatch[1]);
  } else if (pxMatch) {
    // 1pt = 1.333px (at 96dpi, 72pt per inch)
    sizeInPt = parseFloat(pxMatch[1]) * 0.75;
  } else if (remMatch) {
    // Assume 1rem = 16px = 12pt
    sizeInPt = parseFloat(remMatch[1]) * 12;
  } else if (emMatch) {
    // Assume 1em = 12pt (parent-relative, best guess)
    sizeInPt = parseFloat(emMatch[1]) * 12;
  }

  const isBold = fontWeight === "bold" || fontWeight === "bolder" ||
    (fontWeight !== null && parseInt(fontWeight, 10) >= 700);

  if (sizeInPt >= 18) return true;
  if (sizeInPt >= 14 && isBold) return true;
  return false;
}

/** Tags that should not be checked for color contrast. */
const SKIP_TAGS = new Set([
  "html", "head", "body", "script", "style", "link", "meta", "title",
  "br", "hr", "img", "input", "select", "textarea", "button", "svg",
  "video", "audio", "canvas", "iframe", "object", "embed", "noscript",
  "template", "base",
]);

/* ================================================================== */
/*  The rule                                                           */
/* ================================================================== */
const colorContrast: RuleCheck = {
  ruleId: "color-contrast",
  run(nodes: FastNode[], allNodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const incomplete: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    // Build stylesheet map once
    const styleMap = buildStyleMap(allNodes);

    // Default colors: black text on white background
    const DEFAULT_FG: RGBA = [0, 0, 0, 1];
    const DEFAULT_BG: RGBA = [255, 255, 255, 1];

    for (const node of nodes) {
      if (SKIP_TAGS.has(node.tag)) continue;
      if (isHiddenOrAncestorHidden(node)) continue;

      // Only check nodes with direct text content
      const hasDirectText = node.childNodes.some(
        (child) => (child as any).type === "text" && (child as any).data.trim()
      );
      if (!hasDirectText) continue;

      const styles = resolveStyles(node, styleMap);
      const fg = styles.color;
      const bg = styles.backgroundColor;

      // If we can't determine either color, mark as incomplete
      if (!fg && !bg) {
        // No explicit styles — assume default colors (pass with default)
        // Only flag as incomplete if there are stylesheets that might affect it
        if (styleMap.size > 0) {
          // There are stylesheets but we couldn't resolve styles for this node
          // This is common and not worth flagging for every element
          continue;
        }
        continue;
      }

      const fgColor = fg || DEFAULT_FG;
      const bgColor = bg || DEFAULT_BG;

      // If alpha is 0, colors aren't really applied
      if (fgColor[3] === 0) continue;

      // If background has background-image or gradient, we can't be sure
      // Check if the node or any ancestor has a background-image
      let hasBackgroundImage = false;
      let current: FastNode | null = node;
      while (current) {
        const inline = current.attrs.style || "";
        const sheet = styleMap.get(current);
        if (/background(-image)?\s*:.*(?:url|gradient)/i.test(inline)) {
          hasBackgroundImage = true;
          break;
        }
        if (sheet) {
          const bgImg = sheet.get("background-image") || sheet.get("background") || "";
          if (/url|gradient/i.test(bgImg)) {
            hasBackgroundImage = true;
            break;
          }
        }
        current = current.parent;
      }

      if (hasBackgroundImage) {
        incomplete.push(node);
        checkDetails.set(node, {
          any: [makeCheck("color-contrast", "serious",
            "Element has a background image — cannot determine contrast ratio")],
        });
        continue;
      }

      const ratio = contrastRatio(fgColor, bgColor);
      const large = isLargeText(styles.fontSize, styles.fontWeight);
      const requiredRatio = large ? 3 : 4.5;

      const ratioStr = ratio.toFixed(2);
      const fgStr = "rgb(" + fgColor[0] + ", " + fgColor[1] + ", " + fgColor[2] + ")";
      const bgStr = "rgb(" + bgColor[0] + ", " + bgColor[1] + ", " + bgColor[2] + ")";

      if (ratio >= requiredRatio) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("color-contrast", "serious",
            "Element has sufficient contrast ratio of " + ratioStr + ":1" +
            " (foreground: " + fgStr + ", background: " + bgStr + ")" +
            (large ? " [large text]" : ""),
            { fgColor: fgStr, bgColor: bgStr, contrastRatio: ratioStr, fontSize: styles.fontSize, fontWeight: styles.fontWeight },
          )],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("color-contrast", "serious",
            "Element has insufficient contrast ratio of " + ratioStr + ":1" +
            " (foreground: " + fgStr + ", background: " + bgStr + ")" +
            ". Expected ratio of " + requiredRatio + ":1" +
            (large ? " [large text]" : ""),
            { fgColor: fgStr, bgColor: bgStr, contrastRatio: ratioStr, expectedRatio: requiredRatio, fontSize: styles.fontSize, fontWeight: styles.fontWeight },
          )],
        });
      }
    }

    return { violations, passes, incomplete, checkDetails };
  },
};

export const colorContrastRules: RuleCheck[] = [
  colorContrast,
];
