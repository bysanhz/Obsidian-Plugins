const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const pluginRoot = path.join(root, "selection-review-toolbar");
const source = fs.readFileSync(path.join(pluginRoot, "main.js"), "utf8");
const css = fs.readFileSync(path.join(pluginRoot, "styles.css"), "utf8");
const manifest = JSON.parse(fs.readFileSync(path.join(pluginRoot, "manifest.json"), "utf8"));

const sandbox = {
  module: { exports: {} },
  exports: {},
  console,
  globalThis: { crypto: { randomUUID: () => "12345678-1234-1234-1234-123456789abc" } },
  require(id) {
    if (id !== "obsidian") throw new Error(`unexpected dependency: ${id}`);
    return {
      Component: class Component {},
      MarkdownRenderer: {},
      MarkdownView: class MarkdownView {},
      Notice: class Notice {},
      Plugin: class Plugin {},
      setIcon() {}
    };
  }
};
vm.runInNewContext(
  `${source}\n;globalThis.__reviewTest = { parseReviewMarkers, createReviewId, DEFAULT_DATA };`,
  sandbox
);

const { parseReviewMarkers, createReviewId, DEFAULT_DATA } = sandbox.globalThis.__reviewTest;
const parsed = parseReviewMarkers([
  "alpha %% BYSAN-REVIEW:abc_123 %%",
  "beta %% REVIEW: old **Markdown** with $x^2$ %%"
].join("\n"));
assert.equal(parsed.length, 2);
assert.equal(parsed[0].id, "abc_123");
assert.equal(parsed[0].legacyBody, null);
assert.equal(parsed[1].id, null);
assert.equal(parsed[1].legacyBody, "old **Markdown** with $x^2$");
assert(parsed[0].start < parsed[1].start, "markers must be source ordered");
assert.equal(createReviewId(), "123456781234");
assert.equal(DEFAULT_DATA.popup.width, 560);
assert.equal(DEFAULT_DATA.popup.height, 420);
assert.equal(DEFAULT_DATA.customColors.length, 4);
assert(DEFAULT_DATA.customColors.every((value) => /^#[0-9a-f]{6}$/i.test(value)));

for (const method of [
  "createReviewWindow", "installReviewWindowDrag", "renderReviewPreview",
  "saveActiveReview", "deleteActiveReview", "replaceReviewMarker",
  "refreshReviewBadges", "persistReviewWindowGeometry"
]) {
  assert(source.includes(`${method}(`), `missing review feature: ${method}`);
}

for (const selector of [
  ".art-review-badge", ".art-review-window", ".art-review-header",
  ".art-review-editor", ".art-review-preview", ".art-review-save"
]) {
  assert(css.includes(selector), `missing review style: ${selector}`);
}
assert(css.includes("resize: both"), "review window must be resizable");
assert(source.includes("MarkdownRenderer.render"), "Markdown/LaTeX preview must use Obsidian renderer");
assert(source.includes("%% BYSAN-REVIEW:${id} %%"), "new comments must insert a short marker");
for (const index of [1, 2, 3, 4]) {
  assert(css.includes(`.art-text-custom-${index}`), `missing custom text color ${index}`);
  assert(css.includes(`mark.art-hl-custom-${index}`), `missing custom highlight ${index}`);
}
assert(source.includes("this.commentPanelEl?.classList.remove"), "color panel must tolerate removed legacy comment panel");
assert.equal(manifest.version, "0.2.1");

console.log(JSON.stringify({
  version: manifest.version,
  markerFormats: ["BYSAN-REVIEW", "legacy REVIEW"],
  reviewMethods: 8,
  reviewSelectors: 6,
  markdownRenderer: true,
  draggable: true,
  resizable: true,
  customColorSlots: 4
}, null, 2));
