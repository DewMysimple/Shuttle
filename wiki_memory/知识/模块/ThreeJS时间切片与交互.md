---
type: knowledge
status: active
kind: module
importance: high
updated: 2026-08-30
topic: threejs-time-slices-interaction
source_logs:
  - "[[日志/2026-08-30-项目初始化与杜鹃花时间切片]]"
  - "[[日志/2026-08-30-自由旋转与丰富动效]]"
supersedes: null
---

# Three.js 时间切片与交互

## 一句话结论

`src/main.js` 用一个滚动驱动的 Three.js 场景同时管理 GLB 当前状态、76 张透明切片、自由视角和环境动效。

## 适用范围

修改时间映射、切片空间布局、拖拽旋转、相机、灯光或渲染循环时参考本页。

## 详细内容

- `SLICE_COUNT` 固定为 76，`frameFloat` 从滚动进度映射到 0–75。
- `AnimationMixer.setTime()` 驱动 GLB 的 `Orchid_Time_Slices` morph animation。
- 每张切片由卡片、边缘线和透明 PNG 平面组成，`spread` 控制 X/Z 空间展开。
- 横向拖拽根据位移更新 `spreadTarget` 和不封顶的 `orbitTarget`；纵向拖拽更新带俯仰边界的 `pitchTarget`。
- 目标状态用阻尼过渡到当前显示状态；`R` 恢复默认视角，按钮只改变展开状态。
- `updateAtmosphere()` 维护粒子位置、轨道光环、光晕和环境旋转。

## 常见问题或陷阱

- 不要把 `orbitTarget` 归一化到 0–2π，否则连续拖拽时会在边界产生跳变。
- 不要在展开按钮中重置视角，展开和观察应是两个独立状态。
- 修改触摸行为时保留 `touch-action: pan-y`，否则移动端页面滚动会被画布抢走。

## 来源

- [[决策/ADR-001-运行时混合架构|ADR-001 运行时混合架构]]
- [[决策/ADR-003-单界面交互与动效方向|ADR-003 单界面交互与动效方向]]
- [[日志/2026-08-30-自由旋转与丰富动效|自由旋转与丰富动效]]
