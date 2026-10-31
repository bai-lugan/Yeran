import { invoke } from '@tauri-apps/api/core'
const native = '__TAURI_INTERNALS__' in window
export interface HistoryEntry { id: string; key: string; created: string; reason: string; characters: number }
interface BrowserVersion extends HistoryEntry { content: string }
// The 0.x builds stored versions under the Paperleaf name. Read the old database
// once, copy it across, and keep both so a downgrade does not lose history.
const HISTORY_DB = 'yeran-history-v1'
const LEGACY_HISTORY_DB = 'paperleaf-history-v1'
let database: Promise<IDBDatabase> | undefined
function open(name: string) {
  return new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open(name, 1)
    request.onupgradeneeded = () => { const store = request.result.createObjectStore('versions', { keyPath: 'id' }); store.createIndex('key', 'key') }
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
  })
}
async function migrateLegacyDatabase(target: IDBDatabase) {
  let legacy: IDBDatabase
  try { legacy = await open(LEGACY_HISTORY_DB) } catch { return }
  if (!legacy.objectStoreNames.contains('versions')) { legacy.close(); return }
  const versions = await new Promise<BrowserVersion[]>((resolve, reject) => {
    const request = legacy.transaction('versions').objectStore('versions').getAll()
    request.onsuccess = () => resolve(request.result); request.onerror = () => reject(request.error)
  }).catch(() => [] as BrowserVersion[])
  legacy.close()
  if (!versions.length) return
  await new Promise<void>(resolve => {
    const transaction = target.transaction('versions', 'readwrite'), store = transaction.objectStore('versions')
    for (const version of versions) store.put(version)
    transaction.oncomplete = () => resolve(); transaction.onerror = () => resolve(); transaction.onabort = () => resolve()
  })
}
function db() {
  return database ||= open(HISTORY_DB).then(async result => { await migrateLegacyDatabase(result); return result })
}
const normalize = (key: string) => key.replace(/\\/g, '/').toLowerCase()
async function browserVersions(key: string): Promise<BrowserVersion[]> {
  const database = await db()
  return new Promise((resolve, reject) => { const request = database.transaction('versions').objectStore('versions').index('key').getAll(normalize(key)); request.onsuccess = () => resolve(request.result.sort((a: BrowserVersion,b: BrowserVersion) => Number(b.created) - Number(a.created))); request.onerror = () => reject(request.error) })
}
export async function recordHistory(key: string, content: string, reason: string) {
  if (native) return invoke<void>('record_history', { key, content, reason })
  const versions = await browserVersions(key)
  if (versions[0]?.content === content) return
  const database = await db(), created = String(Date.now())
  return new Promise<void>((resolve, reject) => {
    const transaction = database.transaction('versions', 'readwrite'), store = transaction.objectStore('versions')
    store.put({ id: crypto.randomUUID(), key: normalize(key), created, reason, characters: [...content].length, content })
    let size = content.length * 2
    versions.forEach((version, i) => { size += version.content.length * 2; if (i >= 29 || i > 0 && size > 64 * 1024 * 1024) store.delete(version.id) })
    transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error || new Error('历史记录写入失败'))
  })
}
export async function listHistory(keys: string[]): Promise<HistoryEntry[]> {
  const entries = await Promise.all(keys.map(async key => native ? (await invoke<Omit<HistoryEntry,'key'>[]>('list_history', { key })).map(entry => ({ ...entry, key })) : (await browserVersions(key)).map(({ content: _content, ...entry }) => entry)))
  return entries.flat().sort((a,b) => Number(b.created) - Number(a.created))
}
export async function readHistory(entry: HistoryEntry) {
  if (native) return invoke<string>('read_history', { key: entry.key, id: entry.id })
  const database = await db()
  return new Promise<string>((resolve, reject) => { const request = database.transaction('versions').objectStore('versions').get(entry.id); request.onsuccess = () => request.result ? resolve(request.result.content) : reject(new Error('该历史版本已不存在')); request.onerror = () => reject(request.error) })
}
