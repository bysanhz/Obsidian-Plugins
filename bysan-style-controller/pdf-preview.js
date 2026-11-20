const { MarkdownRenderer, Modal, Notice, Component, addNumericStepper } = globalThis.__bysanPdfApi;

const PAPER_SIZES = {
  A3: [297, 420],
  A4: [210, 297],
  A5: [148, 210],
  Letter: [216, 279],
  Legal: [216, 356],
  Tabloid: [279, 432]
};

const MARGINS = {
  normal: [18, 16],
  small: [10, 10],
  none: [0, 0]
};

const EMBEDDED_FONTS = new Map();
const FONT_URL = /url\((?:"([^"]*)"|'([^']*)'|([^)]*))\)/g;
// Keep one final line of headroom for fractional font metrics and PDF's
// device-independent text positioning. The requested paper margins remain.
const END_OF_PAGE_CLEARANCE = 24;

function embedFont(url) {
  if (!EMBEDDED_FONTS.has(url)) {
    EMBEDDED_FONTS.set(url, fetch(url).then(response => {
      if (!response.ok) throw new Error(`Font response: ${response.status}`);
      return response.blob();
    }).then(blob => new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(blob);
    })).catch(error => {
      EMBEDDED_FONTS.delete(url);
      throw error;
    }));
  }
  return EMBEDDED_FONTS.get(url);
}

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}

function parsePageRange(value, count) {
  const text = String(value ?? "").normalize("NFKC").trim().toLowerCase()
    .replace(/[、，]/g, ",").replace(/[‐‑‒–—−至]/g, "-");
  if (["all", "*", "全部"].includes(text)) {
    return { pages: new Set(Array.from({ length: count }, (_, index) => index + 1)) };
  }
  const pages = new Set();
  for (const raw of text.split(",")) {
    const token = raw.trim();
    const match = /^(\d+)(?:\s*-\s*(\d+))?$/.exec(token);
    if (!match) return { error: "syntax", token };
    const first = Number(match[1]), last = Number(match[2] ?? match[1]);
    if (first < 1 || last > count || first > count || last < first) return { error: "boundary", token };
    for (let page = first; page <= last; page++) pages.add(page);
  }
  return { pages };
}

// Keep syntax-highlighted spans and whitespace when a fenced block continues.
function sliceCode(code, start, end) {
  const doc = code.ownerDocument;
  const walker = doc.createTreeWalker(code, 4); // NodeFilter.SHOW_TEXT
  const range = doc.createRange();
  let index = 0, found = false;
  for (let node; (node = walker.nextNode());) {
    const next = index + node.length;
    if (!found && start < next) {
      range.setStart(node, start - index);
      found = true;
    }
    if (found && end <= next) {
      range.setEnd(node, end - index);
      let part = range.cloneContents();
      let ancestor = range.commonAncestorContainer;
      if (ancestor.nodeType === 3) ancestor = ancestor.parentElement;
      for (; ancestor && ancestor !== code; ancestor = ancestor.parentElement) {
        const outer = ancestor.cloneNode(false);
        outer.append(part);
        part = outer;
      }
      return part;
    }
    index = next;
  }
  return doc.createTextNode(code.textContent.slice(start, end));
}

function splitBlock(node) {
  if (node.nodeType !== 1) return null;
  // MarkdownRenderer output may optionally be wrapped by a postprocessor.
  const types = "pre,table,ol,ul";
  const block = node.matches(types) ? node :
    node.children.length === 1 && node.firstElementChild.matches(types) ? node.firstElementChild : null;
  if (!block) return null;
  const wrap = copy => {
    if (node === block) return copy;
    const outer = node.cloneNode(false);
    outer.append(copy);
    return outer;
  };
  if (block.matches("pre")) {
    const code = block.querySelector(":scope > code"), source = code?.textContent || "";
    const offsets = [0];
    for (let i = 0; i < source.length; i++) if (source[i] === "\n") offsets.push(i + 1);
    if (offsets.at(-1) !== source.length) offsets.push(source.length);
    if (offsets.length <= 2) return null;
    return {
      count: offsets.length - 1,
      slice(from, to) {
        const pre = block.cloneNode(false), child = code.cloneNode(false);
        child.append(sliceCode(code, offsets[from], offsets[to]));
        pre.append(child);
        return wrap(pre);
      }
    };
  }
  if (block.matches("ol,ul")) {
    const items = [...block.children];
    if (items.length <= 1 || items.some(item => item.tagName !== "LI")) return null;
    const ordered = block.tagName === "OL";
    const step = block.reversed ? -1 : 1;
    let sequence = block.hasAttribute("start") ? block.start : block.reversed ? items.length : 1;
    const ordinals = items.map(item => {
      if (item.hasAttribute("value")) sequence = item.value;
      const ordinal = sequence;
      sequence += step;
      return ordinal;
    });
    return {
      count: items.length,
      slice(from, to) {
        const list = block.cloneNode(false);
        if (ordered) list.start = ordinals[from];
        for (let i = from; i < to; i++) list.append(items[i].cloneNode(true));
        return wrap(list);
      }
    };
  }
  // Row spans crossing a page boundary cannot be repeated losslessly.
  if (block.tBodies.length !== 1 || block.tFoot ||
      [...block.querySelectorAll("[rowspan]")].some(cell => cell.rowSpan !== 1)) return null;
  const body = block.tBodies[0], rows = [...body.rows];
  if (rows.length <= 1) return null;
  return {
    count: rows.length,
    slice(from, to) {
      const table = block.cloneNode(false);
      for (const child of block.children) {
        if (child !== body) table.append(child.cloneNode(true));
        else {
          const section = body.cloneNode(false);
          for (let i = from; i < to; i++) section.append(rows[i].cloneNode(true));
          table.append(section);
        }
      }
      return wrap(table);
    }
  };
}

class BysanPdfPreviewModal extends Modal {
  constructor(app, plugin, view) {
    super(app);
    this.plugin = plugin;
    this.view = view;
    this.sourceFile = view.file;
    this.previewTimer = null;
    this.paperSize = plugin.settings.pdfPaperSize || "A4";
    this.orientation = plugin.settings.pdfOrientation || "portrait";
    this.marginMode = plugin.settings.pdfMarginMode || "normal";
    const [defaultMarginY, defaultMarginX] = MARGINS[this.marginMode] || MARGINS.normal;
    this.margins = {
      top: clamp(plugin.settings.pdfMarginTop ?? defaultMarginY, 0, 60),
      right: clamp(plugin.settings.pdfMarginRight ?? defaultMarginX, 0, 60),
      bottom: clamp(plugin.settings.pdfMarginBottom ?? defaultMarginY, 0, 60),
      left: clamp(plugin.settings.pdfMarginLeft ?? defaultMarginX, 0, 60)
    };
    this.previewZoom = Number(plugin.settings.pdfPreviewZoom || 75);
    this.actualScale = Number(plugin.settings.pdfActualScale || 100);
    this.headerText = String(plugin.settings.pdfHeaderText || "");
    this.footerText = String(plugin.settings.pdfFooterText || "");
    this.showPageNumbers = plugin.settings.pdfShowPageNumbers !== false;
    this.pageRange = String(plugin.settings.pdfPageRange || "all");
    this.rangeMode = this.pageRange === "all" ? "all" : "custom";
    this.grayscale = Boolean(plugin.settings.pdfGrayscale);
    this.currentPage = 1;
    this.pageCount = 1;
    this.renderTimer = null;
    this.renderGeneration = 0;
    this.renderComponent = null;
    this.revision = 0;
    this.readyRevision = -1;
    this.rendering = false;
    this.working = false;
    this.blockedPages = [];
  }

