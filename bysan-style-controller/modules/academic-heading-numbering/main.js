/**
 * Academic Heading Numbering
 *
 * Version: 0.4.0
 *
 * 编号规则：
 *
 *   #       -> 一、
 *   ##      -> 1.1
 *   ###     -> 1.1.1
 *   ####    -> 1.1.1.1
 *   #####   -> 1.1.1.1.1
 *   ######  -> 1.1.1.1.1.1
 *
 * 设计：
 *
 * 1. 永远根据完整 Markdown 文档计算标题编号。
 * 2. Live Preview 使用真正的 CodeMirror 6 Decoration Widget。
 * 3. 不再直接修改 CodeMirror 生成的标题 DOM。
 * 4. 点击、移动光标、滚动、Live Preview 重绘时编号均可恢复。
 * 5. Reading View、Outline 和 PDF 使用同一份完整标题模型。
 * 6. 不修改 Markdown 原文。
 *
 * 6. 所有显示层均不修改 Markdown、标题 textContent 或 heading anchor。
 */

const {
  Plugin,
  MarkdownView,
  Notice
} = require("obsidian");

const {
  RangeSetBuilder
} = require("@codemirror/state");

const {
  Decoration,
  ViewPlugin,
  WidgetType
} = require("@codemirror/view");


/* =========================================================
 * Shared heading parser
 * ========================================================= */

/**
 * 将字符串规范化，用于 Outline 标题匹配。
 */
