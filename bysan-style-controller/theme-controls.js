const Setting = globalThis.__bysanObsidianSetting;

/* These Blue Topaz settings already have clearer, Bysan-specific controls in
 * the first part of the settings page. Keeping one owner prevents two widgets
 * from fighting over the same body class. */
const MANUAL_SETTING_IDS = new Set([
  "background-settings-workplace-background-image",
  "background-settings-workplace-theme-light",
  "background-settings-workplace-theme-dark",
  "font-size-code",
  "font-weight-strong",
  "resizable-mermaid"
]);

const ADVANCED_THEME_TOPICS = [
  ["workspace", "工作区与界面", "Workspace and interface"],
  ["editor", "笔记外观与排版", "Note appearance and typography"],
  ["media", "白板、图谱与 PDF", "Canvas, graph and PDF"],
  ["extensions", "插件与文档样式", "Plugins and document styles"]
];

// Keep original control IDs. These rules only determine which controls share
// a page and are based on stable catalogue IDs rather than translated labels.
const ADVANCED_THEME_GROUPS = [
  ["general", "workspace", "全局配色与布局", "Global colours and layout"],
  ["workspace-background", "workspace", "工作区背景", "Workspace background"],
  ["tabs", "workspace", "标题栏与标签页", "Title bar and tabs"],
  ["navigation", "workspace", "侧栏、文件树与大纲", "Sidebars, file tree and outline"],
  ["window", "workspace", "设置、菜单与弹窗", "Settings, menus and popovers"],
  ["note-background", "editor", "笔记背景与纸张纹理", "Note background and patterns"],
  ["headings", "editor", "页面标题与 H1–H6", "Page title and H1–H6"],
  ["typography", "editor", "正文、字体与编辑器", "Body text, fonts and editor"],
  ["math", "editor", "公式", "Math"],
  ["code", "editor", "代码", "Code"],
  ["lists", "editor", "列表、任务与缩进", "Lists, tasks and indentation"],
  ["tables", "editor", "表格", "Tables"],
  ["quotes", "editor", "引用块", "Blockquotes"],
  ["blocks", "editor", "提示框", "Callouts"],
  ["marks", "editor", "链接、标签与高亮", "Links, tags and highlights"],
  ["embeds", "editor", "图片、嵌入与 Mermaid", "Images, embeds and Mermaid"],
  ["canvas", "media", "白板", "Canvas"],
  ["graph", "media", "图谱", "Graph"],
  ["pdf", "media", "PDF 阅读与导出", "PDF reading and export"],
  ["plugins", "extensions", "第三方插件", "Third-party plugins"],
  ["documents", "extensions", "文档样式类", "Document style classes"]
];

const ADVANCED_MODE_PAIRS = [
  ["background-settings-workplace-theme-light-custom", "background-settings-workplace-theme-dark-custom", "工作区背景图片", "Workspace background images"],
  ["background-markdown-page-theme-light-custom", "background-markdown-page-theme-dark-custom", "笔记背景图片", "Note background images"],
  ["background-command-palette-theme-light-custom", "background-command-palette-theme-dark-custom", "命令面板背景图片", "Command palette background images"],
  ["bg-panel-page-option", "bg-panel-page-option-dark", "文件栏背景类型", "File sidebar background type"],
  ["background-panel-page-theme-light-custom", "background-panel-page-theme-dark-custom", "文件栏背景图片", "File sidebar background images"],
  ["ob-pdf-style-selection-light", "ob-pdf-style-selection-dark", "PDF 阅读配色", "PDF reader colours"],
  ["text-highlight-bg-h-light", "text-highlight-bg-h-dark", "主题高亮色相", "Theme highlight hue"],
  ["text-highlight-bg-s-light", "text-highlight-bg-s-dark", "主题高亮饱和度", "Theme highlight saturation"],
  ["text-highlight-bg-l-light", "text-highlight-bg-l-dark", "主题高亮亮度", "Theme highlight lightness"],
  ["text-highlight-bg-a-light", "text-highlight-bg-a-dark", "主题高亮透明度", "Theme highlight opacity"],
  ["thino-background-light-custom", "thino-background-dark-custom", "Thino 背景图片", "Thino background images"],
  ["share-thino-background-light-custom", "share-thino-background-dark-custom", "Thino 分享卡片背景", "Thino share card background"]
];

/* Attribution remains in THIRD_PARTY_NOTICES.md. Promotional footer entries
 * from the bundled theme metadata are not plugin settings and must not leak
 * into Bysan Style Controller's settings page. */
const HIDDEN_CATALOG_IDS = new Set([
  "attension",
  "topaz-community",
  "bt-buyacoffe",
  "bt-github"
]);

// These fields remain valid CSS inputs when loading old profiles, but their
// effects are already owned by the unified surface controls.
const COMPATIBILITY_ONLY_IDS = new Set([
  "bg-color-notebook",
  "stripe-notebook-stripe-color",
  "bt-background-split-container",
  "show-border-table",
  "font-family-inline-code",
  "font-monospace-theme"
]);

const CODE_FONT_IDS = new Set(["bysan-code-block-font", "bysan-inline-code-font"]);
const CODE_FONTS = [
  "JetBrains Mono", "Fira Code", "Cascadia Code", "Consolas", "Menlo",
  "DejaVu Sans Mono", "Liberation Mono", "Noto Sans Mono", "Noto Sans Mono CJK SC",
  "Sarasa Mono SC", "Ubuntu Mono", "Courier New"
];
const TEXT_FONTS = {
  "Noto Sans CJK SC": "sans-serif", "Noto Serif CJK SC": "serif",
  "Source Han Sans SC": "sans-serif", "Source Han Serif SC": "serif",
  "LXGW WenKai": "serif", "Microsoft YaHei": "sans-serif", "PingFang SC": "sans-serif",
  SimSun: "serif", Inter: "sans-serif", Arial: "sans-serif", Calibri: "sans-serif",
  Georgia: "serif", "Times New Roman": "serif"
};
const FONT_ALIASES = {
  "LXGW WenKai": ["霞鹜文楷"], "LXGW WenKai Mono": ["霞鹜文楷等宽"],
  "Noto Sans CJK SC": ["思源黑体", "简体中文"],
  "Noto Serif CJK SC": ["思源宋体", "简体中文"],
  "Source Han Sans SC": ["思源黑体"], "Source Han Serif SC": ["思源宋体"],
  "Microsoft YaHei": ["微软雅黑"], "PingFang SC": ["苹方"], SimSun: ["宋体"],
  "Sarasa Mono SC": ["等距更纱黑体"]
};

const fontKey = value => value.normalize("NFKD").toLowerCase().replace(/[\s\p{M}_-]+/gu, "");

function parseFontconfigFamilies(output) {
  return output.split(/\r?\n/).filter(Boolean).map(line => {
    const [names, spacing] = line.split("\t");
    const [family, ...aliases] = names.split(",").map(name => name.trim()).filter(Boolean);
    return { family, aliases, mono: Number(spacing) >= 90 || /mono|code|console|等宽/i.test(family) };
  });
}

function fontChoices(faces, query, preferMono, language) {
  const families = new Map();
  for (const face of faces) {
    const family = String(face.family || "").trim();
    if (!family || /[\u0000-\u001f]/.test(family)) continue;
    const key = fontKey(family);
    const entry = families.get(key) || { family, aliases: new Set(), mono: false };
    for (const alias of [...(Object.hasOwn(FONT_ALIASES, family) ? FONT_ALIASES[family] : []), ...(face.aliases || [])]) {
      if (alias && fontKey(alias) !== key) entry.aliases.add(alias);
    }
    entry.mono ||= face.mono || /mono|code|console|等宽/i.test(family);
    families.set(key, entry);
  }
  const needle = fontKey(query);
  const collator = new Intl.Collator(language === "zh" ? "zh-CN" : "en", { sensitivity: "base", numeric: true });
  const ranked = [...families.values()].map(entry => {
    const keys = [entry.family, ...entry.aliases].map(fontKey);
    const rank = keys.some(key => key === needle) ? 0 : keys.some(key => key.startsWith(needle)) ? 1
      : keys.some(key => key.includes(needle)) ? 2 : 3;
    const localName = language === "zh" && [...entry.aliases].find(name => /[\u3400-\u9fff]/.test(name));
    return { ...entry, rank, displayName: localName || entry.family,
      label: localName && localName !== entry.family ? `${localName} · ${entry.family}` : entry.family };
  });
  return ranked.filter(entry => entry.rank < 3).sort((a, b) => a.rank - b.rank
    || (preferMono ? Number(b.mono) - Number(a.mono) : 0) || collator.compare(a.label, b.label));
}

function loadLocalFontFaces(win) {
  if (typeof process !== "undefined" && process.platform === "linux") {
    return new Promise((resolve, reject) => {
      require("child_process").execFile("fc-list", ["-f", "%{family}\t%{spacing}\n"],
        { encoding: "utf8", timeout: 4000, maxBuffer: 2 * 1024 * 1024 },
        (error, output) => error ? reject(error) : resolve(parseFontconfigFamilies(output)));
    }).catch(() => readBrowserFontFaces(win));
  }
  return readBrowserFontFaces(win);
}

async function readBrowserFontFaces(win) {
  if (typeof win.queryLocalFonts !== "function") return [];
  const fonts = await win.queryLocalFonts();
  return fonts.map(font => ({ family: font.family, aliases: [font.fullName, font.postscriptName].filter(Boolean) }));
}

function fontStack(family, monospace) {
  const generic = monospace ? "monospace" : Object.hasOwn(TEXT_FONTS, family) ? TEXT_FONTS[family] : "sans-serif";
  return `${JSON.stringify(family)}, ${generic}`;
}

function selectedFontName(value) {
  const match = /^("(?:[^"\\]|\\.)+"),\s*(?:sans-serif|serif|monospace)$/.exec(value);
  if (!match) return null;
  try { return JSON.parse(match[1]); } catch { return null; }
}

function isFontFamilySetting(item) {
  return item.type === "variable-text" && (CODE_FONT_IDS.has(item.id) ||
    /^(?:font-text-theme$|font-family-|font-loading-text$|h[1-6]-font$|inline-title-font$)/.test(item.id));
}

const FONT_WEIGHTS = [
  ["100", "极细", "Thin"], ["200", "特细", "Extra light"], ["300", "细体", "Light"],
  ["400", "常规", "Regular"], ["500", "中等", "Medium"], ["600", "半粗", "Semibold"],
  ["700", "粗体", "Bold"], ["800", "特粗", "Extra bold"], ["900", "黑体", "Black"]
];
const LINE_STYLES = [
  ["none", "无线条", "None"], ["solid", "实线", "Solid"], ["dotted", "点线", "Dotted"],
  ["dashed", "虚线", "Dashed"], ["double", "双实线", "Double"], ["wavy", "波浪线", "Wavy"]
];
const BULLET_SYMBOLS = [
  ['"\\2022"', "• 圆点", "• Bullet"], ['"\\25E6"', "◦ 空心圆", "◦ Open circle"],
  ['"\\25AA"', "▪ 方点", "▪ Square"], ['"◆"', "◆ 菱形", "◆ Diamond"],
  ['"→"', "→ 箭头", "→ Arrow"], ['"–"', "– 短横", "– Dash"]
];
const ORDERED_MARKERS = [
  ["decimal", "1, 2, 3", "1, 2, 3"], ["decimal-leading-zero", "01, 02, 03", "01, 02, 03"],
  ["lower-latin", "a, b, c", "a, b, c"], ["upper-latin", "A, B, C", "A, B, C"],
  ["lower-roman", "i, ii, iii", "i, ii, iii"], ["upper-roman", "I, II, III", "I, II, III"],
  ["cjk-ideographic", "一、二、三", "一、二、三"]
];

