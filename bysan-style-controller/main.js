/**
 * Bysan Style Controller
 * Version: 0.8.1
 *
 * Owns visual presentation only. Heading/equation numbering and media sizing
 * remain exclusively owned by their dedicated plugins.
 */

const {
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting
} = require("obsidian");
/* Obsidian evaluates main.js without a plugin-local CommonJS base path. Resolve
 * the helper through the active vault so the plugin remains portable. */
globalThis.__bysanObsidianSetting = Setting;
const { ThemeControls } = require(app.vault.adapter.getFullPath(
  ".obsidian/plugins/bysan-style-controller/theme-controls.js"
));
const { resolveLanguage, translate } = require(app.vault.adapter.getFullPath(
  ".obsidian/plugins/bysan-style-controller/i18n.js"
));
delete globalThis.__bysanObsidianSetting;


const CODE_THEME_CLASSES = [
  "code-theme-bt-default",
  "code-theme-solarized-light",
  "code-theme-material-palenight",
  "code-theme-dracula",
  "code-theme-Gruvbox-dark",
  "code-theme-monokai",
  "code-theme-sublime"
];

const LIGHT_BACKGROUND_CLASSES = [
  "background-settings-workplace-theme-light-blue-mountain",
  "background-settings-workplace-theme-light-in-the-note",
  "background-settings-workplace-waves-light",
  "background-settings-workplace-waves2-light",
  "background-settings-workplace-theme-light-custom-option"
];

const DARK_BACKGROUND_CLASSES = [
  "background-settings-workplace-theme-dark-night-sky",
  "background-settings-workplace-theme-dark-dark-sky",
  "background-settings-workplace-theme-dark-in-the-sky",
  "background-settings-workplace-waves",
  "background-settings-workplace-waves2",
  "background-settings-workplace-theme-dark-custom-option"
];

const CONTROLLED_CLASSES = [
  ...CODE_THEME_CLASSES,
  ...LIGHT_BACKGROUND_CLASSES,
  ...DARK_BACKGROUND_CLASSES,
  "background-image-settings-switch",
  "background-settings-workplace-background-image",
  "code-line-number",
  "whole-code-wrap",
  "nowrap-edit-codebox",
  "muted-code-activeline-bg",
  "bysan-style-controller-active",
  "bysan-table-zebra-disabled",
  "bysan-table-left-aligned",
  "bysan-quote-system-font"
];

const CONTROLLED_PROPERTIES = [
  "--bysan-code-bg",
  "--bysan-code-active-bg",
  "--bysan-code-border",
  "--bysan-code-text",
  "--bysan-inline-code-bg",
  "--bysan-inline-code-text",
  "--bysan-inline-code-shadow",
  "--bysan-table-head-bg",
  "--bysan-table-stripe-bg",
  "--bysan-table-hover-bg",
  "--bysan-table-border",
  "--bysan-quote-bg",
  "--bysan-quote-border",
  "--bysan-muted-marker",
  "--bysan-table-inline-margin",
  "--bysan-quote-font",
  "--background-code",
  "--background-code-2",
  "--code-background",
  "--code-normal",
  "--blur-codebox-frosted-glass",
  "--letter-space-code"
];

const DEFAULT_SETTINGS = {
  settingsVersion: 6,
  uiLanguage: "auto",
  stylePresets: {},
  activeStylePreset: "__default__",
  stylePresetDirty: false,
  themeSettings: {},
  collapsedLineRanges: true,
  workspaceBackground: true,
  lightBackground: "background-settings-workplace-waves2-light",
  darkBackground: "background-settings-workplace-theme-dark-in-the-sky",
  codeTheme: "code-theme-bt-default",
  codeLineNumbers: true,
  codeWrapReading: true,
  codeNoWrapLive: false,
  muteCodeActiveLine: false,
  codeBlur: 3,
  codeLetterSpacing: 0,
  tableZebra: true,
  tableCentered: true,
  quoteSerif: true,

  codeBgLight: "#c6efd2",
  codeBgOpacityLight: 0.42,
  codeBorderLight: "#5ca671",
  codeTextLight: "#263238",
  inlineBgLight: "#fefefe",
  inlineTextLight: "#3c70c6",
  inlineShadowLight: "#c8d3df",
  tableHeadLight: "#def4fe",
  tableStripeLight: "#e4f3fa",
  tableHoverLight: "#e7f7ff",
  tableBorderLight: "#dfe2e5",
  quoteBgLight: "#def4fe",
  quoteBgOpacityLight: 0.42,
  quoteBorderLight: "#79b8d8",
  markerLight: "#5f82a8",

  codeBgDark: "#5bad70",
  codeBgOpacityDark: 0.18,
  codeBorderDark: "#7bcd91",
  codeTextDark: "#e9eded",
  inlineBgDark: "#161616",
  inlineTextDark: "#8bb1f9",
  inlineShadowDark: "#141414",
  tableHeadDark: "#263238",
  tableStripeDark: "#20272d",
  tableHoverDark: "#2a363e",
  tableBorderDark: "#46535e",
  quoteBgDark: "#263238",
  quoteBgOpacityDark: 0.68,
  quoteBorderDark: "#607d8b",
  markerDark: "#8bb1f9"
};

const PRESET_META_KEYS = new Set([
  "settingsVersion",
  "stylePresets",
  "activeStylePreset",
  "stylePresetDirty",
  "uiLanguage"
]);

const PALETTE_SETTING_KEYS = new Set([
  "codeBgLight", "codeBgDark", "codeBgOpacityLight", "codeBgOpacityDark",
  "codeBorderLight", "codeBorderDark", "codeTextLight", "codeTextDark",
  "inlineBgLight", "inlineBgDark", "inlineTextLight", "inlineTextDark",
  "inlineShadowLight", "inlineShadowDark", "tableHeadLight", "tableHeadDark",
  "tableStripeLight", "tableStripeDark", "tableHoverLight", "tableHoverDark",
  "tableBorderLight", "tableBorderDark", "quoteBgLight", "quoteBgDark",
  "quoteBgOpacityLight", "quoteBgOpacityDark", "quoteBorderLight", "quoteBorderDark",
  "markerLight", "markerDark"
]);


function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}


function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}


