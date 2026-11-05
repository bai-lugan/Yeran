# 页然 · Yeran 1.0.10 本地修复版

本版尚未上传 GitHub。运行前退出旧版页然。

- 表格“…”仅保留跨页重复表头、首列作为表头、均分列宽及单元格底色。增删行列放在各自菜单；选择、排序、文字对齐和退出表格使用已有把手、工具栏或快捷键，移除重复入口。
- 左上角按钮点击选中整表，拖动移动整表或已选中的块组；支持键盘选择。长表后续页也能找到整表按钮。整表选中边框按每页正文范围绘制，不穿过页脚和页间空白。
- 正文右键改为页然编辑菜单，保留撤销、重做、剪切、复制、粘贴、纯文本粘贴和全选；图片、Mermaid、整表等提供相应块操作。去掉 WebView2 的 Emoji、Writing direction 和 More tools。代码“全选”仅选择当前代码；复制不会插入副本。
- 图片、Mermaid、整表与代码块提供明确的靠左、居中、靠右按钮，尺寸和位置随文稿保存，适用于打印。表格整体位置与单元格文字对齐各自独立。修复未显式居中的图片仍被默认样式居中的问题。
- 框选只从正文栏左右外侧空白启动；正文栏内部，包括行尾和段落间空白，拖动只选择文字。保留外侧框选、多块拖动和 Esc 清理。
- 修复拖影用悬停色覆盖单元格原底色；纯文本右键剪切/粘贴保留原有文本与换行处理。

普通代码块分页逻辑未改变。表格本轮修复针对选区边框和操作入口；单个单元格内容高于整页的既有排版限制仍需后续处理。

## Yeran 1.0.10 local fix

Not published on GitHub. Quit older Yeran processes before launching this build.

- Reduce the table More menu to repeated headers, first-column headers, equal column widths and cell backgrounds. Keep row/column operations in their own menus and use existing grips, toolbar controls and shortcuts for selection, movement, alignment and leaving a table.
- The corner button selects the entire table; dragging moves the table or selected group. Keep it reachable on later pages. Draw table selection frames within each page body, clear of footers and gaps.
- Replace the document's WebView2 context menu with editor actions and relevant object actions. Code Select all stays local; Copy writes to the clipboard without duplication.
- Provide explicit left, center and right placement for images, Mermaid, tables and code, including saved round trips and printing. Object placement is separate from cell text alignment.
- Start block marquee selection only outside the text column's left/right edges. Dragging inside the column, including line ends and paragraph gaps, selects text.
- Preserve cell background colors in drag previews and the existing plain-text newline handling in context-menu clipboard actions.

Ordinary code pagination is unchanged. This table fix covers selection frames and controls; the existing limitation for a single cell taller than a whole page remains.
