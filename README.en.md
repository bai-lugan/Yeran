# 页然 · Yeran

[简体中文](README.md) | [English](README.en.md)

**A WYSIWYG Markdown editor with live pagination.**

Lay out like Word. Write like Typora.

Yeran is a local Windows Markdown editor. Edit rendered text directly on real A4 pages, check page breaks while writing, and produce selectable-text PDFs.

## Status and running

**v1.0.0 · Windows x64**

[Installer](https://github.com/bai-lugan/Yeran/releases/download/v1.0.0/Yeran_1.0.0_x64-setup.exe) · [Portable ZIP](https://github.com/bai-lugan/Yeran/releases/download/v1.0.0/Yeran-1.0-portable.zip) · [Release and checksums](https://github.com/bai-lugan/Yeran/releases/tag/v1.0.0)

WebView2 Runtime is required. PDF export uses a locally installed Microsoft Edge or Chrome. Normal use needs no Node.js, Rust or development server. Extract the portable ZIP and run `Yeran-1.0.exe`, retaining its license files. Exit an older version before upgrading.

## Windows installation and image saving

- **Portable EXE:** run `Yeran-1.0.exe` with WebView2 installed. PDF export also needs Edge/Chrome. Node.js and Rust are not required.
- **Installer:** `Yeran_1.0.0_x64-setup.exe` includes shortcuts, uninstall support and file-type registration. It downloads WebView2 if missing. The installer is recommended for regular Windows use; the portable build is useful for testing. [Tauri installer documentation](https://v2.tauri.app/distribute/windows-installer/)
- Registers Open With support for `.md`, `.markdown`, `.textpack` and `.tetpack`. Users choose defaults in Windows Settings. Further file launches open tabs in the existing window and retain unsaved drafts. Open TextBundle folders through the app menu or file tree. [Windows default apps](https://support.microsoft.com/en-us/windows/apps/change-default-apps-in-windows)
- New documents default to Markdown. Inserted images stay in the draft until save; choose Markdown with an adjacent assets folder or a single TextPack file. Cancelling leaves the draft and format intact. Adding images to an existing Markdown document offers the same choice on the next manual save.
- Markdown uses relative paths such as `note.assets/hash.png` and reuses identical images. Send the assets folder with the Markdown file. Handwritten relative links in a new draft refer to its destination folder; remote URLs remain links.
- TextPack conversion creates a real package containing text and images and switches the active tab to it. The original Markdown and assets remain. Right-click a tab and choose Save as to convert either way; Markdown Save As to another folder copies the images. Subsequent saves use the current format.
- Recovery, recents and preferences live in the local WebView2 profile; versions live under `%APPDATA%\com.yeran.editor\history-v1`. These do not travel with the document. Choosing to delete app data during uninstall removes this local data.

## Features

- Direct editing of rendered text: headings 1–6, lists, tasks, quotes, images, code blocks, inline/block LaTeX, footnotes, automatic TOC, callouts and collapsible sections.
- Switch between continuous writing and A4 pages at any time. Content, undo and page settings stay intact; preview and printing still generate a paginated snapshot.
- Writing modes offer **Focus (F8)** and **Typewriter (F9)** independently. Highlight the current paragraph or block, or keep the typing line centered. These are view preferences; printing and PDFs retain normal full-document visibility.
- Open, edit and save TextPack files and TextBundle folders with their image assets. The file dropdown provides folder opening and package export.
- Live A4 pagination, manual page breaks and repeated table headers. Choose a page and its orientation in Page settings to mix portrait and landscape in one document.
- The A4 pagination you are editing **is** the preview; there is no second preview window. Print (Ctrl+P) and Export PDF both consume that frozen snapshot, so the two always agree. PDFs retain individual page sizes, selectable text and embedded equation fonts.
- Searchable `/` block menu and common formatting: bold, italic, strike, underline, highlight, inline code, sub/superscript, links and paragraph alignment. Code highlighting loads languages on demand.
- Editable tables with cell selection, row/column actions, resizable columns, row drag sorting, Delete / Backspace, undo and Excel paste.
- Hover any cell for matching row/column grips with the same six-dot appearance. Drag the full row or column with its content and grid, full-axis drop guides, preserved column widths and edge auto-scrolling.
- Multiple document tabs with independent undo, selections and scroll positions; Save all and Close others.
- Find and replace, local version history, external-change detection and reload with unsaved edits preserved in another tab.
- Simplified Chinese, Traditional Chinese and English interface. Document content and filenames are not translated.

Table row handles select a row; drag to reorder, Delete / Backspace to remove, or Alt+Up/Down to move. The header remains first. Tab navigates cells and adds a row at the end; Ctrl+Enter exits a table or code block. Complex merged tables do not support row dragging.

## File management in 1.0

- **Rename files:** press F2 or use Rename in Open Editors or the file tree. The top tab context menu offers the same action; F2 in the editor targets the current document. An inline field selects the basename, Enter commits and Esc cancels. Duplicate names, invalid names and external changes keep the field open with an error.
- **New files:** both file lists offer a context action. Saved editors create a sibling, even outside the current workspace. A tree file creates a sibling and a tree folder creates a child. The Open Editors plus button creates an untitled Markdown document.
- Untitled documents can be named before saving; the first save uses that suggested name. Renaming a saved file updates tabs, the tree, recent files, search and recovery data while preserving unsaved edits, undo, encoding and relative image paths. Asset folders stay in place. History is copied to the new key; original snapshots remain available.
- Renaming does not convert formats. Use Save As to switch between Markdown, plain text, TextPack and TextBundle. Renaming within each family is supported, including `.md` / `.markdown`, `.textpack` / `.tetpack` and extensionless text. Ordinary folder renaming is not included.
- Disk renaming is available in the Windows desktop app. The native operation refuses to overwrite a target, including a concurrently created one. No new dependencies were added.

## New in 0.9

- **Plain text:** open TXT, extensionless files (such as LICENSE or README), HTML, JSON, logs, configuration and scripts literally. Markdown markers and HTML tags stay text; no HTML or scripts execute. Markdown and TextPack/TextBundle retain rich editing.
- Plain text shares **A4 pages / continuous mode**, printing, PDF export, find/replace, tabs, history, external reload and optional auto-save. Printing from continuous mode produces A4 pages. Per-page text orientation is stored locally, outside the text file.
- Preserve blank lines, indentation, tabs, trailing spaces, individual CRLF / LF / CR separators, UTF-8 BOM and BOM-marked UTF-16 LE/BE. An unchanged save preserves bytes. New lines use the first newline style found in the file.
- “New plain text” is in the file menu; normal new documents still default to Markdown. Save text with a TXT extension or no extension. Saving as `.md` switches to Markdown editing. The file tree includes common text formats and extensionless files.
- Text mode hides rich formatting and block/image controls; slash and clipboard input remain literal. HTML opens as source. This preview has no webpage preview, code completion or encoding conversion panel. UTF-8 and BOM-marked UTF-16 are supported; other encodings and binary data are rejected. The file limit is 20 MB; large-log performance is not guaranteed.
- The installer registers TXT as an available open-with option without overriding Windows defaults. Extensionless files can be opened from the app or passed on the command line.

## New in 0.8

- A leaner file sidebar removes the duplicate Explorer heading and reveal/collapse buttons. The active file still reveals automatically. The root folder has exactly four actions: **New file, New folder, Refresh, Open in Windows Explorer**.
- Right-click a folder, file or empty tree area to create items. Folder menus target that directory; file menus target the containing directory. Root toolbar actions target the opened root. Open another folder is available in the context menu.
- Enter names inline: Enter creates and Escape cancels. Files default to `.md`; `.markdown` and `.txt` are also supported. Duplicate names, invalid Windows names and write failures retain the input without overwriting existing files. Filesystem rename/move/delete are not included.
- Script highlighting covers Python, BAT/CMD, PowerShell and Bash/sh/Zsh, including `py`, `python3`, `batch`, `cmd`, `ps1` and `pwsh` labels. Readable picker labels and lazy grammar loading keep it compact. Scripts are displayed as text, never executed; Bash and Zsh share a grammar with dialect limits.
- Literal `<script>` and `<iframe>` samples inside code survive opening files; active HTML outside code remains filtered. Printing/PDF waits for syntax colors before taking its snapshot.
- Exit the previous version before launching an updated build: single-instance handling otherwise activates the existing window.

## New in 0.7

- **Explorer:** a compact VS Code-inspired sidebar with Open editors and a folder tree, active-file highlighting, dirty indicators, close/save-all actions, refresh, collapse and reveal. Use arrow keys and Enter to navigate; Outline, Recents and cross-file search remain available.
- **Auto save to file:** an optional file-menu switch, off by default. After the first manual save, named tabs save in their current format after about two idle seconds. Untitled documents retain recovery drafts. External changes, deletion or write failures pause saving and retain edits; a successful manual save resumes it.
- Auto save never opens a format picker: inserted images in an existing Markdown file go into its adjacent `.assets` folder. TextPack/TextBundle keep their format. Manual Save/Save as chooses formats; first save still offers Markdown plus assets or a single TextPack.
- **Images:** four-corner resizing, an aspect lock with a temporary Shift override, replacement and original-size reset. Releasing a drag creates one undoable change.
- **Selection toolbar:** bold, italic, underline, links and the shared foreground/background palette appear beside selected text.
- **Tables:** optional first-column headers and cell/row/column backgrounds. Styled tables save as standard HTML `<table>` with rich text, equations and portable image links. Other Markdown renderers may handle HTML styles differently.

## New in 0.6

- Choose text and background colors independently. Ctrl+E toggles red text with a pale red background; press again to restore defaults. Colors use inline HTML, which other Markdown apps may ignore.
- Top-level block grips support dragging, duplicate, delete, move up/down and conversion between text, headings, lists, tasks and quotes. A whole list is one block. Multi-block selection and workspace pages are not included.
- Table edge buttons append rows/columns; menus duplicate axes, clear cells and distribute widths. Larger grips stay in place when pressed, with vertical row and horizontal column grips.
- Optional bracket, quote and Markdown auto pairing, paired Backspace and wrapping selections. Code and composition input bypass pairing.
- Browse folders and recent files, search on-disk Markdown/text, and quick-open with Ctrl+Shift+O. New files/folders are supported; no filesystem rename/move/delete. Search excludes packages and unsaved drafts; source positions can differ from rendered matches.
- Print header/footer templates support `{title}`, `{page}`, `{pages}`, `{date}`, with optional PDF heading bookmarks. These local preferences appear in Preview, Print and PDF and are not stored in Markdown.

## Keyboard shortcuts

| Action | Shortcut |
| --- | --- |
| Quick open | Ctrl+Shift+O |
| Red text + pale red background | Ctrl+E |
| New / Open | Ctrl+N / Ctrl+O |
| Save / Save all | Ctrl+S / Ctrl+Shift+S |
| Close / Switch tab | Ctrl+W / Ctrl+Tab |
| Find / Replace | Ctrl+F / Ctrl+H |
| Reload from disk | Ctrl+R |
| Manual page break | Ctrl+Enter outside code and tables |
| Print / Export PDF | Ctrl+P / Ctrl+Shift+E |
| Export PDF | Ctrl+Shift+E |
| Bold / Italic | Ctrl+B / Ctrl+I |
| Paragraph / Heading 1–6 | Ctrl+0 / Ctrl+1–6 |
| Focus / Typewriter | F8 / F9 |
| Edit link / Clear text formatting | Ctrl+K / Ctrl+\ |
| Code / Equation / Quote / Table | Ctrl+Shift+K / Ctrl+Shift+M / Ctrl+Shift+Q / Ctrl+T |
| Undo / Redo | Ctrl+Z / Ctrl+Shift+Z |

## Files and limitations

Documents are saved as Markdown. YAML front matter is preserved. Page orientations and paragraph alignment use HTML comments that other Markdown readers can ignore. Fonts, spacing and margins are local preferences; plain Markdown table widths stay in local recovery data; styled HTML tables also retain their layout attributes.

Markdown is regenerated from the document tree and is not byte-for-byte lossless. Footnotes, automatic TOC, inline math, sub/superscript and image sizes are supported. Reference links normalize to inline links; unused definitions, arbitrary HTML styling and video embeds are not retained. Footnotes stay at their definition position rather than becoming page-bottom notes. Test complex documents on copies first.

Official v2 TextBundle and TextPack examples are used for compatibility checks. The standard extension is `.textpack`; `.tetpack` is accepted as a reading alias. Native folder saves stage the package before replacement; browser folder saves write individual files. Packages are limited to 64 MB / 1024 files. See [TextBundle compatibility](TEXTBUNDLE_COMPATIBILITY.md).

Recovery drafts are local and do not replace file backups. History retains up to 30 versions per document with an approximate 64 MB budget. A failed pre-save history snapshot prevents overwriting the original file. History opens in a new tab. External modifications are detected and stale saves are rejected.

Mermaid rendering, a theme system, Word/ePub export, collaboration, auto-update and installer code signing are not included. Very tall table rows and complex HTML need manual pagination checks. Real IME behavior and physical printing still require day-to-day testing. See the [Typora comparison](TYPORA_COMPARISON.md) and [Notion editing comparison](NOTION_COMPARISON.md).

## Development

Tauri 2 / Rust, Vue 3 / TypeScript / Vite, and Tiptap 3 / ProseMirror. Uniform pagination uses `tiptap-pagination-plus`; mixed page layouts and the table grid interactions are maintained in this project. Math rendering uses KaTeX. No paid Tiptap Pages package is used.

```powershell
npm ci
npm run dev
npm run check
.\Build-Desktop.ps1
```

Desktop builds require Node.js, Rust MSVC, Visual Studio C++ Build Tools and the Windows SDK. The output is `src-tauri/target/release/yeran.exe`. The existing application data identifier is retained for recovery/history compatibility. Exact MPL sources and Rust notices are included under `third-party/`, so the first build does not need the license collection scripts. Regenerate them after changing dependencies.

Run `npm run test:browser`, `test:workspace`, `test:tables`, `test:yeran`, `test:mixed`, `test:formats` and `test:pdf-pages` while the dev server is running. `test:pdf-pages` checks page footers, page-number layering and PDF text, and requires Python and pypdf; `scripts/check-yeran-pdf.py` is a separate optional check that requires Python and pypdf. See [VALIDATION.md](VALIDATION.md). Source and binaries are available from the [v1.0.0 release](https://github.com/bai-lugan/Yeran/releases/tag/v1.0.0).

Native file tests use a separate QA application identifier:

```powershell
npm run tauri -- build --no-bundle --config src-tauri/tauri.qa.conf.json
./scripts/Run-NativeTests.ps1
```

The default native suite rejects a non-QA identifier. It resets only its QA recovery profile and creates temporary test documents. Rebuild with `./Build-Desktop.ps1 -Installer` afterward to produce the normal application identifier.

## License

Yeran's own code is licensed under [MIT](LICENSE). Third-party components retain their original licenses. The [license audit](LICENSE_AUDIT.md) covers notices and MPL source availability. `md-reader`, `Umo Editor` and `Tydora` were architecture references; their application source was not copied into this project.
