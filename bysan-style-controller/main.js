/**
 * Bysan Style Controller
 * Version: 0.15.4
 *
 * Owns visual presentation and provides switchable, integrated Bysan modules.
 */

const {
  MarkdownRenderer,
  MarkdownView,
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
globalThis.__bysanPdfApi = { MarkdownRenderer, Modal, Notice };
const { BysanPdfPreviewModal } = require(app.vault.adapter.getFullPath(
  ".obsidian/plugins/bysan-style-controller/pdf-preview.js"
));
delete globalThis.__bysanPdfApi;
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

const INTEGRATED_MODULES = [
  {
    key: "moduleHeadingNumbering",
    id: "academic-heading-numbering",
    nameZh: "学术标题编号",
    nameEn: "Academic heading numbering",
    descriptionZh: "统一处理编辑视图、阅读视图、Outline 与 PDF 标题编号。",
    descriptionEn: "Unified heading numbering for editor, reading view, Outline and PDF."
  },
  {
    key: "moduleMediaResizer",
    id: "mermaid-inline-resizer",
    nameZh: "Mermaid、图片与表格缩放",
    nameEn: "Mermaid, image and table resizing",
    descriptionZh: "提供持久化宽度、全屏 Mermaid 查看和无跳页缩放控件。",
    descriptionEn: "Persistent widths, fullscreen Mermaid viewing and scroll-safe controls."
  },
  {
    key: "moduleReviewToolbar",
    id: "selection-review-toolbar",
    nameZh: "选区审阅工具栏",
    nameEn: "Selection review toolbar",
    descriptionZh: "提供高亮、字体颜色、评论角标及 Markdown/LaTeX 评论窗。",
    descriptionEn: "Highlights, text colours, review badges and Markdown/LaTeX comment windows."
  }
];

const MODULE_SETTING_KEYS = new Set(INTEGRATED_MODULES.map((module) => module.key));

const CONTENT_GEOMETRY_CONTROLS = [
  ["inlineCodeRadius", "--bysan-inline-code-radius", "px", 0, 16, 1, "行内代码圆角", "Inline-code radius"],
  ["inlineCodeFontSize", "--bysan-inline-code-font-size", "em", 0.6, 1.5, 0.05, "行内代码字号", "Inline-code font size"],
  ["inlineCodePaddingY", "--bysan-inline-code-padding-y", "px", 0, 12, 1, "行内代码垂直内边距", "Inline-code vertical padding"],
  ["inlineCodePaddingX", "--bysan-inline-code-padding-x", "px", 0, 20, 1, "行内代码水平内边距", "Inline-code horizontal padding"],
  ["inlineCodeMargin", "--bysan-inline-code-margin", "px", 0, 12, 1, "行内代码水平外边距", "Inline-code horizontal margin"],
  ["inlineCodeShadowSize", "--bysan-inline-code-shadow-size", "px", 0, 8, 1, "行内代码阴影尺寸", "Inline-code shadow size"],
  ["codeBlockRadius", "--bysan-code-radius", "px", 0, 20, 1, "代码块圆角", "Code-block radius"],
  ["codeBlockFontSize", "--bysan-code-font-size", "em", 0.6, 1.5, 0.05, "代码块字号", "Code-block font size"],
  ["codeBlockLineHeight", "--bysan-code-line-height", "", 1, 2.5, 0.05, "代码块行高", "Code-block line height"],
  ["codeBlockPaddingY", "--bysan-code-padding-y", "em", 0, 3, 0.1, "代码块垂直内边距", "Code-block vertical padding"],
  ["codeBlockPaddingX", "--bysan-code-padding-x", "em", 0, 4, 0.1, "代码块水平内边距", "Code-block horizontal padding"],
  ["tableBorderWidth", "--bysan-table-border-width", "pt", 0.5, 5, 0.1, "表格外边框宽度", "Table outer-border width"],
  ["tableCellPaddingY", "--bysan-table-cell-padding-y", "px", 0, 20, 1, "单元格垂直内边距", "Table-cell vertical padding"],
  ["tableCellPaddingX", "--bysan-table-cell-padding-x", "px", 0, 40, 1, "单元格水平内边距", "Table-cell horizontal padding"],
  ["tableHeaderWeight", "--bysan-table-header-weight", "", 100, 900, 50, "表头字重", "Table-header weight"],
  ["tableMarginY", "--bysan-table-margin-y", "em", 0, 4, 0.1, "表格上下外边距", "Table vertical margin"],
  ["quoteBorderWidth", "--bysan-quote-border-width", "px", 0, 16, 1, "引用块边框宽度", "Blockquote border width"],
  ["quoteRadius", "--bysan-quote-radius", "px", 0, 24, 1, "引用块圆角", "Blockquote radius"],
  ["quoteFontSize", "--bysan-quote-font-size", "em", 0.7, 1.6, 0.05, "引用块字号", "Blockquote font size"],
  ["quotePaddingY", "--bysan-quote-padding-y", "em", 0, 3, 0.05, "引用块垂直内边距", "Blockquote vertical padding"],
  ["quotePaddingX", "--bysan-quote-padding-x", "em", 0, 5, 0.1, "引用块水平内边距", "Blockquote horizontal padding"],
  ["listMarkerWeight", "--bysan-list-marker-weight", "", 100, 900, 50, "列表标记字重", "List-marker weight"],
  ["taskCheckboxSize", "--bysan-task-checkbox-size", "em", 0.5, 2, 0.05, "任务框尺寸", "Task-checkbox size"],
  ["taskCheckboxOffset", "--bysan-task-checkbox-offset", "em", 0, 1.5, 0.05, "任务框垂直位置", "Task-checkbox vertical offset"],
  ["hrWidth", "--bysan-hr-width", "px", 0, 8, 1, "分隔线宽度", "Divider width"],
  ["hrMargin", "--bysan-hr-margin", "em", 0, 5, 0.1, "分隔线上下间距", "Divider vertical margin"],
  ["strongWeight", "--bysan-strong-weight", "", 100, 900, 50, "粗体字重", "Strong-text weight"]
];

const CONTENT_GEOMETRY_DEFAULTS = {
  inlineCodeRadius: 2,
  inlineCodeFontSize: 0.9,
  inlineCodePaddingY: 1,
  inlineCodePaddingX: 3,
  inlineCodeMargin: 2,
  inlineCodeShadowSize: 1,
  codeBlockRadius: 3,
  codeBlockFontSize: 0.95,
  codeBlockLineHeight: 1.55,
  codeBlockPaddingY: 0.8,
  codeBlockPaddingX: 1,
  tableBorderWidth: 1.2,
  tableCellPaddingY: 6,
  tableCellPaddingX: 13,
  tableHeaderWeight: 800,
  tableMarginY: 1,
  quoteBorderWidth: 4,
  quoteRadius: 3,
  quoteFontSize: 1.05,
  quotePaddingY: 0.55,
  quotePaddingX: 2,
  listMarkerWeight: 650,
  taskCheckboxSize: 1,
  taskCheckboxOffset: 0.42,
  hrWidth: 1,
  hrMargin: 1.8,
  strongWeight: 800
};

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
  "--letter-space-code",
  "--art-review-badge-size",
  ...CONTENT_GEOMETRY_CONTROLS.map(([, property]) => property)
];

