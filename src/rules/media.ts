/**
 * Media rules: blink, marquee, meta-refresh, meta-refresh-no-exceptions,
 * meta-viewport, meta-viewport-large, no-autoplay-audio, video-caption
 */

import type { FastNode } from "../tree.js";
import type { RuleCheck, RuleRunResult, NodeCheckDetail } from "../rule-engine.js";
import { makeCheck } from "../rule-engine.js";
import { isHiddenOrAncestorHidden, findByTag } from "../tree.js";

/* ------------------------------------------------------------------ */
/*  blink                                                              */
/* ------------------------------------------------------------------ */
const blink: RuleCheck = {
  ruleId: "blink",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of findByTag(nodes, "blink")) {
      violations.push(node);
      checkDetails.set(node, {
        all: [makeCheck("blink", "serious",
          "<blink> elements are deprecated and must not be used")],
      });
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  marquee                                                            */
/* ------------------------------------------------------------------ */
const marquee: RuleCheck = {
  ruleId: "marquee",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of findByTag(nodes, "marquee")) {
      violations.push(node);
      checkDetails.set(node, {
        all: [makeCheck("marquee", "serious",
          "<marquee> elements are deprecated and must not be used")],
      });
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  Shared meta-refresh logic                                          */
/* ------------------------------------------------------------------ */
function parseMetaRefresh(content: string): { delay: number; url?: string } | null {
  if (!content) return null;
  const trimmed = content.trim();

  // Format: "<delay>", "<delay>; url=<url>", or "<delay>; <url>"
  const match = trimmed.match(/^(\d+)\s*(?:[;,]\s*(?:url\s*=\s*)?(.+))?$/i);
  if (!match) return null;

  return {
    delay: parseInt(match[1], 10),
    url: match[2]?.trim(),
  };
}

/* ------------------------------------------------------------------ */
/*  meta-refresh                                                       */
/* ------------------------------------------------------------------ */
const metaRefresh: RuleCheck = {
  ruleId: "meta-refresh",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of findByTag(nodes, "meta")) {
      const httpEquiv = (node.attrs["http-equiv"] || "").toLowerCase();
      if (httpEquiv !== "refresh") continue;

      const content = node.attrs.content || "";
      const parsed = parseMetaRefresh(content);

      if (!parsed) {
        passes.push(node);
        continue;
      }

      if (parsed.delay > 0 && parsed.url) {
        // Delayed redirect — violation
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("meta-refresh", "critical",
            "Timed refresh with redirect found: delay=" + parsed.delay + "s")],
        });
      } else if (parsed.delay > 72000) {
        // Refresh after 20 hours is considered too long (axe threshold)
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("meta-refresh", "critical",
            "Page auto-refreshes with delay of " + parsed.delay + " seconds")],
        });
      } else if (parsed.delay === 0) {
        // Immediate redirect is acceptable
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("meta-refresh", "critical",
            "Immediate redirect (delay=0) is acceptable")],
        });
      } else if (parsed.delay > 0 && !parsed.url) {
        // Refresh without URL change
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("meta-refresh", "critical",
            "Page auto-refreshes with delay of " + parsed.delay + " seconds")],
        });
      } else {
        passes.push(node);
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  meta-refresh-no-exceptions                                         */
/* ------------------------------------------------------------------ */
const metaRefreshNoExceptions: RuleCheck = {
  ruleId: "meta-refresh-no-exceptions",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of findByTag(nodes, "meta")) {
      const httpEquiv = (node.attrs["http-equiv"] || "").toLowerCase();
      if (httpEquiv !== "refresh") continue;

      const content = node.attrs.content || "";
      const parsed = parseMetaRefresh(content);

      if (!parsed) continue;

      if (parsed.delay > 0) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("meta-refresh-no-exceptions", "minor",
            "meta refresh with delay of " + parsed.delay + " seconds found")],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("meta-refresh-no-exceptions", "minor",
            "Immediate redirect (delay=0) found")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  Shared viewport parsing                                            */
/* ------------------------------------------------------------------ */
function parseViewport(content: string): Record<string, string> {
  const result: Record<string, string> = {};
  // viewport content is comma or semicolon separated key=value pairs
  const parts = content.split(/[,;]/);
  for (const part of parts) {
    const [key, ...valueParts] = part.split("=");
    if (key) {
      result[key.trim().toLowerCase()] = (valueParts.join("=") || "").trim().toLowerCase();
    }
  }
  return result;
}

/* ------------------------------------------------------------------ */
/*  meta-viewport                                                      */
/* ------------------------------------------------------------------ */
const metaViewport: RuleCheck = {
  ruleId: "meta-viewport",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of findByTag(nodes, "meta")) {
      const name = (node.attrs.name || "").toLowerCase();
      if (name !== "viewport") continue;

      const content = node.attrs.content || "";
      const vp = parseViewport(content);

      const issues: string[] = [];

      // Check user-scalable
      if (vp["user-scalable"] === "no" || vp["user-scalable"] === "0") {
        issues.push("user-scalable=no disables zooming");
      }

      // Check maximum-scale
      const maxScale = parseFloat(vp["maximum-scale"] || "");
      if (!isNaN(maxScale) && maxScale < 2) {
        issues.push("maximum-scale=" + maxScale + " prevents adequate zooming (minimum 2)");
      }

      if (issues.length > 0) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("meta-viewport", "critical", issues.join("; "))],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("meta-viewport", "critical",
            "Viewport meta tag does not disable zooming")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  meta-viewport-large                                                */
/* ------------------------------------------------------------------ */
const metaViewportLarge: RuleCheck = {
  ruleId: "meta-viewport-large",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of findByTag(nodes, "meta")) {
      const name = (node.attrs.name || "").toLowerCase();
      if (name !== "viewport") continue;

      const content = node.attrs.content || "";
      const vp = parseViewport(content);

      const maxScale = parseFloat(vp["maximum-scale"] || "");
      if (!isNaN(maxScale) && maxScale < 5) {
        violations.push(node);
        checkDetails.set(node, {
          all: [makeCheck("meta-viewport-large", "minor",
            "maximum-scale=" + maxScale + " should be >= 5 for 500% zoom")],
        });
      } else {
        passes.push(node);
        checkDetails.set(node, {
          all: [makeCheck("meta-viewport-large", "minor",
            "Viewport allows adequate zoom level")],
        });
      }
    }

    return { violations, passes, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  no-autoplay-audio                                                  */
/* ------------------------------------------------------------------ */
const noAutoplayAudio: RuleCheck = {
  ruleId: "no-autoplay-audio",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const incomplete: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of nodes) {
      if (node.tag !== "video" && node.tag !== "audio") continue;
      if (isHiddenOrAncestorHidden(node)) continue;

      const hasAutoplay = node.attrs.autoplay !== undefined;
      if (!hasAutoplay) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("no-autoplay-audio", "moderate",
            "Element does not have autoplay attribute")],
        });
        continue;
      }

      const hasMuted = node.attrs.muted !== undefined;
      const hasControls = node.attrs.controls !== undefined;

      if (hasMuted) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("no-autoplay-audio", "moderate",
            "Element has autoplay but is muted")],
        });
      } else if (hasControls) {
        // Has controls so user can stop it — put in incomplete
        // since we can't determine audio duration statically
        incomplete.push(node);
        checkDetails.set(node, {
          any: [makeCheck("no-autoplay-audio", "moderate",
            "Element has autoplay with controls — verify audio duration is < 3 seconds or user can control playback")],
        });
      } else {
        violations.push(node);
        checkDetails.set(node, {
          any: [makeCheck("no-autoplay-audio", "moderate",
            "Element autoplays without muted attribute or controls")],
        });
      }
    }

    return { violations, passes, incomplete, checkDetails };
  },
};