function cssStyleChoices(id) {
  if (/^(?:h[1-6]-weight$|inline-title-weight$|font-weight-highlight-[1-3]$)/.test(id)) return FONT_WEIGHTS;
  if (id === "font-style-em") return [["normal", "直立", "Upright"], ["italic", "斜体", "Italic"], ["oblique", "倾斜", "Oblique"]];
  if (/^(?:h[1-6]-underline-style$|inline-title-underline-style$)/.test(id)) {
    return LINE_STYLES.filter(([value]) => value !== "wavy");
  }
  if (/^cloze-decoration(?:-[23])?$/.test(id)) return LINE_STYLES;
  if (/^list-ul-marker-[1-4]$/.test(id)) return BULLET_SYMBOLS;
  if (/^list-ol-marker-[1-4]$/.test(id)) return ORDERED_MARKERS;
  if (id === "fancy-hr-icon") return ["😀", "✦", "◆", "✿", "❖", "⁂"].map(char => [`'${char}'`, char, char]);
  return null;
}

function addStyleDropdown(setting, { language, label, choices, stored, defaultValue, save, reset }) {
  const zh = language === "zh";
  setting.settingEl.addClass("bysan-control-type-select");
  const normalizeChoice = value => choices === FONT_WEIGHTS && value === "normal" ? "400"
    : choices === FONT_WEIGHTS && value === "bold" ? "700" : String(value ?? "");
  setting.addDropdown(dropdown => {
    const effectiveDefault = normalizeChoice(defaultValue);
    const defaultLabel = choices.find(([value]) => value === effectiveDefault)?.[zh ? 1 : 2] || effectiveDefault;
    dropdown.addOption("default", defaultLabel
      ? (zh ? `默认（${defaultLabel}）` : `Default (${defaultLabel})`)
      : (zh ? "沿用默认" : "Use default"));
    for (const [value, cn, en] of choices) dropdown.addOption(value, zh ? cn : en);
    const current = normalizeChoice(stored);
    if (current && !choices.some(([value]) => value === current)) {
      dropdown.addOption(current, zh ? `当前自定义：${current}` : `Current custom: ${current}`);
    }
    dropdown.setValue(current || "default").onChange(value => {
      if (value === "default") void reset();
      else void save(value);
    });
    dropdown.selectEl.setAttribute("aria-label", label);
  });
}

const NOTE_PAPER_COLOR_IDS = ["bysan-note-page-bg", "bg-color-notebook", "stripe-notebook-stripe-color"];
const NOTE_PAPER_PATTERN_IDS = ["background-notebook-liked-switch", "notebook-liked-markdown-page-options"];

const COLOR_FALLBACK_VARIABLES = new Map([
  ["print-h1-color", "h1-color"],
  ["print-h2-color", "h2-color"],
  ["print-h3-color", "h3-color"],
  ["print-h4-color", "h4-color"],
  ["print-h5-color", "h5-color"],
  ["print-h6-color", "h6-color"],
  ["h1-underline-color", "h1-color"],
  ["h2-underline-color", "h2-color"],
  ["h3-underline-color", "h3-color"],
  ["h4-underline-color", "h4-color"],
  ["h5-underline-color", "h5-color"],
  ["h6-underline-color", "h6-color"],
  ["inline-title-color", "h1-color"],
  ["inline-title-underline-color", "h1-color"],
  ["list-ul-marker-color-1", "list-marker-color"],
  ["list-ul-marker-color-2", "list-marker-color"],
  ["list-ul-marker-color-3", "list-marker-color"],
  ["list-ul-marker-color-4", "list-marker-color"],
  ["checklist-done-color", "text-muted"]
]);

/* print-hN-color is the user-facing override while --hN-color owns the
 * concrete palette fallback. Asking for print-hN-color with hN-color as its
 * fallback creates a circular var() expression, so resolve through hN-color
 * directly when probing the actual default. */
const INDIRECT_COLOR_VARIABLES = new Set([
  "print-h1-color",
  "print-h2-color",
  "print-h3-color",
  "print-h4-color",
  "print-h5-color",
  "print-h6-color"
]);


const ZH_TITLE = {
  "Light mode": "浅色模式",
  "Dark mode": "深色模式",
  "Custom theme light (url)": "自定义浅色主题网址",
  "Custom theme dark (url)": "自定义深色主题网址",
  "Custom image (Light mode)": "自定义图片（浅色模式）",
  "Custom image (Dark mode)": "自定义图片（深色模式）",
  "Notebook background color": "笔记纸背景颜色",
  "Grid notebook line color": "网格笔记线条颜色",
  "Grid notebook line color for 'Grid 2'": "网格笔记 2 线条颜色",
  "Dotted notebook dot color": "点阵笔记圆点颜色",
  "Stripe notebook stripe color": "条纹笔记线条颜色",
  "Custom theme (light, url)": "自定义浅色主题网址",
  "Custom theme (dark, url)": "自定义深色主题网址",
  "Enable card format for file browser": "文件浏览器使用卡片布局",
  "Remove borders of bubbles": "移除气泡边框",
  "Toggle bubble buttons": "显示气泡按钮",
  "Bubble padding": "气泡内边距",
  "Bubble radius": "气泡圆角",
  "Main text color": "正文颜色",
  "Background primary": "一级背景",
  "Background primary (alt)": "一级备用背景",
  "Background secondary": "二级背景",
  "Background secondary (alt)": "二级备用背景",
  "Background modifier border": "界面边框颜色",
  "Divider color": "分隔线颜色",
  "Tab outline color": "标签页轮廓颜色",
  "Header 2 color": "标题 2 颜色",
  "Header 5 color": "标题 5 颜色",
  "Number color": "数字颜色",
  "Number background color": "数字背景颜色",
  "Connected indent line color (Hovering)": "悬停时连接层级线颜色",
  "Inactive line color (Editing)": "编辑时非活动层级线颜色",
  "Active line color (Editing)": "编辑时活动层级线颜色",
  "Indent line width (Editing)": "编辑时层级线宽度",
  "Indentation gradient color 1": "层级线渐变颜色 1",
  "Indentation gradient color 2": "层级线渐变颜色 2",
  "All dark (Experimental, may or may not be desirable)": "全部变暗（实验功能）",
  "Underline decoration style": "下划线样式",
  "Underline decoration color": "下划线颜色",
  "Underline decoration style for Cloze style TWO": "挖空样式二的下划线样式",
  "Underline decoration color for Cloze style TWO": "挖空样式二的下划线颜色",
  "Underline decoration style for Cloze style THREE (*~~your words~~*)": "挖空样式三的下划线样式（*~~文字~~*）",
  "Underline decoration color for Cloze style THREE": "挖空样式三的下划线颜色",
  "Loading page style": "加载页面样式",
  "Font size": "字体大小",
  "Text color": "文字颜色",
  "Adding things before": "前置内容",
  "Adding things after": "后置内容",
  "Custom loading page image/animation": "自定义加载图片或动画",
  "Image caption": "图片说明",
  "Tag text": "标签文字",
  "Pane style": "窗格样式",
  "Tab style": "标签页样式",
  "Tag stacked pane with": "堆叠窗格标签前缀",
  "Spine width": "堆叠标签宽度",
  "Calendar": "日历",
  "Static": "静态样式",
  "Dynamic": "动态样式",
  "3.6 Dataview": "3.6 Dataview 插件",
  "3.9 ✏️Thino": "3.9 ✏️Thino 插件",
  "3.11 Quiet outline": "3.11 Quiet Outline 插件",
  "Custom thino share background light (url)": "自定义 Thino 分享浅色背景网址",
  "Custom thino share background dark (url)": "自定义 Thino 分享深色背景网址"
};

const ZH_OPTION = {
  "Default": "默认",
  "Avocado": "牛油果",
  "Monochrome": "单色",
  "Pink": "粉色",
  "Topaz-Nord": "Nord",
  "=↓😺 Created by Topaz Community 🐵↓=": "社区配色",
  "Flamingo (@Mouth on Cloud & @Rainbell)": "火烈鸟",
  "Honey milk (@LillianWho)": "蜂蜜牛奶",
  "榛子巧克力 Hazelnut chocolate (@LillianWho)": "榛子巧克力",
  "Lilac (@awyugan)": "丁香紫",
  "Autumn (@LillianWho)": "秋日",
  "魔方 Rubik's Cube (@LillianWho)": "魔方",
  "Simplicity (@Cuman)": "简约",
  "Blue Mountain": "蓝色山峦",
  "Note": "笔记纸",
  "Waves": "波浪",
  "Animating waves": "动态波浪",
  "Custom": "自定义",
  "Night sky": "夜空",
  "Dark sky": "深色天空",
  "In the sky": "天空",
  "Transparent": "透明",
  "Wall": "墙面",
  "Plant": "植物",
  "Fixed": "固定",
  "Hide to left": "向左隐藏",
  "Hide to the left retention drawer": "向左隐藏并保留抽屉",
  "Bubble": "气泡",
  "Bubble, hide to left": "气泡并向左隐藏",
  "Bottom": "底部",
  "Hovering (adapted from @subframe7536's css snippet)": "悬停显示",
  "Remove Scrollbar": "隐藏滚动条",
  "Obsidian default": "Obsidian 默认",
  "Rectangle": "矩形",
  "Asymmetric Style of Split Panes": "非对称分栏",
  "Default (Left/Start)": "默认（左对齐）",
  "Center": "居中",
  "Right/End": "右对齐",
  "with icons": "带图标",
  "without icons": "无图标",
  "with Numbers": "带数字",
  "Blue Topaz Default": "Bysan 默认",
  "Bracket 1": "括号样式 1",
  "Bracket 2 (1.1.1)": "括号样式 2（1.1.1）",
  "Bracket 3": "括号样式 3",
  "Vertical line 1 (1.1.1)": "竖线样式 1（1.1.1）",
  "Using Ob Settings": "跟随 Obsidian 设置",
  "Gradient": "渐变",
  "Image": "图片",
  "Rounded Rectangle": "圆角矩形",
  "Pill": "胶囊",
  "Wrapped": "自动换行",
  "Non-wrapped": "不换行",
  "File Name Scrolling When Hovering": "悬停时滚动文件名",
  "Default non-colorful": "默认单色",
  "folder colorful  with  \"0-9\" or  \"A-Z\"": "按 0–9 或 A–Z 设置彩色文件夹",
  "folder colorful by order": "按顺序设置彩色文件夹",
  "folder title colorful": "文件夹标题着色",
  "Tab-liked": "标签页样式",
  "Border": "边框",
  "With quotation mark": "带引号",
  "Speech Bubble 1": "对话气泡 1",
  "Speech Bubble 2": "对话气泡 2",
  "Outline": "轮廓",
  "Border left": "左侧边框",
  "Invert colors": "反转颜色",
  "Green": "绿色",
  "Warm": "暖色",
  "Defaut table": "默认表格",
  "Wrapped table (break all)": "表格全部换行",
  "Non-wrapped table (limited cell width)": "不换行表格（限制单元格宽度）",
  "Non-wrapped table": "不换行表格",
  "Default Loading Page": "默认加载页面",
  "Shapes": "形状",
  "Custom Text": "自定义文字",
  "Default Text w/ Icons Before and After": "默认文字与前后图标",
  "Cat (GIF)": "猫咪动图",
  "Adding Image or Animation (GIF)": "添加图片或动图",
  "Animation with Position Changing": "位移动画",
  "Jumping Mario": "跳跃马里奥",
  "Rainbow tag": "彩虹标签",
  "Rainbow tag alt (No influence on emojis)": "彩虹标签备用样式（不影响表情）",
  "Outlined": "轮廓样式",
  "Clear": "透明",
  "Customised colorful tag": "自定义彩色标签",
  "Frosted Glass": "毛玻璃",
  "Traditional": "传统",
  "Translucent (only for setting panel)": "半透明（仅设置面板）",
  "Reversal": "反转",
  "Fancy prompt 1": "精美提示框 1",
  "Slide Up Large": "向上滑入",
  "Quick Scale Down": "快速缩小",
  "Blow Up Modal": "放大弹窗",
  "Road Runner In": "快速进入",
  "Road Runner Out": "快速退出",
  "Unfold In": "展开进入",
  "Pop-swirl": "旋转弹出",
  "Mixed orientation": "混合方向",
  "Underline": "下划线",
  "Safari-style": "Safari 样式",
  "Transparent-style": "透明样式",
  "All rounded corners (@Mon & @TheGodOfKing)": "全部圆角",
  "No rounded corners": "无圆角",
  "Shade": "阴影",
  "All color (instead of images in light mode)": "全部使用颜色（浅色模式不使用图片）",
  "All image-1": "全部使用图片 1",
  "All image-2 abstract": "全部使用抽象图片 2",
  "Plain": "简洁",
  "Little color": "少量颜色",
  "None": "无",
  "Pac-man": "吃豆人",
  "Normal": "普通",
  "Wechat": "微信",
  "Chat": "聊天",
  "default": "默认",
  "Frosted Style(Transparent)": "毛玻璃样式（透明）",
  "Frosted Style": "毛玻璃样式",
  "custom color": "自定义颜色",
  "Custom background img": "自定义背景图片",
  "Same as workspace background": "跟随工作区背景",
  "Same as  thino  background": "跟随 Thino 背景",
  "Custom share background": "自定义分享背景"
};

