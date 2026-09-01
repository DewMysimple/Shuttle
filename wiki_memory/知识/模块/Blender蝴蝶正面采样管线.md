---
type: knowledge
status: active
kind: module
importance: high
updated: 2026-09-01
topic: blender-butterfly-front-sampling
source_logs:
  - "[[日志/2026-09-01-蝴蝶正面时间切片采样]]"
supersedes: null
---

# Blender 蝴蝶正面采样管线

## 一句话结论

蝴蝶源工程的时间切片必须使用自定义正面跟随相机逐帧渲染，不能直接沿用源 `.blend` 的斜侧英雄相机。

## 当前事实

- 源文件动画范围为 1–91 帧，30 fps。
- `ARTIST_EDIT` 场景中以“展示_”前缀的三个网格是网页要采样的蝴蝶展示组；无前缀对象是重复源模型，`蝴蝶_展示台地面` 不属于网页主体。
- `展示_BUTTERFLY_FLAP_FAST_FOLLOW_PATH_1_源_FBX_01_03_BUTTERFLY_FAST__FLAP_FOLLOW_PATH_1_2` 是带路径/整体姿态动作的动画节点。
- 动画节点本地 `-X` 方向对应蝴蝶正面；脚本沿该轴放置临时相机，并在每个源帧重新瞄准动画节点原点。
- 输出为 `public/assets/slices/frame-001.png` 至 `frame-091.png`，每张为 768×768 RGBA；清单记录 `animationType: blender-action-sampled-png` 与 `view: tracked-front`。

## 运行方式

```powershell
& 'F:\Blender\blender.exe' --background 'C:\Users\Administrator\Desktop\Free\BUTTERFLY_FLAP_FAST_FOLLOW_PATH_1.blend' --python '.\scripts\export_butterfly_slices.py' -- "$PWD\public\assets"
```

脚本只在 Blender 进程内临时隐藏非展示网格、创建采样相机和修改帧/渲染设置，结束后不保存源工程。网页运行时不需要 Blender、原始场景或外部贴图。

## 常见陷阱

- 使用源相机会让蝴蝶随飞行路径转成侧面，不能满足“始终正面”。
- 只按固定世界轴放相机也不够；必须跟随带路径动作的动画节点的方向，否则路径转向时主体仍会横过镜头。
- 不要把源对象和展示台一起渲染，否则透明切片会出现重复蝴蝶或地面残片。
- 修改帧范围后要同步检查 manifest 数量、PNG 连续性、首/中/尾帧透明包围盒和网页加载数量。

## 来源

- [[决策/ADR-015-蝴蝶正面跟随相机采样管线|ADR-015 蝴蝶正面跟随相机采样管线]]
- [[日志/2026-09-01-蝴蝶正面时间切片采样|蝴蝶正面时间切片采样]]
