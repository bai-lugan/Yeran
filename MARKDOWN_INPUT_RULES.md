# Markdown 输入与粘贴规则核查

核查日期：2026-11-05。本地修复版：2.0.2。区分输入触发、粘贴解析和文件导入；能打开 Markdown 文件，并不代表输入快捷方式已经齐全。

| 规则 | Typora / Markdown | Notion 官方说明 | 页然当前行为 |
| --- | --- | --- | --- |
| 代码块开始 | 三反引号，可带语言，按 Enter | `/code` 或 Ctrl+Shift+8（Windows） | 三个或更多反引号 / 波浪号，加语言后 Enter；支持 Python、C++、C#、PowerShell 等标签，不依赖自动配对 |
| 代码块结束 | Markdown 文件使用匹配围栏 | 代码块文档主要使用块界面 | 最后一行输入匹配结束围栏并按 Enter 回到正文；四反引号内的三反引号仍是代码，Shift+Enter 保留字面量换行 |
| 整段代码粘贴 | 优先 HTML，无 HTML 时接受文本 / Markdown | 可粘进已有代码块 | 正文中解析完整围栏；已有代码块内只解开一层完整外围栏，保留内文和缩进；混合多块内容不强行解包 |
| 复制代码 | 可复制代码正文 | 代码块有 Copy 按钮 | “复制代码”只复制正文；“复制块”保留 Markdown / HTML 结构，粘入已有代码块时处理外围栏 |
| 纯文本粘贴 | Typora 的纯文本粘贴也称粘贴 Markdown 源码 | 富文本与 Markdown 各有规则 | 页然 Ctrl+Shift+V / 右键“粘贴为纯文本”保留字面量；TXT / 无后缀文本模式不解析 Markdown，语义与 Typora 此选项不同 |
| 标题 | `#` 到 `######` | `#` / `##` / `###` 加空格 | 六级标题输入加空格已验证 |
| 无序列表 | `-` / `+` / `*` | 同左，后接空格 | 已有；输入加空格、Enter 续写 |
| 有序列表 | `1.` 加空格 | 另有 `a.` / `i.` 快捷方式 | `1.` 已有；字母 / 罗马数字触发未加入 |
| 待办 | `- [ ]` / `- [x]` | `[]` 加空格 | 支持 Markdown 待办及 `[]` 快捷触发 |
| 粗体 / 斜体 / 行内代码 | `**`、`*`、反引号 | 相同常用标记 | 输入和粘贴已核查；代码块内不解析这些标记 |
| 等号与高亮 | — | — | `=` 不自动配对，按几次输入几个；完整输入 `==文字==` 仍转换为高亮，代码与纯文本保持字面量 |
| 删除线 / 下标 | 删除线 `~~text~~` | 单个 `~` 为删除线快捷标记 | 保留 `~~` 删除线与 `~` 下标，避免改变现有文稿语义 |
| 引用 / 折叠 | `>` 为引用 | `>` 加空格为折叠，双引号加空格为引用 | 保留 `>` 引用；折叠用 `/toggle` / 块菜单，不覆盖标准 Markdown 引用 |
| 分隔线 | `---` 等 | `---` | 已有并验证；YAML 元数据仍通过源码 / 文件处理 |
| 数学公式 | 行内 `$...$`；`$$` 后 Enter 创建公式块 | `/equation` 等 | 行内公式、完整公式粘贴 / 文件解析、菜单插入已有；**独立输入 `$$` 后 Enter 的快捷创建尚未实现** |
| 表格 | 可输入一行管道表头后 Enter 建表 | 简单表格由块菜单创建 | 输入由外侧竖线围住的一行表头后 Enter，生成表头＋一行空白正文，光标进入首个正文格；保留行内格式与转义竖线。Shift+Enter、代码、TXT 和现有表格内不触发 |
| Emoji 补全 | `:smile:` 等 | `:` 加名称 | 本地按需加载 1870 个 Unicode 表情；支持英文名称、常用简繁中文搜索、方向键、Enter / Tab、鼠标和 Esc；完整输入 `:smile:` 自动替换。代码、TXT、URL、时间和转义名称保持原文 |
| Ctrl+E | 产品自有快捷键 | 行内代码 | 保留用户指定的红字＋浅红底色 |

代码中的 `<script>`、Markdown 标记、制表符、反斜线保留为文字。新建 / 完整替换的代码块可采用粘贴围栏的语言；局部插入保留当前语言。页然内部富文本复制继续保留尺寸和对齐。

结束围栏退出和已有代码块内解包是页然本轮的明确产品规则，不将它们称为已实测的 Notion 行为。不承诺完全复刻两个产品的键位或块模型。

## 官方依据与验证

- [Typora Code Fences](https://support.typora.io/Code-Fences/)
- [Typora Markdown Reference](https://support.typora.io/Markdown-Reference/)
- [Typora Copy and Paste](https://support.typora.io/Copy-and-Paste/)
- [Notion keyboard shortcuts](https://www.notion.com/help/keyboard-shortcuts)
- [Notion code blocks](https://www.notion.com/help/code-blocks)
- 本地验证：`scripts/verify-21.mjs` 和 [VALIDATION.md](VALIDATION.md)。