function hexToRgba(hex, opacity) {
  const normalized = String(hex || "").trim().replace(/^#/, "");
  const expanded = normalized.length === 3
    ? normalized.split("").map((character) => character + character).join("")
    : normalized;

  if (!/^[0-9a-f]{6}$/i.test(expanded)) {
    return `rgba(0, 0, 0, ${clamp(opacity, 0, 1)})`;
  }

  const value = Number.parseInt(expanded, 16);
  const red = (value >> 16) & 255;
  const green = (value >> 8) & 255;
  const blue = value & 255;
  return `rgba(${red}, ${green}, ${blue}, ${clamp(opacity, 0, 1)})`;
}


module.exports = class BysanStyleController extends Plugin {

  async onload() {
    const savedSettings = await this.loadData() || {};
    this.settings = Object.assign({}, DEFAULT_SETTINGS, savedSettings);

    /* v0.1.0/0.1.1 used values that were technically present but nearly
     * indistinguishable on a white page. Migrate only untouched old defaults;
     * preserve any color or opacity the user has actually customized. */
    if ((savedSettings.settingsVersion || 0) < 2) {
      if (savedSettings.codeBgOpacityLight === 0.22) {
        this.settings.codeBgOpacityLight = DEFAULT_SETTINGS.codeBgOpacityLight;
      }
      if (savedSettings.codeBgOpacityDark === 0.10) {
        this.settings.codeBgOpacityDark = DEFAULT_SETTINGS.codeBgOpacityDark;
      }
      if (String(savedSettings.tableStripeLight).toLowerCase() === "#f1faff") {
        this.settings.tableStripeLight = DEFAULT_SETTINGS.tableStripeLight;
      }
      this.settings.settingsVersion = 2;
      await this.saveData(this.settings);
    }

    if ((savedSettings.settingsVersion || 0) < 4) {
      delete this.settings.bundledBaseTheme;
      this.settings.themeSettings = savedSettings.themeSettings || {};
      this.settings.settingsVersion = 4;
      await this.saveData(this.settings);
    }

    if ((savedSettings.settingsVersion || 0) < 5) {
      this.settings.stylePresets = savedSettings.stylePresets || {};
      this.settings.activeStylePreset = "__current__";
      this.settings.stylePresetDirty = true;
      this.settings.settingsVersion = 5;
      await this.saveData(this.settings);
    }

    if ((savedSettings.settingsVersion || 0) < 6) {
      this.settings.uiLanguage = savedSettings.uiLanguage || "auto";
      this.settings.settingsVersion = 6;
      await this.saveData(this.settings);
    }

    await this.loadThemeCatalog();
    this.themeControls = new ThemeControls(this, this.themeCatalog);
    this.themeControls.registerCommands();
    await this.syncBundledBaseTheme();
    this.originalClassState = new Map();
    this.originalPropertyState = new Map();
    this.lastDarkMode = document.body.classList.contains("theme-dark");

    const controlledClasses = [...new Set([
      ...CONTROLLED_CLASSES,
      ...this.themeControls.classNames()
    ])];
    for (const className of controlledClasses) {
      this.originalClassState.set(className, document.body.classList.contains(className));
    }

    const controlledProperties = [...new Set([
      ...CONTROLLED_PROPERTIES,
      ...this.themeControls.propertyNames()
    ])];
    for (const property of controlledProperties) {
      this.originalPropertyState.set(property, {
        value: document.body.style.getPropertyValue(property),
        priority: document.body.style.getPropertyPriority(property)
      });
    }

    this.addSettingTab(new BysanStyleSettingTab(this.app, this));
    this.applySettings();

    this.themeObserver = new MutationObserver(() => {
      const darkMode = document.body.classList.contains("theme-dark");
      if (darkMode !== this.lastDarkMode) {
        this.lastDarkMode = darkMode;
        this.applyPalette();
        this.themeControls.applyVariables();
      }
    });
    this.themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"]
    });

    this.lineRangeObserver = new MutationObserver(() => this.scheduleLineRangeRefresh());
    const workspaceEl = document.querySelector(".workspace");
    if (workspaceEl) {
      this.lineRangeObserver.observe(workspaceEl, { childList: true, subtree: true });
    }
    this.registerDomEvent(document, "scroll", () => this.scheduleLineRangeRefresh(), true);
    this.registerEvent(this.app.workspace.on("layout-change", () => this.scheduleLineRangeRefresh()));
    this.registerEvent(this.app.workspace.on("active-leaf-change", () => this.scheduleLineRangeRefresh()));
    this.scheduleLineRangeRefresh();

    for (const delay of [0, 250]) {
      const timer = window.setTimeout(() => this.ensureStyleOrder(), delay);
      this.register(() => window.clearTimeout(timer));
    }

    console.log(`[Bysan Style Controller] v0.8.1 loaded with ${this.themeControls.count} theme controls`);
  }


  get language() {
    return resolveLanguage(this.settings.uiLanguage, this.app);
  }


  t(key, values) {
    return translate(this.language, key, values);
  }


  async setUiLanguage(value) {
    this.settings.uiLanguage = ["auto", "zh", "en"].includes(value) ? value : "auto";
    await this.saveData(this.settings);
  }


  onunload() {
    this.themeObserver?.disconnect();
    this.lineRangeObserver?.disconnect();
    if (this.lineRangeFrame) window.cancelAnimationFrame(this.lineRangeFrame);
    this.clearLineRangeLabels();
    this.baseThemeStyleEl?.remove();

    for (const [className, enabled] of this.originalClassState || []) {
      document.body.classList.toggle(className, enabled);
    }

    for (const [property, state] of this.originalPropertyState || []) {
      if (state.value) {
        document.body.style.setProperty(property, state.value, state.priority);
      } else {
        document.body.style.removeProperty(property);
      }
    }
  }


  async updateSetting(key, value) {
    this.settings[key] = value;
    if (!PRESET_META_KEYS.has(key)) this.settings.stylePresetDirty = true;
    await this.saveData(this.settings);
    if (PALETTE_SETTING_KEYS.has(key)) {
      this.applyPalette();
    } else {
      this.applySettings();
    }
  }


  async updateThemeSetting(id, value) {
    this.settings.themeSettings = {
      ...(this.settings.themeSettings || {}),
      [id]: value
    };
    this.settings.stylePresetDirty = true;
    await this.saveData(this.settings);
    this.themeControls.applySetting(id);
  }


  async resetSetting(key) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) return false;
    this.settings[key] = deepClone(DEFAULT_SETTINGS[key]);
    this.settings.stylePresetDirty = true;
    await this.saveData(this.settings);
    if (PALETTE_SETTING_KEYS.has(key)) this.applyPalette();
    else this.applySettings();
    return true;
  }


  async clearThemeColorMode(id, mode) {
    const stored = this.settings.themeSettings?.[id];
    if (!stored || typeof stored !== "object") return false;
    const next = { ...stored };
    delete next[mode];
    this.settings.themeSettings = { ...(this.settings.themeSettings || {}) };
    if (Object.keys(next).length) this.settings.themeSettings[id] = next;
    else delete this.settings.themeSettings[id];
    this.settings.stylePresetDirty = true;
    await this.saveData(this.settings);
    this.themeControls.applySetting(id);
    return true;
  }


  captureStyleSettings(source = this.settings) {
    return Object.fromEntries(Object.entries(source)
      .filter(([key]) => !PRESET_META_KEYS.has(key))
      .map(([key, value]) => [key, deepClone(value)]));
  }


  async saveStylePreset(name, presetId = null) {
    const normalizedName = String(name || "").trim().slice(0, 60);
    if (!normalizedName) {
      new Notice(this.t("notice.nameRequired"));
      return null;
    }

    const id = presetId || `preset-${Date.now().toString(36)}`;
    const existing = this.settings.stylePresets?.[id];
    this.settings.stylePresets = {
      ...(this.settings.stylePresets || {}),
      [id]: {
        name: normalizedName,
        createdAt: existing?.createdAt || new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        settings: this.captureStyleSettings()
      }
    };
    this.settings.activeStylePreset = id;
    this.settings.stylePresetDirty = false;
    await this.saveData(this.settings);
    new Notice(this.t(existing ? "notice.overwritten" : "notice.saved", { name: normalizedName }));
    return id;
  }


  async loadStylePreset(presetId, options = {}) {
    if (this.settings.stylePresetDirty && !options.allowDiscard) {
      new Notice(this.t("notice.unsaved"));
      return false;
    }

    const preservedPresets = deepClone(this.settings.stylePresets || {});
    let snapshot;
    let label;

    if (presetId === "__default__") {
      snapshot = this.captureStyleSettings(DEFAULT_SETTINGS);
      label = "Bysan 默认（浅色/深色自适应）";
    } else {
      const preset = preservedPresets[presetId];
      if (!preset) {
        new Notice(this.t("notice.notFound"));
        return false;
      }
      snapshot = deepClone(preset.settings || {});
      label = preset.name;
    }

    this.settings = Object.assign({}, deepClone(DEFAULT_SETTINGS), snapshot, {
      settingsVersion: DEFAULT_SETTINGS.settingsVersion,
      stylePresets: preservedPresets,
      activeStylePreset: presetId,
      stylePresetDirty: false
    });
    await this.saveData(this.settings);
    this.applySettings();
    new Notice(this.t("notice.loaded", { name: label }));
    return true;
  }


  stylePresetLabel(presetId) {
    if (presetId === "__default__") return this.t("preset.default");
    if (presetId === "__current__") return this.t("preset.currentUnsavedLong");
    return this.settings.stylePresets?.[presetId]?.name
      || (this.language === "zh" ? "未知风格" : "Unknown style");
  }


  async requestStylePresetSwitch(presetId) {
    if (!this.settings.stylePresetDirty) {
      return this.loadStylePreset(presetId, { allowDiscard: true });
    }

    const decision = await new Promise((resolve) => {
      new StyleSwitchConfirmModal(this.app, this, presetId, resolve).open();
    });
    if (!decision || decision.action === "cancel") return false;

    if (decision.action === "save") {
      const activePreset = this.settings.stylePresets?.[this.settings.activeStylePreset];
      const saved = activePreset
        ? await this.overwriteActiveStylePreset()
        : Boolean(await this.saveStylePreset(decision.name));
      if (!saved) return false;
    }

    return this.loadStylePreset(presetId, { allowDiscard: true });
  }


  async overwriteActiveStylePreset() {
    const id = this.settings.activeStylePreset;
    const preset = this.settings.stylePresets?.[id];
    if (!preset) {
      new Notice(this.t("notice.defaultNoOverwrite"));
      return false;
    }
    await this.saveStylePreset(preset.name, id);
    return true;
  }


  async renameStylePreset(presetId, name) {
    const preset = this.settings.stylePresets?.[presetId];
    if (!preset) {
      new Notice(this.t("notice.defaultNoRename"));
      return false;
    }

    const normalizedName = String(name || "").trim().slice(0, 60);
    if (!normalizedName) {
      new Notice(this.t("notice.emptyName"));
      return false;
    }

    const duplicate = Object.entries(this.settings.stylePresets || {})
      .some(([id, item]) => id !== presetId
        && String(item.name || "").trim().toLocaleLowerCase() === normalizedName.toLocaleLowerCase());
    if (duplicate) {
      new Notice(this.t("notice.duplicateName"));
      return false;
    }

    this.settings.stylePresets = {
      ...(this.settings.stylePresets || {}),
      [presetId]: {
        ...preset,
        name: normalizedName,
        updatedAt: new Date().toISOString()
      }
    };
    await this.saveData(this.settings);
    new Notice(this.t("notice.renamed", { name: normalizedName }));
    return true;
  }


  async deleteStylePreset(presetId) {
    const preset = this.settings.stylePresets?.[presetId];
    if (!preset) return false;
    const presets = { ...(this.settings.stylePresets || {}) };
    delete presets[presetId];
    this.settings.stylePresets = presets;
    this.settings.activeStylePreset = "__current__";
    this.settings.stylePresetDirty = true;
    await this.saveData(this.settings);
    new Notice(this.t("notice.deleted", { name: preset.name }));
    return true;
  }


  async loadThemeCatalog() {
    try {
      const text = await this.app.vault.adapter.read(`${this.manifest.dir}/blue-topaz-settings.json`);
      this.themeCatalog = JSON.parse(text);
    } catch (error) {
      console.error("[Bysan Style Controller] Failed to load complete theme settings", error);
      this.themeCatalog = { settings: [] };
      new Notice(this.t("notice.catalogError"));
    }
  }


  async syncBundledBaseTheme() {
    if (!this.baseThemeCssText) {
      const baseThemePath = `${this.manifest.dir}/blue-topaz-base.css`;
      try {
        this.baseThemeCssText = await this.app.vault.adapter.read(baseThemePath);
      } catch (error) {
        console.error("[Bysan Style Controller] Failed to load bundled base theme", error);
        new Notice(this.t("notice.baseError"));
        return;
      }
    }

    if (!this.baseThemeStyleEl?.isConnected) {
      const styleEl = document.createElement("style");
      styleEl.dataset.bysanBaseTheme = "true";
      styleEl.textContent = this.baseThemeCssText;

      const overrideStyleEl = [...document.head.querySelectorAll("style")]
        .find((element) => element.textContent.includes("Bysan Style Controller content styles"));

      document.head.appendChild(styleEl);
      /* Obsidian may register styles.css before or after onload depending on
       * hot/cold loading. Moving the override node last makes the cascade
       * deterministic without duplicating either stylesheet. */
      if (overrideStyleEl) {
        document.head.appendChild(overrideStyleEl);
      }
      this.baseThemeStyleEl = styleEl;
    }
  }


  ensureStyleOrder() {
    if (!this.baseThemeStyleEl?.isConnected) return;
    const overrideStyleEl = [...document.head.querySelectorAll("style")]
      .find((element) => element.textContent.includes("Bysan Style Controller content styles"));
    if (overrideStyleEl) {
      document.head.appendChild(overrideStyleEl);
    }
  }


  applySettings() {
    const body = document.body;
    body.classList.add("bysan-style-controller-active");

    this.applyClassSettings();

    body.style.setProperty(
      "--blur-codebox-frosted-glass",
      String(clamp(this.settings.codeBlur, 0, 12))
    );
    body.style.setProperty(
      "--letter-space-code",
      `${clamp(this.settings.codeLetterSpacing, 0, 2)}px`
    );
    body.style.setProperty(
      "--bysan-table-inline-margin",
      this.settings.tableCentered ? "auto" : "0"
    );
    body.style.setProperty(
      "--bysan-quote-font",
      this.settings.quoteSerif
        ? '"Latin Modern Roman", "Times New Roman", "Noto Serif CJK SC", serif'
        : "var(--font-text)"
    );

    this.lastDarkMode = body.classList.contains("theme-dark");
    this.applyPalette();
    this.themeControls.applyVariables();
    this.scheduleLineRangeRefresh();
  }


  scheduleLineRangeRefresh() {
    if (this.lineRangeFrame) return;
    this.lineRangeFrame = window.requestAnimationFrame(() => {
      this.lineRangeFrame = null;
      this.refreshLineNumberRanges();
    });
  }


  clearLineRangeLabels() {
    for (const element of document.querySelectorAll("[data-bysan-source-line-range]")) {
      delete element.dataset.bysanSourceLineRange;
      element.classList.remove("bysan-source-line-range");
      element.removeAttribute("title");
    }
  }


  refreshLineNumberRanges() {
    if (!this.settings.collapsedLineRanges) {
      this.clearLineRangeLabels();
      return;
    }

    const desiredLabels = new Map();

    for (const gutter of document.querySelectorAll(".markdown-source-view .cm-lineNumbers")) {
      const elements = [...gutter.querySelectorAll(":scope > .cm-gutterElement")]
        .filter((element) => /^\d+$/.test(element.textContent.trim()))
        .filter((element) => getComputedStyle(element).visibility !== "hidden");

      for (let index = 0; index < elements.length - 1; index += 1) {
        const current = Number(elements[index].textContent.trim());
        const next = Number(elements[index + 1].textContent.trim());
        if (next <= current + 1) continue;

        const label = `${current}–${next - 1}`;
        desiredLabels.set(elements[index], label);
      }
    }

    /* CodeMirror virtualises gutter nodes while scrolling. Update only nodes
     * whose range actually changed; clearing and rebuilding every visible
     * gutter on each wheel event caused an avoidable full-pane repaint. */
    for (const element of document.querySelectorAll("[data-bysan-source-line-range]")) {
      if (desiredLabels.has(element)) continue;
      delete element.dataset.bysanSourceLineRange;
      element.classList.remove("bysan-source-line-range");
      element.removeAttribute("title");
    }

    for (const [element, label] of desiredLabels) {
      if (element.dataset.bysanSourceLineRange === label) continue;
      element.dataset.bysanSourceLineRange = label;
      element.classList.add("bysan-source-line-range");
      element.setAttribute("title", `Live Preview 已将源文件第 ${label} 行折叠为一个渲染块`);
    }
  }


  applyClassSettings() {
    const body = document.body;

    this.setExclusiveClass(CODE_THEME_CLASSES, this.settings.codeTheme);
    this.setExclusiveClass(LIGHT_BACKGROUND_CLASSES, this.settings.lightBackground);
    this.setExclusiveClass(DARK_BACKGROUND_CLASSES, this.settings.darkBackground);

    body.classList.toggle("background-settings-workplace-background-image", this.settings.workspaceBackground);
    body.classList.toggle("code-line-number", this.settings.codeLineNumbers);
    body.classList.toggle("whole-code-wrap", this.settings.codeWrapReading);
    body.classList.toggle("nowrap-edit-codebox", this.settings.codeNoWrapLive);
    body.classList.toggle("muted-code-activeline-bg", this.settings.muteCodeActiveLine);
    body.classList.toggle("bysan-table-zebra-disabled", !this.settings.tableZebra);
    body.classList.toggle("bysan-table-left-aligned", !this.settings.tableCentered);
    body.classList.toggle("bysan-quote-system-font", !this.settings.quoteSerif);
    this.themeControls.applyClasses();
  }


  classSettingsAreApplied() {
    const body = document.body;
    const exactlySelected = (classes, selected) => classes.every((className) =>
      body.classList.contains(className) === (className === selected));

    return exactlySelected(CODE_THEME_CLASSES, this.settings.codeTheme)
      && exactlySelected(LIGHT_BACKGROUND_CLASSES, this.settings.lightBackground)
      && exactlySelected(DARK_BACKGROUND_CLASSES, this.settings.darkBackground)
      && body.classList.contains("background-settings-workplace-background-image") === this.settings.workspaceBackground
      && body.classList.contains("code-line-number") === this.settings.codeLineNumbers
      && body.classList.contains("whole-code-wrap") === this.settings.codeWrapReading
      && body.classList.contains("nowrap-edit-codebox") === this.settings.codeNoWrapLive
      && body.classList.contains("muted-code-activeline-bg") === this.settings.muteCodeActiveLine
      && body.classList.contains("bysan-table-zebra-disabled") === !this.settings.tableZebra
      && body.classList.contains("bysan-table-left-aligned") === !this.settings.tableCentered
      && body.classList.contains("bysan-quote-system-font") === !this.settings.quoteSerif
      && this.themeControls.classesAreApplied();
  }


  setExclusiveClass(classNames, selected) {
    for (const className of classNames) {
      document.body.classList.toggle(className, className === selected);
    }
  }


  applyPalette() {
    const dark = document.body.classList.contains("theme-dark");
    const suffix = dark ? "Dark" : "Light";
    const get = (name) => this.settings[`${name}${suffix}`];
    const body = document.body;
    const codeBackground = hexToRgba(get("codeBg"), get("codeBgOpacity"));
    const activeCodeBackground = this.settings.muteCodeActiveLine
      ? codeBackground
      : `color-mix(in srgb, ${codeBackground} 92%, var(--interactive-accent) 8%)`;

    body.style.setProperty("--bysan-code-bg", codeBackground);
    body.style.setProperty("--bysan-code-active-bg", activeCodeBackground);
    body.style.setProperty("--bysan-code-border", hexToRgba(get("codeBorder"), dark ? 0.28 : 0.34));
    body.style.setProperty("--bysan-code-text", get("codeText"));
    body.style.setProperty("--bysan-inline-code-bg", get("inlineBg"));
    body.style.setProperty("--bysan-inline-code-text", get("inlineText"));
    body.style.setProperty("--bysan-inline-code-shadow", get("inlineShadow"));
    body.style.setProperty("--bysan-table-head-bg", get("tableHead"));
    body.style.setProperty(
      "--bysan-table-stripe-bg",
      this.settings.tableZebra ? get("tableStripe") : "transparent"
    );
    body.style.setProperty("--bysan-table-hover-bg", get("tableHover"));
    body.style.setProperty("--bysan-table-border", get("tableBorder"));
    body.style.setProperty("--bysan-quote-bg", hexToRgba(get("quoteBg"), get("quoteBgOpacity")));
    body.style.setProperty("--bysan-quote-border", get("quoteBorder"));
    body.style.setProperty("--bysan-muted-marker", get("marker"));

    /* Keep bundled base-theme code surfaces in sync with Bysan controls. */
    body.style.setProperty("--background-code", codeBackground);
    body.style.setProperty("--background-code-2", get("inlineBg"));
    body.style.setProperty("--code-background", codeBackground);
    body.style.setProperty("--code-normal", get("codeText"));
  }


  async resetSettings() {
    const presets = deepClone(this.settings.stylePresets || {});
    this.settings = Object.assign({}, deepClone(DEFAULT_SETTINGS), {
      stylePresets: presets,
      activeStylePreset: "__default__",
      stylePresetDirty: false
    });
    await this.saveData(this.settings);
    this.applySettings();
    new Notice(this.t("notice.reset"));
  }
};