  onOpen() {
    this.modalEl.addClass("bysan-pdf-preview-modal");
    this.contentEl.empty();

    const header = this.contentEl.createDiv({ cls: "bysan-pdf-preview-header" });
    const titleGroup = header.createDiv({ cls: "bysan-pdf-preview-title-group" });
    titleGroup.createEl("h2", {
      text: this.plugin.t("pdf.title", {
        name: this.view.file?.basename || this.plugin.t("pdf.currentNote")
      })
    });
    titleGroup.createDiv({
      cls: "bysan-pdf-preview-hint",
      text: this.plugin.t("pdf.sameOutputHint")
    });
    this.pageCountEl = titleGroup.createDiv({
      cls: "bysan-pdf-preview-page-count",
      text: this.plugin.t("pdf.paginating")
    });

    const workspace = this.contentEl.createDiv({ cls: "bysan-pdf-preview-workspace" });
    const previewPane = workspace.createDiv({ cls: "bysan-pdf-preview-pane" });
    this.previewScrollEl = previewPane.createDiv({ cls: "bysan-pdf-preview-scroll" });
    this.previewCanvasEl = this.previewScrollEl.createDiv({ cls: "bysan-pdf-preview-canvas" });
    this.previewPagesEl = this.previewCanvasEl.createDiv({
      cls: "bysan-pdf-preview-pages"
    });
    this.buildNavigation(previewPane);
    this.buildSidebar(workspace);

    this.previewStagingEl = this.contentEl.createDiv({
      cls: "bysan-pdf-preview-staging"
    });
    this.previewStagingContentEl = this.previewStagingEl.createDiv({
      cls: "bysan-pdf-preview-page-content markdown-rendered"
    });
    /* Mermaid and MathJax may keep mutating their detached render tree after
     * the Markdown render resolves. Watching every mutation repeatedly
     * restarts full-document pagination; deliberate refresh triggers below
     * (initial render, image load, source edit and layout changes) are enough. */
    /* The source editor remains live while the modal is open. Rebuild from the
     * latest Markdown after a short debounce so Mermaid width directives are
     * never applied to one pagination pass and missed by the next one. */
    this.sourceEvent = this.app.workspace.on("editor-change", (_editor, view) => {
      if (view?.file === this.sourceFile) this.schedulePreviewRender(220);
    });
    this.resizeObserver = new ResizeObserver(() => {
      if (this.fitMode && !this.working) this.applyPreviewZoom();
    });
    this.resizeObserver.observe(this.previewScrollEl);

    this.resetRenderComponent();
    this.applyLayoutSettings(false);
    void this.renderPreview();
  }

  buildNavigation(previewPane) {
    const navigation = previewPane.createDiv({ cls: "bysan-pdf-preview-navigation" });
    this.previousPageButton = navigation.createEl("button", {
      text: "←",
      attr: { type: "button", title: this.plugin.t("pdf.previous") }
    });
    const pageJump = navigation.createDiv({ cls: "bysan-pdf-preview-page-jump" });
    pageJump.createSpan({ text: this.plugin.t("pdf.pagePrefix") });
    this.pageInput = pageJump.createEl("input", {
      attr: { type: "number", min: "1", value: "1", "aria-label": this.plugin.t("pdf.jump") }
    });
    this.pageTotalEl = pageJump.createSpan({ text: "/ 1" });
    this.nextPageButton = navigation.createEl("button", {
      text: "→",
      attr: { type: "button", title: this.plugin.t("pdf.next") }
    });
    this.previousPageButton.addEventListener("click", () => this.showPage(this.currentPage - 1, true));
    this.nextPageButton.addEventListener("click", () => this.showPage(this.currentPage + 1, true));
    this.pageInput.addEventListener("change", () => this.showPage(Number(this.pageInput.value), true));
    const fit = (mode, label) => {
      const button = navigation.createEl("button", { text: label, attr: { type: "button", "aria-pressed": "false" } });
      button.addEventListener("click", () => {
        this.fitMode = this.fitMode === mode ? null : mode;
        this.applyPreviewZoom();
      });
      return [mode, button];
    };
    this.fitButtons = [fit("width", this.plugin.t("pdf.fitWidth")), fit("page", this.plugin.t("pdf.fitPage"))];
  }

