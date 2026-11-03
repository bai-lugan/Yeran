import { createApp } from 'vue'
import App from './App.vue'
import './style.css'
import './theme'
import './theme.css'
// Tiptap owns DOM and undo state outside Vue. Hot-remounting shared components
// can destroy its editor while Vue retains a stale instance. Keep CSS HMR, but
// flush recovery drafts and reload JavaScript updates in development.
if(import.meta.hot)import.meta.hot.on('vite:beforeUpdate',event=>{
  if(event.updates.some(update=>update.type==='js-update')){
    (window as any).__yeran?.flushDraft()
    window.location.reload()
  }
})
createApp(App).mount('#app')