class StyleSwitchConfirmModal extends Modal {

  constructor(app, plugin, targetPresetId, resolve) {
    super(app);
    this.plugin = plugin;
    this.targetPresetId = targetPresetId;
    this.resolveDecision = resolve;
    this.resolved = false;
    this.saveName = "";
  }


  onOpen() {
    const { contentEl, modalEl } = this;
    modalEl.addClass("bysan-style-switch-modal");
    contentEl.empty();

    const activeId = this.plugin.settings.activeStylePreset || "__current__";
    const activePreset = this.plugin.settings.stylePresets?.[activeId];
    const currentLabel = this.plugin.stylePresetLabel(activeId);
    const targetLabel = this.plugin.stylePresetLabel(this.targetPresetId);

    contentEl.createEl("h2", { text: this.plugin.t("modal.title") });
    contentEl.createEl("p", {
      text: this.plugin.t("modal.body")
    });

    const details = contentEl.createDiv({ cls: "bysan-style-switch-details" });
    details.createEl("div", { text: this.plugin.t("modal.current", { name: currentLabel }) });
    details.createEl("div", { text: this.plugin.t("modal.target", { name: targetLabel }) });

    if (activePreset) {
      contentEl.createEl("p", {
        cls: "bysan-style-switch-save-hint",
        text: this.plugin.t("modal.overwriteHint", { name: activePreset.name })
      });
    } else {
      contentEl.createEl("p", {
        cls: "bysan-style-switch-save-hint",
        text: this.plugin.t("modal.newHint")
      });
      new Setting(contentEl)
        .setName(this.plugin.t("modal.newName"))
        .addText((text) => text
          .setPlaceholder(this.plugin.t("preset.example"))
          .onChange((value) => {
            this.saveName = value;
            this.errorEl?.setText("");
          }));
    }

    this.errorEl = contentEl.createDiv({ cls: "bysan-style-switch-error" });
    const actions = contentEl.createDiv({ cls: "bysan-style-switch-actions" });

    const cancelButton = actions.createEl("button", { text: this.plugin.t("modal.cancel") });
    cancelButton.addEventListener("click", () => this.finish({ action: "cancel" }));

    const discardButton = actions.createEl("button", {
      cls: "mod-warning",
      text: this.plugin.t("modal.discard")
    });
    discardButton.addEventListener("click", () => this.finish({ action: "discard" }));

    const saveButton = actions.createEl("button", {
      cls: "mod-cta",
      text: this.plugin.t("modal.save")
    });
    saveButton.addEventListener("click", () => {
      if (!activePreset && !this.saveName.trim()) {
        this.errorEl.setText(this.plugin.t("modal.nameRequired"));
        return;
      }
      this.finish({ action: "save", name: this.saveName.trim() });
    });
  }