  buildSidebar(workspace) {
    const panel = workspace.createDiv({ cls: "bysan-pdf-preview-controls" });
    const sidebar = panel.createDiv({ cls: "bysan-pdf-preview-sidebar" });
    sidebar.createEl("h3", { text: this.plugin.t("pdf.operations") });
    const makeField = (label) => {
      const field = sidebar.createDiv({ cls: "bysan-pdf-preview-field" });
      const title = field.createEl("label", { text: label });
      // Child controls are created synchronously; compound steppers already
      // expose their own labels.
      queueMicrotask(() => {
        const single = [...field.children].find(e => e.matches("input,select"));
        if (single && !single.hasAttribute("aria-label")) single.setAttribute("aria-label", title.textContent);
      });
      return field;
    };

    const paperSelect = makeField(this.plugin.t("pdf.paper")).createEl("select");
    Object.keys(PAPER_SIZES).forEach((name) => {
      const option = paperSelect.createEl("option", { text: name });
      option.value = name;
      option.selected = name === this.paperSize;
    });

    const orientationSelect = makeField(this.plugin.t("pdf.orientation")).createEl("select");
    [["portrait", this.plugin.t("pdf.portrait")], ["landscape", this.plugin.t("pdf.landscape")]]
      .forEach(([value, text]) => {
        const option = orientationSelect.createEl("option", { text });
        option.value = value;
        option.selected = value === this.orientation;
      });

    const marginSelect = makeField(this.plugin.t("pdf.margin")).createEl("select");
    [["normal", this.plugin.t("pdf.marginNormal")], ["small", this.plugin.t("pdf.marginSmall")], ["none", this.plugin.t("pdf.marginNone")]]
      .forEach(([value, text]) => {
        const option = marginSelect.createEl("option", { text });
        option.value = value;
        option.selected = value === this.marginMode;
      });
    const customMarginOption = marginSelect.createEl("option", { text: this.plugin.t("pdf.customMargins") });
    customMarginOption.value = "custom";
    customMarginOption.selected = this.marginMode === "custom";

    const customMargins = makeField(this.plugin.t("pdf.customMargins"));
    const marginGrid = customMargins.createDiv({ cls: "bysan-pdf-preview-margin-grid" });
    const marginRefreshers = [];
    const setMargin = (side, value) => {
      this.margins[side] = value;
      this.marginMode = "custom";
      marginSelect.value = "custom";
      void this.saveMargins();
      this.applyLayoutSettings();
    };
    [["top", "pdf.marginTop"], ["right", "pdf.marginRight"], ["bottom", "pdf.marginBottom"], ["left", "pdf.marginLeft"]]
      .forEach(([side, key]) => {
        const cell = marginGrid.createDiv({ cls: "bysan-pdf-preview-margin-cell" });
        const label = this.plugin.t(key);
        cell.createEl("label", { text: label });
        marginRefreshers.push(addNumericStepper(cell, {
          label, language: this.plugin.language, unit: "mm", min: 0, max: 60, step: 0.5,
          value: this.margins[side], read: () => this.margins[side],
          save: value => setMargin(side, value),
          reset: () => {
            const value = MARGINS.normal[/^(top|bottom)$/.test(side) ? 0 : 1];
            setMargin(side, value);
            return value;
          }
        }));
      });

    const headerInput = makeField(this.plugin.t("pdf.header")).createEl("input", {
      attr: { type: "text", placeholder: this.plugin.t("pdf.headerPlaceholder"), value: this.headerText }
    });
    const footerInput = makeField(this.plugin.t("pdf.footer")).createEl("input", {
      attr: { type: "text", placeholder: this.plugin.t("pdf.footerPlaceholder"), value: this.footerText }
    });
    const pageNumberField = makeField(this.plugin.t("pdf.pageNumbers"));
    const pageNumberInput = pageNumberField.createEl("input", {
      attr: { type: "checkbox", "aria-label": this.plugin.t("pdf.pageNumbers") }
    });
    pageNumberInput.checked = this.showPageNumbers;

    const rangeField = makeField(this.plugin.t("pdf.pageRange"));
    const rangeMode = rangeField.createEl("select", { attr: { "aria-label": this.plugin.t("pdf.pageRange") } });
    for (const [key, label] of [["all", "pdf.allPages"], ["current", "pdf.currentPage"], ["custom", "pdf.customRange"]]) {
      rangeMode.createEl("option", { text: this.plugin.t(label), value: key });
    }
    rangeMode.value = this.rangeMode;
    const rangeInput = this.rangeInput = rangeField.createEl("input", {
      attr: { type: "text", placeholder: "2-3,5", value: this.rangeMode === "custom" ? this.pageRange : "",
        "aria-label": this.plugin.t("pdf.customRange") }
    });
    rangeInput.hidden = this.rangeMode !== "custom";
    rangeField.createDiv({ cls: "bysan-pdf-preview-field-hint", text: this.plugin.t("pdf.pageRangeHint") });

    const grayscaleField = makeField(this.plugin.t("pdf.grayscale"));
    const grayscaleInput = grayscaleField.createEl("input", {
      attr: { type: "checkbox", "aria-label": this.plugin.t("pdf.grayscale") }
    });
    grayscaleInput.checked = this.grayscale;
    grayscaleField.createDiv({ cls: "bysan-pdf-preview-field-hint", text: this.plugin.t("pdf.grayscaleHint") });

    const addScale = (key, value, defaultValue, save) => {
      const label = this.plugin.t(key);
      const field = makeField(label);
      addNumericStepper(field, {
        label, language: this.plugin.language, value, unit: "%", min: 40, max: 160, step: 5, slider: true, save,
        reset: () => { save(defaultValue); return defaultValue; }
      });
      return field;
    };
    addScale("pdf.previewZoom", this.previewZoom, 75, value => {
      this.previewZoom = value;
      this.fitMode = null;
      this.applyPreviewZoom();
      void this.savePreference("pdfPreviewZoom", value);
    });
    const actualField = addScale("pdf.actualScale", this.actualScale, 100, value => {
      this.actualScale = value;
      void this.savePreference("pdfActualScale", value);
      this.applyLayoutSettings();
    });
    actualField.createDiv({
      cls: "bysan-pdf-preview-field-hint",
      text: this.plugin.t("pdf.actualScaleHint")
    });

    const footer = panel.createDiv({ cls: "bysan-pdf-preview-output" });
    this.outputStatus = footer.createDiv({ cls: "bysan-pdf-preview-output-status", attr: { role: "status" } });
    const actions = footer.createDiv({ cls: "bysan-pdf-preview-actions" });
    const refresh = actions.createEl("button", {
      text: this.plugin.t("pdf.refresh"), attr: { type: "button" }
    });
    this.exportButton = actions.createEl("button", {
      cls: "mod-cta", text: this.plugin.t("pdf.export"), attr: { type: "button" }
    });

    paperSelect.addEventListener("change", () => {
      this.paperSize = paperSelect.value;
      void this.savePreference("pdfPaperSize", this.paperSize);
      this.applyLayoutSettings();
    });
    orientationSelect.addEventListener("change", () => {
      this.orientation = orientationSelect.value;
      void this.savePreference("pdfOrientation", this.orientation);
      this.applyLayoutSettings();
    });
    marginSelect.addEventListener("change", () => {
      this.marginMode = marginSelect.value;
      const [vertical, horizontal] = MARGINS[this.marginMode] || MARGINS.normal;
      this.margins = { top: vertical, right: horizontal, bottom: vertical, left: horizontal };
      marginRefreshers.forEach(refresh => refresh());
      void this.saveMargins();
      this.applyLayoutSettings();
    });
    headerInput.addEventListener("change", () => {
      this.headerText = headerInput.value;
      void this.savePreference("pdfHeaderText", this.headerText);
      this.applyLayoutSettings();
    });
    footerInput.addEventListener("change", () => {
      this.footerText = footerInput.value;
      void this.savePreference("pdfFooterText", this.footerText);
      this.applyLayoutSettings();
    });
    pageNumberInput.addEventListener("change", () => {
      this.showPageNumbers = pageNumberInput.checked;
      void this.savePreference("pdfShowPageNumbers", this.showPageNumbers);
      this.applyLayoutSettings();
    });
    rangeMode.addEventListener("change", () => {
      this.rangeMode = rangeMode.value;
      rangeInput.hidden = this.rangeMode !== "custom";
      if (!rangeInput.hidden) rangeInput.focus();
      if (this.rangeMode === "all") void this.savePreference("pdfPageRange", "all");
      this.updateOutputRangeLabels();
    });
    rangeInput.addEventListener("input", () => {
      this.pageRange = rangeInput.value;
      this.updateOutputRangeLabels();
    });
    rangeInput.addEventListener("change", () => {
      const parsed = parsePageRange(this.pageRange, this.pageCount);
      if (!parsed.error) void this.savePreference("pdfPageRange", this.pageRange);
    });
    grayscaleInput.addEventListener("change", () => {
      this.grayscale = grayscaleInput.checked;
      void this.savePreference("pdfGrayscale", this.grayscale);
      this.previewPagesEl.classList.toggle("is-grayscale", this.grayscale);
    });
    refresh.addEventListener("click", () => this.schedulePreviewRender(0));
    this.exportButton.addEventListener("click", () => void this.exportPdf());
  }

  async savePreference(key, value) {
    this.plugin.settings[key] = value;
    await this.plugin.saveData(this.plugin.settings);
  }

  async saveMargins() {
    this.plugin.settings.pdfMarginMode = this.marginMode;
    for (const [side, value] of Object.entries(this.margins)) {
      this.plugin.settings[`pdfMargin${side[0].toUpperCase()}${side.slice(1)}`] = value;
    }
    await this.plugin.saveData(this.plugin.settings);
  }

