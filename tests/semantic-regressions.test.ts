import { describe, expect, it } from "vitest";
import { fastA11y } from "../src/index.js";
import { buildTree, getRole, parse } from "../src/tree.js";

const check = (html: string, rule: string) => fastA11y(html, {
  runOnly: { type: "rule", values: [rule] },
});
const roles = (html: string, tag: string) => buildTree(parse(html))
  .filter(n => n.tag === tag).map(getRole);

describe("contextual landmark semantics", () => {
  it.each(["article", "aside", "main", "nav", "section"])(
    "does not give nested headers and footers landmark roles in %s", tag => {
      const html = `<header>Site</header><${tag}><div><header>Local</header><footer>Local</footer></div></${tag}><footer>Site</footer>`;
      expect(roles(html, "header")).toEqual(["banner", undefined]);
      expect(roles(html, "footer")).toEqual([undefined, "contentinfo"]);
      for (const rule of ["landmark-no-duplicate-banner", "landmark-no-duplicate-contentinfo", "landmark-banner-is-top-level", "landmark-contentinfo-is-top-level", "landmark-unique"]) {
        expect(check(html, rule).violations).toEqual([]);
      }
    });

  it.each(["article", "complementary", "main", "navigation", "region"])(
    "scopes headers and footers inside an explicit %s role", role => {
      const html = `<div role="${role}"><header>Local</header><footer>Local</footer></div>`;
      expect(roles(html, "header")).toEqual([undefined]);
      expect(roles(html, "footer")).toEqual([undefined]);
    });

  it("respects explicit landmarks even inside a section", () => {
    const html = '<main><header role="banner">Local</header></main>';
    expect(roles(html, "header")).toEqual(["banner"]);
    expect(check(html, "landmark-banner-is-top-level").violations).toHaveLength(1);
    expect(check('<header>A</header><header>B</header>', "landmark-no-duplicate-banner").violations).toHaveLength(1);
  });

  it.each(['', ' name="contact"', ' aria-label=" "', ' aria-labelledby="missing"'])(
    "does not name a form from its contents or invalid labels: %s", attrs => {
      const html = `<form${attrs}><button>Send</button></form>`;
      expect(roles(html, "form")).toEqual([undefined]);
      expect(check(html + html, "landmark-unique").violations).toEqual([]);
    });

  it.each(['aria-label="Contact"', 'title="Contact"', 'aria-labelledby="label"'])(
    "recognizes author-named forms: %s", attrs => {
      expect(roles(`<span id="label">Contact</span><form ${attrs}></form>`, "form")).toEqual(["form"]);
    });

  it("uses form titles rather than control contents for uniqueness", () => {
    const distinct = '<form title="Contact"><button>Send</button></form><form title="Feedback"><button>Send</button></form>';
    expect(check(distinct, "landmark-unique").violations).toEqual([]);
    expect(check(distinct.replace('title="Feedback"', 'title="Contact"'), "landmark-unique").violations).toHaveLength(1);
  });
});

describe("native select ownership", () => {
  it.each(['', ' size="1"', ' multiple', ' size="2"'])("accepts native options in select%s", attrs => {
    const html = `<select${attrs}><option>A</option><optgroup label="Group"><option>B</option></optgroup></select>`;
    expect(check(html, "aria-required-parent").violations).toEqual([]);
    expect(check(html, "aria-required-parent").passes[0].nodes).toHaveLength(2);
  });

  it.each(['<option>A</option>', '<div role="combobox"><div role="option">A</div></div>', '<select role="menu"><option>A</option></select>'])(
    "still rejects invalid option ownership: %s", html => {
      expect(check(html, "aria-required-parent").violations).toHaveLength(1);
    });

  it("accepts an ARIA listbox option", () => {
    expect(check('<div role="listbox"><div role="option">A</div></div>', "aria-required-parent").violations).toEqual([]);
  });
});

describe("caption review outcomes", () => {
  it.each(['<video src="movie.mp4"></video>', '<video><track kind="subtitles"></video>'])(
    "preserves uncertain captions in serialized results: %s", html => {
      const result = JSON.parse(JSON.stringify(check(html, "video-caption")));
      expect(result.violations).toEqual([]);
      expect(result.passes).toEqual([]);
      expect(result.incomplete[0].id).toBe("video-caption");
      expect(result.incomplete[0].nodes).toHaveLength(1);
    });
  it.each(["captions", "CAPTIONS"])("passes a %s track", kind => {
    expect(check(`<video><track kind="${kind}"></video>`, "video-caption").passes).toHaveLength(1);
  });
});

describe("rule metadata", () => {
  it("selects autocomplete-valid under WCAG 2.1 AA only", () => {
    const html = '<input autocomplete="invalid-token">';
    const run = (tag: string) => fastA11y(html, { runOnly: { type: "tag", values: [tag] } });
    expect(run("wcag21aa").violations.some(r => r.id === "autocomplete-valid")).toBe(true);
    expect(run("wcag21a").violations.some(r => r.id === "autocomplete-valid")).toBe(false);
  });
  it("puts landmark guidance in help and the rule summary in description", () => {
    const rule = check('<nav aria-label="Primary">A</nav><nav aria-label="Primary">B</nav>', "landmark-unique").violations[0];
    expect(rule.help).toBe("Landmarks should have a unique role or role/label/title (i.e. accessible name) combination");
    expect(rule.description).toBe("Ensures landmarks are unique");
  });
});