function normalizeTitle(title) {
  if (!title) {
    return "";
  }

  let text = String(title);

  /*
   * [[Target|Alias]]
   * ->
   * Alias
   */
  text = text.replace(
    /\[\[([^\]|]+)\|([^\]]+)\]\]/g,
    "$2"
  );

  /*
   * [[Target]]
   */
  text = text.replace(
    /\[\[([^\]]+)\]\]/g,
    "$1"
  );

  /*
   * [Title](URL)
   */
  text = text.replace(
    /\[([^\]]+)\]\([^)]+\)/g,
    "$1"
  );

  /*
   * Obsidian Outline 会去掉行内公式的 $...$ 定界符，但保留其中的
   * LaTeX 源码（例如 $\tau$ -> \tau）。Markdown 模型来自原文，
   * 若不在匹配层统一处理，所有含行内公式的标题都会漏掉编号。
   * 只移除成对的定界符，避免误伤标题中的普通货币符号。
   */
  text = text.replace(
    /\$\$([^$\n]+)\$\$/g,
    "$1"
  );
  text = text.replace(
    /\$([^$\n]+)\$/g,
    "$1"
  );

  /*
   * Markdown emphasis.
   */
  text = text.replace(
    /[*_~`]/g,
    ""
  );

  /*
   * HTML tags.
   */
  text = text.replace(
    /<[^>]+>/g,
    ""
  );

  /*
   * Whitespace normalization.
   */
  text = text.replace(
    /\s+/g,
    " "
  );

  return text.trim();
}


/**
 * 阿拉伯数字 -> 中文小写章节数字。
 *
 * 1   -> 一
 * 9   -> 九
 * 10  -> 十
 * 11  -> 十一
 * 20  -> 二十
 * 21  -> 二十一
 * 100 -> 一百
 */
function toChineseNumber(value) {
  const digits = [
    "零",
    "一",
    "二",
    "三",
    "四",
    "五",
    "六",
    "七",
    "八",
    "九"
  ];

  if (
    !Number.isInteger(value) ||
    value <= 0
  ) {
    return String(value);
  }

  if (value < 10) {
    return digits[value];
  }

  if (value < 20) {
    return (
      "十" +
      (
        value % 10
          ? digits[value % 10]
          : ""
      )
    );
  }

  if (value < 100) {
    const tens =
      Math.floor(value / 10);

    const ones =
      value % 10;

    return (
      digits[tens] +
      "十" +
      (
        ones
          ? digits[ones]
          : ""
      )
    );
  }

  if (value < 1000) {
    const hundreds =
      Math.floor(value / 100);

    const remainder =
      value % 100;

    let result =
      digits[hundreds] + "百";

    if (remainder === 0) {
      return result;
    }

    if (remainder < 10) {
      return (
        result +
        "零" +
        digits[remainder]
      );
    }

    return (
      result +
      toChineseNumber(
        remainder
      )
    );
  }

  return String(value);
}


/**
 * 从完整 Markdown 文本建立标题模型。
 *
 * 返回：
 *
 * {
 *   index,
 *   line,
 *   level,
 *   rawTitle,
 *   normalizedTitle,
 *   numericPath,
 *   displayNumber,
 *   titlePath,
 *   insertCh
 * }
 */
function buildHeadingModel(markdown) {
  const lines =
    markdown.split(/\r?\n/);

  const headings = [];

  const counters =
    [0, 0, 0, 0, 0, 0];

  const headingStack = [];


  /* -------------------------------------------------------
   * Markdown fence state
   * ------------------------------------------------------- */

  let inFence = false;

  let fenceChar = null;

  let fenceLength = 0;


  /* -------------------------------------------------------
   * Frontmatter
   * ------------------------------------------------------- */

  let inFrontmatter = false;

  let frontmatterChecked = false;


  for (
    let lineNumber = 0;
    lineNumber < lines.length;
    lineNumber++
  ) {
    const line =
      lines[lineNumber];


    /* =====================================================
     * YAML frontmatter
     * ===================================================== */

    if (!frontmatterChecked) {
      if (
        lineNumber === 0 &&
        line.trim() === "---"
      ) {
        inFrontmatter = true;
      }

      frontmatterChecked = true;
    }

    if (inFrontmatter) {
      if (
        lineNumber > 0 &&
        line.trim() === "---"
      ) {
        inFrontmatter = false;
      }

      continue;
    }


    /* =====================================================
     * Fenced code block
     * ===================================================== */

    const fenceMatch =
      line.match(
        /^\s*(`{3,}|~{3,})/
      );

    if (fenceMatch) {
      const fence =
        fenceMatch[1];

      const char =
        fence[0];

      const length =
        fence.length;

      if (!inFence) {
        inFence = true;

        fenceChar =
          char;

        fenceLength =
          length;

      } else if (
        char === fenceChar &&
        length >= fenceLength
      ) {
        inFence = false;

        fenceChar = null;

        fenceLength = 0;
      }

      continue;
    }

    if (inFence) {
      continue;
    }


    /* =====================================================
     * ATX heading
     *
     * Capture groups:
     *
     * 1 -> ###...
     * 2 -> spaces
     * 3 -> heading content
     * ===================================================== */

    const match =
      line.match(
        /^(#{1,6})([ \t]+)(.+?)\s*$/
      );

    if (!match) {
      continue;
    }


    const hashes =
      match[1];

    const spaces =
      match[2];

    const level =
      hashes.length;


    let rawTitle =
      match[3];


    /*
     * Support:
     *
     * ## Heading ##
     */
    rawTitle =
      rawTitle.replace(
        /[ \t]+#+[ \t]*$/,
        ""
      );

    rawTitle =
      rawTitle.trim();

    if (!rawTitle) {
      continue;
    }


    /* =====================================================
     * Hierarchical counters
     * ===================================================== */

    counters[
      level - 1
    ] += 1;


    /*
     * Reset all lower levels.
     */
    for (
      let i = level;
      i < counters.length;
      i++
    ) {
      counters[i] = 0;
    }


    const numericPath =
      counters.slice(
        0,
        level
      );


    let displayNumber;

    if (level === 1) {
      displayNumber =
        toChineseNumber(
          counters[0]
        ) + "、";

    } else {
      displayNumber =
        numericPath.join(".");
    }


    /* =====================================================
     * Hierarchical title path
     * ===================================================== */

    while (
      headingStack.length > 0 &&
      headingStack[
        headingStack.length - 1
      ].level >= level
    ) {
      headingStack.pop();
    }


    const normalizedTitle =
      normalizeTitle(
        rawTitle
      );


    const parent =
      headingStack.length > 0
        ? headingStack[
            headingStack.length - 1
          ]
        : null;


    const titlePath =
      parent
        ? [
            ...parent.titlePath,
            normalizedTitle
          ]
        : [
            normalizedTitle
          ];


    /*
     * CodeMirror widget 要插到：
     *
     * ## |Heading
     *
     * 即 Markdown heading marker 和空格之后、
     * 标题正文之前。
     *
     * 例如：
     *
     * ## Heading
     *
     * insertCh = 3
     */
    const insertCh =
      hashes.length +
      spaces.length;


    const entry = {
      index:
        headings.length,

      line:
        lineNumber,

      level:
        level,

      rawTitle:
        rawTitle,

      normalizedTitle:
        normalizedTitle,

      numericPath:
        numericPath,

      displayNumber:
        displayNumber,

      titlePath:
        titlePath,

      insertCh:
        insertCh
    };


    headings.push(
      entry
    );


    headingStack.push(
      entry
    );
  }


  return headings;
}


