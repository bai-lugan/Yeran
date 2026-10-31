import Paragraph from '@tiptap/extension-paragraph'
import Heading from '@tiptap/extension-heading'
import type { JSONContent } from '@tiptap/core'

function tokenizer(type: 'paragraph' | 'heading') {
  return { name: `yeranAligned${type}`, level: 'block' as const, start: (src: string) => src.indexOf('<!-- yeran:align='), tokenize(src: string, _tokens: unknown, lexer: { blockTokens: (src: string) => any[] }) {
    const comment = /^<!-- yeran:align=(left|center|right|justify) -->\s*\n/.exec(src)
    if (!comment) return
    const body = src.slice(comment[0].length), first = lexer.blockTokens(body)[0]
    if (first?.type !== type) return
    return { ...first, raw: comment[0] + first.raw, yeranAlign: comment[1] }
  } }
}
function aligned(node: JSONContent, markdown: string) { return node.attrs?.textAlign && node.attrs.textAlign !== 'left' ? `<!-- yeran:align=${node.attrs.textAlign} -->\n\n${markdown}` : markdown }
export const YeranParagraph = Paragraph.extend({
  markdownTokenizer: tokenizer('paragraph'),
  parseMarkdown(token, helpers) { const node = this.parent!(token, helpers) as JSONContent; return token.yeranAlign ? { ...node, attrs: { ...node.attrs, textAlign: token.yeranAlign } } : node },
  renderMarkdown(node, helpers, context) { return aligned(node, this.parent!(node, helpers, context)) },
})
export const YeranHeading = Heading.extend({
  markdownTokenizer: tokenizer('heading'),
  parseMarkdown(token, helpers) { const node = this.parent!(token, helpers) as JSONContent; return token.yeranAlign ? { ...node, attrs: { ...node.attrs, textAlign: token.yeranAlign } } : node },
  renderMarkdown(node, helpers, context) { return aligned(node, this.parent!(node, helpers, context)) },
}).configure({ levels: [1,2,3,4,5,6] })
