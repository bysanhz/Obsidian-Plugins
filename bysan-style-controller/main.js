/**
 * Bysan Style Controller
 * Version: 0.19.1
 *
 * Owns visual presentation and provides switchable, integrated Bysan modules.
 */

const {
  MarkdownRenderer,
  MarkdownView,
  Component,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  setIcon
} = require("obsidian");
/* Obsidian evaluates main.js without a plugin-local CommonJS base path. Resolve
 * the helper through the active vault so the plugin remains portable. */
globalThis.__bysanObsidianSetting = Setting;
const themeControlsPath = app.vault.adapter.getFullPath(
  ".obsidian/plugins/bysan-style-controller/theme-controls.js"
);
// Obsidian's plugin require wrapper does not expose Node's module cache.
// Reload only our helper so a plugin reload cannot mix old controls with new main.js.
const requireThemeHelper = require("module").createRequire(themeControlsPath);
delete requireThemeHelper.cache[requireThemeHelper.resolve(themeControlsPath)];
const { ThemeControls, addNumericStepper, addPointSizeStepper, readFontPoints, addStyleDropdown, FONT_WEIGHTS,
  createColorModeLayout, addModeColorPicker, addModeColorReset } = requireThemeHelper(themeControlsPath);
const { resolveLanguage, translate } = require(app.vault.adapter.getFullPath(
  ".obsidian/plugins/bysan-style-controller/i18n.js"
));
globalThis.__bysanPdfApi = { MarkdownRenderer, Modal, Notice, Component, addNumericStepper };
const pdfPreviewPath = app.vault.adapter.getFullPath(".obsidian/plugins/bysan-style-controller/pdf-preview.js");
delete requireThemeHelper.cache[requireThemeHelper.resolve(pdfPreviewPath)];
const { BysanPdfPreviewModal } = requireThemeHelper(pdfPreviewPath);
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
const NOTE_BACKGROUND_CONTROLS = [
  ["bysan-note-page-bg", "笔记底色", "Note background colour"],
  ["background-notebook-liked-switch", "开启笔记纸纹理", "Enable notebook pattern"],
  ["notebook-liked-markdown-page-options", "笔记纸纹理", "Notebook pattern"]
];
const EDITOR_MARK_CONTROLS = [
  ["activeline-background", "当前编辑行背景", "Active editor line background", "关闭「隐藏当前行背景」后生效。", "Turn off “Hide active line background” to show this colour."],
  ["muted-activeline-bg", "隐藏当前行背景", "Hide active line background"],
  ["text-selection", "鼠标选中文字的背景", "Selected text background", "开启「显示编辑器选区背景」后生效。", "Turn on “Show editor selection background” to show this colour."],
  ["remove-selectionbackground", "显示编辑器选区背景", "Show editor selection background"]
];
const NOTE_MARK_CONTROLS = [
  ["bysan-mark-bg", "Markdown 高亮背景", "Markdown highlight background", "用于 ==文字==。", "Used for ==text==."],
  ["text-highlight", "Markdown 高亮文字颜色", "Markdown highlight text colour"],
  ["internal-link-color", "笔记内链颜色", "Internal link colour"],
  ["external-link-color", "外部链接颜色", "External link colour"],
  ["link-underline-internal", "显示内链下划线", "Underline internal links"],
  ["link-underline-external", "显示外链下划线", "Underline external links", "", "", { invertToggle: true }],
  ["link-underline-unresolved", "显示未创建链接下划线", "Underline uncreated links", "", "", { invertToggle: true }]
];
const CLOZE_SWITCH = ["remove-cloze-style", "启用答案遮挡", "Hide answers", "", "", { invertToggle: true }];
const CLOZE_VARIANTS = [
  { name: ["色块遮挡", "Colour block"], reveal: ["悬停查看答案", "Hover to reveal"], syntax: "==~~答案~~==",
    italic: false, highlight: true, controls: [
      ["cloze-bg-color", "遮挡色块", "Cover colour"],
      ["cloze-decoration", "色块下划线线型", "Cover underline style"],
      ["cloze-decoration-color", "色块下划线颜色", "Cover underline colour"]
    ] },
  { name: ["按住显示", "Hold to reveal"], reveal: ["按住鼠标显示答案", "Hold the mouse button to reveal"], syntax: "*==~~答案~~==*",
    italic: true, highlight: true, controls: [
      ["cloze-decoration-2", "按住显示的下划线线型", "Hold-to-reveal underline style"],
      ["cloze-decoration-color-2", "按住显示的下划线颜色", "Hold-to-reveal underline colour"]
    ] },
  { name: ["留空遮挡", "Blank answer"], reveal: ["悬停查看答案", "Hover to reveal"], syntax: "*~~答案~~*",
    italic: true, highlight: false, controls: [
      ["cloze-decoration-3", "留空遮挡的下划线线型", "Blank-answer underline style"],
      ["cloze-decoration-color-3", "留空遮挡的下划线颜色", "Blank-answer underline colour"]
    ] }
];
const COLOUR_HIGHLIGHT_SWITCH = ["remove-colorful-highlight-bg", "启用彩色高亮变体", "Enable coloured highlight variants",
  "开启后，加了斜体或粗体的高亮使用各自的配色。", "Emphasised highlights use their own palettes when enabled.",
  { invertToggle: true }];
