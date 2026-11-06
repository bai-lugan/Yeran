import { ref, watch } from 'vue'
import traditionalMap from './hant-map.json'
export type Locale = 'zh-CN' | 'zh-TW' | 'en'
const KEY = 'yeran.language.v1'
let stored: string | null = null
try { stored = localStorage.getItem(KEY) } catch {}
export const locale = ref<Locale>(stored === 'en' || stored === 'zh-TW' ? stored : 'zh-CN')
watch(locale, value => { document.documentElement.lang = value; try { localStorage.setItem(KEY, value) } catch {} }, { immediate: true })
const english: Record<string,string> = {
 '表情符号':'Emoji','表情候选':'Emoji suggestions','↑ ↓ 选择 · Enter / Tab 插入':'↑ ↓ Select · Enter / Tab insert','正在加载表情…':'Loading emoji…','表情词库加载失败':'Could not load emoji data','没有匹配的表情':'No matching emoji',
 '外观主题':'Appearance','跟随系统（默认）':'System (default)','浅色':'Light','深色':'Dark',
 '重命名':'Rename','已重命名':'Renamed','新的文件名称':'New file name','Enter 重命名 · Esc 取消':'Enter to rename · Esc to cancel','新建未命名文件':'New untitled file','新建文件 · Ctrl+N':'New file · Ctrl+N','名称不能为空或以空格、点结尾。':'The name cannot be empty or end with a space or period.','更改文稿格式请使用另存为。':'Use Save As to change the document format.','磁盘重命名请使用桌面版。':'Use the desktop app to rename files on disk.','文件已在外部修改，请重新加载后再重命名。':'The file changed externally. Reload it before renaming.','正在处理文稿，请稍后重试。':'A document operation is in progress. Try again shortly.','文稿已关闭。':'The document has been closed.','目标文件已在其他标签页打开，请选择不同的名称。':'The target is open in another tab. Choose a different name.','不支持重命名符号链接。':'Renaming symbolic links is not supported.','请选择文稿文件。':'Select a document file.',
 '纯文本不生成标题大纲。':'Plain text has no heading outline.','新建纯文本':'New plain text','文稿与文本文件':'Documents and text files','文本文件':'Text files','文本文件（保留文件名）':'Text files (keep filename)','纯文本请保存为文本文件。':'Save plain text as a text file.','请选择文本类文件后缀。':'Choose a text file extension.','支持 20 MB 以内的文本文件。':'Text files up to 20 MB are supported.','文件不是支持的 UTF-8 / UTF-16 文本，未作为文本打开。':'The file is not supported UTF-8 / UTF-16 text and was not opened.','文件包含二进制数据，未作为文本打开。':'The file contains binary data and was not opened as text.','文本编码无效，原文件未覆盖。':'Invalid text encoding. The original file was not overwritten.',

  '新建文件':'New file','新建文件夹':'New folder','文件名称':'File name','文件夹名称':'Folder name','文件夹操作':'Folder actions','在 Windows 资源管理器中打开':'Open in Windows Explorer','仅桌面版支持':'Available in the desktop app','打开其他文件夹…':'Open another folder…','Enter 创建 · Esc 取消':'Enter to create · Esc to cancel','默认 .md · Enter 创建 · Esc 取消':'Defaults to .md · Enter to create · Esc to cancel','纯文本':'Plain text',
  '名称不能为空、以点开头或以空格、点结尾。':'Enter a name that does not start with a dot or end with a space or dot.','名称不能包含路径或 Windows 特殊字符。':'Names cannot contain paths or Windows special characters.','这个名称是 Windows 保留名称。':'This name is reserved by Windows.','名称过长。':'This name is too long.','新建文件支持 .md、.markdown 或 .txt。':'New files support .md, .markdown and .txt.','新建 TextBundle 请使用另存为。':'Use Save as to create a TextBundle.','文件或文件夹已存在，请换个名称。':'A file or folder with this name already exists. Choose another name.','请使用桌面版打开 Windows 文件夹。':'Use the desktop app to open this folder in Windows Explorer.',

  '选择文件夹':'Choose folder','资源管理器':'Explorer','文件视图':'File views','已打开文件':'Open editors','未打开文件夹':'No folder opened','定位当前文件':'Reveal active file','全部折叠':'Collapse folders','文件夹中没有支持的文稿':'No supported documents in this folder','先打开文件夹以搜索文稿':'Open a folder to search documents','自动保存需要写入权限，请先手动保存一次。':'Auto save needs write permission. Save manually once to continue.',
  '单元格操作':'Cell actions',
  '合并单元格的表格暂不支持拖动排序':'Dragging merged-cell tables is not supported.',
  '写作模式':'Writing modes','写作模式 · F8 / F9':'Writing modes · F8 / F9','专注模式':'Focus mode','打字机模式':'Typewriter mode','突出当前段落或内容块':'Highlight the current paragraph or block','让输入行保持在视区中部':'Keep the typing line near the center','写作模式无法保存到本机。':'Could not save writing preferences.','正在处理文稿…':'Processing document…',
  '打开的文稿':'Open documents','新建标签':'New tab','关闭标签':'Close tab','新建文稿':'New document','全部保存':'Save all','尚未保存到文件':'Unsaved changes','界面语言':'Interface language',
  '打印预览':'Print preview','预览':'Preview','导出与打印':'Export and print','打印':'Print','导出 PDF':'Export PDF','文档工具栏':'Document toolbar','切换大纲':'Toggle outline','打开 Markdown':'Open Markdown','打开':'Open','保存 Markdown':'Save Markdown','保存':'Save','保存 · Ctrl+S；右键标签可另存为':'Save · Ctrl+S; right-click a tab for Save as',
  '撤销':'Undo','重做':'Redo','段落样式':'Block style','正文':'Text','标题 1':'Heading 1','标题 2':'Heading 2','标题 3':'Heading 3','加粗':'Bold','斜体':'Italic','删除线':'Strikethrough','无序列表':'Bullet list','有序列表':'Numbered list','引用':'Quote','代码块':'Code block','插入表格':'Insert table','插入图片':'Insert image','插入图片，也可直接粘贴截图':'Insert image, or paste a screenshot',
  '查找与替换':'Find and replace','查找 Ctrl+F · 替换 Ctrl+H':'Find Ctrl+F · Replace Ctrl+H','插入分页符':'Insert page break','文件历史':'Version history','从磁盘重新加载':'Reload from disk','源码':'Source','查看与编辑 Markdown 源码':'View and edit Markdown source','页面设置':'Page settings','使用帮助':'Help','文档大纲':'Outline','添加标题后，':'Add headings to','会在这里显示文档结构。':'see your document outline here.',
  '文件已移走或删除，当前内容仍保留。保存可重建文件。':'The file was moved or deleted. Your text is retained; save to recreate the file.','文件已在外部修改，当前编辑仍保留。':'The file changed on disk. Your current edits are retained.','重新加载':'Reload','另存为':'Save as','暂时保留当前内容':'Keep current text for now','分页编辑':'Paged editing','文稿到这里，想法还可以继续。':'Keep writing. The next page is ready.',
  '草稿已保护':'Draft protected','已保存':'Saved','未保存到文件':'Not saved to a file','正在保护草稿…':'Protecting draft…','已恢复上次草稿':'Previous draft restored','尚未保存':'Unsaved','就绪':'Ready','缩小':'Zoom out','放大':'Zoom in','适合窗口':'Fit to window','点击切换到 100%':'Switch to 100%','点击适合窗口':'Fit to window','字':' words',
  '调整后，分页会自动更新。':'Pagination updates automatically.','关闭页面设置':'Close page settings','纸张方向':'Orientation','纵向 · 210 × 297 mm':'Portrait · 210 × 297 mm','横向 · 297 × 210 mm':'Landscape · 297 × 210 mm','210 × 297 mm · 纵向':'210 × 297 mm · Portrait','297 × 210 mm · 横向':'297 × 210 mm · Landscape','正文字体':'Body font','微软雅黑 / 系统黑体':'System sans serif','宋体 / 系统衬线':'System serif','字号':'Font size','行距':'Line spacing','倍':'×','四周页边距':'Page margins','页边距':'Margins','· 标准':'· Standard','恢复默认排版':'Reset page layout','跨页重复表头':'Repeat table headers',
  '关闭错误提示':'Dismiss error','标签操作':'Tab actions','保存当前标签':'Save this tab','另存为…':'Save as…','关闭此标签':'Close tab','关闭其他标签':'Close other tabs','关闭全部标签':'Close all tabs','保存后关闭文稿':'Save before closing','保存修改后再关闭？':'Save changes before closing?','份文稿尚未保存到文件。':' document(s) have unsaved changes.','份文稿':' documents','放弃修改':'Discard changes','取消':'Cancel','保存并关闭':'Save and close',
  '重新加载磁盘版本':'Reload disk version','取消重新加载':'Cancel reload','当前有未保存的修改。重新加载时，会把当前内容保留到另一个标签。':'You have unsaved edits. Reloading will retain them in a separate tab.','当前未保存稿':'Current unsaved draft','磁盘版本':'Disk version','保留草稿并重新加载':'Keep draft and reload',
  '查找内容':'Find text','查找':'Find','无匹配':'No matches','输入内容':'Type to search','区分大小写':'Match case','全字匹配':'Match whole word','使用正则表达式':'Use regular expression','无结果':'No results','正则无效':'Invalid regular expression','上一处':'Previous match','下一处':'Next match','关闭查找':'Close find','收起替换':'Hide replace','展开替换':'Show replace','替换为':'Replace with','替换':'Replace','全部替换':'Replace all','· Ctrl+Z 可撤销':'· Ctrl+Z to undo',
  '查找 / 替换':'Find / replace','快速打开 / 全部保存':'Quick open / Save all','保存 / 关闭标签':'Save / Close tab','打印 / 导出 PDF':'Print / Export PDF','加粗 / 斜体 / 标红':'Bold / Italic / Red','正文 / 标题 1–6':'Body / Heading 1-6','代码块 / 公式块 / 引用':'Code / Math / Quote block','插入表格 / 清除格式':'Insert table / Clear formatting','分页符 / 从磁盘重新加载':'Page break / Reload from disk','专注模式 / 打字机模式':'Focus / Typewriter mode',
  '关闭文件历史':'Close version history','历史版本':'Versions','历史版本内容':'Version content','正在读取版本…':'Loading version…','尚无历史版本。保存文件或持续编辑后会在这里留下版本。':'No versions yet. Save the file or continue editing to create a version.','最近 30 个版本。打开历史版本会新建标签，当前文稿继续保留。':'The latest 30 versions. Opening one creates a new tab and retains your current document.','在新标签打开此版本':'Open this version in a new tab','自动编辑快照':'Automatic edit snapshot','当前草稿':'Current draft','保存前版本':'Before save','重新加载前版本':'Before reload',
  '表格编辑':'Table editing','选择表头行':'Select header row','向下插入行':'Add row below','在当前行下方插入':'Insert below this row','行操作':'Row actions','向右插入列':'Add column right','在当前列右侧插入':'Insert right of this column','列操作':'Column actions','整列左对齐':'Align column left','整列居中':'Center column','整列右对齐':'Align column right','更多表格操作':'More table actions','更多操作，也可右键单元格':'More actions, or right-click a cell','移到表格后 · Ctrl+Enter':'Leave table · Ctrl+Enter','退出表格':'Leave table','表格操作':'Table actions','在上方插入行':'Insert row above','在下方插入行':'Insert row below','删除当前行':'Delete row','（含所选行）':' (selected rows)','在左侧插入列':'Insert column left','在右侧插入列':'Insert column right','删除当前列':'Delete column','（含所选列）':' (selected columns)','移到表格后':'Move after table','删除表格':'Delete table','选择整个表格':'Select table','选择当前行':'Select row','上移一行':'Move row up','下移一行':'Move row down','选择整个表格，Delete / Backspace 删除':'Select table; Delete / Backspace to remove','拖动调整列宽；方向键微调':'Drag to resize; arrow keys to fine-tune','点击选中整行；拖动排序；Delete 删除；Alt+↑↓ 移动':'Select row; drag to reorder; Delete to remove; Alt+↑↓ to move','选择表头行（表头固定在首行）':'Select header row (pinned first)','点击选中整列；拖动排序；Delete 删除；Alt+←→ 移动':'Select column; drag to reorder; Delete to remove; Alt+←→ to move','选择当前列':'Select column','左移一列':'Move column left','右移一列':'Move column right',
  '返回编辑':'Back to editor','上一页':'Previous page','下一页':'Next page','缩小预览':'Zoom out preview','放大预览':'Zoom in preview','A4 · 按当前文稿排版':'A4 · Current document layout','正在准备打印预览…':'Preparing print preview…','A4 打印页面':'A4 print pages',
  '插入内容':'Insert block','↑↓ 选择 · Enter 插入':'↑↓ choose · Enter insert','可插入的内容块':'Available blocks','未找到匹配的内容块。':'No matching blocks.','文稿的大标题':'Document title','划分章节':'Section heading','较小的章节标题':'Subsection heading','普通文本段落':'Plain text paragraph','按条目整理想法':'Organize ideas in a list','有顺序的步骤':'Sequential steps','突出一段引文':'Highlight a quotation','等宽字体的代码段落':'Monospaced code','表格':'Table','插入 3 × 3 表格':'Insert a 3 × 3 table','图片':'Image','从本机选择图片':'Choose a local image','分隔线':'Divider','在段落之间分隔':'Separate paragraphs','分页符':'Page break','分页符 · 下一页':'Page break · Next page',
  '关闭帮助':'Close help','直接在纸上编辑，输入 / 插入内容。':'Edit directly on the page. Type / to insert blocks.','新建 / 打开文稿':'New / Open','保存 / 全部保存':'Save / Save all','关闭标签 / 切换标签':'Close / Switch tab','打印 / 打印预览':'Print / Print preview','加粗 / 斜体':'Bold / Italic','继续写作':'Continue writing','Markdown 源码':'Markdown source','取消源码修改':'Cancel source changes','Markdown 源码内容':'Markdown source text','应用后会重新排版全文。':'Applying changes reflows the document.','应用修改':'Apply changes',
  '已取消保存，草稿仍保留':'Save cancelled; draft retained','没有待保存的修改':'No changes to save','已取消关闭，全部标签仍保留':'Close cancelled; all tabs retained','PDF 已导出':'PDF exported','已取消导出':'Export cancelled','已应用 Markdown 修改':'Markdown changes applied','历史版本已在新标签打开，原文稿保留':'Version opened in a new tab; original retained','已重新加载磁盘版本，未保存稿保留在另一个标签':'Reloaded from disk; unsaved edits retained in another tab','已重新加载磁盘版本':'Reloaded from disk','请选择图片文件。':'Choose an image file.','页面设置无法保存到本机。':'Could not save page settings.','恢复草稿保存失败。请立即按 Ctrl+S 保存到文件，避免关闭后丢失内容。':'Draft recovery could not be saved. Press Ctrl+S to save your text to a file.','单张图片请小于 5 MB，以免 Markdown 文件和恢复草稿过大。':'Choose an image smaller than 5 MB to keep documents and recovery drafts compact.',
}
Object.assign(english, {"连续模式":"Continuous mode","连续 / A4 分页切换":"Switch continuous / A4 pages","连续":"Continuous","分页":"Pages","连续编辑":"Continuous editing","不分页":"No page breaks","更多文件操作":"More file actions","打开 TextBundle 文件夹":"Open TextBundle folder","导出 TextPack":"Export TextPack","导出 TextBundle 文件夹":"Export TextBundle folder","已导出 TextBundle / TextPack":"TextBundle / TextPack exported","行内公式":"Inline equation","在文字中插入公式":"Insert an equation within text","脚注":"Footnote","插入脚注引用和说明":"Insert a footnote reference and definition","目录":"Table of contents","自动列出文稿标题":"List document headings automatically","提示块":"Callout","提示、警告或说明":"Notes, tips and warnings","行内 LaTeX 公式":"Inline LaTeX equation","添加标题后显示目录":"Headings will appear here","脚注尚无对应说明":"No definition for this footnote","行内代码":"Inline code","上标":"Superscript","下标":"Subscript","清除格式":"Clear formatting","链接地址无效":"Invalid link address","图片尺寸":"Image size","图片宽度":"Image width","图片高度":"Image height","宽":"Width","高":"Height","原始尺寸":"Original size","尺寸请输入像素数或百分比":"Enter pixels or a percentage","本地文件跳转请使用桌面版，并先保存当前文稿。":"Use the desktop app and save this document before opening local links.","不支持此链接协议。":"This link protocol is not supported.","TextPack 文件超过 64 MB。":"TextPack file exceeds 64 MB.","TextBundle 超过 64 MB 或 1024 个文件的限制。":"TextBundle exceeds 64 MB or 1,024 files.","TextPack 包含无效资源路径。":"TextPack contains an invalid resource path.","仅支持 TextBundle v1 / v2。":"Only TextBundle v1 / v2 is supported.","TextBundle info.json 不是有效 JSON。":"TextBundle info.json is not valid JSON.","未找到唯一的 TextBundle info.json。":"A unique TextBundle info.json could not be found.","TextPack 中有多个文稿或包外文件。":"TextPack contains multiple documents or files outside its bundle.","文稿素材缓存未找到，请重新打开原始 TextPack。":"Document assets are missing from recovery; reopen the original TextPack.","文件已被其他应用修改。":"The file was modified by another application.","浏览器版请导出 TextPack；TextBundle 文件夹保存请使用桌面版。":"Export TextPack in the browser; use the desktop app to save TextBundle folders."})
Object.assign(english, {
  "打印页面未能加载，请重试。":"The print document could not load. Please try again.", "打印 · Ctrl+P":"Print · Ctrl+P", "标题 4":"Heading 4", "标题 5":"Heading 5", "标题 6":"Heading 6",
  "横竖混排":"Mixed orientations", "所见即所得的 Markdown 分页编辑器":"A WYSIWYG Markdown editor with live pagination", "像 Word 一样排版，像 Typora 一样写作。":"Lay out like Word. Write like Typora.", "默认方向":"Default orientation", "指定页面":"Page", "本页方向":"This page", "跟随默认":"Use default", "纵向":"Portrait", "横向":"Landscape",
  "行": "Row",
  "列": "Column",
  "字符": " characters",
  "·": "·",
  "以及另外": "And another",
  "处理": "Processing",
  "处理中…": "Processing…",
  "未命名": "Untitled",
  "代码语言": "Code language",
  "复制代码": "Copy code",
  "已复制": "Copied",
  "复制失败，请手动选择": "Copy failed; select the text manually",
  "完成": "Done",
  "编辑公式": "Edit equation",
  "输入 LaTeX 公式": "Enter a LaTeX equation",
  "LaTeX 公式": "LaTeX equation",
  "公式块": "Equation block",
  "公式字体无法读取，请重试导出。": "Could not load equation fonts. Try exporting again.",
  "展开或折叠": "Expand or collapse",
  "折叠标题": "Toggle title",
  "折叠块": "Toggle block",
  "展开或收起一段内容": "Expand or collapse a section",
  "用 LaTeX 排版公式": "Typeset a LaTeX equation",
  "待办列表": "Checklist",
  "带复选框的事项清单": "A list of tasks with checkboxes",
  "从下一张纸继续": "Continue on the next page",
  "更多文字格式": "More text formatting",
  "文字格式": "Text formatting",
  "下划线": "Underline",
  "文字高亮": "Highlight",
  "编辑链接": "Edit link",
  "段落左对齐": "Align paragraph left",
  "段落居中": "Center paragraph",
  "段落右对齐": "Align paragraph right",
  "左对齐": "Left",
  "居中": "Center",
  "右对齐": "Right",
  "链接地址": "Link URL",
  "移除链接": "Remove link",
  "应用": "Apply",
  "请输入 https://、mailto: 或 # 开头的链接": "Enter a URL starting with https://, mailto:, tel: or #",
  "没有匹配的内容块": "No matching blocks",
  "按 Esc 继续输入": "Press Esc to keep typing",
  "↑ ↓ 选择 · Enter 插入": "↑ ↓ choose · Enter insert",
  "打印预览未能加载，请重试。": "Could not load print preview. Try again.",
  "右键标签可另存为、关闭其他或关闭全部。正文保存为 Markdown。恢复草稿保存在本机，不能替代文件备份。图片可粘贴，或从工具栏插入。": "Right-click a tab to save as or close other tabs. Documents are saved as Markdown. Local recovery drafts supplement file backups. Paste images or use the toolbar."
})
Object.assign(english, {
  "默认": "Default",
  "灰色": "Gray",
  "棕色": "Brown",
  "橙色": "Orange",
  "黄色": "Yellow",
  "绿色": "Green",
  "蓝色": "Blue",
  "紫色": "Purple",
  "粉色": "Pink",
  "红色": "Red",
  "文字颜色": "Text color",
  "背景高亮": "Background highlight",
  "红字与淡红背景": "Red text with a pale red background",
  "自动配对": "Auto pair",
  "括号、引号与 Markdown 标记": "Brackets, quotes and Markdown markers",
  "复制当前行": "Duplicate row",
  "复制当前列": "Duplicate column",
  "清空选中单元格": "Clear selected cells",
  "适合页宽": "Fit page width",
  "均分列宽并铺满页面": "Distribute columns evenly across the page",
  "在表格末尾添加行": "Add row at end of table",
  "在表格末尾添加列": "Add column at end of table",
  "块操作": "Block actions",
  "拖动块或点击打开菜单": "Drag block or click for actions",
  "复制块": "Copy block",
  "上移块": "Move block up",
  "下移块": "Move block down",
  "删除块": "Delete block",
  "转换为": "Turn into",
  "大纲": "Outline",
  "文件": "Files",
  "文件管理": "File manager",
  "打开文件夹": "Open folder",
  "刷新文件列表": "Refresh files",
  "文件树": "File tree",
  "最近文件": "Recent",
  "跨文件搜索": "Search",
  "跨文件搜索内容": "Search across files",
  "输入文字，Enter 搜索": "Type text, press Enter to search",
  "搜索": "Search",
  "搜索 Markdown / 文本文件，不区分大小写": "Search Markdown / text files, ignoring case",
  "结果已截断，请缩小搜索范围": "Some results were omitted; narrow your search",
  "正在读取文件…": "Loading files…",
  "选择写作文件夹，浏览文稿与子目录。": "Choose a folder to browse documents and subfolders.",
  "从最近列表移除": "Remove from recents",
  "尚无最近文件": "No recent files",
  "快速打开": "Quick open",
  "按文件名查找": "Find by filename",
  "搜索文件名或最近文稿…": "Search filenames or recent documents…",
  "关闭快速打开": "Close quick open",
  "文稿列表": "Documents",
  "↑↓ 选择 · Enter 打开 · Esc 关闭": "↑↓ choose · Enter open · Esc close",
  "已打开标签": "Open tab",
  "打印页眉与页脚": "Print headers and footers",
  "在打印预览、打印和 PDF 中生效": "Shown in preview, print and PDF",
  "页眉左侧": "Header left",
  "页眉右侧": "Header right",
  "页脚左侧": "Footer left",
  "页脚右侧": "Footer right",
  "从标题生成 PDF 书签": "Create PDF bookmarks from headings",
  "匹配位于源码中，可打开源码查看。": "The match is in Markdown source; open Source to view it.",
  "此浏览器不支持文件夹访问，请使用桌面版。": "Use the desktop app to access folders in this browser.",
  "请重新选择写作文件夹。": "Select the writing folder again."
})
Object.assign(english,{"保存图片：Markdown 配图片文件夹，或 TextPack 单文件":"Save images: Markdown with an assets folder, or a single TextPack file","保存文稿":"Save document"})
Object.assign(english, {
  "自动保存到文件": "Auto save to file",
  "首次手动保存后，停止输入约 2 秒自动保存。": "After the first manual save, save files about 2 seconds after typing stops.",
  "正在自动保存…": "Auto saving…",
  "已自动保存": "Auto saved",
  "自动保存已暂停，修改仍保留。请手动保存或重新加载。": "Auto save paused; edits are retained. Save manually or reload.",
  "锁定图片比例": "Lock image aspect ratio",
  "替换图片": "Replace image",
  "原图片已改变，请重新选择。": "The original image changed. Select it again.",
  "拖动调整图片尺寸": "Drag to resize image",
  "拖动等比缩放，Shift 临时切换比例锁定": "Drag to resize; Shift temporarily toggles the aspect lock",
  "选中文字工具条": "Selected text toolbar",
  "选区加粗": "Bold selection",
  "选区斜体": "Italic selection",
  "选区下划线": "Underline selection",
  "选区链接": "Selection link",
  "选区颜色与格式": "Selection colors and formatting",
  "文字颜色与背景高亮": "Text color and background highlight",
  "首列作为表头": "Header column",
  "单元格底色": "Cell background"
})
const charMap = new Map(Object.entries(traditionalMap))
Object.assign(english,{
  'Mermaid 图表':'Mermaid diagram','用代码绘制流程图与时序图':'Draw flowcharts and sequence diagrams with code',
  '编辑图表':'Edit diagram','查看图表':'View diagram','点击编辑图表':'Click to edit diagram',
  '输入 Mermaid 代码以生成图表':'Enter Mermaid code to draw a diagram',
  '图表语法有误，请检查 Mermaid 代码。':'Invalid diagram. Check the Mermaid syntax.',
  'Mermaid 图表预览':'Mermaid diagram preview','放大图表':'Zoom in diagram','缩小图表':'Zoom out diagram','实际大小':'Actual size','关闭图表预览':'Close diagram preview',
  '添加块':'Add block','在下方插入块':'Insert block below','查看缩放':'View zoom','图表缩放':'Diagram zoom','仅调整查看大小，打印仍按分页布局输出':'Zoom for viewing; printing uses the page layout.','缩小页面中的图表':'Zoom out diagram in page','放大页面中的图表':'Zoom in diagram in page','重置图表缩放':'Reset diagram zoom',
  '点击选中整表；拖动移动选中块；Delete / Backspace 删除':'Select table; drag to move selected blocks; Delete / Backspace to remove',
  '图表尺寸':'Diagram size','拖动调整图表尺寸':'Drag to resize diagram','拖动等比缩放图表':'Drag to resize diagram proportionally','拖动四角等比调整，尺寸随文稿保存并用于打印':'Drag a corner to resize proportionally. Size is saved with the document and used for printing.',
  '删除所选行':'Delete selected rows','删除所选列':'Delete selected columns','请先保存文稿或选择文件夹。':'Save the document or choose a folder first.','文件夹已移走或删除，请重新选择文件夹。':'The folder was moved or deleted. Choose a folder again.',
  '拖动缩放整个表格':'Drag to resize entire table','拖动等比缩放表格和文字':'Drag to resize the table and its contents proportionally','图片居中':'Center image','表格整体居中':'Center table block','图表居中':'Center diagram','代码块居中':'Center code block','再次点击恢复靠左':'Click again to align left','重置块尺寸':'Reset block size','块布局':'Block layout','拖动调整代码块尺寸':'Drag to resize code block','拖动等比缩放代码和文字':'Drag to resize code and text proportionally',
  '创建副本':'Duplicate','选中块操作':'Selected block actions','个块':'blocks','复制选中块':'Copy selected blocks','创建选中块副本':'Duplicate selected blocks','删除选中块':'Delete selected blocks','复制':'Copy','删除':'Delete',
  '整表居中':'Center all table cells','整表左对齐':'Align all table cells left','整表右对齐':'Align all table cells right','已复制到剪贴板':'Copied to clipboard'
})
Object.assign(english,{'图片靠左':'Align image left','图片靠右':'Align image right','图表靠左':'Align diagram left','图表靠右':'Align diagram right','表格整体靠左':'Align table block left','表格整体靠右':'Align table block right','代码块靠左':'Align code block left','代码块靠右':'Align code block right','表格设置':'Table settings','均分列宽':'Distribute columns evenly','编辑菜单':'Edit menu','剪切':'Cut','粘贴':'Paste','粘贴为纯文本':'Paste as plain text','全选':'Select all','无法访问剪贴板，请使用 Ctrl+V 粘贴。':'Clipboard access failed. Use Ctrl+V to paste.'})
function hant(value: string) { return value.replace(/文件历史/g,'檔案歷程').replace(/文件/g,'檔案').replace(/保存/g,'儲存').replace(/源码/g,'原始碼').replace(/界面/g,'介面').replace(/鼠标/g,'滑鼠').replace(/撤销/g,'復原').replace(/替换/g,'取代').replace(/打印/g,'列印').replace(/导出/g,'匯出').replace(/查找/g,'尋找').replace(/链接/g,'連結').split('').map(char=>charMap.get(char)||char).join('') }
export function t(value: unknown): string {
  const text = String(value ?? '')
  if (locale.value === 'zh-CN') return text
  const raw = text.trim(), prefix = text.slice(0,text.indexOf(raw)), suffix = text.slice(text.indexOf(raw)+raw.length)
  const dynamic: [RegExp,(match: RegExpMatchArray) => string][] = [
    [/^已保存全部 (\d+) 份文稿$/,m=>`Saved all ${m[1]} documents`], [/^已保存 (\d+) 份；剩余文稿仍保留在标签页中$/,m=>`Saved ${m[1]}; remaining documents retained in tabs`],
    [/^已替换 (\d+) 处$/,m=>`Replaced ${m[1]} match(es)`], [/^已打开 (\d+) 份文稿$/,m=>`Opened ${m[1]} documents`],
    [/^第 (\d+) 页，共 (\d+) 页$/,m=>`Page ${m[1]} of ${m[2]}`], [/^第 (\d+) 页 \/ 共 (\d+) 页$/,m=>`Page ${m[1]} of ${m[2]}`], [/^第 (\d+) 行 · 第 (\d+) 列$/,m=>`Row ${m[1]} · Column ${m[2]}`],
    [/^选择第 (\d+) 行$/,m=>`Select row ${m[1]}`], [/^调整第 (\d+) 列宽$/,m=>`Resize column ${m[1]}`], [/^选择第 (\d+) 列$/,m=>`Select column ${m[1]}`],
    [/^关闭 (.+)$/s,m=>`Close ${m[1]}`], [/^未命名 (\d+)\.(md|txt)$/,m=>`Untitled ${m[1]}.${m[2]}`], [/^已保存 (.+)$/s,m=>`Saved ${m[1]}`], [/^已打开 (.+)$/s,m=>`Opened ${m[1]}`], [/^历史 · (.+)$/s,m=>`History · ${m[1]}`], [/^保留稿 · (.+)$/s,m=>`Retained draft · ${m[1]}`],
  ]
  if (locale.value === 'zh-TW') {
    const themeLabels:Record<string,string>={'外观主题':'外觀主題','跟随系统（默认）':'跟隨系統（預設）','浅色':'淺色','深色':'深色','实际大小':'實際大小','Mermaid 图表预览':'Mermaid 圖表預覽','关闭图表预览':'關閉圖表預覽','放大图表':'放大圖表','缩小图表':'縮小圖表'}
    if(themeLabels[raw])return prefix+themeLabels[raw]+suffix
    const fileMessage = /^(关闭 |已保存 |已打开 |历史 · |保留稿 · )(.+)$/s.exec(raw)
    return prefix + (fileMessage ? hant(fileMessage[1]!) + fileMessage[2] : hant(raw)) + suffix
  }
  if (english[raw]) return prefix + english[raw] + suffix
  for (const [regex,format] of dynamic) { const match = raw.match(regex); if (match) return prefix + format(match) + suffix }
  if (raw.includes(' · Ctrl')) { const [label,...keys] = raw.split(' · '); return prefix + (english[label!] || label) + ' · ' + keys.join(' · ') + suffix }
  return text
}
