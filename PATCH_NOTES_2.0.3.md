# 页然 · Yeran 2.0.3

- 修复自动保存与中文输入法冲突：候选词尚未确认时暂停文件自动保存、恢复草稿及历史快照，不记录拼音中间态。
- 独立跟踪组合输入、组合更新、确认 / 取消、`isComposing` 和 Windows 的 229 键码；即使编辑器的 `view.composing` 短暂变为 false，也等待组合输入结束，再重新计算输入空闲时间。
- 自动保存经过权限、磁盘、图片与打包等异步步骤后，写入前重新检查输入版本。输入重新开始时取消这轮保存；浏览器临时流使用 abort，确认中文后重新保存，不弹出错误、不暂停后续自动保存。
- 已提交的旧快照保持独立，新输入继续保留为未保存状态；保存结束时避免重写正在组合输入的图片节点或移动编辑焦点。
- 包含先前的代码围栏、一行表头建表与离线 Emoji 名称补全。

## English

- Pause file autosave, recovery drafts and version snapshots during IME composition, keeping intermediate Latin/pinyin text out of persisted content.
- Track composition lifecycle events, composing input events and Windows key code 229 independently of the editor's transient composing flag. Restart the idle interval after the candidate is committed or cancelled.
- Recheck the input revision after asynchronous save preparation and immediately before writing. Abort superseded browser streams and retry normally once typing settles.
- Keep stable in-flight snapshots separate from newer edits, and avoid image-node rewrites or focus changes during composition.
