/**
 * Language rules: html-has-lang, html-lang-valid, html-xml-lang-mismatch, valid-lang
 */

import type { FastNode } from "../tree.js";
import type { RuleCheck, RuleRunResult, NodeCheckDetail } from "../rule-engine.js";
import { makeCheck } from "../rule-engine.js";
import { isHiddenOrAncestorHidden, findByTag } from "../tree.js";

/**
 * ISO 639-1 primary language subtags.
 * This covers the vast majority of lang values encountered on the web.
 */
const VALID_LANG_SUBTAGS = new Set([
  "aa", "ab", "af", "ak", "am", "an", "ar", "as", "av", "ay", "az",
  "ba", "be", "bg", "bh", "bi", "bm", "bn", "bo", "br", "bs",
  "ca", "ce", "ch", "co", "cr", "cs", "cu", "cv", "cy",
  "da", "de", "dv", "dz",
  "ee", "el", "en", "eo", "es", "et", "eu",
  "fa", "ff", "fi", "fj", "fo", "fr", "fy",
  "ga", "gd", "gl", "gn", "gu", "gv",
  "ha", "he", "hi", "ho", "hr", "ht", "hu", "hy", "hz",
  "ia", "id", "ie", "ig", "ii", "ik", "in", "io", "is", "it", "iu", "iw",
  "ja", "ji", "jv", "jw",
  "ka", "kg", "ki", "kj", "kk", "kl", "km", "kn", "ko", "kr", "ks", "ku", "kv", "kw", "ky",
  "la", "lb", "lg", "li", "ln", "lo", "lt", "lu", "lv",
  "mg", "mh", "mi", "mk", "ml", "mn", "mo", "mr", "ms", "mt", "my",
  "na", "nb", "nd", "ne", "ng", "nl", "nn", "no", "nr", "nv", "ny",
  "oc", "oj", "om", "or", "os",
  "pa", "pi", "pl", "ps", "pt",
  "qu",
  "rm", "rn", "ro", "ru", "rw",
  "sa", "sc", "sd", "se", "sg", "sh", "si", "sk", "sl", "sm", "sn", "so", "sq", "sr", "ss", "st", "su", "sv", "sw",
  "ta", "te", "tg", "th", "ti", "tk", "tl", "tn", "to", "tr", "ts", "tt", "tw", "ty",
  "ug", "uk", "ur", "uz",
  "ve", "vi", "vo",
  "wa", "wo",
  "xh",
  "yi", "yo",
  "za", "zh", "zu",
  // Grandfathered / common 3-letter subtags
  "ast", "ckb", "cmn", "fil", "gsw", "hak", "hsn", "lzh", "nan",
  "nds", "scn", "sco", "sma", "smj", "smn", "sms", "wuu", "yue",
  "ceb", "haw", "hmn", "ilo", "jbo", "kok", "mai", "mni", "sat",
  "sgn", "mis", "mul", "und", "zxx",
]);

/** Extract the primary subtag from a BCP 47 language tag. */
function getPrimarySubtag(lang: string): string {
  return lang.trim().split("-")[0].split("_")[0].toLowerCase();
}

/** Check if a lang value has a valid primary subtag. */
function isValidLang(lang: string): boolean {
  if (!lang || !lang.trim()) return false;
  const primary = getPrimarySubtag(lang);
  return VALID_LANG_SUBTAGS.has(primary);
}

/* ------------------------------------------------------------------ */
/*  html-has-lang                                                      */
/* ------------------------------------------------------------------ */
const htmlHasLang: RuleCheck = {
  ruleId: "html-has-lang",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    const htmlNodes = findByTag(nodes, "html");
    for (const node of htmlNodes) {
      const lang = node.attrs.lang;
      const xmlLang = node.attrs["xml:lang"];
      if ((lang && lang.trim()) || (xmlLang && xmlLang.trim())) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("html-has-lang", "serious", "The <html> element has a lang attribute")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("html-has-lang", "serious",
            "The <html> element does not have a lang attribute")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  html-lang-valid                                                    */
/* ------------------------------------------------------------------ */
const htmlLangValid: RuleCheck = {
  ruleId: "html-lang-valid",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    const htmlNodes = findByTag(nodes, "html");
    for (const node of htmlNodes) {
      const lang = node.attrs.lang;
      if (!lang || !lang.trim()) continue; // html-has-lang handles missing lang

      if (isValidLang(lang)) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("html-lang-valid", "serious",
            "Value of lang attribute is a valid language: " + lang)],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("html-lang-valid", "serious",
            "Value of lang attribute is not a valid language: " + lang)],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  html-xml-lang-mismatch                                             */
/* ------------------------------------------------------------------ */
const htmlXmlLangMismatch: RuleCheck = {
  ruleId: "html-xml-lang-mismatch",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    const htmlNodes = findByTag(nodes, "html");
    for (const node of htmlNodes) {
      const lang = node.attrs.lang;
      const xmlLang = node.attrs["xml:lang"];

      if (!lang || !xmlLang) continue; // only applies when both are present
      if (!lang.trim() || !xmlLang.trim()) continue;

      const langPrimary = getPrimarySubtag(lang);
      const xmlLangPrimary = getPrimarySubtag(xmlLang);

      if (langPrimary === xmlLangPrimary) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("html-xml-lang-mismatch", "moderate",
            "lang and xml:lang attributes have the same primary language")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("html-xml-lang-mismatch", "moderate",
            "lang=\"" + lang + "\" and xml:lang=\"" + xmlLang + "\" have different primary languages")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  valid-lang                                                         */
/* ------------------------------------------------------------------ */
const validLang: RuleCheck = {
  ruleId: "valid-lang",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (node.tag === "html") continue; // html-lang-valid handles <html>
      if (isHiddenOrAncestorHidden(node)) continue;
      const lang = node.attrs.lang;
      if (!lang) continue;

      if (isValidLang(lang)) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("valid-lang", "serious",
            "Value of lang attribute is a valid language: " + lang)],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("valid-lang", "serious",
            "Value of lang attribute is not a valid language: " + lang)],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

export const languageRules: RuleCheck[] = [
  htmlHasLang,
  htmlLangValid,
  htmlXmlLangMismatch,
  validLang,
];
