# 页然 · Yeran 1.0.7 本地测试版

本版尚未上传 GitHub。退出旧版页然后再启动，避免单实例机制把文件交给旧进程。

- **对象缩放与居中**：图片、Mermaid、普通代码块和整张表格均可拖动四角调整尺寸。表格和代码内的文字一起等比缩放；上方提供各自的整体居中按钮，再点恢复靠左。尺寸与对齐随文稿保存，并用于打印/PDF。分页模式会限制到正文可用空间。
- **表格文字对齐**：选中整表后，“整表居中/左对齐/右对齐”作用于全部单元格。列选择仍只改变选中列。“表格整体居中”用于移动表格本身，是独立的排版操作。
- **复制与副本**：“复制块”写入剪贴板，保留文字及富文本内容，不直接插入。“创建副本”才在文稿内增加一份。
- **鼠标框选**：从正文旁的空白处按住左键拉框，可选择多个块；Ctrl+点击块把手可增减选择，Shift+点击可选择同一层级的连续块。支持一起复制、创建副本、删除、输入替换和撤销。
- **单块与成组拖动**：拖住块左侧六点把手移动；整表使用左上角表格图标。框选多个块后，拖其中任一选中块的把手，一起移动并保留顺序。支持拖入/拖出折叠块、悬停展开、落点线、拖影、边缘滚动、Escape 取消及撤销。表格行列把手继续只移动对应行或列。
- **重复表头**：“跨页重复表头”移至表格“更多操作”，可分别设置每张表；页面设置中移除该项。
- 修复删除多块后悬停位置失效引起的额外删字，以及缩放或居中后整表选区丢失的问题。打印不带选中底色、框选框和缩放把手。
- 修复连续模式生成含代码块打印快照时的初始化错误；点击代码后立即按 Ctrl+A 也会先同步当前代码选区。

带排版的图片保存为 `<img>`；带尺寸/居中的普通代码和表格保存为 HTML。Mermaid 使用 `%% yeran:width=…` / `%% yeran:align=center` 注释。未设置这些排版的普通代码、图片和简单表格继续使用常见 Markdown。其他软件可能忽略 HTML 样式和页然注释。

块选择以整份列表、引用和表格为单位，不提供 Notion 数据库、子页面或协作。Markdown 内容拖动不移动磁盘文件。单元格内部仍使用文字选区和表格行列选择。

## Yeran 1.0.7 local test build

Not published on GitHub. Quit older Yeran processes before launching this build.

- Resize and center images, Mermaid diagrams, ordinary code blocks and whole tables. Table/code text scales proportionally. Saved dimensions and alignment are used for PDF/printing, constrained to the available page body.
- Whole-table text alignment applies to every cell; column selection retains column-only alignment. Centering the table as an object is a separate action.
- **Copy block** writes rich clipboard data without inserting. **Duplicate** explicitly inserts a copy.
- Drag a marquee from blank space beside the document to select blocks. Ctrl-click grips to toggle selection; Shift-click selects siblings. Copy, duplicate, delete, replace and undo several selected blocks.
- Drag any selected block grip to move the group in order, including into/out of toggles. Whole-table dragging uses its upper-left table icon; axis grips retain row/column dragging. Drag feedback, auto-scroll, cancellation and undo are supported.
- Repeated headers are now a per-table option in **More table actions**, removed from page settings.
- Fixed stale hover positions causing an extra character deletion, and whole-table selection loss after resizing/centering. Output excludes selection and resize UI.
- Fixed code-layout initialization in continuous-mode print snapshots and synchronized code selections before fast Ctrl+A shortcuts.

Styled images use HTML `<img>`; styled code/tables use HTML. Mermaid stores dimensions/alignment in reserved `%% yeran:` comments. Unstyled blocks retain ordinary Markdown. Other renderers may ignore these layout extensions. Lists, quotes and tables remain whole blocks; this does not add Notion databases or collaboration.
