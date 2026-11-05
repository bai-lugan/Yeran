# 页然 · Yeran 1.0.2（本地测试版）

尚未发布到 GitHub。公开下载仍为 1.0.1。

- 修复顶部空白区出现无效块把手：只为真实文档节点提供操作，分页占位、页眉页脚与分页符不再借用相邻块的把手。正文与代码块仍可移动、复制和删除。
- 修复表格中“换行后以行内代码开头”的光标消失，以及由分页装饰错误继承代码格式造成的额外空行。覆盖分页、连续模式与混排。
- 新增 Mermaid：输入 `/mermaid`，或使用语言为 `mermaid` 的围栏代码块。点击图表或“编辑图表”修改源码；支持撤销、重做、三语界面、浅色与深色显示。
- 流程图、时序图、类图、状态图、ER 图、甘特图和饼图已验证。使用本地按需加载的 Mermaid Tiny 12.2.0；轻量版本不包含 mindmap、architecture、ELK 和图表内 KaTeX。普通文稿不加载该运行库，图表不依赖 CDN。
- 预览、打印与 PDF 等待图表完成，使用 SVG 图形；编辑中的源码不会进入打印，输出后恢复源码编辑状态。
- 修复整段替换代码时，浏览器移除 `<code>` 容器导致画面文字与保存内容不一致的问题。

Mermaid 源码按标准 Markdown 围栏保存；外部 HTML 和图表点击链接不启用。页然自身仍为 MIT，第三方声明保留上游许可。

## English

Local test build; not published on GitHub. Public downloads remain at 1.0.1.

Fixes invalid handles on page furniture and missing line-start carets in table cells containing inline code. Adds locally loaded Mermaid diagrams through `/mermaid` and fenced code blocks. Diagram source supports editing and undo/redo; print previews and PDFs wait for the SVG render and omit the source editor. Also fixes full code replacement not reaching the saved document.

The Tiny runtime omits mindmaps, architecture diagrams, ELK and embedded KaTeX. Common flow, sequence, class, state, ER, Gantt and pie diagrams are covered by regression checks.
