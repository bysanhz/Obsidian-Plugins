/**
 * Selection Review Toolbar
 * Version: 0.2.1
 *
 * A selection-driven, fixed-position review toolbar for Obsidian 1.13.x.
 * Formatting edits Markdown through Obsidian's Editor API. Review bodies are
 * stored by marker id so Markdown and LaTeX never have to be flattened.
 */

const {
  Component,
  MarkdownRenderer,
  MarkdownView,
  Notice,
  Plugin,
  setIcon
} = require("obsidian");


/* =========================================================
 * Configuration
 * ========================================================= */

const COLORS = [
  { id: "yellow", label: "黄色：重点" },
  { id: "red", label: "红色：错误 / 问题" },
  { id: "green", label: "绿色：已确认" },
  { id: "blue", label: "蓝色：证据 / 引用" },
  { id: "purple", label: "紫色：想法" },
  { id: "magenta", label: "粉紫：特殊强调" },
  { id: "orange", label: "橙色：待处理" },
  { id: "gray", label: "灰色：弱化" }
];
const CUSTOM_COLOR_DEFAULTS = ["#1E88E5", "#8E24AA", "#00897B", "#E64A19"];

const SELECTION_DELAY = 55;
const VIEWPORT_GAP = 8;
const REVIEW_MARKER_PATTERN = /%%\s*BYSAN-REVIEW:([a-zA-Z0-9_-]+)\s*%%/g;
const LEGACY_REVIEW_PATTERN = /%%\s*REVIEW:\s*([\s\S]*?)\s*%%/g;
const DEFAULT_DATA = {
  comments: {},
  popup: { left: null, top: null, width: 560, height: 420 },
  customColors: [...CUSTOM_COLOR_DEFAULTS]
};


function validHexColor(value) {
  return /^#[0-9a-f]{6}$/i.test(String(value || ""));
}


function parseReviewMarkers(text) {
  const markers = [];
  for (const pattern of [REVIEW_MARKER_PATTERN, LEGACY_REVIEW_PATTERN]) {
    pattern.lastIndex = 0;
    let match;
    while ((match = pattern.exec(text)) !== null) {
      markers.push({
        id: pattern === REVIEW_MARKER_PATTERN ? match[1] : null,
        legacyBody: pattern === LEGACY_REVIEW_PATTERN ? match[1].trim() : null,
        start: match.index,
        end: match.index + match[0].length,
        raw: match[0]
      });
    }
  }
  return markers.sort((left, right) => left.start - right.start);
}