function chineseTitle(text) {
  const exact = ZH_TITLE[text];
  if (exact) return exact;
  return String(text || "")
    .replace(/^注意！由于obsidian的政策，主题无法使用在线或本地库里的图片，相关内置图片选项已删除，需要显示背景图片请自行设置url。$/, "注意：内置背景图片不可用；如需背景图片，请填写自定义网址。")
    .replace(/整体配色选择 \(由Topaz社区贡献\)/g, "整体配色选择")
    .replace(/\(Light mode\)/gi, "（浅色模式）")
    .replace(/\(Dark mode\)/gi, "（深色模式）")
    .replace(/\(url\)/gi, "（网址）")
    .replace(/\bTab\b/g, "标签页")
    .replace(/\bBubble\b/g, "气泡")
    .replace(/Sliding Pane plugin/gi, "滑动窗格插件")
    .replace(/Connected indent lines/gi, "连接层级线")
    .replace(/Connected indent line/gi, "连接层级线")
    .replace(/\(Hovering\)/gi, "（悬停）")
    .replace(/\(Editing\)/gi, "（编辑视图）")
    .replace(/\(Reading\)/gi, "（阅读视图）")
    .replace(/\bbanner\b/gi, "横幅")
    .replace(/\bstack 模式/gi, "堆叠模式")
    .replace(/mermaid大小/gi, "Mermaid 图表大小")
    .replace(/\bPlus\b/gi, "增强")
    .replace(/\bPC端\b/gi, "桌面端")
    .replace(/\bmodern\b/gi, "现代")
    .replace(/Header (\d)/g, "标题 $1")
    .replace(/h(\d) bg/gi, "标题 $1 背景")
    .replace(/h(\d) font weight/gi, "标题 $1 字重")
    .replace(/Line color (\d)/gi, "线条颜色 $1")
    .replace(/hr-color-(\d)/gi, "分割线颜色 $1")
    .replace(/Tag-(\d)/g, "标签颜色 $1")
    .replace(/pseudo-kanban color (\d)/gi, "伪看板颜色 $1")
    .replace(/Hue \(Light mode\)/g, "色相（浅色模式）")
    .replace(/Saturation \(Light mode\)/g, "饱和度（浅色模式）")
    .replace(/Lightness \(Light mode\)/g, "明度（浅色模式）")
    .replace(/Opacity \(Light mode\)/g, "透明度（浅色模式）")
    .replace(/Hue \(Dark mode\)/g, "色相（深色模式）")
    .replace(/Saturation \(Dark mode\)/g, "饱和度（深色模式）")
    .replace(/Lightness \(Dark mode\)/g, "明度（深色模式）")
    .replace(/Opacity \(Dark mode\)/g, "透明度（深色模式）")
    .replace(/Custom image\/animation with position changing/g, "自定义位移动画")
    .replace(/Custom image\/animation/g, "自定义图片或动画")
    .replace(/Custom text/g, "自定义文字")
    .replace(/Customised colorful tag/g, "自定义彩色标签")
    .replace(/Outlined/g, "轮廓样式")
    .replace(/Stack tabs/g, "堆叠标签页")
    .replace(/Tabs/g, "标签页")
    .replace(/Mermaid/g, "Mermaid 图表")
    .replace(/Admonition & Callout style/g, "Admonition 与 Callout 样式")
    .replace(/Calendar/g, "日历")
    .replace(/Checklist plugin/g, "清单插件")
    .replace(/Kanban/g, "看板")
    .replace(/Buttons/g, "按钮")
    .replace(/Dataview list/g, "Dataview 列表")
    .replace(/Dataview table/g, "Dataview 表格")
    .replace(/Dialogue & Chatview/g, "对话与聊天视图")
    .replace(/Options for 'Blue Topaz Default'/g, "Bysan 默认选项")
    .replace(/Options for 'Custom'/g, "自定义选项");
}

const CONTROL_COPY = {
  "bysan-code-block-font": { "title.zh": "代码块字体", title: "Code block font" },
  "bysan-inline-code-font": { "title.zh": "行内代码字体", title: "Inline code font" },
  "color-scheme-options": { "title.zh": "整体配色方案", title: "Colour scheme" },
  "toggle-fixed-pattern": { "title.zh": "滚动时固定纸纹理", title: "Keep paper pattern fixed while scrolling" },
  "toggle-split-note-background": { "title.zh": "侧栏笔记不使用纸纹理", title: "Hide paper pattern in sidebar notes" },
  "grid-notebook-line-color-1": { "title.zh": "网格线颜色", title: "Grid-line colour" },
  "grid-notebook-line-color-2": { "title.zh": "双层网格的粗线颜色", title: "Coarse-line colour for double grid" },
  "dotted-notebook-dot-color": { "title.zh": "点阵圆点颜色", title: "Dot colour" },
  "toggle-nonoverlapping-bg": { "title.zh": "笔记底层与工作区分离", title: "Separate note and workspace backgrounds" },
  "toggle-table-transition": { "title.zh": "悬停时放大表格单元格", title: "Enlarge table cells on hover" },
  "list-ul-marker-color": { "title.zh": "普通列表符号颜色", title: "Standard bullet colour" },
  "list-ul-marker-color-1": { "title.zh": "自定义一级列表符号颜色", title: "Custom level-one bullet colour" },
  "bt-colorful-indentation-line-options": { "title.zh": "阅读视图层级线样式", title: "Reading-view indent guide style" },
  "head-tag-style": {
    "title.zh": "标题内的标签上标显示", title: "Superscript tags in headings",
    "description.zh": "见标签预览中的「标题 #上标」。", description: "See “Heading #superscript” in the tag preview."
  },
  "font-family-vault": { "title.zh": "库名称字体", title: "Vault name font" },
  "font-size-vault-name": { "title.zh": "库名称字号", title: "Vault name font size" },
  "hr-color-numbers-color": { "title.zh": "编号分隔线数字颜色", title: "Numbered-divider digit colour" },
  "hr-numbers-text-fill": { "title.zh": "空心数字填充颜色", title: "Hollow-digit fill colour" },
  "font-size-loading-diy-text": { "title.zh": "加载主文字字号", title: "Loading main text size" },
  "font-size-loading-add": { "title.zh": "加载附加文字字号", title: "Loading supplementary text size" },
  "loading-diy-text-color": { "title.zh": "加载主文字颜色", title: "Loading main text colour" },
  "loading-add-text-color": { "title.zh": "加载附加文字颜色", title: "Loading supplementary text colour" },
  "loading-add-text-color-alt": { "title.zh": "加载附加文字动画终点颜色", title: "Loading supplementary animation end colour" },
  "loading-page-custom-gif-caption": { "title.zh": "自定义加载动图说明", title: "Custom loading animation caption" },
  "loading-page-custom-gif-caption-alt": { "title.zh": "形状动图加载说明", title: "Shaped loading animation caption" },
  "popover-width-factor": { "title.zh": "悬浮预览宽度倍率", title: "Popover width multiplier" },
  "popover-height-factor": { "title.zh": "悬浮预览高度倍率", title: "Popover height multiplier" },
  "checkbox-size": {
    "title.zh": "普通复选框尺寸",
    title: "Standard checkbox size",
    "description.zh": "用于普通复选框；Markdown 任务框使用「任务框尺寸」。",
    description: "For standard checkboxes. Markdown tasks use the task-checkbox size."
  },
  "background-image-settings-switch": {
    "title.zh": "启用背景图或透明底层",
    title: "Enable background image or transparent underlay"
  },
  "background-image-settings-markdown-page-options": {
    "title.zh": "底层方式",
    title: "Underlay mode"
  },
  "bg-markdown-page-opacity-cp": {
    "title.zh": "背景图与底层颜色不透明度",
    title: "Image and underlay opacity"
  },
  "custom-markdown-page-background-color": {
    "title.zh": "自定义底层颜色",
    title: "Custom underlay colour",
    "description.zh": "仅在底层方式为「自定义」时生效。位于纸纹理和笔记底色下方。",
    description: "Only applies in Custom mode. This layer sits under the paper pattern and note background colour."
  },
  "canvas-card-opacity": {
    "title.zh": "卡片透明度（旧主题参数）",
    title: "Card opacity (legacy theme parameter)",
    "description.zh": "当前 Obsidian 原生白板不读取此参数，保留以兼容旧预设和自定义 CSS。",
    description: "Native Obsidian Canvas does not read this value. Kept for old presets and custom CSS."
  }
};

function localised(item, key, language) {
  if (key === "title") {
    const headingFont = /^(h[1-6])-font$/.exec(item.id);
    if (headingFont) return `${headingFont[1].toUpperCase()} ${language === "zh" ? "字体" : "font"}`;
    const match = /^hr-color-(icon|numbers-line)-([1-4])$/.exec(item.id);
    if (match) {
      const [, kind, side] = match;
      return language === "zh"
        ? `${kind === "icon" ? "图标" : "编号"}分隔线颜色 ${side}`
        : `${kind === "icon" ? "Icon" : "Numbered"} divider line colour ${side}`;
    }
    const marker = /^list-(ul|ol)-marker-([1-4])$/.exec(item.id);
    if (marker) {
      const [, type, level] = marker;
      return language === "zh"
        ? `${type === "ul" ? "无序" : "有序"}列表 ${level} 级符号`
        : `${type === "ul" ? "Unordered" : "Ordered"} list level ${level} marker`;
    }
  }
  const copy = CONTROL_COPY[item.id]?.[language === "en" ? key : `${key}.zh`];
  if (copy) return copy;
  if (language === "en") return item[key] || "";
  if (key === "description") return item[`${key}.zh`] || "";
  return chineseTitle(item[`${key}.zh`] || item[key] || "").replace(/\bh([1-6])\b/g, "H$1");
}

