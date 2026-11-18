/**
 * Bysan Style Controller
 * Version: 0.17.2
 *
 * Owns visual presentation and provides switchable, integrated Bysan modules.
 */

const {
  MarkdownRenderer,
  finishRenderMath,
  loadMathJax,
  renderMath,
  MarkdownView,
  Component,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting
} = require("obsidian");
/* Obsidian evaluates main.js without a plugin-local CommonJS base path. Resolve
 * the helper through the active vault so the plugin remains portable. */
globalThis.__bysanObsidianSetting = Setting;
const { ThemeControls, addValueStepper } = require(app.vault.adapter.getFullPath(
  ".obsidian/plugins/bysan-style-controller/theme-controls.js"
));
const { resolveLanguage, translate } = require(app.vault.adapter.getFullPath(
  ".obsidian/plugins/bysan-style-controller/i18n.js"
));
globalThis.__bysanPdfApi = { MarkdownRenderer, Modal, Notice, Component };
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

const NOTE_BODY_CONTROLS = [
  ["text-normal", "正文文字颜色", "Body text colour"],
  ["font-text-theme", "正文字体", "Body font"],
  ["line-height-main", "正文行高", "Body line height"]
];
const NOTE_HEADING_CONTROLS = Array.from({ length: 6 }, (_, index) => {
  const level = index + 1;
  return [
    [`print-h${level}-color`, `H${level} 文字颜色`, `H${level} text colour`],
    [`h${level}-size`, `H${level} 字号`, `H${level} font size`]
  ];
});
const NOTE_APPEARANCE_IDS = new Set(
  [...NOTE_BODY_CONTROLS, ...NOTE_HEADING_CONTROLS.flat(), ["font-size-latex"]].map(([id]) => id)
);

/*
 * ChatGPT-style pasted Markdown commonly has one or more visual blank lines
 * outside standalone blocks. Paragraph merging is intentional. Keep a separator
 * before potential Setext underlines so ordinary text cannot become a heading.
 */
const BLANK_LINE_OPTIONS = [
  ['paragraph', '普通段落', 'Paragraphs', false],
  ['heading', '标题', 'Headings', false],
  ['list', '列表与任务列表', 'Lists and tasks', false],
  ['quote', '引用与 Callout', 'Quotes and callouts', false],
  ['code', '代码块', 'Code blocks', true],
  ['image', '图片与嵌入', 'Images and embeds', true],
  ['table', '表格', 'Tables', true],
  ['math', '公式块', 'Math blocks', true],
  ['divider', '分隔线', 'Dividers', true],
  ['html', 'HTML 块', 'HTML blocks', true]
];

