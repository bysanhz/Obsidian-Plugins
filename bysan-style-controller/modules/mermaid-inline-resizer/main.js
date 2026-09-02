/**
 * Mermaid Inline Resizer
 *
 * Version: 0.12.1
 *
 * 稳定四按钮版。
 *
 * 控件：
 *
 *      [ − ] [ 3% ] [ 72% ] [ + ]
 *              ↑       ↑
 *             step   当前宽度
 *
 * 功能：
 * 1. Live Preview 中单独调整每张 Mermaid 的正文显示宽度。
 * 2. "-" 按当前 step 缩小。
 * 3. "+" 按当前 step 放大。
 * 4. 点击 step 按钮循环：
 *
 *      1% -> 3% -> 5% -> 10% -> 1%
 *
 * 5. 点击当前宽度按钮恢复 100%。
 * 6. 宽度持久化到 Mermaid 源码：
 *
 *      %% width: 72%
 *
 * 7. Reading View 自动读取同一宽度。
 * 8. 对外提供渲染结果宽度同步接口，供其他插件的预览使用。
 * 9. 打印时不会显示控制按钮。
 * 10. 不使用 Slider，不监听滚轮，避免连续触发 Mermaid 重绘。
 *
 * Target:
 * - Obsidian Desktop
 * - Live Preview
 * - Reading View
 * - PDF Export
 */

const {
  Plugin,
  MarkdownView,
  Modal,
  Notice
} = require("obsidian");

const {
  Decoration,
  ViewPlugin,
  WidgetType
} = require("@codemirror/view");


/* =========================================================
 * Configuration
 * ========================================================= */

const MIN_WIDTH = 20;
const MAX_WIDTH = 100;

const DEFAULT_WIDTH = 100;


/*
 * Step 候选值。
 */
const STEP_OPTIONS = [
  1,
  3,
  5,
  10
];

const DEFAULT_STEP = 3;


class MermaidZoomModal extends Modal {

  constructor(app, sourceMermaid) {
    super(app);
    this.sourceMermaid = sourceMermaid;
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.dragging = false;
  }


  onOpen() {
    this.modalEl.addClass("mir-zoom-modal");
    this.contentEl.empty();

    const toolbar = this.contentEl.createDiv({ cls: "mir-zoom-toolbar" });
    const makeButton = (text, title, className = "") => {
      const button = toolbar.createEl("button", {
        cls: className,
        text,
        attr: { type: "button", title }
      });
      button.tabIndex = -1;
      return button;
    };
    const minus = makeButton("−", "缩小");
    this.scaleButton = makeButton("100%", "恢复 100%", "mir-zoom-reset");
    const plus = makeButton("+", "放大");
    const close = makeButton("×", "关闭", "mir-zoom-close");

    this.viewportEl = this.contentEl.createDiv({ cls: "mir-zoom-viewport" });
    this.canvasEl = this.viewportEl.createDiv({ cls: "mir-zoom-canvas" });
    const svg = this.sourceMermaid.querySelector("svg");
    if (!svg) {
      this.canvasEl.setText("当前 Mermaid 尚未渲染完成。");
      return;
    }
    const clone = svg.cloneNode(true);
    clone.removeAttribute("style");
    clone.style.width = "auto";
    clone.style.maxWidth = "none";
    clone.style.height = "auto";
    this.canvasEl.appendChild(clone);

    minus.addEventListener("click", () => this.zoomBy(0.8));
    plus.addEventListener("click", () => this.zoomBy(1.25));
    this.scaleButton.addEventListener("click", () => this.resetTransform());
    close.addEventListener("click", () => this.close());

    this.viewportEl.addEventListener("wheel", (event) => {
      event.preventDefault();
      this.zoomBy(event.deltaY < 0 ? 1.12 : 1 / 1.12);
    }, { passive: false });
    this.viewportEl.addEventListener("dblclick", () => this.resetTransform());
    this.viewportEl.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      this.dragging = true;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.viewportEl.setPointerCapture(event.pointerId);
      this.viewportEl.classList.add("is-dragging");
    });
    this.viewportEl.addEventListener("pointermove", (event) => {
      if (!this.dragging) return;
      this.panX += event.clientX - this.lastX;
      this.panY += event.clientY - this.lastY;
      this.lastX = event.clientX;
      this.lastY = event.clientY;
      this.updateTransform();
    });
    const stopDragging = () => {
      this.dragging = false;
      this.viewportEl.classList.remove("is-dragging");
    };
    this.viewportEl.addEventListener("pointerup", stopDragging);
    this.viewportEl.addEventListener("pointercancel", stopDragging);

    this.updateTransform();
  }


  zoomBy(factor) {
    this.scale = Math.min(5, Math.max(0.25, this.scale * factor));
    this.updateTransform();
  }


  resetTransform() {
    this.scale = 1;
    this.panX = 0;
    this.panY = 0;
    this.updateTransform();
  }


  updateTransform() {
    if (!this.canvasEl) return;
    this.canvasEl.style.transform =
      `translate(${this.panX}px, ${this.panY}px) scale(${this.scale})`;
    if (this.scaleButton) {
      this.scaleButton.textContent = `${Math.round(this.scale * 100)}%`;
    }
  }


  onClose() {
    this.contentEl.empty();
  }
}


/*
 * Mermaid width directive:
 *
 * %% width: 72%
 */
const WIDTH_RE =
  /^\s*%%\s*width\s*:\s*(\d+(?:\.\d+)?)\s*%\s*$/i;

const IMAGE_WIDTH_RE =
  /^\s*%%\s*image-width\s*:\s*(\d+(?:\.\d+)?)\s*%\s*%%\s*$/i;

const TABLE_WIDTH_RE =
  /^\s*%%\s*table-width\s*:\s*(\d+(?:\.\d+)?)\s*%\s*%%\s*$/i;


/* =========================================================
 * Live Preview source-table decorations
 * ========================================================= */

class SourceTableControlsWidget extends WidgetType {

  constructor(plugin, sourceLine, width) {
    super();
    this.plugin = plugin;
    this.sourceLine = sourceLine;
    this.width = width;
  }


  eq(other) {
    return (
      other instanceof SourceTableControlsWidget &&
      other.sourceLine === this.sourceLine &&
      other.width === this.width &&
      other.plugin.currentStep === this.plugin.currentStep
    );
  }


  toDOM(cmView) {
    const row = document.createElement("span");
    row.className = "mir-source-table-control-row";
    row.style.setProperty(
      "--mir-source-table-width",
      `${this.plugin.clampWidth(this.width)}%`
    );

    const control = document.createElement("div");
    control.className =
      "mir-button-group mir-media-button-group mir-source-table-controls";

    const makeButton = (className, text, title) => {
      const button = document.createElement("button");
      button.type = "button";
      button.tabIndex = -1;
      button.className = `mir-button ${className}`;
      button.textContent = text;
      button.title = title;
      return button;
    };

    const minus = makeButton("mir-minus", "−", "按当前步长缩小表格");
    const step = makeButton(
      "mir-step-value",
      `${this.plugin.currentStep}%`,
      this.plugin.getStepButtonTitle()
    );
    const current = makeButton(
      "mir-width-value",
      `${Math.round(this.width)}%`,
      "当前表格宽度；点击恢复 100%"
    );
    const plus = makeButton("mir-plus", "+", "按当前步长放大表格");
    control.append(minus, step, current, plus);
    row.appendChild(control);

    ["pointerdown", "mousedown", "click"].forEach((eventName) => {
      control.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });

    const update = (change) => {
      const markdownView = this.plugin.findMarkdownViewForCM(cmView);
      if (!markdownView) {
        return;
      }

      const entry = this.plugin.findSourceTableEntry(
        markdownView.editor,
        this.sourceLine
      );
      if (!entry) {
        return;
      }

      const scrollPosition = this.plugin.getEditorScrollSnapshot(
        markdownView,
        control
      );
      const value = this.plugin.clampWidth(change(entry.width));
      current.textContent = `${Math.round(value)}%`;
      this.plugin.persistMediaWidth(markdownView, entry, "table", value);
      this.plugin.preserveEditorScroll(markdownView, scrollPosition);
    };

    minus.addEventListener("click", () => {
      update((width) => width - this.plugin.currentStep);
    });
    plus.addEventListener("click", () => {
      update((width) => width + this.plugin.currentStep);
    });
    current.addEventListener("click", () => {
      update(() => DEFAULT_WIDTH);
    });
    step.addEventListener("click", async () => {
      const markdownView = this.plugin.findMarkdownViewForCM(cmView);
      const scrollPosition = markdownView
        ? this.plugin.getEditorScrollSnapshot(markdownView, control)
        : null;
      await this.plugin.cycleStep();
      if (markdownView) {
        this.plugin.preserveEditorScroll(markdownView, scrollPosition);
      }
    });

    return row;
  }


