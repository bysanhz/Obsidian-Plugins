# Selection Review Toolbar

面向科研笔记和文档审阅的 Obsidian 浮动选区工具栏。只有在编辑视图中真正选中文字时才会出现，不占用顶部栏或侧边栏。

## 功能

- Bold：`**text**`
- Italic：`*text*`
- Underline：`<u>text</u>`
- Strikethrough：`~~text~~`
- 8 色高亮：`<mark class="art-hl-red">text</mark>`
- 8 色字体：`<span class="art-text-blue">text</span>`
- 4 个用户颜色槽：左侧编号色块用于应用，右侧颜色选择器用于修改；自定义颜色同时支持高亮和字体颜色并在重启后保留。
- 评论角标：正文仅保留 `%% BYSAN-REVIEW:id %%` 定位标记，评论正文由插件按 ID 管理。
- 点击角标打开独立评论窗；窗口支持拖拽位置、拖动右下角调整大小，并记忆尺寸与位置。
- 评论窗左侧书写 Markdown/LaTeX，右侧即时预览；支持 `$...$`、`$$...$$` 及 Obsidian Markdown。
- `Ctrl/⌘ + Enter` 保存，已有评论可继续编辑或删除。
- 旧版 `%% REVIEW: comment %%` 会继续显示角标，保存时自动迁移到新版格式。
- 快速切换 Live Preview / Source Mode
- 加粗、斜体、下划线和删除线均为 Toggle 操作。
- 更换颜色时替换现有同类 wrapper，不会无限嵌套。
- 颜色面板支持清除颜色。
- 鼠标与键盘选区均支持。
- 点击正文、按 Esc、切换文件或切换视图时关闭。

## 选区安全

工具栏在选区变化时缓存 Obsidian Editor 的 `from`、`to` 和文本。按钮在 `pointerdown` / `mousedown` 阶段阻止抢焦点，格式化时不依赖已经可能消失的 DOM Selection。

每次格式化和角标插入使用一个 Editor transaction，因此一次 `Ctrl+Z` 可以撤销一次正文操作。评论正文不会展开写入笔记，避免 Markdown 和公式内容干扰正文结构。

评论正文保存在插件的 `data.json` 中；笔记中的短 ID 标记负责定位。复制笔记到另一 Vault 时，如需保留评论正文，应同时复制本插件的 `data.json`。

以下区域不会显示普通审阅工具栏：

- fenced code block
- Mermaid fenced block
- `$$...$$` 块公式
- 行内代码
- 行内公式
- Reading View

## 颜色

固定颜色集中定义在 `styles.css`：

| 名称 | CSS 变量 | 默认色值 |
| --- | --- | --- |
| 黄色 | `--art-yellow` | `#FFCC00` |
| 红色 | `--art-red` | `#FF5B5F` |
| 绿色 | `--art-green` | `#49AA35` |
| 蓝色 | `--art-blue` | `#2D9ED3` |
| 紫色 | `--art-purple` | `#9681DB` |
| 粉紫 | `--art-magenta` | `#CB57D9` |
| 橙色 | `--art-orange` | `#F39A32` |
| 灰色 | `--art-gray` | `#9E9E9E` |

## 安装

将本目录复制到：

```text
YourVault/.obsidian/plugins/selection-review-toolbar/
```

然后在 Obsidian 的第三方插件设置中启用 `Selection Review Toolbar`。

如果同时启用了其他 selection popup toolbar，建议只保留一个，避免浮层重叠。

## 已验证环境

- Obsidian Desktop 1.13.7
- Live Preview
- Source Mode
- 与 Academic Heading Numbering、Equation Citator、Mermaid Inline Resizer 同时启用

## 当前版本

0.2.1

## 作者

Bysan