  finish(decision) {
    if (this.resolved) return;
    this.resolved = true;
    this.resolveDecision(decision);
    this.close();
  }


  onClose() {
    this.contentEl.empty();
    if (!this.resolved) {
      this.resolved = true;
      this.resolveDecision({ action: "cancel" });
    }
  }
}


class BysanStyleSettingTab extends PluginSettingTab {

  constructor(app, plugin) {
    super(app, plugin);
    this.plugin = plugin;
  }


  display() {
    const { containerEl } = this;
    containerEl.empty();
    containerEl.addClass("bysan-style-settings");

    new Setting(containerEl)
      .setName("Bysan Style Controller")
      .setDesc(this.plugin.t("app.description"))
      .setHeading();

    this.renderLanguageSetting(containerEl);
    this.renderSectionNavigation(containerEl);
    this.renderStylePresetSettings(containerEl);
    this.renderWorkspaceSettings(containerEl);
    this.renderCodeSettings(containerEl);
    this.renderPaletteSettings(containerEl);
    this.renderComponentSettings(containerEl);
    this.plugin.themeControls.render(containerEl);

    const resetSetting = new Setting(containerEl)
      .setName(this.plugin.t("section.reset"))
      .setDesc(this.plugin.t("reset.desc"))
      .addButton((button) => button
        .setButtonText(this.plugin.t("reset.button"))
        .setWarning()
        .onClick(async () => {
          await this.plugin.requestStylePresetSwitch("__default__");
          this.display();
        }));
    resetSetting.settingEl.id = "bysan-section-reset";
  }