/* ------------------------------------------------------------------ */
/*  video-caption                                                      */
/* ------------------------------------------------------------------ */
const videoCaption: RuleCheck = {
  ruleId: "video-caption",
  run(nodes: FastNode[]): RuleRunResult {
    const violations: FastNode[] = [];
    const passes: FastNode[] = [];
    const incomplete: FastNode[] = [];
    const checkDetails = new Map<FastNode, NodeCheckDetail>();

    for (const node of findByTag(nodes, "video")) {
      if (isHiddenOrAncestorHidden(node)) continue;

      // Check for <track kind="captions"> or <track kind="subtitles">
      const hasCaption = node.children.some(
        (child) =>
          child.tag === "track" &&
          (child.attrs.kind === "captions" || child.attrs.kind === "subtitles")
      );

      if (hasCaption) {
        passes.push(node);
        checkDetails.set(node, {
          any: [makeCheck("video-caption", "critical",
            "Video element has captions track")],
        });
      } else {
        // We can't know if captions are provided by a media player JS library,
        // so mark as incomplete rather than definite violation
        incomplete.push(node);
        checkDetails.set(node, {
          any: [makeCheck("video-caption", "critical",
            "No <track kind=\"captions\"> found — verify captions are provided")],
        });
      }
    }

    return { violations, passes, incomplete, checkDetails };
  },
};

export const mediaRules: RuleCheck[] = [
  blink,
  marquee,
  metaRefresh,
  metaRefreshNoExceptions,
  metaViewport,
  metaViewportLarge,
  noAutoplayAudio,
  videoCaption,
];
