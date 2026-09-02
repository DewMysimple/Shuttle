---
type: knowledge
status: active
kind: module
importance: high
updated: 2026-09-02
topic: blender-butterfly-front-sampling
source_logs:
  - "[[日志/2026-09-02-真实水平时间切片穿梭重构]]"
supersedes: null
---

# Blender 蝴蝶正面采样管线

## 一句话结论

指定蝴蝶必须由固定正交相机沿世界 Z 轴正对 X-Y 平面逐整数帧采样，不跟随旧路径节点或源英雄相机。

## 当前事实

- 源文件：`Source/BUTTERFLY_FLAP_FAST_FOLLOW_PATH_1_WING_FLAP_ONLY.blend`。
- 场景：`ARTIST_EDIT`；帧范围 1 到 91。
- 主体：三个名称以 `展示_` 开头的身体、左翼和右翼网格。
- 相机：世界方向 `(0, 0, 1)`，正交尺度 `7`，距离 `14`；目标为身体世界包围盒中心。画面内 90° 滚转只让身体竖直，不改变正对 X-Y 平面的几何关系。
- 输出：91 张 768×768 RGBA PNG，manifest 使用 `sampleMode: every-integer-frame` 与 `view: fixed-top-front`。
- 导出先写入进程独立的暂存目录，全部成功后原子替换正式切片，避免 Blender 中断导致半套资产。
- 清理阶段以高透明度主体核心为种子保留相邻抗锯齿像素，移除远离主体的低透明度渲染碎片。

## 运行方式

```powershell
& 'F:\Blender\blender.exe' --background "$PWD\Source\BUTTERFLY_FLAP_FAST_FOLLOW_PATH_1_WING_FLAP_ONLY.blend" --python '.\scripts\export_butterfly_slices.py' -- "$PWD\public\assets"
```

## 常见陷阱

- 旧的局部 `-X` 路径跟随相机会产生斜视、缩小和偏离身体中心的问题，不得恢复。
- 相机轴正确但目标仍指向动画节点原点，也会让身体偏离构图中心；目标必须来自身体几何。
- 透明 PNG 中远离主体的细小亮线是无效渲染碎片，需要在发布前清除。
- 重新导出后要验证 91 个文件、连续源帧、RGBA 尺寸，并抽查开翼、半开与合翼帧。

## 来源

- [[决策/ADR-016-真实水平时间切片穿梭|ADR-016 真实水平时间切片穿梭]]
- [[日志/2026-09-02-真实水平时间切片穿梭重构|真实水平时间切片穿梭重构]]
