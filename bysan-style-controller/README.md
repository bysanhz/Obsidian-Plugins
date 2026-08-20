# Bysan Style Controller

用于统一管理 Bysan 内容样式与当前实际使用的部分 Blue Topaz / Style Settings 外观选项。

## 功能

- 统一控制浅色、深色模式下的代码块、行内代码、表格、引用块和列表标记配色。
- 控制代码块背景透明度、行号、换行、字间距与 Blue Topaz 高亮主题。
- 控制表格斑马纹和默认居中样式。
- 控制 Blue Topaz 的浅色、深色工作区背景。
- 在主题明暗切换时自动应用对应调色板。
- 独立接管编辑视图的活动代码行背景，不依赖 Style Settings 的 body class。
- 默认浅色代码背景和表格斑马纹经过可辨识度校准，避免“变量已生效但肉眼近似白色”。

## 兼容边界

插件只接管视觉样式，不处理以下功能：

- 标题编号：继续由 `Academic Heading Numbering` 负责。
- 公式编号：继续由现有公式插件和 MathJax 负责。
- Mermaid、图片、表格宽度：继续由 `Mermaid Inline Resizer` 负责。
- 文字选择工具栏：继续由 `Selection Review Toolbar` 负责。

`Style Settings` 不是必需依赖，可以安全卸载；如果继续启用，Bysan Style Controller 只会校正已经迁移到自身设置页的 Blue Topaz class，不会清除其他 Style Settings 选项。

## 安装

1. 将 `bysan-style-controller` 目录复制到 Vault 的 `.obsidian/plugins/`。
2. 在 Obsidian 的“第三方插件”中启用 **Bysan Style Controller**。
3. 如果此前启用了 `bysan-content-adapter.css`，请在“外观 → CSS 代码片段”中关闭它，避免同一套规则重复加载。
4. 在插件设置页调整配色和组件样式。

## 作者

Bysan