  renderLanguageSetting(containerEl) {
    const setting = new Setting(containerEl)
      .setName(this.plugin.t("language.name"))
      .setDesc(this.plugin.t("language.desc"))
      .addDropdown((dropdown) => dropdown
        .addOption("auto", this.plugin.t("language.auto"))
        .addOption("zh", this.plugin.t("language.zh"))
        .addOption("en", this.plugin.t("language.en"))
        .setValue(this.plugin.settings.uiLanguage || "auto")
        .onChange(async (value) => {
          await this.plugin.setUiLanguage(value);
          this.display();
        }));
    setting.settingEl.addClass("bysan-language-setting");
  }


  renderSectionNavigation(containerEl) {
    const groups = [
      [this.plugin.t("nav.core"), [
        ["preset", this.plugin.t("section.preset")],
        ["workspace", this.plugin.t("section.workspace")],
        ["code", this.plugin.t("section.code")],
        ["palette", this.plugin.t("section.palette")],
        ["components", this.plugin.t("section.components")]
      ]],
      [this.plugin.t("nav.theme"), [
        ["theme", this.plugin.t("section.theme")],
        ["theme-general", this.plugin.t("section.themeGeneral")],
        ["theme-details", this.plugin.t("section.themeDetails")],
        ["theme-plugins", this.plugin.t("section.themePlugins")],
        ["theme-builtins", this.plugin.t("section.themeBuiltins")],
        ["reset", this.plugin.t("section.reset")]
      ]]
    ];
    const navigation = containerEl.createEl("nav", {
      cls: "bysan-settings-nav",
      attr: { "aria-label": this.plugin.t("nav.title") }
    });
    const header = navigation.createDiv({ cls: "bysan-settings-nav-header" });
    header.createDiv({ cls: "bysan-settings-nav-title", text: this.plugin.t("nav.title") });
    const search = header.createEl("input", {
      cls: "bysan-settings-nav-search",
      attr: {
        type: "search",
        placeholder: this.plugin.t("theme.searchPlaceholder"),
        "aria-label": this.plugin.t("theme.search")
      }
    });
    search.addEventListener("input", () => {
      this.plugin.themeControls.filterRows(containerEl, search.value);
    });
    const groupGrid = navigation.createDiv({ cls: "bysan-settings-nav-groups" });

    for (const [groupLabel, sections] of groups) {
      const group = groupGrid.createDiv({ cls: "bysan-settings-nav-group" });
      group.createDiv({ cls: "bysan-settings-nav-group-title", text: groupLabel });
      const links = group.createDiv({ cls: "bysan-settings-nav-links" });
      for (const [id, label] of sections) {
        const button = links.createEl("button", {
          cls: "bysan-settings-nav-link",
          text: label,
          attr: { type: "button", "data-target": id }
        });
        button.addEventListener("click", () => this.jumpToSection(containerEl, `bysan-section-${id}`));
      }
    }

    const detailRow = navigation.createDiv({ cls: "bysan-settings-nav-detail" });
    detailRow.createEl("label", { text: this.plugin.t("nav.detail") });
    const select = detailRow.createEl("select", { cls: "dropdown" });
    select.createEl("option", { text: this.plugin.t("nav.detail.placeholder"), value: "" });
    for (const group of this.plugin.themeControls.navigationGroups()) {
      const optionGroup = select.createEl("optgroup", { attr: { label: group.label } });
      for (const entry of group.entries) {
        optionGroup.createEl("option", { text: entry.label, value: entry.anchor });
      }
    }
    select.addEventListener("change", () => {
      if (select.value) this.jumpToSection(containerEl, select.value);
    });
  }