function optionLabel(label, language) {
  const original = String(label || "");
  const text = original.replace(/\s*\((?:@|adapted from @)[^)]*\)\s*$/i, "").trim();
  const paperLabels = {
    "Grid notebook 1": ["均匀网格", "Uniform grid"],
    "Grid notebook 2": ["双层网格", "Double grid"],
    "Dotted notebook 1": ["规则点阵", "Aligned dots"],
    "Dotted notebook 2": ["交错点阵", "Staggered dots"],
    "Stripe notebook 1": ["斜条纹", "Diagonal stripes"],
    "Stripe notebook 2": ["交叉条纹", "Crossed stripes"]
  };
  if (Object.hasOwn(paperLabels, text)) return paperLabels[text][language === "en" ? 1 : 0];
  if (language === "en") {
    return text
      .replace(/^榛子巧克力\s*/, "")
      .replace(/^魔方\s*/, "")
      .replace(/^Defaut table$/, "Default table");
  }
  if (ZH_OPTION[original] || ZH_OPTION[text]) return ZH_OPTION[original] || ZH_OPTION[text];
  return text
    .replace(/^auto$/i, "自动")
    .replace(/^Logseq$/i, "Logseq 样式")
    .replace(/\(high transparency\)/gi, "（高透明度）")
    .replace(/\(low transparency\)/gi, "（低透明度）")
    .replace(/^Grid notebook (\d)(.*)$/i, "网格笔记 $1$2")
    .replace(/^Dotted notebook (\d)$/i, "点阵笔记 $1")
    .replace(/^Stripe notebook (\d)$/i, "条纹笔记 $1")
    .replace(/^Style (\d)(.*)$/i, "样式 $1$2")
    .replace(/^Style ([IVX]+)$/i, "样式 $1")
    .replace(/^Neon-(\d)$/i, "霓虹 $1");
}


function isDefined(value) {
  return value !== undefined && value !== null;
}


function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}


function parseColor(value) {
  const text = String(value || "").trim();
  if (text.toLowerCase() === "transparent") {
    return { hex: "#000000", red: 0, green: 0, blue: 0, alpha: 0, valid: true };
  }
  const hex = text.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (hex) {
    const rgb = Number.parseInt(hex[1], 16);
    return {
      hex: `#${hex[1].toLowerCase()}`,
      red: (rgb >> 16) & 255,
      green: (rgb >> 8) & 255,
      blue: rgb & 255,
      alpha: hex[2] ? Number.parseInt(hex[2], 16) / 255 : 1,
      valid: true
    };
  }

  const rgba = text.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)(?:\s*,\s*([\d.]+))?\s*\)$/i);
  if (rgba) {
    const red = clamp(rgba[1], 0, 255);
    const green = clamp(rgba[2], 0, 255);
    const blue = clamp(rgba[3], 0, 255);
    const hexPart = [red, green, blue]
      .map((part) => Math.round(part).toString(16).padStart(2, "0"))
      .join("");
    return {
      hex: `#${hexPart}`,
      red,
      green,
      blue,
      alpha: isDefined(rgba[4]) ? clamp(rgba[4], 0, 1) : 1,
      valid: true
    };
  }

  const modernRgb = text.match(/^rgba?\(\s*([\d.]+)\s+([\d.]+)\s+([\d.]+)(?:\s*\/\s*([\d.]+)%?)?\s*\)$/i);
  if (modernRgb) {
    const red = clamp(modernRgb[1], 0, 255);
    const green = clamp(modernRgb[2], 0, 255);
    const blue = clamp(modernRgb[3], 0, 255);
    const alpha = isDefined(modernRgb[4])
      ? clamp(Number(modernRgb[4]) / (text.includes("%") ? 100 : 1), 0, 1)
      : 1;
    const hexPart = [red, green, blue]
      .map((part) => Math.round(part).toString(16).padStart(2, "0"))
      .join("");
    return { hex: `#${hexPart}`, red, green, blue, alpha, valid: true };
  }

  // Chromium serialises computed color-mix(in srgb, …) as color(srgb …).
  const srgb = text.match(/^color\(srgb\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)(?:\s*\/\s*([\d.]+)(%)?)?\)$/i);
  if (srgb) {
    const [red, green, blue] = srgb.slice(1, 4).map(value => clamp(value, 0, 1) * 255);
    const rgb = [red, green, blue].map(part => Math.round(part).toString(16).padStart(2, "0")).join("");
    const alpha = srgb[4] == null ? 1 : clamp(Number(srgb[4]) / (srgb[5] ? 100 : 1), 0, 1);
    return { hex: `#${rgb}`, red, green, blue, alpha, valid: true };
  }
  return { hex: "#000000", red: 0, green: 0, blue: 0, alpha: 1, valid: false };
}


function colorWithAlpha(hex, alpha) {
  return `${parseColor(hex).hex}${Math.round(clamp(alpha, 0, 1) * 255)
    .toString(16)
    .padStart(2, "0")}`;
}


function rgbToHsl(red, green, blue) {
  const r = red / 255;
  const g = green / 255;
  const b = blue / 255;
  const maximum = Math.max(r, g, b);
  const minimum = Math.min(r, g, b);
  const delta = maximum - minimum;
  let hue = 0;

  if (delta) {
    if (maximum === r) hue = ((g - b) / delta) % 6;
    if (maximum === g) hue = (b - r) / delta + 2;
    if (maximum === b) hue = (r - g) / delta + 4;
    hue = Math.round(hue * 60);
    if (hue < 0) hue += 360;
  }

  const lightness = (maximum + minimum) / 2;
  const saturation = delta === 0 ? 0 : delta / (1 - Math.abs(2 * lightness - 1));
  return {
    hue,
    saturation: Math.round(saturation * 10000) / 100,
    lightness: Math.round(lightness * 10000) / 100
  };
}


function addValueStepper(containerEl, { label, language, value, unit = "", numeric = false, edit, adjust, save, reset, read, split, range }) {
  const zh = language === "zh";
  const controls = containerEl.createDiv({ cls: "bysan-value-stepper" });
  let slider, sliderTrack;
  let current = String(value);
  const action = (text, tooltip, onClick) => {
    const button = controls.createEl("button", {
      text,
      attr: { type: "button", title: tooltip, "aria-label": tooltip }
    });
    button.addEventListener("click", onClick);
  };
  const set = (next) => {
    if (next != null) current = String(next);
    const display = split?.(current);
    input.value = display?.value ?? current;
    if (slider) {
      slider.value = current;
      sliderTrack.style.setProperty("--bysan-slider-position",
        `${100 * (slider.valueAsNumber - range.min) / (range.max - range.min)}%`);
    }
    if (unitEl) {
      unitEl.textContent = display?.unit ?? unit;
      unitEl.hidden = !unitEl.textContent;
      input.setAttribute("aria-label", unitEl.hidden ? label : `${label} (${unitEl.textContent})`);
    }
    if (split) input.title = current;
  };
  const apply = (next) => {
    const changed = next != null && String(next) !== current;
    set(next);
    if (changed) void save(next);
  };
  const step = direction => {
    if (read) set(read());
    apply(adjust(current, direction));
  };
  action("−", zh ? `减小${label}` : `Decrease ${label}`, () => step(-1));
  const input = controls.createEl("input", {
    attr: { type: numeric ? "number" : "text", "aria-label": unit ? `${label} (${unit})` : label }
  });
  if (numeric) input.step = "any";
  const unitEl = (unit || split) ? controls.createSpan({ cls: "bysan-stepper-unit", text: unit }) : null;
  if (read) input.addEventListener("focus", () => set(read()));
  input.addEventListener("change", () => apply(edit(input.value)));
  input.addEventListener("keydown", event => {
    if (event.key === "Enter") {
      event.preventDefault();
      apply(edit(input.value));
    } else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
      event.preventDefault();
      step(event.key === "ArrowUp" ? 1 : -1);
    }
  });
  action("+", zh ? `增大${label}` : `Increase ${label}`, () => step(1));
  if (unitEl) controls.appendChild(unitEl);
  if (reset) action("↺", zh ? `恢复${label}默认值` : `Reset ${label}`, async () => set(await reset()));
  if (range) {
    const sliderLabel = zh ? `${label}（滑条）` : `${label} (slider)`;
    sliderTrack = containerEl.createDiv({ cls: "bysan-range-track" });
    slider = sliderTrack.createEl("input", {
      cls: "bysan-value-range",
      attr: {
        type: "range", min: String(range.min), max: String(range.max),
        step: "any", "aria-label": unit ? `${sliderLabel} · ${unit}` : sliderLabel
      }
    });
    // A typed value may fall between the original drag steps. Keep its exact
    // handle position, but snap drag changes to the original increments.
    slider.addEventListener("input", () => apply(range.snap(slider.valueAsNumber)));
    slider.addEventListener("keydown", event => {
      const change = {
        ArrowDown: -1, ArrowLeft: -1, ArrowUp: 1, ArrowRight: 1, PageDown: -10, PageUp: 10
      }[event.key];
      if (change) {
        event.preventDefault();
        step(change);
      }
    });
  }
  set(value);
  return () => { if (read && !input.matches(":focus")) set(read()); };
}

function addNumericStepper(containerEl, { min = -Infinity, max = Infinity, step = 1, slider = false, ...options }) {
  const bound = value => Number(clamp(value, min, max).toFixed(6));
  return addValueStepper(containerEl, {
    ...options, numeric: true,
    range: slider ? { min, max, snap: value => bound(min + Math.round((value - min) / step) * step) } : null,
    edit: value => value.trim() && Number.isFinite(Number(value)) ? bound(Number(value)) : null,
    adjust: (value, direction) => bound(Number(value) + step * direction)
  });
}

function splitCssDimension(value) {
  const match = /^([+-]?(?:\d+(?:\.\d+)?|\.\d+))(px|r?em|%|pt|ch|ex|lh|rlh|[sld]?v(?:w|h|min|max)|cm|mm|in|pc|deg)$/i.exec(String(value ?? "").trim());
  return match ? { value: match[1], unit: match[2] } : null;
}

function numericThemeSpec(item) {
  if (["variable-number", "variable-number-slider"].includes(item.type)) {
    const unit = item.format || "";
    return {
      unit, step: item.step ?? (unit === "deg" ? 5 : unit ? 1 : 0.05),
      min: item.min ?? (/line-height/.test(item.id) ? 0.1 : unit === "deg" ? -Infinity : 0),
      max: item.max ?? Infinity
    };
  }
  const dimension = item.type === "variable-text" && splitCssDimension(item.default);
  return dimension ? { unit: dimension.unit } : null;
}

function readFontPoints(element, fallbackPx = 16) {
  const px = element ? parseFloat(element.ownerDocument.defaultView.getComputedStyle(element).fontSize) : NaN;
  return Number(((px > 0 ? px : fallbackPx) * 0.75).toFixed(2));
}

function addPointSizeStepper(containerEl, { label, language, read, save, reset }) {
  const bound = value => Number(clamp(value, 4, 192).toFixed(2));
  return addValueStepper(containerEl, {
    label, language, value: read(), read, save, reset, unit: "pt", numeric: true,
    edit: value => value.trim() && Number.isFinite(Number(value)) ? bound(Number(value)) : null,
    adjust: (value, direction) => bound(direction > 0
      ? Math.floor(Number(value) + 0.001) + 1
      : Math.ceil(Number(value) - 0.001) - 1)
  });
}

class ThemeControls {
  constructor(plugin, catalog) {
    this.plugin = plugin;
    this.catalogItems = (catalog?.settings || [])
      .filter((item) => item && item.id && !HIDDEN_CATALOG_IDS.has(item.id));
    this.items = (catalog?.settings || [])
      .filter((item) => item
        && item.id
        && !MANUAL_SETTING_IDS.has(item.id)
        && !HIDDEN_CATALOG_IDS.has(item.id));
    this.controlItems = this.items.filter((item) => !["heading", "info-text"].includes(item.type));
    this.headingAnchors = new Map();
    this.displayDefaults = new Map();
    this.baseDefaults = new Map();
    this.scopeHeadings = new Map();
    this.probeFrame = null;
    const hierarchy = new Map();
    this.items.forEach((item, index) => {
      if (item.type === "heading") {
        const level = Number(item.level || 2);
        this.headingAnchors.set(item, `bysan-theme-heading-${index}`);
        hierarchy.set(level, item);
        for (const key of [...hierarchy.keys()]) {
          if (key > level) hierarchy.delete(key);
        }
      } else {
        this.scopeHeadings.set(item, [...hierarchy.entries()]
          .sort(([left], [right]) => left - right)
          .map(([, heading]) => heading));
      }
    });
  }


