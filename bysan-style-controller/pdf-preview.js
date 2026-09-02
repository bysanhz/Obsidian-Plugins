const { MarkdownRenderer, Modal, Notice } = globalThis.__bysanPdfApi;

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

function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}

class BysanPdfPreviewModal extends Modal {
  constructor(app, plugin, view) {
    super(app);
    this.plugin = plugin;
    this.view = view;
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
    this.grayscale = Boolean(plugin.settings.pdfGrayscale);
    this.currentPage = 1;
    this.pageCount = 1;
    this.renderTimer = null;
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
    this.previewPagesEl = this.previewScrollEl.createDiv({
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
    this.previewObserver = new MutationObserver(() => this.schedulePagination(140));
    this.previewObserver.observe(this.previewStagingContentEl, {
      childList: true,
      subtree: true
    });
    /* The source editor remains live while the modal is open. Rebuild from the
     * latest Markdown after a short debounce so Mermaid width directives are
     * never applied to one pagination pass and missed by the next one. */
    this.sourceEditor = this.view.editor;
    this.sourceChangeHandler = () => this.schedulePreviewRender(220);
    this.sourceEditor?.on?.("change", this.sourceChangeHandler);

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
  }

  buildSidebar(workspace) {
    const sidebar = workspace.createDiv({ cls: "bysan-pdf-preview-sidebar" });
    sidebar.createEl("h3", { text: this.plugin.t("pdf.operations") });
    const makeField = (label) => {
      const field = sidebar.createDiv({ cls: "bysan-pdf-preview-field" });
      field.createEl("label", { text: label });
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
    const marginInputs = {};
    [["top", "pdf.marginTop"], ["right", "pdf.marginRight"], ["bottom", "pdf.marginBottom"], ["left", "pdf.marginLeft"]]
      .forEach(([side, key]) => {
        const cell = marginGrid.createDiv({ cls: "bysan-pdf-preview-margin-cell" });
        cell.createEl("label", { text: this.plugin.t(key) });
        marginInputs[side] = cell.createEl("input", {
          attr: { type: "number", min: "0", max: "60", step: "0.5", value: String(this.margins[side]) }
        });
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
    const rangeInput = rangeField.createEl("input", {
      attr: { type: "text", placeholder: "all", value: this.pageRange }
    });
    rangeField.createDiv({ cls: "bysan-pdf-preview-field-hint", text: this.plugin.t("pdf.pageRangeHint") });

    const grayscaleField = makeField(this.plugin.t("pdf.grayscale"));
    const grayscaleInput = grayscaleField.createEl("input", {
      attr: { type: "checkbox", "aria-label": this.plugin.t("pdf.grayscale") }
    });
    grayscaleInput.checked = this.grayscale;
    grayscaleField.createDiv({ cls: "bysan-pdf-preview-field-hint", text: this.plugin.t("pdf.grayscaleHint") });

    const previewField = makeField(this.plugin.t("pdf.previewZoom"));
    const previewRow = previewField.createDiv({ cls: "bysan-pdf-preview-zoom-row" });
    const previewInput = previewRow.createEl("input", {
      attr: { type: "range", min: "40", max: "160", step: "5", value: String(this.previewZoom) }
    });
    const previewValue = previewRow.createSpan({ text: `${this.previewZoom}%` });

    const actualField = makeField(this.plugin.t("pdf.actualScale"));
    const actualRow = actualField.createDiv({ cls: "bysan-pdf-preview-zoom-row" });
    const actualInput = actualRow.createEl("input", {
      attr: { type: "range", min: "40", max: "160", step: "5", value: String(this.actualScale) }
    });
    const actualValue = actualRow.createSpan({ text: `${this.actualScale}%` });
    actualField.createDiv({
      cls: "bysan-pdf-preview-field-hint",
      text: this.plugin.t("pdf.actualScaleHint")
    });

    const actions = sidebar.createDiv({ cls: "bysan-pdf-preview-actions" });
    const refresh = actions.createEl("button", {
      text: this.plugin.t("pdf.refresh"), attr: { type: "button" }
    });
    this.exportButton = actions.createEl("button", {
      cls: "mod-cta", text: this.plugin.t("pdf.export"), attr: { type: "button" }
    });
    sidebar.createDiv({
      cls: "bysan-pdf-preview-sidebar-hint",
      text: this.plugin.t("pdf.directExportHint")
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
      Object.entries(this.margins).forEach(([side, value]) => { marginInputs[side].value = String(value); });
      void this.savePreference("pdfMarginMode", this.marginMode);
      void this.saveMargins();
      this.applyLayoutSettings();
    });
    Object.entries(marginInputs).forEach(([side, input]) => {
      input.addEventListener("change", () => {
        this.margins[side] = clamp(input.value, 0, 60);
        input.value = String(this.margins[side]);
        this.marginMode = "custom";
        marginSelect.value = "custom";
        void this.savePreference("pdfMarginMode", "custom");
        void this.saveMargins();
        this.applyLayoutSettings();
      });
    });
    previewInput.addEventListener("input", () => {
      this.previewZoom = Number(previewInput.value);
      previewValue.setText(`${this.previewZoom}%`);
      this.previewPagesEl.style.zoom = String(this.previewZoom / 100);
      void this.savePreference("pdfPreviewZoom", this.previewZoom);
    });
    actualInput.addEventListener("input", () => {
      this.actualScale = Number(actualInput.value);
      actualValue.setText(`${this.actualScale}%`);
      void this.savePreference("pdfActualScale", this.actualScale);
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
    rangeInput.addEventListener("change", () => {
      this.pageRange = rangeInput.value.trim() || "all";
      rangeInput.value = this.pageRange;
      void this.savePreference("pdfPageRange", this.pageRange);
      this.updateOutputRangeLabels();
    });
    grayscaleInput.addEventListener("change", () => {
      this.grayscale = grayscaleInput.checked;
      void this.savePreference("pdfGrayscale", this.grayscale);
      this.previewPagesEl.classList.toggle("is-grayscale", this.grayscale);
    });
    refresh.addEventListener("click", () => void this.renderPreview());
    this.exportButton.addEventListener("click", () => void this.exportPdf());
  }

  async savePreference(key, value) {
    this.plugin.settings[key] = value;
    await this.plugin.saveData(this.plugin.settings);
  }

  async saveMargins() {
    await Promise.all(Object.entries(this.margins).map(([side, value]) =>
      this.savePreference(`pdfMargin${side[0].toUpperCase()}${side.slice(1)}`, value)
    ));
  }

  dimensions() {
    let [width, height] = PAPER_SIZES[this.paperSize] || PAPER_SIZES.A4;
    if (this.orientation === "landscape") [width, height] = [height, width];
    const { top, right, bottom, left } = this.margins;
    return { width, height, marginTop: top, marginRight: right, marginBottom: bottom, marginLeft: left };
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
    this.previewPagesEl.style.zoom = String(this.previewZoom / 100);
    this.previewPagesEl.classList.toggle("is-grayscale", this.grayscale);
    this.applyActualScale(this.previewStagingContentEl);
    if (repaginate) this.schedulePagination(60);
  }

  async renderPreview() {
    const markdown = this.view.editor?.getValue();
    if (typeof markdown !== "string") {
      this.previewPagesEl.setText(this.plugin.t("pdf.readError"));
      return;
    }
    this.previewPagesEl.empty();
    this.previewStagingContentEl.empty();
    this.pageCountEl.setText(this.plugin.t("pdf.paginating"));
    await MarkdownRenderer.render(
      this.app,
      markdown,
      this.previewStagingContentEl,
      this.view.file?.path || "",
      this
    );
    await this.hydrateInternalImageEmbeds(this.previewStagingContentEl);
    await this.settleMediaWidths(markdown, this.previewStagingContentEl);
    this.previewStagingContentEl.querySelectorAll("img").forEach((image) => {
      if (!image.complete) image.addEventListener("load", () => this.schedulePagination(50), { once: true });
    });
    this.schedulePagination(60);
    this.schedulePagination(600);
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
      const requestedWidth = Number(embed.getAttribute("width"));
      embed.empty();
      embed.addClass("image-embed", "is-loaded");
      const image = embed.createEl("img", {
        attr: {
          src: resourcePath,
          alt: embed.getAttribute("alt") || file.basename
        }
      });
      if (Number.isFinite(requestedWidth) && requestedWidth > 0) {
        image.style.width = `${requestedWidth}px`;
        image.style.maxWidth = "100%";
      }
    }
  }

  schedulePreviewRender(delay = 180) {
    window.clearTimeout(this.renderTimer);
    this.renderTimer = window.setTimeout(() => void this.renderPreview(), delay);
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
    this.previewTimer = window.setTimeout(() => void this.paginatePreview(), delay);
  }

  createPreviewPage(pageNumber) {
    const page = this.previewPagesEl.createDiv({ cls: "bysan-pdf-preview-page" });
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
  }

  isContentOverflow(content) {
    const scale = clamp(this.actualScale, 40, 160) / 100;
    /* A reduced transform does not affect scrollHeight. Compare the painted
     * height instead so smaller output can use the additional page space. */
    const paintedHeight = scale < 1 ? content.scrollHeight * scale : content.scrollHeight;
    return paintedHeight > content.clientHeight + 1;
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

  async paginatePreview() {
    if (!this.previewStagingContentEl?.isConnected) return;
    const markdown = this.view.editor?.getValue() || "";
    const previousScroll = { top: this.previewScrollEl.scrollTop, left: this.previewScrollEl.scrollLeft };
    await this.settleMediaWidths(markdown, this.previewStagingContentEl);
    if (!this.previewStagingContentEl?.isConnected) return;
    this.previewPagesEl.empty();
    let pageNumber = 1;
    let { content } = this.createPreviewPage(pageNumber);
    let hasContent = false;

    Array.from(this.previewStagingContentEl.childNodes).forEach((sourceNode) => {
      const clone = sourceNode.cloneNode(true);
      content.appendChild(clone);
      const whitespace = clone.nodeType === Node.TEXT_NODE && !clone.textContent.trim();
      const overflows = this.isContentOverflow(content);
      if (overflows && hasContent && !whitespace) {
        clone.remove();
        pageNumber += 1;
        ({ content } = this.createPreviewPage(pageNumber));
        content.appendChild(clone);
      }
      if (!whitespace) hasContent = true;
    });

    this.previewPagesEl.querySelectorAll(".mermaid svg").forEach((svg) => {
      this.replaceForeignObjectsWithText(svg, svg);
    });

    this.pageCount = pageNumber;
    this.pageCountEl.setText(this.plugin.t("pdf.pageCount", { count: pageNumber }));
    this.showPage(Math.min(this.currentPage, pageNumber), false, previousScroll);
    this.updateOutputRangeLabels();
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
  }

  selectedPageNumbers() {
    const range = this.pageRange.trim().toLowerCase();
    if (!range || range === "all" || range === "*" || range === "全部") {
      return new Set(Array.from({ length: this.pageCount }, (_, index) => index + 1));
    }
    const pages = new Set();
    range.split(",").forEach((part) => {
      const match = part.trim().match(/^(\d+)(?:\s*-\s*(\d+))?$/);
      if (!match) return;
      const first = clamp(match[1], 1, this.pageCount);
      const last = clamp(match[2] || match[1], 1, this.pageCount);
      for (let page = Math.min(first, last); page <= Math.max(first, last); page += 1) pages.add(page);
    });
    return pages.size ? pages : new Set(Array.from({ length: this.pageCount }, (_, index) => index + 1));
  }

  updateOutputRangeLabels() {
    const selected = this.selectedPageNumbers();
    this.previewPagesEl.querySelectorAll(".bysan-pdf-preview-page").forEach((page, index) => {
      page.classList.toggle("is-excluded-from-export", !selected.has(index + 1));
    });
  }

  collectCss() {
    const rules = [];
    for (const sheet of document.styleSheets) {
      try {
        for (const rule of sheet.cssRules) rules.push(rule.cssText);
      } catch (error) {
        console.warn("[Bysan PDF] skipped stylesheet", error);
      }
    }
    return rules.join("\n");
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

  async buildExportPages() {
    const pages = this.previewPagesEl.cloneNode(true);
    pages.style.removeProperty("zoom");
    const sourcePages = Array.from(this.previewPagesEl.querySelectorAll(".bysan-pdf-preview-page"));
    const exportPages = Array.from(pages.querySelectorAll(".bysan-pdf-preview-page"));
    const originalVisibility = this.previewPagesEl.style.visibility;
    const originalZoom = this.previewPagesEl.style.zoom;
    this.previewPagesEl.style.visibility = "hidden";
    this.previewPagesEl.style.zoom = "1";
    try {
      for (let pageIndex = 0; pageIndex < sourcePages.length; pageIndex += 1) {
        const sourcePage = sourcePages[pageIndex];
        const exportPage = exportPages[pageIndex];
        const wasHidden = sourcePage.classList.contains("is-hidden");
        sourcePage.classList.remove("is-hidden");
        await new Promise((resolve) => requestAnimationFrame(resolve));
        const sourceSvgs = Array.from(sourcePage.querySelectorAll(".mermaid svg"));
        const exportSvgs = Array.from(exportPage.querySelectorAll(".mermaid svg"));
        sourceSvgs.forEach((sourceSvg, svgIndex) => {
          const exportSvg = exportSvgs[svgIndex];
          if (exportSvg) this.replaceForeignObjectsWithText(sourceSvg, exportSvg);
        });
        if (wasHidden) sourcePage.classList.add("is-hidden");
      }
    } finally {
      this.previewPagesEl.style.visibility = originalVisibility;
      this.previewPagesEl.style.zoom = originalZoom;
    }
    exportPages.forEach((page) => page.classList.remove("is-hidden"));
    const selected = this.selectedPageNumbers();
    exportPages.forEach((page, index) => {
      if (!selected.has(index + 1)) page.remove();
    });
    return pages;
  }

  async exportHtml() {
    const { width, height } = this.dimensions();
    const pages = await this.buildExportPages();
    const bodyClasses = Array.from(document.body.classList).join(" ");
    const exportCss = `
      @page { size: ${width}mm ${height}mm; margin: 0; }
      html, body { margin: 0 !important; padding: 0 !important; background: #fff !important; }
      .bysan-pdf-preview-pages { display: block !important; zoom: 1 !important; }
      .bysan-pdf-preview-page { margin: 0 !important; box-shadow: none !important; break-after: page; page-break-after: always; }
      .bysan-pdf-preview-page:last-child { break-after: auto; page-break-after: auto; }
      .bysan-pdf-preview-page.is-hidden { display: block !important; }
      .bysan-pdf-preview-page.is-excluded-from-export { display: block !important; }
      .mir-button-group, .mir-fullscreen-button { display: none !important; }
    `;
    return `<!doctype html><html><head><meta charset="utf-8"><style>${this.collectCss()}\n${exportCss}</style></head><body class="${bodyClasses}"><div class="print">${pages.outerHTML}</div></body></html>`;
  }

  async exportPdf() {
    if (!this.previewPagesEl.querySelector(".bysan-pdf-preview-page")) {
      new Notice(this.plugin.t("pdf.waitForPreview"));
      return;
    }
    const remote = window.electron?.remote;
    if (!remote?.BrowserWindow || !remote?.dialog) {
      new Notice(this.plugin.t("pdf.exportUnavailable"));
      return;
    }

    this.exportButton.disabled = true;
    this.exportButton.setText(this.plugin.t("pdf.exporting"));
    let printWindow;
    let temporaryHtmlPath;
    try {
      const path = remote.require("path");
      const fs = remote.require("fs");
      const os = remote.require("os");
      const notePath = this.view.file?.parent?.path || "";
      const folder = this.app.vault.adapter.getFullPath(notePath);
      const defaultPath = path.join(folder, `${this.view.file?.basename || "note"}.pdf`);
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
        webPreferences: { sandbox: false }
      });
      const html = await this.exportHtml();
      temporaryHtmlPath = path.join(
        os.tmpdir(),
        `bysan-pdf-${Date.now()}-${Math.random().toString(36).slice(2)}.html`
      );
      await fs.promises.writeFile(temporaryHtmlPath, html, "utf8");
      await printWindow.loadFile(temporaryHtmlPath);
      await printWindow.webContents.executeJavaScript(`Promise.all([
        document.fonts?.ready || Promise.resolve(),
        ...Array.from(document.images).map((image) => image.complete
          ? Promise.resolve()
          : new Promise((resolve) => {
              image.addEventListener('load', resolve, { once: true });
              image.addEventListener('error', resolve, { once: true });
            }))
      ])`);
      const exportMetrics = await printWindow.webContents.executeJavaScript(`({
        pages: document.querySelectorAll('.bysan-pdf-preview-page').length,
        textLength: document.body.innerText.length,
        bodyHeight: document.body.scrollHeight
      })`);
      if (!exportMetrics.pages || !exportMetrics.textLength) {
        throw new Error("Export document did not render any printable content");
      }
      await new Promise((resolve) => window.setTimeout(resolve, 400));
      const buffer = await printWindow.webContents.printToPDF({
        printBackground: true,
        preferCSSPageSize: true,
        landscape: this.orientation === "landscape",
        pageSize: this.paperSize,
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
      this.exportButton.disabled = false;
      this.exportButton.setText(this.plugin.t("pdf.export"));
    }
  }

  onClose() {
    window.clearTimeout(this.previewTimer);
    window.clearTimeout(this.renderTimer);
    this.previewObserver?.disconnect();
    this.sourceEditor?.off?.("change", this.sourceChangeHandler);
    this.contentEl.empty();
  }
}

module.exports = { BysanPdfPreviewModal };
