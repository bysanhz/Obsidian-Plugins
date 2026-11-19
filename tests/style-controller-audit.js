const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const pluginRoot = path.join(root, "bysan-style-controller");
const catalog = require(path.join(pluginRoot, "blue-topaz-settings.json"));
const themeSource = fs.readFileSync(path.join(pluginRoot, "theme-controls.js"), "utf8");
const baseCss = fs.readFileSync(path.join(pluginRoot, "blue-topaz-base.css"), "utf8");
const i18nSource = fs.readFileSync(path.join(pluginRoot, "i18n.js"), "utf8");
const mainSource = fs.readFileSync(path.join(pluginRoot, "main.js"), "utf8");
const reviewModuleRoot = path.join(pluginRoot, "modules", "selection-review-toolbar");
const reviewModuleSource = fs.readFileSync(path.join(reviewModuleRoot, "main.js"), "utf8");
const reviewModuleCss = fs.readFileSync(path.join(reviewModuleRoot, "styles.css"), "utf8");
const reviewModuleManifest = JSON.parse(fs.readFileSync(path.join(reviewModuleRoot, "manifest.json"), "utf8"));

const supportedTypes = new Set([
  "class-toggle", "class-select", "variable-select", "variable-themed-color",
  "variable-number-slider", "variable-number", "variable-text"
]);
const controls = catalog.settings.filter((item) => !["heading", "info-text"].includes(item.type));
const manualIds = new Set([
  "background-settings-workplace-background-image",
  "background-settings-workplace-theme-light",
  "background-settings-workplace-theme-dark",
  "font-size-code",
  "font-weight-strong",
  "resizable-mermaid"
]);
const renderedControls = controls.filter((item) => !manualIds.has(item.id));

