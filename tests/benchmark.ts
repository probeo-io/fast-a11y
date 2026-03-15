/**
 * Quick benchmark: run fast-a11y against a large HTML page.
 * Usage: npx tsx tests/benchmark.ts
 */

import { fastA11y } from "../src/index.js";

// Generate a realistic large page
function generatePage(numElements: number): string {
  const parts = [
    `<!DOCTYPE html><html lang="en"><head><title>Benchmark Page</title></head><body>`,
    `<header><nav><a href="/">Home</a> <a href="/about">About</a></nav></header>`,
    `<main><h1>Benchmark</h1>`,
  ];

  for (let i = 0; i < numElements; i++) {
    // Mix of good and bad elements
    if (i % 5 === 0) parts.push(`<img src="img${i}.jpg">`); // bad: no alt
    if (i % 5 === 1) parts.push(`<img src="img${i}.jpg" alt="Image ${i}">`); // good
    if (i % 5 === 2) parts.push(`<a href="/page${i}">Link ${i}</a>`); // good
    if (i % 5 === 3) parts.push(`<button></button>`); // bad: no name
    if (i % 5 === 4) parts.push(`<p>Paragraph ${i} with some text content here.</p>`);
    if (i % 20 === 0) parts.push(`<h2>Section ${i}</h2>`);
    if (i % 50 === 0) parts.push(`<form><input type="text"><select><option>Pick</option></select></form>`);
  }

  parts.push(`</main><footer><p>Footer</p></footer></body></html>`);
  return parts.join("\n");
}

const sizes = [100, 500, 1000, 5000];

for (const size of sizes) {
  const html = generatePage(size);
  const htmlSizeKB = (Buffer.byteLength(html) / 1024).toFixed(1);

  const memBefore = process.memoryUsage().heapUsed;
  const start = performance.now();

  const results = fastA11y(html, {
    runOnly: { type: "tag", values: ["wcag2a", "wcag2aa"] },
  });

  const elapsed = (performance.now() - start).toFixed(1);
  const memAfter = process.memoryUsage().heapUsed;
  const memUsedMB = ((memAfter - memBefore) / (1024 * 1024)).toFixed(1);

  console.log(
    `${size} elements | ${htmlSizeKB}KB HTML | ${elapsed}ms | ~${memUsedMB}MB heap | ${results.violations.length} violations, ${results.passes.length} passes`
  );
}