  registerCommands() {
    for (const item of this.catalogItems.filter((entry) => entry.addCommand && entry.type === "class-toggle")) {
      this.plugin.addCommand({
        id: `theme-toggle-${item.id}`,
        name: `${this.plugin.language === "zh" ? "主题" : "Theme"}: ${localised(item, "title", this.plugin.language) || item.id}`,
        callback: () => {
          if (item.id === "background-settings-workplace-background-image") {
            this.plugin.updateSetting("workspaceBackground", !this.plugin.settings.workspaceBackground);
          } else {
            this.plugin.updateThemeSetting(item.id, !Boolean(this.valueFor(item)));
          }
        }
      });
    }
  }


  get count() {
    return this.controlItems.length;
  }


  get stored() {
    return this.plugin.settings.themeSettings || {};
  }

  colorModeKeys(id) {
    return id === NOTE_PAPER_COLOR_IDS[0] ? NOTE_PAPER_COLOR_IDS : [id];
  }

  valueFor(item, mode) {
    if (!item) return undefined;
    const storedValue = this.stored[item.id];
    if (item.type === "variable-themed-color") {
      if (storedValue && typeof storedValue === "object" && isDefined(storedValue[mode])) {
        return storedValue[mode];
      }
      return item[`default-${mode}`];
    }
    return isDefined(storedValue) ? storedValue : item.default;
  }


  displayValueFor(item, mode) {
    const storedValue = this.stored[item.id];
    if (item.type === "variable-themed-color") {
      if (storedValue && typeof storedValue === "object" && isDefined(storedValue[mode])) {
        return storedValue[mode];
      }
      if (item.id === NOTE_PAPER_COLOR_IDS[0]) {
        const [enabled, pattern] = NOTE_PAPER_PATTERN_IDS.map(id => this.valueFor(this.items.find(entry => entry.id === id)));
        const legacyId = enabled && (String(pattern).includes("-stripe-") ? NOTE_PAPER_COLOR_IDS[2] : NOTE_PAPER_COLOR_IDS[1]);
        const legacy = legacyId && this.controlItems.find(entry => entry.id === legacyId);
        if (legacy) return this.displayValueFor(legacy, mode);
      }
      return item.liveDefault?.(mode) ?? this.displayDefaults.get(`${item.id}:${mode}`) ?? item[`default-${mode}`];
    }
    if (isDefined(storedValue)) return storedValue;
    // Non-colour controls already carry their canonical defaults in the
    // catalogue.  A computed CSS value can be much less useful here (for
    // example an inherited font expands to Obsidian's entire font stack),
    // and made an untouched control look as if it had been customised.
    return isDefined(item.default) ? item.default : this.displayDefaults.get(item.id);
  }


  defaultValueFor(item, mode) {
    if (item.type === "variable-themed-color") {
      return item.liveDefault?.(mode) ?? this.baseDefaults.get(`${item.id}:${mode}`) ?? item[`default-${mode}`];
    }
    return isDefined(item.default) ? item.default : this.baseDefaults.get(item.id);
  }


  ensureProbeFrame() {
    if (this.probeFrame?.isConnected) return this.probeFrame;
    const frame = document.createElement("iframe");
    frame.className = "bysan-theme-value-probe";
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("tabindex", "-1");
    Object.assign(frame.style, {
      position: "fixed",
      left: "-10000px",
      top: "0",
      width: "32px",
      height: "32px",
      border: "0",
      opacity: "0",
      pointerEvents: "none"
    });
    document.body.appendChild(frame);
    const probeDocument = frame.contentDocument;
    probeDocument.open();
    probeDocument.write("<!doctype html><html><head></head><body></body></html>");
    probeDocument.close();
    const style = probeDocument.createElement("style");
    const hostRules = [];
    for (const sheet of document.styleSheets) {
      if (sheet.ownerNode === this.plugin.baseThemeStyleEl) continue;
      try {
        for (const rule of sheet.cssRules) hostRules.push(rule.cssText);
      } catch (_) {}
    }
    style.textContent = `${hostRules.join("\n")}\n${this.plugin.baseThemeCssText || ""}`;
    probeDocument.head.appendChild(style);
    this.probeFrame = frame;
    return frame;
  }


  applyStoredVariablesToProbe(body, mode) {
    for (const item of this.items) {
      if (!String(item.type || "").startsWith("variable-")) continue;
      const storedValue = this.stored[item.id];
      const value = item.type === "variable-themed-color"
        ? storedValue && typeof storedValue === "object" && storedValue[mode]
        : storedValue;
      if (!isDefined(value)) continue;
      if (item.format === "hsl-split") {
        const color = parseColor(value);
        const hsl = rgbToHsl(color.red, color.green, color.blue);
        body.style.setProperty(`--${item.id}-h`, String(hsl.hue));
        body.style.setProperty(`--${item.id}-s`, `${hsl.saturation}%`);
        body.style.setProperty(`--${item.id}-l`, `${hsl.lightness}%`);
        body.style.setProperty(`--${item.id}-a`, String(color.alpha));
      } else {
        const suffix = ["variable-number", "variable-number-slider"].includes(item.type) && item.format
          ? item.format
          : "";
        body.style.setProperty(`--${item.id}`, `${value}${suffix}`);
      }
    }
  }


  resolvedProbeColor(item, probeDocument, body) {
    const bodyStyle = probeDocument.defaultView.getComputedStyle(body);
    const fallbackVariable = item.fallbackVariable || COLOR_FALLBACK_VARIABLES.get(item.id);
    const expression = item.format === "hsl-split"
      ? `hsla(var(--${item.id}-h), var(--${item.id}-s), var(--${item.id}-l), var(--${item.id}-a, 1))`
      : INDIRECT_COLOR_VARIABLES.has(item.id)
        ? `var(--${fallbackVariable})`
      : fallbackVariable
        ? `var(--${item.id}, var(--${fallbackVariable}))`
        : `var(--${item.id})`;
    const rawValue = item.format === "hsl-split"
      ? bodyStyle.getPropertyValue(`--${item.id}-h`).trim()
      : bodyStyle.getPropertyValue(`--${item.id}`).trim();
    const fallbackValue = fallbackVariable
      ? bodyStyle.getPropertyValue(`--${fallbackVariable}`).trim()
      : "";
    if (!rawValue && !fallbackValue) return null;
    const sample = probeDocument.createElement("span");
    sample.style.color = expression;
    body.appendChild(sample);
    const resolved = probeDocument.defaultView.getComputedStyle(sample).color;
    sample.remove();
    const parsed = parseColor(resolved);
    return parsed.valid ? colorWithAlpha(parsed.hex, parsed.alpha) : null;
  }


  refreshDisplayDefaults() {
    const frame = this.ensureProbeFrame();
    const probeDocument = frame.contentDocument;
    const body = probeDocument.body;
    const root = probeDocument.documentElement;
    const baseClasses = Array.from(document.body.classList)
      .filter((name) => name !== "theme-light" && name !== "theme-dark");
    const collect = (target, withStoredValues) => {
      target.clear();
      for (const mode of ["light", "dark"]) {
        body.removeAttribute("style");
        body.className = [...baseClasses, `theme-${mode}`].join(" ");
        root.className = `theme-${mode}`;
        if (withStoredValues) this.applyStoredVariablesToProbe(body, mode);
        const bodyStyle = probeDocument.defaultView.getComputedStyle(body);
        for (const item of this.controlItems) {
          if (item.type === "variable-themed-color") {
            const resolved = this.resolvedProbeColor(item, probeDocument, body);
            if (resolved) target.set(`${item.id}:${mode}`, resolved);
            continue;
          }
          if (mode !== "light" || !String(item.type || "").startsWith("variable-")) continue;
          const rawValue = bodyStyle.getPropertyValue(`--${item.id}`).trim();
          if (!rawValue) continue;
          if (["variable-number", "variable-number-slider"].includes(item.type)) {
            const numeric = Number.parseFloat(rawValue);
            if (Number.isFinite(numeric)) target.set(item.id, numeric);
          } else {
            target.set(item.id, rawValue);
          }
        }
      }
    };
    collect(this.baseDefaults, false);
    collect(this.displayDefaults, true);
  }


  destroy() {
    this.probeFrame?.remove();
    this.probeFrame = null;
    this.displayDefaults.clear();
    this.baseDefaults.clear();
    this.refreshNotePaperControl = null;
    this.liveColourRefreshers?.clear();
  }


  classNames() {
    const names = [];
    for (const item of this.items) {
      if (item.type === "class-toggle") names.push(item.id);
      if (item.type === "class-select") {
        names.push(...(item.options || []).map((option) => option?.value).filter(Boolean));
      }
    }
    return [...new Set(names)];
  }


  propertyNames() {
    const names = [];
    for (const item of this.items) {
      if (!String(item.type || "").startsWith("variable-")) continue;
      if (item.format === "hsl-split") {
        names.push(`--${item.id}-h`, `--${item.id}-s`, `--${item.id}-l`, `--${item.id}-a`);
      } else {
        names.push(`--${item.id}`);
      }
    }
    return [...new Set(names)];
  }


  applyClasses() {
    const body = document.body;
    for (const item of this.items) {
      if (item.type === "class-toggle") {
        body.classList.toggle(item.id, Boolean(this.valueFor(item)));
      }
      if (item.type === "class-select") {
        const selected = this.valueFor(item);
        for (const option of item.options || []) {
          if (option?.value) body.classList.toggle(option.value, option.value === selected);
        }
      }
    }
  }


  classesAreApplied() {
    const body = document.body;
    for (const item of this.items) {
      if (item.type === "class-toggle"
        && body.classList.contains(item.id) !== Boolean(this.valueFor(item))) return false;
      if (item.type === "class-select") {
        const selected = this.valueFor(item);
        for (const option of item.options || []) {
          if (option?.value
            && body.classList.contains(option.value) !== (option.value === selected)) return false;
        }
      }
    }
    return true;
  }


  applyVariables() {
    for (const item of this.items) {
      if (!String(item.type || "").startsWith("variable-")) continue;
      this.applyVariable(item);
    }
  }


  applySetting(id) {
    const item = this.items.find((entry) => entry.id === id
      && !["heading", "info-text"].includes(entry.type));
    if (!item) return;
    if (item.type === "class-toggle") {
      document.body.classList.toggle(item.id, Boolean(this.valueFor(item)));
      if (NOTE_PAPER_PATTERN_IDS.includes(id)) this.refreshNotePaperControl?.();
      return;
    }
    if (item.type === "class-select") {
      const selected = this.valueFor(item);
      for (const option of item.options || []) {
        if (option?.value) document.body.classList.toggle(option.value, option.value === selected);
      }
      if (NOTE_PAPER_PATTERN_IDS.includes(id)) this.refreshNotePaperControl?.();
      if (id === "color-scheme-options" && this.refreshNotePaperControl) {
        this.refreshDisplayDefaults();
        this.refreshNotePaperControl();
      }
      return;
    }
    if (String(item.type || "").startsWith("variable-")) {
      this.applyVariable(item);
      if (id === "bysan-right-pane-bg") this.refreshThemedColorControl("bysan-review-panel-bg");
    }
  }


