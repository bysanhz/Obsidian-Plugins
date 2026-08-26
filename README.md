# Obsidian Plugins by Bysan

这里收录我为科研笔记工作流编写的 Obsidian 本地插件。当前插件均以 Obsidian 1.13.x 为主要测试环境，不依赖 npm、React 或额外构建步骤。

## 插件列表

| 插件 | 版本 | 用途 |
| --- | --- | --- |
| [Bysan Style Controller](./bysan-style-controller/) | 0.14.0 | 统一提供按界面位置和功能对象分区的主题控制台、真实默认值、明暗配色、PDF 预览，以及可开关的标题编号、媒体缩放和选区审阅模块 |
| [Academic Heading Numbering](./academic-heading-numbering/) | 0.4.1 | 兼容回退版；功能已内置到 Style Controller |
| [Mermaid Inline Resizer](./mermaid-inline-resizer/) | 0.12.1 | 兼容回退版；功能已内置到 Style Controller |
| [Selection Review Toolbar](./selection-review-toolbar/) | 0.2.1 | 兼容回退版；功能已内置到 Style Controller |

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
- `Bysan Style Controller` 内置 MIT 许可的 Blue Topaz 基础 CSS，但不依赖外部主题或 Style Settings；标题编号、媒体宽度与选区审阅均由其可开关模块统一管理，公式编号保持独立。
- `Selection Review Toolbar` 会避开 fenced code、Mermaid、块公式和行内代码/公式选区。
- 所有持久化格式均写入 Markdown 或 HTML class，不依赖插件内存状态。

## 作者

Bysan
