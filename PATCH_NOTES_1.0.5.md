# 页然 · Yeran 1.0.5（本地测试版）

尚未上传 GitHub；公开下载仍为 1.0.1。

- 折叠块收起时明确隐藏全部正文，包括 Mermaid 图表、源码、工具栏与尺寸把手。嵌套折叠块同样处理；打印时临时展开，完成后恢复折叠。
- Mermaid 和普通代码区的 Ctrl+A 只选中当前代码文本，连续按也不会扩展到整个块或文稿。可直接替换全部源码并撤销，周围文字保留。
- 将 Mermaid 的固定视窗缩放改成图片式尺寸调整：拖动四角等比缩放，图和外框的宽、高一起变化，后面的正文随之排版。＋、−和 Ctrl＋滚轮也调整真实尺寸，重置恢复自动适配。
- 尺寸随文稿保存、支持撤销/重做，并用于打印与 PDF。宽度写入 Mermaid 的 `%% yeran:width=…` 注释；其他 Mermaid 渲染器仍可忽略注释正常绘图。代码编辑区只显示图表源码，页然的尺寸注释由保存逻辑管理。
- 分页继续保持整图：放不下时整块移到下一页，过大尺寸限制在可用页宽和页高内。独立“放大图表”查看器仍可查看大图，不改变文稿。

## English

Local test build. Collapsing a toggle explicitly hides all diagram content and controls. Ctrl+A in a code editor selects only that code, including on repeated presses.

Mermaid now resizes like an image: corner handles keep the aspect ratio, the frame follows the graph, and following text reflows. Dimensions are undoable, saved in a Mermaid comment and used for printing. Oversized diagrams remain constrained to a whole page; the separate diagram viewer remains available for inspection.
