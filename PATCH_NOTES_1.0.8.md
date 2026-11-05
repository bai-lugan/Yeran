# 页然 · Yeran 1.0.8 本地修复版

本版尚未上传 GitHub。运行前退出旧版页然。

- 修复鼠标快速松开后蓝色框选框偶尔残留：结束操作前取消排队的刷新，已结束的框选不能再次绘制。
- 补齐松手事件被拦截、移出画布、鼠标捕获丢失、窗口失焦/隐藏和取消时的清理；自动滚动也会停止。
- 松手后保留块选区，方便成组拖动、复制或删除。点击空白处或按 Esc 可取消单块/多块选中；点击正文仍能正常定位光标输入。

包含 1.0.7 的对象缩放/居中、整表文字对齐、多块框选拖动和逐表重复表头。文稿格式与现有排版不变。

## Yeran 1.0.8 local fix

Not published on GitHub. Quit older Yeran processes before launching this build.

- Prevent queued animation frames from redrawing a marquee after a quick mouse release.
- Clean up on interrupted release events, pointer capture loss, window blur/hiding and cancellation; stop auto-scroll too.
- Keep selected blocks available for grouped actions after release. Escape or a blank click clears single/multiple block selections, while clicking text keeps normal caret editing.

Includes the resizing, centering, grouped dragging and per-table header features from 1.0.7. Document formats and saved layout remain unchanged.
