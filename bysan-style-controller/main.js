/**
 * Bysan Style Controller
 * Version: 0.1.2
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
  settingsVersion: 2,
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
    this.originalClassState = new Map();
    this.originalPropertyState = new Map();
    this.lastDarkMode = document.body.classList.contains("theme-dark");

    for (const className of CONTROLLED_CLASSES) {
      this.originalClassState.set(className, document.body.classList.contains(className));
    }

    for (const property of CONTROLLED_PROPERTIES) {
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
      }

      /* Style Settings also writes body classes. Keep only the migrated
       * subset authoritative here, without touching any unrelated classes. */
      if (!this.classSettingsAreApplied()) {
        this.applyClassSettings();
      }
    });
    this.themeObserver.observe(document.body, {
      attributes: true,
      attributeFilter: ["class"]
    });

    console.log("[Bysan Style Controller] v0.1.2 loaded");
  }


  onunload() {
    this.themeObserver?.disconnect();

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
    await this.saveData(this.settings);
    this.applySettings();
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
  }


  applyClassSettings() {
    const body = document.body;

    this.setExclusiveClass(CODE_THEME_CLASSES, this.settings.codeTheme);
    this.setExclusiveClass(LIGHT_BACKGROUND_CLASSES, this.settings.lightBackground);
    this.setExclusiveClass(DARK_BACKGROUND_CLASSES, this.settings.darkBackground);

    body.classList.toggle("background-image-settings-switch", this.settings.workspaceBackground);
    body.classList.toggle("code-line-number", this.settings.codeLineNumbers);
    body.classList.toggle("whole-code-wrap", this.settings.codeWrapReading);
    body.classList.toggle("nowrap-edit-codebox", this.settings.codeNoWrapLive);
    body.classList.toggle("muted-code-activeline-bg", this.settings.muteCodeActiveLine);
    body.classList.toggle("bysan-table-zebra-disabled", !this.settings.tableZebra);
    body.classList.toggle("bysan-table-left-aligned", !this.settings.tableCentered);
    body.classList.toggle("bysan-quote-system-font", !this.settings.quoteSerif);
  }


  classSettingsAreApplied() {
    const body = document.body;
    const exactlySelected = (classes, selected) => classes.every((className) =>
      body.classList.contains(className) === (className === selected));

    return exactlySelected(CODE_THEME_CLASSES, this.settings.codeTheme)
      && exactlySelected(LIGHT_BACKGROUND_CLASSES, this.settings.lightBackground)
      && exactlySelected(DARK_BACKGROUND_CLASSES, this.settings.darkBackground)
      && body.classList.contains("background-image-settings-switch") === this.settings.workspaceBackground
      && body.classList.contains("code-line-number") === this.settings.codeLineNumbers
      && body.classList.contains("whole-code-wrap") === this.settings.codeWrapReading
      && body.classList.contains("nowrap-edit-codebox") === this.settings.codeNoWrapLive
      && body.classList.contains("muted-code-activeline-bg") === this.settings.muteCodeActiveLine
      && body.classList.contains("bysan-table-zebra-disabled") === !this.settings.tableZebra
      && body.classList.contains("bysan-table-left-aligned") === !this.settings.tableCentered
      && body.classList.contains("bysan-quote-system-font") === !this.settings.quoteSerif;
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

    /* Keep the currently used Blue Topaz code surfaces in sync. */
    body.style.setProperty("--background-code", codeBackground);
    body.style.setProperty("--background-code-2", get("inlineBg"));
    body.style.setProperty("--code-background", codeBackground);
    body.style.setProperty("--code-normal", get("codeText"));
  }


  async resetSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS);
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

    new Setting(containerEl)
      .setName("Bysan Style Controller")
      .setDesc("统一控制 Bysan 内容样式与当前使用的 Blue Topaz 外观选项；不接管标题、公式或媒体缩放。")
      .setHeading();

    this.renderWorkspaceSettings(containerEl);
    this.renderCodeSettings(containerEl);
    this.renderPaletteSettings(containerEl, "Light", "浅色模式");
    this.renderPaletteSettings(containerEl, "Dark", "深色模式");
    this.renderComponentSettings(containerEl);

    new Setting(containerEl)
      .setName("恢复默认样式")
      .setDesc("恢复为迁移前的 Bysan CSS 与当前 Blue Topaz 选项。")
      .addButton((button) => button
        .setButtonText("Reset")
        .setWarning()
        .onClick(async () => {
          await this.plugin.resetSettings();
          this.display();
        }));
  }


  renderWorkspaceSettings(containerEl) {
    new Setting(containerEl).setName("工作区").setHeading();

    this.addToggle(containerEl, "动态工作区背景", "沿用当前 Blue Topaz 工作区背景开关。", "workspaceBackground");

    new Setting(containerEl)
      .setName("浅色背景")
      .addDropdown((dropdown) => dropdown
        .addOption("background-settings-workplace-theme-light-in-the-note", "Note")
        .addOption("background-settings-workplace-waves-light", "Waves")
        .addOption("background-settings-workplace-waves2-light", "Animating waves")
        .addOption("background-settings-workplace-theme-light-blue-mountain", "Blue Mountain")
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
        .setValue(this.plugin.settings.darkBackground)
        .onChange((value) => this.plugin.updateSetting("darkBackground", value)));
  }


  renderCodeSettings(containerEl) {
    new Setting(containerEl).setName("代码块").setHeading();

    new Setting(containerEl)
      .setName("Blue Topaz 高亮主题")
      .addDropdown((dropdown) => dropdown
        .addOption("code-theme-bt-default", "BT Default")
        .addOption("code-theme-solarized-light", "Solarized Light")
        .addOption("code-theme-material-palenight", "Material Palenight")
        .addOption("code-theme-dracula", "Dracula")
        .addOption("code-theme-Gruvbox-dark", "Gruvbox Dark")
        .addOption("code-theme-monokai", "Monokai")
        .addOption("code-theme-sublime", "Sublime")
        .setValue(this.plugin.settings.codeTheme)
        .onChange((value) => this.plugin.updateSetting("codeTheme", value)));

    this.addToggle(containerEl, "编辑视图代码行号", "控制 Blue Topaz 的 code-line-number class。", "codeLineNumbers");
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
