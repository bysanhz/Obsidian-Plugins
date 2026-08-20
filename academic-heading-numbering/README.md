# Academic Heading Numbering

为学术型 Markdown 笔记提供稳定、统一且不改写正文的虚拟标题编号。

## 功能

- Live Preview 使用 CodeMirror 6 Decoration Widget 显示编号。
- 阅读视图和 PDF 使用同一标题模型注入显示编号。
- Outline 使用完整标题路径匹配，保持层级编号一致。
- 支持标题中的链接、强调、HTML 和行内 LaTeX。
- 提供“清除当前文档标题中的已有编号”命令，操作可撤销。
- 不修改 Markdown 标题正文、锚点或标题文本节点。

## 安装

将本目录复制到：

```text
YourVault/.obsidian/plugins/academic-heading-numbering/
```

然后在 Obsidian 的第三方插件设置中启用 `Academic Heading Numbering`。

## 文件

- `manifest.json`：插件清单。
- `main.js`：标题解析、CodeMirror 装饰、Outline 与阅读视图逻辑。
- `styles.css`：编号显示样式。

## 当前版本

0.4.1

## 作者

Bysan