/* =========================================================
 * Explicit source cleanup command
 * ========================================================= */

/*
 * 只匹配明确具有“编号形态”的标题前缀，避免把：
 *
 *   # 2026 年研究计划
 *
 * 这类以普通数字开头的标题误删。
 *
 * 支持示例：
 *   17. 标题
 *   22.1 标题
 *   (3) 标题 / （三）标题
 *   一、标题
 *   第一章 标题
 */
const MANUAL_HEADING_NUMBER_RE = new RegExp(
  "^(\\s{0,3}#{1,6}[ \\t]+)" +
  "(?:" +
    "\\d+(?:[.．]\\d+)+[、.．:：]?" +
    "|\\d+[、.．:：]" +
    "|[（(]\\d+(?:[.．]\\d+)*[）)]" +
    "|[零〇一二三四五六七八九十百千万两]+[、.．:：]" +
    "|[（(][零〇一二三四五六七八九十百千万两]+[）)]" +
    "|第[零〇一二三四五六七八九十百千万两\\d]+[章节篇部][、.．:：]?" +
  ")" +
  "[ \\t]+"
);


function buildManualHeadingNumberChanges(markdown) {
  const lines = markdown.split(/\r?\n/);
  const headingLines = new Set(
    buildHeadingModel(markdown).map((heading) => heading.line)
  );
  const changes = [];

  for (const lineNumber of headingLines) {
    const line = lines[lineNumber];
    const match = line.match(MANUAL_HEADING_NUMBER_RE);

    if (!match) {
      continue;
    }

    changes.push({
      from: {
        line: lineNumber,
        ch: match[1].length
      },
      to: {
        line: lineNumber,
        ch: match[0].length
      },
      text: ""
    });
  }

  return changes;
}


/* =========================================================
 * CodeMirror Widget
 * ========================================================= */

/**
 * 真正由 CodeMirror 管理的标题编号。
 *
 * 不再依赖修改 .cm-line DOM。
 */
class HeadingNumberWidget extends WidgetType {

  constructor(
    displayNumber,
    level
  ) {
    super();

    this.displayNumber =
      displayNumber;

    this.level =
      level;
  }


  /**
   * CodeMirror 可以通过 eq() 判断两个 Widget
   * 是否等价，从而避免无必要的 DOM 重建。
   */
  eq(other) {
    return (
      other instanceof
        HeadingNumberWidget &&
      other.displayNumber ===
        this.displayNumber &&
      other.level ===
        this.level
    );
  }


  toDOM() {
    const span =
      document.createElement(
        "span"
      );

    span.className =
      "ahn-cm-number";

    span.classList.add(
      `ahn-cm-number-h${this.level}`
    );

    span.textContent =
      this.displayNumber;

    span.setAttribute(
      "aria-hidden",
      "true"
    );

    return span;
  }


  /*
   * Widget 本身不接收编辑事件。
   */
  ignoreEvent() {
    return true;
  }
}


