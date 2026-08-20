/**
 * Bysan Style Controller
 * Version: 0.4.2
 *
 * Owns visual presentation only. Heading/equation numbering and media sizing
 * remain exclusively owned by their dedicated plugins.
 */

const {
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
  "background-settings-workplace-waves2-light"
];

const DARK_BACKGROUND_CLASSES = [
  "background-settings-workplace-theme-dark-night-sky",
  "background-settings-workplace-theme-dark-dark-sky",
  "background-settings-workplace-theme-dark-in-the-sky",
  "background-settings-workplace-waves",
  "background-settings-workplace-waves2"
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
  settingsVersion: 5,
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
  "stylePresetDirty"
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

    console.log(`[Bysan Style Controller] v0.4.2 loaded with ${this.themeControls.count} theme controls`);
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
    this.applySettings();
  }


  async updateThemeSetting(id, value) {
    this.settings.themeSettings = {
      ...(this.settings.themeSettings || {}),
      [id]: value
    };
    this.settings.stylePresetDirty = true;
    await this.saveData(this.settings);
    this.applySettings();
  }


  captureStyleSettings(source = this.settings) {
    return Object.fromEntries(Object.entries(source)
      .filter(([key]) => !PRESET_META_KEYS.has(key))
      .map(([key, value]) => [key, deepClone(value)]));
  }


  async saveStylePreset(name, presetId = null) {
    const normalizedName = String(name || "").trim().slice(0, 60);
    if (!normalizedName) {
      new Notice("请先输入风格名称");
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
    new Notice(existing ? `已覆盖风格：${normalizedName}` : `已保存风格：${normalizedName}`);
    return id;
  }


  async loadStylePreset(presetId, options = {}) {
    if (this.settings.stylePresetDirty && !options.allowDiscard) {
      new Notice("当前风格有未保存修改，请先另存为新风格或覆盖当前风格");
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
        new Notice("未找到该风格预设");
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
    new Notice(`已载入风格：${label}`);
    return true;
  }


  async overwriteActiveStylePreset() {
    const id = this.settings.activeStylePreset;
    const preset = this.settings.stylePresets?.[id];
    if (!preset) {
      new Notice("内置默认风格不可覆盖，请另存为新风格");
      return false;
    }
    await this.saveStylePreset(preset.name, id);
    return true;
  }


  async renameStylePreset(presetId, name) {
    const preset = this.settings.stylePresets?.[presetId];
    if (!preset) {
      new Notice("内置默认风格不可重命名");
      return false;
    }

    const normalizedName = String(name || "").trim().slice(0, 60);
    if (!normalizedName) {
      new Notice("风格名称不能为空");
      return false;
    }

    const duplicate = Object.entries(this.settings.stylePresets || {})
      .some(([id, item]) => id !== presetId
        && String(item.name || "").trim().toLocaleLowerCase() === normalizedName.toLocaleLowerCase());
    if (duplicate) {
      new Notice("已有同名风格，请使用其他名称");
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
    new Notice(`风格已重命名为：${normalizedName}`);
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
    new Notice(`已删除风格：${preset.name}；当前画面设置仍保留`);
    return true;
  }


  async loadThemeCatalog() {
    try {
      const text = await this.app.vault.adapter.read(`${this.manifest.dir}/blue-topaz-settings.json`);
      this.themeCatalog = JSON.parse(text);
    } catch (error) {
      console.error("[Bysan Style Controller] Failed to load complete theme settings", error);
      this.themeCatalog = { settings: [] };
      new Notice("Bysan 完整主题设置加载失败，请检查插件文件");
    }
  }


  async syncBundledBaseTheme() {
    if (!this.baseThemeCssText) {
      const baseThemePath = `${this.manifest.dir}/blue-topaz-base.css`;
      try {
        this.baseThemeCssText = await this.app.vault.adapter.read(baseThemePath);
      } catch (error) {
        console.error("[Bysan Style Controller] Failed to load bundled base theme", error);
        new Notice("Bysan 内置基础主题加载失败，请检查插件文件");
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
    this.clearLineRangeLabels();
    if (!this.settings.collapsedLineRanges) return;

    for (const gutter of document.querySelectorAll(".markdown-source-view .cm-lineNumbers")) {
      const elements = [...gutter.querySelectorAll(":scope > .cm-gutterElement")]
        .filter((element) => /^\d+$/.test(element.textContent.trim()))
        .filter((element) => getComputedStyle(element).visibility !== "hidden");

      for (let index = 0; index < elements.length - 1; index += 1) {
        const current = Number(elements[index].textContent.trim());
        const next = Number(elements[index + 1].textContent.trim());
        if (next <= current + 1) continue;

        const label = `${current}–${next - 1}`;
        elements[index].dataset.bysanSourceLineRange = label;
        elements[index].classList.add("bysan-source-line-range");
        elements[index].setAttribute("title", `Live Preview 已将源文件第 ${label} 行折叠为一个渲染块`);
      }
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
    new Notice("Bysan 样式已恢复默认值");
  }
};


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
      .setDesc("独立提供 Bysan 内容样式与完整主题控件；不依赖外部主题，也不接管标题、公式或媒体缩放。")
      .setHeading();

    this.renderStylePresetSettings(containerEl);
    this.renderWorkspaceSettings(containerEl);
    this.renderCodeSettings(containerEl);
    this.renderPaletteSettings(containerEl, "Light", "浅色模式");
    this.renderPaletteSettings(containerEl, "Dark", "深色模式");
    this.renderComponentSettings(containerEl);
    this.plugin.themeControls.render(containerEl);

    new Setting(containerEl)
      .setName("恢复默认样式")
      .setDesc("恢复 Bysan 内置基础主题与内容样式默认值。")
      .addButton((button) => button
        .setButtonText("Reset")
        .setWarning()
        .onClick(async () => {
          await this.plugin.resetSettings();
          this.display();
        }));
  }


  renderStylePresetSettings(containerEl) {
    new Setting(containerEl)
      .setName("风格预设")
      .setDesc("一个预设同时保存浅色、深色及全部完整主题设置。")
      .setHeading();

    const presets = this.plugin.settings.stylePresets || {};
    const activeId = this.plugin.settings.activeStylePreset || "__current__";
    const activePreset = presets[activeId];
    const activeLabel = activeId === "__default__"
      ? "Bysan 默认（浅色/深色自适应）"
      : activePreset?.name || "当前设置（尚未保存为风格）";
    const stateLabel = this.plugin.settings.stylePresetDirty ? "已修改" : "已保存";

    new Setting(containerEl)
      .setName("当前风格")
      .setDesc(`${activeLabel} · ${stateLabel}；切换明暗模式会自动使用同一风格中的对应配色。`)
      .addDropdown((dropdown) => {
        if (activeId === "__current__") {
          dropdown.addOption("__current__", "当前设置（尚未保存）");
        }
        dropdown.addOption("__default__", "Bysan 默认（浅色/深色自适应）");
        for (const [id, preset] of Object.entries(presets)) {
          dropdown.addOption(id, preset.name);
        }
        dropdown.setValue(activeId);
        dropdown.onChange(async (value) => {
          if (value === "__current__") return;
          await this.plugin.loadStylePreset(value);
          this.display();
        });
      });

    new Setting(containerEl)
      .setName("另存为新风格")
      .setDesc("输入名称后保存当前全部设置，原有风格不会被覆盖。")
      .addText((text) => text
        .setPlaceholder("例如：论文浅绿 / 夜间阅读")
        .setValue(this.pendingPresetName || "")
        .onChange((value) => { this.pendingPresetName = value; }))
      .addButton((button) => button
        .setButtonText("保存")
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
        .setName("重命名当前风格")
        .setDesc("只修改显示名称，不改变风格内容、预设 ID 或浅色/深色配置。")
        .addText((text) => text
          .setPlaceholder("新风格名称")
          .setValue(renameValue || "")
          .onChange((value) => {
            this.pendingRenamePresetId = activeId;
            this.pendingRenameName = value;
          }))
        .addButton((button) => button
          .setButtonText("重命名")
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
        .setName("管理当前自定义风格")
        .setDesc("覆盖会用当前全部设置更新该风格；删除不会改变当前画面。")
        .addButton((button) => button
          .setButtonText("覆盖保存")
          .onClick(async () => {
            if (await this.plugin.overwriteActiveStylePreset()) this.display();
          }))
        .addButton((button) => button
          .setButtonText("删除")
          .setWarning()
          .onClick(async () => {
            if (await this.plugin.deleteStylePreset(activeId)) this.display();
          }));
    }
  }


  renderWorkspaceSettings(containerEl) {
    new Setting(containerEl).setName("工作区").setHeading();

    this.addToggle(containerEl, "动态工作区背景", "控制插件内置的工作区背景。", "workspaceBackground");
    this.addToggle(containerEl, "折叠块显示源行范围", "Live Preview 中 Mermaid、公式等多行源码渲染为一个块时显示 6–51，而不是看起来从 6 跳到 52。", "collapsedLineRanges");

    new Setting(containerEl)
      .setName("浅色背景")
      .addDropdown((dropdown) => dropdown
        .addOption("background-settings-workplace-theme-light-in-the-note", "Note")
        .addOption("background-settings-workplace-waves-light", "Waves")
        .addOption("background-settings-workplace-waves2-light", "Animating waves")
        .addOption("background-settings-workplace-theme-light-blue-mountain", "Blue Mountain")
        .addOption("background-settings-workplace-theme-light-custom-option", "Custom URL")
        .setValue(this.plugin.settings.lightBackground)
        .onChange((value) => this.plugin.updateSetting("lightBackground", value)));

    new Setting(containerEl)
      .setName("深色背景")
      .addDropdown((dropdown) => dropdown
        .addOption("background-settings-workplace-theme-dark-in-the-sky", "In the sky")
        .addOption("background-settings-workplace-theme-dark-night-sky", "Night sky")
        .addOption("background-settings-workplace-theme-dark-dark-sky", "Dark sky")
        .addOption("background-settings-workplace-waves", "Waves")
        .addOption("background-settings-workplace-waves2", "Animating waves")
        .addOption("background-settings-workplace-theme-dark-custom-option", "Custom URL")
        .setValue(this.plugin.settings.darkBackground)
        .onChange((value) => this.plugin.updateSetting("darkBackground", value)));
  }


  renderCodeSettings(containerEl) {
    new Setting(containerEl).setName("代码块").setHeading();

    new Setting(containerEl)
      .setName("Bysan 代码高亮主题")
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

    this.addToggle(containerEl, "编辑视图代码行号", "由插件内置样式显示代码行号。", "codeLineNumbers");
    this.addToggle(containerEl, "阅读视图自动换行", "长代码在阅读视图中换行。", "codeWrapReading");
    this.addToggle(containerEl, "Live Preview 禁止换行", "需要横向滚动查看长代码。", "codeNoWrapLive");
    this.addToggle(containerEl, "关闭当前行高亮", "不显示代码块当前行背景。", "muteCodeActiveLine");

    this.addSlider(containerEl, "代码框模糊半径", "仅在毛玻璃代码框样式下生效。", "codeBlur", 0, 8, 1);
    this.addSlider(containerEl, "代码字间距", "单位 px。", "codeLetterSpacing", 0, 2, 0.1);
  }


  renderPaletteSettings(containerEl, suffix, title) {
    new Setting(containerEl).setName(title).setHeading();

    this.addColor(containerEl, "代码块背景", `codeBg${suffix}`);
    this.addSlider(containerEl, "代码块背景透明度", "0 为完全透明，1 为完全不透明。", `codeBgOpacity${suffix}`, 0, 1, 0.01);
    this.addColor(containerEl, "代码块文字", `codeText${suffix}`);
    this.addColor(containerEl, "代码块边框", `codeBorder${suffix}`);
    this.addColor(containerEl, "行内代码背景", `inlineBg${suffix}`);
    this.addColor(containerEl, "行内代码文字", `inlineText${suffix}`);
    this.addColor(containerEl, "表头背景", `tableHead${suffix}`);
    this.addColor(containerEl, "表格斑马纹", `tableStripe${suffix}`);
    this.addColor(containerEl, "表格悬停背景", `tableHover${suffix}`);
    this.addColor(containerEl, "表格边框", `tableBorder${suffix}`);
    this.addColor(containerEl, "引用块背景", `quoteBg${suffix}`);
    this.addSlider(containerEl, "引用块背景透明度", "0 为完全透明，1 为完全不透明。", `quoteBgOpacity${suffix}`, 0, 1, 0.01);
    this.addColor(containerEl, "引用块边框", `quoteBorder${suffix}`);
    this.addColor(containerEl, "列表标记", `marker${suffix}`);
  }


  renderComponentSettings(containerEl) {
    new Setting(containerEl).setName("表格与引用").setHeading();
    this.addToggle(containerEl, "表格斑马纹", "交替显示数据行背景。", "tableZebra");
    this.addToggle(containerEl, "表格居中", "保持 Live Preview 与阅读视图表格居中。", "tableCentered");
    this.addToggle(containerEl, "引用块使用衬线字体", "关闭后跟随正文界面字体。", "quoteSerif");
  }


  addToggle(containerEl, name, description, key) {
    new Setting(containerEl)
      .setName(name)
      .setDesc(description)
      .addToggle((toggle) => toggle
        .setValue(Boolean(this.plugin.settings[key]))
        .onChange((value) => this.plugin.updateSetting(key, value)));
  }


  addColor(containerEl, name, key) {
    new Setting(containerEl)
      .setName(name)
      .addColorPicker((picker) => picker
        .setValue(this.plugin.settings[key])
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
