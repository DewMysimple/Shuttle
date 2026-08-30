---
type: moc
status: active
kind: process
importance: high
updated: 2026-08-31
topic: work-log-index
source_logs: []
supersedes: null
---

# 工作日志 MOC

> 单一工作日志索引，按更新时间倒序。任务类型通过 `kind` 元数据区分。

| 时间 | 类型 | 目标 | 状态 | 主题 | 日志 |
| --- | --- | --- | --- | --- | --- |
| 2026-08-31 | ui | 把当前 X+Z 时间隧道切片改成正面平行、沿单一水平直线排列，消除斜向、弯曲和 S 形视觉路径。 | archived | straight-line-time-slice-layout | [[日志/2026-08-31-直线时间切片排列.md|2026-08-31｜直线时间切片排列]] |
| 2026-08-31 | feature | 播放推进到当前时间切片后，隐藏已经越过当前帧的历史切片；在主界面右侧增加一次点击即可使用的正放、倒放、开头和结尾控制；同步记录每次推送必须回报完整 commit hash 的工程约定。 | archived | playback-controls-and-past-slice-culling | [[日志/2026-08-31-播放控制与前序切片裁切.md|2026-08-31｜播放控制与前序切片裁切]] |
| 2026-08-31 | feature | - | archived | full-animation-safe-framing | [[日志/2026-08-31-全动画安全构图与主体居中.md|全动画安全构图与主体居中]] |
| 2026-08-31 | ui | 让最大缩放达到参考图的主体聚焦距离，并提高俯仰、视角旋转与缩放的响应速度。 | archived | focused-zoom-and-rotation-response | [[日志/2026-08-31-主体聚焦与视角响应调整.md|2026-08-31｜主体聚焦与视角响应调整]] |
| 2026-08-30 | feature | 建立独立的 Three.js/Vite 3D 时间切片网页，并接入初始杜鹃花模型方案。 | archived | initial-time-slice-experience | [[日志/2026-08-30-项目初始化与杜鹃花时间切片.md|2026-08-30｜项目初始化与杜鹃花时间切片]] |
| 2026-08-30 | feature | 将时间控制从页面滚动改为长按播放，并让滚轮只负责主体缩放。 | archived | press-play-wheel-zoom | [[日志/2026-08-30-长按播放与滚轮缩放交互.md|2026-08-30｜长按播放与滚轮缩放交互]] |
| 2026-08-30 | feature | 让画布角度可以自由旋转 360° 以上，并增加明显、丰富的主界面动效。 | archived | free-orbit-and-rich-motion | [[日志/2026-08-30-自由旋转与丰富动效.md|2026-08-30｜自由旋转与丰富动效]] |
| 2026-08-30 | ui | - | archived | stable-rotation-interaction | [[日志/2026-08-30-稳定旋转交互.md|2026-08-30｜稳定旋转交互]] |
| 2026-08-30 | ui | 移除主界面中央实时 3D 兰花，只保留 76 张透明时间切片及其交互。 | archived | slices-only-runtime | [[日志/2026-08-30-移除实时模型仅保留时间切片.md|2026-08-30｜移除实时模型，仅保留时间切片]] |
| 2026-08-30 | ui | 将透明切片叠加优化为当前帧中心锚定的 X/Z 空间时间隧道，并提升主体可读性。 | archived | spatial-time-tunnel-composition | [[日志/2026-08-30-时间隧道切片优化.md|2026-08-30｜时间隧道切片优化]] |
| 2026-08-30 | bug | 修正纵向拖拽方向，并降低旋转跟随的生硬感。 | archived | rotation-feel-and-pitch-direction | [[日志/2026-08-30-旋转手感与俯仰方向修复.md|2026-08-30｜旋转手感与俯仰方向修复]] |
| 2026-08-30 | feature | 让长按播放支持左右键方向，并允许播放过程中继续调整观察视角；同时提高俯仰与整体旋转响应。 | archived | directional-playback-concurrent-rotation | [[日志/2026-08-30-播放方向与播放中旋转.md|2026-08-30｜播放方向与播放中旋转]] |
| 2026-08-30 | maintenance | 将网页工程初始化为独立 Git 仓库并推送到指定远程仓库。 | archived | repository-initialization | [[日志/2026-08-30-工程初始化与远程管理.md|2026-08-30｜工程初始化与远程管理]] |
| 2026-08-30 | feature | 让网页使用兰花源动画的全部整数帧，并增加相邻时间切片的空间距离。 | archived | full-frame-extraction-and-slice-spacing | [[日志/2026-08-30-完整帧提取与切片间距调整.md|2026-08-30｜完整帧提取与切片间距调整]] |
| 2026-08-30 | bug | 修复双击 `runStart.cmd` 无法启动工程的问题。 | archived | windows-start-script | [[日志/2026-08-30-启动脚本修复.md|2026-08-30｜Windows 启动脚本修复]] |
| 2026-08-30 | feature | 按视觉稿只保留一个主界面，并将主体从初版杜鹃花切换为用户指定的兰花。 | archived | single-interface-and-orchid-replacement | [[日志/2026-08-30-单一主界面与兰花替换.md|2026-08-30｜单一主界面与兰花替换]] |
| 2026-08-30 | ui | 确保网页使用准确的兰花源文件，并删除用户明确不需要的下方棕色圆台。 | archived | orchid-asset-and-stage-cleanup | [[日志/2026-08-30-兰花替换与展示台移除.md|2026-08-30｜兰花替换与展示台移除]] |
| 2026-08-30 | maintenance | 完全按照 `工程记忆构建/wiki_memory` 的理论目录、Schema、frontmatter、日志和 lint 方式构建本项目记忆。 | archived | structured-wiki-memory | [[日志/2026-08-30-wiki_memory结构化.md|2026-08-30｜wiki_memory 结构化]] |

## 使用方式

- 由 `python 工具/memory_lint.py index` 生成或刷新。
- 查询时先阅读当前状态，再按关键词定位日志。
- 历史日志是审计记录，不应直接覆盖当前状态。

## 入口

- [[README|工程 Agent 记忆系统]]
- [[AGENTS|记忆维护协议]]
- [[日志/README|工作日志说明]]
- [[当前状态/项目概览|当前项目概览]]
- [[当前状态/系统架构|当前系统架构]]
