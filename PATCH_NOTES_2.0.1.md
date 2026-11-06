# 页然 · Yeran 2.0.1

- 代码围栏输入：三个或更多反引号 / 波浪号支持语言标签，Enter 创建代码块；结束围栏后 Enter 回到正文。自动配对关闭时也可用，列表、引用、折叠正文中的光标留在实际代码内。
- 完整代码围栏粘贴：正文中解析成代码；粘入已有代码块时仅去掉一层完整外围栏，保留缩进、换行与内层围栏。代码复制按钮只复制正文。
- 明确区分普通粘贴与纯文本粘贴；TXT 原文及已有富文本块的尺寸、对齐保持兼容。
- 补查标题、列表、待办、引用、分隔线、行内格式等常用规则；差异和待补项见 [Markdown 输入规则](MARKDOWN_INPUT_RULES.md)。

## English

- Correct fence opening and closing, including language aliases, longer/nested fences and nested block caret placement. Fence shortcuts work independently of automatic pairing.
- Interpret fenced Markdown pasted into prose, or unwrap exactly one complete outer fence when pasting into an existing code block. Preserve code whitespace and literal content.
- Keep explicit plain-text paste literal and preserve rich block clipboard metadata. Code-copy buttons copy code content only.
- Document the verified input rules and remaining Typora / Notion differences.
