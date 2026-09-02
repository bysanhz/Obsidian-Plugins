const TEXT = {
  zh: {
    "app.description": "统一提供按界面位置组织的 Bysan 样式与可开关功能模块；不依赖外部主题，公式编号保持独立。",
    "language.name": "界面语言",
    "language.desc": "默认跟随 Obsidian；也可以仅为本插件固定中文或英文。",
    "language.auto": "跟随 Obsidian",
    "language.zh": "中文",
    "language.en": "English",
    "nav.title": "功能导航",
    "section.preset": "风格预设",
    "section.workspace": "工作区",
    "section.code": "代码块",
    "section.components": "表格与引用",
    "section.reset": "恢复默认",
    "preset.desc": "一个预设同时保存浅色、深色及所有界面区域的样式设置。",
    "preset.current": "当前风格",
    "preset.currentUnsaved": "当前设置（尚未保存）",
    "preset.currentUnsavedLong": "当前设置（尚未保存为风格）",
    "preset.default": "Bysan 默认（浅色/深色自适应）",
    "preset.modified": "已修改",
    "preset.saved": "已保存",
    "preset.currentDesc": "{name} · {state}；切换明暗模式会自动使用同一风格中的对应配色。",
    "preset.saveAs": "另存为新风格",
    "preset.saveAsDesc": "输入名称后保存当前全部设置，原有风格不会被覆盖。",
    "preset.example": "例如：论文浅绿 / 夜间阅读",
    "preset.save": "保存",
    "preset.rename": "重命名当前风格",
    "preset.renameDesc": "只修改显示名称，不改变风格内容、预设 ID 或浅色/深色配置。",
    "preset.newName": "新风格名称",
    "preset.renameButton": "重命名",
    "preset.manage": "管理当前自定义风格",
    "preset.manageDesc": "覆盖会用当前全部设置更新该风格；删除不会改变当前画面。",
    "preset.overwrite": "覆盖保存",
    "preset.delete": "删除",
    "reset.desc": "恢复 Bysan 内置基础主题与内容样式默认值。",
    "reset.button": "恢复默认",
    "workspace.dynamic": "动态工作区背景",
    "workspace.dynamicDesc": "控制插件内置的工作区背景。",
    "workspace.lineRanges": "折叠块显示源行范围",
    "workspace.lineRangesDesc": "实时预览中 Mermaid、公式等多行源码渲染为一个块时显示 6–51，避免看起来从 6 跳到 52。",
    "workspace.lightBg": "浅色背景",
    "workspace.darkBg": "深色背景",
    "workspace.backgrounds": "工作区背景方案",
    "background.note": "笔记纸",
    "background.waves": "波浪",
    "background.animatedWaves": "动态波浪",
    "background.blueMountain": "蓝色山峦",
    "background.customUrl": "自定义网址",
    "background.sky": "天空",
    "background.nightSky": "夜空",
    "background.darkSky": "深色天空",
    "code.theme": "Bysan 代码高亮主题",
    "code.lineNumbers": "编辑视图代码行号",
    "code.lineNumbersDesc": "由插件内置样式显示代码行号。",
    "code.wrapReading": "阅读视图自动换行",
    "code.wrapReadingDesc": "长代码在阅读视图中换行。",
    "code.noWrapLive": "实时预览禁止换行",
    "code.noWrapLiveDesc": "需要横向滚动查看长代码。",
    "code.muteActive": "关闭当前行高亮",
    "code.muteActiveDesc": "不显示代码块当前行背景。",
    "code.blur": "代码框模糊半径",
    "code.blurDesc": "仅在毛玻璃代码框样式下生效。",
    "code.spacing": "代码字间距",
    "code.spacingDesc": "单位 px。",
    "palette.codeBg": "代码块背景",
    "palette.opacity": "代码块背景透明度",
    "palette.opacityDesc": "0 为完全透明，1 为完全不透明。",
    "palette.codeText": "代码块文字",
    "palette.codeBorder": "代码块边框",
    "palette.inlineBg": "行内代码背景",
    "palette.inlineText": "行内代码文字",
    "palette.tableHead": "表头背景",
    "palette.tableStripe": "表格斑马纹",
    "palette.tableHover": "表格悬停背景",
    "palette.tableBorder": "表格边框",
    "palette.quoteBg": "引用块背景",
    "palette.quoteOpacity": "引用块背景透明度",
    "palette.quoteBorder": "引用块边框",
    "palette.marker": "列表标记",
    "components.zebra": "表格斑马纹",
    "components.zebraDesc": "交替显示数据行背景。",
    "components.center": "表格居中",
    "components.centerDesc": "保持实时预览与阅读视图表格居中。",
    "components.quoteSerif": "引用块使用衬线字体",
    "components.quoteSerifDesc": "关闭后跟随正文界面字体。",
    "review.badgeSize": "评论角标大小",
    "review.badgeSizeDesc": "控制选区审阅工具栏生成的评论角标直径；默认 17px，比原先更小。",
    "theme.search": "搜索样式设置",
    "theme.searchDesc": "可按中文名、说明或设置 ID 筛选全部区域。",
    "theme.searchPlaceholder": "例如：标签页、文件树、标题颜色",
    "theme.empty": "默认 / 空",
    "theme.cssValue": "CSS 值",
    "theme.light": "浅色",
    "theme.dark": "深色",
    "theme.colorTitle": "{mode}颜色",
    "theme.opacityTitle": "{mode}透明度",
    "color.reset": "恢复{mode}初始颜色",
    "color.resetTheme": "清除{mode}自定义颜色并使用主题默认值",
    "modal.title": "当前风格有未保存修改",
    "modal.body": "切换风格会替换当前全部样式设置。请选择如何处理尚未保存的修改。",
    "modal.current": "当前：{name}",
    "modal.target": "切换到：{name}",
    "modal.overwriteHint": "“保存后切换”会覆盖已保存风格“{name}”，然后载入目标风格。",
    "modal.newHint": "当前设置尚未保存为自定义风格。若要保存后切换，请先为它输入名称。",
    "modal.newName": "新风格名称",
    "modal.cancel": "取消",
    "modal.discard": "舍弃修改并切换",
    "modal.save": "保存后切换",
    "modal.nameRequired": "请输入新风格名称后再保存。"
    ,"notice.nameRequired": "请先输入风格名称"
    ,"notice.overwritten": "已覆盖风格：{name}"
    ,"notice.saved": "已保存风格：{name}"
    ,"notice.unsaved": "当前风格有未保存修改，请先另存为新风格或覆盖当前风格"
    ,"notice.notFound": "未找到该风格预设"
    ,"notice.loaded": "已载入风格：{name}"
    ,"notice.defaultNoOverwrite": "内置默认风格不可覆盖，请另存为新风格"
    ,"notice.defaultNoRename": "内置默认风格不可重命名"
    ,"notice.emptyName": "风格名称不能为空"
    ,"notice.duplicateName": "已有同名风格，请使用其他名称"
    ,"notice.renamed": "风格已重命名为：{name}"
    ,"notice.deleted": "已删除风格：{name}；当前画面设置仍保留"
    ,"notice.catalogError": "Bysan 样式设置目录加载失败，请检查插件文件"
    ,"notice.baseError": "Bysan 内置基础主题加载失败，请检查插件文件"
    ,"notice.reset": "Bysan 样式已恢复默认值"
    ,"pdf.command": "PDF 分页预览与导出"
    ,"pdf.title": "PDF 预览：{name}"
    ,"pdf.currentNote": "当前笔记"
    ,"pdf.sameOutputHint": "预览与最终 PDF 使用同一份分页 DOM 和打印参数。"
    ,"pdf.paginating": "正在生成分页…"
    ,"pdf.pageCount": "共 {count} 页"
    ,"pdf.pagePrefix": "第"
    ,"pdf.pageTotal": "/ {count} 页"
    ,"pdf.previous": "上一页"
    ,"pdf.next": "下一页"
    ,"pdf.jump": "跳转页码"
    ,"pdf.operations": "预览与导出"
    ,"pdf.paper": "纸张尺寸"
    ,"pdf.orientation": "页面方向"
    ,"pdf.portrait": "纵向"
    ,"pdf.landscape": "横向"
    ,"pdf.margin": "页边距"
    ,"pdf.marginNormal": "默认"
    ,"pdf.marginSmall": "小"
    ,"pdf.marginNone": "无"
    ,"pdf.customMargins": "自定义页边距（mm）"
    ,"pdf.marginTop": "上"
    ,"pdf.marginRight": "右"
    ,"pdf.marginBottom": "下"
    ,"pdf.marginLeft": "左"
    ,"pdf.header": "页眉"
    ,"pdf.footer": "页脚"
    ,"pdf.headerPlaceholder": "例如：课程笔记"
    ,"pdf.footerPlaceholder": "例如：Bysan · {page}"
    ,"pdf.pageNumbers": "显示页码"
    ,"pdf.pageRange": "实际输出页面范围"
    ,"pdf.pageRangeHint": "输入 all，或如 1-3,5；预览保留全部页面，导出仅输出所选页面。"
    ,"pdf.grayscale": "黑白输出"
    ,"pdf.grayscaleHint": "预览与最终 PDF 同时转换为灰阶。"
    ,"pdf.previewZoom": "预览缩放"
    ,"pdf.actualScale": "实际缩放"
    ,"pdf.actualScaleHint": "改变内容尺寸与分页，并原样写入最终 PDF。"
    ,"pdf.refresh": "刷新预览"
    ,"pdf.export": "导出 PDF"
    ,"pdf.directExportHint": "导出仅显示文件保存窗口，不再进入第二套打印设置。"
    ,"pdf.readError": "无法读取当前笔记。"
    ,"pdf.waitForPreview": "请等待分页预览生成完成"
    ,"pdf.exportUnavailable": "当前环境不支持直接 PDF 导出"
    ,"pdf.exporting": "正在导出…"
    ,"pdf.saveTitle": "保存 PDF"
    ,"pdf.exported": "PDF 已导出：{path}"
    ,"pdf.exportFailed": "PDF 导出失败：{message}"
    ,"pdf.openNote": "请先打开一个 Markdown 笔记"
  },
  en: {
    "app.description": "Unified Bysan styles organised by interface location, plus switchable feature modules without an external theme; equation numbering remains independent.",
    "language.name": "Interface language",
    "language.desc": "Follows Obsidian by default, or use a fixed language for this plugin.",
    "language.auto": "Follow Obsidian",
    "language.zh": "中文",
    "language.en": "English",
    "nav.title": "Feature navigation",
    "section.preset": "Style presets",
    "section.workspace": "Workspace",
    "section.code": "Code blocks",
    "section.components": "Tables & quotes",
    "section.reset": "Reset",
    "preset.desc": "A preset stores the light, dark and all interface-region settings together.",
    "preset.current": "Current style",
    "preset.currentUnsaved": "Current settings (not saved)",
    "preset.currentUnsavedLong": "Current settings (not saved as a style)",
    "preset.default": "Bysan Default (light/dark adaptive)",
    "preset.modified": "Modified",
    "preset.saved": "Saved",
    "preset.currentDesc": "{name} · {state}; switching appearance uses the matching palette in this style.",
    "preset.saveAs": "Save as new style",
    "preset.saveAsDesc": "Save all current settings under a new name without overwriting existing styles.",
    "preset.example": "For example: Paper Green / Night Reading",
    "preset.save": "Save",
    "preset.rename": "Rename current style",
    "preset.renameDesc": "Changes only the display name, not the preset ID or any style settings.",
    "preset.newName": "New style name",
    "preset.renameButton": "Rename",
    "preset.manage": "Manage current custom style",
    "preset.manageDesc": "Overwrite updates this style with all current settings; delete keeps the current appearance.",
    "preset.overwrite": "Overwrite",
    "preset.delete": "Delete",
    "reset.desc": "Restore the built-in Bysan theme and content style defaults.",
    "reset.button": "Reset",
    "workspace.dynamic": "Dynamic workspace background",
    "workspace.dynamicDesc": "Controls the workspace background bundled with this plugin.",
    "workspace.lineRanges": "Show source ranges for folded blocks",
    "workspace.lineRangesDesc": "When Live Preview renders multi-line Mermaid or math source as one block, show 6–51 instead of appearing to jump from 6 to 52.",
    "workspace.lightBg": "Light background",
    "workspace.darkBg": "Dark background",
    "workspace.backgrounds": "Workspace backgrounds",
    "background.note": "Note",
    "background.waves": "Waves",
    "background.animatedWaves": "Animating waves",
    "background.blueMountain": "Blue Mountain",
    "background.customUrl": "Custom URL",
    "background.sky": "In the sky",
    "background.nightSky": "Night sky",
    "background.darkSky": "Dark sky",
    "code.theme": "Bysan syntax theme",
    "code.lineNumbers": "Code line numbers in editor",
    "code.lineNumbersDesc": "Display code line numbers using the bundled style.",
    "code.wrapReading": "Wrap code in Reading view",
    "code.wrapReadingDesc": "Wrap long code lines in Reading view.",
    "code.noWrapLive": "Disable wrapping in Live Preview",
    "code.noWrapLiveDesc": "Use horizontal scrolling for long code lines.",
    "code.muteActive": "Disable active-line highlight",
    "code.muteActiveDesc": "Do not show a background on the active code line.",
    "code.blur": "Code box blur radius",
    "code.blurDesc": "Applies only to frosted-glass code box styles.",
    "code.spacing": "Code letter spacing",
    "code.spacingDesc": "Unit: px.",
    "palette.codeBg": "Code block background",
    "palette.opacity": "Code background opacity",
    "palette.opacityDesc": "0 is fully transparent; 1 is fully opaque.",
    "palette.codeText": "Code block text",
    "palette.codeBorder": "Code block border",
    "palette.inlineBg": "Inline code background",
    "palette.inlineText": "Inline code text",
    "palette.tableHead": "Table header background",
    "palette.tableStripe": "Table zebra stripe",
    "palette.tableHover": "Table hover background",
    "palette.tableBorder": "Table border",
    "palette.quoteBg": "Quote background",
    "palette.quoteOpacity": "Quote background opacity",
    "palette.quoteBorder": "Quote border",
    "palette.marker": "List marker",
    "components.zebra": "Table zebra stripes",
    "components.zebraDesc": "Alternate data-row backgrounds.",
    "components.center": "Center tables",
    "components.centerDesc": "Keep tables centered in Live Preview and Reading view.",
    "components.quoteSerif": "Use serif font in quotes",
    "components.quoteSerifDesc": "When disabled, quotes follow the main interface font.",
    "review.badgeSize": "Review badge size",
    "review.badgeSizeDesc": "Controls the comment badge diameter from the selection review toolbar; default is 17px, smaller than before.",
    "theme.search": "Search style settings",
    "theme.searchDesc": "Filter every region by English name, description, or setting ID.",
    "theme.searchPlaceholder": "For example: tabs, file tree, heading color",
    "theme.empty": "Default / empty",
    "theme.cssValue": "CSS value",
    "theme.light": "Light",
    "theme.dark": "Dark",
    "theme.colorTitle": "{mode} color",
    "theme.opacityTitle": "{mode} opacity",
    "color.reset": "Restore the default {mode} color",
    "color.resetTheme": "Clear the custom {mode} color and use the theme default",
    "modal.title": "The current style has unsaved changes",
    "modal.body": "Switching styles replaces all current style settings. Choose how to handle the unsaved changes.",
    "modal.current": "Current: {name}",
    "modal.target": "Switch to: {name}",
    "modal.overwriteHint": "Save and switch will overwrite “{name}” before loading the target style.",
    "modal.newHint": "The current settings have not been saved as a custom style. Enter a name to save before switching.",
    "modal.newName": "New style name",
    "modal.cancel": "Cancel",
    "modal.discard": "Discard changes and switch",
    "modal.save": "Save and switch",
    "modal.nameRequired": "Enter a new style name before saving."
    ,"notice.nameRequired": "Enter a style name first."
    ,"notice.overwritten": "Style overwritten: {name}"
    ,"notice.saved": "Style saved: {name}"
    ,"notice.unsaved": "The current style has unsaved changes. Save it as a new style or overwrite the current style first."
    ,"notice.notFound": "Style preset not found."
    ,"notice.loaded": "Style loaded: {name}"
    ,"notice.defaultNoOverwrite": "The built-in default cannot be overwritten. Save it as a new style instead."
    ,"notice.defaultNoRename": "The built-in default cannot be renamed."
    ,"notice.emptyName": "The style name cannot be empty."
    ,"notice.duplicateName": "A style with this name already exists."
    ,"notice.renamed": "Style renamed to: {name}"
    ,"notice.deleted": "Style deleted: {name}; the current appearance is preserved."
    ,"notice.catalogError": "Failed to load the Bysan style settings catalogue. Check the plugin files."
    ,"notice.baseError": "Failed to load the bundled Bysan base theme. Check the plugin files."
    ,"notice.reset": "Bysan styles restored to defaults."
    ,"pdf.command": "PDF preview and export"
    ,"pdf.title": "PDF preview: {name}"
    ,"pdf.currentNote": "Current note"
    ,"pdf.sameOutputHint": "The preview and final PDF use the same paginated DOM and print settings."
    ,"pdf.paginating": "Paginating…"
    ,"pdf.pageCount": "{count} pages"
    ,"pdf.pagePrefix": "Page"
    ,"pdf.pageTotal": "/ {count}"
    ,"pdf.previous": "Previous page"
    ,"pdf.next": "Next page"
    ,"pdf.jump": "Jump to page"
    ,"pdf.operations": "Preview and export"
    ,"pdf.paper": "Paper size"
    ,"pdf.orientation": "Orientation"
    ,"pdf.portrait": "Portrait"
    ,"pdf.landscape": "Landscape"
    ,"pdf.margin": "Margins"
    ,"pdf.marginNormal": "Normal"
    ,"pdf.marginSmall": "Small"
    ,"pdf.marginNone": "None"
    ,"pdf.customMargins": "Custom margins (mm)"
    ,"pdf.marginTop": "Top"
    ,"pdf.marginRight": "Right"
    ,"pdf.marginBottom": "Bottom"
    ,"pdf.marginLeft": "Left"
    ,"pdf.header": "Header"
    ,"pdf.footer": "Footer"
    ,"pdf.headerPlaceholder": "For example: Course notes"
    ,"pdf.footerPlaceholder": "For example: Bysan · {page}"
    ,"pdf.pageNumbers": "Show page numbers"
    ,"pdf.pageRange": "Output page range"
    ,"pdf.pageRangeHint": "Enter all, or for example 1-3,5. Preview keeps every page; export includes only the selected pages."
    ,"pdf.grayscale": "Black and white output"
    ,"pdf.grayscaleHint": "Converts both the preview and final PDF to grayscale."
    ,"pdf.previewZoom": "Preview zoom"
    ,"pdf.actualScale": "Actual scale"
    ,"pdf.actualScaleHint": "Changes content size and pagination and is preserved in the exported PDF."
    ,"pdf.refresh": "Refresh preview"
    ,"pdf.export": "Export PDF"
    ,"pdf.directExportHint": "Export opens only the file save dialog, without a second print-settings window."
    ,"pdf.readError": "Unable to read the current note."
    ,"pdf.waitForPreview": "Wait for the paginated preview to finish."
    ,"pdf.exportUnavailable": "Direct PDF export is unavailable in this environment."
    ,"pdf.exporting": "Exporting…"
    ,"pdf.saveTitle": "Save PDF"
    ,"pdf.exported": "PDF exported: {path}"
    ,"pdf.exportFailed": "PDF export failed: {message}"
    ,"pdf.openNote": "Open a Markdown note first."
  }
};

function format(text, values = {}) {
  return String(text || "").replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? ""));
}

function resolveLanguage(preference, app) {
  if (preference === "zh" || preference === "en") return preference;
  const detected = String(
    app?.getLocale?.()
      || globalThis.localStorage?.getItem?.("language")
      || globalThis.moment?.locale?.()
      || globalThis.document?.documentElement?.lang
      || globalThis.navigator?.language
      || "en"
  ).toLowerCase();
  return detected.startsWith("zh") ? "zh" : "en";
}

function translate(language, key, values) {
  return format(TEXT[language]?.[key] || TEXT.en[key] || key, values);
}

module.exports = { resolveLanguage, translate };
