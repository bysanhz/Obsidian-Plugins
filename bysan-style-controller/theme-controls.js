const Setting = globalThis.__bysanObsidianSetting;

/* These Blue Topaz settings already have clearer, Bysan-specific controls in
 * the first part of the settings page. Keeping one owner prevents two widgets
 * from fighting over the same body class. */
const MANUAL_SETTING_IDS = new Set([
  "background-settings-workplace-background-image",
  "background-settings-workplace-theme-light",
  "background-settings-workplace-theme-dark"
]);

/* Attribution remains in THIRD_PARTY_NOTICES.md. Promotional footer entries
 * from the bundled theme metadata are not plugin settings and must not leak
 * into Bysan Style Controller's settings page. */
const HIDDEN_CATALOG_IDS = new Set([
  "topaz-community",
  "bt-buyacoffe",
  "bt-github"
]);

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

function localised(item, key, language) {
  if (language === "en") return item[key] || "";
  if (key === "description") return item[`${key}.zh`] || "";
  return chineseTitle(item[`${key}.zh`] || item[key] || "");
}

function optionLabel(label, language) {
  if (language === "en") {
    return String(label || "")
      .replace(/^榛子巧克力\s*/, "")
      .replace(/^魔方\s*/, "");
  }
  const text = String(label || "");
  if (ZH_OPTION[text]) return ZH_OPTION[text];
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
    this.probeFrame = null;
    this.items.forEach((item, index) => {
      if (item.type === "heading") this.headingAnchors.set(item, `bysan-theme-heading-${index}`);
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


  valueFor(item, mode) {
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
      return this.displayDefaults.get(`${item.id}:${mode}`) ?? item[`default-${mode}`];
    }
    if (isDefined(storedValue)) return storedValue;
    return this.displayDefaults.get(item.id) ?? item.default;
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
    const fallbackVariable = COLOR_FALLBACK_VARIABLES.get(item.id);
    const expression = item.format === "hsl-split"
      ? `hsla(var(--${item.id}-h), var(--${item.id}-s), var(--${item.id}-l), var(--${item.id}-a, 1))`
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
    this.displayDefaults.clear();

    for (const mode of ["light", "dark"]) {
      body.removeAttribute("style");
      body.className = [...baseClasses, `theme-${mode}`].join(" ");
      root.className = `theme-${mode}`;
      this.applyStoredVariablesToProbe(body, mode);
      const bodyStyle = probeDocument.defaultView.getComputedStyle(body);
      for (const item of this.controlItems) {
        if (item.type === "variable-themed-color") {
          const resolved = this.resolvedProbeColor(item, probeDocument, body);
          if (resolved) this.displayDefaults.set(`${item.id}:${mode}`, resolved);
          continue;
        }
        if (mode !== "light" || !String(item.type || "").startsWith("variable-")) continue;
        const rawValue = bodyStyle.getPropertyValue(`--${item.id}`).trim();
        if (!rawValue) continue;
        if (["variable-number", "variable-number-slider"].includes(item.type)) {
          const numeric = Number.parseFloat(rawValue);
          if (Number.isFinite(numeric)) this.displayDefaults.set(item.id, numeric);
        } else {
          this.displayDefaults.set(item.id, rawValue);
        }
      }
    }
  }


  destroy() {
    this.probeFrame?.remove();
    this.probeFrame = null;
    this.displayDefaults.clear();
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
      return;
    }
    if (item.type === "class-select") {
      const selected = this.valueFor(item);
      for (const option of item.options || []) {
        if (option?.value) document.body.classList.toggle(option.value, option.value === selected);
      }
      return;
    }
    if (String(item.type || "").startsWith("variable-")) this.applyVariable(item);
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


  render(containerEl) {
    this.refreshDisplayDefaults();
    const introduction = new Setting(containerEl)
      .setName(this.plugin.t("theme.title", { count: this.count }))
      .setDesc(this.plugin.t("theme.desc"))
      .setHeading();
    introduction.settingEl.addClass("bysan-theme-catalog-title");
    introduction.settingEl.id = "bysan-section-theme";

    for (const item of this.items) this.renderItem(containerEl, item);
  }


  renderItem(containerEl, item) {
    const title = localised(item, "title", this.plugin.language) || item.id;
    const description = localised(item, "description", this.plugin.language);
    const setting = new Setting(containerEl).setName(title);
    if (description) setting.setDesc(description);
    setting.settingEl.addClass("bysan-theme-setting-item");
    setting.settingEl.dataset.bysanSettingId = item.id;
    setting.settingEl.dataset.bysanSearch = `${title} ${item.title || ""} ${description} ${item.id}`.toLowerCase();

    if (item.type === "heading") {
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

    if (item.type === "class-toggle") {
      setting.addToggle((toggle) => toggle
        .setValue(Boolean(this.valueFor(item)))
        .onChange((value) => this.plugin.updateThemeSetting(item.id, value)));
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
        dropdown.onChange((value) => this.plugin.updateThemeSetting(item.id, value));
      });
      return;
    }

    if (item.type === "variable-themed-color") {
      this.addThemedColorControls(setting, item);
      return;
    }

    if (item.type === "variable-number-slider") {
      setting.addSlider((slider) => slider
        .setLimits(Number(item.min), Number(item.max), Number(item.step || 1))
        .setDynamicTooltip()
        .setValue(Number(this.displayValueFor(item)))
        .onChange((value) => this.plugin.updateThemeSetting(item.id, value)));
      return;
    }

    if (item.type === "variable-number") {
      setting.addText((text) => {
        text.inputEl.type = "number";
        text.setValue(String(this.displayValueFor(item)));
        text.onChange((value) => {
          const number = Number(value);
          if (Number.isFinite(number)) this.plugin.updateThemeSetting(item.id, number);
        });
      });
      return;
    }

    setting.addText((text) => text
      .setPlaceholder(this.plugin.t("theme.cssValue"))
      .setValue(String(this.displayValueFor(item) ?? ""))
      .onChange((value) => this.plugin.updateThemeSetting(item.id, value)));
  }


  sectionIdForHeading(title) {
    if (/^1[.、\s]/.test(title)) return "theme-general";
    if (/^2[.、\s]/.test(title)) return "theme-details";
    if (/^3[.、\s]/.test(title)) return "theme-plugins";
    if (/^4[.、\s]/.test(title)) return "theme-builtins";
    return null;
  }


  navigationGroups() {
    const groups = [];
    let current = null;
    for (const item of this.items) {
      if (item.type !== "heading") continue;
      const title = localised(item, "title", this.plugin.language) || item.id;
      if (item.level === 1) {
        const majorId = this.sectionIdForHeading(title);
        current = majorId ? { label: title, entries: [] } : null;
        if (current) groups.push(current);
        continue;
      }
      if (!current || item.level > 4) continue;
      current.entries.push({
        label: title,
        anchor: this.headingAnchors.get(item)
      });
    }
    return groups.filter((group) => group.entries.length);
  }


  addThemedColorControls(setting, item) {
    setting.settingEl.addClass("bysan-theme-color-setting");
    setting.settingEl.dataset.bysanSettingId = item.id;
    for (const mode of ["light", "dark"]) {
      const label = mode === "light" ? this.plugin.t("theme.light") : this.plugin.t("theme.dark");
      const parsed = parseColor(this.displayValueFor(item, mode));
      const group = setting.controlEl.createDiv({
        cls: `bysan-theme-color-mode bysan-theme-color-mode-${mode}`
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
      let valueLabel;
      appendNewControls(() => setting.addColorPicker((picker) => {
        pickerComponent = picker;
        picker.setValue(parsed.hex);
        picker.colorPickerEl?.setAttribute("title", this.plugin.t("theme.colorTitle", { mode: label }));
        picker.onChange((hex) => {
          const current = parseColor(this.displayValueFor(item, mode));
          valueLabel?.setText(colorWithAlpha(hex, item.opacity ? current.alpha : 1).toUpperCase());
          this.updateThemedColor(item, mode, hex, current.alpha);
        });
      }));
      valueLabel = group.createSpan({
        cls: "bysan-theme-color-value",
        text: colorWithAlpha(parsed.hex, item.opacity ? parsed.alpha : 1).toUpperCase()
      });
      let sliderComponent;
      if (item.opacity) {
        appendNewControls(() => setting.addSlider((slider) => {
          sliderComponent = slider;
          slider.setLimits(0, 1, 0.01).setDynamicTooltip().setValue(parsed.alpha);
          slider.sliderEl?.setAttribute("title", this.plugin.t("theme.opacityTitle", { mode: label }));
          slider.onChange((alpha) => {
            const current = parseColor(this.displayValueFor(item, mode));
            valueLabel?.setText(colorWithAlpha(current.hex, alpha).toUpperCase());
            this.updateThemedColor(item, mode, current.hex, alpha);
          });
        }));
      }
      appendNewControls(() => setting.addExtraButton((button) => {
        button
          .setIcon("rotate-ccw")
          .setTooltip(this.plugin.t("color.resetTheme", { mode: label }))
          .onClick(async () => {
            await this.plugin.clearThemeColorMode(item.id, mode);
            this.refreshDisplayDefaults();
            const restored = parseColor(this.displayValueFor(item, mode));
            pickerComponent?.setValue(restored.hex);
            sliderComponent?.setValue(restored.alpha);
            valueLabel?.setText(colorWithAlpha(restored.hex, item.opacity ? restored.alpha : 1).toUpperCase());
          });
        button.extraSettingsEl?.addClass("bysan-color-reset");
      }));
    }
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
    const rows = Array.from(containerEl.querySelectorAll(".setting-item"))
      .filter((row) => !row.closest(".bysan-settings-nav"));
    const matches = [];

    for (const row of rows) {
      const searchable = String(
        row.dataset.bysanSearch || row.textContent || ""
      ).toLowerCase();
      const matched = !normalized || searchable.includes(normalized);
      row.classList.toggle("bysan-setting-filtered", Boolean(normalized) && !matched);
      if (normalized && matched) matches.push(row);
    }

    return matches;
  }
}


module.exports = { ThemeControls };
