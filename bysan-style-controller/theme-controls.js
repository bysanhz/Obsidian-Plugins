const Setting = globalThis.__bysanObsidianSetting;

/* These Blue Topaz settings already have clearer, Bysan-specific controls in
 * the first part of the settings page. Keeping one owner prevents two widgets
 * from fighting over the same body class. */
const MANUAL_SETTING_IDS = new Set([
  "background-settings-workplace-background-image",
  "background-settings-workplace-theme-light",
  "background-settings-workplace-theme-dark"
]);


function localised(item, key) {
  return item[`${key}.zh`] || item[key] || "";
}


function isDefined(value) {
  return value !== undefined && value !== null;
}


function clamp(value, minimum, maximum) {
  return Math.min(maximum, Math.max(minimum, Number(value)));
}


function parseColor(value) {
  const text = String(value || "").trim();
  const hex = text.match(/^#([0-9a-f]{6})([0-9a-f]{2})?$/i);
  if (hex) {
    const rgb = Number.parseInt(hex[1], 16);
    return {
      hex: `#${hex[1].toLowerCase()}`,
      red: (rgb >> 16) & 255,
      green: (rgb >> 8) & 255,
      blue: rgb & 255,
      alpha: hex[2] ? Number.parseInt(hex[2], 16) / 255 : 1
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
      alpha: isDefined(rgba[4]) ? clamp(rgba[4], 0, 1) : 1
    };
  }

  return { hex: "#000000", red: 0, green: 0, blue: 0, alpha: 1 };
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
    this.catalogItems = (catalog?.settings || []).filter((item) => item && item.id);
    this.items = (catalog?.settings || [])
      .filter((item) => item && item.id && !MANUAL_SETTING_IDS.has(item.id));
    this.controlItems = this.items.filter((item) => !["heading", "info-text"].includes(item.type));
  }


  registerCommands() {
    for (const item of this.catalogItems.filter((entry) => entry.addCommand && entry.type === "class-toggle")) {
      this.plugin.addCommand({
        id: `theme-toggle-${item.id}`,
        name: `主题：${localised(item, "title") || item.id}`,
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
    const body = document.body;
    const mode = body.classList.contains("theme-dark") ? "dark" : "light";
    for (const item of this.items) {
      if (!String(item.type || "").startsWith("variable-")) continue;
      const value = this.valueFor(item, mode);
      if (!isDefined(value)) continue;

      if (item.format === "hsl-split") {
        const color = parseColor(value);
        const hsl = rgbToHsl(color.red, color.green, color.blue);
        body.style.setProperty(`--${item.id}-h`, String(hsl.hue));
        body.style.setProperty(`--${item.id}-s`, `${hsl.saturation}%`);
        body.style.setProperty(`--${item.id}-l`, `${hsl.lightness}%`);
        body.style.setProperty(`--${item.id}-a`, String(color.alpha));
        continue;
      }

      let formatted = String(value);
      if (["variable-number", "variable-number-slider"].includes(item.type) && item.format) {
        formatted += item.format;
      }
      body.style.setProperty(`--${item.id}`, formatted);
    }
  }


  render(containerEl) {
    const introduction = new Setting(containerEl)
      .setName(`完整主题设置（${this.count} 项）`)
      .setDesc("下列控件来自已打包主题的完整设置定义，均由本插件独立保存并即时应用。")
      .setHeading();
    introduction.settingEl.addClass("bysan-theme-catalog-title");

    const search = new Setting(containerEl)
      .setName("搜索主题功能")
      .setDesc("可按中文名、英文名、说明或设置 ID 筛选。")
      .addSearch((component) => component
        .setPlaceholder("例如：标签页、文件树、标题颜色")
        .onChange((query) => this.filterRows(containerEl, query)));
    search.settingEl.addClass("bysan-theme-search");

    for (const item of this.items) this.renderItem(containerEl, item);
  }


  renderItem(containerEl, item) {
    const title = localised(item, "title") || item.id;
    const description = localised(item, "description");
    const setting = new Setting(containerEl).setName(title);
    if (description) setting.setDesc(description);
    setting.settingEl.addClass("bysan-theme-setting-item");
    setting.settingEl.dataset.bysanSearch = `${title} ${item.title || ""} ${description} ${item.id}`.toLowerCase();

    if (item.type === "heading") {
      setting.setHeading();
      setting.settingEl.addClass(`bysan-theme-heading-${item.level || 2}`);
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
        if (item.allowEmpty) dropdown.addOption("", "默认 / 空");
        for (const option of item.options || []) {
          if (isDefined(option?.value)) dropdown.addOption(String(option.value), String(option.label || option.value));
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
        .setValue(Number(this.valueFor(item)))
        .onChange((value) => this.plugin.updateThemeSetting(item.id, value)));
      return;
    }

    if (item.type === "variable-number") {
      setting.addText((text) => {
        text.inputEl.type = "number";
        text.setValue(String(this.valueFor(item)));
        text.onChange((value) => {
          const number = Number(value);
          if (Number.isFinite(number)) this.plugin.updateThemeSetting(item.id, number);
        });
      });
      return;
    }

    setting.addText((text) => text
      .setPlaceholder("CSS 值")
      .setValue(String(this.valueFor(item) ?? ""))
      .onChange((value) => this.plugin.updateThemeSetting(item.id, value)));
  }


  addThemedColorControls(setting, item) {
    for (const mode of ["light", "dark"]) {
      const label = mode === "light" ? "浅色" : "深色";
      const parsed = parseColor(this.valueFor(item, mode));
      setting.addColorPicker((picker) => {
        picker.setValue(parsed.hex);
        picker.colorPickerEl?.setAttribute("title", `${label}颜色`);
        picker.onChange((hex) => {
          const current = parseColor(this.valueFor(item, mode));
          this.updateThemedColor(item, mode, hex, current.alpha);
        });
      });
      if (item.opacity) {
        setting.addSlider((slider) => {
          slider.setLimits(0, 1, 0.01).setDynamicTooltip().setValue(parsed.alpha);
          slider.sliderEl?.setAttribute("title", `${label}透明度`);
          slider.onChange((alpha) => {
            const current = parseColor(this.valueFor(item, mode));
            this.updateThemedColor(item, mode, current.hex, alpha);
          });
        });
      }
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
    for (const row of containerEl.querySelectorAll(".bysan-theme-setting-item")) {
      row.classList.toggle("bysan-setting-filtered", Boolean(normalized)
        && !String(row.dataset.bysanSearch || "").includes(normalized));
    }
  }
}


module.exports = { ThemeControls };
