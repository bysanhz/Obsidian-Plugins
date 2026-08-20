# Obsidian Plugins by Bysan

这里收录我为科研笔记工作流编写的 Obsidian 本地插件。当前插件均以 Obsidian 1.13.x 为主要测试环境，不依赖 npm、React 或额外构建步骤。

## 插件列表

| 插件 | 版本 | 用途 |
| --- | --- | --- |
| [Academic Heading Numbering](./academic-heading-numbering/) | 0.4.1 | 为 Live Preview、阅读视图、Outline 和 PDF 提供统一的学术标题编号 |
| [Mermaid Inline Resizer](./mermaid-inline-resizer/) | 0.11.1 | 在编辑视图和阅读视图中持久化调整 Mermaid、图片和表格宽度，并防止 macOS 点击控件后跳到页首 |
| [Selection Review Toolbar](./selection-review-toolbar/) | 0.1.1 | 选中文字后显示浮动审阅工具栏，支持格式、颜色、评论与源码模式切换 |
| [Bysan Style Controller](./bysan-style-controller/) | 0.8.1 | 独立提供 Bysan 基础主题、中英文界面、集成式搜索导航、双模式配色、逐项颜色恢复及低闪烁的 478 项完整原生主题控件 |

## 安装

1. 下载需要的插件目录。
2. 将整个目录复制到 Vault 的 `.obsidian/plugins/` 下。
3. 重启 Obsidian，或在“第三方插件”页面重新加载插件。
4. 启用对应插件。

例如：

```text
YourVault/
└── .obsidian/
    └── plugins/
        └── selection-review-toolbar/
            ├── manifest.json
            ├── main.js
            └── styles.css
```

## 兼容性说明

- 主要面向 Obsidian Desktop 1.13.x。
- 插件之间已经在同一 Vault 中进行组合测试。
- `Bysan Style Controller` 内置 MIT 许可的 Blue Topaz 基础 CSS，但不依赖外部主题或 Style Settings；仍不接管标题、公式或媒体宽度。
- `Selection Review Toolbar` 会避开 fenced code、Mermaid、块公式和行内代码/公式选区。
- 所有持久化格式均写入 Markdown 或 HTML class，不依赖插件内存状态。

## 作者

Bysan