  ignoreEvent() {
    return false;
  }
}


function buildSourceTableDecorations(cmView, plugin) {
  const markdown = cmView.state.doc.toString();
  const entries = plugin
    .extractMediaEntriesFromMarkdown(markdown)
    .filter((entry) => entry.kind === "table");
  const decorations = [];

  for (const entry of entries) {
    const width = plugin.clampWidth(entry.width);

    for (let lineNumber = entry.line; lineNumber <= entry.endLine; lineNumber++) {
      const line = cmView.state.doc.line(lineNumber + 1);
      const offset = lineNumber - entry.line;
      let rowClass = "mir-source-table-data-odd";

      if (offset === 0) {
        rowClass = "mir-source-table-header";
      } else if (offset === 1) {
        rowClass = "mir-source-table-separator";
      } else if ((offset - 2) % 2 === 1) {
        rowClass = "mir-source-table-data-even";
      }

      decorations.push(
        Decoration.line({
          attributes: {
            class:
              `mir-source-table-line ${rowClass}` +
              (lineNumber === entry.endLine ? " mir-source-table-last" : ""),
            style: `--mir-source-table-width: ${width}%`
          }
        }).range(line.from)
      );
    }

    const firstLine = cmView.state.doc.line(entry.line + 1);
    decorations.push(
      Decoration.widget({
        widget: new SourceTableControlsWidget(plugin, entry.line, width),
        side: -1
      }).range(firstLine.from)
    );
  }

  return Decoration.set(decorations, true);
}


function createSourceTableEditorExtension(plugin) {
  return ViewPlugin.fromClass(
    class {
      constructor(view) {
        this.decorations = buildSourceTableDecorations(view, plugin);
      }

      update(update) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet
        ) {
          this.decorations = buildSourceTableDecorations(update.view, plugin);
        }
      }
    },
    {
      decorations: (value) => value.decorations
    }
  );
}


/* =========================================================
 * Plugin
 * ========================================================= */

