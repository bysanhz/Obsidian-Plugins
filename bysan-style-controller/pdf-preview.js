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
    this.previewZoom = Number(plugin.settings.pdfPreviewZoom || 75);
    this.actualScale = Number(plugin.settings.pdfActualScale || 100);
    this.currentPage = 1;
    this.pageCount = 1;
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
      cls: "bysan-pdf-preview-staging markdown-rendered"
    });
    this.previewObserver = new MutationObserver(() => this.schedulePagination(140));
    this.previewObserver.observe(this.previewStagingEl, {
      childList: true,
      subtree: true
    });

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
    this.previousPageButton.addEventListener("click", () => this.showPage(this.currentPage - 1));
    this.nextPageButton.addEventListener("click", () => this.showPage(this.currentPage + 1));
    this.pageInput.addEventListener("change", () => this.showPage(Number(this.pageInput.value)));
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
      void this.savePreference("pdfMarginMode", this.marginMode);
      this.applyLayoutSettings();
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
    refresh.addEventListener("click", () => void this.renderPreview());
    this.exportButton.addEventListener("click", () => void this.exportPdf());
  }

  async savePreference(key, value) {
    this.plugin.settings[key] = value;
    await this.plugin.saveData(this.plugin.settings);
  }

  dimensions() {
    let [width, height] = PAPER_SIZES[this.paperSize] || PAPER_SIZES.A4;
    if (this.orientation === "landscape") [width, height] = [height, width];
    const [marginY, marginX] = MARGINS[this.marginMode] || MARGINS.normal;
    return { width, height, marginY, marginX };
  }

  applyLayoutSettings(repaginate = true) {
    const { width, height, marginY, marginX } = this.dimensions();
    [this.previewPagesEl, this.previewStagingEl].forEach((element) => {
      element.style.setProperty("--bysan-pdf-page-width", `${width}mm`);
      element.style.setProperty("--bysan-pdf-page-height", `${height}mm`);
      element.style.setProperty("--bysan-pdf-margin-y", `${marginY}mm`);
      element.style.setProperty("--bysan-pdf-margin-x", `${marginX}mm`);
    });
    this.previewPagesEl.style.zoom = String(this.previewZoom / 100);
    if (repaginate) this.schedulePagination(60);
  }

  async renderPreview() {
    const markdown = this.view.editor?.getValue();
    if (typeof markdown !== "string") {
      this.previewPagesEl.setText(this.plugin.t("pdf.readError"));
      return;
    }
    this.previewPagesEl.empty();
    this.previewStagingEl.empty();
    this.pageCountEl.setText(this.plugin.t("pdf.paginating"));
    await MarkdownRenderer.render(
      this.app,
      markdown,
      this.previewStagingEl,
      this.view.file?.path || "",
      this
    );
    this.applyMediaWidths(markdown);
    this.previewStagingEl.querySelectorAll("img").forEach((image) => {
      if (!image.complete) image.addEventListener("load", () => this.schedulePagination(50), { once: true });
    });
    this.schedulePagination(60);
    this.schedulePagination(600);
  }

  applyMediaWidths(markdown) {
    const resizer = this.app.plugins.plugins["mermaid-inline-resizer"];
    resizer?.applyWidthsToRenderedRoot?.(this.previewStagingEl, markdown);
  }

  schedulePagination(delay = 100) {
    window.clearTimeout(this.previewTimer);
    this.previewTimer = window.setTimeout(() => this.paginatePreview(), delay);
  }

  createPreviewPage(pageNumber) {
    const page = this.previewPagesEl.createDiv({ cls: "bysan-pdf-preview-page" });
    page.dataset.pageNumber = String(pageNumber);
    const content = page.createDiv({ cls: "bysan-pdf-preview-page-content markdown-rendered" });
    const scale = clamp(this.actualScale, 40, 160) / 100;
    content.style.zoom = String(scale);
    content.style.width = `${100 / scale}%`;
    content.style.height = `${100 / scale}%`;
    return { page, content };
  }

  paginatePreview() {
    if (!this.previewStagingEl?.isConnected) return;
    const markdown = this.view.editor?.getValue() || "";
    this.applyMediaWidths(markdown);
    this.previewPagesEl.empty();
    let pageNumber = 1;
    let { content } = this.createPreviewPage(pageNumber);
    let hasContent = false;

    Array.from(this.previewStagingEl.childNodes).forEach((sourceNode) => {
      const clone = sourceNode.cloneNode(true);
      content.appendChild(clone);
      const whitespace = clone.nodeType === Node.TEXT_NODE && !clone.textContent.trim();
      const overflows = content.scrollHeight > content.clientHeight + 1;
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
    this.showPage(Math.min(this.currentPage, pageNumber));
  }

  showPage(pageNumber) {
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
    this.previewScrollEl.scrollTo({ top: 0, left: 0 });
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
        preferCSSPageSize: false,
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
    this.previewObserver?.disconnect();
    this.contentEl.empty();
  }
}

module.exports = { BysanPdfPreviewModal };
