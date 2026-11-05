# 页然 · Yeran 1.0.4（本地测试版）

尚未上传 GitHub；公开下载仍为 1.0.1。

- 折叠块正文也有块把手，支持把 Mermaid、文字等拖入或拖出，悬停关闭的标题可自动展开。嵌套块能在各自容器内排序、复制、删除和撤销；移出最后一块时保留可继续输入的空正文。
- 块把手左侧新增“＋”，在同级下方打开可搜索的插入菜单。鼠标移向把手时保留入口，按下时固定位置；拖动时隐藏原内容，显示跟随指针的拖影和落点。
- 修复折叠块保存时正文段落和 Mermaid 围栏之间缺少空行的问题。标题 Enter 进入正文；收起时将正文光标移回可见标题；标题开头 Backspace 解开折叠并保留内部内容。
- Mermaid 正文内新增查看缩放：＋、−、重置和 Ctrl＋滚轮，范围 25%–400%。缩放只改变查看大小，可滚动查看，不修改源码、文件脏状态或分页高度。原有大图查看器继续保留。
- Mermaid 保持完整图表，当前页余量不足时整块进入下一页并允许留白；图本身过高时自动缩小以适配单页。打印和 PDF 使用完整图的适配尺寸，不沿用临时查看缩放。横向和混排也按可用页高限制。

不包含 Notion 的多块框选、自由分栏和数据库。嵌套通用把手本轮覆盖折叠块正文；列表、引用、表格继续按完整块或各自的操作入口处理。

## English

Local test build, not published on GitHub. Adds block handles inside toggles, drag in/out with hover expansion, and a searchable insertion menu beside the handle. Fixes nested Markdown serialization and keeps the caret visible when collapsing a toggle.

Mermaid gains inline view zoom without changing document content or page height. Diagrams stay whole: a block moves to the next page when space runs out, while oversized graphs shrink to fit a page. Printing restores the fitted complete diagram and then restores the viewing zoom.