  applyVariable(item) {
    const body = document.body;
    const mode = body.classList.contains("theme-dark") ? "dark" : "light";
    const hasStoredValue = Object.prototype.hasOwnProperty.call(this.stored, item.id);
    const storedValue = this.stored[item.id];
    const hasStoredMode = item.type !== "variable-themed-color"
      || (storedValue && typeof storedValue === "object"
        && Object.prototype.hasOwnProperty.call(storedValue, mode));

    /* The theme metadata uses transparent colors such as #00000000 as
     * "not customized" placeholders. Style Settings does not write those
     * defaults inline. Only persist a CSS variable after the user actually
     * changes it, otherwise the base stylesheet must remain authoritative. */
    if (!hasStoredValue || !hasStoredMode) {
      if (item.format === "hsl-split") {
        for (const suffix of ["h", "s", "l", "a"]) this.restoreProperty(`--${item.id}-${suffix}`);
      } else {
        this.restoreProperty(`--${item.id}`);
      }
      return;
    }

    const value = this.valueFor(item, mode);
    if (!isDefined(value)) return;

    if (item.format === "hsl-split") {
      const color = parseColor(value);
      const hsl = rgbToHsl(color.red, color.green, color.blue);
      body.style.setProperty(`--${item.id}-h`, String(hsl.hue));
      body.style.setProperty(`--${item.id}-s`, `${hsl.saturation}%`);
      body.style.setProperty(`--${item.id}-l`, `${hsl.lightness}%`);
      body.style.setProperty(`--${item.id}-a`, String(color.alpha));
      return;
    }

    let formatted = String(value);
    if (["variable-number", "variable-number-slider"].includes(item.type) && item.format) {
      formatted += item.format;
    }
    body.style.setProperty(`--${item.id}`, formatted);
  }


  restoreProperty(property) {
    const original = this.plugin.originalPropertyState?.get(property);
    if (original?.value) {
      document.body.style.setProperty(property, original.value, original.priority);
    } else {
      document.body.style.removeProperty(property);
    }
  }


  beginRegionRender() {
    this.refreshNotePaperControl = null;
    this.liveColourRefreshers = new Map();
    this.refreshDisplayDefaults();
    this.cachedRegionBuckets = this.buildRegionBuckets();
  }

  refreshThemedColorControl(id) {
    this.liveColourRefreshers?.get(id)?.();
  }

  advancedGroupFor(item) {
    const { id } = item;
    const path = (this.scopeHeadings.get(item) || []).map(heading => heading.id);
    const isIn = pattern => path.some(heading => pattern.test(heading));
    if (path.includes("build-in-style-folder")) return "documents";
    if (path.includes("style-options-for-other-plugins")) {
      return /^(?:admonition-|.*callout)/i.test(id) ? "blocks" : "plugins";
    }
    if (isIn(/canvas/)) return "canvas";
    if (isIn(/graph-view/) || /^graph-/.test(id)) return "graph";
    if (isIn(/pdf/) || /^(?:ob-pdf|pdf-|all-dark-pdf)/.test(id)) return "pdf";
    // Imported headings have duplicate IDs and stale scopes. Explicit targets
    // must take priority over inferred scopes.
    if (/^(?:toggle-bg-panel|bg-panel-page|background-panel-page)/.test(id)) return "navigation";
    if (/^(?:tab-|stack-tab|titlebar-|background-titlebar|font-size-file-header-title)/.test(id)) return "tabs";
    if (/^(?:setting-etc-pane|popover-)/.test(id)) return "window";
    if (/^(?:font-family-tag|font-size-tag|tag(?:[1-5]|-.*)|head-tag-style)$/.test(id)) return "marks";
    if (/^(?:font-size-latex|mjx-)/.test(id)) return "math";
    if (/^(?:font-monospace-theme|font-family-inline-code|bysan-(?:code-block-font|inline-code-(?:font|border)))$/.test(id)) return "code";
    if (/^(?:strong-em-color-|accent-strong$|accent-em$)/.test(id)) return "typography";
    if (/^(?:fancy-hr|hr-)/.test(id)) return "lists";
    if (/^(?:table-|toggle-table-|show-border-table$|full-width-table$)/.test(id) || isIn(/table-styles/)) return "tables";
    if (/^blockquote-/.test(id) || isIn(/blockquote/)) return "quotes";
    if (/^(?:remove-custom-svg-icons|default-icons|enable-icon-anima)$/.test(id)) return "general";
    if (isIn(/background-settings-workplace/) || /^background-(?:settings-workplace|waves)/.test(id)) return "workspace-background";
    if (isIn(/command-palette|setting-etc|prompt-settings|loading-page/) || /^(?:background-command-palette|background-popover|loading-|setting-style)/.test(id)) return "window";
    if (isIn(/markdown-page|notebook/) || id === "toggle-split-note-background" ||
        /^(?:bg-markdown|bg-color-notebook|dotted-notebook|grid-notebook|stripe-notebook)/.test(id)) return "note-background";
    if (isIn(/outline-settings|folder-style|file-browser|file-tree/) ||
        /(?:outline|backlink|folder-file|folder-and-file|vault-name|font-.*-vault|split-note|font-size-split|line-height-split|letter-space-split)/.test(id)) return "navigation";
    if (isIn(/titlebar|tabs-settings|stack-settings|tab-stack/)) return "tabs";
    if (isIn(/^(?:header-settings|h[1-6]-settings|inline-title-settings)$/) || /^(?:print-h[1-6]|inline-title|header-[1-6]|h[1-6]-)/.test(id)) return "headings";
    if (isIn(/list-style|checkbox-style|indentation-line/) || /^(?:list-|checklist-|indentation-guide)/.test(id)) return "lists";
    if (/^(?:admonition-|.*callout)/.test(id)) return "blocks";
    // The imported catalogue reuses heading IDs for popovers and settings.
    if (/(?:popover|setting-pane|settings-pane|settings-panel|menu-style)/.test(id)) return "window";
    if (isIn(/link-style|tag-color|highlight-bg-color|cloze-style/) || /^(?:text-highlight|bg-color-highlight|color-highlight)/.test(id)) return "marks";
    if (isIn(/embed-folder|icons-style-folder|mermaid/) || /^(?:image-|mermaid)/.test(id)) return "embeds";
    if (isIn(/typography|font-settings|font-size-settings|cursor-style/) ||
        /^(?:text-normal|text-selection|activeline|muted-activeline|font-)/.test(id)) return "typography";
    return "general";
  }


  buildRegionBuckets() {
    const topics = new Map(ADVANCED_THEME_TOPICS.map(([id]) => [id, []]));
    const groups = new Map(ADVANCED_THEME_GROUPS.map(([id, topic, zh, en]) => {
      const group = { id, zh, en, items: [] };
      topics.get(topic).push(group);
      return [id, group];
    }));
    for (const item of this.controlItems) groups.get(this.advancedGroupFor(item)).items.push(item);
    return topics;
  }


  regionStats() {
    const buckets = this.cachedRegionBuckets || this.buildRegionBuckets();
    return Object.fromEntries([...buckets].map(([id, groups]) =>
      [id, groups.reduce((count, group) => count + group.items.length, 0)]));
  }


  renderGroup(containerEl, groupId, excludedIds, withTitle, renderTagSample, include = () => true) {
    if (!this.cachedRegionBuckets) this.beginRegionRender();
    const group = [...this.cachedRegionBuckets.values()].flat().find(entry => entry.id === groupId);
    if (!group) return;
    const items = group.items.filter(item => !COMPATIBILITY_ONLY_IDS.has(item.id) && !excludedIds.has(item.id) && include(item.id));
    if (!items.length) return;
    const title = this.plugin.language === "zh" ? group.zh : group.en;
    const wrapper = containerEl.createDiv({
      cls: "bysan-theme-group-panel",
      attr: { "data-bysan-group": groupId }
    });
    if (withTitle) wrapper.createEl("h4", { text: title });
    const renderGrid = (parent, entries) =>
      this.renderGroupedItems(parent.createDiv({ cls: "bysan-theme-grid" }), entries);
    if (groupId === "note-background") {
      const zh = this.plugin.language === "zh";
      const isPaper = item => /notebook|fixed-pattern|split-note-background/.test(item.id);
      renderGrid(wrapper, items.filter(isPaper));
      wrapper.createEl("h4", { text: zh ? "背景图与透明底层" : "Background image and transparency" });
      renderGrid(wrapper, items.filter(item => !isPaper(item)));
      return;
    }
    if (groupId === "marks" && renderTagSample) {
      const isTag = item => /^(tag(?:[1-5]|-.*)|head-tag-style|font-(?:family|size)-tag)$/.test(item.id);
      const tags = items.filter(isTag);
      if (tags.length) {
        const panel = wrapper.createDiv({ cls: "bysan-tag-settings" });
        panel.createEl("h4", { text: this.plugin.language === "zh" ? "标签" : "Tags" });
        renderTagSample(panel);
        renderGrid(panel, tags);
        renderGrid(wrapper, items.filter(item => !isTag(item)));
        return;
      }
    }
    renderGrid(wrapper, items);
  }


  renderGroupedItems(parent, items) {
    const itemById = new Map(items.map(item => [item.id, item]));
    const pairById = new Map();
    for (const pair of ADVANCED_MODE_PAIRS) {
      if (itemById.has(pair[0]) && itemById.has(pair[1])) {
        pairById.set(pair[0], pair);
        pairById.set(pair[1], pair);
      }
    }
    const rendered = new Set();
    for (const item of items) {
      if (rendered.has(item.id)) continue;
      const pair = pairById.get(item.id);
      if (pair) {
        const [light, dark, zh, en] = pair;
        this.renderModePair(parent, itemById.get(light), itemById.get(dark), this.plugin.language === "zh" ? zh : en);
        rendered.add(light);
        rendered.add(dark);
      } else {
        this.renderItem(parent, item);
      }
    }
  }


  renderModePair(parent, light, dark, title) {
    const setting = new Setting(parent).setName(title);
    setting.settingEl.addClass("bysan-dual-mode-setting", "bysan-theme-pair");
    const details = [light, dark].map(item =>
      [item.id, item.title, localised(item, "title", this.plugin.language), this.controlDescription(item, "")]
        .filter(Boolean).join(" "));
    setting.settingEl.dataset.bysanSearch = [title, ...details].join(" ").toLowerCase();
    for (const [mode, item] of [["light", light], ["dark", dark]]) {
      const label = this.plugin.t(mode === "light" ? "theme.light" : "theme.dark");
      const group = setting.controlEl.createDiv({
        cls: "bysan-theme-mode-card",
        attr: { "data-bysan-setting-id": item.id }
      });
      group.createSpan({ cls: `bysan-mode-label bysan-mode-label-${mode}`, text: label });
      const previous = new Set(setting.controlEl.children);
      this.renderControl(setting, item, `${title} · ${label}`);
      for (const child of [...setting.controlEl.children]) {
        if (previous.has(child)) continue;
        if (child.matches("input, select")) child.setAttribute("aria-label", `${title} · ${label}`);
        group.appendChild(child);
      }
      group.title = this.controlDescription(item, localised(item, "description", this.plugin.language));
    }
  }


  scopeFor(item) {
    const headings = this.scopeHeadings.get(item) || [];
    const meaningful = headings
      .filter((heading) => Number(heading.level || 2) >= 2)
      .slice(-2)
      .map((heading) => (localised(heading, "title", this.plugin.language) || heading.id)
        .replace(/^\s*\d+(?:\.\d+)*[.、]?\s*/, "")
        .trim())
      .filter(Boolean);
    if (meaningful.length) return meaningful.join(" › ");
    return this.plugin.language === "zh" ? "Obsidian 全局界面" : "Global Obsidian interface";
  }


  formattedDefault(item, mode) {
    const value = this.defaultValueFor(item, mode);
    if (item.type === "variable-themed-color") {
      const color = parseColor(value);
      if (!color.valid) return String(value || "");
      return `${color.hex.toUpperCase()} · ${Math.round(color.alpha * 100)}%`;
    }
    if (item.type === "class-toggle") {
      const enabled = Boolean(item.default);
      return this.plugin.language === "zh"
        ? (enabled ? "开启" : "关闭")
        : (enabled ? "On" : "Off");
    }
    if (["class-select", "variable-select"].includes(item.type)) {
      const selected = (item.options || []).find((option) => String(option?.value) === String(item.default));
      return selected
        ? optionLabel(selected.label || selected.value, this.plugin.language)
        : String(item.default || (this.plugin.language === "zh" ? "默认 / 空" : "Default / empty"));
    }
    if (!isDefined(value) || String(value).trim() === "") {
      return this.plugin.language === "zh" ? "继承 Obsidian / 当前主题" : "Inherited from Obsidian / current theme";
    }
    if (["variable-number", "variable-number-slider"].includes(item.type)
      && item.format
      && !String(value).trim().endsWith(item.format)) {
      return `${value}${item.format}`;
    }
    return String(value);
  }


