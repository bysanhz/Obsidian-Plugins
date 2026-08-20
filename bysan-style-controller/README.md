# Bysan Style Controller

用于独立提供 Bysan 基础主题和学术内容样式，不依赖外部 Obsidian 主题或 Style Settings。

## 功能

- 统一控制浅色、深色模式下的代码块、行内代码、表格、引用块和列表标记配色。
- 控制代码块背景透明度、行号、换行、字间距与内置代码高亮主题。
- 控制表格斑马纹和默认居中样式。
- 控制内置基础主题的浅色、深色工作区背景。
- 在主题明暗切换时自动应用对应调色板。
- 独立接管编辑视图的活动代码行背景，不依赖 Style Settings 的 body class。
- 默认浅色代码背景和表格斑马纹经过可辨识度校准，避免“变量已生效但肉眼近似白色”。
- 内置经 MIT 许可打包的 Blue Topaz 基础 CSS，并由 Bysan 覆盖层统一控制最终效果。
- 将基础主题原有的 478 个实际设置项全部转为插件原生控件，包括工作区、文件树、标签页、编辑器、标题、列表、链接、Canvas、PDF、第三方插件适配等类别。
- 支持 140 类开关、51 类样式选择、浅色/深色独立颜色与透明度、数值滑杆、CSS 文本变量和设置搜索。
- 原主题标记为命令的 5 个开关也可从 Obsidian 命令面板调用。

## 兼容边界

插件只接管视觉样式，不处理以下功能：

- 标题编号：继续由 `Academic Heading Numbering` 负责。
- 公式编号：继续由现有公式插件和 MathJax 负责。
- Mermaid、图片、表格宽度：继续由 `Mermaid Inline Resizer` 负责。
- 文字选择工具栏：继续由 `Selection Review Toolbar` 负责。

`Style Settings` 和外部 `Blue Topaz` 主题均不是依赖，可以安全卸载。基础样式始终由插件加载；所有可配置功能在插件设置中分别暴露，不再使用笼统的“内置基础主题”总开关。

## 安装

1. 将 `bysan-style-controller` 目录复制到 Vault 的 `.obsidian/plugins/`。
2. 在 Obsidian 的“第三方插件”中启用 **Bysan Style Controller**。
3. 如果此前启用了 `bysan-content-adapter.css`，请在“外观 → CSS 代码片段”中关闭它，避免同一套规则重复加载。
4. 在插件设置页调整配色和组件样式。

## 第三方许可

内置基础 CSS 来源或改编自 [Blue Topaz](https://github.com/PKM-er/Blue-Topaz_Obsidian-css)，感谢 WhyI 与 PKM-er。相关代码依据 MIT License 使用，完整声明见 `THIRD_PARTY_NOTICES.md`。

## 作者

Bysan
