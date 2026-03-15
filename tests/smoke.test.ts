import { describe, it, expect } from "vitest";
import { fastA11y } from "../src/index.js";

describe("fast-a11y smoke tests", () => {
  it("returns axe-core compatible structure", () => {
    const html = `<!DOCTYPE html><html><head><title>Test</title></head><body><h1>Hello</h1></body></html>`;
    const results = fastA11y(html);

    expect(results.testEngine.name).toBe("fast-a11y");
    expect(results.testEngine.version).toBe("0.1.0");
    expect(results).toHaveProperty("passes");
    expect(results).toHaveProperty("violations");
    expect(results).toHaveProperty("incomplete");
    expect(results).toHaveProperty("inapplicable");
    expect(results.timestamp).toBeTruthy();
  });

  it("catches missing alt on img", () => {
    const html = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><img src="photo.jpg"></body></html>`;
    const results = fastA11y(html);

    const imageAlt = results.violations.find((v) => v.id === "image-alt");
    expect(imageAlt).toBeTruthy();
    expect(imageAlt!.impact).toBe("critical");
    expect(imageAlt!.nodes.length).toBe(1);
    expect(imageAlt!.nodes[0].html).toContain("img");
    expect(imageAlt!.nodes[0].target).toHaveLength(1);
    expect(imageAlt!.nodes[0].failureSummary).toBeTruthy();
  });

  it("passes when img has alt", () => {
    const html = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><img src="photo.jpg" alt="A photo"></body></html>`;
    const results = fastA11y(html);

    const imageAlt = results.violations.find((v) => v.id === "image-alt");
    expect(imageAlt).toBeUndefined();

    const imageAltPass = results.passes.find((v) => v.id === "image-alt");
    expect(imageAltPass).toBeTruthy();
  });

  it("catches missing lang on html", () => {
    const html = `<!DOCTYPE html><html><head><title>Test</title></head><body><p>Hello</p></body></html>`;
    const results = fastA11y(html);

    const htmlLang = results.violations.find((v) => v.id === "html-has-lang");
    expect(htmlLang).toBeTruthy();
  });

  it("catches missing document title", () => {
    const html = `<!DOCTYPE html><html lang="en"><head></head><body><p>Hello</p></body></html>`;
    const results = fastA11y(html);

    const docTitle = results.violations.find((v) => v.id === "document-title");
    expect(docTitle).toBeTruthy();
  });

  it("catches nested interactive elements", () => {
    const html = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><a href="/"><button>Click</button></a></body></html>`;
    const results = fastA11y(html);

    const nested = results.violations.find((v) => v.id === "nested-interactive");
    expect(nested).toBeTruthy();
  });

  it("catches meta viewport disabling zoom", () => {
    const html = `<!DOCTYPE html><html lang="en"><head><title>Test</title><meta name="viewport" content="width=device-width, user-scalable=no"></head><body><p>Hello</p></body></html>`;
    const results = fastA11y(html);

    const viewport = results.violations.find((v) => v.id === "meta-viewport");
    expect(viewport).toBeTruthy();
  });

  it("catches heading order skip", () => {
    const html = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><h1>Title</h1><h3>Subtitle</h3></body></html>`;
    const results = fastA11y(html);

    const headingOrder = results.violations.find((v) => v.id === "heading-order");
    expect(headingOrder).toBeTruthy();
  });

  it("catches button without name", () => {
    const html = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><button></button></body></html>`;
    const results = fastA11y(html);

    const buttonName = results.violations.find((v) => v.id === "button-name");
    expect(buttonName).toBeTruthy();
  });

  it("catches link without name", () => {
    const html = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><a href="/page"></a></body></html>`;
    const results = fastA11y(html);

    const linkName = results.violations.find((v) => v.id === "link-name");
    expect(linkName).toBeTruthy();
  });

  it("filters by runOnly tags", () => {
    const html = `<!DOCTYPE html><html><head></head><body><img src="x.jpg"></body></html>`;
    const results = fastA11y(html, {
      runOnly: { type: "tag", values: ["wcag2a"] },
    });

    // Should include image-alt (wcag2a) but not meta-viewport (wcag2aa)
    const imageAlt = results.violations.find((v) => v.id === "image-alt");
    expect(imageAlt).toBeTruthy();

    // meta-viewport is wcag2aa, should not appear
    const allRuleIds = [
      ...results.violations.map((v) => v.id),
      ...results.passes.map((v) => v.id),
      ...results.inapplicable.map((v) => v.id),
    ];
    expect(allRuleIds).not.toContain("meta-viewport");
  });

  it("handles duplicate IDs", () => {
    const html = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><div id="foo">A</div><div id="foo">B</div></body></html>`;
    const results = fastA11y(html);

    const dupId = results.violations.find((v) => v.id === "duplicate-id");
    expect(dupId).toBeTruthy();
  });

  it("catches missing form label", () => {
    const html = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><input type="text"></body></html>`;
    const results = fastA11y(html);

    const label = results.violations.find((v) => v.id === "label");
    expect(label).toBeTruthy();
  });

  it("catches blink element", () => {
    const html = `<!DOCTYPE html><html lang="en"><head><title>Test</title></head><body><blink>Warning!</blink></body></html>`;
    const results = fastA11y(html);

    const blink = results.violations.find((v) => v.id === "blink");
    expect(blink).toBeTruthy();
  });

  it("valid page has mostly passes", () => {
    const html = `<!DOCTYPE html>
<html lang="en">
<head><title>Accessible Page</title></head>
<body>
  <header><nav><a href="/">Home</a></nav></header>
  <main>
    <h1>Welcome</h1>
    <p>This is a well-structured page.</p>
    <img src="photo.jpg" alt="A scenic view">
    <form>
      <label for="email">Email</label>
      <input type="email" id="email" autocomplete="email">
      <button type="submit">Submit</button>
    </form>
  </main>
  <footer><p>Footer content</p></footer>
</body>
</html>`;
    const results = fastA11y(html);

    expect(results.passes.length).toBeGreaterThan(0);
    // A well-formed page should have few or no critical violations
    const critical = results.violations.filter((v) => v.impact === "critical");
    expect(critical.length).toBe(0);
  });
});
