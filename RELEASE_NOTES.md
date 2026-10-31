# 页然 · Yeran v1.0.0

所见即所得的 Markdown 分页编辑器。像 Word 一样排版，像 Typora 一样写作。

## 下载

- **Windows x64 安装包**：`Yeran_1.0.0_x64-setup.exe`，包含快捷方式、卸载与文件打开方式注册。
- **便携包**：`Yeran-1.0-portable.zip`，解压后运行 `Yeran-1.0.exe`；同时保留随包的许可材料。
- **校验文件**：`SHA256SUMS-v1.0.0.txt`。
- **MPL 组件源码**：`Yeran-1.0-third-party-sources.zip`；页然自身采用 MIT，第三方组件保留各自许可。

需要 WebView2 Runtime；导出 PDF 使用本机 Edge 或 Chrome。升级前退出旧版，已有草稿和历史会沿用。

## 功能

- 直接编辑渲染后的 Markdown，A4 分页与连续模式随时切换；支持逐页横竖混排、手动分页、重复表头、打印和独立 PDF 导出。
- 标题、列表、待办、引用、折叠块、代码高亮、公式、脚注、目录、图片、文字颜色与高亮，以及 `/` 基础块菜单。
- 表格单元格编辑、Excel 粘贴、行列选择/删除/拖动、列宽和底色。
- 多标签、查找替换、自动保存开关、恢复草稿、文件历史和外部修改检测。
- VS Code 式文件列表；已打开文件与目录树均支持 F2/右键重命名、同目录新建。重命名保留脏稿、撤销、编码、图片链接及历史，并同步最近/搜索/恢复路径。
- Markdown＋图片目录或单文件 TextPack；支持 TextBundle、TXT、无后缀文本及常见源码文本。纯文本保留空白、换行、UTF-8 或带 BOM 的 UTF-16。
- 简体中文、繁體中文、English 界面，用户文件名保持原样。

## 验证与范围

144项浏览器检查、52组相关桌面测试和5个Rust重命名测试通过；真实文件、编码、PDF及不覆盖目标的移动操作均验证。

当前面向 Windows x64。尚未提供 Mermaid、Word/ePub 导出、协作、自动更新、代码签名或普通文件夹重命名。GBK 暂不支持；Markdown 保存会规范化部分源码空白。复杂表格和 HTML 请核对打印结果；实体打印机与所有输入法尚未逐项验证。

---

## English

**Yeran v1.0.0 — a WYSIWYG Markdown editor with live A4 pagination.**

Download the Windows x64 installer or portable ZIP below. WebView2 is required; PDF export uses Edge or Chrome. Exit an older build before upgrading.

Highlights include continuous/paged editing, mixed page orientations, Print and PDF export, core Markdown blocks and math, draggable table rows/columns, tabs, find/replace, optional auto-save, history, TextPack/TextBundle, and literal TXT/extensionless text. F2 and context-menu rename/new-file actions work in Open Editors and the file tree. Simplified Chinese, Traditional Chinese and English interfaces are available.

144 browser checks, 52 relevant native checks and 5 Rust rename tests passed. Windows x64 only for this release. Mermaid, Word/ePub, collaboration, auto-update, installer code signing and ordinary folder renaming are not included. GBK is unsupported. The application is MIT; bundled third-party components keep their upstream licenses. Exact MPL sources are attached.