  controlDescription(item, original) {
    const scope = this.scopeFor(item);
    let defaults;
    if (item.type === "variable-themed-color") {
      const light = this.formattedDefault(item, "light");
      const dark = this.formattedDefault(item, "dark");
      defaults = this.plugin.language === "zh"
        ? `浅色 ${light}；深色 ${dark}`
        : `Light ${light}; dark ${dark}`;
    } else {
      defaults = this.formattedDefault(item);
    }
    const identifier = String(item.type || "").startsWith("variable-")
      ? `--${item.id}`
      : item.id;
    const detail = this.plugin.language === "zh"
      ? `作用区域：${scope}；默认值：${defaults}；标识：${identifier}`
      : `Scope: ${scope}; default: ${defaults}; identifier: ${identifier}`;
    return original ? `${original} · ${detail}` : detail;
  }


  renderItem(containerEl, item, presentation = null) {
    const title = presentation?.name || localised(item, "title", this.plugin.language) || item.id;
    const description = localised(item, "description", this.plugin.language);
    const setting = new Setting(containerEl).setName(title);
    setting.settingEl.addClass("bysan-theme-setting-item");
    setting.settingEl.addClass(`bysan-control-type-${item.type}`);
    setting.settingEl.dataset.bysanSettingId = item.id;

    if (item.type === "heading") {
      if (description) setting.setDesc(description);
      setting.settingEl.dataset.bysanSearch = `${title} ${item.title || ""} ${description} ${item.id}`.toLowerCase();
      setting.setHeading();
      setting.settingEl.addClass(`bysan-theme-heading-${item.level || 2}`);
      setting.settingEl.id = this.headingAnchors.get(item);
      if (item.level === 1) {
        const sectionId = this.sectionIdForHeading(title);
        if (sectionId) setting.settingEl.id = `bysan-section-${sectionId}`;
      }
      return;
    }

    if (item.type === "info-text") return;
    const controlDescription = this.controlDescription(item, description);
    if (!presentation?.compact) {
      const userDescription = /^--[\w-]+$/.test(description.trim()) ? "" : description;
      setting.setDesc(presentation?.scope ?? userDescription);
    }
    setting.descEl.title = controlDescription;
    setting.infoEl.setAttribute("title", controlDescription);
    setting.settingEl.dataset.bysanSearch = `${title} ${item.title || ""} ${controlDescription} ${item.id}`.toLowerCase();
    this.renderControl(setting, item, title, presentation);
  }

  renderControl(setting, item, title, presentation = null) {
    const update = value => {
      const pending = this.plugin.updateThemeSetting(item.id, value);
      presentation?.onChange?.();
      return pending;
    };
    if (isFontFamilySetting(item)) {
      this.addFontPicker(setting, item, title);
      return;
    }
    const choices = item.type === "variable-text" && cssStyleChoices(item.id);
    if (choices) {
      addStyleDropdown(setting, {
        language: this.plugin.language, label: title, choices, stored: this.stored[item.id],
        defaultValue: this.defaultValueFor(item),
        save: value => this.plugin.updateThemeSetting(item.id, value),
        reset: () => this.plugin.resetThemeSetting(item.id)
      });
      return;
    }
    if (item.type === "class-toggle") {
      const invert = value => Boolean(value) !== Boolean(presentation?.invertToggle);
      setting.addToggle((toggle) => toggle
        .setValue(invert(this.valueFor(item)))
        .onChange(value => update(invert(value))));
      return;
    }

    if (["class-select", "variable-select"].includes(item.type)) {
      setting.addDropdown((dropdown) => {
        if (item.allowEmpty) dropdown.addOption("", this.plugin.t("theme.empty"));
        for (const option of item.options || []) {
          if (isDefined(option?.value)) {
            dropdown.addOption(String(option.value), optionLabel(option.label || option.value, this.plugin.language));
          }
        }
        dropdown.setValue(String(this.valueFor(item) ?? ""));
        dropdown.onChange(update);
      });
      return;
    }

    if (item.type === "variable-themed-color") {
      this.addThemedColorControls(setting, item);
      return;
    }

    const fontSize = /^(?:font-size-|h[1-6]-size$|inline-title-size$|list-ul-marker-size(?:-[1-4])?$)/.test(item.id);
    if (fontSize) {
      setting.settingEl.addClass("bysan-stepper-setting");
      const read = () => this.readPointSize(setting, item);
      this.plugin.addPointStepper(setting.controlEl, {
        label: title, read,
        save: value => this.plugin.updateThemeSetting(item.id, `${value}pt`),
        reset: async () => {
          await this.plugin.resetThemeSetting(item.id);
          return read();
        }
      });
      return;
    }
    const spec = numericThemeSpec(item);
    if (spec) {
      setting.settingEl.addClass("bysan-stepper-setting");
      const read = () => this.displayValueFor(item) ?? "";
      const options = {
        label: title,
        language: this.plugin.language,
        value: read(),
        save: value => this.plugin.updateThemeSetting(item.id, value),
        reset: async () => {
          await this.plugin.resetThemeSetting(item.id);
          return read();
        }
      };
      if (item.type !== "variable-text") {
        addNumericStepper(setting.controlEl, { ...spec, ...options, slider: item.type === "variable-number-slider" });
      } else {
        const unitFor = value => splitCssDimension(value)?.unit || spec.unit;
        const property = /padding/.test(item.id) ? "padding-bottom"
          : /radius/.test(item.id) ? "border-radius"
          : /margin/.test(item.id) ? "margin-left"
          : /(?:underline|border|colorful-indentation)-width$/.test(item.id) ? "border-width"
          : item.id === "image-max-width" ? "max-width" : "width";
        const win = setting.controlEl.ownerDocument.defaultView;
        addValueStepper(setting.controlEl, {
          ...options,
          split: value => splitCssDimension(value) || { value, unit: "" },
          edit: value => {
            const trimmed = value.trim();
            if (!trimmed) return null;
            const cssValue = Number.isFinite(Number(trimmed))
              ? `${Number(trimmed)}${unitFor(read())}` : trimmed;
            return win.CSS.supports(property, cssValue) ? cssValue : null;
          },
          adjust: (value, direction) => {
            const current = splitCssDimension(value) || (/^[+-]?0(?:\.0+)?$/.test(value.trim())
              ? { value: "0", unit: spec.unit } : null);
            if (!current) return null;
            const delta = /^(?:em|rem|vh|vw|ch|ex|lh)$/i.test(current.unit) ? 0.1 : 1;
            const next = Number((Number(current.value) + direction * delta).toFixed(6));
            return `${property === "margin-left" ? next : Math.max(0, next)}${current.unit}`;
          }
        });
      }
      return;
    }

    let input;
    setting.addText((text) => {
      input = text;
      text.setPlaceholder(this.plugin.t("theme.cssValue"))
        .setValue(String(this.displayValueFor(item) ?? ""))
        .onChange(value => this.plugin.updateThemeSetting(item.id, value));
    });
    if (presentation) {
      const label = this.plugin.language === "zh" ? "恢复默认值" : "Restore default";
      const reset = setting.controlEl.createEl("button", {
        text: "↺",
        cls: "clickable-icon bysan-color-reset",
        attr: { type: "button", title: label, "aria-label": label }
      });
      reset.addEventListener("click", async () => {
        await this.plugin.resetThemeSetting(item.id);
        input.setValue(String(this.displayValueFor(item) ?? ""));
      });
    }
  }

  readPointSize(setting, item) {
    const row = setting.settingEl;
    const container = row.closest(".bysan-appearance-layout") || row.closest(".bysan-settings-section");
    const target = {
      "inline-title-size": ".bysan-appearance-sample .inline-title",
      "font-size-latex": ".bysan-appearance-sample .math-block mjx-container",
      "font-size-outline": ".bysan-sample-nav .outline .tree-item-self",
      "font-size-folder-and-file": ".bysan-sample-nav .nav-file-title"
    }[item.id] || (/^h([1-6])-size$/.exec(item.id)?.[1] && `.bysan-appearance-sample ${item.id.slice(0, 2)}`);
    const sample = target && container?.querySelector(target);
    if (sample) return readFontPoints(sample);
    const doc = row.ownerDocument;
    const probe = doc.createElement("span");
    probe.style.cssText = "position:absolute;visibility:hidden;pointer-events:none";
    probe.style.fontSize = String(this.displayValueFor(item) ?? "");
    row.append(probe);
    try {
      return readFontPoints(probe);
    } finally {
      probe.remove();
    }
  }

