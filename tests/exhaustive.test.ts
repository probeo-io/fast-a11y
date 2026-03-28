import { describe, it, expect } from "vitest";
import { fastA11y } from "../src/index.js";
import type { AxeResults } from "../src/index.js";

/* ================================================================== */
/*  Helpers                                                            */
/* ================================================================== */

/** Wrap body HTML in a valid document shell. */
function doc(body: string, lang = "en"): string {
  return `<!DOCTYPE html><html lang="${lang}"><head><title>Test</title></head><body>${body}</body></html>`;
}

/** Check if a specific rule ID appears in violations. */
function hasViolation(r: AxeResults, id: string): boolean {
  return r.violations.some((v) => v.id === id);
}

/** Check if a specific rule ID appears in passes. */
function hasPass(r: AxeResults, id: string): boolean {
  return r.passes.some((v) => v.id === id);
}

/** Check if a rule is in incomplete. */
function hasIncomplete(r: AxeResults, id: string): boolean {
  return r.incomplete.some((v) => v.id === id);
}

/* ================================================================== */
/*  Core audit function                                                */
/* ================================================================== */

describe("core audit function", () => {
  it("accepts an HTML string and returns results", () => {
    const r = fastA11y(doc("<p>Hello</p>"));
    expect(r).toBeDefined();
    expect(Array.isArray(r.violations)).toBe(true);
    expect(Array.isArray(r.passes)).toBe(true);
  });

  it("includes testEngine metadata", () => {
    const r = fastA11y(doc("<p>Hi</p>"));
    expect(r.testEngine.name).toBe("fast-a11y");
    expect(r.testEngine.version).toBe("0.1.0");
    expect(r.testRunner.name).toBe("fast-a11y");
  });

  it("includes timestamp as ISO string", () => {
    const r = fastA11y(doc("<p>Hi</p>"));
    expect(() => new Date(r.timestamp)).not.toThrow();
    expect(r.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });

  it("includes url from options", () => {
    const r = fastA11y(doc("<p>Hi</p>"), { url: "https://example.com" });
    expect(r.url).toBe("https://example.com");
  });

  it("defaults url to empty string", () => {
    const r = fastA11y(doc("<p>Hi</p>"));
    expect(r.url).toBe("");
  });

  it("includes toolOptions in output", () => {
    const opts = { url: "https://x.com" };
    const r = fastA11y(doc("<p>Hi</p>"), opts);
    expect(r.toolOptions).toEqual(opts);
  });
});

/* ================================================================== */
/*  Output format: axe-core compatible structure                       */
/* ================================================================== */

describe("axe-core compatible output structure", () => {
  it("has all four result arrays", () => {
    const r = fastA11y(doc("<p>Hello</p>"));
    expect(r).toHaveProperty("passes");
    expect(r).toHaveProperty("violations");
    expect(r).toHaveProperty("incomplete");
    expect(r).toHaveProperty("inapplicable");
  });

  it("violation entries have correct shape", () => {
    const r = fastA11y(doc('<img src="x.jpg">'));
    const v = r.violations.find((v) => v.id === "image-alt");
    expect(v).toBeDefined();
    expect(v!.tags).toBeInstanceOf(Array);
    expect(typeof v!.description).toBe("string");
    expect(typeof v!.help).toBe("string");
    expect(typeof v!.helpUrl).toBe("string");
    expect(v!.nodes.length).toBeGreaterThan(0);
  });

  it("node results have html, target, and check arrays", () => {
    const r = fastA11y(doc('<img src="x.jpg">'));
    const v = r.violations.find((v) => v.id === "image-alt");
    const node = v!.nodes[0];
    expect(typeof node.html).toBe("string");
    expect(node.html).toContain("img");
    expect(Array.isArray(node.target)).toBe(true);
    expect(node.target.length).toBeGreaterThan(0);
    expect(Array.isArray(node.any)).toBe(true);
    expect(Array.isArray(node.all)).toBe(true);
    expect(Array.isArray(node.none)).toBe(true);
  });

  it("violations have failureSummary", () => {
    const r = fastA11y(doc('<img src="x.jpg">'));
    const v = r.violations.find((v) => v.id === "image-alt");
    expect(v!.nodes[0].failureSummary).toBeTruthy();
  });

  it("helpUrl points to dequeuniversity", () => {
    const r = fastA11y(doc('<img src="x.jpg">'));
    const v = r.violations.find((v) => v.id === "image-alt");
    expect(v!.helpUrl).toContain("dequeuniversity.com");
  });
});

/* ================================================================== */
/*  Images: text-alternatives rules                                    */
/* ================================================================== */

describe("images", () => {
  it("flags img with no alt attribute", () => {
    const r = fastA11y(doc('<img src="photo.jpg">'));
    expect(hasViolation(r, "image-alt")).toBe(true);
  });

  it("passes img with non-empty alt", () => {
    const r = fastA11y(doc('<img src="photo.jpg" alt="A photo">'));
    expect(hasPass(r, "image-alt")).toBe(true);
    expect(hasViolation(r, "image-alt")).toBe(false);
  });

  it("passes img with empty alt (decorative)", () => {
    const r = fastA11y(doc('<img src="bg.jpg" alt="">'));
    expect(hasPass(r, "image-alt")).toBe(true);
    expect(hasViolation(r, "image-alt")).toBe(false);
  });

  it("passes img with role=presentation", () => {
    const r = fastA11y(doc('<img src="bg.jpg" role="presentation">'));
    expect(hasPass(r, "image-alt")).toBe(true);
  });

  it("passes img with aria-label", () => {
    const r = fastA11y(doc('<img src="x.jpg" aria-label="Logo">'));
    expect(hasPass(r, "image-alt")).toBe(true);
  });

  it("passes img with aria-labelledby", () => {
    const html = doc('<span id="desc">Photo</span><img src="x.jpg" aria-labelledby="desc">');
    const r = fastA11y(html);
    expect(hasPass(r, "image-alt")).toBe(true);
  });

  it("skips hidden images", () => {
    const r = fastA11y(doc('<img src="x.jpg" hidden>'));
    expect(hasViolation(r, "image-alt")).toBe(false);
  });

  it("flags input type=image without alt", () => {
    const r = fastA11y(doc('<input type="image" src="btn.png">'));
    expect(hasViolation(r, "input-image-alt")).toBe(true);
  });

  it("passes input type=image with alt", () => {
    const r = fastA11y(doc('<input type="image" src="btn.png" alt="Submit">'));
    expect(hasPass(r, "input-image-alt")).toBe(true);
  });

  it("flags object without alt text", () => {
    const r = fastA11y(doc('<object data="movie.swf"></object>'));
    expect(hasViolation(r, "object-alt")).toBe(true);
  });

  it("passes object with aria-label", () => {
    const r = fastA11y(doc('<object data="movie.swf" aria-label="Movie"></object>'));
    expect(hasPass(r, "object-alt")).toBe(true);
  });

  it("flags role=img without accessible name", () => {
    const r = fastA11y(doc('<div role="img"></div>'));
    expect(hasViolation(r, "role-img-alt")).toBe(true);
  });

  it("passes role=img with aria-label", () => {
    const r = fastA11y(doc('<div role="img" aria-label="Chart"></div>'));
    expect(hasPass(r, "role-img-alt")).toBe(true);
  });

  it("flags svg role=img without name", () => {
    const r = fastA11y(doc('<svg role="img"></svg>'));
    expect(hasViolation(r, "svg-img-alt")).toBe(true);
  });

  it("passes svg role=img with title child", () => {
    const r = fastA11y(doc('<svg role="img"><title>Graph</title></svg>'));
    expect(hasPass(r, "svg-img-alt")).toBe(true);
  });

  it("flags area without alt", () => {
    const html = doc('<map><area href="/link" shape="rect" coords="0,0,10,10"></map>');
    const r = fastA11y(html);
    expect(hasViolation(r, "area-alt")).toBe(true);
  });

  it("flags server-side image map", () => {
    const r = fastA11y(doc('<img src="map.jpg" alt="Map" ismap>'));
    expect(hasViolation(r, "server-side-image-map")).toBe(true);
  });
});

/* ================================================================== */
/*  Links                                                              */
/* ================================================================== */

describe("links", () => {
  it("flags empty link (no text)", () => {
    const r = fastA11y(doc('<a href="/page"></a>'));
    expect(hasViolation(r, "link-name")).toBe(true);
  });

  it("passes link with text", () => {
    const r = fastA11y(doc('<a href="/page">About us</a>'));
    expect(hasPass(r, "link-name")).toBe(true);
  });

  it("passes link with aria-label", () => {
    const r = fastA11y(doc('<a href="/page" aria-label="About us"></a>'));
    expect(hasPass(r, "link-name")).toBe(true);
  });

  it("passes link containing img with alt", () => {
    const r = fastA11y(doc('<a href="/"><img src="logo.png" alt="Home"></a>'));
    expect(hasPass(r, "link-name")).toBe(true);
  });

  it("flags link with only whitespace text", () => {
    const r = fastA11y(doc('<a href="/page">   </a>'));
    expect(hasViolation(r, "link-name")).toBe(true);
  });
});

/* ================================================================== */
/*  Headings                                                           */
/* ================================================================== */

describe("headings", () => {
  it("flags skipped heading level (h1 to h3)", () => {
    const r = fastA11y(doc("<h1>Title</h1><h3>Sub</h3>"));
    expect(hasViolation(r, "heading-order")).toBe(true);
  });

  it("passes sequential heading levels", () => {
    const r = fastA11y(doc("<h1>Title</h1><h2>Sub</h2><h3>Detail</h3>"));
    expect(hasViolation(r, "heading-order")).toBe(false);
  });

  it("allows same-level headings (h2 h2)", () => {
    const r = fastA11y(doc("<h1>Title</h1><h2>A</h2><h2>B</h2>"));
    expect(hasViolation(r, "heading-order")).toBe(false);
  });

  it("allows going back to a higher level", () => {
    const r = fastA11y(doc("<h1>Title</h1><h2>A</h2><h1>Next</h1>"));
    expect(hasViolation(r, "heading-order")).toBe(false);
  });

  it("flags empty heading", () => {
    const r = fastA11y(doc("<h2></h2>"));
    expect(hasViolation(r, "empty-heading")).toBe(true);
  });

  it("passes heading with text", () => {
    const r = fastA11y(doc("<h1>Welcome</h1>"));
    expect(hasPass(r, "empty-heading")).toBe(true);
  });

  it("flags missing h1", () => {
    const r = fastA11y(doc("<h2>Subtitle</h2>"));
    expect(hasViolation(r, "page-has-heading-one")).toBe(true);
  });

  it("passes when h1 present", () => {
    const r = fastA11y(doc("<h1>Title</h1>"));
    expect(hasPass(r, "page-has-heading-one")).toBe(true);
  });

  it("passes role=heading aria-level=1 as h1 equivalent", () => {
    const html = doc('<div role="heading" aria-level="1">Title</div>');
    const r = fastA11y(html);
    expect(hasPass(r, "page-has-heading-one")).toBe(true);
  });
});

/* ================================================================== */
/*  Forms                                                              */
/* ================================================================== */

describe("forms", () => {
  it("flags input without label", () => {
    const r = fastA11y(doc('<input type="text">'));
    expect(hasViolation(r, "label")).toBe(true);
  });

  it("passes input with associated label via for/id", () => {
    const html = doc('<label for="name">Name</label><input type="text" id="name">');
    const r = fastA11y(html);
    expect(hasPass(r, "label")).toBe(true);
  });

  it("passes input wrapped in label", () => {
    const html = doc('<label>Name <input type="text"></label>');
    const r = fastA11y(html);
    expect(hasPass(r, "label")).toBe(true);
  });

  it("passes input with aria-label", () => {
    const r = fastA11y(doc('<input type="text" aria-label="Search">'));
    expect(hasPass(r, "label")).toBe(true);
  });

  it("skips hidden inputs", () => {
    const r = fastA11y(doc('<input type="hidden" name="csrf">'));
    expect(hasViolation(r, "label")).toBe(false);
  });

  it("skips submit buttons for label rule", () => {
    const r = fastA11y(doc('<input type="submit" value="Go">'));
    expect(hasViolation(r, "label")).toBe(false);
  });

  it("flags select without name", () => {
    const r = fastA11y(doc('<select><option>A</option></select>'));
    expect(hasViolation(r, "select-name")).toBe(true);
  });

  it("passes select with label", () => {
    const html = doc('<label for="s">Pick</label><select id="s"><option>A</option></select>');
    const r = fastA11y(html);
    expect(hasPass(r, "select-name")).toBe(true);
  });

  it("flags button without accessible name", () => {
    const r = fastA11y(doc("<button></button>"));
    expect(hasViolation(r, "button-name")).toBe(true);
  });

  it("passes button with text", () => {
    const r = fastA11y(doc("<button>Submit</button>"));
    expect(hasPass(r, "button-name")).toBe(true);
  });

  it("passes button with aria-label", () => {
    const r = fastA11y(doc('<button aria-label="Close"></button>'));
    expect(hasPass(r, "button-name")).toBe(true);
  });

  it("flags input button without value", () => {
    const r = fastA11y(doc('<input type="button">'));
    expect(hasViolation(r, "input-button-name")).toBe(true);
  });

  it("passes input submit (has default value)", () => {
    const r = fastA11y(doc('<input type="submit">'));
    expect(hasPass(r, "input-button-name")).toBe(true);
  });

  it("flags multiple labels for same field", () => {
    const html = doc(
      '<label for="x">A</label><label for="x">B</label><input id="x" type="text">'
    );
    const r = fastA11y(html);
    expect(hasViolation(r, "form-field-multiple-labels")).toBe(true);
  });

  it("flags invalid autocomplete value", () => {
    const html = doc('<input type="text" autocomplete="xyz-invalid">');
    const r = fastA11y(html);
    expect(hasViolation(r, "autocomplete-valid")).toBe(true);
  });

  it("passes valid autocomplete value", () => {
    const html = doc('<input type="email" autocomplete="email">');
    const r = fastA11y(html);
    expect(hasPass(r, "autocomplete-valid")).toBe(true);
  });

  it("flags label-title-only when only title is present", () => {
    const html = doc('<input type="text" title="Name">');
    const r = fastA11y(html);
    expect(hasViolation(r, "label-title-only")).toBe(true);
  });
});

/* ================================================================== */
/*  ARIA rules                                                         */
/* ================================================================== */

describe("ARIA", () => {
  it("flags invalid ARIA role", () => {
    const r = fastA11y(doc('<div role="foobar">Content</div>'));
    expect(hasViolation(r, "aria-roles")).toBe(true);
  });

  it("passes valid ARIA role", () => {
    const r = fastA11y(doc('<div role="alert">Warning</div>'));
    expect(hasPass(r, "aria-roles")).toBe(true);
  });

  it("flags missing required ARIA attributes", () => {
    const r = fastA11y(doc('<div role="checkbox">Check me</div>'));
    expect(hasViolation(r, "aria-required-attr")).toBe(true);
  });

  it("passes when required ARIA attributes present", () => {
    const html = doc('<div role="checkbox" aria-checked="false">Check me</div>');
    const r = fastA11y(html);
    expect(hasPass(r, "aria-required-attr")).toBe(true);
  });

  it("flags invalid aria attribute name", () => {
    const r = fastA11y(doc('<div aria-foobar="true">X</div>'));
    expect(hasViolation(r, "aria-valid-attr")).toBe(true);
  });

  it("passes valid aria attribute name", () => {
    const r = fastA11y(doc('<div aria-live="polite">X</div>'));
    expect(hasPass(r, "aria-valid-attr")).toBe(true);
  });

  it("flags aria-hidden on body", () => {
    const html = '<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body aria-hidden="true"><p>Hi</p></body></html>';
    const r = fastA11y(html);
    expect(hasViolation(r, "aria-hidden-body")).toBe(true);
  });

  it("flags deprecated role", () => {
    const r = fastA11y(doc('<div role="directory">Items</div>'));
    expect(hasViolation(r, "aria-deprecated-role")).toBe(true);
  });

  it("flags aria-hidden element with focusable descendant", () => {
    const html = doc('<div aria-hidden="true"><button>Click</button></div>');
    const r = fastA11y(html);
    expect(hasViolation(r, "aria-hidden-focus")).toBe(true);
  });

  it("passes aria-hidden with no focusable descendants", () => {
    const html = doc('<div aria-hidden="true"><p>Text only</p></div>');
    const r = fastA11y(html);
    expect(hasViolation(r, "aria-hidden-focus")).toBe(false);
  });
});

/* ================================================================== */
/*  Tables                                                             */
/* ================================================================== */

describe("tables", () => {
  it("flags td headers pointing to non-existent id", () => {
    const html = doc(
      '<table><tr><th id="h1">H</th></tr><tr><td headers="nope">D</td></tr></table>'
    );
    const r = fastA11y(html);
    expect(hasViolation(r, "td-headers-attr")).toBe(true);
  });

  it("passes valid td headers attribute", () => {
    const html = doc(
      '<table><tr><th id="h1">H</th></tr><tr><td headers="h1">D</td></tr></table>'
    );
    const r = fastA11y(html);
    expect(hasPass(r, "td-headers-attr")).toBe(true);
  });

  it("flags empty table header", () => {
    const html = doc("<table><tr><th></th><td>Data</td></tr></table>");
    const r = fastA11y(html);
    expect(hasViolation(r, "empty-table-header")).toBe(true);
  });

  it("passes table header with text", () => {
    const html = doc("<table><tr><th>Name</th><td>Alice</td></tr></table>");
    const r = fastA11y(html);
    expect(hasPass(r, "empty-table-header")).toBe(true);
  });

  it("flags duplicate summary and caption", () => {
    const html = doc(
      '<table summary="Sales data"><caption>Sales data</caption><tr><th>Q</th><td>1</td></tr></table>'
    );
    const r = fastA11y(html);
    expect(hasViolation(r, "table-duplicate-name")).toBe(true);
  });

  it("flags invalid scope attribute value", () => {
    const html = doc('<table><tr><th scope="invalid">H</th><td>D</td></tr></table>');
    const r = fastA11y(html);
    expect(hasViolation(r, "scope-attr-valid")).toBe(true);
  });

  it("passes valid scope attribute", () => {
    const html = doc('<table><tr><th scope="col">H</th><td>D</td></tr></table>');
    const r = fastA11y(html);
    expect(hasPass(r, "scope-attr-valid")).toBe(true);
  });

  it("flags scope on non-th element", () => {
    const html = doc('<table><tr><td scope="col">H</td></tr></table>');
    const r = fastA11y(html);
    expect(hasViolation(r, "scope-attr-valid")).toBe(true);
  });
});

/* ================================================================== */
/*  Language rules                                                     */
/* ================================================================== */

describe("language", () => {
  it("flags missing lang on html", () => {
    const html = "<!DOCTYPE html><html><head><title>T</title></head><body><p>Hi</p></body></html>";
    const r = fastA11y(html);
    expect(hasViolation(r, "html-has-lang")).toBe(true);
  });

  it("passes html with lang attribute", () => {
    const r = fastA11y(doc("<p>Hi</p>", "en"));
    expect(hasPass(r, "html-has-lang")).toBe(true);
  });

  it("flags invalid lang value", () => {
    const r = fastA11y(doc("<p>Hi</p>", "zzzz"));
    expect(hasViolation(r, "html-lang-valid")).toBe(true);
  });

  it("passes valid lang value", () => {
    const r = fastA11y(doc("<p>Hi</p>", "fr"));
    expect(hasPass(r, "html-lang-valid")).toBe(true);
  });

  it("accepts lang with region subtag (en-US)", () => {
    const r = fastA11y(doc("<p>Hi</p>", "en-US"));
    expect(hasPass(r, "html-lang-valid")).toBe(true);
  });

  it("flags invalid lang on child element", () => {
    const r = fastA11y(doc('<p lang="zzzz">Text</p>'));
    expect(hasViolation(r, "valid-lang")).toBe(true);
  });

  it("passes valid lang on child element", () => {
    const r = fastA11y(doc('<p lang="es">Hola</p>'));
    expect(hasPass(r, "valid-lang")).toBe(true);
  });

  it("flags xml:lang mismatch", () => {
    const html = '<!DOCTYPE html><html lang="en" xml:lang="fr"><head><title>T</title></head><body><p>Hi</p></body></html>';
    const r = fastA11y(html);
    expect(hasViolation(r, "html-xml-lang-mismatch")).toBe(true);
  });

  it("passes matching lang and xml:lang", () => {
    const html = '<!DOCTYPE html><html lang="en" xml:lang="en"><head><title>T</title></head><body><p>Hi</p></body></html>';
    const r = fastA11y(html);
    expect(hasPass(r, "html-xml-lang-mismatch")).toBe(true);
  });
});

/* ================================================================== */
/*  Semantic / structure rules                                         */
/* ================================================================== */

describe("semantic and structure", () => {
  it("flags missing document title", () => {
    const html = '<!DOCTYPE html><html lang="en"><head></head><body><p>Hi</p></body></html>';
    const r = fastA11y(html);
    expect(hasViolation(r, "document-title")).toBe(true);
  });

  it("passes document with title", () => {
    const r = fastA11y(doc("<p>Hi</p>"));
    expect(hasPass(r, "document-title")).toBe(true);
  });

  it("flags empty document title", () => {
    const html = '<!DOCTYPE html><html lang="en"><head><title></title></head><body><p>Hi</p></body></html>';
    const r = fastA11y(html);
    expect(hasViolation(r, "document-title")).toBe(true);
  });

  it("flags duplicate IDs", () => {
    const r = fastA11y(doc('<div id="a">1</div><div id="a">2</div>'));
    expect(hasViolation(r, "duplicate-id")).toBe(true);
  });

  it("passes unique IDs", () => {
    const r = fastA11y(doc('<div id="a">1</div><div id="b">2</div>'));
    expect(hasPass(r, "duplicate-id")).toBe(true);
  });

  it("flags nested interactive elements", () => {
    const r = fastA11y(doc('<a href="/"><button>Click</button></a>'));
    expect(hasViolation(r, "nested-interactive")).toBe(true);
  });

  it("passes non-nested interactive element", () => {
    const r = fastA11y(doc('<a href="/">Link</a><button>Click</button>'));
    expect(hasViolation(r, "nested-interactive")).toBe(false);
  });

  it("flags blink element", () => {
    const r = fastA11y(doc("<blink>Warning</blink>"));
    expect(hasViolation(r, "blink")).toBe(true);
  });

  it("flags marquee element", () => {
    const r = fastA11y(doc("<marquee>Scroll</marquee>"));
    expect(hasViolation(r, "marquee")).toBe(true);
  });

  it("flags list with invalid children", () => {
    const r = fastA11y(doc("<ul><div>Bad</div></ul>"));
    expect(hasViolation(r, "list")).toBe(true);
  });

  it("passes valid list structure", () => {
    const r = fastA11y(doc("<ul><li>Item</li></ul>"));
    expect(hasPass(r, "list")).toBe(true);
  });

  it("flags li not inside a list", () => {
    const r = fastA11y(doc("<li>Orphan</li>"));
    expect(hasViolation(r, "listitem")).toBe(true);
  });

  it("flags definition list with invalid children", () => {
    const r = fastA11y(doc("<dl><p>Bad</p></dl>"));
    expect(hasViolation(r, "definition-list")).toBe(true);
  });

  it("passes valid definition list", () => {
    const r = fastA11y(doc("<dl><dt>Term</dt><dd>Def</dd></dl>"));
    expect(hasPass(r, "definition-list")).toBe(true);
  });
});

/* ================================================================== */
/*  Media rules                                                        */
/* ================================================================== */

describe("media", () => {
  it("flags meta viewport disabling zoom", () => {
    const html = doc("", "en").replace(
      "</head>",
      '<meta name="viewport" content="width=device-width, user-scalable=no"></head>'
    );
    const r = fastA11y(html);
    expect(hasViolation(r, "meta-viewport")).toBe(true);
  });

  it("flags meta viewport with low maximum-scale", () => {
    const html = doc("", "en").replace(
      "</head>",
      '<meta name="viewport" content="width=device-width, maximum-scale=1"></head>'
    );
    const r = fastA11y(html);
    expect(hasViolation(r, "meta-viewport")).toBe(true);
  });

  it("passes meta viewport allowing zoom", () => {
    const html = doc("", "en").replace(
      "</head>",
      '<meta name="viewport" content="width=device-width, initial-scale=1"></head>'
    );
    const r = fastA11y(html);
    expect(hasViolation(r, "meta-viewport")).toBe(false);
  });

  it("flags meta refresh with delay", () => {
    const html = doc("", "en").replace(
      "</head>",
      '<meta http-equiv="refresh" content="5;url=https://x.com"></head>'
    );
    const r = fastA11y(html);
    expect(hasViolation(r, "meta-refresh")).toBe(true);
  });

  it("passes meta refresh with 0 delay (immediate redirect)", () => {
    const html = doc("", "en").replace(
      "</head>",
      '<meta http-equiv="refresh" content="0;url=https://x.com"></head>'
    );
    const r = fastA11y(html);
    expect(hasViolation(r, "meta-refresh")).toBe(false);
  });

  it("flags autoplay audio without muted", () => {
    const r = fastA11y(doc('<audio autoplay src="a.mp3"></audio>'));
    expect(hasViolation(r, "no-autoplay-audio")).toBe(true);
  });

  it("passes autoplay audio with muted", () => {
    const r = fastA11y(doc('<audio autoplay muted src="a.mp3"></audio>'));
    expect(hasPass(r, "no-autoplay-audio")).toBe(true);
  });

  it("marks video without captions as incomplete", () => {
    const r = fastA11y(doc('<video src="v.mp4"></video>'));
    expect(hasIncomplete(r, "video-caption")).toBe(true);
  });

  it("passes video with captions track", () => {
    const html = doc('<video src="v.mp4"><track kind="captions" src="c.vtt"></video>');
    const r = fastA11y(html);
    expect(hasPass(r, "video-caption")).toBe(true);
  });
});

/* ================================================================== */
/*  Navigation rules                                                   */
/* ================================================================== */

describe("navigation", () => {
  it("flags iframe without title", () => {
    const r = fastA11y(doc('<iframe src="https://x.com"></iframe>'));
    expect(hasViolation(r, "frame-title")).toBe(true);
  });

  it("passes iframe with title", () => {
    const r = fastA11y(doc('<iframe src="https://x.com" title="Widget"></iframe>'));
    expect(hasPass(r, "frame-title")).toBe(true);
  });

  it("flags tabindex greater than 0", () => {
    const r = fastA11y(doc('<div tabindex="5">X</div>'));
    expect(hasViolation(r, "tabindex")).toBe(true);
  });

  it("passes tabindex=0", () => {
    const r = fastA11y(doc('<div tabindex="0">X</div>'));
    expect(hasPass(r, "tabindex")).toBe(true);
  });

  it("flags duplicate accesskeys", () => {
    const html = doc('<a href="/a" accesskey="s">A</a><a href="/b" accesskey="s">B</a>');
    const r = fastA11y(html);
    expect(hasViolation(r, "accesskeys")).toBe(true);
  });

  it("passes unique accesskeys", () => {
    const html = doc('<a href="/a" accesskey="s">A</a><a href="/b" accesskey="d">B</a>');
    const r = fastA11y(html);
    expect(hasPass(r, "accesskeys")).toBe(true);
  });
});

/* ================================================================== */
/*  Landmark rules                                                     */
/* ================================================================== */

describe("landmarks", () => {
  it("flags page without main landmark", () => {
    const r = fastA11y(doc("<div>Content</div>"));
    expect(hasViolation(r, "landmark-one-main")).toBe(true);
  });

  it("passes page with main landmark", () => {
    const r = fastA11y(doc("<main><p>Content</p></main>"));
    expect(hasPass(r, "landmark-one-main")).toBe(true);
  });

  it("flags duplicate main landmarks", () => {
    const r = fastA11y(doc("<main>A</main><main>B</main>"));
    expect(hasViolation(r, "landmark-no-duplicate-main")).toBe(true);
  });

  it("flags duplicate banner landmarks", () => {
    const r = fastA11y(doc("<header>A</header><header>B</header>"));
    expect(hasViolation(r, "landmark-no-duplicate-banner")).toBe(true);
  });
});

/* ================================================================== */
/*  Color contrast                                                     */
/* ================================================================== */

describe("color contrast", () => {
  it("flags low-contrast inline styles", () => {
    const html = doc('<p style="color: #ccc; background-color: #fff;">Light text</p>');
    const r = fastA11y(html);
    expect(hasViolation(r, "color-contrast")).toBe(true);
  });

  it("passes high-contrast inline styles", () => {
    const html = doc('<p style="color: #000; background-color: #fff;">Dark text</p>');
    const r = fastA11y(html);
    expect(hasPass(r, "color-contrast")).toBe(true);
  });

  it("detects contrast from style blocks", () => {
    const html = doc(
      '<style>.bad { color: #ddd; background-color: #fff; }</style><p class="bad">Low contrast</p>'
    );
    const r = fastA11y(html);
    expect(hasViolation(r, "color-contrast")).toBe(true);
  });

  it("marks background-image elements as incomplete", () => {
    const html = doc(
      '<p style="color: #000; background-image: url(bg.jpg);">Over image</p>'
    );
    const r = fastA11y(html);
    expect(hasIncomplete(r, "color-contrast")).toBe(true);
  });
});

/* ================================================================== */
/*  Rule filtering                                                     */
/* ================================================================== */

describe("rule filtering", () => {
  it("filters by runOnly tag", () => {
    const html = doc('<img src="x.jpg">');
    const r = fastA11y(html, { runOnly: { type: "tag", values: ["wcag2a"] } });
    expect(hasViolation(r, "image-alt")).toBe(true);
    // meta-viewport is wcag2aa, should not appear
    const allIds = [
      ...r.violations.map((v) => v.id),
      ...r.passes.map((v) => v.id),
      ...r.inapplicable.map((v) => v.id),
    ];
    expect(allIds).not.toContain("meta-viewport");
  });

  it("filters by runOnly rule IDs", () => {
    const html = doc('<img src="x.jpg">');
    const r = fastA11y(html, {
      runOnly: { type: "rule", values: ["image-alt"] },
    });
    expect(hasViolation(r, "image-alt")).toBe(true);
    // Other rules should not be present
    expect(r.violations.length + r.passes.length + r.inapplicable.length).toBeGreaterThan(0);
    const allIds = [
      ...r.violations.map((v) => v.id),
      ...r.passes.map((v) => v.id),
      ...r.inapplicable.map((v) => v.id),
    ];
    expect(allIds.every((id) => id === "image-alt")).toBe(true);
  });

  it("disables specific rules via rules option", () => {
    const html = doc('<img src="x.jpg">');
    const r = fastA11y(html, { rules: { "image-alt": { enabled: false } } });
    expect(hasViolation(r, "image-alt")).toBe(false);
    expect(hasPass(r, "image-alt")).toBe(false);
  });
});

/* ================================================================== */
/*  Edge cases: empty, malformed, and large HTML                       */
/* ================================================================== */

describe("edge cases", () => {
  it("handles empty string without crash", () => {
    const r = fastA11y("");
    expect(r).toBeDefined();
    expect(r.violations).toBeInstanceOf(Array);
    expect(r.passes).toBeInstanceOf(Array);
  });

  it("handles minimal HTML fragment", () => {
    const r = fastA11y("<p>Just a paragraph</p>");
    expect(r).toBeDefined();
  });

  it("handles malformed HTML gracefully", () => {
    const r = fastA11y("<div><p>Unclosed tags<span>Bad nesting");
    expect(r).toBeDefined();
    expect(r.violations).toBeInstanceOf(Array);
  });

  it("handles HTML with special characters", () => {
    const r = fastA11y(doc("<p>&amp; &lt; &gt; &quot;</p>"));
    expect(r).toBeDefined();
  });

  it("handles deeply nested elements", () => {
    let html = "<div>".repeat(50) + "<p>Deep</p>" + "</div>".repeat(50);
    const r = fastA11y(doc(html));
    expect(r).toBeDefined();
  });

  it("handles large HTML within reasonable time", () => {
    // Generate HTML with 500 elements
    const items = Array.from({ length: 500 }, (_, i) =>
      `<div id="item-${i}"><p>Item ${i}</p></div>`
    ).join("");
    const html = doc(`<main><h1>Title</h1>${items}</main>`);

    const start = performance.now();
    const r = fastA11y(html);
    const elapsed = performance.now() - start;

    expect(r).toBeDefined();
    // Should complete in under 5 seconds for 500 elements
    expect(elapsed).toBeLessThan(5000);
  });

  it("handles HTML with script and style tags", () => {
    const html = doc(
      "<style>body{color:red}</style><script>alert(1)</script><p>Content</p>"
    );
    const r = fastA11y(html);
    expect(r).toBeDefined();
  });

  it("handles self-closing tags", () => {
    const r = fastA11y(doc('<br/><hr/><img src="x.jpg" alt="X"/>'));
    expect(r).toBeDefined();
  });

  it("handles HTML with comments", () => {
    const r = fastA11y(doc("<!-- comment --><p>Content</p>"));
    expect(r).toBeDefined();
  });
});

/* ================================================================== */
/*  Hidden element handling                                            */
/* ================================================================== */

describe("hidden elements", () => {
  it("skips elements with hidden attribute", () => {
    const r = fastA11y(doc('<img src="x.jpg" hidden>'));
    expect(hasViolation(r, "image-alt")).toBe(false);
  });

  it("skips elements with aria-hidden=true", () => {
    const r = fastA11y(doc('<div aria-hidden="true"><img src="x.jpg"></div>'));
    expect(hasViolation(r, "image-alt")).toBe(false);
  });

  it("skips elements with display:none", () => {
    const r = fastA11y(doc('<img src="x.jpg" style="display:none">'));
    expect(hasViolation(r, "image-alt")).toBe(false);
  });

  it("skips elements with visibility:hidden", () => {
    const r = fastA11y(doc('<img src="x.jpg" style="visibility:hidden">'));
    expect(hasViolation(r, "image-alt")).toBe(false);
  });

  it("skips elements whose ancestor is hidden", () => {
    const html = doc('<div hidden><div><img src="x.jpg"></div></div>');
    const r = fastA11y(html);
    expect(hasViolation(r, "image-alt")).toBe(false);
  });
});

/* ================================================================== */
/*  Well-formed page: comprehensive pass check                         */
/* ================================================================== */

describe("well-formed page", () => {
  it("has zero critical violations", () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Accessible Page</title></head>
<body>
  <header><nav aria-label="Main"><a href="/">Home</a></nav></header>
  <main>
    <h1>Welcome</h1>
    <p>Well-structured content.</p>
    <img src="photo.jpg" alt="Scenic view">
    <form>
      <label for="email">Email</label>
      <input type="email" id="email" autocomplete="email">
      <button type="submit">Send</button>
    </form>
    <table>
      <caption>Q1 Sales</caption>
      <tr><th scope="col">Region</th><th scope="col">Revenue</th></tr>
      <tr><td>East</td><td>$100</td></tr>
      <tr><td>West</td><td>$200</td></tr>
    </table>
  </main>
  <footer><p>Footer</p></footer>
</body>
</html>`;
    const r = fastA11y(html);
    const critical = r.violations.filter((v) => v.impact === "critical");
    expect(critical).toHaveLength(0);
    expect(r.passes.length).toBeGreaterThan(10);
  });
});
