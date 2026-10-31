import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface WritingPreferences { focus: boolean; typewriter: boolean }
const key = new PluginKey('yeranWritingModes')
declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    writingModes: { setWritingModes: (preferences: WritingPreferences) => ReturnType }
  }
}

/** View-only modes. No document attributes, history entries, or pagination changes. */
export const WritingModes = Extension.create<Record<string, never>, WritingPreferences>({
  name: 'writingModes',
  addStorage: () => ({ focus: false, typewriter: false }),
  addCommands() {
    return { setWritingModes: preferences => ({ tr, dispatch }) => {
      if (dispatch) { Object.assign(this.storage, preferences); tr.setMeta(key, true).setMeta('addToHistory', false) }
      return true
    } }
  },
  addProseMirrorPlugins() {
    const modes = this.storage
    return [new Plugin({
      key,
      props: {
        decorations(state) {
          if (!modes.focus) return DecorationSet.empty
          const { from, to } = state.selection, decorations: Decoration[] = []
          state.doc.forEach((node, pos) => {
            // Keep an entire selected list/table/callout readable, including its controls.
            if (node.isBlock && (pos + node.nodeSize <= from || pos >= to && pos > from)) {
              decorations.push(Decoration.node(pos, pos + node.nodeSize, { class: 'writing-muted' }))
            }
          })
          return DecorationSet.create(state.doc, decorations)
        },
      },
      view(view) {
        let frame = 0, dragging = false, destroyed = false, wasTypewriter = modes.typewriter
        let canvas: HTMLElement | null = null
        const center = () => {
          frame = 0
          if (destroyed || !canvas || !modes.typewriter || dragging || view.composing || !view.hasFocus()) return
          const selection = view.state.selection
          if (!(selection instanceof TextSelection) || !selection.empty) return
          const caret = view.coordsAtPos(selection.head), box = canvas.getBoundingClientRect()
          const delta = (caret.top + caret.bottom) / 2 - box.top - canvas.clientHeight / 2
          if (Math.abs(delta) > 2) canvas.scrollTop += delta
        }
        const schedule = () => { if (modes.typewriter && !frame) frame = requestAnimationFrame(center) }
        const down = () => { dragging = true }
        const up = () => { if (dragging) { dragging = false; schedule() } }
        const resize = new ResizeObserver(() => {
          canvas?.style.setProperty('--writing-height', `${canvas.clientHeight}px`)
          schedule()
        })
        const attach = () => { const parent = view.dom.closest<HTMLElement>('.canvas'); if (parent !== canvas) { resize.disconnect(); canvas = parent; if (canvas) { resize.observe(canvas); resize.observe(view.dom) } } }
        const initial = requestAnimationFrame(() => { attach(); schedule() })
        view.dom.addEventListener('pointerdown', down)
        window.addEventListener('pointerup', up)
        view.dom.addEventListener('compositionend', schedule)
        view.dom.addEventListener('focus', schedule)
        return {
          update(updated, previous) {
            attach()
            const changed = wasTypewriter !== modes.typewriter; wasTypewriter = modes.typewriter
            if (changed || !updated.state.selection.eq(previous.selection) || !updated.state.doc.eq(previous.doc)) schedule()
          },
          destroy() {
            destroyed = true; cancelAnimationFrame(frame); cancelAnimationFrame(initial); resize.disconnect()
            view.dom.removeEventListener('pointerdown', down)
            window.removeEventListener('pointerup', up)
            view.dom.removeEventListener('compositionend', schedule)
            view.dom.removeEventListener('focus', schedule)
          },
        }
      },
    })]
  },
})
