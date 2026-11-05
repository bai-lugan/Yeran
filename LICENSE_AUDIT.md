# 许可核查 · 页然 Yeran

V2（2.0.0）沿用本轮已核查的依赖、字体策略与 MIT 授权；只调整页然自身版本与发布文档。第三方包锁定记录不变，EPL/MPL 源码材料与许可声明随源码及下载包提供。

公开源码中的 Rust 逐项许可清单沿用原文件，首行保留历史生成版本；已逐字核对其后全部许可正文与本次构建清单一致。下载包内清单使用当前构建版本标签，不改变任何上游许可文本。

1.0.10 的表格菜单、选区、右键菜单与对象对齐均为项目内实现，未新增第三方依赖、字体或素材。npm/Rust 第三方锁定记录未改变；仅更新页然版本，原许可与 MPL/EPL 源码材料继续随包提供。

1.0.9 的文字选区、左侧把手与 Mermaid 退格边界修复未新增依赖、字体或外部素材；锁文件的第三方包记录未改变。声明仅更新页然自身版本，继续随包保留原许可与 MPL/EPL 源码材料。

1.0.8 框选清理修复未更改依赖版本或添加素材，继续保留现有声明及对应 MPL/EPL 源码材料；仅更新页然自身版本。

2026-11-04，1.0.7 本地测试版：本轮块选择、拖动及对象排版未新增运行依赖、字体或外部图形素材。npm/Rust 依赖记录保持原锁定版本，仅更新页然版本；JavaScript 与 Windows x64 的 252 个 Rust 构建/目标包声明、5 个 MPL 组件源码材料已重新生成。现有 EPL 源码及出处材料继续随包提供。

1.0.3 本地测试版改用官方 `mermaid@12.2.0`（MIT），包括其完整 npm 依赖图；JS 声明按当前锁文件重新生成。`khroma@2.1.0` 的包清单没有 license 字段，但随包 `license` 文件明确为 MIT，声明已保留原文。DOMPurify 按 Apache-2.0 分支分发。

完整版新增 `elkjs@0.9.3`（EPL-2.0）。随应用资源提供 `third-party/epl-sources.zip`，包含准确的 elkjs 0.9.3 上游提交、可读发布代码、构建文件、许可和相关 Eclipse ELK Java 算法源码快照。出处见 `third-party/epl-sources.json`。上游 elkjs 发布没有记录精确的 ELK 构建提交，所附算法快照取自其发布日期之前，**不宣称该快照就是上游二进制的精确构建提交**；原始源码仓库和构建说明一并注明。没有修改这些上游代码；页然自身仍按 MIT 许可分发。

1.0.2 本地测试版新增 `@mermaid-js/tiny@12.2.0`（MIT）。使用未修改的官方 npm 运行库，精确包与校验值锁定在 `package-lock.json`；上游版权、MIT 文本与 bundle 内声明已收集进 `release/THIRD_PARTY_NOTICES.txt`。运行库随应用本地提供，未引用 CDN 或新增字体文件。页然自身 MIT 许可不变；本轮没有新增 Rust 依赖。

日期：2026-10-31。用户已选择 MIT。本项目自身的授权文本为 [LICENSE](LICENSE)；第三方代码、字体与图标仍保留各自许可。

## 本次结论

锁定的 npm 依赖和 Windows Rust 构建/目标依赖中，未发现 GPL/AGPL 或收费 Tiptap Pro 包。主要依赖为 MIT、Apache-2.0、BSD、ISC、Unicode-3.0、Zlib 等。发现 5 个 MPL-2.0 Rust 组件，已收集对应未修改源码和许可，并生成供未来分发的源码包。

这是一轮依赖声明、许可文件、引用来源与发布材料核查，不是对所有代码权属、商标或专利的法律保证。本次没有作“页然 / Yeran”名称的商标检索。

## 核查与材料

- JavaScript：依据 `package-lock.json` 的非 dev 依赖和本机实际包的许可文件，生成 `release/THIRD_PARTY_NOTICES.txt`。包括 Tiptap / ProseMirror、Vue、KaTeX 字体、Lucide 等。
- DOMPurify 声明 `(MPL-2.0 OR Apache-2.0)`，本次按 Apache-2.0 分支分发并保留其许可文本；没有修改其上游代码。
- Rust：依据 Windows x64 `cargo metadata` 与 Cargo.lock 核查 252 个构建/目标包，收集完整许可/NOTICE 文本到 `release/RUST_THIRD_PARTY_NOTICES.txt`。包括构建工具，范围大于最终运行时实际链接集合。
- 0.5 新增 fflate（MIT）、highlight.js（BSD-3-Clause）、Tiptap 上下标/链接扩展（MIT）和 Tauri opener（MIT OR Apache-2.0），已重新生成声明。官方 TextBundle 示例仅用于本地兼容验证，不以页然 MIT 重新许可或打包分发。
- 部分 crate 的 npm/Cargo 包缺少独立许可文件，已按 `.cargo_vcs_info.json` 指向的确切上游提交补取许可；快照放在 `third-party/licenses/`。`plist` 的 `LICENCE` 拼写也已纳入扫描。
- `tiptap-pagination-plus@3.1.0` 的发布清单声明 MIT，作者 Romik Makavana，但 npm 包与当前上游根目录未包含独立 LICENSE 文件。保留其原始清单 `third-party/tiptap-pagination-plus-3.1.0.package.json`、作者与源地址。这里依据其发布者的 MIT 声明，不宣称已审计上游全部代码来源。
- `md-reader`、`Umo Editor`、`Tydora` 仅作为架构参考，本项目没有拷贝这些应用的源码。图标来自 Lucide，应用标记为项目内 SVG 图形。使用系统字体，不打包微软雅黑等商业字体。
- WebView2、Edge/Chrome 使用用户已安装版本，不重新分发这些 Microsoft/Google 产品。

