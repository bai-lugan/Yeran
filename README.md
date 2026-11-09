# 页然 · Yeran

[简体中文](README.md) | [English](README.en.md)

**所见即所得的 Markdown 分页编辑器**

**VS Code 式文件管理 × Notion 式块编辑 × Typora 式 Markdown 写作。**

在渲染后的文字中直接编辑，随时切换连续写作与 A4 分页。像 Word 一样排版，像 Typora 一样写作。

## 下载 2.0.4

Windows x64 · v2.0.4

| 版本 | 下载 | 使用方式 |
| --- | --- | --- |
| 安装版（推荐） | [下载 Windows 安装包](https://github.com/bai-lugan/Yeran/releases/download/v2.0.4/Yeran_2.0.4_x64-setup.exe) | 安装后使用，提供快捷方式与文件打开方式 |
| 便携版 | [下载便携 ZIP](https://github.com/bai-lugan/Yeran/releases/download/v2.0.4/Yeran-2.0.4-portable.zip) | 解压后运行 `Yeran-2.0.4.exe` |

[全部附件与源码](https://github.com/bai-lugan/Yeran/releases/tag/v2.0.4) · [SHA-256 校验值](https://github.com/bai-lugan/Yeran/releases/download/v2.0.4/SHA256SUMS-v2.0.4.txt)

运行需要 WebView2 Runtime；PDF 导出使用本机 Edge 或 Chrome。便携版请保留随包的许可文件。

2.0.4 修复滚动时表格按钮残留、跨页点击、撤销边界和等号重复输入，并包含中文输入法自动保存修复。[本次更新](PATCH_NOTES_2.0.4.md)

## 2.0.4 能做什么

- **管理文件**：目录树、已打开文件、多标签、跨文件搜索；右键新建文件/文件夹，F2 重命名文件。
- **直接写作**：所见即所得、`/` 插入菜单、左右外侧框选与成组拖动、折叠块、待办、文字颜色与高亮。
- **编辑 Markdown**：标题、列表、引用、链接、图片、表格、完整版 Mermaid、代码高亮、LaTeX 公式、脚注与目录；支持专注和打字机模式。
- **排版与交付**：A4 分页预览、连续模式、逐页横竖混排、手动分页、重复表头；分别提供打印和 PDF 导出。
- **操作表格**：单元格编辑与 Excel 粘贴，整行/整列拖动、增删、列宽和底色设置。
- **调整对象**：图片、Mermaid、代码块和整表可缩放，并独立设置靠左、居中、靠右；正文使用页然右键菜单。
- **保护文稿**：查找替换、可选自动保存、恢复草稿、文件历史与外部修改检测。

支持简体中文、繁體中文和 English 界面；外观可选浅色、深色或跟随系统（默认）。

## 文件格式

新文稿默认 Markdown。加入图片后，保存时可选 **MD＋图片目录** 或 **单文件 TextPack**；也支持 TextBundle。

TXT、无后缀文件和常见脚本/配置文件按纯文本编辑，同样支持连续模式、分页、打印和 PDF。支持 UTF-8 与带 BOM 的 UTF-16；HTML 以源码文字打开。

当前面向 Windows x64。单个单元格内容高于整页时仍有排版限制；复杂表格与 HTML 请核对打印结果。尚不包含协作、Word/ePub 导出、自动更新和安装包签名。详见 [V2 更新说明](PATCH_NOTES_2.0.4.md)、[Typora 对照](TYPORA_COMPARISON.md)、[Notion 编辑对照](NOTION_COMPARISON.md)及[验证记录](VALIDATION.md)。

## 开发与许可

Tauri 2 / Rust + Vue 3 / TypeScript + Tiptap 3 / ProseMirror。

```powershell
npm ci
npm run dev
npm run check
./Build-Desktop.ps1 -Installer
```

桌面构建需要 Node.js、Rust MSVC、Visual Studio C++ Build Tools 和 Windows SDK。

页然自身采用 [MIT](LICENSE) 许可；第三方组件保留原许可。见[许可核查](LICENSE_AUDIT.md)、[第三方声明](release/THIRD_PARTY_NOTICES.txt)与[TextBundle 兼容说明](TEXTBUNDLE_COMPATIBILITY.md)。