  jumpToSection(containerEl, targetId) {
    const target = containerEl.querySelector(`#${targetId}`);
    if (!target) return;
    target.scrollIntoView({ behavior: "auto", block: "start" });
  }


  renderStylePresetSettings(containerEl) {
    const heading = new Setting(containerEl)
      .setName(this.plugin.t("section.preset"))
      .setDesc(this.plugin.t("preset.desc"))
      .setHeading();
    heading.settingEl.id = "bysan-section-preset";

    const presets = this.plugin.settings.stylePresets || {};
    const activeId = this.plugin.settings.activeStylePreset || "__current__";
    const activePreset = presets[activeId];
    const activeLabel = activeId === "__default__"
      ? this.plugin.t("preset.default")
      : activePreset?.name || this.plugin.t("preset.currentUnsavedLong");
    const stateLabel = this.plugin.settings.stylePresetDirty
      ? this.plugin.t("preset.modified")
      : this.plugin.t("preset.saved");

    new Setting(containerEl)
      .setName(this.plugin.t("preset.current"))
      .setDesc(this.plugin.t("preset.currentDesc", { name: activeLabel, state: stateLabel }))
      .addDropdown((dropdown) => {
        if (activeId === "__current__") {
          dropdown.addOption("__current__", this.plugin.t("preset.currentUnsaved"));
        }
        dropdown.addOption("__default__", this.plugin.t("preset.default"));
        for (const [id, preset] of Object.entries(presets)) {
          dropdown.addOption(id, preset.name);
        }
        dropdown.setValue(activeId);
        dropdown.onChange(async (value) => {
          if (value === "__current__") return;
          await this.plugin.requestStylePresetSwitch(value);
          this.display();
        });
      });

    new Setting(containerEl)
      .setName(this.plugin.t("preset.saveAs"))
      .setDesc(this.plugin.t("preset.saveAsDesc"))
      .addText((text) => text
        .setPlaceholder(this.plugin.t("preset.example"))
        .setValue(this.pendingPresetName || "")
        .onChange((value) => { this.pendingPresetName = value; }))
      .addButton((button) => button
        .setButtonText(this.plugin.t("preset.save"))
        .setCta()
        .onClick(async () => {
          const id = await this.plugin.saveStylePreset(this.pendingPresetName);
          if (id) {
            this.pendingPresetName = "";
            this.display();
          }
        }));

    if (activePreset) {
      const renameValue = this.pendingRenamePresetId === activeId
        ? this.pendingRenameName
        : activePreset.name;

      new Setting(containerEl)
        .setName(this.plugin.t("preset.rename"))
        .setDesc(this.plugin.t("preset.renameDesc"))
        .addText((text) => text
          .setPlaceholder(this.plugin.t("preset.newName"))
          .setValue(renameValue || "")
          .onChange((value) => {
            this.pendingRenamePresetId = activeId;
            this.pendingRenameName = value;
          }))
        .addButton((button) => button
          .setButtonText(this.plugin.t("preset.renameButton"))
          .onClick(async () => {
            const value = this.pendingRenamePresetId === activeId
              ? this.pendingRenameName
              : activePreset.name;
            if (await this.plugin.renameStylePreset(activeId, value)) {
              this.pendingRenamePresetId = null;
              this.pendingRenameName = "";
              this.display();
            }
          }));

      new Setting(containerEl)
        .setName(this.plugin.t("preset.manage"))
        .setDesc(this.plugin.t("preset.manageDesc"))
        .addButton((button) => button
          .setButtonText(this.plugin.t("preset.overwrite"))
          .onClick(async () => {
            if (await this.plugin.overwriteActiveStylePreset()) this.display();
          }))
        .addButton((button) => button
          .setButtonText(this.plugin.t("preset.delete"))
          .setWarning()
          .onClick(async () => {
            if (await this.plugin.deleteStylePreset(activeId)) this.display();
          }));
    }
  }