0.6 保存/安装修复新增官方 `tauri-plugin-single-instance 2.5.5`（MIT OR Apache-2.0），用于转交第二次启动的文件。已重新生成 Windows 252 个构建/目标包声明，MPL 包仍为 5 个，安装包附带许可、第三方声明及对应源码压缩包。参考 Notion 的公开交互说明实现自己的块与配色界面，没有使用 Notion 应用源码或品牌素材。

0.7 和 0.8 没有新增依赖。资源管理器参考 VS Code 的公开布局说明，自行实现目录组件与交互，没有拷贝 VS Code/Notion 源码或品牌素材。沿用 Lucide 图标，MIT 和第三方许可材料已按 0.8 重新生成。

0.8 只启用已安装 highlight.js 内的 DOS/BAT 语法模块，沿用该包 BSD-3-Clause 许可；没有引入额外脚本解释器，也没有拷贝 VS Code 实现源码。

## MPL-2.0 源码提供

`cssparser 0.37.0`、`cssparser-macros 0.7.1`、`dtoa-short 0.3.5`、`option-ext 0.2.0`、`selectors 0.38.0` 保持 MPL-2.0。精确来源见 [third-party/mpl-sources.json](third-party/mpl-sources.json)。

本地已生成 `release/Yeran-1.0-third-party-sources.zip`，内容为本次构建使用的这 5 个包的未修改源码；保留上游声明与许可证。未来分发二进制时需一并提供该源码包/可用来源和声明。不能用页然的 MIT 文本覆盖这些组件的许可。

Mozilla 官方解释允许与其他许可的文件组合分发，同时要求告知二进制接收者如何取得 MPL 部分源码：[MPL FAQ Q8](https://www.mozilla.org/en-US/MPL/2.0/FAQ/#q8-i-want-to-distribute-outside-my-organization-executable-programs-or-libraries-that-i-have-compiled-from-someone-elses-unchanged-mpl-licensed-source-code-either-standalone-or-part-of-a-larger-work-what-do-i-have-to-do)。

## 发布材料

程序便携包应包含 Yeran 可执行文件、本项目 LICENSE、JavaScript/Rust 第三方声明、中英文 README，以及 MPL 源码获取说明。另附精确的 MPL 源码压缩包和校验值。v1.0.0 随 GitHub Release 分发这些材料。

重建声明：`node scripts/collect-notices.mjs`；以 `cargo metadata --format-version 1 --filter-platform x86_64-pc-windows-msvc` 生成 Windows Cargo metadata 后（默认读取 `.oil-ui/yeran-10-dev/cargo-metadata.json`，也可用脚本第一个参数指定路径）运行 `python scripts/collect-native-notices.py`。脚本从官方上游补取缺失许可，保持 TLS 验证。

MIT 的允许使用、修改、分发和商用及保留声明要求见 [OSI 官方文本](https://opensource.org/license/mit)。页然自身 MIT 授权不包含第三方商标或承诺与 Typora、Word 的关联。

0.9 纯文本支持没有新增依赖，复用现有 Tiptap 编辑器与分页。MIT 不变，252 个 Rust 包声明和 5 个 MPL 源码包按 0.9 重新生成；TXT 文件关联只注册 Yeran 专有 ProgID。

1.0 文件重命名没有新增依赖。Windows MoveFileExW 通过系统 API 调用，不重新分发 Windows 组件；MIT不变，252个Rust构建/目标声明与5个MPL源码包按1.0生成。

首次公开发布把精确 MPL 源码归档和 Rust 声明同时保存在 `third-party/mpl-sources.zip`、`third-party/RUST_THIRD_PARTY_NOTICES.txt`，桌面资源从此处取用，干净源码克隆可直接构建；Release 另附相同的版本化源码包。

## v1 字体专项复核

最终前端产物中的 59 个 TTF/WOFF/WOFF2 文件全部来自 `katex@0.19.1`，逐个 SHA-256 比对与该包的 `dist/fonts` 原文件一致。KaTeX 的 MIT 版权和许可已包含在第三方声明中；没有随应用分发微软雅黑、宋体、Segoe UI、Consolas、PingFang 或 Songti 的字体文件。正文、界面和代码的 CSS 字体列表仅引用用户设备上已安装的字体。

[微软官方字体 FAQ](https://learn.microsoft.com/en-us/typography/fonts/font-faq)允许 Windows 应用调用系统字体显示、编辑和打印，也允许在 CSS 字体列表中引用 Windows 字体名称；这不授予复制系统字体文件到安装包或服务器的权利。PDF 中的字体嵌入需遵守具体字体的嵌入标志及许可。本机默认使用的 `msyh.ttc`、`simsun.ttc`、`segoeui.ttf` 和 `consola.ttf` 的 OS/2 `fsType` 均为 8（editable embedding）；这只是本机构建验证结果，不代替其他字体或字体版本的授权核查。

KaTeX 上游许可：[KaTeX LICENSE](https://github.com/KaTeX/KaTeX/blob/main/LICENSE)、[katex-fonts LICENSE](https://github.com/KaTeX/katex-fonts/blob/master/LICENSE)。本项目的 MIT 许可不覆盖第三方字体权利；以后如新增随包字体、在线字体或自定义字体选择，必须重新检查其许可及文档嵌入条件。