function buildParagraphBlankLineChanges(markdown, options = {}) {
  const lines = String(markdown || "").split("\n");

  const protectedLines = new Set();
  const types = new Map();
  let inFrontmatter = lines[0]?.trim() === "---";
  let fence = null;
  let math = null;
  let html = null;
  for (let index = 0; index < lines.length; index += 1) {
    const trimmed = lines[index].trim();
    if (inFrontmatter) {
      protectedLines.add(index);
      if (index > 0 && /^(---|\.\.\.)\s*$/.test(trimmed)) inFrontmatter = false;
      continue;
    }
    const fenceMatch = trimmed.match(/^(`{3,}|~{3,})(.*)$/);
    if (fence) {
      types.set(index, 'code');
      protectedLines.add(index);
      if (fenceMatch && fenceMatch[1][0] === fence[0] &&
          fenceMatch[1].length >= fence.length && !fenceMatch[2].trim()) fence = null;
      continue;
    }
    if (math) {
      types.set(index, 'math');
      protectedLines.add(index);
      if (trimmed.includes(math)) math = null;
      continue;
    }
    if (html) {
      types.set(index, 'html');
      protectedLines.add(index);
      if (trimmed.toLowerCase().includes(html)) html = null;
      continue;
    }
    if (fenceMatch) {
      types.set(index, 'code');
      protectedLines.add(index);
      fence = fenceMatch[1];
      continue;
    }
    const mathOpen = trimmed.startsWith('$$') ? '$$' : trimmed.startsWith('\\[') ? '\\]' : null;
    if (mathOpen) {
      types.set(index, 'math');
      protectedLines.add(index);
      if (!trimmed.slice(2).includes(mathOpen)) math = mathOpen;
      continue;
    }
    const htmlOpen = trimmed.match(/^<(pre|script|style|table|div|details)\b/i);
    const htmlEnd = htmlOpen ? `</${htmlOpen[1].toLowerCase()}>` : trimmed.startsWith('<!--') ? '-->' : null;
    if (htmlEnd) {
      types.set(index, 'html');
      protectedLines.add(index);
      if (!trimmed.toLowerCase().includes(htmlEnd)) html = htmlEnd;
    }
  }

  // Identify table rows from their delimiter, including tables without outer pipes.
  for (let i = 1; i < lines.length; i += 1) {
    if (protectedLines.has(i)) continue;
    const cells = lines[i].trim().replace(/^\|/, '').replace(/\|$/, '').split('|');
    if (!lines[i].includes('|') || !cells.every(cell => /^\s*:?-{3,}:?\s*$/.test(cell))) continue;
    types.set(i - 1, 'table');
    types.set(i, 'table');
    for (let j = i + 1; j < lines.length && lines[j].trim() && lines[j].includes('|') && !protectedLines.has(j); j++) types.set(j, 'table');
  }
  const classify = (index) => {
    if (index < 0 || index >= lines.length) return null;
    if (types.has(index)) return types.get(index);
    const line = lines[index];
    if (/^\s*(?:!\[|<img\b)/i.test(line)) return 'image';
    if (/^ {0,3}#{1,6}(?:\s|$)/.test(line) || /^ {0,3}(?:=+|-+)[ \t]*$/.test(lines[index + 1] || '')) return 'heading';
    if (/^\s*>/.test(line)) return 'quote';
    if (/^\s*(?:[-+*]|\d+[.)])\s+/.test(line)) return 'list';
    if (/^ {0,3}(?:(?:\*\s*){3,}|(?:-\s*){3,}|(?:_\s*){3,})$/.test(line)) return 'divider';
    if (/^(?: {4}|\t)\S/.test(line)) return 'code';
    return 'paragraph';
  };
  const preserve = (type) => type && (options[type] ?? BLANK_LINE_OPTIONS.find(item => item[0] === type)?.[3]);
  const changes = [];
  for (let start = 0; start < lines.length;) {
    if (lines[start].trim() !== "" || protectedLines.has(start)) {
      start += 1;
      continue;
    }
    let end = start;
    while (end < lines.length && lines[end].trim() === "" && !protectedLines.has(end)) end += 1;
    const before = start - 1;
    const after = end;
    // A blank within indented code is content, as is an internal table gap.
    const indented = (line) => /^(?: {4}|\t)\s*\S/.test(line || '');
    const inIndentedBlock = indented(lines[before]) && indented(lines[after]);
    const inTable = /^\s*\|/.test(lines[before] || '') && /^\s*\|/.test(lines[after] || '');
    const setextRisk = before >= 0 && after < lines.length &&
      /^ {0,3}(?:-+|=+)[ \t]*$/.test(lines[after]);
    if (!inIndentedBlock && !inTable) {
      /* Remove only blank-line records; retain one normal line break. */
      const keep = setextRisk || preserve(classify(before)) || preserve(classify(after));
      const text = keep && before >= 0 && after < lines.length ? '\n' : '';
      const to = after < lines.length ? { line: after, ch: 0 } :
        { line: lines.length - 1, ch: lines[lines.length - 1].length };
      if (to.line === start && to.ch === 0 && !text) { start = end; continue; }
      if (text && end - start === 1) { start = end; continue; }
      changes.push({
        from: { line: start, ch: 0 },
        to,
        text
      });
    }
    start = end;
  }
  return changes;
}

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
  "bysan-quote-system-font",
  "bysan-note-font-size-set",
  "bysan-table-font-size-set"
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
  "--bysan-note-font-size",
  "--bysan-table-font-size",
  ...CONTENT_GEOMETRY_CONTROLS.map(([, property]) => property)
];

const DEFAULT_SETTINGS = {
  settingsVersion: 8,
  noteFontSize: null,
  tableFontSize: null,
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
  "blankLinePreservation",
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
    this.addCommand({
      id: "remove-paragraph-blank-lines",
      name: this.t("paragraphCleanup.command"),
      editorCallback: (editor, view) => this.removeParagraphBlankLines(editor, view)
    });
    this.addRibbonIcon("list-collapse", this.t("paragraphCleanup.command"), () => {
      const view = this.app.workspace.getActiveViewOfType(MarkdownView);
      if (!view?.editor) {
        new Notice(this.t("paragraphCleanup.openNote"));
        return;
      }
      this.removeParagraphBlankLines(view.editor, view);
    });
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

    console.log(`[Bysan Style Controller] v${this.manifest.version} loaded with ${this.themeControls.count} regional theme controls`);
  }


  openPdfPreview(view = this.app.workspace.getActiveViewOfType(MarkdownView)) {
    if (!view?.editor) {
      new Notice(this.t("pdf.openNote"));
      return;
    }
    const noteDocument = view.containerEl.ownerDocument;
    window.setTimeout(() => {
      const noteWindow = noteDocument.defaultView;
      if (!noteWindow || noteWindow.closed || !view.containerEl.isConnected) return;
      if (window.activeWindow !== noteWindow) {
        noteWindow.focus();
        // Obsidian Modal.open() uses these globals. Closing a pop-out settings
        // window can leave its last event as the active window until focus changes.
        window.activeWindow = noteWindow;
        window.activeDocument = noteDocument;
      }
      new BysanPdfPreviewModal(this.app, this, view).open();
    }, 80);
  }


  removeParagraphBlankLines(editor, view) {
    const changes = buildParagraphBlankLineChanges(editor.getValue(), this.settings.blankLinePreservation);
    if (changes.length === 0) {
      new Notice(this.t("paragraphCleanup.none"));
      return false;
    }

    const fileName = view?.file?.name || this.t("pdf.currentNote");
    const confirmed = window.confirm(this.t("paragraphCleanup.confirm", {
      name: fileName,
      count: changes.length
    }));
    if (!confirmed) return false;

    /* One CodeMirror transaction makes the entire cleanup a single Ctrl+Z. */
    editor.transaction({ changes });
    new Notice(this.t("paragraphCleanup.done", { count: changes.length }));
    return true;
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

  async resetThemeSetting(id) {
    if (!Object.hasOwn(this.settings.themeSettings || {}, id)) return;
    this.settings.themeSettings = { ...this.settings.themeSettings };
    delete this.settings.themeSettings[id];
    this.settings.stylePresetDirty = true;
    await this.saveData(this.settings);
    this.themeControls.applySetting(id);
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

    const preferences = Object.fromEntries(Object.entries(this.settings)
      .filter(([key]) => PRESET_META_KEYS.has(key)));
    this.settings = Object.assign({}, deepClone(DEFAULT_SETTINGS), snapshot, preferences, {
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
    for (const [key, property] of [["noteFontSize", "--bysan-note-font-size"], ["tableFontSize", "--bysan-table-font-size"]]) {
      const value = this.settings[key];
      const customized = Number.isFinite(value) && value > 0;
      body.classList.toggle(`${property.slice(2)}-set`, customized);
      if (customized) body.style.setProperty(property, `${value}px`);
      else body.style.removeProperty(property);
    }
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
    const zh = this.plugin.language === "zh";
    const folds = new Map([...containerEl.querySelectorAll("details[id]")].map(el => [el.id, el.open]));
    containerEl.empty();
    containerEl.addClass("bysan-style-settings");

    new Setting(containerEl)
      .setName("Bysan Style Controller")
      .setHeading();

    this.plugin.themeControls.beginRegionRender();
    this.renderSectionNavigation(containerEl);
    const areas = containerEl.createDiv({ cls: "bysan-major-areas" });

    const content = this.createMajorArea(areas, "content", zh ? "笔记外观" : "Note appearance");
    this.renderEditorRegionSettings(content);

    const tools = this.createMajorArea(areas, "tools", zh ? "写作工具" : "Writing tools");
    this.createSettingsSection(tools, "modules", zh ? "功能开关" : "Feature switches", body => {
      this.renderIntegratedModuleSettings(body);
    });
    this.createSettingsSection(tools, "blank-line-cleanup", zh ? "空行清理" : "Blank-line cleanup", (body) => {
      this.renderBlankLineCleanupSettings(body);
    });
    this.createSettingsSection(tools, "pdf-export", zh ? "PDF 预览与导出" : "PDF preview and export", (body) => {
      new Setting(body)
        .setName(this.plugin.t("pdf.command"))
        .setDesc(zh
          ? "在预览窗口调整纸张、页边距、实际缩放和导出范围。也可从左侧工具栏打开。"
          : "Set paper, margins, output scale and page range inside the preview. Also available in the ribbon.")
        .addButton((button) => button
          .setButtonText(zh ? "打开预览" : "Open preview")
          .onClick(() => {
            const view = this.app.workspace.getActiveViewOfType(MarkdownView);
            if (view?.editor) this.app.setting.close();
            this.plugin.openPdfPreview(view);
          }));
    });

    const styles = this.createMajorArea(areas, "styles", zh ? "风格与高级" : "Styles and advanced");
    this.createSettingsSection(styles, "preset", this.plugin.t("section.preset"), (body) => {
      this.renderStylePresetSettings(body);
    });
    this.createSettingsSection(styles, "preferences", zh ? "偏好设置" : "Preferences", (body) => {
      this.renderLanguageSetting(body);
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
      resetSetting.settingEl.id = "bysan-reset-action";
    });
    this.advancedArea = this.createSubarea(styles, "advanced", zh ? "高级主题设置" : "Advanced theme settings", () => {});
    this.advancedArea.addEventListener("toggle", () => {
      if (this.advancedArea.open) this.renderAdvancedSettings();
    });

    if (folds.get(this.advancedArea.id)) this.renderAdvancedSettings();
    for (const details of containerEl.querySelectorAll("details[id]")) {
      if (folds.has(details.id)) details.open = folds.get(details.id);
    }
    this.setActiveMajorArea(containerEl, this.activeMajorArea || "content", false);
  }


  renderAdvancedSettings() {
    const body = this.advancedArea?.querySelector(":scope > .bysan-subarea-body");
    if (!body || body.childElementCount) return;
    const zh = this.plugin.language === "zh";
    let picker;
    new Setting(body).setName(zh ? "界面区域" : "Interface area").addDropdown(dropdown => {
      picker = dropdown;
    });
    for (const [region, cn, en] of [
      ["workspace", "整体工作区", "Whole workspace"],
      ["top", "顶部与标签页", "Top bar and tabs"],
      ["left", "左侧面板", "Left sidebar"],
      ["right", "右侧面板", "Right sidebar"],
      ["system", "设置与菜单", "Settings and menus"],
      ["editor", "笔记排版细节", "Detailed note typography"],
      ["media", "Canvas、图谱与 PDF 样式", "Canvas, graph and PDF styles"],
      ["plugins", "第三方插件适配", "Third-party plugin integrations"],
      ["documents", "文档样式类", "Document style classes"]
    ]) {
      picker.addOption(region, zh ? cn : en);
      const section = this.createSettingsSection(body, region, zh ? cn : en, (group) => {
        if (region === "workspace") this.renderWorkspaceSettings(group);
        this.plugin.themeControls.renderRegion(group, region, NOTE_APPEARANCE_IDS);
      });
      section.dataset.bysanAdvancedRegion = region;
    }
    this.advancedRegionPicker = picker;
    picker.onChange(region => this.selectAdvancedRegion(region));
    this.selectAdvancedRegion(this.activeAdvancedRegion || "workspace");
  }

  selectAdvancedRegion(region) {
    this.activeAdvancedRegion = region;
    this.advancedRegionPicker.setValue(region);
    for (const section of this.advancedArea.querySelectorAll("[data-bysan-advanced-region]")) {
      section.hidden = section.dataset.bysanAdvancedRegion !== region;
    }
  }


  createMajorArea(containerEl, id, title) {
    const area = containerEl.createEl("section", {
      cls: "bysan-major-area",
      attr: { "data-bysan-major-area": id, "aria-label": title }
    });
    return area;
  }

  createSettingsSection(containerEl, id, title, render) {
    const section = containerEl.createEl("section", {
      cls: "bysan-settings-section",
      attr: { id: `bysan-section-${id}`, "data-bysan-section-label": title }
    });
    section.createEl("h3", { cls: "bysan-settings-section-title", text: title });
    const body = section.createDiv({ cls: "bysan-settings-section-body" });
    render(body);
    const internalHeading = body.querySelector(":scope > .setting-item-heading:first-child");
    if (internalHeading) {
      internalHeading.removeAttribute("id");
      internalHeading.addClass("bysan-subarea-internal-heading");
    }
    return section;
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
    const shortcuts = containerEl.querySelector(".bysan-section-shortcuts");
    if (shortcuts) shortcuts.hidden = selected !== "content";
    if (scroll) {
      containerEl.querySelector(".bysan-settings-nav")?.scrollIntoView({ behavior: "auto", block: "start" });
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
      ["content", this.plugin.language === "zh" ? "笔记外观" : "Note appearance"],
      ["tools", this.plugin.language === "zh" ? "写作工具" : "Writing tools"],
      ["styles", this.plugin.language === "zh" ? "风格与高级" : "Styles and advanced"]
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
      const region = row.closest("[data-bysan-advanced-region]");
      if (region) this.selectAdvancedRegion(region.dataset.bysanAdvancedRegion);
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
      searchResults.empty();
      const query = search.value.trim();
      if (!query) {
        clearSearch();
        return;
      }
      this.renderAdvancedSettings();
      currentMatches = this.plugin.themeControls.filterRows(containerEl, query);

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
        const path = [];
        for (let parent = row.parentElement; parent; parent = parent.parentElement) {
          if (parent.matches("details")) {
            const summary = parent.querySelector(":scope > summary");
            const label = summary?.querySelector(".bysan-subarea-title");
            if (summary) path.unshift((label || summary).textContent.trim());
          }
          if (parent.dataset.bysanSectionLabel) path.unshift(parent.dataset.bysanSectionLabel);
          if (parent.hasAttribute("data-bysan-major-area")) {
            path.unshift(parent.getAttribute("aria-label"));
            break;
          }
        }
        if (path.length) button.createSpan({ cls: "bysan-settings-search-result-desc", text: path.join(" › ") });
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
    const zh = this.plugin.language === "zh";
    const shortcuts = navigation.createDiv({
      cls: "bysan-section-shortcuts",
      attr: { "aria-label": zh ? "笔记外观分组" : "Note appearance sections" }
    });
    for (const [id, cn, en] of [
      ["headings", "标题", "Headings"], ["body-text", "正文", "Body"], ["text-details", "列表", "Lists"],
      ["code", "代码", "Code"], ["inline-code", "行内代码", "Inline code"],
      ["tables", "表格", "Tables"], ["quotes", "引用", "Quotes"], ["math", "公式", "Math"]
    ]) {
      const shortcut = shortcuts.createEl("button", { text: zh ? cn : en, attr: { type: "button" } });
      shortcut.addEventListener("click", () => this.jumpToSection(containerEl, `bysan-section-${id}`));
    }
  }


  renderIntegratedModuleSettings(containerEl) {
    const zh = this.plugin.language === "zh";
    for (const module of INTEGRATED_MODULES) {
      const name = zh ? module.nameZh : module.nameEn;
      const group = containerEl.createDiv({ attr: { id: `bysan-section-${module.id}` } });
      const setting = new Setting(group)
        .setName(name)
        .setDesc(zh ? module.descriptionZh : module.descriptionEn)
        .addToggle((toggle) => toggle
          .setValue(Boolean(this.plugin.settings[module.key]))
          .onChange(async (value) => {
            toggle.setDisabled(true);
            try {
              await this.plugin.updateIntegratedModuleSetting(module.key, value);
            } finally {
              toggle.setValue(Boolean(this.plugin.settings[module.key])).setDisabled(false);
            }
          }));
      setting.settingEl.addClass("bysan-unified-control-setting", "bysan-control-type-toggle");
      if (module.key === "moduleReviewToolbar") {
        const badgeSetting = this.addNumberSetting(group, this.plugin.t("review.badgeSize"),
          this.plugin.t("review.badgeSizeDesc"), "reviewBadgeSize", 12, 24, 1, "px");
        badgeSetting.infoEl.createSpan({ cls: "bysan-badge-sample", text: "1",
          attr: { title: zh ? "评论角标样例" : "Comment badge sample" } });
      }
    }
  }


  jumpToSection(containerEl, targetId) {
    const target = containerEl.querySelector(`#${targetId}`);
    if (!target) return;
    const navigation = containerEl.querySelector(".bysan-settings-nav");
    const style = containerEl.ownerDocument.defaultView.getComputedStyle(containerEl);
    const padding = (parseFloat(style.paddingTop) || 0) - (parseFloat(style.scrollPaddingTop) || 0);
    target.style.scrollMarginTop = `${(navigation?.offsetHeight || 0) + padding + 8}px`;
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
    const controls = this.createAppearanceLayout(containerEl, sample => {
      const code = sample.createDiv({ cls: "el-pre" }).createEl("pre").createEl("code", { cls: "language-js" });
      code.createSpan({ cls: "token keyword", text: "const" });
      code.append(" total = ");
      code.createSpan({ cls: "token number", text: "42" });
      code.append(";\nconsole.log(total);");
    });
    this.createFeatureGroup(
      controls,
      this.plugin.language === "zh" ? "功能与渲染" : "Behaviour and rendering",
      "",
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
      }
    );
    this.createFeatureGroup(
      controls,
      this.plugin.language === "zh" ? "明暗外观" : "Light and dark appearance",
      "",
      (body) => {
        this.addDualColor(body, this.plugin.t("palette.codeBg"), "codeBgLight", "codeBgDark", "codeBgOpacityLight", "codeBgOpacityDark");
        this.addDualColor(body, this.plugin.t("palette.codeText"), "codeTextLight", "codeTextDark");
        this.addDualColor(body, this.plugin.t("palette.codeBorder"), "codeBorderLight", "codeBorderDark");
      }
    );
    this.createFeatureGroup(
      controls,
      this.plugin.language === "zh" ? "代码块尺寸与编辑细节" : "Code block size and editor details",
      "",
      (body) => {
        this.addToggle(body, this.plugin.t("code.noWrapLive"), this.plugin.t("code.noWrapLiveDesc"), "codeNoWrapLive");
        this.addToggle(body, this.plugin.t("code.muteActive"), this.plugin.t("code.muteActiveDesc"), "muteCodeActiveLine");
        this.addNumberSetting(body, this.plugin.t("code.spacing"), this.plugin.t("code.spacingDesc"), "codeLetterSpacing", 0, 2, 0.1, "px");
        this.addNumberSetting(body, this.plugin.t("code.blur"), this.plugin.t("code.blurDesc"), "codeBlur", 0, 8, 1, "px");
        this.renderGeometryControls(body, "codeBlock");
      }
    );
  }


  renderEditorRegionSettings(containerEl) {
    const zh = this.plugin.language === "zh";
    this.createSettingsSection(containerEl, "headings", zh ? "文内标题" : "Note headings", (body) => {
      NOTE_HEADING_CONTROLS.forEach((controls, index) => {
        const level = index + 1;
        const row = body.createDiv({
          cls: "bysan-heading-row",
          attr: { id: `bysan-section-appearance-h${level}` }
        });
        this.renderAppearanceSample(row, sample => {
          sample.createEl(`h${level}`, { text: `H${level}` });
        }, false);
        this.renderNoteThemeControls(row, controls, true);
      });
    });
    this.createSettingsSection(containerEl, "body-text", zh ? "正文" : "Body text", (body) => {
      const controls = this.createAppearanceLayout(body, sample => {
        const paragraph = sample.createEl("p", { text: zh
          ? "这一段展示正文字体、颜色和行高。下方第二行可用于比较行距。"
          : "This paragraph shows the body font, colour and line height." });
        paragraph.createEl("br");
        paragraph.createSpan({ text: zh ? "这是同一段的第二行。" : "This is the second line of the paragraph." });
      });
      this.addNumberSetting(controls, zh ? "正文字号" : "Body font size",
        zh ? "恢复后跟随 Obsidian 的字体大小。" : "Reset to follow Obsidian’s font size.",
        "noteFontSize", 8, 48, 1, "px",
        () => parseFloat(getComputedStyle(document.body).getPropertyValue("--font-text-size")) || 16);
      this.renderNoteThemeControls(controls, NOTE_BODY_CONTROLS);
    });
    this.createSettingsSection(containerEl, "text-details", zh ? "列表、粗体与分隔线" : "Lists, bold text and dividers", (body) => {
      this.renderTextDetailSettings(body);
    });
    this.createSettingsSection(containerEl, "code", zh ? "代码块" : "Code blocks", (body) => {
      this.renderCodeSettings(body);
    });
    this.createSettingsSection(containerEl, "inline-code", zh ? "行内代码" : "Inline code", (body) => {
      this.renderInlineCodeSettings(body);
    });
    this.createSettingsSection(containerEl, "tables", zh ? "表格" : "Tables", (body) => {
      this.renderTableSettings(body);
    });
    this.createSettingsSection(containerEl, "quotes", zh ? "引用块" : "Blockquotes", (body) => {
      this.renderQuoteSettings(body);
    });
    this.createSettingsSection(containerEl, "math", zh ? "块公式" : "Display math", (body) => {
      const controls = this.createAppearanceLayout(body, sample => {
        const math = sample.createDiv({ cls: "math math-block" });
        const fallback = math.createSpan({ cls: "bysan-math-sample-fallback", text: "E = mc²" });
        void loadMathJax().then(async () => {
          if (!math.isConnected) return;
          const equation = renderMath("E = mc^2", true);
          math.appendChild(equation);
          await finishRenderMath();
          fallback.remove();
        }).catch(error => console.warn("[Bysan Style Controller] Math preview unavailable", error));
      });
      this.renderNoteThemeControls(controls, [["font-size-latex", "块公式字号", "Display math font size"]]);
    });
  }


  renderNoteThemeControls(containerEl, controls, compact = false) {
    const zh = this.plugin.language === "zh";
    for (const [id, cn, en] of controls) {
      const item = this.plugin.themeControls.controlItems.find(control => control.id === id);
      if (item) this.plugin.themeControls.renderItem(containerEl, item, {
        name: zh ? cn : en,
        scope: zh ? "编辑与阅读正文" : "Editor and reading view",
        compact
      });
    }
  }


  createAppearanceLayout(containerEl, render) {
    const layout = containerEl.createDiv({ cls: "bysan-appearance-layout" });
    this.renderAppearanceSample(layout, render);
    return layout.createDiv({ cls: "bysan-appearance-controls" });
  }


  renderAppearanceSample(containerEl, render, labelled = true) {
    const box = containerEl.createDiv({ cls: "bysan-appearance-sample" });
    if (labelled) box.createDiv({
      cls: "bysan-appearance-sample-label",
      text: this.plugin.language === "zh" ? "阅读样例" : "Reading sample"
    });
    const content = box.createDiv({ cls: "markdown-rendered" });
    render(content.createDiv({ cls: "markdown-preview-section" }));
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
    const controls = this.createAppearanceLayout(containerEl, sample => {
      const paragraph = sample.createEl("p", { text: this.plugin.language === "zh" ? "行内代码示例 " : "Inline code sample " });
      paragraph.createEl("code", { text: "np.arange()" });
    });
    this.createFeatureGroup(
      controls,
      this.plugin.language === "zh" ? "明暗外观" : "Light and dark appearance",
      "",
      (body) => {
        this.addDualColor(body, this.plugin.t("palette.inlineBg"), "inlineBgLight", "inlineBgDark");
        this.addDualColor(body, this.plugin.t("palette.inlineText"), "inlineTextLight", "inlineTextDark");
        this.addDualColor(body, this.plugin.language === "zh" ? "行内代码阴影" : "Inline-code shadow", "inlineShadowLight", "inlineShadowDark");
      }
    );
    this.createFeatureGroup(
      controls,
      this.plugin.language === "zh" ? "行内代码尺寸与间距" : "Inline code size and spacing",
      "",
      (body) => this.renderGeometryControls(body, "inlineCode")
    );
  }


  renderTableSettings(containerEl) {
    const zh = this.plugin.language === "zh";
    const controls = this.createAppearanceLayout(containerEl, sample => {
      const table = sample.createDiv({ cls: "el-table" }).createEl("table");
      const header = table.createEl("thead").createEl("tr");
      header.createEl("th", { text: zh ? "样本" : "Sample" });
      header.createEl("th", { text: zh ? "结果" : "Result" });
      const rows = table.createEl("tbody");
      for (const [name, value] of [["A", "0.82"], ["B", "0.91"]]) {
        const row = rows.createEl("tr");
        row.createEl("td", { text: name });
        row.createEl("td", { text: value });
      }
    });
    this.createFeatureGroup(
      controls,
      this.plugin.language === "zh" ? "功能" : "Behaviour",
      "",
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
      controls,
      this.plugin.language === "zh" ? "明暗外观" : "Light and dark appearance",
      "",
      (body) => {
        this.addDualColor(body, this.plugin.t("palette.tableHead"), "tableHeadLight", "tableHeadDark");
        this.addDualColor(body, zh ? "表格偶数行背景（斑马纹）" : "Even table row background (zebra stripes)",
          "tableStripeLight", "tableStripeDark", null, null,
          zh ? "启用斑马纹后生效。编辑预览与阅读模式。" : "Shown when zebra stripes are enabled. Live Preview and reading view.");
      }
    );
    this.createFeatureGroup(
      controls,
      zh ? "表格边框、悬停与尺寸" : "Table borders, hover and sizing",
      "",
      (body) => {
        this.addDualColor(body, this.plugin.t("palette.tableHover"), "tableHoverLight", "tableHoverDark");
        this.addDualColor(body, this.plugin.t("palette.tableBorder"), "tableBorderLight", "tableBorderDark");
        this.addNumberSetting(body, zh ? "表格字号" : "Table font size",
          zh ? "恢复后使用主题的表格字号。" : "Reset to use the theme’s table font size.",
          "tableFontSize", 7, 48, 1, "px", () => {
            const cell = containerEl.querySelector(".bysan-appearance-sample td");
            return parseFloat(cell.ownerDocument.defaultView.getComputedStyle(cell).fontSize) || 14;
          });
        this.renderGeometryControls(body, "table");
      }
    );
  }


  renderQuoteSettings(containerEl) {
    const controls = this.createAppearanceLayout(containerEl, sample => {
      sample.createDiv({ cls: "el-blockquote" }).createEl("blockquote").createEl("p", {
        text: this.plugin.language === "zh" ? "一段引用文字，用于比较边框、背景和字体。" : "A blockquote for comparing border, background and font."
      });
    });
    this.createFeatureGroup(
      controls,
      this.plugin.language === "zh" ? "文字功能" : "Text behaviour",
      "",
      (body) => this.addToggle(body, this.plugin.t("components.quoteSerif"), this.plugin.t("components.quoteSerifDesc"), "quoteSerif")
    );
    this.createFeatureGroup(
      controls,
      this.plugin.language === "zh" ? "明暗外观" : "Light and dark appearance",
      "",
      (body) => {
        this.addDualColor(body, this.plugin.t("palette.quoteBg"), "quoteBgLight", "quoteBgDark", "quoteBgOpacityLight", "quoteBgOpacityDark");
        this.addDualColor(body, this.plugin.t("palette.quoteBorder"), "quoteBorderLight", "quoteBorderDark");
      }
    );
    this.createFeatureGroup(
      controls,
      this.plugin.language === "zh" ? "引用块尺寸与间距" : "Blockquote size and spacing",
      "",
      (body) => this.renderGeometryControls(body, "quote")
    );
  }


  renderBlankLineCleanupSettings(containerEl) {
    const zh = this.plugin.language === 'zh';
    this.createFeatureGroup(containerEl, zh ? '保留规则' : 'Preservation rules',
      zh ? '从左侧工具栏运行空行清理。开启某一项会保留该类型前后的一行空行。' : 'Run blank-line cleanup from the ribbon. Enabling a rule keeps one blank line around that type.',
      body => {
        for (const [key, cn, en, fallback] of BLANK_LINE_OPTIONS) {
          new Setting(body).setName(zh ? `保留${cn}前后空行` : `Keep blank lines around ${en.toLowerCase()}`).addToggle(toggle => toggle
            .setValue(this.plugin.settings.blankLinePreservation?.[key] ?? fallback)
            .onChange(value => this.plugin.updateSetting('blankLinePreservation', {
              ...this.plugin.settings.blankLinePreservation, [key]: value
            })));
        }
        new Setting(body).setName(zh ? '批量设置' : 'Bulk settings')
          .addButton(button => button.setButtonText(zh ? '全部开启清理' : 'Remove all').onClick(async () => {
            await this.plugin.updateSetting('blankLinePreservation', Object.fromEntries(BLANK_LINE_OPTIONS.map(([key]) => [key, false])));
            this.display();
          }))
          .addButton(button => button.setButtonText(zh ? '恢复默认' : 'Restore defaults').onClick(async () => {
            await this.plugin.updateSetting('blankLinePreservation', {});
            this.display();
          }));
      });
  }


  renderTextDetailSettings(containerEl) {
    const zh = this.plugin.language === "zh";
    const controls = this.createAppearanceLayout(containerEl, sample => {
      const list = sample.createEl("ul");
      list.createEl("li", { text: zh ? "普通列表项" : "List item" });
      const task = list.createEl("li", { cls: "task-list-item" });
      task.createEl("input", { cls: "task-list-item-checkbox", attr: { type: "checkbox", disabled: "", checked: "" } });
      task.append(zh ? " 已完成任务" : " Completed task");
      sample.createEl("hr");
      sample.createEl("p").createEl("strong", { text: zh ? "粗体文字" : "Bold text" });
    });
    this.createFeatureGroup(
      controls,
      this.plugin.language === "zh" ? "列表外观" : "List appearance",
      this.plugin.language === "zh" ? "浅色与深色模式的列表标记颜色。" : "List-marker colours in light and dark mode.",
      (body) => this.addDualColor(body, this.plugin.t("palette.marker"), "markerLight", "markerDark")
    );
    this.createFeatureGroup(
      controls,
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


  addDualColor(containerEl, name, lightKey, darkKey, lightOpacityKey = null, darkOpacityKey = null, description = "") {
    const setting = new Setting(containerEl).setName(name).setDesc(description || (this.plugin.language === "zh"
      ? "编辑预览与阅读模式。" : "Live Preview and reading view."));
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
      const setting = this.addNumberSetting(
        containerEl,
        this.plugin.language === "zh" ? controlZh : controlEn,
        this.plugin.language === "zh" ? "编辑预览与阅读模式。" : "Live Preview and reading view.",
        key,
        minimum,
        maximum,
        step,
        unit
      );
      setting.descEl.title = `${property} · ${minimum}–${maximum}${unit}`;
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


  addNumberSetting(containerEl, name, description, key, minimum, maximum, step, unit = "", inherited = () => minimum) {
    const setting = new Setting(containerEl).setName(name).setDesc(description);
    const valueForDisplay = () => this.plugin.settings[key] ?? Number(inherited().toFixed(2));
    const bound = value => Number(clamp(value, minimum, maximum).toFixed(4));
    addValueStepper(setting.controlEl, {
      label: name,
      language: this.plugin.language,
      value: valueForDisplay(),
      unit,
      numeric: true,
      edit: value => value.trim() && Number.isFinite(Number(value)) ? bound(Number(value)) : null,
      adjust: (value, direction) => bound(Number(value) + step * direction),
      save: value => this.plugin.updateSetting(key, value),
      reset: async () => {
        await this.plugin.resetSetting(key);
        return valueForDisplay();
      }
    });
    setting.settingEl.addClass("bysan-unified-control-setting", "bysan-stepper-setting");
    setting.settingEl.dataset.bysanSettingKeys = key;
    return setting;
  }
}
