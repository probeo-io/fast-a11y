/**
 * Rule index — exports all rules combined into a single array.
 */

import type { RuleCheck } from "../rule-engine.js";
import { textAlternativeRules } from "./text-alternatives.js";
import { languageRules } from "./language.js";
import { structureRules } from "./structure.js";
import { formRules } from "./forms.js";
import { ariaRules } from "./aria.js";
import { navigationRules } from "./navigation.js";
import { mediaRules } from "./media.js";
import { tableRules } from "./tables.js";
import { landmarkRules } from "./landmarks.js";
import { colorContrastRules } from "./color-contrast.js";

/** Get all registered rule implementations. */
export function getAllRules(): RuleCheck[] {
  return [
    ...textAlternativeRules,
    ...languageRules,
    ...structureRules,
    ...formRules,
    ...ariaRules,
    ...navigationRules,
    ...mediaRules,
    ...tableRules,
    ...landmarkRules,
    ...colorContrastRules,
  ];
}

// Re-export individual rule groups for selective use
export {
  textAlternativeRules,
  languageRules,
  structureRules,
  formRules,
  ariaRules,
  navigationRules,
  mediaRules,
  tableRules,
  landmarkRules,
  colorContrastRules,
};
