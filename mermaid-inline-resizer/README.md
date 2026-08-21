# Mermaid Inline Resizer

为 Obsidian 中的 Mermaid、图片和 Markdown 表格提供不会随滚动丢失的持久化缩放控件。

## 功能

- 浮动控件：`[−] [步长] [当前宽度] [+]`。
- 步长可在 `1% / 3% / 5% / 10%` 之间循环。
- Mermaid 宽度保存为 `%% width: 72%`。
- 图片宽度保存为 `%% image-width: 85% %%`。
- 表格宽度保存为 `%% table-width: 90% %%`。
- 支持 Live Preview、阅读视图和 PDF 导出。
- 内置逐页 PDF 预览：左侧支持页码跳转与箭头翻页，右侧集中调整纸张、方向、页边距和预览缩放。
- 预览会按实际纸张内容高度重新分页，并可调用 Obsidian 原生 PDF 导出。
- Mermaid 右上角提供自有全屏按钮；弹窗支持滚轮缩放、`− / + / 100%` 控制、拖拽平移和双击复位。
- 表格缩放保持 Obsidian 原生表格 Widget，不会切回源码。
- 点击控件时保留编辑器滚动位置；在 macOS 上会从 `pointerdown` 捕获阶段提前保存滚动快照，避免 CodeMirror 先处理焦点后跳到页首。

## 安装

将本目录复制到：

```text
YourVault/.obsidian/plugins/mermaid-inline-resizer/
```

然后在 Obsidian 的第三方插件设置中启用 `Mermaid Inline Resizer`。

## 文件

- `manifest.json`：插件清单。
- `main.js`：媒体识别、缩放控件及宽度持久化。
- `styles.css`：控件、媒体与打印样式。

`data.json` 属于每个 Vault 的用户设置，不包含在仓库中。

## 当前版本

0.12.0

## 作者

Bysan
