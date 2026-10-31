# 页然 · Yeran

[简体中文](README.md) | [English](README.en.md)

**所见即所得的 Markdown 分页编辑器**

像 Word 一样排版，像 Typora 一样写作。

Windows 本地 Markdown 编辑器。在渲染后的文字中直接编辑，实时查看 A4 分页，打印并导出可选择文字的 PDF。

## 下载与运行

**v1.0.0 · Windows x64**

[下载安装包](https://github.com/bai-lugan/Yeran/releases/download/v1.0.0/Yeran_1.0.0_x64-setup.exe) · [下载便携包](https://github.com/bai-lugan/Yeran/releases/download/v1.0.0/Yeran-1.0-portable.zip) · [完整 Release 与校验值](https://github.com/bai-lugan/Yeran/releases/tag/v1.0.0)

运行需要 WebView2 Runtime；PDF 导出使用本机 Microsoft Edge 或 Chrome。日常运行无需 Node.js、Rust 或开发服务器。便携包解压后运行 `Yeran-1.0.exe`，保留随包的许可文件。升级前先退出旧版。

也可以运行 `Start-Yeran.ps1`。升级时会自动沿用旧版保存的草稿、页面设置和文件历史。

## Windows 安装与图片保存

- **便携版**：`Yeran-1.0.exe` 可直接运行，需要本机 WebView2 Runtime；PDF 导出另需 Edge/Chrome。不需要 Node.js 或 Rust。
- **安装版**：`Yeran_1.0.0_x64-setup.exe` 提供快捷方式、卸载和文件类型注册；缺少 WebView2 时联网下载安装。日常 Windows 使用建议安装版，测试或携带可用便携版。[Tauri 安装说明](https://v2.tauri.app/distribute/windows-installer/)
- 注册 `.md`、`.markdown`、`.txt`、`.textpack`、`.tetpack` 的打开方式。Windows 默认应用仍由用户选择，可在“设置 → 应用 → 默认应用”设置。再次打开文件会进入现有窗口的标签，未保存稿继续保留；TextBundle 文件夹通过应用菜单或文件树打开。[Windows 默认应用说明](https://support.microsoft.com/en-us/windows/apps/change-default-apps-in-windows)
- 新文稿默认 MD。插入图片后先作为草稿保留，保存时可选择 **MD＋同名图片目录** 或 **TextPack 单文件**；取消保存不写图片目录、不切换格式。已保存 MD 新增图片后，也会在下一次手动保存时提供格式选择。
- 保存 MD 会生成类似 `文稿.assets/哈希.png` 的相对图片路径，同样内容复用文件；发送文稿时需要同时携带图片目录。新草稿中手写的相对链接按目标目录解释；网络图片继续使用原链接。
- 选择 TextPack 会生成真正包含正文和图片的压缩包，当前标签切换到新文件；原 MD 和图片目录保留。通过标签右键“另存为”可双向转换，转换回 MD 或换目录时复制所需图片；后续 Ctrl+S 按当前格式保存。
- 草稿、最近文件和偏好位于本机 WebView2 数据区；文件历史在 `%APPDATA%\com.yeran.editor\history-v1`。这些不随 MD/TextPack 自动传送。卸载时选择删除应用数据会删除这些本机数据，已另存的文稿仍在原位置。

## 功能

- 直接编辑渲染后的文字，支持六级标题、列表、待办、引用、图片、代码块、行内/块级 LaTeX 公式、脚注、自动目录、提示块和折叠块。
- 连续模式与 A4 分页随时切换，保留内容、撤销与分页设置；连续写作时打印同样生成 A4 分页。
- 写作模式菜单提供专注模式（F8）和打字机模式（F9），可独立组合；前者突出当前段落或内容块，后者居中输入行。模式只影响编辑视图，打印与 PDF 保持全文正常显示。
- 打开、编辑和保存 TextPack / TextBundle，把图片和 Markdown 一起携带。打开旁的下拉菜单提供目录打开和打包导出。
- A4 实时分页、手动分页、跨页重复表头。在页面设置中选择“指定页面 → 本页方向”，可逐页混排横向与纵向。
- 编辑区的 A4 分页就是唯一预览，不再有第二个预览窗口。打印（Ctrl+P）与导出 PDF 都直接使用这份冻结快照，两者排版一致；PDF 保留每页方向、可选择文字和公式字体。
- `/` 插入菜单，支持搜索和键盘选择。文字格式包括粗体、斜体、删除线、下划线、高亮、行内代码、上下标、链接和段落对齐。
- 表格支持单元格编辑、选区、行列操作、列宽拖动、整行拖动排序和 Excel 粘贴。
- 鼠标进入任意单元格时显示当前行/列把手（共用同一六点样式）。拖动行或列时，完整内容与网格跟随指针，落点线指示位置；列宽随列移动，拖到视区边缘自动滚动。
- 多文稿标签、独立撤销与选区、关闭其他标签、全部保存。
- 查找与替换、版本历史、外部修改检测与重载。重载前可把未保存内容保留到另一个标签。
- 简体中文、繁體中文、English 界面切换，不会翻译文稿或文件名。

表格内 Shift+点击选择多个单元格，Delete / Backspace 清空选区。点击行侧把手选择整行后可删除、拖动排序，或用 Alt+↑↓ 移动。表头固定在首行。选择整张表后 Delete / Backspace 删除表格，Ctrl+Z 撤销。Tab / Shift+Tab 在单元格间移动，末格 Tab 新增行，Ctrl+Enter 移到表格后。复杂合并表格不提供行拖动。

公式使用 `$…$` 或 `$$` 块，点击公式修改 LaTeX。折叠块以 `<details>` 保存，打印时展开全部正文。查找会展开匹配文字所在的折叠块。代码高亮按实际语言加载，避免启动时加载全部语言。

## 1.0 文件管理

- **文件重命名**：左侧“已打开文件”和目录树中的文件可按 F2，或右键选择“重命名”。顶部标签右键也提供同一入口；编辑区按 F2 重命名当前文稿。行内输入默认选中主文件名，Enter 提交、Esc 取消；重名、非法名称和外部修改会保留输入并显示原因。
- **新建文件**：两处文件列表均提供右键新建。已保存文稿在同目录创建，目录树的文件在同目录创建、文件夹在内部创建；已打开但位于工作目录之外的文稿同样支持新建同目录文件。已打开文件标题旁的加号创建未命名 MD。
- 未保存新稿可先改标签名，首次保存时沿用该建议名称；不会提前写磁盘。已保存文件更名后同步标签、目录、最近文件、搜索和恢复数据，保留未保存内容、撤销、编码和相对图片路径；图片目录保持原位置，文件历史复制到新路径下，旧记录保留。
- 重命名只改文件名，不转换格式。MD 与纯文本、TextPack、TextBundle 之间的格式转换使用“另存为”；`.md` / `.markdown`、`.textpack` / `.tetpack`、文本后缀及无后缀文件可在各自类型内更名。普通文件夹暂不提供重命名。
- 磁盘重命名用于 Windows 桌面版，使用不覆盖目标的原生操作；目标已存在、被占用或已被外部修改时不会覆盖。没有新增依赖。

## 0.9 新增

- **纯文本编辑**：TXT、无后缀文件（例如 LICENSE、README）、HTML、JSON、日志、配置和脚本文件按原文打开。`#`、`**`、HTML 标签都保留为文字，不解析 Markdown、不运行 HTML 或脚本。Markdown 与 TextPack/TextBundle 保持原有编辑方式。
- 纯文本可随时切换 **A4 分页 / 连续模式**，支持打印、PDF、查找替换、多标签、历史、外部重载和可选自动保存。连续模式打印时仍生成 A4 页面；纯文本的逐页方向仅保存在本机恢复数据中。
- 逐行保留空行、缩进、Tab、行尾空格及 CRLF / LF / CR 换行，保留 UTF-8 BOM 和带 BOM 的 UTF-16 LE/BE 编码。未修改保存保持字节一致；新换行沿用文件中首个换行风格。
- 文件菜单增加“新建纯文本”；普通新建仍默认 MD。纯文本另存为可保留无后缀文件名，或保存为 TXT；改存 `.md` 时切换为 Markdown 编辑。资源管理器支持常见文本后缀和无后缀文件，继续隐藏开发缓存目录。
- 纯文本工具栏隐藏排版、图片和块插入，`/`、Tab、粘贴均作为文字。HTML 打开的是源码；此版本没有网页预览、代码补全或编码转换面板。支持 UTF-8 与带 BOM 的 UTF-16，其他编码和二进制数据会拒绝打开，避免乱码覆盖；单文件上限 20 MB，不承诺大日志性能。
- 安装包增加 TXT 打开方式注册，不强改 Windows 默认应用。无后缀文件可用应用“打开”或命令行传入。

## 0.8 新增

- 精简左侧文件管理：移除重复的“资源管理器”标题行以及定位/全部折叠按钮；当前文件仍自动高亮并展开父目录。文件夹标题右侧只保留 **新建文件、新建文件夹、刷新、在 Windows 资源管理器中打开** 四项。
- 文件夹、文件及目录空白处可右键新建。文件夹菜单在该目录内创建，文件菜单在它所在目录创建；顶端四项按钮作用于打开的根目录。“打开其他文件夹…”放在右键菜单中。
- 新建采用目录树内的名称输入框，Enter 创建、Esc 取消。文稿默认 `.md`，也可创建 `.markdown` / `.txt`；同名项目、非法 Windows 名称和写入失败保留输入，不覆盖已有文件。当前不提供重命名、移动或删除磁盘文件。
- 脚本代码高亮覆盖 Python、BAT/CMD、PowerShell、Bash/sh/Zsh，识别 `py` / `python3`、`bat` / `batch` / `cmd`、`ps1` / `pwsh`、`sh` / `zsh` 等标记。语言选择器使用可读名称，按需加载语法；高亮不会执行脚本。Bash 与 Zsh 使用同一语法规则，复杂方言不保证逐项识别。
- 修复代码块中的 `<script>` / `<iframe>` 示例在打开文稿时被误删的问题；代码作为文字保留，正文中的活动 HTML 继续过滤。打印/PDF 会等待代码高亮完成。
- 更新测试版时先退出旧版再启动新版；同一应用的单实例机制会把后续启动转回已有窗口。

## 0.7 新增

- **资源管理器**：左侧采用 VS Code 式紧凑布局，分组显示已打开文件和目录树。当前文件高亮、未保存标记、关闭标签、全部保存、刷新、全部折叠、定位当前文件；方向键导航目录，Enter 打开。大纲、最近文件和跨文件搜索仍可切换。
- **自动保存到文件**：在文件下拉菜单开启，默认关闭。首次手动保存后，停止输入约 2 秒写入当前格式，涵盖已命名标签；未命名文稿只保护恢复草稿。外部修改、删除或写入失败时暂停，保留当前内容；手动保存成功后恢复。
- 自动保存不会弹出格式选择：已有 MD 新插入的图片写到同名 `.assets` 目录，TextPack/TextBundle 保持原格式。需要换格式时手动保存或另存为；首次保存仍可选择 MD＋图片目录或单文件 TextPack。
- **图片**：点击图片后拖动四角调整尺寸，默认锁定比例，Shift 临时切换；工具栏提供比例锁定、替换图片和恢复原始尺寸。拖动松手后产生一次可撤销修改。
- **选区工具条**：选中文字后就近显示加粗、斜体、下划线、链接和颜色；与顶部文字格式菜单共用前景/背景配色。
- **表格**：列菜单可将首列设为表头；更多/行/列菜单分别给选中单元格、整行、整列设置底色。带首列表头或底色的表格以标准 HTML `<table>` 保存，保留文字格式、公式和资源链接；其他 Markdown 软件的 HTML 样式支持可能不同。

## 0.6 新增

- 文字颜色与背景高亮分别选择；Ctrl+E 切换红字＋淡红背景，再按恢复默认。颜色以内联 HTML 保存，其他 Markdown 软件可能忽略样式。
- 通用块把手支持拖动、复制、删除、上下移动，以及正文、标题、列表、待办、引用互转。当前操作顶层块，整份列表作为一个块；没有多块框选或 Notion 页面层级。
- 表格边缘 `+` 添加末尾行列；行列菜单提供复制，更多菜单可清空单元格和均分列宽。把手按下保持位置，行竖向、列横向，点击范围增大。
- 自动配对括号、引号和常用 Markdown 标记，在写作模式菜单中开关。支持成对删除、选中文字包裹；代码和组合输入避开自动配对。
- 左侧“文件”浏览文件夹、最近文件及跨文件字面量搜索；Ctrl+Shift+O 快速打开。文件树提供新建文件/文件夹，不提供重命名、移动、删除文件；搜索读磁盘中的 Markdown/文本，不搜索压缩包或未保存草稿，结果位置在源码与渲染文字间可能有差异。
- 页面设置 → 打印页眉与页脚，支持 `{title}`、`{page}`、`{pages}`、`{date}`，在打印和 PDF 中显示；可选标题 PDF 书签。设置属于本机偏好，不写入 Markdown。

## 快捷键

| 操作 | 快捷键 |
| --- | --- |
| 快速打开 | Ctrl+Shift+O |
| 红字＋淡红背景 | Ctrl+E |
| 新建 / 打开 | Ctrl+N / Ctrl+O |
| 保存 / 全部保存 | Ctrl+S / Ctrl+Shift+S |
| 另存为 | 右键标签 → 另存为… |
| 关闭 / 切换标签 | Ctrl+W / Ctrl+Tab |
| 查找 / 替换 | Ctrl+F / Ctrl+H |
| 重新加载磁盘文件 | Ctrl+R |
| 手动分页 | Ctrl+Enter（代码和表格中用于退出当前块） |
| 打印 / 导出 PDF | Ctrl+P / Ctrl+Shift+E |
| 导出 PDF | Ctrl+Shift+E |
| 加粗 / 斜体 | Ctrl+B / Ctrl+I |
| 正文 / 标题 H1–H6 | Ctrl+0 / Ctrl+1–6 |
| 专注模式 / 打字机模式 | F8 / F9 |
| 编辑链接 / 清除文字格式 | Ctrl+K / Ctrl+\ |
| 代码块 / 公式块 / 引用 / 表格 | Ctrl+Shift+K / Ctrl+Shift+M / Ctrl+Shift+Q / Ctrl+T |
| 撤销 / 重做 | Ctrl+Z / Ctrl+Shift+Z |

## 文件与兼容性

正文保存在 Markdown 中，YAML front matter 保留原文。逐页方向以可忽略的 HTML 注释保存，例如 `<!-- yeran:pages {"default":"portrait","pages":{"2":"landscape"}} -->`；段落对齐也使用 HTML 注释。其他 Markdown 阅读器通常忽略这些排版设置。

字体、字号、行距和页边距是本机排版偏好。普通 Markdown 表格的列宽随各文稿的本机恢复草稿保留；带底色或表头列的 HTML 表格同时保留其布局属性。Markdown 由文档树重新生成，空行和列表标记可能规范化，并非逐字节无损编辑器。

恢复草稿保存在本机应用数据中，不等于文件备份；文件自动保存是另一个独立开关。版本历史按文稿保留最近 30 份，约 64 MB；保存前快照失败时拒绝覆盖原文件。历史版本在新标签打开，不替换当前内容。文件被外部修改后拒绝静默覆盖。恢复后仍需 Ctrl+S 写入文件。

TextBundle/TextPack 已用官方 v2 样本验证，见 [格式兼容说明](TEXTBUNDLE_COMPATIBILITY.md)。标准压缩格式扩展名为 `.textpack`，也接受 `.tetpack` 读取别名。桌面目录保存通过暂存后替换，浏览器目录保存逐文件写入。包限 64 MB / 1024 文件；图片打包失败时保留文稿修改。

v1.0.0 提供便携版与安装版，没有协作、知识库、自动更新、Mermaid、每页页底脚注排版或签名安装器。超高表格行及复杂 HTML 仍需人工核对打印结果。真实拼音输入法和实体打印机仍需日常实测。打印时使用 A4、100% 缩放并关闭浏览器自带页眉页脚；混排需打印驱动支持。

## 开发

技术栈：Tauri 2 / Rust + Vue 3 / TypeScript / Vite + Tiptap 3 / ProseMirror。统一方向分页基于 `tiptap-pagination-plus`；混排分页、表格网格视图与行列交互由本项目维护，公式使用 KaTeX，没有依赖付费 Tiptap Pages。

```powershell
npm ci
npm run dev
# 构建便携程序：./Build-Desktop.ps1
# 同时构建 NSIS 安装包：./Build-Desktop.ps1 -Installer
npm run check
.\Build-Desktop.ps1
```

桌面构建需要 Node.js、 Rust MSVC、Visual Studio C++ Build Tools 和 Windows SDK。构建脚本优先使用项目内 `.tools/cargo`、`.tools/rustup`，否则使用系统 Rust。产物为 `src-tauri/target/release/yeran.exe`。保留旧版应用数据标识，兼容恢复草稿与历史。首次构建无需运行许可收集脚本：精确 MPL 源码和 Rust 声明已存入 `third-party/`，随源码提供。更新依赖后再按许可核查文档重新生成。

```powershell
npm run test:browser
npm run test:workspace
npm run test:tables
npm run test:yeran
npm run test:mixed
npm run test:formats
npm run test:pdf-pages
npm run test:writing
npm run test:table-interaction
npm run test:07
npm run test:07-files
npm run test:08
npm run test:09
npm run test:10
```

若 Windows 保留了 1420 端口，浏览器验收可用 `npm run dev -- --port 4173`，再设置 `$env:YERAN_TEST_URL='http://127.0.0.1:4173'` 运行测试。便携桌面程序不需要这些端口。

原生文件操作测试使用独立 QA 标识，避免操作日常应用的恢复数据：

```powershell
npm run tauri -- build --no-bundle --config src-tauri/tauri.qa.conf.json
./scripts/Run-NativeTests.ps1
```

QA 程序与正式版的标识不同；测试会清空自己的 QA 恢复配置，并只创建临时测试文件。默认原生套件拒绝非 QA 标识。测试完成后，重新运行 `./Build-Desktop.ps1 -Installer` 构建正常标识的发布程序。

先启动开发服务器，再运行验收。测试使用独立 Edge 配置。`npm run test:pdf-pages` 校验分页快照的页脚、页码层级和 PDF 文字，需要 Python 与 pypdf；`scripts/check-yeran-pdf.py` 是另一条需要 Python 和 pypdf 的检查，校验逐页方向、文字完整性、重复表头和公式字体。桌面 IPC 验收使用临时开启的 WebView2 调试端口，正常启动不开放端口。结果见 [VALIDATION.md](VALIDATION.md)。过程截图和临时文稿不上传源码仓库。

页然自身采用 [MIT](LICENSE) 许可。许可核查见 [LICENSE_AUDIT.md](LICENSE_AUDIT.md)，功能对照见 [Typora](TYPORA_COMPARISON.md)、[Notion Markdown 编辑](NOTION_COMPARISON.md)。源码与安装包见 [GitHub 仓库](https://github.com/bai-lugan/Yeran) 和 [v1.0.0 Release](https://github.com/bai-lugan/Yeran/releases/tag/v1.0.0)。

第三方依赖许可见 [THIRD_PARTY_NOTICES.txt](release/THIRD_PARTY_NOTICES.txt)。`md-reader`、`Umo Editor` 和 `Tydora` 曾作为架构参考，本项目没有拷贝其应用源码。

**兼容性注意：** 脚注、目录、行内公式、上下标及图片尺寸已支持。引用式链接保存时转为行内链接；未使用的引用定义、任意 HTML 样式及视频嵌入不保留。脚注留在文稿定义位置。复杂文稿请先用副本验证，具体边界见功能对照清单。