function createReviewId() {
  if (globalThis.crypto?.randomUUID) {
    return globalThis.crypto.randomUUID().replace(/-/g, "").slice(0, 12);
  }
  return `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}


/* =========================================================
 * Small position helpers
 * ========================================================= */

function samePosition(left, right) {
  return Boolean(
    left &&
    right &&
    left.line === right.line &&
    left.ch === right.ch
  );
}


function clonePosition(position) {
  return {
    line: position.line,
    ch: position.ch
  };
}


function comparePosition(left, right) {
  if (left.line !== right.line) {
    return left.line - right.line;
  }

  return left.ch - right.ch;
}


function orderedPositions(anchor, head) {
  return comparePosition(anchor, head) <= 0
    ? [clonePosition(anchor), clonePosition(head)]
    : [clonePosition(head), clonePosition(anchor)];
}


/* =========================================================
 * Plugin lifecycle
 * ========================================================= */

module.exports = class SelectionReviewToolbar extends Plugin {

  async onload() {
    const loaded = await this.loadData();
    this.data = {
      ...DEFAULT_DATA,
      ...(loaded || {}),
      comments: { ...DEFAULT_DATA.comments, ...(loaded?.comments || {}) },
      popup: { ...DEFAULT_DATA.popup, ...(loaded?.popup || {}) },
      customColors: CUSTOM_COLOR_DEFAULTS.map((fallback, index) => (
        validHexColor(loaded?.customColors?.[index]) ? loaded.customColors[index] : fallback
      ))
    };
    this.toolbarEl = null;
    this.mainRowEl = null;
    this.colorPanelEl = null;
    this.commentPanelEl = null;
    this.commentInputEl = null;
    this.colorModeButtons = new Map();
    this.colorSwatches = new Map();
    this.cachedSelection = null;
    this.cachedRect = null;
    this.selectionTimer = null;
    this.selectingWithPointer = false;
    this.colorMode = "highlight";
    this.suppressedSelectionKey = null;
    this.sourceModeCommandId = null;
    this.reviewBadgeEls = [];
    this.reviewBadgeFrame = null;
    this.reviewWindowEl = null;
    this.reviewInputEl = null;
    this.reviewPreviewEl = null;
    this.reviewPreviewComponent = null;
    this.reviewPreviewTimer = null;
    this.activeReview = null;

    this.createToolbar();
    this.applyCustomColors();
    this.createReviewWindow();
    this.registerSelectionTracking();
    this.registerWorkspaceTracking();

    this.app.workspace.onLayoutReady(() => {
      this.sourceModeCommandId = this.findSourceModeCommandId();
      this.scheduleReviewBadgeRefresh();
    });

    console.log("[Selection Review Toolbar] v0.2.1 loaded");
  }


  onunload() {
    if (this.selectionTimer !== null) {
      window.clearTimeout(this.selectionTimer);
      this.selectionTimer = null;
    }

    this.toolbarEl?.remove();
    this.reviewWindowEl?.remove();
    this.clearReviewBadges();
    this.reviewPreviewComponent?.unload();
    this.clearCustomColorProperties();
    if (this.reviewBadgeFrame !== null) window.cancelAnimationFrame(this.reviewBadgeFrame);
    if (this.reviewPreviewTimer !== null) window.clearTimeout(this.reviewPreviewTimer);
    this.toolbarEl = null;
    this.cachedSelection = null;
    this.cachedRect = null;
  }


  /* =======================================================
   * Selection tracking
   * ======================================================= */

  registerSelectionTracking() {
    this.registerDomEvent(
      document,
      "pointerdown",
      (event) => {
        if (this.isPluginSurface(event.target)) {
          return;
        }

        this.selectingWithPointer = true;
        this.hideToolbar({ clearCache: false });
      },
      true
    );

    this.registerDomEvent(
      document,
      "pointerup",
      (event) => {
        if (this.isPluginSurface(event.target)) {
          return;
        }

        this.selectingWithPointer = false;
        this.scheduleSelectionCheck(25);
      },
      true
    );

    this.registerDomEvent(
      document,
      "selectionchange",
      () => {
        if (!this.selectingWithPointer) {
          this.scheduleSelectionCheck(SELECTION_DELAY);
        }
      }
    );

    this.registerDomEvent(
      document,
      "keyup",
      (event) => {
        if (event.key === "Escape") {
          this.suppressedSelectionKey = this.cachedSelection?.key || null;
          this.hideToolbar({ clearCache: false });
          return;
        }

        if (event.key.startsWith("Arrow") || event.key === "Shift") {
          this.scheduleSelectionCheck(25);
        }
      },
      true
    );

    this.registerDomEvent(
      document,
      "scroll",
      () => {
        if (this.isToolbarVisible()) {
          window.requestAnimationFrame(() => this.refreshToolbarPosition());
        }
        this.scheduleReviewBadgeRefresh();
      },
      true
    );

    this.registerDomEvent(
      window,
      "resize",
      () => {
        if (this.isToolbarVisible()) {
          window.requestAnimationFrame(() => this.refreshToolbarPosition());
        }
        this.scheduleReviewBadgeRefresh();
      }
    );
  }


  isPluginSurface(target) {
    return Boolean(
      target instanceof Node && (
        this.toolbarEl?.contains(target) ||
        this.reviewWindowEl?.contains(target) ||
        this.reviewBadgeEls.some((element) => element.contains(target))
      )
    );
  }


  registerWorkspaceTracking() {
    const close = () => {
      this.suppressedSelectionKey = null;
      this.hideToolbar({ clearCache: true });
      this.closeReviewWindow();
      this.scheduleReviewBadgeRefresh();
    };

    this.registerEvent(this.app.workspace.on("file-open", close));
    this.registerEvent(this.app.workspace.on("active-leaf-change", close));
    this.registerEvent(this.app.workspace.on("layout-change", () => {
      const view = this.getActiveEditingView();
      if (!view) {
        close();
      }
      this.scheduleReviewBadgeRefresh();
    }));

    this.registerEvent(this.app.workspace.on("editor-change", () => {
      if (!this.toolbarEl?.contains(document.activeElement)) {
        this.scheduleSelectionCheck(70);
      }
      this.scheduleReviewBadgeRefresh();
    }));
  }


  scheduleSelectionCheck(delay = SELECTION_DELAY) {
    if (this.selectionTimer !== null) {
      window.clearTimeout(this.selectionTimer);
    }

    this.selectionTimer = window.setTimeout(() => {
      this.selectionTimer = null;
      this.captureAndShowSelection();
    }, delay);
  }


  getActiveEditingView() {
    const view = this.app.workspace.getActiveViewOfType(MarkdownView);

    if (!view?.editor || view.getMode?.() !== "source") {
      return null;
    }

    return view;
  }


  captureAndShowSelection() {
    const view = this.getActiveEditingView();

    if (!view) {
      this.hideToolbar({ clearCache: true });
      return;
    }

    const editor = view.editor;
    const anchor = editor.getCursor("anchor");
    const head = editor.getCursor("head");
    const [from, to] = orderedPositions(anchor, head);

    if (samePosition(from, to)) {
      this.hideToolbar({ clearCache: true });
      return;
    }

    const text = editor.getRange(from, to);

    if (!text || !text.trim()) {
      this.hideToolbar({ clearCache: true });
      return;
    }

    if (!this.isReviewableSelection(editor, from, to)) {
      this.hideToolbar({ clearCache: true });
      return;
    }

    const filePath = view.file?.path || "";
    const fromOffset = editor.posToOffset(from);
    const toOffset = editor.posToOffset(to);
    const key = `${filePath}:${fromOffset}:${toOffset}:${text}`;

    if (key === this.suppressedSelectionKey) {
      this.hideToolbar({ clearCache: false });
      return;
    }

    this.suppressedSelectionKey = null;
    this.cachedSelection = {
      view,
      editor,
      filePath,
      from,
      to,
      fromOffset,
      toOffset,
      text,
      key
    };

    const rect = this.getSelectionRect(this.cachedSelection);

    if (!rect || !this.isRectNearViewport(rect)) {
      this.hideToolbar({ clearCache: false });
      return;
    }

    this.cachedRect = rect;
    this.closePanels();
    this.showToolbar(rect);
  }


  selectionIsStillValid() {
    const cache = this.cachedSelection;
    const view = this.getActiveEditingView();

    if (
      !cache ||
      !view ||
      view !== cache.view ||
      view.file?.path !== cache.filePath
    ) {
      return false;
    }

    return cache.editor.getRange(cache.from, cache.to) === cache.text;
  }


  selectionKey(cache) {
    return `${cache.filePath}:${cache.fromOffset}:${cache.toOffset}:${cache.text}`;
  }


  getSelectionRect(cache) {
    const domSelection = window.getSelection();

    if (domSelection?.rangeCount) {
      const range = domSelection.getRangeAt(0);
      const ancestor = range.commonAncestorContainer instanceof Element
        ? range.commonAncestorContainer
        : range.commonAncestorContainer.parentElement;

      if (ancestor && cache.view.containerEl.contains(ancestor)) {
        const rects = Array.from(range.getClientRects()).filter(
          (rect) => rect.width > 0 || rect.height > 0
        );

        if (rects.length > 0) {
          const first = rects[0];
          const last = rects[rects.length - 1];
          return {
            left: Math.min(first.left, last.left),
            right: Math.max(first.right, last.right),
            top: Math.min(first.top, last.top),
            bottom: Math.max(first.bottom, last.bottom),
            width: Math.max(first.right, last.right) - Math.min(first.left, last.left),
            height: Math.max(first.bottom, last.bottom) - Math.min(first.top, last.top)
          };
        }
      }
    }

    const cm = cache.editor.cm;
    const start = cm?.coordsAtPos?.(cache.fromOffset);
    const end = cm?.coordsAtPos?.(cache.toOffset);

    if (!start || !end) {
      return null;
    }

    return {
      left: Math.min(start.left, end.left),
      right: Math.max(start.right, end.right),
      top: Math.min(start.top, end.top),
      bottom: Math.max(start.bottom, end.bottom),
      width: Math.max(start.right, end.right) - Math.min(start.left, end.left),
      height: Math.max(start.bottom, end.bottom) - Math.min(start.top, end.top)
    };
  }


  isRectNearViewport(rect) {
    return (
      rect.bottom >= 0 &&
      rect.top <= window.innerHeight &&
      rect.right >= 0 &&
      rect.left <= window.innerWidth
    );
  }


  /* =======================================================
   * Selection context detection
   * ======================================================= */

  isReviewableSelection(editor, from, to) {
    const lines = editor.getValue().split("\n");
    let fence = null;
    let inMathBlock = false;

    for (let lineNumber = 0; lineNumber <= to.line; lineNumber++) {
      const line = lines[lineNumber] || "";
      const trimmed = line.trim();
      const overlapsSelection = lineNumber >= from.line && lineNumber <= to.line;

      if (fence) {
        if (overlapsSelection) {
          return false;
        }

        const closePattern = fence.char === "`" ? /^\s*`{3,}/ : /^\s*~{3,}/;
        const close = closePattern.exec(line);
        if (close && close[0].trim().length >= fence.length) {
          fence = null;
        }
        continue;
      }

      const fenceOpen = /^\s*(`{3,}|~{3,})/.exec(line);
      if (fenceOpen) {
        if (overlapsSelection) {
          return false;
        }
        fence = {
          char: fenceOpen[1][0],
          length: fenceOpen[1].length
        };
        continue;
      }

      const mathTokens = (line.match(/(?<!\\)\$\$/g) || []).length;
      if (mathTokens > 0) {
        if (overlapsSelection) {
          return false;
        }
        if (mathTokens % 2 === 1) {
          inMathBlock = !inMathBlock;
        }
        continue;
      }

      if (inMathBlock && overlapsSelection) {
        return false;
      }

      if (overlapsSelection && this.intersectsInlineCodeOrMath(line, lineNumber, from, to)) {
        return false;
      }

      if (!trimmed && inMathBlock) {
        continue;
      }
    }

    return true;
  }


  intersectsInlineCodeOrMath(line, lineNumber, from, to) {
    const start = lineNumber === from.line ? from.ch : 0;
    const end = lineNumber === to.line ? to.ch : line.length;

    if (end <= start) {
      return false;
    }

    const intersects = (matchStart, matchEnd) => (
      Math.max(start, matchStart) < Math.min(end, matchEnd)
    );

    const codePattern = /(`+)([^`]*?)\1/g;
    let match;
    while ((match = codePattern.exec(line)) !== null) {
      if (intersects(match.index, match.index + match[0].length)) {
        return true;
      }
    }

    const mathPattern = /\$(?!\$)(?:\\.|[^$\n])+\$/g;
    while ((match = mathPattern.exec(line)) !== null) {
      if (intersects(match.index, match.index + match[0].length)) {
        return true;
      }
    }

    return false;
  }


  /* =======================================================
   * Toolbar creation
   * ======================================================= */

  createToolbar() {
    this.toolbarEl = document.body.createDiv({ cls: "art-toolbar" });
    this.toolbarEl.setAttribute("role", "toolbar");
    this.toolbarEl.setAttribute("aria-label", "Selection review toolbar");

    this.mainRowEl = this.toolbarEl.createDiv({ cls: "art-toolbar-row" });

    this.addTextButton("B", "加粗", "art-bold", () => this.toggleMarkdown("bold"));
    this.addTextButton("I", "斜体", "art-italic", () => this.toggleMarkdown("italic"));
    this.addTextButton("U", "下划线", "art-underline", () => this.toggleHtmlTag("u"));
    this.addTextButton("S", "删除线", "art-strike", () => this.toggleMarkdown("strike"));
    this.addDivider();
    this.addTextButton("H", "高亮颜色", "art-highlight-button", () => this.openColorPanel("highlight"));
    this.addTextButton("A", "字体颜色", "art-text-color-button", () => this.openColorPanel("text"));
    this.addDivider();
    this.addIconButton("message-square", "添加审阅评论", () => this.openCommentPanel());
    this.addIconButton("code-2", "切换 Live Preview / Source Mode", () => this.toggleSourceMode());

    this.createColorPanel();

    this.toolbarEl.addEventListener("pointerdown", (event) => {
      event.stopPropagation();
      const colorInput = event.target instanceof HTMLInputElement && event.target.type === "color";
      if (!(event.target instanceof HTMLTextAreaElement) && !colorInput) {
        event.preventDefault();
      }
    });

    this.toolbarEl.addEventListener("mousedown", (event) => {
      event.stopPropagation();
      const colorInput = event.target instanceof HTMLInputElement && event.target.type === "color";
      if (!(event.target instanceof HTMLTextAreaElement) && !colorInput) {
        event.preventDefault();
      }
    });

    this.toolbarEl.addEventListener("click", (event) => event.stopPropagation());
  }


  addTextButton(text, title, className, action) {
    const button = this.mainRowEl.createEl("button", {
      cls: `art-toolbar-button ${className}`,
      text,
      attr: {
        type: "button",
        "aria-label": title,
        title
      }
    });

    button.addEventListener("click", action);
    return button;
  }


  addIconButton(icon, title, action) {
    const button = this.mainRowEl.createEl("button", {
      cls: "art-toolbar-button",
      attr: {
        type: "button",
        "aria-label": title,
        title
      }
    });

    setIcon(button, icon);
    button.addEventListener("click", action);
    return button;
  }


  addDivider() {
    this.mainRowEl.createDiv({ cls: "art-toolbar-divider" });
  }


  createColorPanel() {
    this.colorPanelEl = this.toolbarEl.createDiv({ cls: "art-color-panel" });
    const grid = this.colorPanelEl.createDiv({ cls: "art-color-grid" });

    for (const color of COLORS) {
      const swatch = grid.createEl("button", {
        cls: `art-color-swatch art-color-${color.id}`,
        attr: {
          type: "button",
          "aria-label": color.label,
          title: color.label
        }
      });
      swatch.addEventListener("click", () => this.applyColor(color.id));
      this.colorSwatches.set(color.id, swatch);
    }

    const clear = grid.createEl("button", {
      cls: "art-color-swatch art-color-clear",
      text: "×",
      attr: {
        type: "button",
        "aria-label": "清除当前颜色",
        title: "清除当前颜色"
      }
    });
    clear.addEventListener("click", () => this.applyColor(null));

    const custom = this.colorPanelEl.createDiv({ cls: "art-custom-colors" });
    custom.createDiv({ cls: "art-custom-colors-label", text: "自定义颜色" });
    const customGrid = custom.createDiv({ cls: "art-custom-colors-grid" });
    this.data.customColors.forEach((value, index) => {
      const id = `custom-${index + 1}`;
      const item = customGrid.createDiv({ cls: "art-custom-color-item" });
      const swatch = item.createEl("button", {
        cls: "art-color-swatch art-custom-color-swatch",
        text: String(index + 1),
        attr: {
          type: "button",
          title: `应用自定义颜色 ${index + 1}`,
          "aria-label": `应用自定义颜色 ${index + 1}`
        }
      });
      swatch.style.setProperty("--art-custom-swatch", `var(--art-${id})`);
      swatch.addEventListener("click", () => this.applyColor(id));
      this.colorSwatches.set(id, swatch);

      const input = item.createEl("input", {
        cls: "art-custom-color-input",
        attr: {
          type: "color",
          value,
          title: `编辑自定义颜色 ${index + 1}`,
          "aria-label": `编辑自定义颜色 ${index + 1}`
        }
      });
      input.value = value;
      input.addEventListener("input", () => this.updateCustomColor(index, input.value));
      input.addEventListener("change", () => this.updateCustomColor(index, input.value, true));
    });

    const modes = this.colorPanelEl.createDiv({ cls: "art-color-modes" });
    const highlight = modes.createEl("button", {
      cls: "art-mode-button",
      text: "Highlight",
      attr: { type: "button" }
    });
    const text = modes.createEl("button", {
      cls: "art-mode-button",
      text: "Text Color",
      attr: { type: "button" }
    });

    highlight.addEventListener("click", () => this.setColorMode("highlight"));
    text.addEventListener("click", () => this.setColorMode("text"));
    this.colorModeButtons.set("highlight", highlight);
    this.colorModeButtons.set("text", text);
  }


  applyCustomColors() {
    this.data.customColors.forEach((value, index) => {
      document.documentElement.style.setProperty(`--art-custom-${index + 1}`, value);
    });
  }


  clearCustomColorProperties() {
    CUSTOM_COLOR_DEFAULTS.forEach((_, index) => {
      document.documentElement.style.removeProperty(`--art-custom-${index + 1}`);
    });
  }


  async updateCustomColor(index, value, persist = false) {
    if (!validHexColor(value) || index < 0 || index >= CUSTOM_COLOR_DEFAULTS.length) return;
    document.documentElement.style.setProperty(`--art-custom-${index + 1}`, value);
    if (persist) {
      this.data.customColors[index] = value.toUpperCase();
      await this.saveData(this.data);
      new Notice(`自定义颜色 ${index + 1} 已保存`);
    }
  }


  createReviewWindow() {
    this.reviewWindowEl = document.body.createDiv({ cls: "art-review-window" });
    this.reviewWindowEl.setAttribute("role", "dialog");
    this.reviewWindowEl.setAttribute("aria-label", "审阅评论");

    const header = this.reviewWindowEl.createDiv({ cls: "art-review-header" });
    const title = header.createDiv({ cls: "art-review-title" });
    setIcon(title.createSpan({ cls: "art-review-title-icon" }), "message-square");
    title.createSpan({ text: "审阅评论" });
    const close = header.createEl("button", {
      cls: "art-review-icon-button",
      attr: { type: "button", title: "关闭", "aria-label": "关闭评论窗口" }
    });
    setIcon(close, "x");
    close.addEventListener("click", () => this.closeReviewWindow());

    const content = this.reviewWindowEl.createDiv({ cls: "art-review-content" });
    const editorPane = content.createDiv({ cls: "art-review-pane art-review-editor-pane" });
    editorPane.createDiv({ cls: "art-review-pane-label", text: "Markdown / LaTeX" });
    this.reviewInputEl = editorPane.createEl("textarea", {
      cls: "art-review-editor",
      attr: {
        placeholder: "输入 Markdown；行内公式使用 $...$，块公式使用 $$...$$",
        "aria-label": "评论 Markdown 编辑器",
        spellcheck: "true"
      }
    });
    const previewPane = content.createDiv({ cls: "art-review-pane art-review-preview-pane" });
    previewPane.createDiv({ cls: "art-review-pane-label", text: "预览" });
    this.reviewPreviewEl = previewPane.createDiv({ cls: "art-review-preview markdown-rendered" });

    const footer = this.reviewWindowEl.createDiv({ cls: "art-review-footer" });
    const hint = footer.createDiv({ cls: "art-review-hint", text: "Ctrl/⌘ + Enter 保存" });
    const actions = footer.createDiv({ cls: "art-review-actions" });
    this.reviewDeleteButton = actions.createEl("button", {
      cls: "art-review-button art-review-delete",
      text: "删除",
      attr: { type: "button" }
    });
    const cancel = actions.createEl("button", {
      cls: "art-review-button",
      text: "关闭",
      attr: { type: "button" }
    });
    const save = actions.createEl("button", {
      cls: "art-review-button art-review-save",
      text: "保存",
      attr: { type: "button" }
    });
    hint.setAttribute("aria-hidden", "true");

    this.reviewDeleteButton.addEventListener("click", () => this.deleteActiveReview());
    cancel.addEventListener("click", () => this.closeReviewWindow());
    save.addEventListener("click", () => this.saveActiveReview());
    this.reviewInputEl.addEventListener("input", () => this.scheduleReviewPreview());
    this.reviewInputEl.addEventListener("keydown", (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
        event.preventDefault();
        this.saveActiveReview();
      }
    });

    this.installReviewWindowDrag(header);
    this.registerDomEvent(window, "pointerup", () => this.persistReviewWindowGeometry());
  }


  installReviewWindowDrag(handle) {
    handle.addEventListener("pointerdown", (event) => {
      if (event.button !== 0 || event.target.closest("button")) return;
      event.preventDefault();
      const rect = this.reviewWindowEl.getBoundingClientRect();
      const startX = event.clientX;
      const startY = event.clientY;
      const startLeft = rect.left;
      const startTop = rect.top;
      const move = (moveEvent) => {
        const maxLeft = Math.max(VIEWPORT_GAP, window.innerWidth - rect.width - VIEWPORT_GAP);
        const maxTop = Math.max(VIEWPORT_GAP, window.innerHeight - 48);
        const left = Math.max(VIEWPORT_GAP, Math.min(maxLeft, startLeft + moveEvent.clientX - startX));
        const top = Math.max(VIEWPORT_GAP, Math.min(maxTop, startTop + moveEvent.clientY - startY));
        this.reviewWindowEl.style.left = `${Math.round(left)}px`;
        this.reviewWindowEl.style.top = `${Math.round(top)}px`;
      };
      const up = () => {
        window.removeEventListener("pointermove", move, true);
        window.removeEventListener("pointerup", up, true);
        window.removeEventListener("pointercancel", up, true);
        this.persistReviewWindowGeometry();
      };
      window.addEventListener("pointermove", move, true);
      window.addEventListener("pointerup", up, true);
      window.addEventListener("pointercancel", up, true);
    });
  }


  /* =======================================================
   * Toolbar visibility and positioning
   * ======================================================= */

  isToolbarVisible() {
    return Boolean(this.toolbarEl?.classList.contains("art-visible"));
  }


  showToolbar(rect) {
    this.toolbarEl.classList.add("art-visible");
    this.positionToolbar(rect);
  }


  hideToolbar({ clearCache = false } = {}) {
    this.toolbarEl?.classList.remove("art-visible");
    this.closePanels();

    if (clearCache) {
      this.cachedSelection = null;
      this.cachedRect = null;
    }
  }


  closePanels() {
    this.colorPanelEl?.classList.remove("art-open");
    this.commentPanelEl?.classList.remove("art-open");
  }


  refreshToolbarPosition() {
    if (!this.cachedSelection || !this.isToolbarVisible()) {
      return;
    }

    const rect = this.getSelectionRect(this.cachedSelection);
    if (!rect || !this.isRectNearViewport(rect)) {
      this.hideToolbar({ clearCache: false });
      return;
    }

    this.cachedRect = rect;
    this.positionToolbar(rect);
  }


  positionToolbar(rect) {
    if (!this.toolbarEl) {
      return;
    }

    this.toolbarEl.style.left = "-9999px";
    this.toolbarEl.style.top = "-9999px";

    const width = this.toolbarEl.offsetWidth || 300;
    const height = this.toolbarEl.offsetHeight || 38;
    let left = rect.left + rect.width / 2 - width / 2;
    let top = rect.top - height - VIEWPORT_GAP;

    if (top < VIEWPORT_GAP) {
      top = rect.bottom + VIEWPORT_GAP;
    }

    left = Math.max(
      VIEWPORT_GAP,
      Math.min(left, window.innerWidth - width - VIEWPORT_GAP)
    );
    top = Math.max(
      VIEWPORT_GAP,
      Math.min(top, window.innerHeight - height - VIEWPORT_GAP)
    );

    this.toolbarEl.style.left = `${Math.round(left)}px`;
    this.toolbarEl.style.top = `${Math.round(top)}px`;
  }


  /* =======================================================
   * Markdown formatting
   * ======================================================= */

  toggleMarkdown(kind) {
    if (!this.selectionIsStillValid()) {
      this.hideToolbar({ clearCache: true });
      return;
    }

    const wrappers = {
      bold: ["**", "**"],
      italic: ["*", "*"],
      strike: ["~~", "~~"]
    };
    const [prefix, suffix] = wrappers[kind];
    const cache = this.cachedSelection;
    const text = cache.text;

    if (text.startsWith(prefix) && text.endsWith(suffix) && text.length > prefix.length + suffix.length) {
      const inner = text.slice(prefix.length, text.length - suffix.length);
      this.replaceCachedRange(cache.fromOffset, cache.toOffset, inner, 0, inner.length);
      return;
    }

    const documentText = cache.editor.getValue();
    let surrounded = (
      documentText.slice(cache.fromOffset - prefix.length, cache.fromOffset) === prefix &&
      documentText.slice(cache.toOffset, cache.toOffset + suffix.length) === suffix
    );

    if (kind === "italic" && surrounded) {
      const beforeRun = this.countCharacterRun(documentText, cache.fromOffset - 1, -1, "*");
      const afterRun = this.countCharacterRun(documentText, cache.toOffset, 1, "*");
      surrounded = beforeRun % 2 === 1 && afterRun % 2 === 1;
    }

    if (surrounded) {
      const start = cache.fromOffset - prefix.length;
      const end = cache.toOffset + suffix.length;
      this.replaceCachedRange(start, end, text, 0, text.length);
      return;
    }

    const replacement = `${prefix}${text}${suffix}`;
    this.replaceCachedRange(
      cache.fromOffset,
      cache.toOffset,
      replacement,
      prefix.length,
      prefix.length + text.length
    );
  }


  countCharacterRun(text, start, direction, character) {
    let count = 0;
    let index = start;
    while (index >= 0 && index < text.length && text[index] === character) {
      count += 1;
      index += direction;
    }
    return count;
  }


  toggleHtmlTag(tagName) {
    if (!this.selectionIsStillValid()) {
      this.hideToolbar({ clearCache: true });
      return;
    }

    const cache = this.cachedSelection;
    const prefix = `<${tagName}>`;
    const suffix = `</${tagName}>`;
    const text = cache.text;

    if (text.startsWith(prefix) && text.endsWith(suffix)) {
      const inner = text.slice(prefix.length, text.length - suffix.length);
      this.replaceCachedRange(cache.fromOffset, cache.toOffset, inner, 0, inner.length);
      return;
    }

    const documentText = cache.editor.getValue();
    if (
      documentText.slice(cache.fromOffset - prefix.length, cache.fromOffset) === prefix &&
      documentText.slice(cache.toOffset, cache.toOffset + suffix.length) === suffix
    ) {
      this.replaceCachedRange(
        cache.fromOffset - prefix.length,
        cache.toOffset + suffix.length,
        text,
        0,
        text.length
      );
      return;
    }

    this.replaceCachedRange(
      cache.fromOffset,
      cache.toOffset,
      `${prefix}${text}${suffix}`,
      prefix.length,
      prefix.length + text.length
    );
  }


  replaceCachedRange(startOffset, endOffset, replacement, selectionStart, selectionEnd) {
    const cache = this.cachedSelection;
    if (!cache) {
      return;
    }

    const editor = cache.editor;
    const changeFrom = editor.offsetToPos(startOffset);
    const changeTo = editor.offsetToPos(endOffset);
    /*
     * selections 属于 transaction 执行后的文档。不能用变更前 editor 的
     * offsetToPos 换算较长 HTML 前缀，否则坐标可能被夹到旧行尾甚至下一行。
     */
    const selectedFrom = this.positionAfterInsertedText(
      changeFrom,
      replacement.slice(0, selectionStart)
    );
    const selectedTo = this.positionAfterInsertedText(
      changeFrom,
      replacement.slice(0, selectionEnd)
    );

    editor.transaction({
      changes: [{ from: changeFrom, to: changeTo, text: replacement }],
      selections: [{ from: selectedFrom, to: selectedTo }]
    });

    const selectedText = replacement.slice(selectionStart, selectionEnd);
    cache.from = selectedFrom;
    cache.to = selectedTo;
    cache.fromOffset = startOffset + selectionStart;
    cache.toOffset = startOffset + selectionEnd;
    cache.text = selectedText;
    cache.key = this.selectionKey(cache);
    this.suppressedSelectionKey = null;

    window.requestAnimationFrame(() => {
      if (this.selectionIsStillValid()) {
        const rect = this.getSelectionRect(cache) || this.cachedRect;
        if (rect) {
          this.cachedRect = rect;
          this.showToolbar(rect);
        }
      }
    });
  }


  positionAfterInsertedText(start, text) {
    const lines = text.split("\n");

    if (lines.length === 1) {
      return {
        line: start.line,
        ch: start.ch + lines[0].length
      };
    }

    return {
      line: start.line + lines.length - 1,
      ch: lines[lines.length - 1].length
    };
  }


  /* =======================================================
   * HTML color formatting
   * ======================================================= */

  openColorPanel(mode) {
    if (!this.selectionIsStillValid()) {
      this.hideToolbar({ clearCache: true });
      return;
    }

    this.commentPanelEl?.classList.remove("art-open");
    this.colorPanelEl.classList.add("art-open");
    this.setColorMode(mode);
    this.updateActiveColor();
    this.positionToolbar(this.cachedRect);
  }


  setColorMode(mode) {
    this.colorMode = mode;
    for (const [id, button] of this.colorModeButtons) {
      button.classList.toggle("art-active", id === mode);
    }
    this.updateActiveColor();
  }


  getColorWrapper(mode) {
    return mode === "highlight"
      ? { tag: "mark", classPrefix: "art-hl-" }
      : { tag: "span", classPrefix: "art-text-" };
  }


  findCurrentColor(mode) {
    const cache = this.cachedSelection;
    if (!cache) {
      return null;
    }

    const { tag, classPrefix } = this.getColorWrapper(mode);
    const escapedPrefix = classPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const whole = new RegExp(
      `^<${tag} class=["']${escapedPrefix}([a-z0-9-]+)["']>[\\s\\S]*<\\/${tag}>$`
    ).exec(cache.text);

    if (whole) {
      return whole[1];
    }

    const before = cache.editor.getValue().slice(0, cache.fromOffset);
    const after = cache.editor.getValue().slice(cache.toOffset);
    const opening = new RegExp(
      `<${tag} class=["']${escapedPrefix}([a-z0-9-]+)["']>$`
    ).exec(before);

    if (opening && after.startsWith(`</${tag}>`)) {
      return opening[1];
    }

    return null;
  }


  updateActiveColor() {
    const current = this.findCurrentColor(this.colorMode);
    for (const [id, swatch] of this.colorSwatches) {
      swatch.classList.toggle("art-selected", id === current);
    }
  }


  applyColor(color) {
    if (!this.selectionIsStillValid()) {
      this.hideToolbar({ clearCache: true });
      return;
    }

    const cache = this.cachedSelection;
    const { tag, classPrefix } = this.getColorWrapper(this.colorMode);
    const escapedPrefix = classPrefix.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const wholePattern = new RegExp(
      `^<${tag} class=["']${escapedPrefix}[a-z0-9-]+["']>([\\s\\S]*)<\\/${tag}>$`
    );
    const whole = wholePattern.exec(cache.text);

    if (whole) {
      const inner = whole[1];
      const replacement = color
        ? `<${tag} class="${classPrefix}${color}">${inner}</${tag}>`
        : inner;
      const selectionStart = color ? replacement.indexOf(">") + 1 : 0;
      this.replaceCachedRange(
        cache.fromOffset,
        cache.toOffset,
        replacement,
        selectionStart,
        selectionStart + inner.length
      );
      this.closePanels();
      return;
    }

    const documentText = cache.editor.getValue();
    const before = documentText.slice(0, cache.fromOffset);
    const after = documentText.slice(cache.toOffset);
    const opening = new RegExp(
      `<${tag} class=["']${escapedPrefix}[a-z0-9-]+["']>$`
    ).exec(before);
    const closing = `</${tag}>`;

    if (opening && after.startsWith(closing)) {
      const start = cache.fromOffset - opening[0].length;
      const end = cache.toOffset + closing.length;
      const replacement = color
        ? `<${tag} class="${classPrefix}${color}">${cache.text}</${tag}>`
        : cache.text;
      const selectionStart = color ? replacement.indexOf(">") + 1 : 0;
      this.replaceCachedRange(
        start,
        end,
        replacement,
        selectionStart,
        selectionStart + cache.text.length
      );
      this.closePanels();
      return;
    }

    if (!color) {
      this.closePanels();
      this.refreshToolbarPosition();
      return;
    }

    const prefix = `<${tag} class="${classPrefix}${color}">`;
    const replacement = `${prefix}${cache.text}</${tag}>`;
    this.replaceCachedRange(
      cache.fromOffset,
      cache.toOffset,
      replacement,
      prefix.length,
      prefix.length + cache.text.length
    );
    this.closePanels();
  }


  /* =======================================================
   * Comment editor
   * ======================================================= */

  openCommentPanel() {
    if (!this.selectionIsStillValid()) {
      this.hideToolbar({ clearCache: true });
      return;
    }

    const cache = this.cachedSelection;
    this.closePanels();
    this.hideToolbar({ clearCache: false });
    this.openReviewWindow({
      draft: true,
      filePath: cache.filePath,
      selection: {
        fromOffset: cache.fromOffset,
        toOffset: cache.toOffset,
        text: cache.text
      }
    }, "", this.cachedRect);
  }


  openReviewWindow(review, body, anchorRect = null) {
    this.activeReview = review;
    this.reviewInputEl.value = body || "";
    this.reviewDeleteButton.classList.toggle("art-hidden", Boolean(review.draft));
    this.reviewWindowEl.classList.add("art-open");
    this.applyReviewWindowGeometry(anchorRect);
    this.scheduleReviewPreview(true);
    window.requestAnimationFrame(() => this.reviewInputEl.focus());
  }


  closeReviewWindow() {
    this.reviewWindowEl?.classList.remove("art-open");
    this.activeReview = null;
    this.reviewPreviewComponent?.unload();
    this.reviewPreviewComponent = null;
  }


  applyReviewWindowGeometry(anchorRect = null) {
    const geometry = this.data.popup;
    const width = Math.min(Math.max(360, Number(geometry.width) || 560), window.innerWidth - VIEWPORT_GAP * 2);
    const height = Math.min(Math.max(260, Number(geometry.height) || 420), window.innerHeight - VIEWPORT_GAP * 2);
    let left = Number.isFinite(geometry.left) ? geometry.left : null;
    let top = Number.isFinite(geometry.top) ? geometry.top : null;
    if (left === null) left = anchorRect ? anchorRect.right + 12 : (window.innerWidth - width) / 2;
    if (top === null) top = anchorRect ? anchorRect.top : (window.innerHeight - height) / 2;
    left = Math.max(VIEWPORT_GAP, Math.min(left, window.innerWidth - width - VIEWPORT_GAP));
    top = Math.max(VIEWPORT_GAP, Math.min(top, window.innerHeight - height - VIEWPORT_GAP));
    Object.assign(this.reviewWindowEl.style, {
      left: `${Math.round(left)}px`,
      top: `${Math.round(top)}px`,
      width: `${Math.round(width)}px`,
      height: `${Math.round(height)}px`
    });
  }


  async persistReviewWindowGeometry() {
    if (!this.reviewWindowEl?.classList.contains("art-open")) return;
    const rect = this.reviewWindowEl.getBoundingClientRect();
    this.data.popup = {
      left: Math.round(rect.left),
      top: Math.round(rect.top),
      width: Math.round(rect.width),
      height: Math.round(rect.height)
    };
    await this.saveData(this.data);
  }


  scheduleReviewPreview(immediate = false) {
    if (this.reviewPreviewTimer !== null) window.clearTimeout(this.reviewPreviewTimer);
    const render = () => {
      this.reviewPreviewTimer = null;
      this.renderReviewPreview();
    };
    this.reviewPreviewTimer = window.setTimeout(render, immediate ? 0 : 120);
  }


  async renderReviewPreview() {
    if (!this.reviewPreviewEl || !this.reviewWindowEl.classList.contains("art-open")) return;
    this.reviewPreviewComponent?.unload();
    this.reviewPreviewComponent = new Component();
    this.reviewPreviewComponent.load();
    this.reviewPreviewEl.empty();
    const markdown = this.reviewInputEl.value || "*暂无内容*";
    try {
      await MarkdownRenderer.render(
        this.app,
        markdown,
        this.reviewPreviewEl,
        this.activeReview?.filePath || "",
        this.reviewPreviewComponent
      );
    } catch (error) {
      this.reviewPreviewEl.setText(`预览失败：${error.message || error}`);
    }
  }


  async saveActiveReview() {
    const body = this.reviewInputEl.value.trim();
    if (!body) {
      new Notice("请输入评论内容");
      return;
    }
    const review = this.activeReview;
    if (!review) return;

    if (review.draft) {
      if (!this.selectionIsStillValid()) {
        new Notice("原选区已变化，请重新选择文字后添加评论");
        this.closeReviewWindow();
        return;
      }
      const id = createReviewId();
      this.data.comments[id] = {
        body,
        filePath: review.filePath,
        anchorText: review.selection.text,
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await this.saveData(this.data);
      const cache = this.cachedSelection;
      const suffix = ` %% BYSAN-REVIEW:${id} %%`;
      this.closeReviewWindow();
      this.replaceCachedRange(
        cache.fromOffset,
        cache.toOffset,
        `${cache.text}${suffix}`,
        0,
        cache.text.length
      );
      this.scheduleReviewBadgeRefresh();
      return;
    }

    let id = review.id;
    if (!id) {
      id = createReviewId();
      if (!this.replaceReviewMarker(review, `%% BYSAN-REVIEW:${id} %%`)) {
        new Notice("未找到旧评论标记，未执行迁移");
        return;
      }
    }
    const previous = this.data.comments[id] || {};
    this.data.comments[id] = {
      ...previous,
      body,
      filePath: review.filePath,
      createdAt: previous.createdAt || Date.now(),
      updatedAt: Date.now()
    };
    await this.saveData(this.data);
    this.closeReviewWindow();
    this.scheduleReviewBadgeRefresh();
    new Notice("评论已保存");
  }


  async deleteActiveReview() {
    const review = this.activeReview;
    if (!review || review.draft) return;
    if (!this.replaceReviewMarker(review, "")) {
      new Notice("未找到评论标记");
      return;
    }
    if (review.id) delete this.data.comments[review.id];
    await this.saveData(this.data);
    this.closeReviewWindow();
    this.scheduleReviewBadgeRefresh();
    new Notice("评论已删除");
  }


  replaceReviewMarker(review, replacement) {
    const view = this.getActiveEditingView();
    if (!view || view.file?.path !== review.filePath) return false;
    const text = view.editor.getValue();
    let start = review.start;
    let end = review.end;
    if (text.slice(start, end) !== review.raw) {
      start = text.indexOf(review.raw);
      if (start < 0) return false;
      end = start + review.raw.length;
    }
    view.editor.replaceRange(replacement, view.editor.offsetToPos(start), view.editor.offsetToPos(end));
    return true;
  }


  scheduleReviewBadgeRefresh() {
    if (this.reviewBadgeFrame !== null) return;
    this.reviewBadgeFrame = window.requestAnimationFrame(() => {
      this.reviewBadgeFrame = null;
      this.refreshReviewBadges();
    });
  }


  clearReviewBadges() {
    for (const element of this.reviewBadgeEls || []) element.remove();
    this.reviewBadgeEls = [];
  }


  refreshReviewBadges() {
    this.clearReviewBadges();
    const view = this.getActiveEditingView();
    const cm = view?.editor?.cm;
    if (!view || !cm?.coordsAtPos) return;
    const markers = parseReviewMarkers(view.editor.getValue());
    const scroller = view.containerEl.querySelector(".cm-scroller");
    const viewport = scroller?.getBoundingClientRect() || view.containerEl.getBoundingClientRect();

    markers.forEach((marker, index) => {
      const coords = cm.coordsAtPos(marker.start, 1) || cm.coordsAtPos(marker.end, -1);
      if (!coords || coords.bottom < viewport.top || coords.top > viewport.bottom) return;
      const record = marker.id ? this.data.comments[marker.id] : null;
      const body = record?.body || marker.legacyBody || "评论内容缺失";
      const badge = document.body.createEl("button", {
        cls: `art-review-badge${record || marker.legacyBody ? "" : " art-review-badge-missing"}`,
        text: String(index + 1),
        attr: {
          type: "button",
          title: body.replace(/\s+/g, " ").slice(0, 90),
          "aria-label": `打开评论 ${index + 1}`
        }
      });
      badge.style.left = `${Math.round(Math.min(coords.right + 2, viewport.right - 20))}px`;
      badge.style.top = `${Math.round(Math.max(viewport.top, coords.top - 8))}px`;
      badge.addEventListener("pointerdown", (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
      badge.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const rect = badge.getBoundingClientRect();
        this.openReviewWindow({
          ...marker,
          filePath: view.file.path,
          draft: false
        }, body, rect);
      });
      this.reviewBadgeEls.push(badge);
    });
  }


  /* =======================================================
   * Source mode switching
   * ======================================================= */

  findSourceModeCommandId() {
    const commands = this.app.commands?.commands || {};
    const preferred = [
      "editor:toggle-source",
      "editor:toggle-live-preview"
    ];

    for (const id of preferred) {
      if (commands[id]) {
        return id;
      }
    }

    const match = Object.entries(commands).find(([id, command]) => {
      const name = String(command?.name || "").toLowerCase();
      return (
        id.includes("toggle-source") ||
        (name.includes("source mode") && name.includes("live preview")) ||
        (name.includes("源码模式") && name.includes("实时预览"))
      );
    });

    return match?.[0] || null;
  }


  toggleSourceMode() {
    const commandId = this.sourceModeCommandId || this.findSourceModeCommandId();

    if (!commandId) {
      new Notice("未找到 Obsidian 的 Live Preview / Source Mode 切换命令");
      this.hideToolbar({ clearCache: true });
      return;
    }

    this.sourceModeCommandId = commandId;
    this.hideToolbar({ clearCache: true });
    this.app.commands.executeCommandById(commandId);
  }
};
