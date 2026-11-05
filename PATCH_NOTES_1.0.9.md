# 页然 · Yeran 1.0.9 本地修复版

本版尚未上传 GitHub。运行前退出旧版页然。

- 鼠标直接进入正文左侧空白，就能唤出对应块的拖动把手和加号；不必先移到文字上。普通段落跨页时，每页均按实际文字定位把手，拖影也从当前可见位置开始。
- 修复普通文字跨页时，整块选中框覆盖页脚、页间空白和下一页上边距的问题。选中框按各页实际文字分段绘制；框选命中和拖动落点也使用这些位置。加号插入后会滚动到新块。
- 在 Mermaid 后一段的开头按 Backspace，先选中整张图，不再把正文合并到图表代码里；长按也不会顺带删图。选中后再次按 Backspace 或 Delete 仍可明确删除，并可撤销。主动进入图表代码时保持正常编辑。

本次针对普通文字跨页修复，没有改动普通代码块分页。文稿格式、正文内容与既有分页设置保持兼容；包含前版的框选清理、成组拖动和对象缩放/居中。

## Yeran 1.0.9 local fix

Not published on GitHub. Quit older Yeran processes before launching this build.

- Reveal block grips and the insert button directly from the left canvas margin. For paragraphs spanning pages, controls and drag previews follow the visible text fragment.
- Paint ordinary-text block selections separately on each page, leaving headers, footers and page gaps clear. Marquee hit testing and drop guides follow the same text geometry. Inserting below a block scrolls the new block into view.
- Backspace at the start of a paragraph after Mermaid selects the diagram instead of merging text into its source. Holding the key preserves it. A subsequent deliberate Backspace or Delete can remove the selected diagram and remains undoable; explicit source editing works normally.

This fixes ordinary-text selection across pages; ordinary code-block pagination is unchanged. Document formats and existing pagination settings remain compatible. Includes previous marquee cleanup, grouped dragging and object resizing/centering.