  renderWorkspaceSettings(containerEl) {
    const heading = new Setting(containerEl).setName(this.plugin.t("section.workspace")).setHeading();
    heading.settingEl.id = "bysan-section-workspace";

    this.addToggle(containerEl, this.plugin.t("workspace.dynamic"), this.plugin.t("workspace.dynamicDesc"), "workspaceBackground");
    this.addToggle(containerEl, this.plugin.t("workspace.lineRanges"), this.plugin.t("workspace.lineRangesDesc"), "collapsedLineRanges");

    const backgrounds = new Setting(containerEl)
      .setName(this.plugin.t("workspace.backgrounds"));
    this.addModeControl(backgrounds, "light", "select", () => backgrounds.addDropdown((dropdown) => dropdown
        .addOption("background-settings-workplace-theme-light-in-the-note", this.plugin.t("background.note"))
        .addOption("background-settings-workplace-waves-light", this.plugin.t("background.waves"))
        .addOption("background-settings-workplace-waves2-light", this.plugin.t("background.animatedWaves"))
        .addOption("background-settings-workplace-theme-light-blue-mountain", this.plugin.t("background.blueMountain"))
        .addOption("background-settings-workplace-theme-light-custom-option", this.plugin.t("background.customUrl"))
        .setValue(this.plugin.settings.lightBackground)
        .onChange((value) => this.plugin.updateSetting("lightBackground", value))));
    this.addModeControl(backgrounds, "dark", "select", () => backgrounds.addDropdown((dropdown) => dropdown
        .addOption("background-settings-workplace-theme-dark-in-the-sky", this.plugin.t("background.sky"))
        .addOption("background-settings-workplace-theme-dark-night-sky", this.plugin.t("background.nightSky"))
        .addOption("background-settings-workplace-theme-dark-dark-sky", this.plugin.t("background.darkSky"))
        .addOption("background-settings-workplace-waves", this.plugin.t("background.waves"))
        .addOption("background-settings-workplace-waves2", this.plugin.t("background.animatedWaves"))
        .addOption("background-settings-workplace-theme-dark-custom-option", this.plugin.t("background.customUrl"))
        .setValue(this.plugin.settings.darkBackground)
        .onChange((value) => this.plugin.updateSetting("darkBackground", value))));
    backgrounds.settingEl.addClass("bysan-dual-mode-setting");
  }


  renderCodeSettings(containerEl) {
    const heading = new Setting(containerEl).setName(this.plugin.t("section.code")).setHeading();
    heading.settingEl.id = "bysan-section-code";

    new Setting(containerEl)
      .setName(this.plugin.t("code.theme"))
      .addDropdown((dropdown) => dropdown
        .addOption("code-theme-bt-default", "Bysan Default")
        .addOption("code-theme-solarized-light", "Solarized Light")
        .addOption("code-theme-material-palenight", "Material Palenight")
        .addOption("code-theme-dracula", "Dracula")
        .addOption("code-theme-Gruvbox-dark", "Gruvbox Dark")
        .addOption("code-theme-monokai", "Monokai")
        .addOption("code-theme-sublime", "Sublime")
        .setValue(this.plugin.settings.codeTheme)
        .onChange((value) => this.plugin.updateSetting("codeTheme", value)));

    this.addToggle(containerEl, this.plugin.t("code.lineNumbers"), this.plugin.t("code.lineNumbersDesc"), "codeLineNumbers");
    this.addToggle(containerEl, this.plugin.t("code.wrapReading"), this.plugin.t("code.wrapReadingDesc"), "codeWrapReading");
    this.addToggle(containerEl, this.plugin.t("code.noWrapLive"), this.plugin.t("code.noWrapLiveDesc"), "codeNoWrapLive");
    this.addToggle(containerEl, this.plugin.t("code.muteActive"), this.plugin.t("code.muteActiveDesc"), "muteCodeActiveLine");

    this.addSlider(containerEl, this.plugin.t("code.blur"), this.plugin.t("code.blurDesc"), "codeBlur", 0, 8, 1);
    this.addSlider(containerEl, this.plugin.t("code.spacing"), this.plugin.t("code.spacingDesc"), "codeLetterSpacing", 0, 2, 0.1);
  }