const COLOUR_HIGHLIGHT_VARIANTS = [
  { name: ["斜体高亮", "Italic highlight"], syntax: "*==文字==*", tags: ["em"] },
  { name: ["粗体高亮", "Bold highlight"], syntax: "**==文字==**", tags: ["strong"] },
  { name: ["粗斜体高亮", "Bold italic highlight"], syntax: "***==文字==***", tags: ["strong", "em"] }
].map((variant, index) => {
  const number = index + 1;
  const [zh, en] = variant.name;
  return { ...variant, controls: [
    [`bg-color-highlight-${number}`, `${zh}背景`, `${en} background`],
    [`color-highlight-${number}`, `${zh}文字颜色`, `${en} text colour`],
    [`font-weight-highlight-${number}`, `${zh}字重`, `${en} font weight`]
  ] };
});
const CALLOUT_CONTROLS = [
  ["admonition-bg-color", "提示框内容背景", "Callout body background"],
  ["admonition-bg-color-same", "提示框内容沿用标题配色", "Use callout title colours for the body"]
];
const NAVIGATION_COLOR_CONTROLS = [
  ["bysan-left-pane-bg", "左侧栏底色", "Left sidebar background"],
  ["bysan-right-pane-bg", "右侧栏底色", "Right sidebar background"],
  ["bysan-active-file-bg", "文件树当前文件背景", "Active file background in the file tree"]
];
const TAB_COLOR_CONTROLS = [
  ["bysan-active-tab-bg", "当前标签页背景", "Active tab background"],
  ["background-titlebar-inner", "窗口标题栏背景", "Window title bar background", "开启下方的标题栏自定义背景后生效。", "Enable the custom title bar background below to use this colour."],
  ["bt-colorful-titlebar", "开启标题栏自定义背景", "Enable custom title bar background"]
];
const INTERFACE_COLOR_CONTROLS = [
  ["status-bar-bg", "底部状态栏背景", "Status bar background"],
  ["interactive-accent", "界面强调色", "Interface accent colour"]
];
const REVIEW_PANEL_CONTROLS = [
  ["bysan-review-panel-bg", "面板底色", "Panel background",
    "未单独设色时跟随右侧栏底色；右侧栏也未设色时沿用评论面板原配色。",
    "Follows the right sidebar when customised there; otherwise uses the original panel colour."],
  ["bysan-review-title-color", "面板标题文字与图标", "Panel title text and icon"],
  ["bysan-review-empty-bg", "空状态提示框底色", "Empty-state box background"],
  ["bysan-review-empty-text", "空状态提示文字", "Empty-state text"],
  ["bysan-review-empty-border", "空状态提示框边框", "Empty-state box border"],
  ["bysan-review-card-bg", "评论卡片底色", "Comment card background"],
  ["bysan-review-card-text", "评论卡片正文文字", "Comment card text"],
  ["bysan-review-card-border", "评论卡片边框", "Comment card border"]
];
const HEADING_NUMBER_CONTROLS = [
  ["ahn-number-color", "编号颜色", "Number colour"],
  ["bysan-heading-number-gap", "编号与标题间距", "Gap between number and heading",
    "启用「学术标题编号」后适用于编辑、阅读、大纲和 PDF。em 会按各处的字号等比例变化。",
    "With Academic heading numbering on, applies to editing, reading, outline and PDF. The em unit scales with the local font size."]
];
const SURFACE_COLORS = [
  ["bysan-note-page-bg", "background-primary"],
  ["bysan-mark-bg", "text-highlight-bg"],
  ["bysan-left-pane-bg", "bt-background-split-container"],
  ["bysan-right-pane-bg", "bt-background-split-container"],
  ["bysan-active-tab-bg", "tab-background-active"],
  ["bysan-active-file-bg", "nav-item-background-active"],
  ...REVIEW_PANEL_CONTROLS.map(([id]) => [id, id === "bysan-review-panel-bg" ? "bysan-review-panel-bg-default" : undefined])
];
const NOTE_HEADING_CONTROLS = Array.from({ length: 6 }, (_, index) => {
  const level = index + 1;
  return [
    [`print-h${level}-color`, `H${level} 文字颜色`, `H${level} text colour`],
    [`h${level}-size`, `H${level} 字号`, `H${level} font size`]
  ];
});
const HEADING_BACKGROUND_CONTROLS = NOTE_HEADING_CONTROLS.map((_, index) => {
  const level = index + 1;
  return [
    [`h${level}-bg-color`, `H${level} 背景颜色`, `H${level} background colour`],
    [`header-${level}-background`, `显示 H${level} 背景`, `Show H${level} background`]
  ];
});
const PAGE_TITLE_CONTROLS = [
  ["inline-title-color", "页面标题文字颜色", "Page title text colour"],
  ["inline-title-size", "页面标题字号", "Page title font size"],
  ["inline-title-bg-color", "页面标题背景", "Page title background", "开启下方的「显示页面标题背景」后生效。", "Turn on “Show page title background” below to use this colour."],
  ["toggle-inline-title-background", "显示页面标题背景", "Show page title background"]
];
const COMMON_THEME_IDS = new Set(
  [...NOTE_BODY_CONTROLS, ...NOTE_BACKGROUND_CONTROLS, ...EDITOR_MARK_CONTROLS, ...NOTE_MARK_CONTROLS,
    ...CALLOUT_CONTROLS, ...INTERFACE_COLOR_CONTROLS, ...NAVIGATION_COLOR_CONTROLS, ...TAB_COLOR_CONTROLS, ...PAGE_TITLE_CONTROLS,
    ...NOTE_HEADING_CONTROLS.flat(), ...HEADING_BACKGROUND_CONTROLS.flat(), ...HEADING_NUMBER_CONTROLS, ...REVIEW_PANEL_CONTROLS, ["font-size-latex"],
    CLOZE_SWITCH, ...CLOZE_VARIANTS.flatMap(variant => variant.controls),
    COLOUR_HIGHLIGHT_SWITCH, ...COLOUR_HIGHLIGHT_VARIANTS.flatMap(variant => variant.controls),
    ["bysan-inline-code-border"], ["bysan-code-block-font"], ["bysan-inline-code-font"]].map(([id]) => id)
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

function buildParagraphBlankLineChanges(markdown, options = {}, keepBoundaries = false) {
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
      const keep = keepBoundaries || setextRisk || preserve(classify(before)) || preserve(classify(after));
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

function sameSetting(left, right) {
  if (left === right) return true;
  if (!left || !right || typeof left !== "object" || typeof right !== "object" ||
      Array.isArray(left) !== Array.isArray(right)) return false;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length &&
    keys.every(key => Object.hasOwn(right, key) && sameSetting(left[key], right[key]));
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
const GEOMETRY_FONT_TARGETS = {
  inlineCodeFontSize: "p > code", codeBlockFontSize: "pre > code", quoteFontSize: "blockquote"
};

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
  "bysan-table-font-size-set",
  "bysan-inline-code-point-size",
  "bysan-code-block-point-size",
  "bysan-quote-point-size"
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

    this.styleEdits = [];
    this.styleSettingTab = new BysanStyleSettingTab(this.app, this);
    this.addSettingTab(this.styleSettingTab);
    this.addCommand({
      id: "open-style-settings",
      name: this.language === "zh" ? "打开样式设置" : "Open style settings",
      callback: () => {
        this.app.setting.open();
        this.app.setting.openTabById(this.manifest.id);
      }
    });
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
        this.styleSettingTab?.refreshSettingFeedback();
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
    new BatchSourceEditModal(this.app, this, editor, view, "blank", (source, merge) =>
      buildParagraphBlankLineChanges(source, this.settings.blankLinePreservation, !merge)).open();
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
    for (const module of this.integratedModules?.values() ?? []) module.refreshLanguage?.();
  }


  async onunload() {
    this.themeObserver?.disconnect();
    this.lineRangeObserver?.disconnect();
    this.themeControls?.destroy();
    if (this.lineRangeFrame) window.cancelAnimationFrame(this.lineRangeFrame);
    if (this.pointRefreshFrame) window.cancelAnimationFrame(this.pointRefreshFrame);
    this.pointRefreshers?.clear();
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
    instance.getHostLanguage = () => this.language;
    if (module.id === "academic-heading-numbering") {
      instance.openSourceCleanup = (editor, view, build) =>
        new BatchSourceEditModal(this.app, this, editor, view, "heading", build).open();
    }
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


  async updateSetting(key, value, action) {
    return this.changeStyleValues("base", { [key]: value }, action);
  }

  async updateThemeSetting(id, value, action) {
    await this.updateThemeSettings({ [id]: value }, action);
  }

  async updateThemeSettings(changes, action) {
    return this.changeStyleValues("theme", changes, action);
  }

  async changeStyleValues(kind, changes, { group, history = true } = {}) {
    const target = kind === "theme" ? (this.settings.themeSettings ||= {}) : this.settings;
    const previous = new Map();
    const edited = [];
    for (const [key, next] of Object.entries(changes)) {
      if (sameSetting(target[key], next) && (next !== undefined || !Object.hasOwn(target, key))) continue;
      if (kind === "theme" || !PRESET_META_KEYS.has(key)) previous.set(key,
        target[key] === undefined ? undefined : deepClone(target[key]));
      edited.push(key);
      if (next === undefined) delete target[key];
      else target[key] = next;
    }
    if (!edited.length) return;
    if (history && previous.size) {
      const last = this.styleEdits.at(-1);
      if (group && last?.group === group && last.kind === kind) {
        for (const [key, old] of previous) if (!last.previous.has(key)) last.previous.set(key, old);
      } else {
        this.styleEdits.push({ group, kind, previous });
        if (this.styleEdits.length > 30) this.styleEdits.shift();
      }
    }
    if (previous.size) this.settings.stylePresetDirty = this.stylePresetChanges().length > 0;
    // Queue writes so a rapid drag cannot persist an older value after a newer one.
    const previousWrite = this.styleWrite || Promise.resolve();
    const write = previousWrite.catch(() => {}).then(() => this.saveData(this.settings));
    this.styleWrite = write;
    await write;
    if (kind === "theme") {
      for (const key of edited) this.themeControls.applySetting(key);
    } else if (edited.every(key => PALETTE_SETTING_KEYS.has(key))) this.applyPalette();
    else this.applySettings();
    this.schedulePointRefresh();
    this.styleSettingTab?.refreshSettingFeedback();
  }

  async resetSetting(key) {
    if (!Object.prototype.hasOwnProperty.call(DEFAULT_SETTINGS, key)) return false;
    await this.updateSetting(key, deepClone(DEFAULT_SETTINGS[key]));
    return true;
  }


  async clearThemeColorMode(id, mode) {
    const changed = {};
    for (const key of this.themeControls.colorModeKeys(id)) {
      const stored = this.settings.themeSettings?.[key];
      if (!stored || typeof stored !== "object" || !Object.hasOwn(stored, mode)) continue;
      const next = { ...stored };
      delete next[mode];
      changed[key] = Object.keys(next).length ? next : undefined;
    }
    if (!Object.keys(changed).length) return false;
    await this.updateThemeSettings(changed);
    return true;
  }

  async resetThemeSetting(id) {
    await this.updateThemeSetting(id, undefined);
  }

  async undoStyleEdit() {
    const entry = this.styleEdits.pop();
    if (!entry) return false;
    await this.changeStyleValues(entry.kind, Object.fromEntries(entry.previous), { history: false });
    return true;
  }

  addPointStepper(container, options) {
    const refresh = addPointSizeStepper(container, { ...options, language: this.language });
    (this.pointRefreshers ??= new Map()).set(container, refresh);
    this.schedulePointRefresh();
  }

  schedulePointRefresh() {
    if (!this.pointRefreshers?.size || this.pointRefreshFrame) return;
    this.pointRefreshFrame = window.requestAnimationFrame(() => {
      this.pointRefreshFrame = 0;
      for (const [container, refresh] of this.pointRefreshers) {
        if (container.isConnected) refresh();
        else this.pointRefreshers.delete(container);
      }
    });
  }


  captureStyleSettings(source = this.settings) {
    return Object.fromEntries(Object.entries(source)
      .filter(([key]) => !PRESET_META_KEYS.has(key))
      .map(([key, value]) => [key, deepClone(value)]));
  }

  stylePresetChanges(presetId = this.settings.activeStylePreset) {
    const base = this.settings.stylePresets?.[presetId]?.settings || {};
    const reference = { ...DEFAULT_SETTINGS, ...base };
    const choices = this.settings.themeSettings || {}, previous = reference.themeSettings || {};
    const keys = Object.keys(DEFAULT_SETTINGS).filter(key => key !== "themeSettings" && !PRESET_META_KEYS.has(key));
    const changes = keys.filter(key => !sameSetting(this.settings[key], reference[key]))
      .map(key => ({ key, from: reference[key], to: this.settings[key] }));
    for (const key of new Set([...Object.keys(previous), ...Object.keys(choices)])) {
      if (!sameSetting(previous[key], choices[key])) changes.push({ key, from: previous[key], to: choices[key] });
    }
    return changes;
  }

  async saveStylePreset(name, presetId = null) {
    const normalizedName = String(name || "").trim().slice(0, 60);
    if (!normalizedName) {
      new Notice(this.t("notice.nameRequired"));
      return null;
    }

    const id = presetId || `preset-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
    const existing = this.settings.stylePresets?.[id];
    if (existing?.name !== normalizedName && Object.entries(this.settings.stylePresets || {})
      .some(([key, entry]) => key !== id && entry.name?.trim().toLocaleLowerCase() === normalizedName.toLocaleLowerCase())) {
      new Notice(this.t("notice.duplicateName"));
      return null;
    }
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
    this.styleSettingTab?.refreshSettingFeedback();
    new Notice(this.t(existing ? "notice.overwritten" : "notice.saved", { name: normalizedName }));
    return id;
  }


  async loadStylePreset(presetId, options = {}) {
    await this.styleWrite?.catch(() => {});
    if (this.stylePresetChanges().length && !options.allowDiscard) {
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
    this.styleEdits.length = 0;
    this.applySettings();
    this.styleSettingTab?.refreshSettingFeedback();
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
    if (!this.stylePresetChanges().length) {
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
    return Boolean(await this.saveStylePreset(preset.name, id));
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
    const wasActive = this.settings.activeStylePreset === presetId;
    if (wasActive) this.settings.activeStylePreset = "__current__";
    this.removedPreset = { id: presetId, preset, wasActive };
    this.settings.stylePresetDirty = this.stylePresetChanges().length > 0;
    await this.saveData(this.settings);
    new Notice(this.t("notice.deleted", { name: preset.name }));
    return true;
  }

  async undoPresetDeletion() {
    const removed = this.removedPreset;
    if (!removed || this.settings.stylePresets?.[removed.id]) return false;
    if (Object.values(this.settings.stylePresets || {}).some(({ name }) =>
      name?.toLocaleLowerCase() === removed.preset.name?.toLocaleLowerCase())) {
      new Notice(this.t("notice.duplicateName"));
      return false;
    }
    this.settings.stylePresets = { ...this.settings.stylePresets, [removed.id]: removed.preset };
    this.removedPreset = null;
    if (removed.wasActive && this.settings.activeStylePreset === "__current__") this.settings.activeStylePreset = removed.id;
    this.settings.stylePresetDirty = this.stylePresetChanges().length > 0;
    await this.saveData(this.settings);
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
    for (const [id, fallbackVariable] of SURFACE_COLORS) {
      this.themeCatalog.settings.push({
        id, title: id, type: "variable-themed-color", format: "hex", opacity: true,
        fallbackVariable, "default-light": "#00000000", "default-dark": "#00000000",
        ...(id === "bysan-review-panel-bg" && {
          liveDefault: mode => this.settings.themeSettings?.["bysan-right-pane-bg"]?.[mode]
        })
      });
    }
    this.themeCatalog.settings.push(
      { id: "ahn-number-color", title: "Heading number colour", type: "variable-themed-color", format: "hex",
        opacity: true, "default-light": "#6495ed", "default-dark": "#6495ed" },
      { id: "bysan-heading-number-gap", title: "Heading number gap", type: "variable-number",
        format: "em", default: 0.55, min: 0, max: 2, step: 0.05 },
      { id: "list-colorful-marker", title: "Automatic bullet base colour", type: "variable-themed-color",
        format: "hex", opacity: true, "default-light": "#fd4949", "default-dark": "#ff8686" },
      { id: "bysan-code-block-font", title: "Code block font", type: "variable-text" },
      { id: "bysan-inline-code-font", title: "Inline code font", type: "variable-text" },
      {
        id: "bysan-inline-code-border", title: "Inline code border colour",
        type: "variable-themed-color", format: "hex", opacity: true,
        fallbackVariable: "bysan-code-border",
        liveDefault: mode => this.codeBlockBorderColor(mode)
      }
    );
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
      const stored = this.settings[key];
      const isPointSize = Object.hasOwn(GEOMETRY_FONT_TARGETS, key) && typeof stored === "string" && /^\d+(?:\.\d+)?pt$/.test(stored);
      if (key === "inlineCodeFontSize") body.classList.toggle("bysan-inline-code-point-size", isPointSize);
      if (key === "codeBlockFontSize") body.classList.toggle("bysan-code-block-point-size", isPointSize);
      if (key === "quoteFontSize") body.classList.toggle("bysan-quote-point-size", isPointSize);
      if (isPointSize) {
        body.style.setProperty(property, stored);
        continue;
      }
      const value = Number.isFinite(Number(stored))
        ? Number(stored)
        : fallback;
      body.style.setProperty(property, `${value}${unit}`);
    }

    this.lastDarkMode = body.classList.contains("theme-dark");
    this.applyPalette();
    this.themeControls.applyVariables();
    this.scheduleLineRangeRefresh();
    this.schedulePointRefresh();
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


  codeBlockBorderColor(mode) {
    const dark = mode === "dark";
    return hexToRgba(this.settings[dark ? "codeBorderDark" : "codeBorderLight"], dark ? 0.28 : 0.34);
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
    body.style.setProperty("--bysan-code-border", this.codeBlockBorderColor(dark ? "dark" : "light"));
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
    this.themeControls?.refreshThemedColorControl("bysan-inline-code-border");
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


class BatchSourceEditModal extends Modal {
  constructor(app, plugin, editor, view, kind, build) {
    super(app);
    this.plugin = plugin;
    this.editor = editor;
    this.view = view;
    this.file = view?.file;
    this.original = editor.getValue();
    this.lines = this.original.split("\n");
    this.kind = kind;
    this.build = build;
    this.selections = editor.listSelections().map(({ anchor, head }) =>
      [editor.posToOffset(anchor), editor.posToOffset(head)].sort((a, b) => a - b))
      .filter(([a, b]) => a !== b);
    this.selectedOnly = this.selections.length > 0;
    this.merge = false;
  }

  tr(zh, en) { return this.plugin.language === "zh" ? zh : en; }

  onOpen() {
    const { contentEl } = this;
    this.modalEl.addClass("bysan-source-edit-modal");
    contentEl.createEl("h2", { text: this.kind === "blank"
      ? this.tr("预览空行清理", "Preview blank-line cleanup")
      : this.tr("预览删除源文标题编号", "Preview removal of source heading numbers") });
    contentEl.createEl("p", { text: this.file?.path || this.plugin.t("pdf.currentNote") });
    new Setting(contentEl).setName(this.tr("处理范围", "Scope")).addDropdown(dropdown => {
      dropdown.addOption("all", this.tr("整篇笔记", "Whole note"));
      if (this.selections.length) dropdown.addOption("selection", this.tr("打开时的选区", "Original selection"));
      dropdown.setValue(this.selectedOnly ? "selection" : "all").onChange(value => {
        this.selectedOnly = value === "selection"; this.renderDiff();
      });
    });
    if (this.kind === "blank") {
      new Setting(contentEl).setName(this.tr("清理方式", "Cleanup mode"))
        .setDesc(this.tr("合并模式按插件里的保留规则计算；模块内部和会误变标题的空行仍受保护。",
          "Merge mode uses your preservation rules. Internal block and heading-safety separators stay protected."))
        .addDropdown(dropdown => dropdown
          .addOption("safe", this.tr("压缩多余空行，保留段落边界", "Collapse extra blanks; preserve paragraph boundaries"))
          .addOption("merge", this.tr("按保留规则清理，可合并段落", "Use preservation rules; paragraphs may merge"))
          .setValue("safe").onChange(value => { this.merge = value === "merge"; this.renderDiff(); }));
    }
    this.summary = contentEl.createDiv({ attr: { role: "status" } });
    this.list = contentEl.createDiv({ cls: "bysan-source-diff" });
    this.more = contentEl.createEl("button", { text: this.tr("显示更多改动", "Show more changes"), attr: { type: "button" } });
    this.more.addEventListener("click", () => this.appendDiff());
    const actions = contentEl.createDiv({ cls: "bysan-style-switch-actions" });
    const cancel = actions.createEl("button", { text: this.tr("取消", "Cancel"), attr: { type: "button" } });
    cancel.addEventListener("click", () => this.close());
    this.apply = actions.createEl("button", { cls: "mod-cta", attr: { type: "button" } });
    this.apply.addEventListener("click", () => this.commit());
    this.renderDiff();
    cancel.focus();
  }

  renderDiff() {
    this.list.empty();
    this.shown = 0;
    this.rows = this.build(this.original, this.merge).filter(change => {
      if (!this.selectedOnly) return true;
      const from = this.editor.posToOffset(change.from), to = this.editor.posToOffset(change.to);
      return this.selections.some(([start, end]) => start <= from && end >= to);
    }).map(change => ({ change, checked: !change.ambiguous }));
    this.appendDiff();
    this.updateCount();
  }

  appendDiff() {
    const stop = Math.min(this.shown + 75, this.rows.length);
    for (; this.shown < stop; this.shown++) {
      const row = this.rows[this.shown], { change } = row;
      const label = this.list.createEl("label", { cls: "bysan-source-diff-item" });
      const input = label.createEl("input", { attr: { type: "checkbox" } });
      input.checked = row.checked;
      input.addEventListener("change", () => { row.checked = input.checked; this.updateCount(); });
      const body = label.createDiv();
      body.createEl("strong", { text: this.tr(`第 ${change.from.line + 1} 行`, `Line ${change.from.line + 1}`) +
        (change.ambiguous ? this.tr(" · 可能是年份或标题内容，默认不选", " · May be a year or part of the title; not selected") : "") });
      const context = this.kind === "blank" ? 1 : 0;
      const start = Math.max(0, change.from.line - context);
      const stop = Math.min(change.to.line + context, this.lines.length - 1);
      const before = this.lines.slice(start, stop + 1).join("\n");
      const offset = (pos) => this.lines.slice(start, pos.line).reduce((n, line) => n + line.length + 1, 0) + pos.ch;
      const after = before.slice(0, offset(change.from)) + change.text + before.slice(offset(change.to));
      const cols = body.createDiv({ cls: "bysan-source-diff-columns" });
      for (const [text, name] of [[before, this.tr("原文", "Before")], [after, this.tr("修改后", "After")]]) {
        const col = cols.createDiv();
        col.createSpan({ text: name });
        col.createEl("pre", { text: text.split("\n").map(line => line.trim() ? line : "⏎").join("\n") });
      }
    }
    this.more.hidden = this.shown === this.rows.length;
  }

  updateCount() {
    const count = this.rows.filter(row => row.checked).length;
    this.summary.setText(this.tr(`候选 ${this.rows.length} 处，选中 ${count} 处。应用后可以整体撤销。`,
      `${count} of ${this.rows.length} changes selected. Apply as one undo step.`));
    this.apply.setText(this.tr(`应用 ${count} 处改动`, `Apply ${count} change(s)`));
    this.apply.disabled = !count;
  }

  commit() {
    if (this.view?.file !== this.file || this.editor.getValue() !== this.original || !this.view?.containerEl?.isConnected) {
      this.summary.setText(this.tr("笔记已变化，未执行；请重新打开预览。", "The note changed. Reopen the preview before applying changes."));
      this.apply.disabled = true;
      return;
    }
    const changes = this.rows.filter(row => row.checked).map(({ change: { from, to, text } }) => ({ from, to, text }));
    if (!changes.length) return;
    this.editor.transaction({ changes }, "bysan.batch-cleanup");
    this.close();
    new Notice(this.tr(`已应用 ${changes.length} 处改动；可整体撤销。`, `Applied ${changes.length} change(s); undo takes one step.`));
  }
}

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
    if (activePreset) this.plugin.styleSettingTab.renderPresetDiff(contentEl, activeId);

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
    const previousScroll = containerEl.scrollTop;
    const { style } = containerEl;
    const previousDisplay = style.getPropertyValue("display");
    const previousPriority = style.getPropertyPriority("display");
    // Keep CSS inheritance for the live samples and pt controls, but suppress
    // layout while building all sections (including those used by global search).
    style.setProperty("display", "none", "important");
    try {
      this.renderSettings(containerEl);
    } finally {
      if (previousDisplay) style.setProperty("display", previousDisplay, previousPriority);
      else style.removeProperty("display");
    }
    containerEl.scrollTop = this.comparisonReturnScroll ?? previousScroll;
    this.comparisonReturnScroll = null;
    this.restoreSettingFocus();
    this.refreshCurrentSection();
  }

  renderSettings(containerEl) {
    const zh = this.plugin.language === "zh";
    this.sampleComponent?.unload();
    this.sampleComponent = new Component();
    this.sampleComponent.load();
    containerEl.empty();
    containerEl.addClass("bysan-style-settings");

    new Setting(containerEl).setName("Bysan Style Controller").setHeading().settingEl.addClass("bysan-settings-title");

    this.plugin.themeControls.beginRegionRender();
    this.renderSectionNavigation(containerEl);
    const areas = containerEl.createDiv({ cls: "bysan-major-areas" });

    const content = this.createMajorArea(areas, "content", zh ? "笔记样式" : "Notes");
    this.renderEditorRegionSettings(content);

    const styles = this.createMajorArea(areas, "styles", zh ? "界面样式" : "Interface");
    this.createSettingsSection(styles, "interface-colors", zh ? "界面配色与布局" : "Interface colours and layout", body => {
      this.renderInterfaceColors(body);
      this.renderThemeGroups(body, ["general"]);
    });
    this.createSettingsSection(styles, "workspace-background", zh ? "工作区背景" : "Workspace background", body => {
      this.renderWorkspaceSettings(body);
      this.renderThemeGroups(body, ["workspace-background"], false);
    });
    this.createSettingsSection(styles, "workspace-navigation", zh ? "标签页、侧栏与大纲" : "Tabs, sidebars and outline",
      body => this.renderThemeGroups(body, ["tabs", "navigation"]));
    this.createSettingsSection(styles, "workspace-windows", zh ? "窗口、菜单与弹窗" : "Windows, menus and popovers",
      body => this.renderThemeGroups(body, ["window"], false));
    this.createSettingsSection(styles, "canvas-graph", zh ? "白板与图谱" : "Canvas and graph",
      body => this.renderThemeGroups(body, ["canvas", "graph"]));

    const tools = this.createMajorArea(areas, "tools", zh ? "工具与预设" : "Tools and presets");
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
      this.renderThemeGroups(body, ["pdf"], false);
    });
    this.createSettingsSection(tools, "preset", zh ? "风格预设与偏好" : "Presets and preferences", (body) => {
      this.renderStylePresetSettings(body);
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
    this.createSettingsSection(tools, "extensions", zh ? "插件与文档样式" : "Plugins and document styles",
      body => this.renderThemeGroups(body, ["plugins", "documents"]));
    this.balanceControlGrids(containerEl);
    this.setActiveMajorArea(containerEl, this.activeMajorArea || "content", false);
    this.setupSettingFeedback(containerEl);
    this.refreshSettingFeedback();
  }

  compareWithCurrentNote() {
    const note = this.app.workspace.getActiveViewOfType(MarkdownView);
    if (!note?.file) {
      new Notice(this.plugin.language === "zh" ? "请先打开要对照的 Markdown 笔记。"
        : "Open a Markdown note to compare its appearance.");
      return;
    }
    const noteWindow = note.containerEl.ownerDocument.defaultView;
    const settingsWindow = this.containerEl.ownerDocument.defaultView;
    this.pendingComparisonFocus = this.lastSettingFocus;
    // A pop-out can stay open for live comparison. An inline settings modal
    // covers the real note, so close it without touching the workspace leaf.
    if (noteWindow && noteWindow !== settingsWindow && noteWindow.electronWindow?.focus) {
      noteWindow.electronWindow.focus();
    } else {
      this.comparisonReturnScroll = this.containerEl.scrollTop;
      this.app.setting.close();
      noteWindow?.focus();
    }
  }

  setupSettingFeedback(containerEl) {
    const win = containerEl.ownerDocument.defaultView;
    this.lastSettingFocus = null;
    this.feedbackRows = [];
    const bind = (selector, en, zh, test) => {
      for (const row of containerEl.querySelectorAll(selector)) {
        const hint = row.querySelector(".setting-item-info")?.createDiv({ text: this.plugin.language === "zh" ? zh : en,
          cls: "bysan-effect-note" });
        if (hint) this.feedbackRows.push({ hint, test });
      }
    };
    const themed = id => {
      const item = this.plugin.themeControls.controlItems.find(x => x.id === id);
      return item && this.plugin.themeControls.valueFor(item);
    };
    bind('[data-bysan-setting-keys~="tableStripeLight"]', "Saved, but zebra stripes are off.",
      "配色已配置；打开「启用表格斑马纹」后生效。", () => !this.plugin.settings.tableZebra);
    bind('[data-bysan-setting-id="paragraph-spacing"]', "Turn on Reading paragraph spacing to apply this value.",
      "开启「阅读模式段间距」后生效。", () => !themed("toggle-paragraph-spacing"));
    bind('[data-bysan-setting-id="bysan-inline-code-border"]', "Inherits the code block border unless overridden.",
      "未自定义时跟随代码块边框。", () => {
        const mode = document.body.classList.contains("theme-dark") ? "dark" : "light";
        return !this.plugin.settings.themeSettings?.["bysan-inline-code-border"]?.[mode];
      });
    for (let level = 1; level <= 6; level++) bind(`[data-bysan-setting-id="h${level}-bg-color"]`,
      `Enable Show H${level} background to apply this colour.`, `开启「显示 H${level} 背景」后生效。`,
      () => !themed(`header-${level}-background`));
    this.sampleComponent.registerDomEvent(containerEl, "focusin", event => {
      const row = event.target.closest(".bysan-major-area .setting-item:not(.setting-item-heading)");
      if (row) this.lastSettingFocus = this.settingFocusFor(row, event.target);
    });
    this.sampleComponent.registerDomEvent(win, "focus", () => {
      if (this.pendingComparisonFocus) this.restoreSettingFocus();
    });
    this.sampleComponent.registerEvent(this.app.workspace.on("active-leaf-change", () => this.refreshSettingFeedback()));
    this.sampleComponent.registerEvent(this.app.workspace.on("file-open", () => this.refreshSettingFeedback()));
    this.sampleComponent.registerEvent(this.app.workspace.on("layout-change", () => this.refreshNoteComparison()));
    this.sampleComponent.registerDomEvent(containerEl, "scroll", () => this.refreshCurrentSection());
    const nav = containerEl.querySelector(".bysan-settings-nav");
    const observer = new win.ResizeObserver(() => {
      containerEl.style.setProperty("--bysan-settings-nav-size", `${nav.offsetHeight + 10}px`);
      this.refreshCurrentSection();
    });
    observer.observe(nav);
    this.sampleComponent.register(() => observer.disconnect());
  }

  refreshCurrentSection() {
    const root = this.containerEl;
    const selector = root.querySelector?.(".bysan-settings-jump");
    const active = root.querySelector?.(".bysan-major-area.is-active");
    if (!selector || !active || !root.getClientRects().length) return;
    const base = root.getBoundingClientRect().top + (root.querySelector(".bysan-settings-nav")?.offsetHeight || 0) + 28;
    let result = active.firstElementChild;
    for (const section of active.children) {
      if (section.getBoundingClientRect().top > base) break;
      result = section;
    }
    if (result?.id) selector.value = result.id;
  }

  refreshNoteComparison() {
    const button = this.compareButton;
    if (!button?.isConnected) return;
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);
    const name = view?.file?.basename;
    const zh = this.plugin.language === "zh";
    const mode = view?.getMode() === "preview" ? (zh ? "阅读" : "Reading") :
      (view?.getState?.().source ?? view?.currentMode?.sourceMode) ? (zh ? "源码" : "Source") : (zh ? "实时预览" : "Live Preview");
    const details = this.compareTarget;
    const label = name ? `${name} · ${mode}` : zh ? "未打开笔记" : "No note";
    if (details.textContent !== label) details.setText(label);
    button.title = name ? `${view.file.path} · ${mode}` : label;
    button.disabled = !name;
  }

  refreshSettingFeedback() {
    if (!this.feedbackStatus?.isConnected) return;
    const zh = this.plugin.language === "zh";
    const plugin = this.plugin;
    const mode = document.body.classList.contains("theme-dark") ? "dark" : "light";
    this.containerEl.dataset.bysanMode = mode;
    this.modeStatus.setText(zh ? `样例：${mode === "dark" ? "深色" : "浅色"}；另一模式切换后生效` :
      `Sample: ${mode}; the other palette applies in its mode`);
    const count = plugin.stylePresetChanges().length, id = plugin.settings.activeStylePreset;
    const text = count ? (zh ? `已应用 · ${count} 项未写入预设` : `Applied · ${count} not saved to preset`)
      : id === "__current__" ? (zh ? "已应用 · 未选择预设" : "Applied · no preset selected") :
        (zh ? "已应用 · 与预设一致" : "Applied · matches preset");
    if (this.feedbackStatus.textContent !== text) this.feedbackStatus.setText(text);
    this.undoButton.disabled = !plugin.styleEdits.length;
    if (this.presetStatus?.isConnected) this.presetStatus.setText(`${plugin.stylePresetLabel(id)} · ${text}`);
    for (const { hint, test } of this.feedbackRows ?? []) hint.hidden = !test();
    this.refreshNoteComparison();
  }

  settingFocusFor(row, target = null) {
    const rows = [...row.parentElement.closest("[data-bysan-major-area]").querySelectorAll(".setting-item")];
    return { area: row.closest("[data-bysan-major-area]").dataset.bysanMajorArea,
      id: row.dataset.bysanSettingId, keys: row.dataset.bysanSettingKeys, rowIndex: rows.indexOf(row),
      inputIndex: [...row.querySelectorAll("input,select,button,[tabindex]")].indexOf(target) };
  }

  restoreSettingFocus() {
    const detail = this.pendingComparisonFocus;
    this.pendingComparisonFocus = null;
    if (!detail || detail.area !== this.activeMajorArea) return;
    const rows = [...this.containerEl.querySelectorAll(".bysan-major-area.is-active .setting-item")];
    const row = (detail.id || detail.keys) && rows.find(candidate => !candidate.closest("[hidden]") &&
      (detail.id ? candidate.dataset.bysanSettingId === detail.id : candidate.dataset.bysanSettingKeys === detail.keys));
    (row || rows[detail.rowIndex])?.querySelectorAll("input,select,button,[tabindex]")[Math.max(0, detail.inputIndex)]
      ?.focus({ preventScroll: true });
  }

  balanceControlGrids(containerEl) {
    for (const grid of containerEl.querySelectorAll(".bysan-theme-grid, .bysan-feature-group-body:has(> .setting-item)")) {
      const themeGrid = grid.classList.contains("bysan-theme-grid");
      const rows = [...grid.children].map(row => {
        const description = row.querySelector(":scope > .setting-item-info .setting-item-description")?.textContent || "";
        const textLength = [...description].reduce((length, char) => length + (/[^\u0000-\u00ff]/.test(char) ? 2 : 1), 0);
        const wide = !row.matches(".setting-item") || textLength > 80 ||
          (!themeGrid && row.matches(".bysan-dual-mode-setting, :has(.setting-item-control button + button)"));
        row.classList.toggle("bysan-grid-wide", wide);
        const mediumWide = themeGrid && row.matches(".bysan-color-row:has(.bysan-value-stepper), .bysan-theme-pair");
        return {row, wide, mediumWide};
      });
      // Complete each short run before a wide row without reordering controls
      // (unlike dense grid placement, the keyboard order stays visual).
      for (const fit of ["medium", "roomy"]) {
        const orphan = `bysan-grid-fill-${fit}`;
        let pending = null;
        for (const {row, wide, mediumWide} of rows) {
          if (wide || (fit === "medium" && mediumWide)) {
            pending?.classList.add(orphan);
            pending = null;
          } else pending = pending ? null : row;
        }
        pending?.classList.add(orphan);
      }
    }
  }

  hide() {
    this.sampleComponent?.unload();
    this.sampleComponent = null;
  }


  renderThemeGroups(containerEl, ids, withTitle = true, include) {
    for (const id of ids) {
      this.renderThemeSample(containerEl, id);
      if (id === "tabs") this.renderNoteThemeControls(containerEl, TAB_COLOR_CONTROLS);
      if (id === "navigation") this.renderNoteThemeControls(containerEl, NAVIGATION_COLOR_CONTROLS);
      this.plugin.themeControls.renderGroup(containerEl, id, COMMON_THEME_IDS, withTitle,
        id === "marks" ? panel => this.renderTagSample(panel) : null, include);
    }
  }

  renderTagSample(containerEl) {
    const zh = this.plugin.language === "zh";
    this.renderCompactSample(containerEl, "tags", zh ? "标签预览" : "Tag preview", sample => {
      for (const [type, label] of [
        ["active", zh ? "笔记中实际显示" : "Shown in notes"],
        ["palette", zh ? "彩色方案（未启用）" : "Colour scheme (not active)"]
      ]) {
        const line = sample.createDiv({ cls: `bysan-tag-example bysan-tag-example-${type}` });
        line.createSpan({ cls: "bysan-preview-caption", text: label });
        const tags = line.createSpan({ cls: "bysan-example-tags" });
        for (let index = 1; index <= 5; index++) {
          const tag = tags.createEl("a", { cls: "tag", text: `#${zh ? "标签" : "tag"}${index}` });
          if (type === "palette") tag.style.setProperty("--bysan-sample-tag-bg", `var(--tag${index})`);
        }
        if (type === "active") {
          const heading = line.createEl("h6", { text: zh ? "标题 " : "Heading " });
          heading.createEl("a", { cls: "tag", text: zh ? "#上标" : "#superscript" });
        }
      }
      sample.createDiv({ cls: "bysan-tag-palette-hint bysan-preview-caption", text: zh
        ? "选中下方「标签样式 → 自定义彩色标签」才会应用标签颜色 1–5。"
        : "Select “Tag style → Custom colourful tags” below to use colours 1–5 in notes." });
    });
  }

  renderCompactSample(containerEl, id, label, render) {
    const box = containerEl.createDiv({ cls: "bysan-compact-preview", attr: { "data-bysan-preview": id } });
    box.createDiv({ cls: "bysan-preview-caption", text: label });
    const content = box.createDiv({ cls: "markdown-rendered bysan-compact-preview-content" });
    render(content);
  }

  renderThemeSample(containerEl, id) {
    const zh = this.plugin.language === "zh";
    const tr = (cn, en) => zh ? cn : en;
    const specs = {
      tabs: [tr("标题栏与标签页示意", "Title bar and tabs sample"), sample => {
        const bar = sample.createDiv({ cls: "bysan-sample-tabstrip bysan-example-titlebar workspace-tab-header-container" })
          .createDiv({ cls: "workspace-tab-header-container-inner" });
        for (const [label, active] of [[tr("当前笔记", "Active note"), true], [tr("其他笔记", "Other note"), false]]) {
          const tab = bar.createDiv({ cls: `workspace-tab-header${active ? " is-active bysan-example-tab" : ""}` });
          tab.createDiv({ cls: "workspace-tab-header-inner" })
            .createDiv({ cls: "workspace-tab-header-inner-title", text: label });
        }
      }],
      navigation: [tr("文件树与大纲示意", "File tree and outline sample"), sample => {
        const row = sample.createDiv({ cls: "bysan-sample-nav" });
        const tree = row.createDiv({ cls: "bysan-example-left" }).createDiv({ cls: "nav-files-container" });
        const folder = tree.createDiv({ cls: "tree-item nav-folder" });
        folder.createDiv({ cls: "nav-folder-title tree-item-self", attr: { "data-path": "Sample" } })
          .createDiv({ cls: "nav-folder-title-content", text: tr("▾ 示例文件夹", "▾ Sample folder") });
        const childTree = folder.createDiv({ cls: "tree-item-children nav-folder-children" });
        childTree.createDiv({ cls: "tree-item nav-file" })
          .createDiv({ cls: "nav-file-title tree-item-self is-active bysan-example-file", attr: { "data-path": "Sample/Note.md" } })
          .createDiv({ cls: "nav-file-title-content", text: tr("当前笔记", "Active note") });
        const outline = row.createDiv({ cls: "bysan-example-right outline" });
        const item = outline.createDiv({ cls: "tree-item" });
        item.createDiv({ cls: "tree-item-self" }).createDiv({ cls: "tree-item-inner", text: tr("1. 一级标题", "1. Section") });
        const child = item.createDiv({ cls: "tree-item-children" });
        child.createDiv({ cls: "tree-item-self" }).createDiv({ cls: "tree-item-inner", text: tr("1.1 二级标题", "1.1 Subsection") });
      }],
      window: [tr("菜单与悬浮预览的样式示意", "Menu and popover style sample"), sample => {
        const row = sample.createDiv({ cls: "bysan-sample-window" });
        const menu = row.createDiv({ cls: "bysan-sample-menu" });
        menu.createDiv({ cls: "menu-item", text: tr("打开笔记", "Open note") });
        menu.createDiv({ cls: "menu-item selected", text: tr("当前菜单项", "Selected item") });
        row.createDiv({ cls: "bysan-sample-popover", text: tr("链接悬浮预览", "Link popover") });
      }],
      embeds: [tr("图片与嵌入示意", "Image and embed sample"), sample => {
        const row = sample.createDiv({ cls: "bysan-sample-embeds" });
        const image = row.createSpan({ cls: "internal-embed image-embed is-loaded" });
        image.createEl("img", { attr: {
          alt: tr("图片示例", "Sample image"),
          src: "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 120 48'%3E%3Crect width='120' height='48' fill='%23d8edf5'/%3E%3Ccircle cx='96' cy='13' r='6' fill='%23edaa4f'/%3E%3Cpath d='M0 48L32 16 52 34 73 12 120 48Z' fill='%23479b89'/%3E%3C/svg%3E"
        } });
        const embed = row.createDiv({ cls: "markdown-embed" });
        embed.createDiv({ cls: "markdown-embed-title", text: tr("嵌入笔记", "Embedded note") });
        embed.createDiv({ cls: "markdown-embed-content", text: tr("另一篇笔记的内容", "Content from another note") });
      }],
      canvas: [tr("白板底色与网格示意", "Canvas background and grid sample"), sample => {
        const canvas = sample.createDiv({ cls: "bysan-sample-canvas" });
        canvas.createSpan({ text: tr("卡片", "Card") });
        canvas.createSpan({ cls: "bysan-sample-canvas-link", text: "→" });
        canvas.createSpan({ text: tr("关联笔记", "Linked note") });
      }],
      graph: [tr("图谱节点与连线配色示意", "Graph colours sample"), sample => {
        const graph = sample.createDiv({ cls: "bysan-sample-graph" });
        for (const [kind, label] of [["circle", tr("笔记", "Note")], ["tag", tr("标签", "Tag")], ["attach", tr("附件", "Attachment")], ["unresolved", tr("未创建", "Unresolved")]]) {
          const node = graph.createSpan({ cls: "bysan-sample-graph-node", text: label });
          node.style.setProperty("--bysan-sample-node", `var(--graph-${kind})`);
        }
      }]
    };
    if (Object.hasOwn(specs, id)) this.renderCompactSample(containerEl, id, ...specs[id]);
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


  setActiveMajorArea(containerEl, id, scroll = true) {
    const available = [...containerEl.querySelectorAll("[data-bysan-major-area]")];
    const selected = available.some((area) => area.dataset.bysanMajorArea === id)
      ? id
      : "content";
    this.areaScroll ||= {};
    if (this.activeMajorArea && this.activeMajorArea !== selected) this.areaScroll[this.activeMajorArea] = containerEl.scrollTop;
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
      button.tabIndex = active ? 0 : -1;
    }
    const jump = containerEl.querySelector(".bysan-settings-jump");
    const zh = this.plugin.language === "zh";
    if (jump) {
      jump.empty();
      jump.createEl("option", { text: zh ? "跳到分组" : "Jump to section", attr: { value: "" } });
      for (const section of available.find(area => !area.hidden).querySelectorAll(":scope > .bysan-settings-section")) {
        jump.createEl("option", { text: section.dataset.bysanSectionLabel, attr: { value: section.id } });
      }
    }
    if (scroll) {
      containerEl.scrollTop = this.areaScroll[selected] || 0;
    }
    this.refreshCurrentSection();
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
    const zh = this.plugin.language === "zh";
    const areas = [["content", zh ? "笔记样式" : "Notes"], ["styles", zh ? "界面样式" : "Interface"], ["tools", zh ? "工具与预设" : "Tools and presets"]];
    const navigation = containerEl.createEl("nav", {
      cls: "bysan-settings-nav", attr: { "aria-label": this.plugin.t("nav.title") }
    });
    const header = navigation.createDiv({ cls: "bysan-settings-nav-header" });
    const search = header.createEl("input", {
      cls: "bysan-settings-nav-search", attr: { type: "search", placeholder: this.plugin.t("theme.searchPlaceholder"),
        role: "combobox", "aria-autocomplete": "list", "aria-expanded": "false",
        "aria-controls": "bysan-setting-result-list", "aria-label": this.plugin.t("theme.search") }
    });
    search.value = this.settingsQuery || "";
    const jump = header.createEl("select", {
      cls: "bysan-settings-jump", attr: { "aria-label": zh ? "当前分组／跳转" : "Current section / jump" }
    });
    jump.addEventListener("change", () => { if (jump.value) this.jumpToSection(containerEl, jump.value); });
    const searchResults = navigation.createDiv({ cls: "bysan-settings-search-results is-hidden" });
    let matches = [], results = [], active = -1;
    const highlight = index => {
      active = index;
      for (const [i, button] of results.entries()) button.setAttribute("aria-selected", String(i === active));
      if (results[active]) {
        search.setAttribute("aria-activedescendant", results[active].id);
        results[active].scrollIntoView({ block: "nearest" });
      } else search.removeAttribute("aria-activedescendant");
    };
    const hideResults = () => {
      searchResults.classList.add("is-hidden");
      search.setAttribute("aria-expanded", "false");
      search.removeAttribute("aria-activedescendant");
    };
    const jumpToResult = row => {
      if (!row?.isConnected) return;
      hideResults();
      returnSearch.hidden = !search.value.trim();
      const area = row.closest("[data-bysan-major-area]");
      if (area) this.setActiveMajorArea(containerEl, area.dataset.bysanMajorArea, false);
      const headingTarget = row.closest("[data-bysan-heading-target]");
      if (headingTarget) this.selectHeadingTarget(headingTarget.dataset.bysanHeadingTarget);
      const condition = row.closest("[data-bysan-list-conditional]");
      if (condition?.dataset.bysanPreviewMode && condition.hidden) {
        containerEl.querySelector(`.bysan-list-preview-bar button[data-mode="${condition.dataset.bysanPreviewMode}"]`)?.click();
      }
      if (condition?.hidden) {
        const gate = condition.closest(".bysan-appearance-controls").querySelector(
          `[data-bysan-setting-id="${condition.dataset.bysanPrerequisiteId}"]`);
        const reason = condition.dataset.bysanPrerequisite;
        if (reason) new Notice(reason);
        this.focusRow(gate && !gate.closest("[hidden]") ? gate : condition.closest(".bysan-appearance-controls"));
      } else this.focusRow(row);
    };
    const renderSearchResults = () => {
      this.settingsQuery = search.value;
      searchResults.empty();
      matches = this.plugin.themeControls.filterRows(containerEl, search.value);
      results = [];
      returnSearch.hidden = true;
      if (!search.value.trim()) { hideResults(); return; }
      searchResults.classList.remove("is-hidden");
      search.setAttribute("aria-expanded", "true");
      const toggleResultNotice = matches.length ? (zh ? `找到 ${matches.length} 项` : `${matches.length} results`) :
        (zh ? "没有匹配的设置" : "No matching settings");
      searchResults.createDiv({ cls: "bysan-settings-search-summary", text: toggleResultNotice, attr: { role: "status" } });
      const list = searchResults.createDiv({ cls: "bysan-settings-search-list", attr: { id: "bysan-setting-result-list", role: "listbox" } });
      results = matches.slice(0, 16).map((row, i) => {
        const name = row.querySelector(".setting-item-name")?.textContent?.trim() || row.textContent.trim();
        const button = list.createEl("button", { cls: "bysan-settings-search-result",
          attr: { type: "button", role: "option", id: `bysan-setting-result-${i}`, "aria-selected": "false" } });
        button.createSpan({ cls: "bysan-settings-search-result-name", text: name });
        const condition = row.closest("[data-bysan-list-conditional][hidden]");
        const path = [
          row.closest("[data-bysan-major-area]")?.getAttribute("aria-label"),
          row.closest("[data-bysan-section-label]")?.dataset.bysanSectionLabel,
          condition?.dataset.bysanPrerequisite
        ].filter(Boolean).join(" › ");
        if (path) button.createSpan({ cls: "bysan-settings-search-result-desc", text: path });
        button.addEventListener("click", () => jumpToResult(row));
        return button;
      });
      if (matches.length > results.length) searchResults.createDiv({
        cls: "bysan-settings-search-more", text: zh ? "继续输入以缩小范围" : "Keep typing to narrow the results"
      });
      highlight(-1);
    };

    const tabs = navigation.createDiv({ cls: "bysan-major-tabs", attr: { role: "tablist" } });
    const tabButtons = areas.map(([id, label]) => {
      const button = tabs.createEl("button", { cls: "bysan-major-tab", text: label,
        attr: { type: "button", role: "tab", "data-area": id } });
      button.addEventListener("click", () => this.setActiveMajorArea(containerEl, id));
      return button;
    });
    tabs.addEventListener("keydown", event => {
      if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
      const current = tabButtons.indexOf(event.target);
      if (current < 0) return;
      const next = event.key === "Home" ? 0 : event.key === "End" ? tabButtons.length - 1 :
        (current + (event.key === "ArrowRight" ? 1 : -1) + tabButtons.length) % tabButtons.length;
      event.preventDefault(); tabButtons[next].click(); tabButtons[next].focus();
    });

    const tools = navigation.createDiv({ cls: "bysan-settings-quick-bar" });
    this.compareButton = tools.createEl("button", { cls: "bysan-settings-compare", attr: { type: "button" } });
    this.compareButton.createSpan({ text: zh ? "对照笔记" : "Compare note" });
    this.compareTarget = this.compareButton.createSpan({ cls: "bysan-settings-compare-target" });
    this.compareButton.addEventListener("click", () => this.compareWithCurrentNote());
    this.undoButton = tools.createEl("button", { text: zh ? "撤销样式调整" : "Undo style change", attr: { type: "button" } });
    this.undoButton.addEventListener("click", async () => {
      const scroll = containerEl.scrollTop;
      this.pendingComparisonFocus = this.lastSettingFocus;
      if (await this.plugin.undoStyleEdit()) {
        this.comparisonReturnScroll = scroll;
        this.display();
      }
    });
    const returnSearch = tools.createEl("button", { text: zh ? "返回搜索结果" : "Back to results", attr: { type: "button" } });
    returnSearch.hidden = !search.value.trim();
    returnSearch.addEventListener("click", () => { renderSearchResults(); search.focus({ preventScroll: true }); });
    const status = navigation.createDiv({ cls: "bysan-settings-feedback" });
    this.modeStatus = status.createSpan();
    this.feedbackStatus = status.createSpan({ attr: { role: "status" } });

    search.addEventListener("input", event => { if (!event.isComposing) renderSearchResults(); });
    search.addEventListener("compositionend", renderSearchResults);
    search.addEventListener("keydown", event => {
      if (event.isComposing || event.keyCode === 229) return;
      if (event.key === "Escape" && !searchResults.classList.contains("is-hidden")) {
        event.preventDefault(); hideResults(); returnSearch.hidden = !search.value.trim(); return;
      }
      if (["ArrowDown", "ArrowUp"].includes(event.key) && search.value.trim()) {
        event.preventDefault();
        if (searchResults.classList.contains("is-hidden")) renderSearchResults();
        if (!results.length) return;
        highlight(active < 0 ? (event.key === "ArrowDown" ? 0 : results.length - 1) :
          (active + (event.key === "ArrowDown" ? 1 : -1) + results.length) % results.length);
      } else if (event.key === "Enter" && matches.length && !searchResults.classList.contains("is-hidden")) {
        event.preventDefault(); jumpToResult(matches[Math.max(0, active)]);
      }
    });
  }

  focusRow(row) {
    if (!row) return;
    const win = row.ownerDocument.defaultView;
    win.requestAnimationFrame(() => {
      if (!row.isConnected) return;
      row.scrollIntoView({ behavior: "auto", block: "center" });
      row.classList.add("bysan-search-target");
      const control = [...row.querySelectorAll(".setting-item-control :is(button,input,select,[tabindex])")]
        .find(el => el.getClientRects().length && !el.disabled && el.tabIndex >= 0);
      (control || row).focus({ preventScroll: true });
      win.setTimeout(() => row.classList.remove("bysan-search-target"), 1800);
    });
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
        this.createFeatureGroup(group, zh ? "文档评论面板配色" : "Document comments panel colours",
          zh ? "启用「选区审阅工具栏」后生效。只调整评论面板，不影响评论角标或弹窗。"
            : "With Selection review toolbar on, styles the comments panel without affecting badges or comment windows.", panel => {
            const controls = this.createAppearanceLayout(panel, sample => {
              const review = sample.createDiv({ cls: "bysan-review-sample" });
              const title = review.createDiv({ cls: "art-review-sidebar-title" });
              setIcon(title.createSpan({ cls: "art-review-sidebar-title-icon" }), "message-square");
              title.createSpan({ text: zh ? "文档评论" : "Document comments" });
              review.createDiv({ cls: "art-review-sidebar-empty", text: zh ? "当前文档还没有评论。" : "No comments in this note." });
              review.createDiv({ cls: "art-review-sidebar-card" })
                .createDiv({ cls: "art-review-sidebar-preview", text: zh ? "一条示例评论" : "An example comment" });
            }, false, false);
            this.renderNoteThemeControls(controls, REVIEW_PANEL_CONTROLS);
          });
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

    const presets = this.plugin.settings.stylePresets || {};
    const activeId = this.plugin.settings.activeStylePreset || "__current__";
    const activePreset = presets[activeId];
    const activeLabel = activeId === "__default__"
      ? this.plugin.t("preset.default")
      : activePreset?.name || this.plugin.t("preset.currentUnsavedLong");
    const stateLabel = this.plugin.settings.stylePresetDirty
      ? this.plugin.t("preset.modified")
      : this.plugin.t("preset.saved");

    this.presetStatus = new Setting(containerEl)
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
      }).descEl;

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
          .onClick(() => this.confirmPresetOverwrite(activeId, activePreset.name)))
        .addButton((button) => button
          .setButtonText(this.plugin.t("preset.delete"))
          .setWarning()
          .onClick(async () => {
            if (await this.plugin.deleteStylePreset(activeId)) this.display();
          }));
    }
    if (this.plugin.removedPreset) {
      const zh = this.plugin.language === "zh";
      new Setting(containerEl).setName(zh ? "最近删除的预设" : "Last deleted preset")
        .setDesc(this.plugin.removedPreset.preset.name)
        .addButton(button => button.setButtonText(zh ? "撤销删除" : "Undo deletion")
          .onClick(async () => { if (await this.plugin.undoPresetDeletion()) this.display(); }));
    }
  }

  renderPresetDiff(container, id) {
    const zh = this.plugin.language === "zh";
    const changes = this.plugin.stylePresetChanges(id);
    container.createEl("p", { text: zh ? `${changes.length} 项样式值不同。` : `${changes.length} style values differ.` });
    const list = container.createEl("ul", { cls: "bysan-preset-diff" });
    const valueText = value => value === undefined ? zh ? "继承默认" : "Inherit default" :
      typeof value === "object" ? JSON.stringify(value) : String(value);
    for (const { key, from, to } of changes.slice(0, 16)) {
      const row = [...this.containerEl.querySelectorAll("[data-bysan-setting-id],[data-bysan-setting-keys]")]
        .find(row => row.dataset.bysanSettingId === key || row.dataset.bysanSettingKeys?.split(" ").includes(key));
      const name = row?.querySelector(".setting-item-name")?.textContent || key;
      list.createEl("li", { text: `${name}：${valueText(from)} → ${valueText(to)}` });
    }
    if (changes.length > 16) list.createEl("li", { text: zh ? `另有 ${changes.length - 16} 项` : `${changes.length - 16} more` });
  }

  confirmPresetOverwrite(id, name) {
    const zh = this.plugin.language === "zh";
    const modal = new Modal(this.app);
    modal.setTitle(zh ? `覆盖「${name}」？` : `Overwrite “${name}”?`);
    this.renderPresetDiff(modal.contentEl, id);
    const actions = modal.contentEl.createDiv({ cls: "bysan-style-switch-actions" });
    const cancel = actions.createEl("button", { text: zh ? "取消" : "Cancel", attr: { type: "button" } });
    cancel.addEventListener("click", () => modal.close());
    const confirm = actions.createEl("button", { cls: "mod-cta", text: zh ? "覆盖此预设" : "Overwrite this preset", attr: { type: "button" } });
    confirm.addEventListener("click", async () => {
      if (this.plugin.settings.activeStylePreset !== id) { modal.close(); return; }
      if (await this.plugin.overwriteActiveStylePreset()) {
        modal.close();
        this.display();
      }
    });
    modal.open();
    cancel.focus();
  }


  renderWorkspaceSettings(containerEl) {
    const heading = new Setting(containerEl).setName(this.plugin.t("section.workspace")).setHeading();
    heading.settingEl.id = "bysan-section-workspace";

    this.addToggle(containerEl, this.plugin.t("workspace.dynamic"), this.plugin.t("workspace.dynamicDesc"), "workspaceBackground");
    this.addToggle(containerEl, this.plugin.t("workspace.lineRanges"), this.plugin.t("workspace.lineRangesDesc"), "collapsedLineRanges");

    const backgrounds = new Setting(containerEl)
      .setName(this.plugin.t("workspace.backgrounds"));
    this.addModeSelect(backgrounds, "light", () => backgrounds.addDropdown((dropdown) => dropdown
        .addOption("background-settings-workplace-theme-light-in-the-note", this.plugin.t("background.note"))
        .addOption("background-settings-workplace-waves-light", this.plugin.t("background.waves"))
        .addOption("background-settings-workplace-waves2-light", this.plugin.t("background.animatedWaves"))
        .addOption("background-settings-workplace-theme-light-blue-mountain", this.plugin.t("background.blueMountain"))
        .addOption("background-settings-workplace-theme-light-custom-option", this.plugin.t("background.customUrl"))
        .setValue(this.plugin.settings.lightBackground)
        .onChange((value) => this.plugin.updateSetting("lightBackground", value))));
    this.addModeSelect(backgrounds, "dark", () => backgrounds.addDropdown((dropdown) => dropdown
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
    const controls = this.createAppearanceLayout(containerEl, sample =>
      this.renderMarkdownSample(sample, ["```js", "const n = 42;", "console.log(n);", "```"].join("\n")));
    this.renderNoteThemeControls(controls, [["bysan-code-block-font", "代码块字体", "Code block font"]]);
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
    this.createSettingsSection(containerEl, "note-background", zh ? "笔记背景" : "Note background", body => {
      this.renderNoteBackgroundColors(body);
    });
    this.createSettingsSection(containerEl, "note-colors", zh ? "选区、高亮与链接" : "Selection, highlights and links", body => {
      const controls = this.createAppearanceLayout(body, sample => {
        const page = sample.createDiv({ cls: "bysan-note-colors-example" });
        page.createDiv({ cls: "cm-line cm-active", text: zh ? "当前编辑行" : "Active editor line" });
        page.createEl("p").createSpan({ cls: "bysan-selection-example", text: zh ? "鼠标选中的文字" : "Selected text" });
        page.createEl("p").createEl("mark", { text: zh ? "Markdown 高亮" : "Markdown highlight", attr: { "data-highlight": "" } });
        const links = page.createEl("p");
        links.createEl("a", { cls: "internal-link", text: zh ? "内链" : "Internal link" });
        links.append(" · ");
        links.createEl("a", { cls: "external-link", text: zh ? "外链" : "External link" });
        links.append(" · ");
        links.createEl("a", { cls: "internal-link is-unresolved", text: zh ? "未创建的链接" : "Uncreated link" });
      }, zh ? "编辑选区示意 · 阅读样例" : "Editor selection illustration · Reading sample");
      this.renderNoteThemeControls(controls, EDITOR_MARK_CONTROLS);
      this.renderNoteThemeControls(controls, NOTE_MARK_CONTROLS);
      this.renderThemeGroups(body, ["marks"], false);
      this.renderColourHighlightSettings(body);
      this.renderClozeSettings(body);
    });
    this.createSettingsSection(containerEl, "headings", zh ? "页面标题与文内标题" : "Page title and headings",
      body => this.renderHeadingSettings(body));
    this.createSettingsSection(containerEl, "body-text", zh ? "正文、字体与公式" : "Text, fonts and math", (body) => {
      const controls = this.createAppearanceLayout(body, sample => this.renderMarkdownSample(sample, zh
        ? "这一段展示正文字体、颜色、行高和首行缩进。\n\n第二段用于比较段落间距。**粗体** / *斜体*"
        : "This paragraph shows the body font, colour, line height and first-line indent.\n\nThis paragraph shows paragraph spacing. **Bold** / *Italic*"));
      this.addFontSizeSetting(controls, zh ? "正文字号" : "Body font size",
        zh ? "恢复后跟随 Obsidian 的字体大小。" : "Reset to follow Obsidian’s font size.",
        "noteFontSize", ".markdown-rendered", "px",
        () => parseFloat(getComputedStyle(document.body).getPropertyValue("--font-text-size")) || 16);
      this.renderNoteThemeControls(controls, NOTE_BODY_CONTROLS);
      this.renderGeometryControls(controls, "strong");
      this.renderThemeGroups(controls, ["typography"], false);
      this.createFeatureGroup(body, zh ? "公式" : "Math", "", group => this.renderMathSettings(group));
    });
    this.createSettingsSection(containerEl, "text-details", zh ? "列表、任务与分隔线" : "Lists, tasks and dividers", (body) => {
      this.renderTextDetailSettings(body);
    });
    this.createSettingsSection(containerEl, "code", zh ? "代码" : "Code", (body) => {
      this.createFeatureGroup(body, zh ? "代码块" : "Code block", "", group => this.renderCodeSettings(group));
      this.createFeatureGroup(body, zh ? "行内代码" : "Inline code", "", group => this.renderInlineCodeSettings(group));
    });
    this.createSettingsSection(containerEl, "blocks", zh ? "表格、引用与提示框" : "Tables, quotes and callouts", (body) => {
      this.createFeatureGroup(body, zh ? "表格" : "Tables", "", group => this.renderTableSettings(group));
      this.createFeatureGroup(body, zh ? "引用块" : "Blockquotes", "", group => this.renderQuoteSettings(group));
      this.createFeatureGroup(body, zh ? "提示框" : "Callouts", "", group => {
        const controls = this.createAppearanceLayout(group, sample =>
          this.renderMarkdownSample(sample, zh ? "> [!note] 提示框\n> 提示框内容" : "> [!note] Callout\n> Callout body"));
        this.renderNoteThemeControls(controls, CALLOUT_CONTROLS);
        this.renderThemeGroups(controls, ["blocks"], false);
      });
    });
    this.createSettingsSection(containerEl, "embeds", zh ? "图片、嵌入与 Mermaid" : "Images, embeds and Mermaid",
      body => this.renderThemeGroups(body, ["embeds"], false));
  }

  renderClozeSettings(containerEl) {
    const zh = this.plugin.language === "zh";
    const language = zh ? 0 : 1;
    this.createFeatureGroup(containerEl, zh ? "答案遮挡（复习用）" : "Hide answers (study)",
      zh ? "先把答案藏起来，复习时再揭晓。只改变样式，不改笔记内容。"
        : "Hide answers while studying and reveal them when needed. This only changes appearance.", group => {
        group.classList.add("bysan-variant-feature");
        this.renderNoteThemeControls(group, [CLOZE_SWITCH]);
        for (const variant of CLOZE_VARIANTS) {
          this.renderSyntaxVariant(group, "cloze", variant.name[language],
            zh ? variant.syntax : variant.syntax.replace("答案", "answer"), variant.controls, (demo, sample) => {
              demo.classList.add("bysan-cloze-demo");
              const prefix = variant.italic ? demo.createEl("em") : demo;
              const wrapper = variant.highlight ? prefix.createEl("mark") : prefix;
              wrapper.createEl("del", {
                text: zh ? "示例答案" : "Example answer",
                attr: { tabindex: "0", title: zh ? "键盘聚焦时也可预览答案" : "Keyboard focus also reveals the answer in this sample" }
              });
              sample.createDiv({ cls: "bysan-preview-caption bysan-cloze-reveal-hint", text: variant.reveal[language] });
              sample.createDiv({ cls: "bysan-preview-caption bysan-cloze-disabled-hint",
                text: zh ? "已停用：显示原来的 Markdown 样式。" : "Off: normal Markdown formatting." });
            });
        }
      });
  }

  renderColourHighlightSettings(containerEl) {
    const zh = this.plugin.language === "zh";
    this.createFeatureGroup(containerEl, zh ? "彩色高亮变体" : "Coloured highlight variants", "", group => {
      group.classList.add("bysan-variant-feature");
      this.renderNoteThemeControls(group, [COLOUR_HIGHLIGHT_SWITCH]);
      for (const variant of COLOUR_HIGHLIGHT_VARIANTS) {
        this.renderSyntaxVariant(group, "colour-highlight", variant.name[zh ? 0 : 1],
          zh ? variant.syntax : variant.syntax.replace("文字", "text"), variant.controls, demo => {
            let node = demo;
            for (const tag of variant.tags) node = node.createEl(tag);
            node.createEl("mark", { text: zh ? "示例文字 Aa" : "Example text Aa" });
          });
      }
    });
  }

  renderSyntaxVariant(group, id, title, syntax, controls, renderDemo) {
    const zh = this.plugin.language === "zh";
    const card = group.createEl("section", { cls: "bysan-syntax-variant" });
    this.renderCompactSample(card, id, title, sample => {
      const format = sample.createDiv({ cls: "bysan-syntax-format" });
      format.createSpan({ text: zh ? "写法" : "Syntax" });
      format.createEl("code", { text: syntax });
      renderDemo(sample.createDiv({ cls: "bysan-syntax-demo" }), sample);
    });
    this.renderNoteThemeControls(card.createDiv({ cls: "bysan-syntax-variant-controls" }), controls);
  }

  renderHeadingSettings(body) {
    const zh = this.plugin.language === "zh";
    const targets = [
      ["title", zh ? "页面标题" : "Page title"],
      ...NOTE_HEADING_CONTROLS.map((_, index) => [String(index + 1), `H${index + 1}`]),
      ["numbering", zh ? "标题编号（所有级别）" : "Heading numbers (all levels)"],
      ["shared", zh ? "通用标题设置" : "Shared heading settings"]
    ];
    new Setting(body).setName(zh ? "调整哪项标题样式" : "Heading style to customise")
      .addDropdown(dropdown => {
        for (const [id, title] of targets) dropdown.addOption(id, title);
        this.headingPicker = dropdown.onChange(value => this.selectHeadingTarget(value));
      });
    const targetFor = id => id.startsWith("inline-title-") || id === "toggle-inline-title-background"
      ? "title" : (/^(?:print-h|header-|h)([1-6])-/.exec(id)?.[1] ?? "shared");
    for (const [id, title] of targets) {
      const panel = body.createDiv({
        cls: "bysan-heading-target", attr: { "data-bysan-heading-target": id }
      });
      const controls = this.createAppearanceLayout(panel, sample => {
        if (id === "title") sample.createDiv({ cls: "mod-header mod-ui" })
          .createDiv({ cls: "inline-title", text: zh ? "笔记名称" : "Note name" });
        else if (id === "numbering") {
          for (const [tag, number, label] of [["h1", "一、", zh ? "章标题" : "Chapter heading"],
            ["h2", "1.1", zh ? "小节标题" : "Section heading"]]) {
            const heading = sample.createDiv({ cls: `el-${tag}` }).createEl(tag, { cls: "bysan-heading-number-sample" });
            heading.createSpan({ cls: "ahn-reading-number", text: number });
            heading.append(label);
          }
        }
        else {
          const tag = id === "shared" ? "h2" : `h${id}`;
          sample.createDiv({ cls: `el-${tag}` }).createEl(tag, {
            text: id === "shared" ? (zh ? "文内标题" : "Section heading") : title
          });
        }
      });
      if (id === "title") this.renderNoteThemeControls(controls, PAGE_TITLE_CONTROLS);
      else if (id === "numbering") this.renderNoteThemeControls(controls, HEADING_NUMBER_CONTROLS);
      else if (id !== "shared") this.renderNoteThemeControls(controls,
        [...NOTE_HEADING_CONTROLS[Number(id) - 1], ...HEADING_BACKGROUND_CONTROLS[Number(id) - 1]]);
      this.renderThemeGroups(controls, ["headings"], false, itemId => targetFor(itemId) === id);
    }
    this.selectHeadingTarget(this.headingTarget || "1");
  }

  renderMathSettings(containerEl) {
    const controls = this.createAppearanceLayout(containerEl, sample =>
      this.renderMarkdownSample(sample, "$E=mc^2$\n\n$$\nx^2+y^2=1\n$$"));
    this.renderNoteThemeControls(controls, [["font-size-latex", "块公式字号", "Display math font size"]]);
    this.renderThemeGroups(controls, ["math"], false);
  }

  selectHeadingTarget(target) {
    this.headingTarget = target;
    this.headingPicker.setValue(target);
    for (const panel of this.containerEl.querySelectorAll("[data-bysan-heading-target]")) {
      panel.hidden = panel.dataset.bysanHeadingTarget !== target;
    }
  }

  renderNoteBackgroundColors(containerEl) {
    const zh = this.plugin.language === "zh";
    const controls = this.createAppearanceLayout(containerEl, sample => {
      sample.createDiv({ cls: "el-p" }).createEl("p", { text: zh ? "笔记正文" : "Note content" });
      sample.closest(".bysan-reading-sample").classList.add("bysan-note-background-sample");
    });
    this.renderNoteThemeControls(controls, NOTE_BACKGROUND_CONTROLS);
    this.renderThemeGroups(controls, ["note-background"], false);
  }

  renderInterfaceColors(containerEl) {
    const zh = this.plugin.language === "zh";
    const controls = this.createAppearanceLayout(containerEl, sample => {
      const frame = sample.createDiv({ cls: "bysan-interface-example" });
      frame.createDiv({ cls: "bysan-example-primary", text: zh ? "主背景" : "Primary surface" });
      frame.createDiv({ cls: "bysan-example-secondary", text: zh ? "次背景" : "Secondary surface" });
      frame.createDiv({ cls: "bysan-example-status", text: zh ? "状态栏" : "Status bar" });
      frame.createDiv({ cls: "bysan-example-accent", text: zh ? "强调色" : "Accent" });
    }, zh ? "界面配色示意" : "Interface colours sample", false);
    this.renderNoteThemeControls(controls, INTERFACE_COLOR_CONTROLS);
  }

  renderNoteThemeControls(containerEl, controls, compact = false) {
    const zh = this.plugin.language === "zh";
    for (const [id, cn, en, descZh, descEn, options] of controls) {
      const item = this.plugin.themeControls.controlItems.find(control => control.id === id);
      if (item) this.plugin.themeControls.renderItem(containerEl, item, {
        name: zh ? cn : en,
        scope: (zh ? descZh : descEn) || "",
        compact,
        ...options
      });
    }
  }


  createAppearanceLayout(containerEl, render, label, noteSurface = true) {
    const layout = containerEl.createDiv({ cls: "bysan-appearance-layout" });
    this.renderAppearanceSample(layout, render, label, noteSurface);
    return layout.createDiv({ cls: "bysan-appearance-controls" });
  }

  renderMarkdownSample(sample, markdown) {
    // The Markdown renderer provides the content. Reading view then adds block
    // wrappers and list markers, so include those hooks in the fixture too.
    sample.classList.add("bysan-rendered-fixture");
    void MarkdownRenderer.render(this.app, markdown, sample, "", this.sampleComponent)
      .then(() => {
        if (!sample.isConnected) return;
        for (const block of [...sample.children]) {
          if (block.matches("div[class^='el-'], .markdown-preview-pusher")) continue;
          const wrapper = sample.ownerDocument.createElement("div");
          wrapper.className = `el-${block.localName}`;
          block.before(wrapper);
          wrapper.append(block);
        }
        for (const list of sample.querySelectorAll("ul")) list.classList.add("has-list-bullet");
        for (const li of sample.querySelectorAll("ul > li:not(.task-list-item)")) {
          if (li.querySelector(":scope > .list-bullet")) continue;
          const marker = li.ownerDocument.createElement("span");
          marker.className = "list-bullet";
          li.prepend(marker);
        }
        this.plugin.schedulePointRefresh();
      })
      .catch(error => console.warn("[Bysan Style Controller] Could not render settings sample", error));
  }


  createSampleBackdrop(containerEl) {
    return containerEl.createDiv({
      cls: "bysan-note-backdrop-example",
      attr: { "data-type": "markdown" }
    });
  }

  createReadingSample(backdrop, extraClass = "") {
    const reading = backdrop.createDiv({ cls: "markdown-reading-view bysan-reading-sample-frame" });
    const surface = reading.createDiv({
      cls: `markdown-preview-view markdown-rendered bysan-note-paper-example bysan-reading-sample ${extraClass}`.trim()
    });
    if (this.app.vault.getConfig?.("showIndentGuide")) surface.classList.add("show-indentation-guide");
    const section = surface.createDiv({ cls: "markdown-preview-sizer markdown-preview-section" });
    // Obsidian trims the first rendered block's top margin after this marker.
    section.createDiv({ cls: "markdown-preview-pusher" });
    return { surface, section };
  }

  renderAppearanceSample(containerEl, render, label, noteSurface) {
    const box = containerEl.createDiv({ cls: "bysan-appearance-sample" });
    if (label !== false) box.createDiv({
      cls: "bysan-appearance-sample-label",
      text: label ?? (this.plugin.language === "zh" ? "阅读样例" : "Reading sample")
    });
    if (noteSurface) render(this.createReadingSample(this.createSampleBackdrop(box)).section);
    else render(box);
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
    const controls = this.createAppearanceLayout(containerEl, sample => this.renderMarkdownSample(sample,
      (this.plugin.language === "zh" ? "行内代码示例 " : "Inline code sample ") + "`np.arange(0, 1)`"));
    this.renderNoteThemeControls(controls, [["bysan-inline-code-font", "行内代码字体", "Inline code font"]]);
    this.createFeatureGroup(
      controls,
      this.plugin.language === "zh" ? "明暗外观" : "Light and dark appearance",
      "",
      (body) => {
        this.addDualColor(body, this.plugin.t("palette.inlineBg"), "inlineBgLight", "inlineBgDark");
        this.addDualColor(body, this.plugin.t("palette.inlineText"), "inlineTextLight", "inlineTextDark");
        this.renderNoteThemeControls(body, [["bysan-inline-code-border", "行内代码边框颜色", "Inline code border colour",
          "恢复后跟随代码块边框。", "Reset to follow the code block border."]]);
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
    const controls = this.createAppearanceLayout(containerEl, sample =>
      this.renderMarkdownSample(sample, `| ${zh ? "样本" : "Sample"} | ${zh ? "结果" : "Result"} |\n| --- | --- |\n| A | 0.82 |\n| B | 0.91 |`));
    const grid = controls.createDiv({ cls: "bysan-theme-grid" });
    this.addToggle(grid, zh ? "启用表格斑马纹" : "Enable table zebra stripes",
      this.plugin.t("components.zebraDesc"), "tableZebra");
    this.addToggle(grid, this.plugin.t("components.center"), this.plugin.t("components.centerDesc"), "tableCentered");
    this.addDualColor(grid, this.plugin.t("palette.tableHead"), "tableHeadLight", "tableHeadDark");
    this.addSampleJump(controls, "tableHeadLight", zh ? "定位表头配色" : "Go to header colour");
    this.addDualColor(grid, zh ? "表格偶数行背景（斑马纹）" : "Even row background (zebra stripes)",
      "tableStripeLight", "tableStripeDark");
    this.addDualColor(grid, this.plugin.t("palette.tableHover"), "tableHoverLight", "tableHoverDark");
    this.addDualColor(grid, this.plugin.t("palette.tableBorder"), "tableBorderLight", "tableBorderDark");
    this.addFontSizeSetting(grid, zh ? "表格字号" : "Table font size",
      zh ? "恢复后使用主题的表格字号。" : "Reset to use the theme’s table font size.",
      "tableFontSize", "td", "px");
    this.renderGeometryControls(grid, "table");
    this.renderThemeGroups(controls, ["tables"], false);
  }


  renderQuoteSettings(containerEl) {
    const controls = this.createAppearanceLayout(containerEl, sample =>
      this.renderMarkdownSample(sample, this.plugin.language === "zh" ? "> 一段引用文字。" : "> A sample blockquote."));
    const grid = controls.createDiv({ cls: "bysan-theme-grid" });
    const zh = this.plugin.language === "zh";
    const quoteFont = new Setting(grid).setName(zh ? "引用字体样式" : "Blockquote font style")
      .addDropdown(dropdown => dropdown
        .addOption("serif", zh ? "衬线字体" : "Serif")
        .addOption("body", zh ? "跟随正文" : "Use body font")
        .setValue(this.plugin.settings.quoteSerif ? "serif" : "body")
        .onChange(value => this.plugin.updateSetting("quoteSerif", value === "serif")));
    quoteFont.settingEl.addClass("bysan-control-type-select");
    quoteFont.settingEl.dataset.bysanSettingKeys = "quoteSerif";
    this.addDualColor(grid, this.plugin.t("palette.quoteBg"), "quoteBgLight", "quoteBgDark", "quoteBgOpacityLight", "quoteBgOpacityDark");
    this.addDualColor(grid, this.plugin.t("palette.quoteBorder"), "quoteBorderLight", "quoteBorderDark");
    this.addSampleJump(controls, "quoteBorderLight", zh ? "定位引用边框" : "Go to quote border colour");
    this.renderGeometryControls(grid, "quote");
    this.renderThemeGroups(controls, ["quotes"], false);
  }

  addSampleJump(controls, key, label) {
    const sample = controls.previousElementSibling;
    const button = sample?.createEl("button", { cls: "bysan-sample-jump", attr: { type: "button" }, text: label });
    button?.addEventListener("click", () => this.focusRow(controls.querySelector(`[data-bysan-setting-keys~="${key}"]`)));
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
    const tr = (cn, en) => zh ? cn : en;
    containerEl.addClass("bysan-list-settings-body");
    const layout = containerEl.createDiv({ cls: "bysan-appearance-layout bysan-list-layout" });
    const sample = layout.createDiv({ cls: "bysan-appearance-sample bysan-list-sample" });
    const bar = sample.createDiv({ cls: "bysan-list-preview-bar" });
    const label = bar.createSpan({ text: tr("列表样例", "List sample") });
    const controls = layout.createDiv({ cls: "bysan-appearance-controls" });
    const names = zh ? ["一级列表项", "二级", "三级", "四级"] : ["First level", "Level two", "Level three", "Level four"];
    const ordered = tr("有序列表", "Ordered item");
    const backdrop = this.createSampleBackdrop(sample);
    const { surface: reading, section } = this.createReadingSample(backdrop, "bysan-list-preview-surface");
    this.renderMarkdownSample(section, [
      ...names.map((name, index) => `${"\t".repeat(index)}- ${name}`), "", `1. ${ordered}`
    ].join("\n"));
    const editing = backdrop.createDiv({
      cls: "markdown-source-view cm-s-obsidian mod-cm6 is-live-preview bysan-list-preview-surface"
    });
    this.renderListEditorSample(editing, names, ordered);
    const activeNote = this.app.workspace.getActiveViewOfType(MarkdownView);
    let mode = activeNote?.getMode() === "source" ? "edit" : "read";

    const used = new Set(["colorful-unordered-list", "unordered-list-style-options"]);
    const theme = this.plugin.themeControls;
    const item = id => theme.controlItems.find(control => control.id === id);
    const value = id => theme.valueFor(item(id));
    const grid = (parent, conditional = false) => parent.createDiv({
      cls: "bysan-theme-grid",
      attr: conditional ? { "data-bysan-list-conditional": "" } : {}
    });
    const add = (parent, ids) => {
      for (const spec of ids) {
        const [id, cn, en, descCn, descEn, onChange] = typeof spec === "string" ? [spec] : spec;
        const control = item(id);
        if (!control) continue;
        used.add(id);
        theme.renderItem(parent, control, {
          name: tr(cn, en), scope: tr(descCn, descEn), onChange
        });
      }
    };
    this.createFeatureGroup(controls, tr("列表符号", "List markers"), "", group => {
      const primary = grid(group);
      const standard = "bt-default-unordered-list", custom = "custom-unordered-list";
      const current = () => value("colorful-unordered-list") ? "auto" : value("unordered-list-style-options");
      const standardRows = grid(group, true);
      const autoRows = grid(group, true);
      const commonRows = grid(group, true);
      const customRows = grid(group, true);
      for (const [element, zh, en] of [
        [standardRows, "需选择 Bysan 默认无序列表样式", "Requires Bysan default list style"],
        [autoRows, "需选择自动彩色无序列表", "Requires auto-colour list style"],
        [commonRows, "适用于 Bysan 默认或自动彩色", "Applies to Bysan default or auto colours"],
        [customRows, "需选择自定义无序列表", "Requires custom list style"]
      ]) {
        element.dataset.bysanPrerequisite = tr(zh, en);
        element.dataset.bysanPrerequisiteId = "unordered-list-style-options";
      }
      const sync = () => {
        const choice = current();
        standardRows.hidden = choice !== standard;
        autoRows.hidden = choice !== "auto";
        commonRows.hidden = choice !== standard && choice !== "auto";
        customRows.hidden = choice !== custom;
      };
      const modeSetting = new Setting(primary).setName(tr("无序列表样式", "Unordered list style"))
        .setDesc(tr("选「自动彩色」调整基础色，或选「自定义」逐层配色。",
          "Choose Auto colours for a base colour, or Custom to colour each level."))
        .addDropdown(dropdown => dropdown.addOptions({
          [standard]: tr("Bysan 默认", "Bysan default"),
          auto: tr("自动彩色", "Auto colours"),
          [custom]: tr("自定义", "Custom"),
          "default-list-marker": tr("Obsidian 默认", "Obsidian default")
        }).setValue(current()).onChange(async choice => {
          const pending = this.plugin.updateThemeSettings({
            "colorful-unordered-list": choice === "auto",
            "unordered-list-style-options": choice === "auto" ? standard : choice
          });
          sync();
          await pending;
        }));
      modeSetting.settingEl.dataset.bysanSettingId = "unordered-list-style-options";
      modeSetting.settingEl.dataset.bysanSearch = tr(
        "无序列表样式 默认 自动彩色 启用彩色无序列表符号 自定义 colorful-unordered-list unordered-list-style-options",
        "unordered list style default automatic colours colorful-unordered-list custom unordered-list-style-options");
      add(standardRows, ["list-ul-marker-color"]);
      add(autoRows, [["list-colorful-marker", "自动彩色基础色", "Automatic bullet base colour",
        "一级使用此颜色，后续层级自动调整色相。", "Level one uses this colour; deeper levels shift its hue."]]);
      add(commonRows, ["list-ul-marker-size"]);
      for (let level = 1; level <= 4; level++) {
        add(customRows, [
          [`list-ul-marker-color-${level}`, `第 ${level} 层符号颜色`, `Level ${level} bullet colour`],
          `list-ul-marker-${level}`, `list-ul-marker-size-${level}`
        ]);
      }
      const shared = grid(group);
      this.addDualColor(shared, tr("列表数字与通用标记", "List numbers and generic markers"), "markerLight", "markerDark",
        null, null, tr("控制当前样式下显示的通用列表数字。", "Controls the general list number colour in the current style."));
      this.renderGeometryControls(shared, "list");
      add(shared, ["list-ol-number-color", "list-ol-marker-1", "list-ol-marker-2", "list-ol-marker-3",
        "list-ol-marker-4", "list-style-change-options", "list-indent", "line-height-list", "list-spacing-bt"]);
      sync();
    });

    let syncGuideMode;
    this.createFeatureGroup(controls, tr("缩进层级线", "Indentation guides"),
      tr("预览的「编辑 / 阅读」也会切换下方对应设置。", "The preview toggle also switches the matching controls below."), group => {
        const shared = grid(group);
        add(shared, [
          ["bt-connected-indent-line-color", "层级线基础色", "Indent-guide base colour",
            "默认彩色层级线和悬停连接线共用；更深层自动变色。", "Shared by standard coloured guides and hover connectors; deeper levels shift its hue."],
          "bt-connected-indent-hover", "bt-colorful-connected-indent-hover", "bt-indentation-width-hover"
        ]);
        const editingRows = grid(group, true);
        const plainLines = grid(group, true);
        const readingRows = grid(group, true);
        const readingStyle = grid(group, true);
        const gradients = grid(group, true);
        const image = grid(group, true);
        for (const [element, mode, gate, zh, en] of [
          [editingRows, "edit", "", "仅编辑视图", "Editing view only"],
          [plainLines, "edit", "bt-colorful-indentation-lines-editing", "仅编辑；需关闭彩色层级线", "Editing only; turn off coloured guides"],
          [readingRows, "read", "", "仅阅读视图", "Reading view only"],
          [readingStyle, "read", "bt-colorful-indentation-lines", "仅阅读；需启用彩色层级线", "Reading only; enable coloured guides"],
          [gradients, "read", "bt-colorful-indentation-line-options", "仅阅读；启用彩色层级线并选择渐变", "Reading only; enable coloured guides and choose Gradient"],
          [image, "read", "bt-colorful-indentation-line-options", "仅阅读；启用彩色层级线并选择背景图片", "Reading only; enable coloured guides and choose Image"]
        ]) {
          element.dataset.bysanPreviewMode = mode;
          element.dataset.bysanPrerequisiteId = gate;
          element.dataset.bysanPrerequisite = tr(zh, en);
        }
        syncGuideMode = () => {
          const edit = mode === "edit";
          const colourful = value("bt-colorful-indentation-lines");
          const style = value("bt-colorful-indentation-line-options");
          editingRows.hidden = !edit;
          plainLines.hidden = !edit || value("bt-colorful-indentation-lines-editing");
          readingRows.hidden = edit;
          readingStyle.hidden = edit || !colourful;
          gradients.hidden = edit || !colourful || style !== "bt-indentation-line-gradient";
          image.hidden = edit || !colourful || style !== "bt-indentation-line-image";
        };
        add(editingRows, [
          ["bt-colorful-indentation-lines-editing", "启用彩色层级线（编辑）", "Coloured guides (editing)", "", "", syncGuideMode],
          "indentation-guide-width", "bt-list-indentation-margin-left-editing"
        ]);
        add(plainLines, ["indentation-guide-color",
          ["indentation-guide-color-active", "编辑时活动层级线颜色", "Active indent-guide colour (editing)",
            "可把鼠标移到编辑样例的子列表上查看。", "Hover a nested line in the editing sample to see it."]]);
        add(readingRows, [
          ["bt-colorful-indentation-lines", "启用彩色层级线（阅读）", "Coloured guides (reading)", "", "", syncGuideMode],
          "bt-list-indentation-margin-left-reading"
        ]);
        add(readingStyle, [
          ["bt-colorful-indentation-line-options", "阅读视图层级线样式", "Reading-view indent guide style",
            "选择默认、渐变或背景图片。", "Choose Default, Gradient or Image.", syncGuideMode],
          "bt-colorful-indentation-width"
        ]);
        add(gradients, ["bt-indentation-gradient-color-1", "bt-indentation-gradient-color-2"]);
        add(image, ["bt-indentation-line-image"]);
      });
    const buttons = [["edit", tr("编辑", "Editing")], ["read", tr("阅读", "Reading")]].map(([target, title]) => {
      const button = bar.createEl("button", { text: title, attr: { type: "button", "data-mode": target } });
      button.addEventListener("click", () => { mode = target; syncMode(); });
      return [target, button];
    });
    const syncMode = () => {
      editing.hidden = mode !== "edit";
      reading.hidden = mode !== "read";
      label.textContent = mode === "edit" ? tr("编辑样式示意", "Live Preview style sample") : tr("阅读样例", "Reading sample");
      for (const [target, button] of buttons) button.setAttribute("aria-pressed", String(target === mode));
      syncGuideMode();
    };
    syncMode();

    this.createFeatureGroup(containerEl, tr("任务与分隔线", "Tasks and dividers"), "", group => {
      const taskControls = this.createAppearanceLayout(group, fixture => this.renderMarkdownSample(fixture,
        tr("- [ ] 待办\n- [x] 完成\n\n---", "- [ ] To do\n- [x] Done\n\n---")));
      const geometry = grid(taskControls);
      for (const feature of ["task", "hr"]) this.renderGeometryControls(geometry, feature);
      this.renderThemeGroups(taskControls, ["lists"], false, id => !used.has(id));
    });
  }

  renderListEditorSample(editing, names, ordered) {
    const scroller = editing.createDiv({ cls: "cm-scroller" });
    const content = scroller.createDiv({ cls: "cm-content cm-lineWrapping" });
    const showGuides = this.app.vault.getConfig?.("showIndentGuide") !== false;
    for (const [index, name] of [...names, ordered].entries()) {
      const isOrdered = index === names.length;
      const level = isOrdered ? 1 : index + 1;
      const line = content.createDiv({ cls: `cm-line HyperMD-list-line HyperMD-list-line-${level}` });
      if (level > 1) {
        const indent = line.createSpan({ cls: `cm-hmd-list-indent cm-hmd-list-indent-${index}` });
        for (let depth = 0; depth < index; depth++) {
          indent.createSpan({ cls: showGuides ? "cm-indent" : "cm-indent-spacing", text: "\t" });
        }
        if (showGuides) {
          const active = value => {
            for (const guide of indent.children) guide.classList.toggle("cm-active-indent", value);
          };
          line.addEventListener("mouseenter", () => active(true));
          line.addEventListener("mouseleave", () => active(false));
        }
      }
      const marker = line.createSpan({ cls: `cm-formatting cm-formatting-list cm-formatting-list-${isOrdered ? "ol" : "ul"} cm-list-${level}` });
      marker.createSpan({ cls: isOrdered ? "list-number" : "list-bullet", text: isOrdered ? "1. " : "-" });
      if (!isOrdered) marker.append(" ");
      line.createSpan({ cls: `cm-list-${level}`, text: name });
    }
  }


  addModeSelect(setting, mode, addControl) {
    const group = setting.controlEl.createDiv({ cls: "bysan-mode-control bysan-mode-control-select" });
    group.createSpan({
      cls: `bysan-mode-label bysan-mode-label-${mode}`,
      text: this.plugin.t(mode === "light" ? "theme.light" : "theme.dark")
    });
    const existing = new Set(setting.controlEl.children);
    addControl();
    for (const child of [...setting.controlEl.children]) {
      if (!existing.has(child)) group.appendChild(child);
    }
  }


  addDualColor(containerEl, name, lightKey, darkKey, lightOpacityKey = null, darkOpacityKey = null, description = "") {
    const setting = new Setting(containerEl).setName(name).setDesc(description);
    const addMode = (mode, colorKey, opacityKey) => {
      let pickerComponent;
      let refreshOpacity, colourGesture;
      const modeLabel = this.plugin.t(mode === "light" ? "theme.light" : "theme.dark");
      const colorLabel = this.plugin.t("theme.colorTitle", { mode: modeLabel });
      const displayColor = () => opacityKey
        ? hexWithAlpha(this.plugin.settings[colorKey], this.plugin.settings[opacityKey])
        : String(this.plugin.settings[colorKey]).toUpperCase();
      const updateTooltip = () => {
        pickerComponent.colorPickerEl.title = `${colorLabel} · ${displayColor()}`;
      };
      const { controls } = createColorModeLayout(setting.controlEl, mode, modeLabel);
      addModeColorPicker(setting, controls, picker => {
        pickerComponent = picker;
        picker.colorPickerEl.addEventListener("pointerdown", () => { colourGesture = Symbol("colour-edit"); });
        picker.colorPickerEl.setAttribute("aria-label", `${name} · ${colorLabel}`);
        picker.setValue(this.plugin.settings[colorKey])
          .onChange((value) => {
            void this.plugin.updateSetting(colorKey, value, colourGesture ? { group: colourGesture } : undefined);
            updateTooltip();
          });
        picker.colorPickerEl.addEventListener("change", () => { colourGesture = undefined; });
        updateTooltip();
      });
      if (opacityKey) {
        const read = () => this.plugin.settings[opacityKey];
        refreshOpacity = addNumericStepper(controls, {
          label: `${name} · ${this.plugin.t("theme.opacityTitle", { mode: modeLabel })}`,
          language: this.plugin.language,
          value: read(), read, min: 0, max: 1, step: 0.01, slider: true,
          save: (value, action) => {
            void this.plugin.updateSetting(opacityKey, value, action);
            updateTooltip();
          }
        });
      }
      addModeColorReset(controls, this.plugin.t("color.reset", { mode: modeLabel }), async () => {
        const reset = { [colorKey]: DEFAULT_SETTINGS[colorKey] };
        if (opacityKey) reset[opacityKey] = DEFAULT_SETTINGS[opacityKey];
        await this.plugin.changeStyleValues("base", reset);
        pickerComponent.setValue(this.plugin.settings[colorKey]);
        refreshOpacity?.();
        updateTooltip();
      });
    };
    addMode("light", lightKey, lightOpacityKey);
    addMode("dark", darkKey, darkOpacityKey);
    setting.settingEl.addClass("bysan-dual-mode-setting", "bysan-color-row");
    setting.settingEl.dataset.bysanSettingKeys = [lightKey, darkKey, lightOpacityKey, darkOpacityKey]
      .filter(Boolean)
      .join(" ");
    if (lightOpacityKey || darkOpacityKey) {
      setting.settingEl.addClass("bysan-combined-color-opacity-setting");
    }
  }


  renderGeometryControls(containerEl, groupId) {
    const entries = CONTENT_GEOMETRY_CONTROLS.filter(([key]) => key.startsWith(groupId));
    for (const [key, property, unit, minimum, maximum, step, controlZh, controlEn] of entries) {
      const name = this.plugin.language === "zh" ? controlZh : controlEn;
      if (Object.hasOwn(GEOMETRY_FONT_TARGETS, key)) {
        this.addFontSizeSetting(containerEl, name, "", key, GEOMETRY_FONT_TARGETS[key], "pt");
        continue;
      }
      if (key.endsWith("Weight")) {
        const setting = new Setting(containerEl).setName(name);
        setting.settingEl.dataset.bysanSettingKeys = key;
        addStyleDropdown(setting, {
          language: this.plugin.language, label: name, choices: FONT_WEIGHTS, stored: this.plugin.settings[key],
          defaultValue: DEFAULT_SETTINGS[key],
          save: value => this.plugin.updateSetting(key, Number(value)),
          reset: () => this.plugin.resetSetting(key)
        });
        continue;
      }
      const setting = this.addNumberSetting(
        containerEl,
        name,
        "",
        key,
        minimum,
        maximum,
        step,
        unit
      );
      setting.infoEl.title = `${property} · ${minimum}–${maximum}${unit}`;
    }
  }

  addFontSizeSetting(containerEl, name, description, key, target, storageUnit, fallbackPx = () => 16) {
    const setting = new Setting(containerEl).setName(name).setDesc(description);
    const read = () => {
      const stored = this.plugin.settings[key];
      if (storageUnit === "px" && Number.isFinite(stored) && stored > 0) {
        return Number((stored * 0.75).toFixed(2));
      }
      if (storageUnit === "pt" && typeof stored === "string" && /^\d+(?:\.\d+)?pt$/.test(stored)) {
        return parseFloat(stored);
      }
      const sample = containerEl.closest(".bysan-appearance-layout")
        ?.querySelector(`.bysan-appearance-sample ${target}`);
      return readFontPoints(sample, fallbackPx());
    };
    this.plugin.addPointStepper(setting.controlEl, {
      label: name, read,
      save: (value, action) => this.plugin.updateSetting(key, storageUnit === "px" ? value / 0.75 : `${value}pt`, action),
      reset: async () => {
        await this.plugin.resetSetting(key);
        return read();
      }
    });
    setting.settingEl.addClass("bysan-unified-control-setting", "bysan-stepper-setting");
    setting.settingEl.dataset.bysanSettingKeys = key;
    return setting;
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
    addNumericStepper(setting.controlEl, {
      label: name,
      language: this.plugin.language,
      value: valueForDisplay(),
      unit,
      min: minimum, max: maximum, step,
      save: (value, action) => this.plugin.updateSetting(key, value, action),
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