  dimensions() {
    let [width, height] = PAPER_SIZES[this.paperSize] || PAPER_SIZES.A4;
    if (this.orientation === "landscape") [width, height] = [height, width];
    const { top, right, bottom, left } = this.margins;
    return { width, height, marginTop: top, marginRight: right, marginBottom: bottom, marginLeft: left };
  }

  applyPreviewZoom() {
    let zoom = this.previewZoom / 100;
    const { width, height } = this.dimensions();
    const pxPerMm = 96 / 25.4;
    if (this.fitMode) {
      const room = this.previewScrollEl;
      const fitX = (room.clientWidth - 48) / (width * pxPerMm);
      const fitY = (room.clientHeight - 48) / (height * pxPerMm);
      zoom = clamp(this.fitMode === "page" ? Math.min(fitX, fitY) : fitX, 0.1, 2);
    }
    // CSS zoom changes text metrics and line breaking. A view-only transform
    // leaves page layout identical to the 100% measurement and print tree.
    this.previewCanvasEl.style.width = `${width * pxPerMm * zoom}px`;
    this.previewCanvasEl.style.height = `${height * pxPerMm * zoom}px`;
    this.previewPagesEl.style.transform = `scale(${zoom})`;
    for (const [mode, button] of this.fitButtons ?? []) button.setAttribute("aria-pressed", String(this.fitMode === mode));
  }

  applyLayoutSettings(repaginate = true) {
    const { width, height, marginTop, marginRight, marginBottom, marginLeft } = this.dimensions();
    [this.previewPagesEl, this.previewStagingEl].forEach((element) => {
      element.style.setProperty("--bysan-pdf-page-width", `${width}mm`);
      element.style.setProperty("--bysan-pdf-page-height", `${height}mm`);
      element.style.setProperty("--bysan-pdf-margin-top", `${marginTop}mm`);
      element.style.setProperty("--bysan-pdf-margin-right", `${marginRight}mm`);
      element.style.setProperty("--bysan-pdf-margin-bottom", `${marginBottom}mm`);
      element.style.setProperty("--bysan-pdf-margin-left", `${marginLeft}mm`);
    });
    this.applyPreviewZoom();
    this.previewPagesEl.classList.toggle("is-grayscale", this.grayscale);
    this.applyActualScale(this.previewStagingContentEl);
    if (repaginate) this.schedulePagination(60);
  }

  async renderPreview() {
    const generation = ++this.renderGeneration;
    this.markPending();
    this.rendering = true;
    // A stale asynchronous renderer must never append into the new staging tree.
    const staging = this.previewStagingContentEl.cloneNode(false);
    this.previewStagingContentEl.replaceWith(staging);
    this.previewStagingContentEl = staging;
    const live = () => generation === this.renderGeneration && staging.isConnected;
    try {
      const markdown = this.view.file === this.sourceFile ? this.view.editor?.getValue() : null;
      if (typeof markdown !== "string") throw new Error(this.plugin.t("pdf.readError"));
      this.resetRenderComponent();
      await this.awaitLayout(MarkdownRenderer.render(this.app, markdown, staging, this.sourceFile.path, this.renderComponent));
      if (!live()) return;
      await this.settleMediaWidths(markdown, staging);
      if (!live()) return;
      await this.awaitLayout(Promise.all([
        staging.ownerDocument.fonts?.ready,
        this.preparePreviewImages(staging)
      ]));
      if (!live()) return;
      this.renderedMarkdown = markdown;
      this.rendering = false;
      this.schedulePagination(0);
    } catch (error) {
      if (!live()) return;
      this.rendering = false;
      this.layoutError = this.plugin.t("pdf.layoutFailed");
      console.warn("[Bysan PDF] Cannot prepare preview", error);
      this.updateOutputRangeLabels();
    }
  }

  async preparePreviewImages(staging) {
    const images = [...staging.querySelectorAll("img")];
    await Promise.all(images.map(async image => {
      image.loading = "eager";
      let timer;
      try {
        await Promise.race([image.decode(), new Promise((_, reject) => {
          timer = window.setTimeout(() => reject(new Error("Image load timeout")), 4800);
        })]);
      } catch (_) {
        // Missing legacy links shouldn't prevent every page from exporting.
        // Make the missing asset explicit in *both* preview and the PDF.
        const placeholder = staging.ownerDocument.createElement("span");
        placeholder.className = "bysan-pdf-missing-image";
        placeholder.textContent = this.plugin.t("pdf.missingImage", { name: image.alt || "?" });
        image.replaceWith(placeholder);
      } finally {
        window.clearTimeout(timer);
      }
    }));
  }

  async awaitLayout(work) {
    let timer;
    try {
      return await Promise.race([work, new Promise((_, reject) => {
        timer = window.setTimeout(() => reject(new Error("PDF rendering timed out")), 12000);
      })]);
    } finally {
      window.clearTimeout(timer);
    }
  }

  resetRenderComponent() {
    this.renderComponent?.unload?.();
    this.renderComponent = new Component();
    this.renderComponent.load();
  }

  applyMediaWidths(markdown, root = this.previewStagingContentEl) {
    /* Media Resizer is normally an integrated Style Controller module, not a
     * separately enabled Obsidian plugin. Falling back keeps older vaults
     * compatible, but the integrated instance must win to avoid two writers
     * alternately setting an SVG back to its original width. */
    const resizer = this.plugin.integratedModules?.get("mermaid-inline-resizer")
      || this.app.plugins.plugins["mermaid-inline-resizer"];
    resizer?.applyWidthsToRenderedRoot?.(root, markdown);
  }

  async hydrateInternalImageEmbeds(root) {
    const sourcePath = this.view.file?.path || "";
    const supported = /\.(?:apng|avif|bmp|gif|jpe?g|png|svg|webp)$/i;
    for (const embed of root.querySelectorAll("span.internal-embed[src]")) {
      const link = embed.getAttribute("src") || "";
      const file = this.app.metadataCache.getFirstLinkpathDest(link, sourcePath);
      if (!file?.extension || !supported.test(`.${file.extension}`)) continue;
      const resourcePath = this.app.vault.getResourcePath(file);
      if (!resourcePath) continue;
      const existingImage = embed.querySelector("img");
      if (embed.dataset.bysanPdfResourcePath === resourcePath
        && existingImage?.getAttribute("src") === resourcePath) continue;
      const requestedWidth = Number(embed.getAttribute("width"));
      embed.empty();
      embed.addClass("image-embed", "is-loaded");
      embed.dataset.bysanPdfResourcePath = resourcePath;
      const image = embed.createEl("img", {
        attr: {
          src: resourcePath,
          alt: embed.getAttribute("alt") || file.basename
        }
      });
      image.dataset.bysanPdfVaultPath = file.path;
      if (Number.isFinite(requestedWidth) && requestedWidth > 0) {
        image.style.width = `${requestedWidth}px`;
        image.style.maxWidth = "100%";
      }
    }
  }

  schedulePreviewRender(delay = 180) {
    window.clearTimeout(this.renderTimer);
    window.clearTimeout(this.previewTimer);
    ++this.renderGeneration;
    this.rendering = true;
    this.markPending();
    this.renderTimer = window.setTimeout(() => {
      this.renderTimer = null;
      void this.renderPreview();
    }, delay);
  }

