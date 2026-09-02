# Source / 源素材

本目录用于管理蝴蝶时间切片的离线输入：

- `BUTTERFLY_FLAP_FAST_FOLLOW_PATH_1_WING_FLAP_ONLY.blend`：当前 1 到 91 帧翅膀动画源。
- `留下的记忆切成时间切片 蝴蝶飞过的时间，切成了76片每一片都是飞行中的一个瞬间。滚动逐帧穿过，向外拖拽，就能看到整段蝴蝶飞行动画被展开.mp4`：主要视觉和交互参考。
- `时间切片 #threejs #vibecoding大赏 #抖音前沿科技首发计划 #编程艺术.mp4`：辅助空间结构参考。
- `当前效果.mp4`：改造前问题复盘参考。

这些大体积源文件不提交到 Git。网页运行时只读取 `public/assets/slice-manifest.json` 和 `public/assets/slices/` 中已生成的静态逐帧 PNG。重新导出命令与采样约束见项目根目录 `README.md`。
