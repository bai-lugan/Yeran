# 页然 · Yeran 1.0.6（本地测试版）

尚未上传 GitHub；公开下载仍为 1.0.1。

- 修复右键“已打开文件”→“在 Windows 资源管理器中打开”出现 `os error 3`：使用文稿实际所在目录作为范围，不再依赖已打开的写作文件夹。支持单独打开的文稿以及位于写作文件夹外的文稿；目录已移走或删除时显示可读提示，保留当前内容。
- 左侧已打开文件、文件树中的文稿和最近文件新增右键“另存为…”。可保存非当前标签的未保存修改，并保留当前编辑位置；未命名文稿同样支持。对尚未打开的文件先打开，再进行另存为；取消对话框保留原文件和草稿。
- 点击表格、行或列把手选中后，顶部显示对应删除按钮；右键菜单也可删除所选行、列。Delete、Backspace 和按钮使用相同删除逻辑，支持单步撤销/重做。
- 修复整表选中后右键删除无反应，以及最后一行/列无法删除的问题。普通单元格编辑仍只删除文字，不显示结构删除按钮。

## English

Local test build. Fixes Windows Explorer actions for standalone documents and documents outside the current writing folder. Adds sidebar Save As for open editors, tree files and recent files, including inactive unsaved drafts.

Selected tables, rows and columns now expose a matching delete button. Keyboard and button deletion share undoable behavior, right-click preserves the selection, and deleting the last row or column removes the table while retaining adjacent text.