  addFontPicker(setting, item, title) {
    const zh = this.plugin.language === "zh";
    const t = (cn, en) => zh ? cn : en;
    const monospace = CODE_FONT_IDS.has(item.id);
    const obsidianFont = monospace ? "var(--font-monospace, monospace)" :
      item.id === "font-text-theme" ? "var(--font-text-override, var(--font-default, sans-serif))" : "var(--font-text, sans-serif)";
    const labels = {
      default: t("沿用默认字体", "Use default font"),
      obsidian: t("跟随 Obsidian 字体", "Use Obsidian font"),
      custom: t("手动输入字体…", "Enter a font manually…")
    };
    const current = String(this.stored[item.id] ?? "");
    const family = selectedFontName(current);
    let selected = !current ? "default" : current === obsidianFont ? "obsidian" : family ? `family:${family}` : "custom";
    const defaultFont = String(this.defaultValueFor(item) ||
      (monospace ? "var(--bysan-code-font, monospace)" : "var(--font-text, sans-serif)"));
    const previewStack = key => key === "obsidian" ? obsidianFont : key === "default" ? defaultFont
      : key.startsWith("family:") ? fontStack(key.slice(7), monospace) : this.stored[item.id];
    const win = setting.controlEl.ownerDocument.defaultView;
    const listId = `bysan-font-picker-list-${item.id}`;
    const panelId = `bysan-font-picker-${item.id}`;
    setting.settingEl.addClass("bysan-font-control");
    const trigger = setting.controlEl.createEl("button", {
      cls: "bysan-font-trigger", attr: { type: "button", popovertarget: panelId,
        "aria-controls": panelId, "aria-haspopup": "dialog", "aria-expanded": "false" }
    });
    const triggerLabel = trigger.createSpan({ cls: "bysan-font-trigger-label" });
    trigger.createSpan({ text: "▾", cls: "bysan-font-arrow", attr: { "aria-hidden": "true" } });
    const syncTrigger = (font) => {
      const chosen = selected.slice(7);
      const known = font || (selected.startsWith("family:") &&
        fontChoices(this.localFontFaces || [{ family: chosen }], chosen, monospace, this.plugin.language)
          .find(font => font.family === chosen));
      triggerLabel.textContent = labels[selected] || known?.displayName || chosen;
      triggerLabel.style.fontFamily = previewStack(selected) || "";
      trigger.title = known?.label || triggerLabel.textContent;
      trigger.setAttribute("aria-label", `${title}：${trigger.title}`);
    };
    syncTrigger();
    const panel = setting.controlEl.createDiv({
      cls: "bysan-font-popover", attr: { id: panelId, popover: "auto", role: "dialog", "aria-label": title }
    });
    const header = panel.createDiv({ cls: "bysan-font-search" });
    const search = header.createEl("input", {
      attr: { type: "search", role: "combobox", autocomplete: "off", "aria-expanded": "true",
        "aria-controls": listId, "aria-label": t("搜索已安装字体", "Search installed fonts"),
        placeholder: t("搜索…", "Search…") }
    });
    const rescanLabel = t("重新扫描本机字体", "Rescan installed fonts");
    const rescan = header.createEl("button", {
      text: "↻", cls: "bysan-font-rescan",
      attr: { type: "button", "aria-label": rescanLabel, title: rescanLabel }
    });
    const list = panel.createDiv({ cls: "bysan-font-list", attr: { id: listId, role: "listbox", "aria-label": title } });
    const status = panel.createDiv({ cls: "bysan-font-status", attr: { role: "status" } });
    const input = setting.controlEl.createEl("input", {
      cls: "bysan-manual-font",
      attr: { type: "text", placeholder: t("字体名称或备用字体列表", "Font family or fallback stack"),
        "aria-label": `${title}：${labels.custom}` }
    });
    input.value = selected === "custom" || family ? current : "";
    input.hidden = selected !== "custom";
    input.addEventListener("input", () => input.setCustomValidity(""));
    input.addEventListener("change", () => {
      if (input.hidden) return;
      const value = input.value.trim();
      if (value && !win.CSS.supports("font-family", value)) {
        input.setCustomValidity(t("请输入有效的字体名称或字体列表。", "Enter a valid font family or font stack."));
        input.reportValidity();
        return;
      }
      if (value) {
        triggerLabel.style.fontFamily = value;
        void this.plugin.updateThemeSetting(item.id, value);
      }
      else {
        selected = "default";
        syncTrigger();
        input.hidden = true;
        void this.plugin.resetThemeSetting(item.id);
      }
    });
    input.addEventListener("keydown", event => {
      if (event.key === "Enter") {
        event.preventDefault();
        input.blur();
      }
    });
    const choose = (key, font) => {
      selected = key;
      syncTrigger(font);
      panel.hidePopover();
      input.hidden = key !== "custom";
      input.setCustomValidity("");
      if (key === "custom") {
        input.value = String(this.stored[item.id] ?? "");
        input.focus();
        return;
      }
      trigger.focus();
      if (key === "default") void this.plugin.resetThemeSetting(item.id);
      else void this.plugin.updateThemeSetting(item.id, previewStack(key));
    };

    let options = [], active = -1, loading = false;
    const positionPanel = () => {
      const rect = trigger.getBoundingClientRect();
      const width = Math.min(win.innerWidth - 16, Math.max(rect.width, 196));
      const below = win.innerHeight - rect.bottom - 12;
      const above = rect.top - 12;
      const openAbove = below < 330 && above > below;
      panel.style.width = `${width}px`;
      panel.style.left = `${Math.max(8, Math.min(rect.right - width, win.innerWidth - width - 8))}px`;
      panel.style.top = openAbove ? "auto" : `${rect.bottom + 4}px`;
      panel.style.bottom = openAbove ? `${win.innerHeight - rect.top + 4}px` : "auto";
      panel.style.maxHeight = `${Math.min(340, Math.max(90, openAbove ? above : below))}px`;
    };
    const highlight = (index, scroll = false) => {
      options[active]?.classList.remove("is-active");
      active = index;
      if (index < 0) search.removeAttribute("aria-activedescendant");
      else {
        const option = options[index];
        search.setAttribute("aria-activedescendant", option.id);
        option.classList.add("is-active");
        if (scroll) option.scrollIntoView({ block: "nearest" });
      }
    };
    const render = () => {
      const query = search.value.trim();
      const installed = this.localFontFaces?.length > 0;
      const faces = installed ? this.localFontFaces : (monospace ? CODE_FONTS : Object.keys(TEXT_FONTS)).map(family => ({ family }));
      const matches = fontChoices(faces, query, monospace, this.plugin.language);
      list.empty();
      options = [];
      active = -1;
      const add = (key, font) => {
        const label = labels[key] || font.label;
        const option = list.createDiv({
          cls: "bysan-font-option", attr: { role: "option", id: `${listId}-${options.length}`,
            "aria-label": label, "aria-selected": String(selected === key) }
        });
        option.createSpan({ text: font?.displayName || label, cls: "bysan-font-option-label", attr: { title: label } });
        if (key !== "custom") {
          option.addClass("bysan-font-option-with-sample");
          option.style.fontFamily = previewStack(key) || "";
          const sample = option.createDiv({ cls: "bysan-font-sample", attr: { "aria-hidden": "true" } });
          for (const [lang, text] of [["zh-CN", "中文"], ["ja", "日本語"], ["en", "English"]]) {
            sample.createSpan({ text, attr: { lang } });
          }
        }
        option.addEventListener("mousedown", event => event.preventDefault());
        option.addEventListener("click", () => choose(key, font));
        options.push(option);
      };
      let pinned;
      if (!query) {
        add("default");
        pinned = matches.find(option => selected === `family:${option.family}`);
        if (pinned) add(selected, pinned);
        add("obsidian");
        add("custom");
      }
      for (const option of matches) {
        if (option !== pinned) add(`family:${option.family}`, option);
      }
      list.scrollTop = 0;
      highlight(query && options.length ? 0 : -1);
      status.textContent = loading ? t("正在扫描本机字体…", "Finding installed fonts…")
        : !installed ? t("无法读取本机字体，已显示常用字体。", "Installed fonts unavailable; showing common fonts.")
        : !matches.length ? t("没有匹配的字体", "No matching fonts")
        : t(`${matches.length} 个本机字体`, `${matches.length} installed fonts`);
      status.classList.toggle("bysan-font-status-quiet", !loading && installed && matches.length > 0);
    };
    const scan = async (force = false) => {
      if (this.localFontFaces && !force) return;
      if (!this.localFontRequest) {
        this.localFontRequest = loadLocalFontFaces(win).catch(() => []).then(fonts => {
          this.localFontFaces = fonts;
          this.localFontRequest = null;
        });
      }
      loading = true;
      render();
      await this.localFontRequest;
      loading = false;
      if (panel.matches(":popover-open")) {
        syncTrigger();
        render();
      }
    };
    panel.addEventListener("beforetoggle", event => {
      if (event.newState !== "open") return;
      search.value = "";
      render();
      positionPanel();
      void scan();
    });
    panel.addEventListener("toggle", () => {
      const open = panel.matches(":popover-open");
      trigger.setAttribute("aria-expanded", String(open));
      if (open) search.focus();
    });
    rescan.addEventListener("click", () => { search.focus(); void scan(true); });
    search.addEventListener("input", render);
    search.addEventListener("keydown", event => {
      if (event.isComposing) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        panel.hidePopover();
        trigger.focus();
        return;
      }
      if (!options.length) return;
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        event.preventDefault();
        const next = active < 0 ? (event.key === "ArrowDown" ? 0 : options.length - 1)
          : (active + (event.key === "ArrowDown" ? 1 : -1) + options.length) % options.length;
        highlight(next, true);
      } else if (event.key === "Enter" && active >= 0) {
        event.preventDefault();
        options[active].click();
      }
    });
  }


  addThemedColorControls(setting, item) {
    setting.settingEl.addClass("bysan-theme-color-setting", "bysan-color-row");
    setting.settingEl.dataset.bysanSettingId = item.id;
    const refreshers = [];
    for (const mode of ["light", "dark"]) {
      const label = mode === "light" ? this.plugin.t("theme.light") : this.plugin.t("theme.dark");
      const parsed = parseColor(this.displayValueFor(item, mode));
      const group = setting.controlEl.createDiv({
        cls: `bysan-color-mode bysan-theme-color-mode bysan-theme-color-mode-${mode}`
      });
      group.createSpan({
        cls: `bysan-mode-label bysan-mode-label-${mode}`,
        text: label
      });
      const appendNewControls = (callback) => {
        const existing = new Set(setting.controlEl.children);
        callback();
        for (const child of Array.from(setting.controlEl.children)) {
          if (!existing.has(child) && child !== group) group.appendChild(child);
        }
      };
      let pickerComponent;
      let refreshOpacity;
      let syncingControls = false;
      const colorLabel = this.plugin.t("theme.colorTitle", { mode: label });
      const updateTooltip = (hex, alpha) => {
        const value = (item.opacity ? colorWithAlpha(hex, alpha) : hex).toUpperCase();
        pickerComponent.colorPickerEl.title = `${colorLabel} · ${value}`;
      };
      appendNewControls(() => setting.addColorPicker((picker) => {
        pickerComponent = picker;
        picker.setValue(parsed.hex);
        picker.colorPickerEl.setAttribute("aria-label", `${setting.nameEl.textContent} · ${colorLabel}`);
        updateTooltip(parsed.hex, parsed.alpha);
        picker.onChange((hex) => {
          if (syncingControls) return;
          const current = parseColor(this.displayValueFor(item, mode));
          const inheritedTransparent = current.alpha === 0 && !isDefined(this.stored[item.id]?.[mode]);
          const alpha = inheritedTransparent ? 1 : current.alpha;
          updateTooltip(hex, alpha);
          this.updateThemedColor(item, mode, hex, alpha);
          if (inheritedTransparent) refreshOpacity?.();
        });
      }));
      if (item.opacity) {
        appendNewControls(() => {
          const opacityLabel = this.plugin.t("theme.opacityTitle", { mode: label });
          const read = () => Number(parseColor(this.displayValueFor(item, mode)).alpha.toFixed(2));
          refreshOpacity = addNumericStepper(setting.controlEl, {
            label: `${setting.nameEl.textContent} · ${opacityLabel}`, language: this.plugin.language,
            value: read(), read, min: 0, max: 1, step: 0.01, slider: true,
            save: alpha => {
              const current = parseColor(this.displayValueFor(item, mode));
              updateTooltip(current.hex, alpha);
              this.updateThemedColor(item, mode, current.hex, alpha);
            }
          });
        });
      }
      const resetLabel = this.plugin.t("color.resetTheme", { mode: label });
      const reset = group.createEl("button", {
        cls: "clickable-icon bysan-color-reset", text: "↺",
        attr: { type: "button", "aria-label": resetLabel, title: resetLabel }
      });
      const syncControls = () => {
        const restored = parseColor(this.displayValueFor(item, mode));
        syncingControls = true;
        try {
          pickerComponent?.setValue(restored.hex);
          refreshOpacity?.();
          updateTooltip(restored.hex, restored.alpha);
        } finally {
          syncingControls = false;
        }
      };
      refreshers.push(syncControls);
      reset.addEventListener("click", async () => {
        await this.plugin.clearThemeColorMode(item.id, mode);
        this.refreshDisplayDefaults();
        syncControls();
      });
    }
    const refresh = () => {
      if (setting.settingEl.isConnected) refreshers.forEach(sync => sync());
    };
    if (item.id === NOTE_PAPER_COLOR_IDS[0]) this.refreshNotePaperControl = refresh;
    if (item.liveDefault) this.liveColourRefreshers?.set(item.id, refresh);
  }


  updateThemedColor(item, mode, hex, alpha) {
    const current = this.stored[item.id] && typeof this.stored[item.id] === "object"
      ? this.stored[item.id]
      : {};
    this.plugin.updateThemeSetting(item.id, {
      ...current,
      [mode]: colorWithAlpha(hex, item.opacity ? alpha : 1)
    });
  }


  filterRows(containerEl, query) {
    const normalized = String(query || "").trim().toLowerCase();
    const rows = Array.from(containerEl.querySelectorAll(".setting-item:not(.setting-item-heading)"))
      .filter(row => !row.closest(".bysan-settings-nav"));
    const matches = [];

    for (const row of rows) {
      const searchable = String(
        row.dataset.bysanSearch || row.textContent || ""
      ).toLowerCase();
      const matched = !normalized || searchable.includes(normalized);
      row.classList.toggle("bysan-setting-filtered", Boolean(normalized) && !matched);
      if (normalized && matched && !row.closest("[data-bysan-list-conditional][hidden]")) matches.push(row);
    }

    return matches;
  }
}


module.exports = { ThemeControls, addValueStepper, addNumericStepper, numericThemeSpec, splitCssDimension, addPointSizeStepper, readFontPoints, addStyleDropdown, FONT_WEIGHTS, ADVANCED_THEME_TOPICS };