/* =========================================================
 * CodeMirror decoration builder
 * ========================================================= */

function buildEditorDecorations(view) {
  const markdown =
    view.state.doc.toString();


  const headings =
    buildHeadingModel(
      markdown
    );


  const builder =
    new RangeSetBuilder();


  for (
    const heading
    of headings
  ) {
    /*
     * CodeMirror 行号从 1 开始。
     */
    const line =
      view.state.doc.line(
        heading.line + 1
      );


    const position =
      Math.min(
        line.to,
        line.from +
          heading.insertCh
      );


    const decoration =
      Decoration.widget({
        widget:
          new HeadingNumberWidget(
            heading.displayNumber,
            heading.level
          ),

        /*
         * Widget 位于 Markdown marker 后、
         * heading text 前。
         */
        side:
          1
      });


    builder.add(
      position,
      position,
      decoration
    );
  }


  return builder.finish();
}


/* =========================================================
 * CodeMirror ViewPlugin
 * ========================================================= */

/**
 * 这是这一版最关键的部分。
 *
 * 鼠标点击会产生 selectionSet。
 *
 * 所以即使 Obsidian Live Preview 因点击改变了
 * 当前标题行的显示状态，我们也重新提交一份正式
 * CodeMirror Decoration，而不是等待 DOM observer。
 */
const headingEditorExtension =
  ViewPlugin.fromClass(

    class {

      constructor(view) {
        this.decorations =
          buildEditorDecorations(
            view
          );
      }


      update(update) {
        if (
          update.docChanged ||
          update.viewportChanged ||
          update.selectionSet
        ) {
          this.decorations =
            buildEditorDecorations(
              update.view
            );
        }
      }


      destroy() {
        /*
         * Nothing to clean manually.
         * CodeMirror manages Widget DOM lifetime.
         */
      }
    },

    {
      decorations:
        (instance) =>
          instance.decorations
    }
  );


/* =========================================================
 * Obsidian Plugin
 * ========================================================= */

