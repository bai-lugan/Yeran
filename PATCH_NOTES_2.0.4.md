# 页然 · Yeran 2.0.4

- 修复滚动后表格左上角按钮残留、多个按钮叠在正文上：离开视野的表格不再保留显示区域或鼠标点击区域；可见表格在悬浮、聚焦或选中时显示按钮。
- 跨页表格的按钮跟随当前操作的页，放在表格左侧正文区域，避开页眉、页脚及行把手。单击选中整表，拖动移动整表；点击不会跳回第一页。
- 整表选中时清除先前单元格的悬浮高亮，明确显示整表选框；Delete / Backspace 删除、撤销恢复保持可用。
- 文稿滚动时收起过期的行列把手、单元格悬浮高亮和表格 / 块菜单；菜单内部滚动保持正常，拖动时的自动滚动不受影响。
- 仅滚动时更新控件位置，不重复应用表格尺寸。
- 等号不再自动配对：按一次 `=` 只输入一个；表达式、网址参数和普通文本保持原样。完整输入 `==文字==` 仍可转换为高亮。
- 分开表格结构操作与后续文字编辑的撤销记录：复制行列后立即删字，再撤销只恢复文字，不会同时撤掉刚复制的行列。
- 包含 2.0.3 的中文输入法自动保存修复。

## English

- Hide offscreen table selectors so earlier tables cannot stack controls over the current reading position. Visible selectors appear on hover, focus or selection.
- Keep the selector beside the table on the page being operated on, clear of page furniture and row grips. Clicking selects the entire table without jumping to its first page; dragging moves it.
- Clear leftover cell hover styling when selecting a whole table. Delete / Backspace and undo retain whole-table behavior.
- Dismiss stale table / block menus and hover controls when scrolling the document, while preserving menu scrolling and drag autoscroll.
- Update control geometry without reapplying table dimensions on scroll. Includes the 2.0.3 IME autosave fix.
- Stop pairing single equals signs. One `=` keystroke inserts one character; complete `==text==` markup still applies highlighting.
- Separate structural table actions from subsequent cell edits in undo history, so undoing a quick text deletion does not also undo the duplicated row or column.
