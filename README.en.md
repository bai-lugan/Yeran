# 页然 · Yeran

[简体中文](README.md) | [English](README.en.md)

**A WYSIWYG Markdown editor with live pagination.**

**VS Code-inspired file management × Notion-inspired block editing × Typora-inspired Markdown writing.**

Edit rendered text directly and switch between continuous writing and A4 pages. Lay out like Word. Write like Typora.

## Download 2.0.0

Windows x64 · v2.0.0

| Edition | Download | Getting started |
| --- | --- | --- |
| Installer (recommended) | [Download Windows installer](https://github.com/bai-lugan/Yeran/releases/download/v2.0.0/Yeran_2.0.0_x64-setup.exe) | Install with shortcuts and file open-with registration |
| Portable | [Download portable ZIP](https://github.com/bai-lugan/Yeran/releases/download/v2.0.0/Yeran-2.0.0-portable.zip) | Extract and run `Yeran-2.0.0.exe` |

[All assets and source](https://github.com/bai-lugan/Yeran/releases/tag/v2.0.0) · [SHA-256 checksums](https://github.com/bai-lugan/Yeran/releases/download/v2.0.0/SHA256SUMS-v2.0.0.txt)

WebView2 Runtime is required; PDF export uses a locally installed Edge or Chrome. Keep the license files included in the portable package.

The [local 2.0.00 fix](PATCH_NOTES_2.0.00.md) simplifies table menus, corrects paged table selection frames, adds an editor context menu and explicit left/center/right object placement, and starts block marquee selection only outside the text column. The public downloads and feature list below still describe 2.0.0.

## What's in 2.0.0

- **File management:** folder tree, open editors, tabs and cross-file search; create files/folders from context menus and rename files with F2.
- **Direct writing:** WYSIWYG editing, slash commands, margin-based block selection and grouped dragging, toggles, tasks, text colors and highlights.
- **Markdown editing:** headings, lists, quotes, links, images, tables, full Mermaid, syntax highlighting, LaTeX math, footnotes and TOC; focus and typewriter modes.
- **Page layout:** live A4 pagination, continuous mode, mixed page orientations, manual breaks and repeated table headers; separate Print and PDF export actions.
- **Tables:** cell editing, Excel paste, whole-row/column dragging, insertion/deletion, widths and backgrounds.
- **Object layout:** resize images, Mermaid, code and whole tables, with independent left/center/right placement and an editor context menu.
- **Document protection:** find/replace, optional auto-save, recovery drafts, file history and external-change detection.

Simplified Chinese, Traditional Chinese and English interfaces are available. Choose Light, Dark or System (default) appearance.

## File formats

New documents default to Markdown. With images, choose **Markdown + an assets folder** or a **single TextPack file** when saving. TextBundle is also supported.

TXT, extensionless files and common scripts/configuration files open as literal text, with continuous/paged editing, Print and PDF export. UTF-8 and BOM-marked UTF-16 are supported. HTML opens as source text.

Windows x64 only. A single cell taller than a whole page still has pagination limitations; check print output for complex tables and HTML. Collaboration, Word/ePub export, auto-update and installer code signing are not included. See the [V2 release notes](PATCH_NOTES_2.0.0.md), [Typora comparison](TYPORA_COMPARISON.md), [Notion editing comparison](NOTION_COMPARISON.md) and [validation record](VALIDATION.md).

## Development and license

Tauri 2 / Rust + Vue 3 / TypeScript + Tiptap 3 / ProseMirror.

```powershell
npm ci
npm run dev
npm run check
./Build-Desktop.ps1 -Installer
```

Desktop builds require Node.js, Rust MSVC, Visual Studio C++ Build Tools and the Windows SDK.

Yeran's own code is [MIT licensed](LICENSE). Third-party components retain their upstream licenses. See the [license audit](LICENSE_AUDIT.md), [third-party notices](release/THIRD_PARTY_NOTICES.txt) and [TextBundle compatibility notes](TEXTBUNDLE_COMPATIBILITY.md).