module.exports = class MermaidInlineResizer extends Plugin {

  async onload() {
    console.log(
      "[Mermaid Inline Resizer] v0.12.1 loaded"
    );

    document.body.classList.add("mir-plugin-active");


    /* -------------------------------------------------------
     * Plugin settings
     * ------------------------------------------------------- */

    const savedData =
      await this.loadData() || {};


    this.currentStep =
      this.normalizeStep(
        savedData.step
      );


    /* -------------------------------------------------------
     * Runtime state
     * ------------------------------------------------------- */

    this.refreshTimer = null;


    /*
     * 当前活动 Markdown 文件所有 Mermaid 的宽度。
     *
     * 例如：
     *
     * [
     *   72,
     *   100,
     *   65
     * ]
     *
     * 分别对应文档中第 1、2、3 个 Mermaid。
     *
     * 这个缓存非常重要：
     * PDF 打印事件发生时可以同步使用，
     * 不需要临时异步读取文件。
     */
    this.activeRenderedWidths = [];

    this.activeRenderedEntries = [];

    this.activeMediaEntries = [];

    /* macOS may let CodeMirror process pointer-down before the eventual click
     * handler runs. Capture the pre-interaction scroll position at the outer
     * document phase so a later widget rebuild never records the already
     * jumped-to-top value as the value to restore. */
    this.controlScrollSnapshots = new WeakMap();
    const captureControlPointer = (event) => {
      this.captureControlScrollSnapshot(event);
    };
    this.registerDomEvent(document, "pointerdown", captureControlPointer, {
      capture: true
    });
    this.registerDomEvent(document, "mousedown", captureControlPointer, {
      capture: true
    });

    /*
     * 当前缓存对应的文件路径。
     */
    this.cachedFilePath = null;


    /*
     * Reading View 按 sourcePath + 源文件行号匹配，避免分段渲染、
     * 折叠或滚动后把“当前 DOM 第 1 个图”误当成“全文第 1 个图”。
     */
    this.renderedEntryCache = new Map();


    /* -------------------------------------------------------
     * DOM observer
     * ------------------------------------------------------- */

    /*
     * Obsidian / Mermaid / CodeMirror 都可能重新创建 DOM。
     *
     * 特别是：
     * - Live Preview
     * - Reading View
     * - PDF Export
     *
     * 所以统一监听新出现的 Mermaid。
     */
    this.observer =
      new MutationObserver(
        (mutations) => {

          let containsMermaid = false;


          for (
            const mutation of mutations
          ) {

            for (
              const node of mutation.addedNodes
            ) {

              if (
                !(node instanceof HTMLElement)
              ) {
                continue;
              }


              if (
                node.matches?.(".mermaid") ||
                node.querySelector?.(".mermaid")
              ) {

                containsMermaid = true;
                break;
              }
            }


            if (containsMermaid) {
              break;
            }
          }


          /*
           * 如果明确检测到 Mermaid，
           * 更快处理。
           *
           * 否则普通 DOM 改动使用较长 debounce。
           */
          this.scheduleRefresh(
            containsMermaid
              ? 30
              : 120
          );
        }
      );


    this.observer.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );


    /* -------------------------------------------------------
     * PDF / Print
     * ------------------------------------------------------- */

    /*
     * PDF 打印前：
     *
     * 不进行异步文件读取，
     * 直接使用已经缓存好的 width。
     */
    this.registerDomEvent(
      window,
      "beforeprint",
      () => {

        this.applyCachedWidthsToRenderedCopies();

      }
    );


    this.registerMarkdownPostProcessor(
      async (element, context) => {
        this.rememberRenderedSection(element, context);
        await this.applyWidthsToRenderedSection(
          element,
          context
        );
      }
    );


    /*
     * 打印结束以后重新刷新一次普通界面。
     */
    this.registerDomEvent(
      window,
      "afterprint",
      () => {

        this.scheduleRefresh(100);

      }
    );


    /* -------------------------------------------------------
     * Workspace events
     * ------------------------------------------------------- */

    this.registerEvent(
      this.app.workspace.on(
        "active-leaf-change",
        () => {

          void this.handleActiveFileChange();

        }
      )
    );


    this.registerEvent(
      this.app.workspace.on(
        "file-open",
        () => {

          void this.handleActiveFileChange();

        }
      )
    );


    this.registerEvent(
      this.app.workspace.on(
        "layout-change",
        () => {

          this.scheduleRefresh();

        }
      )
    );


    /*
     * 当前 Markdown 发生修改。
     *
     * 这里立即刷新 width cache，
     * 保证随后导出 PDF 时拿到最新数据。
     */
    this.registerEvent(
      this.app.workspace.on(
        "editor-change",
        () => {

          const view =
            this.app.workspace
              .getActiveViewOfType(
                MarkdownView
              );


          if (
            view &&
            view.editor
          ) {

            this.updateActiveWidthCacheFromEditor(
              view.editor
            );
          }


          this.scheduleRefresh(180);

        }
      )
    );


    /* -------------------------------------------------------
     * Initial load
     * ------------------------------------------------------- */

    this.app.workspace.onLayoutReady(
      () => {

        void this.handleActiveFileChange();

      }
    );
  }


  onunload() {

    document.body.classList.remove("mir-plugin-active");

    if (this.observer) {

      this.observer.disconnect();

    }


    if (this.refreshTimer) {

      window.clearTimeout(
        this.refreshTimer
      );

    }


    /*
     * Obsidian 关闭/重载插件时不会替我们移除手工插入的 DOM。
     * 必须清掉旧按钮，否则新实例会把失去监听器的按钮误认为已安装。
     */
    document
      .querySelectorAll(
        ".mir-button-group:not(.mir-source-table-controls), .mir-fullscreen-button"
      )
      .forEach(
      (control) => control.remove()
    );
    document.querySelectorAll(".mir-media-host").forEach(
      (host) => host.classList.remove("mir-media-host")
    );


    console.log(
      "[Mermaid Inline Resizer] unloaded"
    );
  }


  /* ========================================================
   * Settings
   * ======================================================== */

  normalizeStep(step) {

    const numericStep =
      Number(step);


    if (
      STEP_OPTIONS.includes(
        numericStep
      )
    ) {

      return numericStep;

    }


    return DEFAULT_STEP;
  }


  async saveStep() {

    await this.saveData({
      step: this.currentStep
    });
  }


  async cycleStep() {

    const currentIndex =
      STEP_OPTIONS.indexOf(
        this.currentStep
      );


    const nextIndex =
      (
        currentIndex + 1
      ) %
      STEP_OPTIONS.length;


    this.currentStep =
      STEP_OPTIONS[nextIndex];


    await this.saveStep();


    /*
     * 只更新 step 按钮。
     *
     * 不修改 Markdown，
     * 不重新渲染 Mermaid。
     */
    this.updateAllStepButtons();
  }


  updateAllStepButtons() {

    document
      .querySelectorAll(
        ".mir-step-value"
      )
      .forEach(
        (button) => {

          button.textContent =
            `${this.currentStep}%`;


          button.title =
            this.getStepButtonTitle();

        }
      );


    document
      .querySelectorAll(
        ".mir-minus"
      )
      .forEach(
        (button) => {

          button.title =
            `按当前步长缩小 ${this.currentStep}%`;

        }
      );


    document
      .querySelectorAll(
        ".mir-plus"
      )
      .forEach(
        (button) => {

          button.title =
            `按当前步长放大 ${this.currentStep}%`;

        }
      );
  }


  getStepButtonTitle() {

    return (
      `当前步长 ${this.currentStep}%；` +
      "点击切换 1% → 3% → 5% → 10%"
    );
  }


  /* ========================================================
   * Active file cache
   * ======================================================== */

  async handleActiveFileChange() {

    await this.refreshWidthCacheFromActiveFile();


    this.scheduleRefresh(50);
  }


  async refreshWidthCacheFromActiveFile() {

    const file =
      this.app.workspace
        .getActiveFile();


    if (!file) {

      this.activeRenderedWidths = [];
      this.activeRenderedEntries = [];
      this.activeMediaEntries = [];
      this.cachedFilePath = null;

      return;
    }


    try {

      const text =
        await this.app.vault
          .cachedRead(file);


      this.activeRenderedWidths =
        this.extractWidthsFromMarkdown(
          text
        );

      this.activeRenderedEntries =
        this.extractWidthEntriesFromMarkdown(text);

      this.activeMediaEntries =
        this.extractMediaEntriesFromMarkdown(text);


      this.cachedFilePath =
        file.path;


    } catch (error) {

      console.warn(
        "[Mermaid Inline Resizer] " +
        "Could not read active file:",
        error
      );
    }
  }


  updateActiveWidthCacheFromEditor(
    editor
  ) {

    const blocks =
      this.findAllMermaidBlocks(
        editor
      );


    this.activeRenderedWidths =
      blocks.map(
        (block) => {

          return this.readWidthFromBlock(
            editor,
            block
          );

        }
      );

    const markdown = editor.getValue();
    this.activeRenderedEntries =
      this.extractWidthEntriesFromMarkdown(markdown);
    this.activeMediaEntries =
      this.extractMediaEntriesFromMarkdown(markdown);


    const file =
      this.app.workspace
        .getActiveFile();


    this.cachedFilePath =
      file
        ? file.path
        : null;
  }


  /*
   * 从纯 Markdown 文本中提取所有 Mermaid width。
   *
   * 用于：
   * - Reading View
   * - 文件切换
   * - PDF Export
   */
  extractWidthsFromMarkdown(
    markdown
  ) {

    const lines =
      markdown.split(
        /\r?\n/
      );


    const widths = [];


    for (
      let line = 0;
      line < lines.length;
      line++
    ) {

      const text =
        lines[line];


      const match =
        text.match(
          /^\s*(`{3,}|~{3,})\s*mermaid\b/i
        );


      if (!match) {

        continue;

      }


      const fence =
        match[1];


      const fenceChar =
        fence[0];


      const fenceLength =
        fence.length;


      let width =
        DEFAULT_WIDTH;


      let end =
        line + 1;


      for (
        ;
        end < lines.length;
        end++
      ) {

        const candidate =
          lines[end];


        /*
         * Width directive
         * 只检查代码块开头几行即可。
         */
        if (
          end <= line + 5
        ) {

          const widthMatch =
            candidate.match(
              WIDTH_RE
            );


          if (widthMatch) {

            width =
              this.clampWidth(
                Number(
                  widthMatch[1]
                )
              );
          }
        }


        const trimmed =
          candidate.trim();


        const closingRE =
          fenceChar === "`"
            ? new RegExp(
                "^`{" +
                fenceLength +
                ",}\\s*$"
              )
            : new RegExp(
                "^~{" +
                fenceLength +
                ",}\\s*$"
              );


        if (
          closingRE.test(
            trimmed
          )
        ) {

          break;

        }
      }


      widths.push(
        width
      );


      /*
       * 跳过当前完整 Mermaid block。
       */
      line = end;
    }


    return widths;
  }


  extractWidthEntriesFromMarkdown(markdown) {
    const lines = markdown.split(/\r?\n/);
    const entries = [];

    for (let line = 0; line < lines.length; line++) {
      const match = lines[line].match(
        /^\s*(`{3,}|~{3,})\s*mermaid\b/i
      );

      if (!match) {
        continue;
      }

      const fence = match[1];
      const fenceChar = fence[0];
      const fenceLength = fence.length;
      const closingRE = new RegExp(
        `^${fenceChar === "`" ? "`" : "~"}{${fenceLength},}\\s*$`
      );
      let width = DEFAULT_WIDTH;
      let end = line + 1;

      for (; end < lines.length; end++) {
        if (end <= line + 5) {
          const widthMatch = lines[end].match(WIDTH_RE);
          if (widthMatch) {
            width = this.clampWidth(Number(widthMatch[1]));
          }
        }

        if (closingRE.test(lines[end].trim())) {
          break;
        }
      }

      entries.push({ line, endLine: end, width });
      line = end;
    }

    return entries;
  }


  extractMediaEntriesFromMarkdown(markdown) {
    const lines = markdown.split(/\r?\n/);
    const entries = [];
    let inFence = false;
    let fenceChar = null;
    let fenceLength = 0;

    for (let line = 0; line < lines.length; line++) {
      const fenceMatch = lines[line].match(/^\s*(`{3,}|~{3,})/);

      if (fenceMatch) {
        const fence = fenceMatch[1];
        if (!inFence) {
          inFence = true;
          fenceChar = fence[0];
          fenceLength = fence.length;
        } else if (fence[0] === fenceChar && fence.length >= fenceLength) {
          inFence = false;
          fenceChar = null;
          fenceLength = 0;
        }
        continue;
      }

      if (inFence) {
        continue;
      }

      const previous = line > 0 ? lines[line - 1] : "";
      const imageMatch = lines[line].match(
        /^\s*(?:!\[\[[^\]]+\]\]|!\[[^\]]*\]\([^)]+\))\s*$/
      );

      if (imageMatch) {
        const directive = previous.match(IMAGE_WIDTH_RE);
        entries.push({
          kind: "image",
          line,
          endLine: line,
          directiveLine: directive ? line - 1 : -1,
          width: directive
            ? this.clampWidth(Number(directive[1]))
            : DEFAULT_WIDTH
        });
        continue;
      }

      const separator = lines[line + 1] || "";
      const isTable =
        lines[line].includes("|") &&
        /^\s*\|?\s*:?-{3,}:?\s*(?:\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(separator);

      if (isTable) {
        let endLine = line + 1;
        while (
          endLine + 1 < lines.length &&
          lines[endLine + 1].includes("|") &&
          lines[endLine + 1].trim() !== ""
        ) {
          endLine++;
        }
        /*
         * 宽度指令与表格之间必须留一个空行，否则 Obsidian 1.13
         * 不会创建原生 .cm-table-widget。向上跨过空行查找指令，
         * 同时兼容旧版紧贴表格的写法。
         */
        let directiveLine = line - 1;
        while (
          directiveLine >= 0 &&
          lines[directiveLine].trim() === "" &&
          line - directiveLine <= 3
        ) {
          directiveLine--;
        }
        const directive = directiveLine >= 0
          ? lines[directiveLine].match(TABLE_WIDTH_RE)
          : null;
        entries.push({
          kind: "table",
          line,
          endLine,
          directiveLine: directive ? directiveLine : -1,
          width: directive
            ? this.clampWidth(Number(directive[1]))
            : DEFAULT_WIDTH
        });
        line = endLine;
      }
    }

    return entries;
  }


  async getRenderedWidthEntries(sourcePath) {
    if (!sourcePath) {
      return [];
    }

    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!file) {
      return [];
    }

    try {
      const markdown = await this.app.vault.cachedRead(file);
      const cached = this.renderedEntryCache.get(sourcePath);

      if (cached?.markdown === markdown) {
        return cached.entries;
      }

      const entries = this.extractWidthEntriesFromMarkdown(markdown);
      const mediaEntries = this.extractMediaEntriesFromMarkdown(markdown);
      this.renderedEntryCache.set(
        sourcePath,
        { markdown, entries, mediaEntries }
      );
      return entries;

    } catch (error) {
      console.warn(
        "[Mermaid Inline Resizer] Could not read rendered source:",
        error
      );
      return [];
    }
  }


  async applyWidthsToRenderedSection(element, context) {
    const mermaids = [];

    if (element.matches?.(".mermaid")) {
      mermaids.push(element);
    }

    mermaids.push(...element.querySelectorAll(".mermaid"));

    const renderedMermaids = mermaids.filter(
      (mermaid) => !mermaid.closest(".markdown-source-view")
    );

    if (renderedMermaids.length === 0) {
      await this.applyMediaWidthsToRenderedSection(element, context);
      return;
    }

    const entries = await this.getRenderedWidthEntries(context.sourcePath);
    const sectionInfo = context.getSectionInfo?.(element);
    let sectionEntries = entries;

    if (sectionInfo && Number.isInteger(sectionInfo.lineStart)) {
      const lineEnd = Number.isInteger(sectionInfo.lineEnd)
        ? sectionInfo.lineEnd
        : sectionInfo.lineStart;
      sectionEntries = entries.filter(
        (entry) =>
          entry.line <= lineEnd &&
          entry.endLine >= sectionInfo.lineStart
      );
    }

    /*
     * 极少数渲染上下文不给行号时，退回该 section 自身源码；
     * 仍然不会依赖整个 Reading View 当前出现了多少 DOM 节点。
     */
    if (sectionEntries.length === 0 && sectionInfo?.text) {
      sectionEntries = this.extractWidthEntriesFromMarkdown(sectionInfo.text);
    }

    renderedMermaids.forEach((mermaid, index) => {
      const matchedEntry = sectionEntries[index];
      if (!matchedEntry) {
        return;
      }
      mermaid.dataset.mirSourceMapped = "true";
      this.applyWidth(
        mermaid,
        matchedEntry.width
      );
    });

    await this.applyMediaWidthsToRenderedSection(element, context);
  }


  rememberRenderedSection(element, context) {
    const sectionInfo = context.getSectionInfo?.(element);
    if (!sectionInfo || !Number.isInteger(sectionInfo.lineStart)) {
      return;
    }

    element.dataset.mirLineStart = String(sectionInfo.lineStart);
    element.dataset.mirLineEnd = String(
      Number.isInteger(sectionInfo.lineEnd)
        ? sectionInfo.lineEnd
        : sectionInfo.lineStart
    );
    element.dataset.mirSourcePath = context.sourcePath || "";
  }


  applyMappedRenderedSections() {
    const activeFile = this.app.workspace.getActiveFile();
    if (!activeFile || activeFile.path !== this.cachedFilePath) {
      return;
    }

    document.querySelectorAll(
      ".markdown-reading-view [data-mir-line-start]"
    ).forEach((section) => {
      const start = Number(section.dataset.mirLineStart);
      const end = Number(section.dataset.mirLineEnd);
      if (!Number.isInteger(start) || !Number.isInteger(end)) {
        return;
      }

      const mermaidEntries = this.activeRenderedEntries.filter(
        (entry) => entry.line <= end && entry.endLine >= start
      );
      section.querySelectorAll(".mermaid").forEach((mermaid, index) => {
        const entry = mermaidEntries[index];
        if (!entry) {
          return;
        }
        mermaid.dataset.mirSourceMapped = "true";
        this.applyWidth(mermaid, entry.width);
      });

      const mediaEntries = this.activeMediaEntries.filter(
        (entry) => entry.line <= end && entry.endLine >= start
      );
      const imageEntries = mediaEntries.filter((entry) => entry.kind === "image");
      const tableEntries = mediaEntries.filter((entry) => entry.kind === "table");
      section.querySelectorAll(".image-embed img").forEach((image, index) => {
        const entry = imageEntries[index];
        if (entry) {
          this.applyMediaWidth(image, entry.width, "image");
        }
      });
      section.querySelectorAll("table").forEach((table, index) => {
        const entry = tableEntries[index];
        if (entry) {
          this.applyMediaWidth(table, entry.width, "table");
        }
      });
    });
  }


  async getRenderedMediaEntries(sourcePath) {
    if (!sourcePath) {
      return [];
    }

    const file = this.app.vault.getAbstractFileByPath(sourcePath);
    if (!file) {
      return [];
    }

    try {
      const markdown = await this.app.vault.cachedRead(file);
      const cached = this.renderedEntryCache.get(sourcePath);
      if (cached?.markdown === markdown && cached.mediaEntries) {
        return cached.mediaEntries;
      }
      const entries = this.extractWidthEntriesFromMarkdown(markdown);
      const mediaEntries = this.extractMediaEntriesFromMarkdown(markdown);
      this.renderedEntryCache.set(
        sourcePath,
        { markdown, entries, mediaEntries }
      );
      return mediaEntries;
    } catch (error) {
      console.warn("[Mermaid Inline Resizer] Media mapping failed:", error);
      return [];
    }
  }


  async applyMediaWidthsToRenderedSection(element, context) {
    const images = Array.from(element.querySelectorAll("img")).filter(
      (image) =>
        !image.closest(".markdown-source-view") &&
        !image.closest(".mir-button-group")
    );
    const tables = Array.from(element.querySelectorAll("table")).filter(
      (table) => !table.closest(".markdown-source-view")
    );

    if (images.length === 0 && tables.length === 0) {
      return;
    }

    const mediaEntries = await this.getRenderedMediaEntries(context.sourcePath);
    const sectionInfo = context.getSectionInfo?.(element);
    let relevant = mediaEntries;

    if (sectionInfo && Number.isInteger(sectionInfo.lineStart)) {
      const lineEnd = Number.isInteger(sectionInfo.lineEnd)
        ? sectionInfo.lineEnd
        : sectionInfo.lineStart;
      relevant = mediaEntries.filter(
        (entry) =>
          entry.line <= lineEnd &&
          entry.endLine >= sectionInfo.lineStart
      );
    }

    const imageEntries = relevant.filter((entry) => entry.kind === "image");
    const tableEntries = relevant.filter((entry) => entry.kind === "table");

    images.forEach((image, index) => {
      const entry = imageEntries[index];
      if (entry) {
        this.applyMediaWidth(image, entry.width, "image");
      }
    });
    tables.forEach((table, index) => {
      const entry = tableEntries[index];
      if (entry) {
        this.applyMediaWidth(table, entry.width, "table");
      }
    });
  }


  /* ========================================================
   * Refresh
   * ======================================================== */

  scheduleRefresh(
    delay = 100
  ) {

    if (
      this.refreshTimer
    ) {

      window.clearTimeout(
        this.refreshTimer
      );
    }


    this.refreshTimer =
      window.setTimeout(
        () => {

          this.refreshTimer = null;

          this.refresh();

        },
        delay
      );
  }


  refresh() {

    const view =
      this.app.workspace
        .getActiveViewOfType(
          MarkdownView
        );


    /*
     * Live Preview
     */
    if (
      view &&
      view.editor
    ) {

      this.updateActiveWidthCacheFromEditor(
        view.editor
      );


      this.refreshLivePreview(
        view
      );
    }


    /*
     * Reading View / PDF / 其他渲染副本。
     */
    this.applyCachedWidthsToRenderedCopies();
  }


  /* ========================================================
   * Live Preview
   * ======================================================== */

  refreshLivePreview(
    view
  ) {

    const sourceView =
      view.containerEl
        .querySelector(
          ".markdown-source-view.mod-cm6"
        );


    if (!sourceView) {

      return;

    }


    const diagrams =
      sourceView
        .querySelectorAll(
          ".mermaid"
        );


    diagrams.forEach(
      (mermaidEl) => {

        const block =
          this.findBlockForElement(
            view,
            mermaidEl
          );


        if (!block) {

          return;

        }


        const width =
          this.readWidthFromBlock(
            view.editor,
            block
          );


        this.applyWidth(
          mermaidEl,
          width
        );


        this.installControls(
          view,
          mermaidEl,
          block,
          width
        );
      }
    );


    this.refreshLivePreviewMedia(view, sourceView);
  }


  /* ========================================================
   * Reading View / PDF
   * ======================================================== */

  /*
   * 将当前 activeRenderedWidths
   * 应用于所有“非 Live Preview” Mermaid。
   *
   * 这包括：
   * - Reading View
   * - PDF print DOM
   * - Obsidian 创建的其他 Markdown 渲染副本
   */
  applyCachedWidthsToRenderedCopies() {

    this.applyMappedRenderedSections();

    if (
      !this.activeRenderedWidths ||
      this.activeRenderedWidths.length === 0
    ) {

      return;

    }


    const allMermaids =
      Array.from(
        document.querySelectorAll(
          ".mermaid"
        )
      );


    /*
     * Live Preview Mermaid 由另一套精确 block mapping 处理。
     */
    const renderedMermaids =
      allMermaids.filter(
        (mermaidEl) => {

          return (
            !mermaidEl.closest(".markdown-source-view") &&
            !mermaidEl.closest(".markdown-reading-view")
          );

        }
      );


    if (
      renderedMermaids.length === 0
    ) {

      return;

    }


    /*
     * 一个 Obsidian 窗口中可能同时存在：
     *
     * - Reading View
     * - PDF hidden render tree
     * - Preview copy
     *
     * 所以不能把它们混成一条序列。
     *
     * 按各自渲染根节点分组后，
     * 每组都从 Mermaid #1 开始匹配。
     */
    const groups =
      new Map();


    renderedMermaids.forEach(
      (mermaidEl) => {

        const root =
          this.getRenderedRoot(
            mermaidEl
          );


        if (
          !groups.has(root)
        ) {

          groups.set(
            root,
            []
          );
        }


        groups
          .get(root)
          .push(
            mermaidEl
          );
      }
    );


    groups.forEach(
      (mermaids) => {

        mermaids.forEach(
          (
            mermaidEl,
            index
          ) => {

            /*
             * Reading View post processor 已按源文件行号精确映射；
             * 旧的 DOM 序号 fallback 不得再次覆盖它。
             */
            if (mermaidEl.dataset.mirSourceMapped === "true") {
              return;
            }

            const width =
              this.activeRenderedWidths[
                index
              ] ??
              DEFAULT_WIDTH;


            this.applyWidth(
              mermaidEl,
              width
            );
          }
        );
      }
    );
  }


  getRenderedRoot(
    mermaidEl
  ) {

    /*
     * PDF Export 常见打印容器。
     *
     * 如果未来 Obsidian 改 DOM，
     * 后面的 fallback 仍然可以工作。
     */
    const printRoot =
      mermaidEl.closest(
        ".print, " +
        ".print-container, " +
        ".pdf-export"
      );


    if (printRoot) {

      return printRoot;

    }


    const readingRoot =
      mermaidEl.closest(
        ".markdown-reading-view"
      );


    if (readingRoot) {

      return readingRoot;

    }


    const previewRoot =
      mermaidEl.closest(
        ".markdown-preview-view"
      );


    if (previewRoot) {

      return previewRoot;

    }


    const markdownLeaf =
      mermaidEl.closest(
        ".workspace-leaf-content[data-type='markdown']"
      );


    if (markdownLeaf) {

      return markdownLeaf;

    }


    /*
     * PDF DOM 如果没有上述 class，
     * 最后退回 document body。
     */
    return (
      mermaidEl.ownerDocument
        ?.body ||
      document.body
    );
  }


  /* ========================================================
   * Mermaid source detection
   * ======================================================== */

  findAllMermaidBlocks(
    editor
  ) {

    const blocks = [];


    const lineCount =
      editor.lineCount();


    for (
      let line = 0;
      line < lineCount;
      line++
    ) {

      const text =
        editor.getLine(
          line
        );


      const match =
        text.match(
          /^\s*(`{3,}|~{3,})\s*mermaid\b/i
        );


      if (!match) {

        continue;

      }


      const fence =
        match[1];


      const fenceChar =
        fence[0];


      const fenceLength =
        fence.length;


      let end =
        line + 1;


      for (
        ;
        end < lineCount;
        end++
      ) {

        const candidate =
          editor
            .getLine(end)
            .trim();


        const closingRE =
          fenceChar === "`"
            ? new RegExp(
                "^`{" +
                fenceLength +
                ",}\\s*$"
              )
            : new RegExp(
                "^~{" +
                fenceLength +
                ",}\\s*$"
              );


        if (
          closingRE.test(
            candidate
          )
        ) {

          break;

        }
      }


      if (
        end >= lineCount
      ) {

        continue;

      }


      blocks.push({
        start: line,
        end: end
      });


      line = end;
    }


    return blocks;
  }


  findBlockForElement(
    view,
    mermaidEl
  ) {

    const editor =
      view.editor;


    const blocks =
      this.findAllMermaidBlocks(
        editor
      );


    if (
      blocks.length === 0
    ) {

      return null;

    }


    /*
     * 优先通过 CodeMirror 坐标定位。
     */
    try {

      const cm =
        editor.cm;


      if (
        cm &&
        typeof cm.posAtCoords ===
          "function"
      ) {

        const rect =
          mermaidEl
            .getBoundingClientRect();


        const coords = {

          x:
            rect.left +
            Math.max(
              1,
              rect.width / 2
            ),

          y:
            rect.top +
            Math.max(
              1,
              rect.height / 2
            )
        };


        const offset =
          cm.posAtCoords(
            coords,
            false
          );


        if (
          offset !== null &&
          offset !== undefined
        ) {

          const docLine =
            cm.state.doc
              .lineAt(offset)
              .number - 1;


          /*
           * 精确包含。
           */
          for (
            const block of blocks
          ) {

            if (
              docLine >=
                block.start &&
              docLine <=
                block.end
            ) {

              return block;

            }
          }


          /*
           * Mermaid widget 有时映射到 block 邻近行。
           */
          let nearest = null;
          let nearestDistance =
            Infinity;


          for (
            const block of blocks
          ) {

            let distance = 0;


            if (
              docLine <
              block.start
            ) {

              distance =
                block.start -
                docLine;

            } else if (
              docLine >
              block.end
            ) {

              distance =
                docLine -
                block.end;

            }


            if (
              distance <
              nearestDistance
            ) {

              nearestDistance =
                distance;


              nearest =
                block;
            }
          }


          if (
            nearest &&
            nearestDistance <= 5
          ) {

            return nearest;

          }
        }
      }

    } catch (error) {

      console.warn(
        "[Mermaid Inline Resizer] " +
        "DOM/source mapping failed:",
        error
      );
    }


    /*
     * Fallback：
     * 当前光标最近的 Mermaid。
     */
    const cursorLine =
      editor
        .getCursor()
        .line;


    let nearest = null;
    let nearestDistance =
      Infinity;


    for (
      const block of blocks
    ) {

      let distance;


      if (
        cursorLine <
        block.start
      ) {

        distance =
          block.start -
          cursorLine;

      } else if (
        cursorLine >
        block.end
      ) {

        distance =
          cursorLine -
          block.end;

      } else {

        distance = 0;

      }


      if (
        distance <
        nearestDistance
      ) {

        nearestDistance =
          distance;


        nearest =
          block;
      }
    }


    return nearest;
  }


  /* ========================================================
   * Width metadata
   * ======================================================== */

  readWidthFromBlock(
    editor,
    block
  ) {

    for (
      let line =
        block.start + 1;

      line <
        block.end;

      line++
    ) {

      const text =
        editor.getLine(
          line
        );


      const match =
        text.match(
          WIDTH_RE
        );


      if (match) {

        return this.clampWidth(
          Number(
            match[1]
          )
        );
      }


      if (
        line >=
        block.start + 5
      ) {

        break;

      }
    }


    return DEFAULT_WIDTH;
  }


  persistWidthForBlock(
    view,
    block,
    width
  ) {

    const editor =
      view.editor;


    const value =
      Math.round(
        this.clampWidth(
          width
        )
      );


    const directive =
      `%% width: ${value}%`;


    /*
     * 已有 width directive。
     */
    for (
      let line =
        block.start + 1;

      line <
        block.end &&
      line <=
        block.start + 5;

      line++
    ) {

      const text =
        editor.getLine(
          line
        );


      if (
        WIDTH_RE.test(
          text
        )
      ) {

        if (
          text.trim() ===
          directive
        ) {

          return;

        }


        editor.replaceRange(
          directive,

          {
            line: line,
            ch: 0
          },

          {
            line: line,
            ch: text.length
          }
        );


        /*
         * 立即更新 PDF / Reading View 缓存。
         */
        this.updateActiveWidthCacheFromEditor(
          editor
        );


        return;
      }
    }


    /*
     * 第一次设置：
     *
     * ```mermaid
     * %% width: 72%
     * flowchart ...
     */
    editor.replaceRange(
      directive + "\n",

      {
        line:
          block.start + 1,

        ch: 0
      }
    );


    /*
     * 新增了一行以后，
     * 当前 block 行号会变化，
     * 直接重新扫描整个 editor。
     */
    this.updateActiveWidthCacheFromEditor(
      editor
    );
  }


  /* ========================================================
   * Width application
   * ======================================================== */

  locateEditorLineForElement(editor, element) {
    try {
      const cm = editor.cm;
      const rect = element.getBoundingClientRect();
      const offset = cm?.posAtCoords?.({
        x: rect.left + Math.max(1, rect.width / 2),
        y: rect.top + Math.max(1, rect.height / 2)
      }, false);
      if (offset !== null && offset !== undefined) {
        return cm.state.doc.lineAt(offset).number - 1;
      }
    } catch (error) {
      console.warn("[Mermaid Inline Resizer] Media position mapping failed:", error);
    }
    return editor.getCursor().line;
  }


  findMediaEntryForElement(editor, element, kind) {
    const entries = this.extractMediaEntriesFromMarkdown(editor.getValue())
      .filter((entry) => entry.kind === kind);
    const line = this.locateEditorLineForElement(editor, element);

    const containing = entries.find(
      (entry) => line >= entry.line && line <= entry.endLine
    );
    if (containing) {
      return containing;
    }

    let nearest = null;
    let distance = Infinity;
    for (const entry of entries) {
      const current = Math.min(
        Math.abs(line - entry.line),
        Math.abs(line - entry.endLine)
      );
      if (current < distance) {
        nearest = entry;
        distance = current;
      }
    }
    return distance <= 3 ? nearest : null;
  }


  findMarkdownViewForCM(cmView) {
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view?.editor?.cm === cmView) {
        return view;
      }
    }
    return null;
  }


  findMarkdownViewForElement(element) {
    if (!element) {
      return null;
    }
    for (const leaf of this.app.workspace.getLeavesOfType("markdown")) {
      const view = leaf.view;
      if (view?.containerEl?.contains(element)) {
        return view;
      }
    }
    return null;
  }


  captureControlScrollSnapshot(event) {
    const button = event.target?.closest?.(".mir-button-group .mir-button");
    if (!button) {
      return;
    }

    /* Prevent native button focus before CodeMirror can move its selection.
     * Do not stop propagation here: the existing control-level handlers still
     * own the click action and stop it before it bubbles into the editor. */
    event.preventDefault();

    const control = button.closest(".mir-button-group");
    const view = this.findMarkdownViewForElement(button);
    const scrollDOM = view?.editor?.cm?.scrollDOM;
    if (!control || !view || !scrollDOM) {
      return;
    }

    /* A physical click emits pointerdown followed by mousedown. Preserve the
     * earlier pointer snapshot even if an editor listener moves the viewport
     * between those two events; a later pointerdown always starts a new click. */
    const previous = this.controlScrollSnapshots.get(control);
    const now = performance.now();
    if (
      event.type === "mousedown" &&
      previous &&
      now - previous.capturedAt < 250
    ) {
      return;
    }

    this.controlScrollSnapshots.set(control, {
      view,
      scrollTop: scrollDOM.scrollTop,
      scrollLeft: scrollDOM.scrollLeft,
      capturedAt: now
    });
  }


  getEditorScrollSnapshot(view, controlOrButton) {
    const control = controlOrButton?.matches?.(".mir-button-group")
      ? controlOrButton
      : controlOrButton?.closest?.(".mir-button-group");
    const captured = control && this.controlScrollSnapshots?.get(control);
    if (captured?.view === view) {
      return captured;
    }

    const scrollDOM = view?.editor?.cm?.scrollDOM;
    return {
      view,
      scrollTop: scrollDOM?.scrollTop,
      scrollLeft: scrollDOM?.scrollLeft
    };
  }


  findSourceTableEntry(editor, sourceLine) {
    const entries = this.extractMediaEntriesFromMarkdown(editor.getValue())
      .filter((entry) => entry.kind === "table");
    const containing = entries.find(
      (entry) => sourceLine >= entry.line && sourceLine <= entry.endLine
    );
    if (containing) {
      return containing;
    }

    let nearest = null;
    let distance = Infinity;
    for (const entry of entries) {
      const current = Math.abs(entry.line - sourceLine);
      if (current < distance) {
        nearest = entry;
        distance = current;
      }
    }
    return distance <= 2 ? nearest : null;
  }


  refreshLivePreviewMedia(view, sourceView) {
    /* 只选择 Markdown 真正渲染出的图片，排除标题、图标等 0×0 内部 img。 */
    const images = Array.from(
      sourceView.querySelectorAll(".image-embed img")
    );
    const tables = Array.from(
      sourceView.querySelectorAll(
        ".cm-table-widget table, .cm-embed-block table"
      )
    );

    images.forEach((image) => {
      const entry = this.findMediaEntryForElement(view.editor, image, "image");
      if (!entry) {
        return;
      }
      /* .image-embed 是 CodeMirror 管理的安全 widget；绝不写入 .cm-line。 */
      const host = image.closest(".image-embed");
      if (!host) {
        return;
      }
      this.applyMediaWidth(image, entry.width, "image");
      this.installMediaControls(view, host, image, entry, "image");
    });

    tables.forEach((table) => {
      const entry = this.findMediaEntryForElement(view.editor, table, "table");
      if (!entry) {
        return;
      }
      /* 表格控件同样只能进入 widget 容器，避免污染 Markdown。 */
      const host = table.closest(".cm-table-widget");
      if (!host) {
        return;
      }
      this.applyMediaWidth(table, entry.width, "table");
      this.installMediaControls(view, host, table, entry, "table");
    });
  }


  applyMediaWidth(element, width, kind) {
    const value = this.clampWidth(width);
    element.classList.add("mir-resizable-media", `mir-resizable-${kind}`);
    element.dataset.mirWidth = String(value);
    element.style.setProperty("width", `${value}%`, "important");
    element.style.setProperty("max-width", `${value}%`, "important");
    element.style.setProperty("margin-left", "auto", "important");
    element.style.setProperty("margin-right", "auto", "important");

    if (kind === "image") {
      element.style.setProperty("height", "auto", "important");
      element.style.setProperty("display", "block", "important");
    }
  }


  persistMediaWidth(view, entry, kind, width) {
    const editor = view.editor;
    const value = Math.round(this.clampWidth(width));
    const directive = `%% ${kind}-width: ${value}% %%`;

    if (kind === "table") {
      if (entry.directiveLine >= 0) {
        const oldLine = editor.getLine(entry.directiveLine);

        if (entry.directiveLine === entry.line - 1) {
          /*
           * 迁移旧格式：
           *
           * %% table-width: 90% %%
           * | table |
           *
           * -> 指令后增加空行，保住 Obsidian 原生表格 Widget。
           */
          editor.replaceRange(
            directive + "\n\n",
            { line: entry.directiveLine, ch: 0 },
            { line: entry.line, ch: 0 }
          );
        } else {
          editor.replaceRange(
            directive,
            { line: entry.directiveLine, ch: 0 },
            { line: entry.directiveLine, ch: oldLine.length }
          );
        }
      } else {
        editor.replaceRange(
          directive + "\n\n",
          { line: entry.line, ch: 0 }
        );
      }

      this.renderedEntryCache.delete(view.file?.path || "");
      return;
    }

    /*
     * 不信任控件创建时捕获的 directiveLine：第一次插入指令会令
     * CodeMirror widget 重建，旧 entry 的行号随即失效。每次保存都以
     * 当前媒体行向上扫描，并把意外产生的连续重复指令合并为一条。
     */
    const directiveRE = kind === "image" ? IMAGE_WIDTH_RE : TABLE_WIDTH_RE;
    let firstDirective = entry.line;
    while (
      firstDirective > 0 &&
      directiveRE.test(editor.getLine(firstDirective - 1))
    ) {
      firstDirective--;
    }

    if (firstDirective < entry.line) {
      const lastDirective = entry.line - 1;
      const oldLastLine = editor.getLine(lastDirective);
      editor.replaceRange(
        directive,
        { line: firstDirective, ch: 0 },
        { line: lastDirective, ch: oldLastLine.length }
      );
    } else {
      editor.replaceRange(
        directive + "\n",
        { line: entry.line, ch: 0 }
      );
    }

    this.renderedEntryCache.delete(view.file?.path || "");
  }


  preserveEditorScroll(view, scrollPosition) {
    const scrollDOM = view.editor?.cm?.scrollDOM;
    const scrollTop = typeof scrollPosition === "number"
      ? scrollPosition
      : scrollPosition?.scrollTop;
    const scrollLeft = typeof scrollPosition === "object"
      ? scrollPosition?.scrollLeft
      : scrollDOM?.scrollLeft;
    if (!scrollDOM || !Number.isFinite(scrollTop)) {
      return;
    }

    if (!this.scrollRestoreTokens) {
      this.scrollRestoreTokens = new WeakMap();
    }

    const token = {};
    this.scrollRestoreTokens.set(scrollDOM, token);

    const restore = () => {
      if (this.scrollRestoreTokens.get(scrollDOM) !== token) {
        return;
      }
      scrollDOM.scrollTop = scrollTop;
      if (Number.isFinite(scrollLeft)) {
        scrollDOM.scrollLeft = scrollLeft;
      }
    };

    /*
     * CodeMirror 会在 transaction、widget 重建和下一次测量阶段
     * 分别尝试滚动到 selection anchor，因此需要跨布局帧恢复。
     */
    restore();
    window.requestAnimationFrame(() => {
      restore();
      window.requestAnimationFrame(restore);
    });
    [80, 180, 320, 500, 750].forEach((delay) => {
      window.setTimeout(restore, delay);
    });
  }


  installMediaControls(view, host, target, entry, kind) {
    const existing = host.querySelector(".mir-media-button-group");
    if (existing) {
      const widthValue = existing.querySelector(".mir-width-value");
      if (widthValue) {
        widthValue.textContent = `${Math.round(entry.width)}%`;
      }
      return;
    }

    host.classList.add("mir-media-host");
    const control = document.createElement("div");
    control.className = "mir-button-group mir-media-button-group";

    const makeButton = (className, text, title) => {
      const button = document.createElement("button");
      button.type = "button";
      button.tabIndex = -1;
      button.className = `mir-button ${className}`;
      button.textContent = text;
      button.title = title;
      return button;
    };

    const minus = makeButton("mir-minus", "−", "按当前步长缩小");
    const step = makeButton(
      "mir-step-value",
      `${this.currentStep}%`,
      this.getStepButtonTitle()
    );
    const current = makeButton(
      "mir-width-value",
      `${Math.round(entry.width)}%`,
      `当前${kind === "image" ? "图片" : "表格"}宽度；点击恢复 100%`
    );
    const plus = makeButton("mir-plus", "+", "按当前步长放大");
    control.append(minus, step, current, plus);
    host.appendChild(control);

    ["mousedown", "pointerdown", "click"].forEach((eventName) => {
      control.addEventListener(eventName, (event) => {
        event.stopPropagation();
        event.preventDefault();
      });
    });

    const update = (change) => {
      const scrollPosition = this.getEditorScrollSnapshot(view, control);
      const freshEntry = this.findMediaEntryForElement(
        view.editor,
        target,
        kind
      );
      if (!freshEntry) {
        return;
      }
      const value = this.clampWidth(change(freshEntry.width));
      this.applyMediaWidth(target, value, kind);
      current.textContent = `${Math.round(value)}%`;
      this.persistMediaWidth(view, freshEntry, kind, value);
      this.preserveEditorScroll(view, scrollPosition);
    };

    minus.addEventListener("click", (event) => {
      event.preventDefault();
      update((width) => width - this.currentStep);
    });
    plus.addEventListener("click", (event) => {
      event.preventDefault();
      update((width) => width + this.currentStep);
    });
    current.addEventListener("click", (event) => {
      event.preventDefault();
      update(() => DEFAULT_WIDTH);
    });
    step.addEventListener("click", async (event) => {
      event.preventDefault();
      const scrollPosition = this.getEditorScrollSnapshot(view, control);
      await this.cycleStep();
      this.preserveEditorScroll(view, scrollPosition);
    });
  }


  applyWidthsToRenderedRoot(root, markdown) {
    const mermaidEntries = this.extractWidthEntriesFromMarkdown(markdown);
    root.querySelectorAll(".mermaid").forEach((mermaid, index) => {
      const entry = mermaidEntries[index];
      if (entry) {
        /* PDF preview owns this detached render root. Mark it as precisely
         * mapped before applying its width so the global rendered-view
         * fallback cannot subsequently overwrite it with DEFAULT_WIDTH. */
        mermaid.dataset.mirSourceMapped = "true";
        this.applyWidth(mermaid, entry.width);
      }
    });

    const mediaEntries = this.extractMediaEntriesFromMarkdown(markdown);
    const imageEntries = mediaEntries.filter((entry) => entry.kind === "image");
    const tableEntries = mediaEntries.filter((entry) => entry.kind === "table");
    const images = Array.from(new Set(root.querySelectorAll(".image-embed img, img")));
    images.forEach((image, index) => {
      const entry = imageEntries[index];
      if (entry) this.applyMediaWidth(image, entry.width, "image");
    });
    root.querySelectorAll("table").forEach((table, index) => {
      const entry = tableEntries[index];
      if (entry) this.applyMediaWidth(table, entry.width, "table");
    });
  }


  shouldInstallFullscreenControl(mermaidEl) {
    return !mermaidEl.closest(
      ".print, .print-container, .pdf-export, .mir-pdf-preview-page, .mir-pdf-preview-staging, .bysan-pdf-preview-page, .bysan-pdf-preview-staging, .mir-zoom-modal"
    );
  }


  installFullscreenZoomControl(mermaidEl) {
    if (
      !this.shouldInstallFullscreenControl(mermaidEl) ||
      mermaidEl.querySelector(":scope > .mir-fullscreen-button")
    ) {
      return;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.tabIndex = -1;
    button.className = "mir-fullscreen-button";
    button.textContent = "⛶";
    button.title = "全屏查看并缩放 Mermaid";
    ["pointerdown", "mousedown"].forEach((eventName) => {
      button.addEventListener(eventName, (event) => {
        event.preventDefault();
        event.stopPropagation();
      });
    });
    button.onclick = (event) => {
      event.preventDefault();
      event.stopPropagation();
      window.setTimeout(() => {
        try {
          new MermaidZoomModal(this.app, mermaidEl).open();
        } catch (error) {
          console.error("[Mermaid Inline Resizer] 无法打开缩放窗口", error);
          new Notice(`无法打开 Mermaid 缩放窗口：${error?.message || error}`);
        }
      }, 80);
    };
    mermaidEl.appendChild(button);
  }

  clampWidth(
    value
  ) {

    if (
      !Number.isFinite(
        value
      )
    ) {

      return DEFAULT_WIDTH;

    }


    return Math.min(
      MAX_WIDTH,

      Math.max(
        MIN_WIDTH,
        value
      )
    );
  }


  applyWidth(
    mermaidEl,
    width
  ) {

    const value =
      this.clampWidth(
        width
      );


    mermaidEl.classList.add(
      "mir-managed"
    );


    mermaidEl.dataset.mirWidth =
      String(value);


    /*
     * 控制按钮位置。
     */
    mermaidEl.style.setProperty(
      "--mir-visible-width",
      `${value}%`
    );


    /* SVG 可能在本次 post processor 之后异步生成。 */
    mermaidEl.style.setProperty(
      "--mir-svg-width",
      `${value}%`
    );


    /*
     * Mermaid 外层保持完整正文宽度。
     *
     * 避免 Live Preview CodeMirror block
     * 因外层宽度变化发生剧烈 reflow。
     */
    mermaidEl.style.setProperty(
      "width",
      "100%",
      "important"
    );


    mermaidEl.style.setProperty(
      "max-width",
      "100%",
      "important"
    );


    mermaidEl.style.setProperty(
      "box-sizing",
      "border-box",
      "important"
    );

    this.installFullscreenZoomControl(mermaidEl);


    /*
     * 真正改变视觉尺寸的是 SVG。
     */
    const svg =
      mermaidEl.querySelector(
        "svg"
      );


    if (!svg) {

      return;

    }


    svg.style.setProperty(
      "display",
      "block",
      "important"
    );


    svg.style.setProperty(
      "width",
      `${value}%`,
      "important"
    );


    svg.style.setProperty(
      "max-width",
      `${value}%`,
      "important"
    );


    svg.style.setProperty(
      "height",
      "auto",
      "important"
    );


    svg.style.setProperty(
      "margin-left",
      "auto",
      "important"
    );


    svg.style.setProperty(
      "margin-right",
      "auto",
      "important"
    );
  }


  /* ========================================================
   * Four-button controls
   * ======================================================== */

  installControls(
    view,
    mermaidEl,
    block,
    initialWidth
  ) {

    if (
      mermaidEl.querySelector(
        ":scope > .mir-button-group"
      )
    ) {

      return;

    }


    const control =
      document.createElement(
        "div"
      );


    control.className =
      "mir-button-group";


    /* ------------------------------------------------------
     * Minus
     * ------------------------------------------------------ */

    const minus =
      document.createElement(
        "button"
      );


    minus.type =
      "button";


    minus.className =
      "mir-button mir-minus";


    minus.textContent =
      "−";


    minus.title =
      `按当前步长缩小 ${this.currentStep}%`;


    /* ------------------------------------------------------
     * Step
     * ------------------------------------------------------ */

    const stepButton =
      document.createElement(
        "button"
      );


    stepButton.type =
      "button";


    stepButton.className =
      "mir-button mir-step-value";


    stepButton.textContent =
      `${this.currentStep}%`;


    stepButton.title =
      this.getStepButtonTitle();


    /* ------------------------------------------------------
     * Current width
     * ------------------------------------------------------ */

    const widthButton =
      document.createElement(
        "button"
      );


    widthButton.type =
      "button";


    widthButton.className =
      "mir-button mir-width-value";


    widthButton.textContent =
      `${Math.round(initialWidth)}%`;


    widthButton.title =
      "当前 Mermaid 宽度；点击恢复 100%";


    /* ------------------------------------------------------
     * Plus
     * ------------------------------------------------------ */

    const plus =
      document.createElement(
        "button"
      );


    plus.type =
      "button";


    plus.className =
      "mir-button mir-plus";


    plus.textContent =
      "+";


    plus.title =
      `按当前步长放大 ${this.currentStep}%`;


    /* Mouse clicks must not transfer focus away from CodeMirror. On macOS a
     * focused button can make the editor restore its selection at the top. */
    [minus, stepButton, widthButton, plus].forEach((button) => {
      button.tabIndex = -1;
    });


    /* ------------------------------------------------------
     * Mount
     * ------------------------------------------------------ */

    control.appendChild(
      minus
    );


    control.appendChild(
      stepButton
    );


    control.appendChild(
      widthButton
    );


    control.appendChild(
      plus
    );


    mermaidEl.appendChild(
      control
    );


    /* ------------------------------------------------------
     * Stop CodeMirror click handling
     * ------------------------------------------------------ */

    [
      "mousedown",
      "pointerdown",
      "click"
    ].forEach(
      (eventName) => {

        control.addEventListener(
          eventName,

          (event) => {

            event.stopPropagation();
            event.preventDefault();

          }
        );
      }
    );


    /* ------------------------------------------------------
     * Minus
     * ------------------------------------------------------ */

    minus.addEventListener(
      "click",
      (event) => {

        event.preventDefault();
        event.stopPropagation();

        const currentBlock =
          this.findBlockForElement(
            view,
            mermaidEl
          );


        if (!currentBlock) {

          return;

        }


        const scrollPosition =
          this.getEditorScrollSnapshot(
            view,
            control
          );


        const current =
          this.readWidthFromBlock(
            view.editor,
            currentBlock
          );


        const target =
          this.clampWidth(
            current -
            this.currentStep
          );


        this.persistWidthForBlock(
          view,
          currentBlock,
          target
        );


        this.applyWidth(
          mermaidEl,
          target
        );


        widthButton.textContent =
          `${Math.round(target)}%`;


        this.preserveEditorScroll(
          view,
          scrollPosition
        );
      }
    );


    /* ------------------------------------------------------
     * Step
     * ------------------------------------------------------ */

    stepButton.addEventListener(
      "click",
      async (event) => {

        event.preventDefault();
        event.stopPropagation();


        const scrollPosition =
          this.getEditorScrollSnapshot(
            view,
            control
          );


        /*
         * 不修改 Mermaid。
         * 不修改 Markdown。
         */
        await this.cycleStep();


        this.preserveEditorScroll(
          view,
          scrollPosition
        );


        minus.title =
          `按当前步长缩小 ${this.currentStep}%`;


        plus.title =
          `按当前步长放大 ${this.currentStep}%`;
      }
    );


    /* ------------------------------------------------------
     * Reset to 100%
     * ------------------------------------------------------ */

    widthButton.addEventListener(
      "click",
      (event) => {

        event.preventDefault();
        event.stopPropagation();


        const currentBlock =
          this.findBlockForElement(
            view,
            mermaidEl
          );


        if (!currentBlock) {

          return;

        }


        const scrollPosition =
          this.getEditorScrollSnapshot(
            view,
            control
          );


        this.persistWidthForBlock(
          view,
          currentBlock,
          DEFAULT_WIDTH
        );


        this.applyWidth(
          mermaidEl,
          DEFAULT_WIDTH
        );


        widthButton.textContent =
          `${DEFAULT_WIDTH}%`;


        this.preserveEditorScroll(
          view,
          scrollPosition
        );
      }
    );


    /* ------------------------------------------------------
     * Plus
     * ------------------------------------------------------ */

    plus.addEventListener(
      "click",
      (event) => {

        event.preventDefault();
        event.stopPropagation();


        const currentBlock =
          this.findBlockForElement(
            view,
            mermaidEl
          );


        if (!currentBlock) {

          return;

        }


        const scrollPosition =
          this.getEditorScrollSnapshot(
            view,
            control
          );


        const current =
          this.readWidthFromBlock(
            view.editor,
            currentBlock
          );


        const target =
          this.clampWidth(
            current +
            this.currentStep
          );


        this.persistWidthForBlock(
          view,
          currentBlock,
          target
        );


        this.applyWidth(
          mermaidEl,
          target
        );


        widthButton.textContent =
          `${Math.round(target)}%`;


        this.preserveEditorScroll(
          view,
          scrollPosition
        );
      }
    );
  }
};
