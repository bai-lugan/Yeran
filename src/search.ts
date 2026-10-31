import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import type { Node } from '@tiptap/pm/model'
export interface FindOptions { query: string; sensitive: boolean; wholeWord: boolean; regex: boolean; active: number }
export interface Match { from: number; to: number }
export const searchKey = new PluginKey<{ options: FindOptions; matches: Match[]; invalid: boolean }>('yeranSearch')
export const emptyOptions: FindOptions = { query: '', sensitive: false, wholeWord: false, regex: false, active: -1 }
function buildRegExp(query: string, options: Pick<FindOptions, 'sensitive' | 'wholeWord' | 'regex'>) {
  const flags = options.sensitive ? 'gu' : 'giu'
  if (options.regex) return new RegExp(options.wholeWord ? `(?<![\\w])(?:${query})(?![\\w])` : query, flags)
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(options.wholeWord ? `(?<![\\w])${escaped}(?![\\w])` : escaped, flags)
}
export function findMatches(doc: Node, query: string, options: Pick<FindOptions, 'sensitive' | 'wholeWord' | 'regex'> = { sensitive: false, wholeWord: false, regex: false }, invalid?: { value: boolean }): Match[] {
  if (!query) return []
  let regex: RegExp
  try { regex = buildRegExp(query, options) } catch { if (invalid) invalid.value = true; return [] }
  const matches: Match[] = []
  doc.descendants((node, pos) => {
    if (!node.isTextblock) return
    const text = node.textBetween(0, node.content.size, '\n', '\ufffc')
    for (const match of text.matchAll(regex)) {
      // A zero-width pattern would loop or highlight nothing useful; skip empty hits.
      if (!match[0].length) continue
      matches.push({ from: pos + 1 + match.index!, to: pos + 1 + match.index! + match[0].length })
    }
    return false
  })
  return matches
}
export const SearchHighlight = Extension.create({
  name: 'searchHighlight',
  addProseMirrorPlugins() {
    return [new Plugin<{ options: FindOptions; matches: Match[]; invalid: boolean }>({
      key: searchKey,
      state: {
        init: () => ({ options: emptyOptions, matches: [], invalid: false }),
        apply(tr, previous) {
          const options = tr.getMeta(searchKey) || previous.options
          if (options === previous.options && !tr.docChanged) return previous
          const invalid = { value: false }
          const matches = findMatches(tr.doc, options.query, options, invalid)
          return { options, matches, invalid: invalid.value }
        },
      },
      props: { decorations(state) { const found = searchKey.getState(state)!; return DecorationSet.create(state.doc, found.matches.map((match, i) => Decoration.inline(match.from, match.to, { class: i === found.options.active ? 'find-match current-find-match' : 'find-match' }))) } },
    })]
  },
})
