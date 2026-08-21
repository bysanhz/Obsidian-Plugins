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

const supportedTypes = new Set([
  "class-toggle", "class-select", "variable-select", "variable-themed-color",
  "variable-number-slider", "variable-number", "variable-text"
]);
const controls = catalog.settings.filter((item) => !["heading", "info-text"].includes(item.type));
const manualIds = new Set([
  "background-settings-workplace-background-image",
  "background-settings-workplace-theme-light",
  "background-settings-workplace-theme-dark"
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
    "module.exports = { ThemeControls };",
    "module.exports = { ThemeControls, parseColor, colorWithAlpha };"
  ),
  sandbox
);
const { ThemeControls, parseColor, colorWithAlpha } = sandbox.module.exports;
const plugin = { settings: { themeSettings: {} }, language: "zh", t: (key) => key, addCommand() {} };
const themeControls = new ThemeControls(plugin, catalog);
assert.equal(themeControls.controlItems.length, renderedControls.length, "every non-manual control must be owned");
assert.equal(colorWithAlpha("#123456", 0.5), "#12345680");
for (const [input, expectedHex, expectedAlpha] of [
  ["#11223380", "#112233", 128 / 255],
  ["rgba(1, 2, 3, 0.4)", "#010203", 0.4],
  ["rgb(1 2 3 / 40%)", "#010203", 0.4],
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
for (const method of [
  "requestStylePresetSwitch", "saveStylePreset", "renameStylePreset", "deleteStylePreset",
  "renderSectionNavigation", "renderStylePresetSettings", "renderWorkspaceSettings",
  "renderCodeSettings", "renderPaletteSettings", "renderComponentSettings", "openPdfPreview"
]) {
  assert(mainSource.includes(`${method}(`), `missing plugin feature: ${method}`);
}

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
