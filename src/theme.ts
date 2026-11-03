import { computed, ref, watch } from 'vue'

export type ThemePreference = 'system' | 'light' | 'dark'
const KEY = 'yeran.theme.v1'
function readPreference(): ThemePreference {
  try { const saved = localStorage.getItem(KEY); if (saved === 'light' || saved === 'dark') return saved } catch {}
  return 'system'
}
export const themePreference = ref<ThemePreference>(readPreference())
const media = window.matchMedia('(prefers-color-scheme: dark)')
const systemDark = ref(media.matches)
media.addEventListener('change', event => { systemDark.value = event.matches })
export const resolvedTheme = computed(() => themePreference.value === 'system' ? systemDark.value ? 'dark' : 'light' : themePreference.value)
watch(resolvedTheme, theme => { document.documentElement.dataset.theme = theme }, { immediate: true, flush: 'sync' })
watch(themePreference, async preference => {
  try { localStorage.setItem(KEY, preference) } catch { /* The current session can still change appearance. */ }
  if ('__TAURI_INTERNALS__' in window) {
    try { const { getCurrentWindow } = await import('@tauri-apps/api/window'); await getCurrentWindow().setTheme(preference === 'system' ? null : preference) } catch (error) { console.error('Unable to update native window theme', error) }
  }
}, { immediate: true })
