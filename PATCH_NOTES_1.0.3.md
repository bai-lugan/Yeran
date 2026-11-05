# 页然 · Yeran 1.0.3（本地测试版）

尚未上传 GitHub；公开下载仍为 1.0.1。

- 改用官方完整版 `mermaid@12.2.0`，本地打包并按需加载图表类型和布局引擎。启用 HTML 标签换行，保留中文、`<br/>`、格式文字与图内公式。新增验证 mindmap、architecture、ELK 与 KaTeX/MathML。
- 默认样式参考用户提供的图：浅蓝底、深蓝文字、圆角矩形、灰色连线和分支标签，去掉阴影。保留源码指定的菱形、圆形等图形形状，以及实线/虚线区别。
- 修复高于 A4 正文区的图表触发页数持续增长。分页中适配单页，连续模式保留完整高度；源码编辑区可滚动，不再把图表块撑过页高。
- 新增“放大图表”HTML 预览，支持缩放、实际大小、适合窗口和 Esc 关闭。预览与缩放不改变文件内容。
- 打印与 PDF 单独清理并保留图表中的 HTML 标签，不再在最终文档清理时删除 `foreignObject` 标签内容。
- 修复 Markdown 安全处理恢复代码时把 `$$` 当作字符串替换指令，导致其变成 `$` 的问题；公式源码和脚本中的美元符号保持原样。
- 用户提供的两份流程图已加入兼容性样例，第一份覆盖 15 个节点和 17 条连线，第二份覆盖虚线分支与新的配色。

Mermaid 的 HTML 标签用于图表排版；不启用脚本、嵌入网页或图表点击代码。完整版新增 ELK（EPL-2.0），随包提供许可与源码材料；页然自身 MIT 许可不变。

## English

Local test build, not published on GitHub. Replaces Mermaid Tiny with the official full package, enables HTML labels and line breaks, and validates mindmaps, architecture, ELK and embedded math. Adds a flat blue default theme and a zoomable diagram viewer.

Tall charts now fit paged layouts without runaway page creation; continuous mode retains their full height. PDF output preserves HTML labels. Literal dollar sequences in Markdown code survive opening and re-saving. The two supplied flowcharts are included as regression fixtures.
