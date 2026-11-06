import { Extension } from '@tiptap/core'
import type { Editor } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { closeHistory } from '@tiptap/pm/history'
import { safeMarkdown } from './document'

export function openingFence(line: string) {
  const match = /^ {0,3}(`{3,}|~{3,})([^\r\n]*)$/.exec(line)
  if (!match || match[1]![0] === '`' && match[2]!.includes('`')) return
  const info = match[2]!.trim()
  return { marker: match[1]!, language: info.split(/\s/)[0] || null }
}

// Unwrap exactly one complete outer fence. An earlier closing fence means the
// clipboard contains several Markdown blocks, rather than one code snippet.
export function fencedSnippet(source: string) {
  const all = source.replace(/\r\n?/g, '\n').replace(/^\uFEFF/, '').split('\n')
  let from = 0, to = all.length
  while (from < to && !all[from]!.trim()) from++
  while (to > from && !all[to - 1]!.trim()) to--
  const lines = all.slice(from, to)
  const fence = openingFence(lines[0] || '')
  if (!fence || lines.length < 2) return
  const end = new RegExp('^ {0,3}' + fence.marker[0] + '{' + fence.marker.length + ',}[ \t]*$')
  const close = lines.findIndex((line, index) => index > 0 && end.test(line))
  if (close !== lines.length - 1) return
  return { ...fence, text: lines.slice(1, -1).join('\n') }
}

declare module '@tiptap/core' {
  interface Storage { codeFences: { literalPaste: boolean } }
}

export const CodeFences = Extension.create({
  name: 'codeFences', priority: 11000,
  addStorage: () => ({ literalPaste: false }),
  addGlobalAttributes() { return [{ types: ['codeBlock'], attributes: { fenceMarker: { default: '```', rendered: false } } }] },
  addProseMirrorPlugins() {
    const editor = this.editor, storage = this.storage
    return [new Plugin({
      key: new PluginKey('yeranCodeFences'),
      props: {
        handleKeyDown(view, event) {
          storage.literalPaste = (event.ctrlKey || event.metaKey) && event.shiftKey && event.key.toLowerCase() === 'v'
          if (event.key !== 'Enter' || event.ctrlKey || event.metaKey || event.altKey || event.isComposing || view.composing || editor.storage.plainTextMode.enabled) return false
          const { selection } = view.state, { $from, empty } = selection
          if (event.shiftKey) {
            if ($from.parent.type.name !== 'codeBlock' || !$from.sameParent(selection.$to)) return false
            view.dispatch(view.state.tr.insertText('\n').scrollIntoView()); return true
          }
          if (!empty || $from.parentOffset !== $from.parent.content.size) return false
          const text = $from.parent.textContent
          if ($from.parent.type.name === 'paragraph') {
            const fence = openingFence(text)
            if (!fence) return false
            const pos = $from.before(), tr = closeHistory(view.state.tr)
            tr.replaceWith(pos, $from.after(), view.state.schema.nodes.codeBlock!.create({ language: fence.language, fenceMarker: fence.marker }))
            // A list item must retain its leading paragraph. ProseMirror may
            // insert that paragraph while fitting the replacement code block.
            let caret = pos + 1, found = false
            tr.doc.nodesBetween(pos, Math.min(tr.doc.content.size, $from.after() + tr.doc.content.size - view.state.doc.content.size), (node, at) => {
              if (!found && node.type.name === 'codeBlock') { caret = at + 1; found = true; return false }
            })
            tr.setSelection(TextSelection.create(tr.doc, caret)).setStoredMarks([])
            view.dispatch(tr.scrollIntoView()); return true
          }
          if ($from.parent.type.name !== 'codeBlock') return false
          const line = text.lastIndexOf('\n') + 1, marker = $from.parent.attrs.fenceMarker || '```'
          if (!new RegExp('^ {0,3}' + marker[0] + '{' + marker.length + ',}[ \t]*$').test(text.slice(line))) return false
          const pos = $from.before(), tr = closeHistory(view.state.tr)
          tr.delete($from.start() + Math.max(0, line - 1), $from.end())
          const after = pos + tr.doc.nodeAt(pos)!.nodeSize, next = tr.doc.nodeAt(after)
          if (next?.type.name !== 'paragraph' || next.content.size) tr.insert(after, view.state.schema.nodes.paragraph!.create())
          tr.setSelection(TextSelection.create(tr.doc, after + 1)).setStoredMarks([])
          view.dispatch(tr.scrollIntoView()); return true
        },
        handleDOMEvents: { blur() { storage.literalPaste = false; return false } },
      },
    })]
  },
})

export function pasteMarkdown(editor: Editor, event: ClipboardEvent) {
  const data = event.clipboardData, literal = editor.storage.codeFences.literalPaste || data?.types.includes('application/x-yeran-plain-text')
  editor.storage.codeFences.literalPaste = false
  if (!data || literal || editor.storage.plainTextMode.enabled) return false
  const text = data.getData('text/plain'), html = data.getData('text/html'), snippet = fencedSnippet(text)
  const { selection } = editor.state
  if (selection.$from.parent.type.name === 'codeBlock') {
    if (!selection.$from.sameParent(selection.$to) || !snippet) return false
    const tr = editor.state.tr.insertText(snippet.text, selection.from, selection.to), block = selection.$from.parent
    // A new/fully replaced block adopts the language; a partial paste keeps the
    // existing code language and never parses the snippet's body as Markdown/HTML.
    if (!block.content.size || selection.from === selection.$from.start() && selection.to === selection.$from.end()) tr.setNodeMarkup(selection.$from.before(), undefined, { ...block.attrs, language: snippet.language || block.attrs.language, fenceMarker: snippet.marker })
    editor.view.dispatch(tr.setMeta('paste', true).setMeta('uiEvent', 'paste').scrollIntoView()); return true
  }
  if (editor.isActive('table') || /data-pm-slice\s*=/.test(html)) return false
  const blockSyntax = /^ {0,3}(?:#{1,6}[ \t]+|[-*+][ \t]+|\d+[.)][ \t]+|>[ \t]|`{3,}|~{3,}|\$\$[ \t]*(?:\r?\n|$)|\[toc\]|\[\^|(?:-{3,}|\*{3,}|_{3,})[ \t]*$)/im
  const tableSyntax = /^ {0,3}\|?[ \t]*:?-{3,}:?[ \t]*\|(?:[ \t]*:?-{3,}:?[ \t]*\|?)*[ \t]*$/m
  const inlineSyntax = /(?:\*[^*\n]+?\*|_[^_\n]+?_|~~[^\n]+?~~|==[^\n]+?==|`[^`\n]+`|\$(?!\$)[^$\n]+\$|!?\[[^\]\n]*\]\([^\n]+\))/
  if (snippet || !html && !data.getData('vscode-editor-data') && (blockSyntax.test(text) || tableSyntax.test(text) || inlineSyntax.test(text))) {
    return editor.commands.insertContent(safeMarkdown(text), { contentType: 'markdown' })
  }
  return false
}
