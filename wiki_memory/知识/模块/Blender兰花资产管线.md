---
type: knowledge
status: active
kind: module
importance: high
updated: 2026-08-30
topic: blender-orchid-asset-pipeline
source_logs:
  - "[[日志/2026-08-30-兰花替换与展示台移除]]"
supersedes: null
---

# Blender 兰花资产管线

## 一句话结论

源 `.blend` 的 MeshSequenceCache 必须在 Blender 中结合外部 Alembic 缓存烘焙后，才能成为网页使用的 GLB morph animation 和透明 PNG。

## 适用范围

更换兰花模型、修改采样数量、重新导出 GLB/切片或排查导出结果时参考本页。

## 详细内容

- 源动画范围为 1–166 帧，网页均匀采样 76 帧。
- `scripts/export_blender_assets.py` 配置 MeshSequenceCache，逐帧读取网格并写入 `Frame_001` 至 `Frame_076` shape keys。
- 导出动作名为 `Orchid_Time_Slices`，GLB 不带 Blender 场景展示台。
- 同一批采样帧渲染为 768×768 RGBA PNG，文件名为 `frame-001.png` 至 `frame-076.png`。
- 外部 Alembic 缓存约 106 MB，不放入 Git；网页运行只使用生成后的资产。

## 常见问题或陷阱

- 只打开 `.blend` 但没有 sidecar Alembic 时会出现缓存缺失提示；重新导出必须显式传入 ABC 路径。
- Blender 5 的 Action API 不使用旧版 `action.fcurves` 写法，脚本需要使用当前数据块 API 创建 morph 曲线。
- 重新导出后必须检查 shape key 数量、动画名称、manifest 和 PNG 数量。

## 来源

- [[决策/ADR-002-兰花动画资产管线|ADR-002 兰花动画资产管线]]
- [[日志/2026-08-30-兰花替换与展示台移除|兰花替换与展示台移除]]
