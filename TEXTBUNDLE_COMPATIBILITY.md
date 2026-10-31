# TextBundle / TextPack 兼容性

Yer​an 0.5 支持 Markdown 文稿的 TextBundle v1/v2 读取，保存生成 v2。官方扩展名是 `.textpack`；用户输入的 `.tetpack` 作为读取兼容别名，新增导出使用标准名称。[官方规范](https://textbundle.org/spec/)。

| 格式 | 入口 | 保存方式 |
| --- | --- | --- |
| `.textpack` | 打开文件、多文件打开 | Ctrl+S 写回 ZIP 包；另存为或文件菜单导出 |
| `.tetpack` | 同 TextPack 读取 | 原路径保存保持文件名；新导出建议 `.textpack` |
| `.textbundle` 文件夹 | 打开旁的下拉菜单 → 打开 TextBundle 文件夹 | 桌面版暂存整个目录，校验外部修改后替换；菜单可导出新目录 |

正文支持 `text.markdown`、`text.md` 或 `text.txt`，必须唯一。类型接受 Markdown 与纯文本 UTI；纯文本文稿按 Markdown 编辑，保存的 `type` 为 Markdown。包中原有资源和未知 `info.json` 字段保留；新图片按内容摘要命名放进 `assets/`。只修改图片节点的地址，不用字符串替换去误改代码中的图片示例。导出副本不改变源文稿。

素材缓存存在本机 IndexedDB，供恢复标签与历史副本显示图片；保留原包作为备份。历史是正文快照，不能恢复某个历史时刻同路径资源被外部替换之前的字节。普通 `.md` 不会自动带走相对图片，需导出 TextPack。

## 官方样本与验证

- [官方 v2 TextBundle ZIP](https://textbundle.org/downloads/example-bundle-v2.zip)：解压后打开 `.textbundle` 目录。
- [官方 TextPack](https://textbundle.org/downloads/example.textpack)：直接打开。

下载样本只放在忽略的本地验证目录，不并入应用或重新标注 MIT。验证正文、图片显示、编辑保存、元数据和原始图片字节；另测新图片打包、恢复、错误格式和越界路径。脚本见 `scripts/verify-05.mjs`、`scripts/verify-native-05.mjs`，实际结果见 [VALIDATION.md](VALIDATION.md)。v1 用最小构造样本验证，不能称为官方 v1 样本认证。

## 限制

- 最多 64 MB / 1024 文件，正文最多 20 MB；拒绝无效路径、重复文件、符号链接及无效元数据。macOS 资源辅助文件忽略。
- ZIP 压缩是同步操作，大包可能短暂阻塞；尚无超大包性能承诺。
- 浏览器依赖文件系统权限；不支持目录选择的浏览器使用 TextPack。浏览器目录保存逐文件写入，桌面目录保存使用暂存后替换，两者故障保证不同。
- 支持规范的 Markdown 子集，不读取 Fountain 等其他文本格式；外部图片获取失败会阻止打包并保留文稿修改。
- Markdown 由文档树重建，保留语义及资源不等于逐字节保留源文本。未知 HTML 和其他编辑器扩展见 [Typora 对照](TYPORA_COMPARISON.md)。