  renderPaletteSettings(containerEl) {
    const heading = new Setting(containerEl).setName(this.plugin.t("section.palette")).setHeading();
    heading.settingEl.id = "bysan-section-palette";

    this.addDualColor(containerEl, this.plugin.t("palette.codeBg"), "codeBgLight", "codeBgDark");
    this.addDualSlider(containerEl, this.plugin.t("palette.opacity"), this.plugin.t("palette.opacityDesc"), "codeBgOpacityLight", "codeBgOpacityDark", 0, 1, 0.01);
    this.addDualColor(containerEl, this.plugin.t("palette.codeText"), "codeTextLight", "codeTextDark");
    this.addDualColor(containerEl, this.plugin.t("palette.codeBorder"), "codeBorderLight", "codeBorderDark");
    this.addDualColor(containerEl, this.plugin.t("palette.inlineBg"), "inlineBgLight", "inlineBgDark");
    this.addDualColor(containerEl, this.plugin.t("palette.inlineText"), "inlineTextLight", "inlineTextDark");
    this.addDualColor(containerEl, this.plugin.t("palette.tableHead"), "tableHeadLight", "tableHeadDark");
    this.addDualColor(containerEl, this.plugin.t("palette.tableStripe"), "tableStripeLight", "tableStripeDark");
    this.addDualColor(containerEl, this.plugin.t("palette.tableHover"), "tableHoverLight", "tableHoverDark");
    this.addDualColor(containerEl, this.plugin.t("palette.tableBorder"), "tableBorderLight", "tableBorderDark");
    this.addDualColor(containerEl, this.plugin.t("palette.quoteBg"), "quoteBgLight", "quoteBgDark");
    this.addDualSlider(containerEl, this.plugin.t("palette.quoteOpacity"), this.plugin.t("palette.opacityDesc"), "quoteBgOpacityLight", "quoteBgOpacityDark", 0, 1, 0.01);
    this.addDualColor(containerEl, this.plugin.t("palette.quoteBorder"), "quoteBorderLight", "quoteBorderDark");
    this.addDualColor(containerEl, this.plugin.t("palette.marker"), "markerLight", "markerDark");
  }


  addModeControl(setting, mode, kind, addControl, resetControl = null) {
    const group = setting.controlEl.createDiv({
      cls: `bysan-mode-control bysan-mode-control-${kind}`
    });
    group.createSpan({
      cls: `bysan-mode-label bysan-mode-label-${mode}`,
      text: this.plugin.t(mode === "light" ? "theme.light" : "theme.dark")
    });
    const existing = new Set(setting.controlEl.children);
    addControl();
    for (const child of [...setting.controlEl.children]) {
      if (!existing.has(child)) group.appendChild(child);
    }
    if (resetControl) {
      const label = this.plugin.t(mode === "light" ? "theme.light" : "theme.dark");
      const resetButton = group.createEl("button", {
        cls: "clickable-icon bysan-color-reset",
        text: "↺",
        attr: {
          type: "button",
          title: this.plugin.t("color.reset", { mode: label }),
          "aria-label": this.plugin.t("color.reset", { mode: label })
        }
      });
      resetButton.addEventListener("click", resetControl);
    }
  }


  addDualColor(containerEl, name, lightKey, darkKey) {
    const setting = new Setting(containerEl).setName(name);
    let lightPicker;
    this.addModeControl(setting, "light", "color", () => setting.addColorPicker((picker) => {
      lightPicker = picker;
      picker.setValue(this.plugin.settings[lightKey])
        .onChange((value) => this.plugin.updateSetting(lightKey, value));
    }), async () => {
      if (await this.plugin.resetSetting(lightKey)) lightPicker.setValue(this.plugin.settings[lightKey]);
    });
    let darkPicker;
    this.addModeControl(setting, "dark", "color", () => setting.addColorPicker((picker) => {
      darkPicker = picker;
      picker.setValue(this.plugin.settings[darkKey])
        .onChange((value) => this.plugin.updateSetting(darkKey, value));
    }), async () => {
      if (await this.plugin.resetSetting(darkKey)) darkPicker.setValue(this.plugin.settings[darkKey]);
    });
    setting.settingEl.addClass("bysan-dual-mode-setting");
  }


  addDualSlider(containerEl, name, description, lightKey, darkKey, minimum, maximum, step) {
    const setting = new Setting(containerEl).setName(name).setDesc(description);
    this.addModeControl(setting, "light", "slider", () => setting.addSlider((slider) => slider
      .setLimits(minimum, maximum, step)
      .setDynamicTooltip()
      .setValue(this.plugin.settings[lightKey])
      .onChange((value) => this.plugin.updateSetting(lightKey, value))));
    this.addModeControl(setting, "dark", "slider", () => setting.addSlider((slider) => slider
      .setLimits(minimum, maximum, step)
      .setDynamicTooltip()
      .setValue(this.plugin.settings[darkKey])
      .onChange((value) => this.plugin.updateSetting(darkKey, value))));
    setting.settingEl.addClass("bysan-dual-mode-setting");
  }


  renderComponentSettings(containerEl) {
    const heading = new Setting(containerEl).setName(this.plugin.t("section.components")).setHeading();
    heading.settingEl.id = "bysan-section-components";
    this.addToggle(containerEl, this.plugin.t("components.zebra"), this.plugin.t("components.zebraDesc"), "tableZebra");
    this.addToggle(containerEl, this.plugin.t("components.center"), this.plugin.t("components.centerDesc"), "tableCentered");
    this.addToggle(containerEl, this.plugin.t("components.quoteSerif"), this.plugin.t("components.quoteSerifDesc"), "quoteSerif");
  }


  addToggle(containerEl, name, description, key) {
    new Setting(containerEl)
      .setName(name)
      .setDesc(description)
      .addToggle((toggle) => toggle
        .setValue(Boolean(this.plugin.settings[key]))
        .onChange((value) => this.plugin.updateSetting(key, value)));
  }


  addSlider(containerEl, name, description, key, minimum, maximum, step) {
    new Setting(containerEl)
      .setName(name)
      .setDesc(description)
      .addSlider((slider) => slider
        .setLimits(minimum, maximum, step)
        .setDynamicTooltip()
        .setValue(this.plugin.settings[key])
        .onChange((value) => this.plugin.updateSetting(key, value)));
  }
}