  async settleMediaWidths(markdown, root) {
    /* Mermaid SVG nodes are appended asynchronously by Obsidian's renderer.
     * Apply directives over two animation frames so a just-created SVG cannot
     * be copied at its default 100% width into a PDF page. */
    for (let frame = 0; frame < 2; frame += 1) {
      await new Promise((resolve) => requestAnimationFrame(resolve));
      /* Obsidian inserts internal-embed placeholders after the Markdown
       * renderer resolves. Hydrate on every settling frame so they cannot
       * remain an empty span in the detached PDF tree. */
      await this.hydrateInternalImageEmbeds(root);
      this.applyMediaWidths(markdown, root);
    }
  }

  schedulePagination(delay = 100) {
    window.clearTimeout(this.previewTimer);
    this.markPending();
    if (this.rendering || this.layoutError) return;
    const revision = this.revision;
    this.previewTimer = window.setTimeout(async () => {
      this.previewTimer = null;
      if (revision !== this.revision) return;
      try {
        await this.paginatePreview(revision);
      } catch (error) {
        if (revision !== this.revision || !this.previewStagingEl?.isConnected) return;
        this.layoutError = this.plugin.t("pdf.layoutFailed");
        console.warn("[Bysan PDF] Pagination failed", error);
        this.updateOutputRangeLabels();
      }
    }, delay);
  }

  markPending() {
    ++this.revision;
    if (this.rendering) this.layoutError = null;
    this.pageCountEl.setText(this.plugin.t("pdf.paginating"));
    this.updateOutputRangeLabels();
  }

  createPreviewPage(pageNumber, parent) {
    const page = parent.createDiv({ cls: "bysan-pdf-preview-page" });
    page.dataset.pageNumber = String(pageNumber);
    this.renderPageChrome(page, pageNumber);
    const content = page.createDiv({ cls: "bysan-pdf-preview-page-content markdown-rendered" });
    this.applyActualScale(content);
    return { page, content };
  }

  applyActualScale(content) {
    if (!content) return;
    const scale = clamp(this.actualScale, 40, 160) / 100;
    /* Chromium's CSS zoom changes the layout viewport, which lets percentage
     * sized Mermaid SVGs and tables cancel out a reduced scale completely.
     * Transform keeps the rendered result genuinely smaller/larger, including
     * images. At values above 100%, inversing the layout box first keeps the
     * enlarged result within the paper width. */
    content.style.zoom = "1";
    content.style.transform = scale === 1 ? "" : `scale(${scale})`;
    content.style.transformOrigin = "top left";
    const layoutSize = scale > 1 ? `${100 / scale}%` : "100%";
    content.style.width = layoutSize;
    content.style.height = layoutSize;
    content.classList.toggle("is-reduced-output-scale", scale < 1);
  }

  isContentOverflow(content) {
    const scale = clamp(this.actualScale, 40, 160) / 100;
    /* A reduced transform does not affect scrollHeight. Compare the painted
     * height instead so smaller output can use the additional page space. */
    const paintedHeight = scale < 1 ? content.scrollHeight * scale : content.scrollHeight;
    const paintedWidth = scale < 1 ? content.scrollWidth * scale : content.scrollWidth;
    return paintedHeight > content.clientHeight + 1 || paintedWidth > content.clientWidth + 1;
  }

  fitDisplayMath(node) {
    let fitted = false;
    for (const math of node.querySelectorAll?.(".math-block mjx-math") ?? []) {
      const available = math.closest(".math-block").clientWidth - 4;
      const width = Math.max(math.clientWidth, math.scrollWidth);
      if (available > 0 && width > available) {
        math.style.zoom = String(available / width);
        math.dataset.bysanPdfAutoFit = "";
        fitted = true;
      }
    }
    return fitted;
  }

  fitStandaloneMedia(content, node) {
    if (node.nodeType !== 1) return;
    const graph = node.matches(".mermaid") && node.querySelector(":scope > svg");
    const media = graph || (node.matches("img") ? node :
      node.querySelectorAll("img").length === 1 && !node.textContent.trim() ? node.querySelector("img") : null);
    if (!media) return;
    const scale = clamp(this.actualScale, 40, 160) / 100;
    const paintedFactor = content.getBoundingClientRect().height / content.clientHeight;
    const rect = media.getBoundingClientRect();
    const mediaHeight = rect.height / paintedFactor, mediaWidth = rect.width / paintedFactor;
    if (!(mediaHeight > 0 && mediaWidth > 0)) return;
    // Account for wrappers, borders and margins, then preserve aspect ratio.
    const targetHeight = content.clientHeight / Math.min(1, scale) - 4;
    const targetWidth = content.clientWidth / Math.min(1, scale) - 4;
    const extraHeight = Math.max(0, content.scrollHeight - mediaHeight);
    const extraWidth = Math.max(0, node.getBoundingClientRect().width / paintedFactor - Math.max(content.clientWidth, mediaWidth));
    const fit = Math.min(1, (targetHeight - extraHeight) / mediaHeight, (targetWidth - extraWidth) / mediaWidth);
    if (!(fit > 0 && fit < 1)) return;
    const width = `${Math.floor(mediaWidth * fit)}px`;
    media.style.setProperty("width", width, "important");
    media.style.setProperty("max-width", width, "important");
    media.style.setProperty("height", `${Math.floor(mediaHeight * fit)}px`, "important");
    media.dataset.bysanPdfAutoFit = "";
  }

  renderPageChrome(page, pageNumber) {
    const renderText = (text) => String(text || "").replace(/\{page\}/gi, String(pageNumber));
    const hasHeader = Boolean(this.headerText.trim());
    const hasFooter = Boolean(this.footerText.trim()) || this.showPageNumbers;
    page.classList.toggle("has-header", hasHeader);
    page.classList.toggle("has-footer", hasFooter);
    if (hasHeader) page.createDiv({ cls: "bysan-pdf-preview-page-header", text: renderText(this.headerText) });
    if (hasFooter) {
      const footer = page.createDiv({ cls: "bysan-pdf-preview-page-footer" });
      if (this.footerText.trim()) footer.createSpan({ text: renderText(this.footerText) });
      if (this.showPageNumbers) footer.createSpan({ cls: "bysan-pdf-preview-page-number", text: String(pageNumber) });
    }
  }