const DEFAULT_SETTINGS = {
  settingsVersion: 8,
  uiLanguage: "auto",
  pdfPaperSize: "A4",
  pdfOrientation: "portrait",
  pdfMarginMode: "normal",
  pdfMarginTop: 18,
  pdfMarginRight: 16,
  pdfMarginBottom: 18,
  pdfMarginLeft: 16,
  pdfPreviewZoom: 75,
  pdfActualScale: 100,
  pdfHeaderText: "",
  pdfFooterText: "",
  pdfShowPageNumbers: true,
  pdfPageRange: "all",
  pdfGrayscale: false,
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
  moduleHeadingNumbering: true,
  moduleMediaResizer: true,
  moduleReviewToolbar: true,
  reviewBadgeSize: 17,
  inlineCodeRadius: 2,
  inlineCodeFontSize: 0.9,
  inlineCodePaddingY: 1,
  inlineCodePaddingX: 3,
  inlineCodeMargin: 2,
  inlineCodeShadowSize: 1,
  codeBlockRadius: 3,
  codeBlockFontSize: 0.95,
  codeBlockLineHeight: 1.55,
  codeBlockPaddingY: 0.8,
  codeBlockPaddingX: 1,
  tableBorderWidth: 1.2,
  tableCellPaddingY: 6,
  tableCellPaddingX: 13,
  tableHeaderWeight: 800,
  tableMarginY: 1,
  quoteBorderWidth: 4,
  quoteRadius: 3,
  quoteFontSize: 1.05,
  quotePaddingY: 0.55,
  quotePaddingX: 2,
  listMarkerWeight: 650,
  taskCheckboxSize: 1,
  taskCheckboxOffset: 0.42,
  hrWidth: 1,
  hrMargin: 1.8,
  strongWeight: 800,

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
  "uiLanguage",
  "pdfPaperSize",
  "pdfOrientation",
  "pdfMarginMode",
  "pdfMarginTop",
  "pdfMarginRight",
  "pdfMarginBottom",
  "pdfMarginLeft",
  "pdfPreviewZoom",
  "pdfActualScale",
  "pdfHeaderText",
  "pdfFooterText",
  "pdfShowPageNumbers",
  "pdfPageRange",
  "pdfGrayscale",
  ...MODULE_SETTING_KEYS
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


function hexWithAlpha(hex, opacity) {
  const normalized = String(hex || "").trim().toUpperCase();
  if (!/^#[0-9A-F]{6}$/.test(normalized)) return normalized;
  const alpha = Math.round(clamp(opacity, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0")
    .toUpperCase();
  return `${normalized}${alpha}`;
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

    if ((savedSettings.settingsVersion || 0) < 7) {
      for (const module of INTEGRATED_MODULES) {
        if (typeof savedSettings[module.key] !== "boolean") this.settings[module.key] = true;
      }
      this.settings.settingsVersion = 7;
      await this.saveData(this.settings);
    }

    this.integratedModules = new Map();
    this.integratedModuleStyles = new Map();

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
    this.addCommand({
      id: "preview-and-export-pdf",
      name: this.t("pdf.command"),
      checkCallback: (checking) => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (!view?.editor) return false;
        if (!checking) this.openPdfPreview(view);
        return true;
      }
    });
    this.addRibbonIcon("file-down", this.t("pdf.command"), () => this.openPdfPreview());
    this.applySettings();
    await this.syncIntegratedModules();

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

    console.log(`[Bysan Style Controller] v0.15.3 loaded with ${this.themeControls.count} regional theme controls`);
  }


  openPdfPreview(view = this.app.workspace.getActiveViewOfType(MarkdownView)) {
    if (!view?.editor) {
      new Notice(this.t("pdf.openNote"));
      return;
    }
    window.setTimeout(() => new BysanPdfPreviewModal(this.app, this, view).open(), 80);
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


  async onunload() {
    this.themeObserver?.disconnect();
    this.lineRangeObserver?.disconnect();
    this.themeControls?.destroy();
    if (this.lineRangeFrame) window.cancelAnimationFrame(this.lineRangeFrame);
    this.clearLineRangeLabels();
    this.baseThemeStyleEl?.remove();
    for (const module of INTEGRATED_MODULES) await this.stopIntegratedModule(module.id);

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


  integratedModuleDirectory(module) {
    return `.obsidian/plugins/bysan-style-controller/modules/${module.id}`;
  }


  async migrateIntegratedModuleData(module) {
    const adapter = this.app.vault.adapter;
    const target = `${this.integratedModuleDirectory(module)}/data.json`;
    const legacy = `.obsidian/plugins/${module.id}/data.json`;
    if (await adapter.exists(target) || !(await adapter.exists(legacy))) return;
    await adapter.write(target, await adapter.read(legacy));
  }


  async startIntegratedModule(module) {
    if (this.integratedModules.has(module.id)) return;
    if (this.app.plugins.enabledPlugins?.has(module.id)) {
      if (typeof this.app.plugins.disablePluginAndSave === "function") {
        await this.app.plugins.disablePluginAndSave(module.id);
      } else {
        await this.app.plugins.disablePlugin(module.id);
      }
    }
    await this.migrateIntegratedModuleData(module);
    const directory = this.integratedModuleDirectory(module);
    const source = await this.app.vault.adapter.read(`${directory}/main.js`);
    const moduleScope = { exports: {} };
    const evaluateModule = new Function(
      "require",
      "module",
      "exports",
      `${source}\n//# sourceURL=plugin:bysan-style-controller/modules/${module.id}/main.js`
    );
    evaluateModule(require, moduleScope, moduleScope.exports);
    const ModuleClass = moduleScope.exports;
    const manifest = {
      ...JSON.parse(await this.app.vault.adapter.read(`${directory}/manifest.json`)),
      dir: directory
    };
    const instance = new ModuleClass(this.app, manifest);
    await instance.load();

    const style = document.createElement("style");
    style.dataset.bysanIntegratedModule = module.id;
    style.textContent = await this.app.vault.adapter.read(`${directory}/styles.css`);
    document.head.appendChild(style);
    this.integratedModules.set(module.id, instance);
    this.integratedModuleStyles.set(module.id, style);
  }


  async stopIntegratedModule(id) {
    const instance = this.integratedModules?.get(id);
    if (instance) {
      await instance.unload();
      this.integratedModules.delete(id);
    }
    this.integratedModuleStyles?.get(id)?.remove();
    this.integratedModuleStyles?.delete(id);
  }


  async syncIntegratedModules() {
    for (const module of INTEGRATED_MODULES) {
      if (this.settings[module.key]) await this.startIntegratedModule(module);
      else await this.stopIntegratedModule(module.id);
    }
  }


  async updateIntegratedModuleSetting(key, value) {
    this.settings[key] = Boolean(value);
    await this.saveData(this.settings);
    await this.syncIntegratedModules();
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
      "--art-review-badge-size",
      `${clamp(this.settings.reviewBadgeSize, 12, 24)}px`
    );
    body.style.setProperty(
      "--bysan-quote-font",
      this.settings.quoteSerif
        ? '"Latin Modern Roman", "Times New Roman", "Noto Serif CJK SC", serif'
        : "var(--font-text)"
    );
    for (const [key, property, unit] of CONTENT_GEOMETRY_CONTROLS) {
      const fallback = CONTENT_GEOMETRY_DEFAULTS[key];
      const value = Number.isFinite(Number(this.settings[key]))
        ? Number(this.settings[key])
        : fallback;
      body.style.setProperty(property, `${value}${unit}`);
    }

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
    const areas = containerEl.createDiv({ cls: "bysan-major-areas" });

    const workflow = this.createMajorArea(
      areas,
      "workflow",
      this.plugin.language === "zh" ? "功能与风格" : "Features and styles",
      this.plugin.language === "zh"
        ? "管理内置功能模块、完整风格预设和全局恢复。"
        : "Manage built-in modules, complete style presets and global restore."
    );
    this.createSubarea(workflow, "modules", this.plugin.language === "zh" ? "功能模块" : "Feature modules", (body) => {
      this.renderIntegratedModuleSettings(body);
    }, true);
    this.createSubarea(workflow, "preset", this.plugin.t("section.preset"), (body) => {
      this.renderStylePresetSettings(body);
    }, true);
    this.createSubarea(workflow, "reset", this.plugin.t("section.reset"), (body) => {
      const resetSetting = new Setting(body)
        .setName(this.plugin.t("section.reset"))
        .setDesc(this.plugin.t("reset.desc"))
        .addButton((button) => button
          .setButtonText(this.plugin.t("reset.button"))
          .setWarning()
          .onClick(async () => {
            await this.plugin.requestStylePresetSwitch("__default__");
            this.display();
          }));
      // Keep the action row addressable without duplicating the enclosing
      // subarea anchor (`bysan-section-reset`). Duplicate ids made search and
      // keyboard focus resolution browser-dependent.
      resetSetting.settingEl.id = "bysan-reset-action";
    });

    const regionStats = this.plugin.themeControls.beginRegionRender();
    const workspaceUi = this.createMajorArea(
      areas,
      "interface",
      this.plugin.language === "zh" ? "工作区与界面" : "Workspace and interface",
      this.plugin.language === "zh"
        ? "按整体工作区、顶部区、左侧区、右侧区和设置系统界面组织。"
        : "Organised by whole workspace, top, left, right and system/settings surfaces."
    );
    this.createSubarea(workspaceUi, "workspace", this.plugin.language === "zh" ? "整体工作区" : "Whole workspace", (body) => {
      this.renderWorkspaceSettings(body);
      this.plugin.themeControls.renderRegion(body, "workspace");
    }, true);
    this.createSubarea(workspaceUi, "top-area", this.plugin.language === "zh" ? "顶部区" : "Top area", (body) => {
      this.plugin.themeControls.renderRegion(body, "top");
    });
    this.createSubarea(workspaceUi, "left-area", this.plugin.language === "zh" ? "左侧区" : "Left area", (body) => {
      this.plugin.themeControls.renderRegion(body, "left");
    });
    this.createSubarea(workspaceUi, "right-area", this.plugin.language === "zh" ? "右侧区" : "Right area", (body) => {
      this.plugin.themeControls.renderRegion(body, "right");
    });
    this.createSubarea(workspaceUi, "system-area", this.plugin.language === "zh" ? "设置、菜单与系统界面" : "Settings, menus and system UI", (body) => {
      this.plugin.themeControls.renderRegion(body, "system");
    });

    const content = this.createMajorArea(
      areas,
      "content",
      this.plugin.language === "zh" ? "内容与阅读" : "Content and reading",
      this.plugin.language === "zh"
        ? "按工作区、代码块、行内代码、表格、引用和正文对象集中管理全部相关设置。"
        : "All related settings grouped by workspace, code blocks, inline code, tables, quotes and text objects."
    );
    this.createSubarea(content, "editor", this.plugin.language === "zh" ? "主编辑区" : "Main editor area", (body) => {
      this.renderEditorRegionSettings(body);
    }, true);
    this.createSubarea(content, "media-area", this.plugin.language === "zh" ? "Canvas、图谱与 PDF" : "Canvas, graph and PDF", (body) => {
      this.plugin.themeControls.renderRegion(body, "media");
    });

    const extensions = this.createMajorArea(
      areas,
      "extensions",
      this.plugin.language === "zh" ? "插件与文档样式" : "Plugins and document styles",
      this.plugin.language === "zh"
        ? `第三方插件适配与按 cssclasses 启用的文档样式；共 ${regionStats.plugins + regionStats.documents} 项。`
        : `Third-party integrations and cssclasses-based document styles; ${regionStats.plugins + regionStats.documents} controls.`
    );
    this.createSubarea(extensions, "plugin-adapters", this.plugin.language === "zh" ? "第三方插件适配" : "Third-party plugin integrations", (body) => {
      this.plugin.themeControls.renderRegion(body, "plugins");
    }, true);
    this.createSubarea(extensions, "document-styles", this.plugin.language === "zh" ? "文档样式类" : "Document style classes", (body) => {
      this.plugin.themeControls.renderRegion(body, "documents");
    });

    this.setActiveMajorArea(containerEl, this.activeMajorArea || "content", false);
  }


  createMajorArea(containerEl, id, title, description) {
    const area = containerEl.createEl("section", {
      cls: "bysan-major-area",
      attr: { "data-bysan-major-area": id, "aria-label": title }
    });
    const header = area.createDiv({ cls: "bysan-major-area-header" });
    header.createEl("h2", { text: title });
    header.createEl("p", { text: description });
    return area;
  }


  createSubarea(containerEl, id, title, render, open = false) {
    const details = containerEl.createEl("details", {
      cls: "bysan-subarea",
      attr: { "data-bysan-subarea": id }
    });
    details.open = open;
    const summary = details.createEl("summary", { cls: "bysan-subarea-summary" });
    summary.createSpan({ cls: "bysan-subarea-chevron", text: "›" });
    summary.createSpan({ cls: "bysan-subarea-title", text: title });
    const body = details.createDiv({ cls: "bysan-subarea-body" });
    render(body);
    const internalHeading = body.querySelector(":scope > .setting-item-heading:first-child");
    if (internalHeading) {
      details.id = internalHeading.id || `bysan-section-${id}`;
      internalHeading.removeAttribute("id");
      internalHeading.addClass("bysan-subarea-internal-heading");
    } else {
      details.id = `bysan-section-${id}`;
    }
    return details;
  }


  setActiveMajorArea(containerEl, id, scroll = true) {
    const available = [...containerEl.querySelectorAll("[data-bysan-major-area]")];
    const selected = available.some((area) => area.dataset.bysanMajorArea === id)
      ? id
      : "content";
    this.activeMajorArea = selected;
    for (const area of available) {
      const active = area.dataset.bysanMajorArea === selected;
      area.classList.toggle("is-active", active);
      area.hidden = !active;
    }
    for (const button of containerEl.querySelectorAll(".bysan-major-tab")) {
      const active = button.dataset.area === selected;
      button.classList.toggle("is-active", active);
      button.setAttribute("aria-selected", String(active));
    }
    if (scroll) {
      containerEl.querySelector(".bysan-major-areas")?.scrollIntoView({ behavior: "auto", block: "start" });
    }
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
    const areas = [
      ["workflow", this.plugin.language === "zh" ? "功能与风格" : "Features and styles"],
      ["interface", this.plugin.language === "zh" ? "工作区与界面" : "Workspace and interface"],
      ["content", this.plugin.language === "zh" ? "内容与阅读" : "Content and reading"],
      ["extensions", this.plugin.language === "zh" ? "插件与文档样式" : "Plugins and document styles"]
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
    const searchResults = navigation.createDiv({
      cls: "bysan-settings-search-results is-hidden"
    });
    let currentMatches = [];
    const clearSearch = () => {
      search.value = "";
      currentMatches = this.plugin.themeControls.filterRows(containerEl, "");
      searchResults.empty();
      searchResults.addClass("is-hidden");
    };
    const jumpToResult = (row) => {
      if (!row?.isConnected) return;
      clearSearch();
      const area = row.closest("[data-bysan-major-area]");
      if (area) this.setActiveMajorArea(containerEl, area.dataset.bysanMajorArea, false);
      for (const details of row.closest("details")
        ? [row.closest("details"), ...row.closest("details").querySelectorAll(":scope details")]
        : []) {
        if (details.contains(row)) details.open = true;
      }
      let parent = row.parentElement;
      while (parent) {
        if (parent.matches?.("details")) parent.open = true;
        parent = parent.parentElement;
      }
      window.requestAnimationFrame(() => {
        row.scrollIntoView({ behavior: "auto", block: "center" });
        row.classList.add("bysan-search-target");
        window.setTimeout(() => row.classList.remove("bysan-search-target"), 1400);
      });
    };
    const renderSearchResults = () => {
      currentMatches = this.plugin.themeControls.filterRows(containerEl, search.value);
      searchResults.empty();
      const query = search.value.trim();
      if (!query) {
        searchResults.addClass("is-hidden");
        return;
      }

      searchResults.removeClass("is-hidden");
      const chinese = this.plugin.language === "zh";
      searchResults.createDiv({
        cls: "bysan-settings-search-summary",
        text: currentMatches.length
          ? (chinese ? `找到 ${currentMatches.length} 项` : `${currentMatches.length} results`)
          : (chinese ? "没有匹配的设置" : "No matching settings")
      });
      const list = searchResults.createDiv({ cls: "bysan-settings-search-list" });
      currentMatches.slice(0, 16).forEach((row) => {
        const name = row.querySelector(".setting-item-name")?.textContent?.trim()
          || row.textContent?.trim()
          || (chinese ? "未命名设置" : "Unnamed setting");
        const description = row.querySelector(".setting-item-description")
          ?.textContent?.trim();
        const button = list.createEl("button", {
          cls: "bysan-settings-search-result",
          attr: { type: "button" }
        });
        button.createSpan({ cls: "bysan-settings-search-result-name", text: name });
        if (description) {
          button.createSpan({
            cls: "bysan-settings-search-result-desc",
            text: description
          });
        }
        button.addEventListener("click", () => jumpToResult(row));
      });
      if (currentMatches.length > 16) {
        searchResults.createDiv({
          cls: "bysan-settings-search-more",
          text: chinese
            ? `另有 ${currentMatches.length - 16} 项，请继续输入以缩小范围`
            : `${currentMatches.length - 16} more; keep typing to narrow the results`
        });
      }
    };
    search.addEventListener("input", () => {
      renderSearchResults();
    });
    search.addEventListener("keydown", (event) => {
      if (event.key === "Enter" && currentMatches.length) {
        event.preventDefault();
        jumpToResult(currentMatches[0]);
      }
    });
    const tabs = navigation.createDiv({ cls: "bysan-major-tabs", attr: { role: "tablist" } });
    for (const [id, label] of areas) {
      const button = tabs.createEl("button", {
        cls: "bysan-major-tab",
        text: label,
        attr: { type: "button", role: "tab", "data-area": id }
      });
      button.addEventListener("click", () => this.setActiveMajorArea(containerEl, id));
    }
  }


  renderIntegratedModuleSettings(containerEl) {
    const heading = new Setting(containerEl)
      .setName(this.plugin.language === "zh" ? "功能模块" : "Feature modules")
      .setDesc(this.plugin.language === "zh"
        ? "原独立 Bysan 插件已内置为可开关模块；启用内置模块时会自动停用对应旧插件，原数据会迁移后继续使用。"
        : "Former standalone Bysan plugins are built-in modules. Enabling a module disables its legacy plugin and migrates its data.")
      .setHeading();
    heading.settingEl.id = "bysan-section-modules";

    for (const module of INTEGRATED_MODULES) {
      const setting = new Setting(containerEl)
        .setName(this.plugin.language === "zh" ? module.nameZh : module.nameEn)
        .setDesc(this.plugin.language === "zh" ? module.descriptionZh : module.descriptionEn)
        .addToggle((toggle) => toggle
          .setValue(Boolean(this.plugin.settings[module.key]))
          .onChange(async (value) => {
            toggle.setDisabled(true);
            try {
              await this.plugin.updateIntegratedModuleSetting(module.key, value);
            } finally {
              toggle.setDisabled(false);
            }
      }));
      setting.settingEl.addClass("bysan-unified-control-setting", "bysan-control-type-toggle");
      if (module.key === "moduleReviewToolbar") {
        this.addResettableSlider(
          containerEl,
          this.plugin.t("review.badgeSize"),
          this.plugin.t("review.badgeSizeDesc"),
          "reviewBadgeSize",
          12,
          24,
          1,
          "px"
        );
      }
    }
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
    backgrounds.settingEl.dataset.bysanSettingKeys = "lightBackground darkBackground";
  }


  renderCodeSettings(containerEl) {
    const heading = new Setting(containerEl)
      .setName(this.plugin.language === "zh" ? "代码块" : "Code blocks")
      .setHeading();
    heading.settingEl.id = "bysan-section-code";

    this.createFeatureGroup(
      containerEl,
      this.plugin.language === "zh" ? "功能与渲染" : "Behaviour and rendering",
      this.plugin.language === "zh" ? "代码主题、行号、换行和活动行显示。" : "Theme, line numbers, wrapping and active-line display.",
      (body) => {
        const themeSetting = new Setting(body)
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
        themeSetting.settingEl.addClass("bysan-unified-control-setting", "bysan-control-type-select");
        themeSetting.settingEl.dataset.bysanSettingKeys = "codeTheme";
        this.addToggle(body, this.plugin.t("code.lineNumbers"), this.plugin.t("code.lineNumbersDesc"), "codeLineNumbers");
        this.addToggle(body, this.plugin.t("code.wrapReading"), this.plugin.t("code.wrapReadingDesc"), "codeWrapReading");
        this.addToggle(body, this.plugin.t("code.noWrapLive"), this.plugin.t("code.noWrapLiveDesc"), "codeNoWrapLive");
        this.addToggle(body, this.plugin.t("code.muteActive"), this.plugin.t("code.muteActiveDesc"), "muteCodeActiveLine");
      }
    );
    this.createFeatureGroup(
      containerEl,
      this.plugin.language === "zh" ? "明暗外观" : "Light and dark appearance",
      this.plugin.language === "zh" ? "背景、透明度、文字和边框集中设置。" : "Background, opacity, text and border in one place.",
      (body) => {
        this.addDualColor(body, this.plugin.t("palette.codeBg"), "codeBgLight", "codeBgDark", "codeBgOpacityLight", "codeBgOpacityDark");
        this.addDualColor(body, this.plugin.t("palette.codeText"), "codeTextLight", "codeTextDark");
        this.addDualColor(body, this.plugin.t("palette.codeBorder"), "codeBorderLight", "codeBorderDark");
      }
    );
    this.createFeatureGroup(
      containerEl,
      this.plugin.language === "zh" ? "文字、尺寸与间距" : "Typography, size and spacing",
      this.plugin.language === "zh" ? "字号、行高、字距、圆角和内边距。" : "Font size, line height, letter spacing, radius and padding.",
      (body) => {
        this.addSlider(body, this.plugin.t("code.spacing"), this.plugin.t("code.spacingDesc"), "codeLetterSpacing", 0, 2, 0.1);
        this.addSlider(body, this.plugin.t("code.blur"), this.plugin.t("code.blurDesc"), "codeBlur", 0, 8, 1);
        this.renderGeometryControls(body, "codeBlock");
      }
    );
  }


  renderEditorRegionSettings(containerEl) {
    const heading = new Setting(containerEl)
      .setName(this.plugin.language === "zh" ? "主编辑区" : "Main editor area")
      .setHeading();
    heading.settingEl.id = "bysan-section-editor";
    const description = containerEl.createEl("p", {
      cls: "bysan-region-description",
      text: this.plugin.language === "zh"
        ? "这些对象都显示在笔记的编辑或阅读正文中；每个对象内部再集中设置功能、明暗外观和尺寸。"
        : "These objects live in the note editor or reading content. Behaviour, light/dark appearance and size stay together for each object."
    });
    description.dataset.bysanSearch = description.textContent.toLowerCase();
    this.createEditorObject(containerEl, "code", this.plugin.language === "zh" ? "代码块" : "Code blocks", (body) => {
      this.renderCodeSettings(body);
    }, true);
    this.createEditorObject(containerEl, "inline-code", this.plugin.language === "zh" ? "行内代码" : "Inline code", (body) => {
      this.renderInlineCodeSettings(body);
    });
    this.createEditorObject(containerEl, "tables", this.plugin.language === "zh" ? "表格" : "Tables", (body) => {
      this.renderTableSettings(body);
    });
    this.createEditorObject(containerEl, "quotes", this.plugin.language === "zh" ? "引用块" : "Blockquotes", (body) => {
      this.renderQuoteSettings(body);
    });
    this.createEditorObject(containerEl, "text-details", this.plugin.language === "zh" ? "文字、列表与分隔线" : "Text, lists and dividers", (body) => {
      this.renderTextDetailSettings(body);
    });
    this.createEditorObject(
      containerEl,
      "advanced-editor",
      this.plugin.language === "zh" ? "标题、正文与其他编辑元素" : "Headings, body text and other editor elements",
      (body) => this.plugin.themeControls.renderRegion(body, "editor")
    );
  }


  createEditorObject(containerEl, id, title, render, open = false) {
    const details = containerEl.createEl("details", {
      cls: "bysan-editor-object",
      attr: { "data-bysan-editor-object": id }
    });
    details.open = open;
    const summary = details.createEl("summary", { cls: "bysan-editor-object-summary" });
    summary.createSpan({ cls: "bysan-subarea-chevron", text: "›" });
    summary.createSpan({ cls: "bysan-editor-object-title", text: title });
    const body = details.createDiv({ cls: "bysan-editor-object-body" });
    render(body);
    const internalHeading = body.querySelector(":scope > .setting-item-heading:first-child");
    if (internalHeading) {
      details.id = internalHeading.id || `bysan-section-${id}`;
      internalHeading.removeAttribute("id");
      internalHeading.addClass("bysan-subarea-internal-heading");
    }
    return details;
  }


  createFeatureGroup(containerEl, title, description, render) {
    const group = containerEl.createEl("section", { cls: "bysan-feature-group" });
    const header = group.createDiv({ cls: "bysan-feature-group-header" });
    header.createEl("h4", { text: title });
    if (description) header.createEl("p", { text: description });
    group.dataset.bysanSearch = `${title} ${description || ""}`.toLowerCase();
    const body = group.createDiv({ cls: "bysan-feature-group-body" });
    render(body);
    return group;
  }


  renderInlineCodeSettings(containerEl) {
    const heading = new Setting(containerEl)
      .setName(this.plugin.language === "zh" ? "行内代码" : "Inline code")
      .setHeading();
    heading.settingEl.id = "bysan-section-inline-code";
    this.createFeatureGroup(
      containerEl,
      this.plugin.language === "zh" ? "明暗外观" : "Light and dark appearance",
      this.plugin.language === "zh" ? "正文内短代码的背景、文字和阴影。" : "Background, text and shadow for short code inside text.",
      (body) => {
        this.addDualColor(body, this.plugin.t("palette.inlineBg"), "inlineBgLight", "inlineBgDark");
        this.addDualColor(body, this.plugin.t("palette.inlineText"), "inlineTextLight", "inlineTextDark");
        this.addDualColor(body, this.plugin.language === "zh" ? "行内代码阴影" : "Inline-code shadow", "inlineShadowLight", "inlineShadowDark");
      }
    );
    this.createFeatureGroup(
      containerEl,
      this.plugin.language === "zh" ? "文字、尺寸与间距" : "Typography, size and spacing",
      this.plugin.language === "zh" ? "字号、圆角、内外边距和阴影尺寸。" : "Font size, radius, padding, margin and shadow size.",
      (body) => this.renderGeometryControls(body, "inlineCode")
    );
  }


  renderTableSettings(containerEl) {
    const heading = new Setting(containerEl)
      .setName(this.plugin.language === "zh" ? "表格" : "Tables")
      .setHeading();
    heading.settingEl.id = "bysan-section-tables";
    this.createFeatureGroup(
      containerEl,
      this.plugin.language === "zh" ? "功能" : "Behaviour",
      this.plugin.language === "zh" ? "表格居中与斑马纹显示。" : "Table centring and zebra stripes.",
      (body) => {
        this.addToggle(
          body,
          this.plugin.language === "zh" ? "启用表格斑马纹" : "Enable table zebra stripes",
          this.plugin.t("components.zebraDesc"),
          "tableZebra"
        );
        this.addToggle(body, this.plugin.t("components.center"), this.plugin.t("components.centerDesc"), "tableCentered");
      }
    );
    this.createFeatureGroup(
      containerEl,
      this.plugin.language === "zh" ? "明暗外观" : "Light and dark appearance",
      this.plugin.language === "zh" ? "表头、斑马纹、悬停和边框颜色。" : "Header, stripe, hover and border colours.",
      (body) => {
        this.addDualColor(body, this.plugin.t("palette.tableHead"), "tableHeadLight", "tableHeadDark");
        this.addDualColor(body, this.plugin.t("palette.tableStripe"), "tableStripeLight", "tableStripeDark");
        this.addDualColor(body, this.plugin.t("palette.tableHover"), "tableHoverLight", "tableHoverDark");
        this.addDualColor(body, this.plugin.t("palette.tableBorder"), "tableBorderLight", "tableBorderDark");
      }
    );
    this.createFeatureGroup(
      containerEl,
      this.plugin.language === "zh" ? "文字、尺寸与间距" : "Typography, size and spacing",
      this.plugin.language === "zh" ? "表头字重、单元格内边距、边框和外边距。" : "Header weight, cell padding, border and margin.",
      (body) => this.renderGeometryControls(body, "table")
    );
  }


  renderQuoteSettings(containerEl) {
    const heading = new Setting(containerEl)
      .setName(this.plugin.language === "zh" ? "引用块" : "Blockquotes")
      .setHeading();
    heading.settingEl.id = "bysan-section-quotes";
    this.createFeatureGroup(
      containerEl,
      this.plugin.language === "zh" ? "文字功能" : "Text behaviour",
      this.plugin.language === "zh" ? "控制引用块是否使用衬线字体。" : "Control whether blockquotes use a serif font.",
      (body) => this.addToggle(body, this.plugin.t("components.quoteSerif"), this.plugin.t("components.quoteSerifDesc"), "quoteSerif")
    );
    this.createFeatureGroup(
      containerEl,
      this.plugin.language === "zh" ? "明暗外观" : "Light and dark appearance",
      this.plugin.language === "zh" ? "背景与透明度、强调边框颜色。" : "Background and opacity plus accent border colour.",
      (body) => {
        this.addDualColor(body, this.plugin.t("palette.quoteBg"), "quoteBgLight", "quoteBgDark", "quoteBgOpacityLight", "quoteBgOpacityDark");
        this.addDualColor(body, this.plugin.t("palette.quoteBorder"), "quoteBorderLight", "quoteBorderDark");
      }
    );
    this.createFeatureGroup(
      containerEl,
      this.plugin.language === "zh" ? "文字、尺寸与间距" : "Typography, size and spacing",
      this.plugin.language === "zh" ? "字号、边框宽度、圆角和内边距。" : "Font size, border width, radius and padding.",
      (body) => this.renderGeometryControls(body, "quote")
    );
  }


  renderTextDetailSettings(containerEl) {
    const heading = new Setting(containerEl)
      .setName(this.plugin.language === "zh" ? "文字、列表与分隔线" : "Text, lists and dividers")
      .setHeading();
    heading.settingEl.id = "bysan-section-text-details";
    this.createFeatureGroup(
      containerEl,
      this.plugin.language === "zh" ? "列表外观" : "List appearance",
      this.plugin.language === "zh" ? "浅色与深色模式的列表标记颜色。" : "List-marker colours in light and dark mode.",
      (body) => this.addDualColor(body, this.plugin.t("palette.marker"), "markerLight", "markerDark")
    );
    this.createFeatureGroup(
      containerEl,
      this.plugin.language === "zh" ? "文字与结构尺寸" : "Text and structure size",
      this.plugin.language === "zh" ? "列表标记、任务框、分隔线和粗体字重。" : "List markers, task boxes, dividers and strong-text weight.",
      (body) => this.renderGeometryControls(body, "other")
    );
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
    return group;
  }


  addDualColor(containerEl, name, lightKey, darkKey, lightOpacityKey = null, darkOpacityKey = null) {
    const setting = new Setting(containerEl).setName(name);
    const addMode = (mode, colorKey, opacityKey) => {
      let pickerComponent;
      let colorValue;
      let opacitySlider;
      const displayColor = () => opacityKey
        ? hexWithAlpha(this.plugin.settings[colorKey], this.plugin.settings[opacityKey])
        : String(this.plugin.settings[colorKey]).toUpperCase();
      const group = this.addModeControl(setting, mode, "color", () => {
        setting.addColorPicker((picker) => {
          pickerComponent = picker;
          picker.setValue(this.plugin.settings[colorKey])
            .onChange((value) => {
              this.plugin.settings[colorKey] = value;
              colorValue?.setText(displayColor());
              this.plugin.updateSetting(colorKey, value);
            });
        });
        colorValue = setting.controlEl.createSpan({
          cls: "bysan-theme-color-value",
          text: displayColor()
        });
        if (opacityKey) {
          setting.addSlider((slider) => {
            opacitySlider = slider;
            slider.setLimits(0, 1, 0.01)
              .setValue(this.plugin.settings[opacityKey])
              .onChange((value) => {
                this.plugin.settings[opacityKey] = value;
                colorValue?.setText(displayColor());
                this.plugin.updateSetting(opacityKey, value);
              });
          });
        }
      }, async () => {
        await this.plugin.resetSetting(colorKey);
        if (opacityKey) await this.plugin.resetSetting(opacityKey);
        pickerComponent.setValue(this.plugin.settings[colorKey]);
        opacitySlider?.setValue(this.plugin.settings[opacityKey]);
        colorValue?.setText(displayColor());
      });
      if (opacityKey) group.addClass("bysan-mode-control-has-opacity");
    };
    addMode("light", lightKey, lightOpacityKey);
    addMode("dark", darkKey, darkOpacityKey);
    setting.settingEl.addClass("bysan-dual-mode-setting");
    setting.settingEl.dataset.bysanSettingKeys = [lightKey, darkKey, lightOpacityKey, darkOpacityKey]
      .filter(Boolean)
      .join(" ");
    if (lightOpacityKey || darkOpacityKey) {
      setting.settingEl.addClass("bysan-combined-color-opacity-setting");
    }
  }


  addDualSlider(containerEl, name, description, lightKey, darkKey, minimum, maximum, step) {
    const setting = new Setting(containerEl).setName(name).setDesc(description);
    let lightSlider;
    this.addModeControl(setting, "light", "slider", () => setting.addSlider((slider) => {
      lightSlider = slider;
      slider.setLimits(minimum, maximum, step)
        .setDynamicTooltip()
        .setValue(this.plugin.settings[lightKey])
        .onChange((value) => this.plugin.updateSetting(lightKey, value));
    }), async () => {
      if (await this.plugin.resetSetting(lightKey)) lightSlider.setValue(this.plugin.settings[lightKey]);
    });
    let darkSlider;
    this.addModeControl(setting, "dark", "slider", () => setting.addSlider((slider) => {
      darkSlider = slider;
      slider.setLimits(minimum, maximum, step)
        .setDynamicTooltip()
        .setValue(this.plugin.settings[darkKey])
        .onChange((value) => this.plugin.updateSetting(darkKey, value));
    }), async () => {
      if (await this.plugin.resetSetting(darkKey)) darkSlider.setValue(this.plugin.settings[darkKey]);
    });
    setting.settingEl.addClass("bysan-dual-mode-setting");
  }


  renderGeometryControls(containerEl, groupId) {
    const entries = CONTENT_GEOMETRY_CONTROLS.filter(([key]) => {
      if (groupId === "other") return !/^(inlineCode|codeBlock|table|quote)/.test(key);
      return key.startsWith(groupId);
    });
    for (const [key, property, unit, minimum, maximum, step, controlZh, controlEn] of entries) {
      this.addResettableSlider(
        containerEl,
        this.plugin.language === "zh" ? controlZh : controlEn,
        `${property} · ${minimum}–${maximum}${unit}`,
        key,
        minimum,
        maximum,
        step,
        unit
      );
    }
  }


  addToggle(containerEl, name, description, key) {
    const setting = new Setting(containerEl)
      .setName(name)
      .setDesc(description)
      .addToggle((toggle) => toggle
        .setValue(Boolean(this.plugin.settings[key]))
        .onChange((value) => this.plugin.updateSetting(key, value)));
    setting.settingEl.addClass("bysan-unified-control-setting", "bysan-control-type-toggle");
    setting.settingEl.dataset.bysanSettingKeys = key;
  }


  addSlider(containerEl, name, description, key, minimum, maximum, step) {
    const setting = new Setting(containerEl)
      .setName(name)
      .setDesc(description)
      .addSlider((slider) => slider
        .setLimits(minimum, maximum, step)
        .setDynamicTooltip()
        .setValue(this.plugin.settings[key])
        .onChange((value) => this.plugin.updateSetting(key, value)));
    setting.settingEl.addClass("bysan-unified-control-setting", "bysan-control-type-slider");
    setting.settingEl.dataset.bysanSettingKeys = key;
  }


  addResettableSlider(containerEl, name, description, key, minimum, maximum, step, unit = "") {
    let sliderComponent;
    let valueEl;
    const formatValue = (value) => `${Number(value).toFixed(step < 0.1 ? 2 : step < 1 ? 1 : 0)}${unit}`;
    const setting = new Setting(containerEl)
      .setName(name)
      .setDesc(description)
      .addSlider((slider) => {
        sliderComponent = slider;
        slider.setLimits(minimum, maximum, step)
          .setValue(this.plugin.settings[key])
          .onChange((value) => {
            valueEl?.setText(formatValue(value));
            this.plugin.updateSetting(key, value);
          });
      });
    valueEl = setting.controlEl.querySelector(".slider-value");
    valueEl?.addClass("bysan-slider-value");
    valueEl?.setText(formatValue(this.plugin.settings[key]));
    const resetButton = setting.controlEl.createEl("button", {
      cls: "clickable-icon bysan-color-reset",
      text: "↺",
      attr: {
        type: "button",
        title: this.plugin.language === "zh" ? "恢复初始默认值" : "Restore initial default",
        "aria-label": this.plugin.language === "zh" ? "恢复初始默认值" : "Restore initial default"
      }
    });
    resetButton.addEventListener("click", async () => {
      if (!await this.plugin.resetSetting(key)) return;
      sliderComponent.setValue(this.plugin.settings[key]);
      valueEl.setText(formatValue(this.plugin.settings[key]));
    });
    setting.settingEl.addClass(
      "bysan-unified-control-setting",
      "bysan-control-type-slider",
      "bysan-resettable-slider"
    );
    setting.settingEl.dataset.bysanSettingKeys = key;
  }
}
