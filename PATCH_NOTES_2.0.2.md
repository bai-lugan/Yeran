# 页然 · Yeran 2.0.2

- **一行表头建表**：输入 `| 姓名 | 年龄 |` 后按 Enter，生成两列表格和一行空白正文，光标进入首个正文格。保留粗体、行内代码、转义竖线与嵌套位置；支持撤销。
- **Emoji 名称补全**：输入 `:smi` 等名称弹出候选，方向键选择，Enter / Tab 或鼠标插入，Esc 保留文字。完整输入 `:smile:` 自动变成 😄；常用表情支持简繁中文搜索。
- 1870 个 Unicode 表情的文字词库在首次使用时本地加载，不需要网络，不加载表情图片 / 字体，不新增运行依赖。保留 gemoji 的 MIT 许可。
- 代码、行内代码、TXT、URL、时间与转义别名保持原文；输入法组合输入期间不选择表情，异步词库加载不会改动后来打开的文稿。
- 修复全选文字后打开另一份文稿时，空代码块 / 空标题被自动改为正文的问题。
- 包含 2.0.1 的代码围栏输入、结束和粘贴修复。

## English

- Type a pipe-delimited header and press Enter to create a table with one empty body row. Inline formatting, escaped pipes, nested placement and undo are preserved.
- Type an emoji name after `:` to search local suggestions; use arrows, Enter / Tab or the mouse, and Escape to keep the text. Complete aliases such as `:smile:` insert Unicode emoji.
- The 1,870-entry MIT-licensed gemoji text dataset loads locally on demand. No new runtime dependencies, emoji images or bundled fonts.
- Preserve literal content in code, plain text, URLs and times. Respect IME composition and document changes during asynchronous loading.
- Preserve intentionally empty structured blocks when opening a document after selecting the previous text.