  async paginatePreview(revision) {
    if (!this.previewStagingContentEl?.isConnected) return;
    if (!this.sourceIsCurrent()) {
      this.layoutError = this.plugin.t("pdf.sourceChanged");
      this.updateOutputRangeLabels();
      return;
    }
    // Measure one page at a time. Completed pages stay detached until the
    // newest layout is ready, so paging/scrolling can continue on the old one.
    const measuring = this.previewPagesEl.cloneNode(false);
    measuring.classList.add("bysan-pdf-preview-measure");
    measuring.setAttribute("aria-hidden", "true");
    measuring.style.removeProperty("transform");
    measuring.style.setProperty("--bysan-pdf-measure-tail",
      `${END_OF_PAGE_CLEARANCE / Math.min(1, clamp(this.actualScale, 40, 160) / 100)}px`);
    this.contentEl.append(measuring);
    const finished = new DocumentFragment(), blockedPages = [];
    const staging = this.previewStagingContentEl;
    const live = () => revision === this.revision && measuring.isConnected && staging.isConnected;
    let pageNumber = 1, hasContent = false;
    let { page, content } = this.createPreviewPage(pageNumber, measuring);
    const finishPage = () => {
      const missing = page.querySelectorAll(".bysan-pdf-missing-image").length;
      if (missing) page.dataset.missingImages = String(missing);
      const fitted = page.querySelectorAll("[data-bysan-pdf-auto-fit]").length;
      if (fitted) page.dataset.fittedBlocks = String(fitted);
      finished.append(page);
    };
    const nextPage = () => {
      finishPage();
      ({ page, content } = this.createPreviewPage(++pageNumber, measuring));
      hasContent = false;
    };
    let sliceStart = performance.now();
    try {
      for (const sourceNode of staging.childNodes) {
        if (performance.now() - sliceStart > 22) {
          await new Promise(resolve => window.setTimeout(resolve, 0));
          if (!live()) return;
          sliceStart = performance.now();
        }
        if (sourceNode.nodeType === 8 || (sourceNode.nodeType === 3 && !sourceNode.textContent.trim())) continue;
        if (blockedPages.at(-1) === pageNumber) nextPage();
        const clone = sourceNode.cloneNode(true);
        content.appendChild(clone);
        this.fitDisplayMath(clone);
        if (!this.isContentOverflow(content)) {
          hasContent = true;
          continue;
        }
        clone.remove();
        const parts = splitBlock(sourceNode);
        if (!parts) {
          if (hasContent) nextPage();
          content.append(clone);
          if (this.isContentOverflow(content)) this.fitStandaloneMedia(content, clone);
          hasContent = true;
          if (this.isContentOverflow(content)) blockedPages.push(pageNumber);
          continue;
        }
        for (let start = 0; start < parts.count;) {
          let low = start + 1, high = parts.count, end = start;
          while (low <= high) {
            const mid = low + Math.floor((high - low) / 2);
            const candidate = parts.slice(start, mid);
            content.append(candidate);
            this.fitDisplayMath(candidate);
            const fits = !this.isContentOverflow(content);
            candidate.remove();
            if (fits) { end = mid; low = mid + 1; }
            else high = mid - 1;
          }
          if (end === start && hasContent) {
            nextPage();
            continue;
          }
          if (end === start) {
            content.append(parts.slice(start, parts.count));
            blockedPages.push(pageNumber);
            break;
          }
          const fragment = parts.slice(start, end);
          content.append(fragment);
          this.fitDisplayMath(fragment);
          hasContent = true;
          start = end;
          if (start < parts.count) nextPage();
        }
      }

      if (!live() || !this.sourceIsCurrent()) return;
      const previousScroll = { top: this.previewScrollEl.scrollTop, left: this.previewScrollEl.scrollLeft };
      finishPage();
      // Avoid attaching all pages as visible, even for one layout frame.
      const visiblePage = Math.min(this.currentPage, pageNumber);
      for (const element of finished.children) {
        element.classList.toggle("is-hidden", Number(element.dataset.pageNumber) !== visiblePage);
      }
      this.previewPagesEl.replaceChildren(finished);
      this.blockedPages = blockedPages;
      this.pageCount = pageNumber;
      this.readyRevision = revision;
      this.pageCountEl.setText(this.plugin.t("pdf.pageCount", { count: pageNumber }));
      this.showPage(Math.min(this.currentPage, pageNumber), false, previousScroll);
      this.updateOutputRangeLabels();
    } finally {
      measuring.remove();
    }
  }

  showPage(pageNumber, resetScroll = false, preservedScroll = null) {
    const target = Math.min(this.pageCount, Math.max(1, Number.isFinite(pageNumber) ? Math.round(pageNumber) : 1));
    this.currentPage = target;
    this.previewPagesEl.querySelectorAll(".bysan-pdf-preview-page").forEach(
      (page, index) => page.classList.toggle("is-hidden", index + 1 !== target)
    );
    this.pageInput.value = String(target);
    this.pageInput.max = String(this.pageCount);
    this.pageTotalEl.setText(this.plugin.t("pdf.pageTotal", { count: this.pageCount }));
    this.previousPageButton.disabled = target <= 1;
    this.nextPageButton.disabled = target >= this.pageCount;
    if (resetScroll) this.previewScrollEl.scrollTo({ top: 0, left: 0 });
    else if (preservedScroll) this.previewScrollEl.scrollTo(preservedScroll);
    this.updateOutputRangeLabels();
  }

  outputRange() {
    if (this.rangeMode === "current") return { pages: new Set([this.currentPage]) };
    return parsePageRange(this.rangeMode === "all" ? "all" : this.pageRange, this.pageCount);
  }

  updateOutputRangeLabels() {
    if (!this.exportButton) return;
    const ready = this.readyRevision === this.revision && !this.rendering;
    const { pages, error, token } = this.outputRange();
    const rangeError = this.rangeMode === "custom" && ready && error;
    const blocked = ready && pages ? this.blockedPages.filter(page => pages.has(page)) : [];
    this.rangeInput.setAttribute("aria-invalid", String(Boolean(rangeError)));
    const t = (key, args) => this.plugin.t(key, args);
    const issue = this.layoutError ||
      (!ready ? t("pdf.paginating") : rangeError
        ? t(`pdf.rangeError.${error}`, { token: token || "—", count: this.pageCount })
        : blocked.length ? t("pdf.blockedPages", { pages: blocked.join(", ") }) : "");
    const missing = ready && pages ? this.countPageElements(pages, "missingImages") : 0;
    const fitted = ready && pages ? this.countPageElements(pages, "fittedBlocks") : 0;
    this.outputStatus.setText(issue || t("pdf.outputSummary", { count: pages.size, total: this.pageCount }) +
      (missing ? " " + t("pdf.missingImageCount", { count: missing }) : "") +
      (fitted ? " " + t("pdf.fittedBlockCount", { count: fitted }) : ""));
    this.outputStatus.classList.toggle("is-warning", Boolean(this.layoutError || rangeError || blocked.length || missing));
    this.exportButton.disabled = this.working || Boolean(issue) || !pages?.size;
    this.exportButton.setText(this.working ? t("pdf.exporting") : issue ? t("pdf.export") : t("pdf.exportCount", { count: pages.size }));
    this.previewPagesEl.querySelectorAll(".bysan-pdf-preview-page").forEach((page, index) => {
      page.classList.toggle("is-excluded-from-export", Boolean(ready && !pages?.has(index + 1)));
    });
  }

  countPageElements(pages, key) {
    return [...this.previewPagesEl.children].reduce((count, page) =>
      count + (pages.has(Number(page.dataset.pageNumber)) ? Number(page.dataset[key] || 0) : 0), 0);
  }

  sourceIsCurrent() {
    return this.view.file === this.sourceFile && this.view.editor?.getValue() === this.renderedMarkdown;
  }