module.exports =
class AcademicHeadingNumbering
extends Plugin {

  async onload() {
    console.log(
      "[Academic Heading Numbering] " +
      "v0.4.1 loaded"
    );


    /* =====================================================
     * 1. Register real CodeMirror extension
     * ===================================================== */

    this.registerEditorExtension(
      headingEditorExtension
    );


    this.addCommand({
      id: "remove-existing-heading-numbers",
      name: "清除当前文档标题中的已有编号（可撤回）",
      editorCallback: (editor, view) => {
        this.removeExistingHeadingNumbers(editor, view);
      }
    });


    this.addRibbonIcon(
      "eraser",
      "清除当前文档标题中的已有编号（可撤回）",
      () => {
        const view = this.app.workspace.getActiveViewOfType(MarkdownView);

        if (!view?.editor) {
          new Notice("请先打开一个 Markdown 文档");
          return;
        }

        this.removeExistingHeadingNumbers(view.editor, view);
      }
    );


    /* =====================================================
     * 2. Outline state
     * ===================================================== */

    this.headingModel = [];

    this.modelFilePath = null;

    this.rebuildTimer = null;

    this.outlineTimer = null;

    this.renderedTimer = null;

    /*
     * 按文件缓存完整模型。Live Preview 仍直接消费编辑器中的最新文本；
     * Reading View / Outline / PDF 消费这里的同一模型对象。
     */
    this.modelCache = new Map();


    /* =====================================================
     * 3. Outline DOM observer
     *
     * 注意：
     *
     * 这里的 observer 只负责 Outline。
     *
     * Live Preview 已经完全交给 CodeMirror 6，
     * 不再由 MutationObserver 修改。
     * ===================================================== */

    this.outlineObserver =
      new MutationObserver(
        (mutations) => {

          let outlineRelevant = false;

          let renderedRelevant = false;


          for (
            const mutation of mutations
          ) {
            for (
              const node
              of mutation.addedNodes
            ) {
              if (
                !(
                  node instanceof
                  HTMLElement
                )
              ) {
                continue;
              }


              if (
                node.matches?.(
                  ".tree-item"
                ) ||
                node.querySelector?.(
                  ".tree-item"
                )
              ) {
                outlineRelevant = true;

              }


              if (
                !node.classList.contains("ahn-reading-number") &&
                (
                  node.matches?.("h1, h2, h3, h4, h5, h6, .markdown-rendered") ||
                  node.querySelector?.("h1, h2, h3, h4, h5, h6")
                )
              ) {
                renderedRelevant = true;

              }
            }


            if (outlineRelevant && renderedRelevant) {
              break;
            }
          }


          if (outlineRelevant) {
            this.scheduleOutline(
              20
            );
          }


          if (renderedRelevant) {
            /* PDF DOM 可能在 beforeprint 后才创建；同步注入最稳妥。 */
            this.decorateAllRenderedCopies();
          }
        }
      );


    this.outlineObserver.observe(
      document.body,
      {
        childList: true,
        subtree: true
      }
    );


    /* =====================================================
     * 4. Workspace events
     * ===================================================== */

    this.registerEvent(
      this.app.workspace.on(
        "file-open",
        () => {
          this.scheduleModelRebuild(
            40
          );
        }
      )
    );


    /*
     * Reading View 的每个渲染 section 都按源文件行号映射到完整模型。
     * 插入独立 span，不改 heading.textContent 的原始标题节点/anchor。
     * PDF 导出的渲染副本也会经过 Markdown post processor。
     */
    this.registerMarkdownPostProcessor(
      async (element, context) => {
        const model = await this.getModelForPath(context.sourcePath);
        this.decorateRenderedSection(element, model, context);
      }
    );


    this.registerDomEvent(
      window,
      "beforeprint",
      () => {
        this.decorateAllRenderedCopies();
      }
    );


    this.registerDomEvent(
      window,
      "afterprint",
      () => {
        this.scheduleRendered(50);
      }
    );


    this.registerEvent(
      this.app.workspace.on(
        "active-leaf-change",
        () => {
          this.scheduleModelRebuild(
            40
          );
        }
      )
    );


    this.registerEvent(
      this.app.workspace.on(
        "editor-change",
        () => {
          this.scheduleModelRebuild(
            100
          );
        }
      )
    );


    this.registerEvent(
      this.app.workspace.on(
        "layout-change",
        () => {
          this.scheduleOutline(
            30
          );
        }
      )
    );


    /*
     * 点击 Outline 后 Obsidian 可能更新树节点。
     * 稍后重新贴一次已经算好的固定编号。
     */
    this.registerDomEvent(
      document,
      "click",
      (event) => {

        const target =
          event.target;

        if (
          target instanceof
            HTMLElement &&
          target.closest(
            ".workspace-leaf-content[data-type='outline']"
          )
        ) {
          this.scheduleOutline(
            30
          );
        }
      },
      true
    );


    /*
     * Outline 滚动 / 虚拟化后的保险处理。
     */
    this.registerDomEvent(
      document,
      "scroll",
      (event) => {

        const target =
          event.target;

        if (
          target instanceof
            HTMLElement &&
          target.closest?.(
            ".workspace-leaf-content[data-type='outline']"
          )
        ) {
          this.scheduleOutline(
            20
          );
        }
      },
      true
    );


    /* =====================================================
     * Initial build
     * ===================================================== */

    this.app.workspace.onLayoutReady(
      () => {
        this.scheduleModelRebuild(
          150
        );
      }
    );
  }


  onunload() {
    if (this.outlineObserver) {
      this.outlineObserver.disconnect();
    }


    if (this.rebuildTimer) {
      window.clearTimeout(
        this.rebuildTimer
      );
    }


    if (this.outlineTimer) {
      window.clearTimeout(
        this.outlineTimer
      );
    }


    if (this.renderedTimer) {
      window.clearTimeout(this.renderedTimer);
    }


    this.clearOutlineDecorations();

    this.clearRenderedDecorations();


    console.log(
      "[Academic Heading Numbering] unloaded"
    );
  }


  /* =======================================================
   * Scheduling
   * ======================================================= */

  scheduleModelRebuild(
    delay = 80
  ) {
    if (this.rebuildTimer) {
      window.clearTimeout(
        this.rebuildTimer
      );
    }


    this.rebuildTimer =
      window.setTimeout(
        () => {

          this.rebuildTimer = null;

          this.rebuildModel();

        },
        delay
      );
  }


  removeExistingHeadingNumbers(editor, view) {
    const changes = buildManualHeadingNumberChanges(editor.getValue());

    if (changes.length === 0) {
      new Notice("当前文档没有检测到可清除的标题编号");
      return;
    }

    const fileName = view?.file?.name || "当前文档";
    const confirmed = window.confirm(
      `将在“${fileName}”中清除 ${changes.length} 个标题已有编号。\n\n` +
      "只修改 Markdown 标题行；完成后可按一次 Ctrl+Z 整体撤回。"
    );

    if (!confirmed) {
      return;
    }

    /*
     * 单个 Editor transaction = 单个撤回历史步骤。
     */
    editor.transaction({ changes });
    new Notice(
      `已清除 ${changes.length} 个标题编号；按 Ctrl+Z 可整体撤回`
    );
    this.scheduleModelRebuild(0);
  }


  scheduleOutline(
    delay = 30
  ) {
    if (this.outlineTimer) {
      window.clearTimeout(
        this.outlineTimer
      );
    }


    this.outlineTimer =
      window.setTimeout(
        () => {

          this.outlineTimer = null;

          this.decorateOutline();

        },
        delay
      );
  }


  scheduleRendered(delay = 30) {
    if (this.renderedTimer) {
      window.clearTimeout(this.renderedTimer);
    }

    this.renderedTimer = window.setTimeout(
      () => {
        this.renderedTimer = null;
        this.decorateAllRenderedCopies();
      },
      delay
    );
  }


  /* =======================================================
   * Build complete active-file model
   * ======================================================= */

  rebuildModel() {
    const view =
      this.app.workspace
        .getActiveViewOfType(
          MarkdownView
        );


    if (
      !view ||
      !view.file ||
      !view.editor
    ) {
      this.headingModel = [];

      this.modelFilePath = null;

      this.clearOutlineDecorations();

      return;
    }


    const markdown = view.editor.getValue();

    this.headingModel = buildHeadingModel(markdown);


    this.modelFilePath =
      view.file.path;

    this.modelCache.set(
      view.file.path,
      {
        markdown,
        model: this.headingModel
      }
    );


    this.decorateOutline();

    this.scheduleRendered(0);
  }


  async getModelForPath(path) {
    if (!path) {
      return [];
    }

    if (path === this.modelFilePath) {
      return this.headingModel;
    }

    const file = this.app.vault.getAbstractFileByPath(path);

    if (!file) {
      return [];
    }

    try {
      const markdown = await this.app.vault.cachedRead(file);
      const cached = this.modelCache.get(path);

      if (cached && cached.markdown === markdown) {
        return cached.model;
      }

      const model = buildHeadingModel(markdown);
      this.modelCache.set(path, { markdown, model });
      return model;

    } catch (error) {
      console.warn(
        "[Academic Heading Numbering] Could not build rendered model:",
        error
      );
      return [];
    }
  }


  /* =======================================================
   * Reading View / rendered copies / PDF
   * ======================================================= */

  createRenderedNumber(heading) {
    const span = document.createElement("span");
    span.className =
      `ahn-reading-number ahn-reading-number-h${heading.level}`;
    span.textContent = heading.displayNumber;
    span.setAttribute("aria-hidden", "true");
    return span;
  }


  getRenderedHeadingTitle(element) {
    const dataHeading = element.getAttribute("data-heading");

    if (dataHeading) {
      return normalizeTitle(dataHeading);
    }

    const copy = element.cloneNode(true);
    copy.querySelectorAll(".ahn-reading-number").forEach(
      (number) => number.remove()
    );
    return normalizeTitle(copy.textContent || "");
  }


  decorateRenderedSection(element, model, context) {
    if (!model || model.length === 0) {
      return;
    }

    const lineMap = new Map(
      model.map((heading) => [heading.line, heading])
    );

    const renderedHeadings = [];

    if (element.matches?.("h1, h2, h3, h4, h5, h6")) {
      renderedHeadings.push(element);
    }

    renderedHeadings.push(
      ...element.querySelectorAll("h1, h2, h3, h4, h5, h6")
    );

    const used = new Set();

    const containerInfo = context?.getSectionInfo?.(element);
    let fallbackCursor = containerInfo && Number.isInteger(containerInfo.lineStart)
      ? model.findIndex((heading) => heading.line >= containerInfo.lineStart)
      : 0;

    if (fallbackCursor < 0) {
      fallbackCursor = 0;
    }

    for (const headingElement of renderedHeadings) {
      if (headingElement.closest(".markdown-source-view")) {
        continue;
      }

      let heading = null;
      const sectionInfo = context?.getSectionInfo?.(headingElement);

      if (sectionInfo && Number.isInteger(sectionInfo.lineStart)) {
        heading = lineMap.get(sectionInfo.lineStart) || null;
      }

      if (!heading) {
        const level = Number(headingElement.tagName.slice(1));
        const title = this.getRenderedHeadingTitle(headingElement);
        for (let index = fallbackCursor; index < model.length; index++) {
          const candidate = model[index];
          if (
            !used.has(candidate.index) &&
            candidate.level === level &&
            candidate.normalizedTitle === title
          ) {
            heading = candidate;
            fallbackCursor = index + 1;
            break;
          }
        }
      }

      if (!heading) {
        continue;
      }

      used.add(heading.index);
      headingElement
        .querySelectorAll(":scope > .ahn-reading-number")
        .forEach((number) => number.remove());
      headingElement.insertBefore(
        this.createRenderedNumber(heading),
        headingElement.firstChild
      );
      headingElement.classList.add("ahn-rendered-heading");
    }
  }


  decorateAllRenderedCopies() {
    if (!this.headingModel || this.headingModel.length === 0) {
      return;
    }

    const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);

    const roots = Array.from(
      document.querySelectorAll(".markdown-rendered")
    ).filter(
      (root) =>
        !root.closest(".markdown-source-view") &&
        !root.parentElement?.closest(".markdown-rendered") &&
        (
          !root.closest(".workspace-leaf-content") ||
          activeView?.containerEl?.contains(root)
        )
    );

    for (const root of roots) {
      const headings = Array.from(
        root.querySelectorAll("h1, h2, h3, h4, h5, h6")
      );
      let modelCursor = 0;

      for (const headingElement of headings) {
        const level = Number(headingElement.tagName.slice(1));
        const title = this.getRenderedHeadingTitle(headingElement);
        let matchIndex = -1;

        for (let index = modelCursor; index < this.headingModel.length; index++) {
          const candidate = this.headingModel[index];
          if (
            candidate.level === level &&
            candidate.normalizedTitle === title
          ) {
            matchIndex = index;
            break;
          }
        }

        if (matchIndex < 0) {
          continue;
        }

        const heading = this.headingModel[matchIndex];
        modelCursor = matchIndex + 1;
        headingElement
          .querySelectorAll(":scope > .ahn-reading-number")
          .forEach((number) => number.remove());
        headingElement.insertBefore(
          this.createRenderedNumber(heading),
          headingElement.firstChild
        );
        headingElement.classList.add("ahn-rendered-heading");
      }
    }
  }


  clearRenderedDecorations() {
    document.querySelectorAll(".ahn-reading-number").forEach(
      (number) => number.remove()
    );
    document.querySelectorAll(".ahn-rendered-heading").forEach(
      (heading) => heading.classList.remove("ahn-rendered-heading")
    );
  }


  /* =======================================================
   * Outline
   * ======================================================= */

  decorateOutline() {
    const activeFile =
      this.app.workspace
        .getActiveFile();


    if (
      !activeFile ||
      activeFile.path !==
        this.modelFilePath
    ) {
      return;
    }


    const outlineViews =
      document.querySelectorAll(
        ".workspace-leaf-content[data-type='outline']"
      );


    if (
      outlineViews.length === 0
    ) {
      return;
    }


    outlineViews.forEach(
      (outlineView) => {

        const pathOccurrences = new Map();

        /*
         * Remove old display attributes.
         */
        outlineView
          .querySelectorAll(
            ".ahn-outline-target"
          )
          .forEach(
            (element) => {

              element.classList.remove(
                "ahn-outline-target"
              );

              element.removeAttribute(
                "data-ahn-number"
              );
            }
          );


        const items =
          Array.from(
            outlineView.querySelectorAll(
              ".tree-item-self"
            )
          );


        for (
          const itemSelf
          of items
        ) {
          const inner =
            itemSelf.querySelector(
              ".tree-item-inner"
            );


          if (!inner) {
            continue;
          }


          const outlinePath =
            this.getOutlineTitlePath(
              itemSelf
            )
            .map(
              (title) =>
                normalizeTitle(
                  title
                )
            );


          if (
            outlinePath.length === 0
          ) {
            continue;
          }


          const heading =
            this.findHeadingByPath(
              outlinePath,
              pathOccurrences
            );


          if (!heading) {
            continue;
          }


          inner.classList.add(
            "ahn-outline-target"
          );


          inner.setAttribute(
            "data-ahn-number",
            heading.displayNumber
          );
        }
      }
    );
  }


  /**
   * 从 Outline item 向上读取完整父级路径。
   */
  getOutlineTitlePath(
    itemSelf
  ) {
    const result = [];


    let treeItem =
      itemSelf.closest(
        ".tree-item"
      );


    while (treeItem) {
      let inner = null;


      try {
        inner =
          treeItem.querySelector(
            ":scope > .tree-item-self .tree-item-inner"
          );

      } catch (_) {
        inner = null;
      }


      if (inner) {
        result.unshift(
          inner.textContent || ""
        );
      }


      const parent =
        treeItem.parentElement;


      if (!parent) {
        break;
      }


      treeItem =
        parent.closest(
          ".tree-item"
        );
    }


    return result;
  }


  /**
   * 优先用完整标题路径匹配。
   *
   * 即使 Outline 只渲染当前可见区域，
   * 编号仍来自完整 Markdown 模型。
   */
  findHeadingByPath(
    outlinePath,
    pathOccurrences = null
  ) {
    const exactCandidates =
      this.headingModel.filter(
        (heading) => {

          if (
            heading.titlePath.length !==
              outlinePath.length
          ) {
            return false;
          }


          for (
            let i = 0;
            i < outlinePath.length;
            i++
          ) {
            if (
              heading.titlePath[i] !==
                outlinePath[i]
            ) {
              return false;
            }
          }


          return true;
        }
      );


    if (exactCandidates.length > 0) {
      if (!pathOccurrences) {
        return exactCandidates[0];
      }

      const key = JSON.stringify(outlinePath);
      const occurrence = pathOccurrences.get(key) || 0;
      pathOccurrences.set(key, occurrence + 1);
      return exactCandidates[
        Math.min(occurrence, exactCandidates.length - 1)
      ];
    }


    /*
     * Fallback：
     * 用最后一级标题匹配。
     */
    const title =
      outlinePath[
        outlinePath.length - 1
      ];


    const candidates =
      this.headingModel.filter(
        (heading) =>
          heading.normalizedTitle ===
            title
      );


    if (
      candidates.length === 1
    ) {
      return candidates[0];
    }


    return null;
  }


  /* =======================================================
   * Cleanup
   * ======================================================= */

  clearOutlineDecorations() {
    document
      .querySelectorAll(
        ".ahn-outline-target"
      )
      .forEach(
        (element) => {

          element.classList.remove(
            "ahn-outline-target"
          );

          element.removeAttribute(
            "data-ahn-number"
          );
        }
      );
  }
};