assert.equal(new Set(controls.map((item) => item.id)).size, controls.length, "control IDs must be unique");
for (const item of controls) {
  assert(supportedTypes.has(item.type), `unsupported control type: ${item.type}`);
  if (["class-select", "variable-select"].includes(item.type) && !item.allowEmpty) {
    assert((item.options || []).some((option) => String(option.value) === String(item.default)), `missing select default: ${item.id}`);
  }
  if (item.type === "variable-number-slider") {
    assert(Number.isFinite(Number(item.default)), `non-numeric slider default: ${item.id}`);
    assert(Number(item.default) >= Number(item.min) && Number(item.default) <= Number(item.max), `slider default outside limits: ${item.id}`);
    assert(Number(item.step) > 0, `invalid slider step: ${item.id}`);
  }
  if (item.type === "variable-themed-color") {
    for (const mode of ["light", "dark"]) {
      assert(/^(?:#[0-9a-f]{6}(?:[0-9a-f]{2})?|rgba?\([^)]*\))$/i.test(item[`default-${mode}`] || ""), `invalid ${mode} color: ${item.id}`);
    }
  }
}

const fallbackAliases = new Set(
  Array.from(themeSource.matchAll(/\["([^"]+)", "([^"]+)"\]/g), (match) => match[1])
);
const placeholderColors = controls.filter((item) => item.type === "variable-themed-color"
  && [item["default-light"], item["default-dark"]].some((value) => String(value).toLowerCase() === "#00000000"));
const hostOrTransparent = new Set(["icon-color-focused", "bt-background-split-container"]);
for (const item of placeholderColors) {
  assert(
    baseCss.includes(`--${item.id}:`) || fallbackAliases.has(item.id) || hostOrTransparent.has(item.id),
    `placeholder color has no effective default source: ${item.id}`
  );
}

const sandbox = {
  module: { exports: {} }, exports: {}, console,
  globalThis: { __bysanObsidianSetting: function Setting() {} }
};
vm.runInNewContext(
  themeSource.replace(
    "module.exports = { ThemeControls, addValueStepper, addPointSizeStepper, readFontPoints, addStyleDropdown, FONT_WEIGHTS, ADVANCED_THEME_TOPICS };",
    "module.exports = { ThemeControls, parseColor, colorWithAlpha, ADVANCED_MODE_PAIRS, COMPATIBILITY_ONLY_IDS, optionLabel, isFontFamilySetting, cssStyleChoices, readFontPoints, parseFontconfigFamilies, fontChoices, selectedFontName, fontStack };"
  ),
  sandbox
);
const { ThemeControls, parseColor, colorWithAlpha } = sandbox.module.exports;
const { optionLabel, COMPATIBILITY_ONLY_IDS } = sandbox.module.exports;
const { isFontFamilySetting, cssStyleChoices, readFontPoints } = sandbox.module.exports;
const { parseFontconfigFamilies, fontChoices, selectedFontName, fontStack } = sandbox.module.exports;
const fontFaces = parseFontconfigFamilies("LXGW WenKai,霞鹜文楷\t\nLXGW WenKai,霞鹜文楷,LXGW WenKai Bold\t0\n" +
  "LXGW WenKai Mono,霞鹜文楷等宽\t100\nInter\t0\nNoto Sans CJK SC\t\n");
assert.deepEqual(Array.from(fontChoices(fontFaces, "霞鹜文楷", false, "zh"), font => font.family),
  ["LXGW WenKai", "LXGW WenKai Mono"], "localized aliases must rank exact matches and deduplicate faces");
assert.equal(fontChoices(fontFaces, "wen-kai", true, "en")[0].family, "LXGW WenKai Mono");
assert.equal(fontChoices(fontFaces, "思源黑体", false, "zh")[0].family, "Noto Sans CJK SC");
assert.equal(fontChoices(fontFaces, "wenkai", true, "zh")[0].displayName, "霞鹜文楷等宽");
assert.equal(fontChoices(fontFaces, "霞鹜文楷等宽", true, "en")[0].displayName, "LXGW WenKai Mono");
assert.equal(fontChoices(fontFaces, "not installed", true, "zh").length, 0);
assert.equal(selectedFontName(fontStack('Font "A"', true)), 'Font "A"');
assert.equal(selectedFontName('"Font A", "Font B", sans-serif'), null, "custom stacks must remain editable");
for (const id of ["bysan-code-block-font", "bysan-inline-code-font", "font-text-theme", "h1-font",
  "inline-title-font", "font-family-folder-file-title", "font-family-tag", "font-loading-text"]) {
  assert(isFontFamilySetting({id, type:"variable-text"}), `missing shared family picker for ${id}`);
}
assert(!isFontFamilySetting({id:"font-size-outline", type:"variable-text"}));
for (const id of ["h1-weight", "inline-title-weight", "font-style-em", "h6-underline-style",
  "font-weight-highlight-2", "list-ul-marker-4", "list-ol-marker-2", "fancy-hr-icon", "cloze-decoration-3"]) {
  const choices = cssStyleChoices(id);
  assert(choices?.length > 1 && new Set(choices.map(([value]) => value)).size === choices.length,
    `missing or duplicated style choices: ${id}`);
}
assert.equal(cssStyleChoices("inline-title-bg-url"), null, "custom URLs should remain editable");
assert.equal(readFontPoints(null, 16), 12, "CSS pixels must convert to typographic points");
for (const id of ["font-family-inline-code", "font-monospace-theme"]) {
  assert(COMPATIBILITY_ONLY_IDS.has(id), `legacy code font still visible: ${id}`);
}
const styleCss = fs.readFileSync(path.join(pluginRoot, "styles.css"), "utf8");
const headingModuleCss = fs.readFileSync(path.join(pluginRoot, "modules", "academic-heading-numbering", "styles.css"), "utf8");
for (const id of ["bysan-review-panel-bg", "bysan-review-title-color", "bysan-review-empty-bg",
  "bysan-review-empty-text", "bysan-review-empty-border", "bysan-review-card-bg",
  "bysan-review-card-text", "bysan-review-card-border"]) {
  assert(mainSource.includes(`["${id}",`), `missing review setting: ${id}`);
  assert(styleCss.includes(`var(--${id}`) && reviewModuleCss.includes(`var(--${id}`),
    `preview and actual review sidebar do not share ${id}`);
}
assert.equal((headingModuleCss.match(/var\(--bysan-heading-number-gap, /g) || []).length, 3,
  "heading gap must apply to editor, reading and outline");
assert.match(mainSource, /"remove-cloze-style", "启用答案遮挡"[^\n]*invertToggle: true/,
  "the positive cloze label must preserve the legacy inverted switch");
assert.match(mainSource, /"==~~答案~~=="[\s\S]*"\*==~~答案~~==\*"[\s\S]*"\*~~答案~~\*"/,
  "all three Markdown variants should be discoverable in their examples");
assert.match(mainSource, /CLOZE_SWITCH, \.\.\.CLOZE_VARIANTS\.flatMap/,
  "the legacy cloze group must not render a second copy of local controls");
for (const spanClass of ["bysan-grid-wide", "bysan-grid-fill-medium", "bysan-grid-fill-roomy"]) {
  assert(styleCss.includes(spanClass), `missing responsive control span: ${spanClass}`);
}
for (const id of ["bysan-code-block-font", "bysan-inline-code-font", "bysan-inline-code-border"]) {
  assert(mainSource.includes(`id: "${id}"`), `missing code appearance field: ${id}`);
}
assert.match(styleCss, /border: 1px solid var\(--bysan-inline-code-border, var\(--bysan-code-border\)\)/);
for (const id of ["bysan-code-block-font", "bysan-inline-code-font"]) {
  assert(styleCss.includes(`var(--${id}, var(--bysan-code-font))`), `missing legacy font fallback: ${id}`);
}
assert.equal(optionLabel("Grid notebook 1 (@CZ-15/YZ-10)", "zh"), "均匀网格");
for (const item of controls) {
  for (const option of (item.options || []).filter(option => option.value != null)) {
    for (const lang of ["zh", "en"]) {
      assert(!/\(@|adapted from @/i.test(optionLabel(option.label, lang)), `credit leaking into option label: ${item.id}`);
    }
  }
}
const reviewSandbox = {
  module: { exports: {} },
  exports: {},
  console,
  URL,
  globalThis: { crypto: { randomUUID: () => "12345678-1234-1234-1234-123456789abc" } },
  require(id) {
    if (id !== "obsidian") throw new Error(`unexpected dependency: ${id}`);
    return {
      Component: class Component {},
      ItemView: class ItemView {},
      MarkdownRenderer: {},
      MarkdownView: class MarkdownView {},
      Notice: class Notice {},
      Plugin: class Plugin {},
      SuggestModal: class SuggestModal {},
      setIcon() {}
    };
  }
};
vm.runInNewContext(
  `${reviewModuleSource}\n;globalThis.__reviewModuleTest = { findUniquePlainTextRange, sourceRangeForLines, lineForOffset, normalizeVisibleText, quoteWithSource, normalizeWebUrl, markdownLink, intersectsExistingLink };`,
  reviewSandbox
);
const {
  findUniquePlainTextRange,
  sourceRangeForLines,
  lineForOffset,
  normalizeVisibleText
} = reviewSandbox.globalThis.__reviewModuleTest;
const { quoteWithSource, normalizeWebUrl, markdownLink, intersectsExistingLink } = reviewSandbox.globalThis.__reviewModuleTest;
const heading = (text, line) => ({heading:text, position:{ start:{line} }});
assert.equal(quoteWithSource("First %% BYSAN-REVIEW:test %%\n\n**Second**", "folder/Note.md",
  [heading("Intro", 1),heading("Result", 8)], 4, "来源："),
  "> First \n>\n> **Second**\n>\n> — 来源：[[folder/Note#Intro]]");
assert.equal(quoteWithSource("Text", "folder/Note.md", [heading("Intro", 1),heading("Intro", 8)], 4, "Source: "),
  "> Text\n>\n> — Source: [[folder/Note]]");
assert.equal(quoteWithSource("Selection", "folder/Note.md", [heading("Intro", 1)], undefined, "来源："),
  "> Selection\n>\n> — 来源：[[folder/Note]]");
assert.equal(normalizeWebUrl("https://example.com/a(b)"), "https://example.com/a%28b%29");
for (const input of ["javascript:alert(1)", "data:text/html,abc", "https://", "https://domain/with space"]) {
  assert.equal(normalizeWebUrl(input), null, `invalid link target accepted: ${input}`);
}
assert.equal(markdownLink("[sample]", "https://example.com/"), "[\\[sample\\]](https://example.com/)");
assert(intersectsExistingLink("pre [[Note|name]] post", 11, 15));
assert(intersectsExistingLink("pre [name](https://example.com/a(b)) post", 6, 9));
assert(!intersectsExistingLink("pre [[Note|name]] post", 18, 22));
const plugin = { settings: { themeSettings: {} }, language: "zh", t: (key) => key, addCommand() {} };
const themeControls = new ThemeControls(plugin, catalog);
assert.equal(themeControls.controlItems.length, renderedControls.length, "every non-manual control must be owned");
const regionStats = themeControls.regionStats();
assert.equal(Object.values(regionStats).reduce((sum, count) => sum + count, 0), renderedControls.length, "every theme control must belong to exactly one interface region");
for (const region of ["workspace", "editor", "media", "extensions"]) {
  assert(regionStats[region] > 0, `empty interface region: ${region}`);
}
const byId = new Map(themeControls.controlItems.map(item => [item.id, item]));
assert.deepEqual([...themeControls.colorModeKeys("bysan-note-page-bg")],
  ["bysan-note-page-bg", "bg-color-notebook", "stripe-notebook-stripe-color"], "unified reset must also clear legacy colours for that mode");
for (const id of themeControls.colorModeKeys("bysan-note-page-bg").slice(1)) {
  assert(COMPATIBILITY_ONLY_IDS.has(id) && byId.has(id), `legacy background field must stay compatible without a duplicate control: ${id}`);
}
const noteColour = { id: "bysan-note-page-bg", type: "variable-themed-color", "default-light": "#ffffff" };
plugin.settings.themeSettings = {
  "background-notebook-liked-switch": true,
  "notebook-liked-markdown-page-options": "notebook-liked-markdown-page-dotted-notebook-1",
  "bg-color-notebook": { light: "#334455" },
  "stripe-notebook-stripe-color": { light: "#667788" }
};
assert.equal(themeControls.displayValueFor(noteColour, "light"), "#334455");
plugin.settings.themeSettings["notebook-liked-markdown-page-options"] = "notebook-liked-markdown-page-stripe-notebook-1";
assert.equal(themeControls.displayValueFor(noteColour, "light"), "#667788");
plugin.settings.themeSettings["bysan-note-page-bg"] = { light: "#112233" };
assert.equal(themeControls.displayValueFor(noteColour, "light"), "#112233");
plugin.settings.themeSettings = {};
for (const id of ["background-notebook-liked-switch", "notebook-liked-markdown-page-options",
  "bg-color-notebook", "dotted-notebook-dot-color", "grid-notebook-line-color-1", "grid-notebook-line-color-2",
  "stripe-notebook-stripe-color", "toggle-fixed-pattern", "toggle-split-note-background",
  "background-image-settings-switch", "custom-markdown-page-background-color", "bg-markdown-page-opacity-cp"]) {
  assert.equal(themeControls.advancedGroupFor(byId.get(id)), "note-background", `split note background control: ${id}`);
}
assert.match(baseCss, /dotted-notebook-1[^\n]*\.bysan-note-paper-example/);
assert.match(baseCss, /markdown-page-custom\.theme-dark[^\n]*\.bysan-note-backdrop-example/);
for (const [group, ids] of Object.entries({
  navigation: ["toggle-bg-panel-page", "background-panel-page-theme-light-custom", "bg-panel-page-opacity-cp"],
  tabs: ["tab-outline-color", "bt-colorful-titlebar"],
  tables: ["table-style-options", "table-width", "show-border-table"],
  quotes: ["blockquote-style-change-options"],
  blocks: ["admonition-bg-color", "callout-style-settings"],
  lists: ["fancy-hr", "hr-color-1", "checkbox-size"],
  marks: ["font-family-tag", "tag-style-option"],
  math: ["mjx-inline-math-color", "mjx-math-color"],
  code: ["font-family-inline-code", "font-monospace-theme"],
  window: ["setting-etc-pane-style", "background-popover"]
})) {
  for (const id of ids) assert.equal(themeControls.advancedGroupFor(byId.get(id)), group, `misplaced control: ${id}`);
}
for (const [lightId, darkId] of sandbox.module.exports.ADVANCED_MODE_PAIRS) {
  const light = byId.get(lightId);
  const dark = byId.get(darkId);
  assert(light && dark && light.type === dark.type, `invalid advanced mode pair: ${lightId} / ${darkId}`);
  assert.equal(themeControls.advancedGroupFor(light), themeControls.advancedGroupFor(dark), `split mode pair: ${lightId} / ${darkId}`);
}
assert.equal(colorWithAlpha("#123456", 0.5), "#12345680");
for (const [input, expectedHex, expectedAlpha] of [
  ["#11223380", "#112233", 128 / 255],
  ["rgba(1, 2, 3, 0.4)", "#010203", 0.4],
  ["rgb(1 2 3 / 40%)", "#010203", 0.4],
  ["color(srgb 0.2 0.4 0.6 / 0.76)", "#336699", 0.76],
  ["color(srgb 0.2 0.4 0.6 / 33%)", "#336699", 0.33],
  ["transparent", "#000000", 0]
]) {
  const parsed = parseColor(input);
  assert.equal(parsed.hex, expectedHex, `wrong parsed color: ${input}`);
  assert(Math.abs(parsed.alpha - expectedAlpha) < 0.005, `wrong parsed alpha: ${input}`);
}

const defaultMatch = mainSource.match(/const DEFAULT_SETTINGS = (\{[\s\S]*?\n\});/);
assert(defaultMatch, "DEFAULT_SETTINGS must remain statically auditable");
const defaultsSandbox = { module: { exports: {} } };
vm.runInNewContext(`module.exports = ${defaultMatch[1]}`, defaultsSandbox);
const defaults = defaultsSandbox.module.exports;
const manualColorKeys = [
  "codeBgLight", "codeBgDark", "codeBorderLight", "codeBorderDark",
  "codeTextLight", "codeTextDark", "inlineBgLight", "inlineBgDark",
  "inlineTextLight", "inlineTextDark", "inlineShadowLight", "inlineShadowDark",
  "tableHeadLight", "tableHeadDark", "tableStripeLight", "tableStripeDark",
  "tableHoverLight", "tableHoverDark", "tableBorderLight", "tableBorderDark",
  "quoteBgLight", "quoteBgDark", "quoteBorderLight", "quoteBorderDark",
  "markerLight", "markerDark"
];
for (const key of manualColorKeys) {
  assert(/^#[0-9a-f]{6}$/i.test(defaults[key]), `invalid manual palette color: ${key}`);
}
for (const key of ["codeBgOpacityLight", "codeBgOpacityDark", "quoteBgOpacityLight", "quoteBgOpacityDark"]) {
  assert(defaults[key] >= 0 && defaults[key] <= 1, `invalid opacity default: ${key}`);
}
assert(defaults.codeBlur >= 0 && defaults.codeBlur <= 8, "invalid code blur default");
assert(defaults.codeLetterSpacing >= 0 && defaults.codeLetterSpacing <= 2, "invalid letter-spacing default");
for (const key of ["workspaceBackground", "collapsedLineRanges", "codeLineNumbers", "codeWrapReading", "codeNoWrapLive", "muteCodeActiveLine", "tableZebra", "tableCentered", "quoteSerif"]) {
  assert.equal(typeof defaults[key], "boolean", `invalid toggle default: ${key}`);
}
for (const key of ["moduleHeadingNumbering", "moduleMediaResizer", "moduleReviewToolbar"]) {
  assert.equal(typeof defaults[key], "boolean", `invalid integrated-module toggle: ${key}`);
}
assert(defaults.reviewBadgeSize >= 12 && defaults.reviewBadgeSize <= 24, "invalid review badge size default");
for (const key of [
  "inlineCodeRadius", "inlineCodeFontSize", "inlineCodePaddingY", "inlineCodePaddingX",
  "inlineCodeMargin", "inlineCodeShadowSize", "codeBlockRadius", "codeBlockFontSize",
  "codeBlockLineHeight", "codeBlockPaddingY", "codeBlockPaddingX", "tableBorderWidth",
  "tableCellPaddingY", "tableCellPaddingX", "tableHeaderWeight", "tableMarginY",
  "quoteBorderWidth", "quoteRadius", "quoteFontSize", "quotePaddingY", "quotePaddingX",
  "listMarkerWeight", "taskCheckboxSize", "taskCheckboxOffset", "hrWidth", "hrMargin",
  "strongWeight"
]) {
  assert(Number.isFinite(defaults[key]), `invalid content-geometry default: ${key}`);
}
for (const method of [
  "requestStylePresetSwitch", "saveStylePreset", "renameStylePreset", "deleteStylePreset",
  "renderSectionNavigation", "renderStylePresetSettings", "renderWorkspaceSettings",
  "renderCodeSettings", "renderEditorRegionSettings", "renderInlineCodeSettings",
  "renderTableSettings", "renderQuoteSettings", "renderTextDetailSettings", "openPdfPreview",
  "renderIntegratedModuleSettings", "syncIntegratedModules", "addNumberSetting",
  "createMajorArea", "createSettingsSection", "createFeatureGroup",
  "setActiveMajorArea", "renderGeometryControls", "renderThemeGroups"
]) {
  assert(mainSource.includes(`${method}(`), `missing plugin feature: ${method}`);
}

assert(!mainSource.includes('createSubarea(content, "palette"'), "legacy standalone dual-mode palette area still rendered");
assert(!mainSource.includes('createMajorArea(\n      areas,\n      "theme"'), "legacy full-theme major area still rendered");
assert(mainSource.includes('this.renderEditorRegionSettings(content)'), "note appearance is not rendered in the content tab");
for (const objectId of ["body-text", "headings", "code", "blocks", "text-details", "embeds"]) {
  assert(mainSource.includes(`createSettingsSection(containerEl, "${objectId}"`), `missing editor object group: ${objectId}`);
}
assert(!mainSource.includes('createSubarea('), "legacy nested settings navigation is still rendered");
const mountedGroups = [...mainSource.matchAll(/this\.renderThemeGroups\((?:body|controls), \[([^\]]*)\]/g)]
  .flatMap(match => [...match[1].matchAll(/"([^"]+)"/g)].map(entry => entry[1]));
const expectedGroups = [
  "general", "workspace-background", "tabs", "navigation", "window", "canvas", "graph",
  "pdf", "plugins", "documents", "note-background", "marks", "headings", "typography",
  "lists", "blocks", "embeds", "math", "tables", "quotes"
];
assert.deepStrictEqual(mountedGroups.sort(), expectedGroups.sort(), "every theme group must be mounted exactly once");
assert(mainSource.includes('this.renderCompactSample(containerEl, "tags"'), "missing preview colocated with tag controls");
assert(![mainSource, themeSource].some(source => source.includes("bysan-theme-color-value")),
  "color codes must be in picker tooltips, not inline settings labels");
for (const sample of ["tabs", "navigation", "window", "embeds", "canvas", "graph"]) {
  assert(mainSource.includes(`\n      ${sample}: [tr(`), `missing inline preview: ${sample}`);
}
assert(mainSource.includes('MarkdownRenderer.render(this.app, markdown, sample, "", this.sampleComponent)'),
  "reading examples must use the note renderer");
assert(mainSource.includes('createSettingsSection(tools, "blank-line-cleanup"'), "blank-line cleanup must be directly available in writing tools");

const usedTranslations = new Set();
for (const file of ["main.js", "theme-controls.js", "pdf-preview.js"]) {
  const source = fs.readFileSync(path.join(pluginRoot, file), "utf8");
  for (const match of source.matchAll(/\.t\("([^"]+)"/g)) usedTranslations.add(match[1]);
}
const languageKeys = { zh: new Set(), en: new Set() };
let language = "zh";
for (const line of i18nSource.split(/\n/)) {
  if (/^\s*en:\s*\{/.test(line)) language = "en";
  const match = line.match(/[,\"]([A-Za-z0-9_.]+)"\s*:/);
  if (match) languageKeys[language].add(match[1]);
}
for (const key of usedTranslations) {
  assert(languageKeys.zh.has(key), `missing Chinese translation: ${key}`);
  assert(languageKeys.en.has(key), `missing English translation: ${key}`);
}

for (const file of ["main.js", "theme-controls.js", "pdf-preview.js", "styles.css", "manifest.json", "blue-topaz-base.css", "blue-topaz-settings.json"]) {
  assert(fs.existsSync(path.join(pluginRoot, file)), `missing plugin asset: ${file}`);
}
for (const moduleId of ["academic-heading-numbering", "mermaid-inline-resizer", "selection-review-toolbar"]) {
  for (const file of ["main.js", "styles.css", "manifest.json"]) {
    assert(fs.existsSync(path.join(pluginRoot, "modules", moduleId, file)), `missing integrated module asset: ${moduleId}/${file}`);
  }
}

assert.equal(reviewModuleManifest.version, "0.2.5", "selection review module version mismatch");
for (const method of [
  "registerReadingSectionMapping", "captureReadingSelection", "mapReadingSelectionToSource",
  "refreshReadingReviewBadges", "findReadingSectionForLine", "replaceCachedFileRange",
  "getReviewBadgeSize", "activateReviewNavigator", "getCurrentFileReviewItems",
  "jumpToReviewItem", "scrollEditingViewToReview", "scrollReadingViewToReview"
]) {
  assert(reviewModuleSource.includes(`${method}(`), `missing reading review support: ${method}`);
}
assert(reviewModuleCss.includes(".art-toolbar.art-reading-selection"), "reading toolbar must hide source-only actions");
assert(reviewModuleCss.includes("--art-review-badge-size"), "review badge size must be controlled by Style Controller");
assert(reviewModuleSource.includes("REVIEW_NAVIGATOR_VIEW_TYPE"), "review navigator view must be registered");
assert(reviewModuleCss.includes(".art-review-sidebar-card"), "review navigator cards must be styled");
const sampleSource = "第一行\n## 标题文本\n普通段落里有一段需要评论的文字。\n下一行";
const titleRange = sourceRangeForLines(sampleSource, 1, 1);
assert.equal(sampleSource.slice(titleRange.start, titleRange.end).trim(), "## 标题文本");
assert.equal(lineForOffset(sampleSource, sampleSource.indexOf("需要评论")), 2);
const plainRange = findUniquePlainTextRange("普通段落里有一段需要评论的文字。", "需要评论");
assert.equal(plainRange.start, 8);
assert.equal(plainRange.end, 12);
assert.equal(findUniquePlainTextRange("重复 重复", "重复"), null, "ambiguous reading selection must not map to source");
assert.equal(normalizeVisibleText(" a\n\t b "), "a b");

const counts = Object.fromEntries([...supportedTypes].map((type) => [
  type,
  renderedControls.filter((item) => item.type === type).length
]));
console.log(JSON.stringify({
  catalogItems: catalog.settings.length,
  auditedControls: renderedControls.length,
  placeholderColors: placeholderColors.length,
  manualPaletteColors: manualColorKeys.length,
  translationKeys: usedTranslations.size,
  counts
}, null, 2));