  async collectCss() {
    const rules = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) {
          rules.push(rule.type === CSSRule.FONT_FACE_RULE
            ? this.inlineFontRule(rule.cssText, sheet.href || document.baseURI) : rule.cssText);
        }
      } catch (error) {
        console.warn("[Bysan PDF] skipped stylesheet", error);
      }
    }
    return (await Promise.all(rules)).join("\n");
  }

  async inlineFontRule(css, base) {
    // A file:// print window cannot resolve Obsidian's relative Inter,
    // monospace and MathJax font URLs. Fallback fonts alter line sizes.
    const tokens = [...css.matchAll(FONT_URL)];
    const replacements = await Promise.all(tokens.map(async ([token, quoted, single, raw]) => {
      const path = (quoted ?? single ?? raw).trim();
      try {
        const url = new URL(path, base);
        return url.protocol === "app:" ? `url("${await embedFont(url.href)}")` : token;
      } catch (error) {
        console.warn("[Bysan PDF] Could not embed font", path, error);
        return token;
      }
    }));
    let index = 0;
    return css.replace(FONT_URL, () => replacements[index++]);
  }

  computedStyleSnapshot(element, selector) {
    if (!element) return "";
    const computed = getComputedStyle(element);
    const declarations = [];
    /* Theme rules in a new BrowserWindow can resolve differently because the
     * document has a different root/window context. Freeze every resolved
     * custom property used by the preview page so nested Markdown styles keep
     * the same palette. */
    for (const name of computed) {
      if (!name.startsWith("--")) continue;
      const value = computed.getPropertyValue(name).trim();
      if (value) declarations.push(`${name}:${value} !important`);
    }
    ["background-color", "background-image", "color", "font-family", "font-size", "font-weight", "line-height",
      "font-feature-settings", "font-kerning", "font-optical-sizing", "font-variation-settings", "letter-spacing",
      "word-spacing", "text-rendering", "direction"]
      .forEach((name) => {
        const value = computed.getPropertyValue(name).trim();
        if (value) declarations.push(`${name}:${value} !important`);
      });
    return declarations.length ? `${selector}{${declarations.join(";")}}` : "";
  }

  renderedLabelLines(label) {
    const lineMap = new Map();
    const walker = document.createTreeWalker(label, NodeFilter.SHOW_TEXT);
    let textNode;
    while ((textNode = walker.nextNode())) {
      for (let index = 0; index < textNode.data.length; index += 1) {
        const character = textNode.data[index];
        const range = document.createRange();
        range.setStart(textNode, index);
        range.setEnd(textNode, index + 1);
        const rect = range.getBoundingClientRect();
        if (!rect.width && !rect.height) continue;
        const lineKey = Math.round(rect.top * 2) / 2;
        lineMap.set(lineKey, `${lineMap.get(lineKey) || ""}${character}`);
      }
    }
    const lines = Array.from(lineMap.entries())
      .sort(([first], [second]) => first - second)
      .map(([, text]) => text.replace(/\s+/g, " ").trim())
      .filter(Boolean);
    return lines.length ? lines : [label.textContent.trim()];
  }

  replaceForeignObjectsWithText(sourceSvg, exportSvg) {
    const namespace = "http://www.w3.org/2000/svg";
    const sourceObjects = Array.from(sourceSvg.querySelectorAll("foreignObject"));
    const exportObjects = Array.from(exportSvg.querySelectorAll("foreignObject"));
    sourceObjects.forEach((sourceObject, index) => {
      const exportObject = exportObjects[index];
      const label = Array.from(sourceObject.querySelectorAll(".nodeLabel,.label,span,p,div"))
        .find((element) => element.textContent?.trim());
      if (!exportObject || !label) return;
      const x = Number(sourceObject.getAttribute("x") || 0);
      const y = Number(sourceObject.getAttribute("y") || 0);
      const width = Number(sourceObject.getAttribute("width") || 0);
      const height = Number(sourceObject.getAttribute("height") || 0);
      if (!(width > 0) || !(height > 0)) return;
      const computed = getComputedStyle(label);
      const fontSize = Number.parseFloat(computed.fontSize) || 16;
      const lineHeight = Number.parseFloat(computed.lineHeight) || fontSize * 1.2;
      const lines = this.renderedLabelLines(label);
      const text = document.createElementNS(namespace, "text");
      text.setAttribute("x", String(x + width / 2));
      text.setAttribute("y", String(y + height / 2));
      text.setAttribute("text-anchor", "middle");
      text.setAttribute("dominant-baseline", "middle");
      text.style.setProperty("text-anchor", "middle", "important");
      text.style.setProperty("dominant-baseline", "middle", "important");
      text.setAttribute("fill", computed.color || "currentColor");
      text.setAttribute("font-family", computed.fontFamily || "sans-serif");
      text.setAttribute("font-size", String(fontSize));
      text.setAttribute("font-weight", computed.fontWeight || "400");
      if (computed.fontStyle && computed.fontStyle !== "normal") {
        text.setAttribute("font-style", computed.fontStyle);
      }
      const firstOffset = -((lines.length - 1) * lineHeight) / 2;
      lines.forEach((line, lineIndex) => {
        const span = document.createElementNS(namespace, "tspan");
        span.setAttribute("x", String(x + width / 2));
        span.setAttribute("y", String(y + height / 2 + firstOffset + lineIndex * lineHeight));
        span.setAttribute("dominant-baseline", "middle");
        span.style.setProperty("text-anchor", "middle", "important");
        span.style.setProperty("dominant-baseline", "middle", "important");
        span.textContent = line;
        const maximumTextWidth = Math.max(1, width - 12);
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");
        context.font = `${computed.fontStyle} ${computed.fontWeight} ${fontSize}px ${computed.fontFamily}`;
        const measuredWidth = Math.max(1, context.measureText(line).width);
        span.setAttribute("textLength", String(Math.min(measuredWidth, maximumTextWidth)));
        span.setAttribute("lengthAdjust", "spacingAndGlyphs");
        text.appendChild(span);
      });
      exportObject.replaceWith(text);
    });
  }

  async buildExportPages(selected, toFileUrl) {
    const pages = this.previewPagesEl.cloneNode(false);
    pages.style.removeProperty("transform");
    const conversionPages = [];
    for (const [index, sourcePage] of [...this.previewPagesEl.children].entries()) {
      if (!selected.has(index + 1)) continue;
      const exportPage = sourcePage.cloneNode(true);
      exportPage.classList.remove("is-hidden");
      for (const image of exportPage.querySelectorAll("img[data-bysan-pdf-vault-path]")) {
        const file = this.app.vault.getAbstractFileByPath(image.dataset.bysanPdfVaultPath);
        if (file && image.src === this.app.vault.getResourcePath(file)) {
          image.src = toFileUrl(this.app.vault.adapter.getFullPath(file.path)).href;
          image.removeAttribute("srcset");
        }
      }
      pages.append(exportPage);
      if (sourcePage.querySelector(".mermaid foreignObject")) conversionPages.push({ sourcePage, exportPage });
    }
    /* Keep native Mermaid labels in the preview; converting every diagram on
     * every refresh is expensive for long notes. At export, reveal only the
     * pages that still contain foreignObject labels and convert all of them
     * after one layout frame instead of waiting once per page. */
    if (conversionPages.length) {
      const originalVisibility = this.previewPagesEl.style.visibility;
      const originalTransform = this.previewPagesEl.style.transform;
      const hiddenPages = conversionPages.filter(({ sourcePage }) => sourcePage.classList.contains("is-hidden"));
      this.previewPagesEl.style.visibility = "hidden";
      this.previewPagesEl.style.transform = "none";
      hiddenPages.forEach(({ sourcePage }) => sourcePage.classList.remove("is-hidden"));
      try {
        await new Promise((resolve) => requestAnimationFrame(resolve));
        conversionPages.forEach(({ sourcePage, exportPage }) => {
          const sourceSvgs = Array.from(sourcePage.querySelectorAll(".mermaid svg"));
          const exportSvgs = Array.from(exportPage.querySelectorAll(".mermaid svg"));
          sourceSvgs.forEach((sourceSvg, svgIndex) => {
            if (exportSvgs[svgIndex]) this.replaceForeignObjectsWithText(sourceSvg, exportSvgs[svgIndex]);
          });
        });
      } finally {
        hiddenPages.forEach(({ sourcePage }) => sourcePage.classList.add("is-hidden"));
        this.previewPagesEl.style.visibility = originalVisibility;
        this.previewPagesEl.style.transform = originalTransform;
      }
    }
    return pages;
  }

  async exportHtml(selected, toFileUrl) {
    const { width, height } = this.dimensions();
    const pages = await this.buildExportPages(selected, toFileUrl);
    const bodyClasses = Array.from(document.body.classList).join(" ");
    const previewPage = this.previewPagesEl.querySelector(".bysan-pdf-preview-page");
    const previewContent = previewPage?.querySelector(".bysan-pdf-preview-page-content");
    const resolvedPreviewCss = [
      this.computedStyleSnapshot(document.documentElement, "html"),
      this.computedStyleSnapshot(document.body, "body"),
      this.computedStyleSnapshot(previewPage, ".bysan-pdf-preview-page"),
      this.computedStyleSnapshot(previewContent, ".bysan-pdf-preview-page-content")
    ].join("\n");
    const exportCss = `
      @page { size: ${width}mm ${height}mm; margin: 0; }
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .bysan-pdf-preview-page, .bysan-pdf-preview-page * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      .bysan-pdf-preview-pages { display: block !important; zoom: 1 !important; }
      .bysan-pdf-preview-page { margin: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
      .bysan-pdf-preview-page:last-child { break-after: auto; page-break-after: auto; }
      .bysan-pdf-preview-page.is-hidden { display: block !important; }
      .bysan-pdf-preview-page.is-excluded-from-export { display: block !important; }
      .mir-button-group, .mir-fullscreen-button { display: none !important; }
    `;
    const css = await this.collectCss();
    const language = document.documentElement.lang.replace(/[^a-zA-Z0-9-]/g, "");
    return `<!doctype html><html lang="${language}"><head><meta charset="utf-8"><style>${css}\n${resolvedPreviewCss}\n${exportCss}</style></head><body class="${bodyClasses}"><div class="print">${pages.outerHTML}</div></body></html>`;
  }

  async exportPdf() {
    if (!this.sourceIsCurrent()) {
      this.schedulePreviewRender(0);
      return;
    }
    if (this.exportButton.disabled || this.readyRevision !== this.revision) {
      new Notice(this.plugin.t("pdf.waitForPreview"));
      return;
    }
    const remote = window.electron?.remote;
    if (!remote?.BrowserWindow || !remote?.dialog) {
      new Notice(this.plugin.t("pdf.exportUnavailable"));
      return;
    }

    const revision = this.revision, { pages } = this.outputRange();
    const landscape = this.orientation === "landscape", paperSize = this.paperSize, scale = this.actualScale / 100;
    this.working = true;
    this.updateOutputRangeLabels();
    let printWindow;
    let temporaryHtmlPath;
    try {
      const path = remote.require("path");
      const fs = remote.require("fs");
      const os = remote.require("os");
      const notePath = this.sourceFile.parent?.path || "";
      const folder = this.app.vault.adapter.getFullPath(notePath);
      const defaultPath = path.join(folder, `${this.sourceFile.basename || "note"}.pdf`);
      const html = await this.exportHtml(pages, remote.require("url").pathToFileURL);
      if (this.revision !== revision || !this.sourceIsCurrent()) throw new Error(this.plugin.t("pdf.sourceChanged"));
      const selection = await remote.dialog.showSaveDialog(remote.getCurrentWindow(), {
        title: this.plugin.t("pdf.saveTitle"),
        defaultPath,
        filters: [{ name: "PDF", extensions: ["pdf"] }]
      });
      if (selection.canceled || !selection.filePath) return;

      printWindow = new remote.BrowserWindow({
        show: false,
        width: 1000,
        height: 1200,
        webPreferences: { sandbox: true, nodeIntegration: false, contextIsolation: true }
      });
      temporaryHtmlPath = path.join(
        os.tmpdir(),
        `bysan-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.html`
      );
      await fs.promises.writeFile(temporaryHtmlPath, html, "utf8");
      await printWindow.loadFile(temporaryHtmlPath);
      const printImageFailures = await this.awaitLayout(printWindow.webContents.executeJavaScript(`Promise.all([
        document.fonts?.ready || Promise.resolve(),
        ...Array.from(document.images).map(image => image.decode().then(() => null, () => image.alt || "?"))
      ]).then(results => results.slice(1).filter(Boolean))`));
      if (printImageFailures.length) {
        throw new Error(this.plugin.t("pdf.exportImageFailed", { name: printImageFailures[0] }));
      }
      const exportMetrics = await printWindow.webContents.executeJavaScript(`({
        pages: document.querySelectorAll('.bysan-pdf-preview-page').length,
        textLength: document.body.innerText.length || document.querySelectorAll('img,svg').length,
        clipped: [...document.querySelectorAll('.bysan-pdf-preview-page-content')].some(el =>
          el.scrollHeight * Math.min(1, ${scale}) > el.clientHeight + 2 ||
          el.scrollWidth * Math.min(1, ${scale}) > el.clientWidth + 2
        ),
        bodyHeight: document.body.scrollHeight
      })`);
      if (exportMetrics.pages !== pages.size || !exportMetrics.textLength || exportMetrics.clipped) {
        throw new Error(this.plugin.t("pdf.printMismatch"));
      }
      const buffer = await printWindow.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        landscape,
        pageSize: paperSize,
        margins: { top: 0, bottom: 0, left: 0, right: 0 }
      });
      await fs.promises.writeFile(selection.filePath, buffer);
      new Notice(this.plugin.t("pdf.exported", { path: selection.filePath }));
    } catch (error) {
      console.error("[Bysan PDF] export failed", error);
      new Notice(this.plugin.t("pdf.exportFailed", { message: error?.message || error }));
    } finally {
      if (printWindow && !printWindow.isDestroyed()) printWindow.destroy();
      if (temporaryHtmlPath) {
        try {
          await remote.require("fs").promises.unlink(temporaryHtmlPath);
        } catch (_) {}
      }
      this.working = false;
      if (this.exportButton.isConnected) this.updateOutputRangeLabels();
    }
  }

  onClose() {
    window.clearTimeout(this.previewTimer);
    window.clearTimeout(this.renderTimer);
    this.renderGeneration++;
    this.resizeObserver?.disconnect();
    this.renderComponent?.unload?.();
    if (this.sourceEvent) this.app.workspace.offref(this.sourceEvent);
    this.contentEl.empty();
  }
}

module.exports = { BysanPdfPreviewModal, parsePageRange };
