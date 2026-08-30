# 工程记忆：杜鹃花 3D 时间切片

> 更新时间：2026-08-30
>
> 这是本项目的长期上下文、技术决策和执行记录。后续继续开发时，优先阅读本文，再查看 `README.md`、`src/main.js` 和 `scripts/export_blender_assets.py`。
>
> 结构化快速交接摘要同步维护在 `wiki_memory/`；每次代码、视觉、运行资产或记忆修改都必须同步更新相关记忆。

### 最近修改

- 2026-08-30：按视觉稿收敛为单一主界面。删除独立引导页、结尾说明页和画布中央的额外提示，只保留固定舞台、杜鹃花模型、时间切片、帧数信息、拖拽提示和展开按钮。
- 同次修改将主界面的滚动区调整为 520vh，继续保留滚动逐帧和水平拖拽交互。
- 验证结果：页面只包含 1 个主 section；首屏状态为 `FRAME 01 / 76`；滚动到中段可到 `FRAME 47 / 76`；展开按钮可切换为“收拢切片”；桌面端 1440×900 首屏加载完成后 loading 面板自动隐藏。
- 2026-08-30：主体模型替换为 `兰花_形态1.blend`。该文件使用 1–166 帧的 Alembic MeshSequenceCache，不是骨骼 Action；导出脚本现在会生成 76 个 morph targets 和对应动画，再导出 GLB 与 PNG 切片。
- 兰花缓存路径已确认存在于外部素材库：`C:\Users\Administrator\Desktop\Verminoble\blender_scenebench\blender_modelbench\兰花\形态1\alembic\alembic\OrchidMeshGrp.abc`。缓存约 106 MB，仅用于重新导出，不提交到网页仓库。
- 本次替换验证：GLB 包含 77 个 shape keys（Basis + 76 帧）和 `Orchid_Time_Slices` 动画；重新生成 76 张 PNG；网页标题、加载文案和主界面标签均已改为兰花。
- 2026-08-30：移除之前为贴近参考图而额外生成的棕色展示台。当前 GLB 只包含兰花 morph animation，页面不再显示圆台；时间切片本身也只渲染兰花。
- 2026-08-30：增强画布视角交互。横向拖拽现在使用不封顶的方位角累积，兰花可以连续旋转完整 360° 及更多圈；纵向拖拽控制带俯仰上限的上下视角。展开按钮不再重置视角，`R` 可恢复默认视角。
- 同次修改增加主体呼吸漂浮、时间切片错位漂移、环境粒子、轨道光环、镜头微动和渐变雾光流动，让主界面动效更丰富；`prefers-reduced-motion` 仍会降低或关闭持续运动。
- 2026-08-30：修复 `runStart.cmd` 的批处理目录变量错误，将 `%~dp` 改为 `%~dp0`；现在双击脚本会正确进入工程目录，检查 Node.js/npm，必要时自动安装依赖并启动 Vite。
- 交互偏好：以丰富、明显的空间动效和旋转反馈为主，不把 Apple Design 的弱化动效取向作为本项目约束；仅保留系统 `prefers-reduced-motion` 作为无障碍兜底。
- 工程约定：每次代码或视觉修改都必须同步更新本文，完成独立 Git 提交并推送到 `origin/main`。

## 1. 项目目标

制作一个独立的 Three.js/Vite 互动作品页，主体是兰花，不是参考视频中的蝴蝶。

核心体验：

- 页面滚动逐帧穿过兰花形态动画。
- 动画被均匀采样为 76 个时间状态。
- 水平拖拽让 76 张透明时间切片沿空间轴展开或收拢。
- 展开后能看到连续的 3D 时间轨迹、遮挡关系和透视变化。
- 粉色、紫色、黄色的粉彩雾光、透明卡片和柔和的展示台构成整体视觉。
- 桌面端优先保证完整空间效果，移动端自动降低 DPR、模型尺寸和镜头复杂度。

参考视频的重点不是复用蝴蝶素材，而是复用它的交互语法和构图：实时 3D 主体、时间切片、滚动控制时间、拖拽控制空间展开，以及后半段的镜头绕行。

## 2. 源素材与已确认事实

### Blender 源文件

实际使用的源文件是：

`C:\Users\Administrator\Desktop\Free\兰花_形态1.blend`

当前使用的实际路径是 `C:\Users\Administrator\Desktop\Free\兰花_形态1.blend`。曾输入过的 `C:\Users\Administrator\Desktop\Free\兰花\_形态1.blend` 不存在；兰花源文件位于本工程目录外，不进入 Git 仓库。

使用 Blender：

`F:\Blender\blender.exe`

Blender 检查结果：

- 场景：`兰花_形态1_模型展示`
- 帧范围：1–166
- 帧率：30 fps，约 5.5 秒
- 动画对象：`兰花_形态1_动画缓存`
- 动画类型：MeshSequenceCache，使用 `OrchidMeshGrp.abc`
- 缓存网格：8502 vertices、8488 polygons
- 三组静态源形态：闭合、半闭合、开放
- 当前不导出展示台，GLB 和时间切片只包含兰花主体
- Blender 相机本身没有动画
- 4 张兰花贴图已打包在 `.blend` 中，尺寸为 1024×1024
- Blender 文件没有 Actions 或 Shape Keys；网页用烘焙后的 morph targets 接收动画

外层素材目录 `C:\Users\Administrator\Desktop\Free\形态1` 还包含原始 FBX、MAX 和贴图，但网页导出不依赖它们。

### 参考 MP4

参考视频位于外层目录，约 3444×1936、17 秒、约 515 帧。视频概念上将动作组织为 76 个时间切片；后段包含镜头/场景旋转，因此网页端重新实现了镜头绕行。

## 3. 已确定的技术方案

采用混合方案：

1. `flower.glb`：实时加载兰花模型和 Alembic 烘焙后的 morph animation。
2. `frame-001.png` 至 `frame-076.png`：Blender 透明渲染得到的 76 张时间切片，用于形成可展开的空间轨迹。
3. Three.js：负责 GLB、AnimationMixer、切片卡片、相机和交互。
4. CSS：负责页面渐变、雾光、信息层、布局和移动端适配。

当前兰花时间采样规则（源动画 1–166 帧）：

```js
sampleFrame(i) = round(1 + i * (166 - 1) / 75)
```

页面状态由以下数据驱动：

```ts
type TimeSliceState = {
  scrollProgress: number; // 0–1
  frameFloat: number;     // 0–75
  spread: number;         // 0–1
  orbit: number;
}
```

交互映射：

- 滚动进度 → `frameFloat` → `AnimationMixer.setTime()`。
- 水平 Pointer Events 拖拽 → `spread`，控制切片沿 X/Z 轴展开。
- 拖拽横向位移同时累积不封顶的 `orbitTarget`，可连续绕 Y 轴 360° 旋转；纵向位移映射到 `pitchTarget`，并限制俯仰范围避免镜头倒置。
- 拖拽过程支持反向操作，并使用可中断的阻尼过渡。
- 滚动到后半段时，根据当前进度重建轻微镜头绕行；主体、切片和环境粒子还会持续进行低幅度漂浮与呼吸动效。
- 键盘支持方向键、Home、End，`R` 恢复视角，展开按钮支持无鼠标访问。
- `prefers-reduced-motion` 下关闭镜头旋转和弹性动画。

## 4. 工程结构

```text
rhododendron-time-slices/
├─ index.html                         页面结构和作品文案
├─ src/
│  ├─ main.js                         Three.js 场景、动画和交互
│  └─ style.css                       粉彩视觉、布局、响应式样式
├─ scripts/
│  └─ export_blender_assets.py        Blender Alembic→GLB/切片自动导出脚本
├─ public/assets/
│  ├─ flower.glb                       自包含运行模型
│  ├─ slice-manifest.json              76 帧清单
│  └─ slices/frame-001.png … 076.png  透明时间切片
├─ package.json
├─ package-lock.json
├─ README.md
└─ PROJECT_MEMORY.md
```

## 5. 已执行过程

1. 检查外层文件，确认实际 `.blend` 路径和 Blender 可执行文件。
2. 用 Blender 只读检查场景、对象、动画、骨骼和贴图。
3. 确认参考视频后段确实包含 3D 场景旋转和时间切片视觉。
4. 创建 Vite + Three.js 独立工程。
5. 编写 Blender 自动处理脚本，将兰花 Alembic 缓存烘焙为 morph targets，导出自包含 `flower.glb`，并采样 76 张透明 PNG。
6. 实现实时 GLB 动画、时间切片、滚动映射、水平拖拽和镜头绕行。
7. 完成粉彩渐变、透明卡片、雾光、响应式和 reduced-motion 处理。
8. 执行 `npm install` 和 `npm run build`，构建成功。
9. 启动本地 Vite 服务，在桌面、移动端和 reduced-motion 场景下进行浏览器验证。
10. 验证 GLB 和全部 76 张 PNG 均可访问，滚动和拖拽状态可正常更新。

## 6. 已知限制与处理方式

- 兰花源文件不是骨骼动画，而是依赖外部 Alembic MeshSequenceCache。导出脚本已将每个采样帧烘焙为 shape key，并建立 `Orchid_Time_Slices` morph animation；重新导出时必须提供 `OrchidMeshGrp.abc`。
- Alembic 缓存约 106 MB，不进入 Git 或网页运行时；如果换机器，需要重新提供缓存路径。
- Blender 原相机无动画，所以网页镜头绕行是基于当前进度的 Three.js 重建，不是从 Blender 相机直接导出。
- 时间切片使用 RGBA PNG，而不是直接使用视频帧，以保留透明边缘并避免把 3444×1936 的视频帧全部带入网页。
- 目前没有加入重型后处理 Bloom，主要使用渐变、透明材质、边缘线、雾光、粒子和轨道光环完成视觉；如性能允许，后续可以增加桌面端轻量 Bloom。
- 旧 WebP 实验文件不被网页引用，统一排除，不作为运行资产。

## 7. 日常运行与重新导出

在工程目录执行：

```powershell
npm install
npm run dev
```

重新从 Blender 生成运行资产：

```powershell
& 'F:\Blender\blender.exe' --background --factory-startup 'C:\Users\Administrator\Desktop\Free\兰花_形态1.blend' --python '.\scripts\export_blender_assets.py' -- "$PWD\public\assets" 'C:\Users\Administrator\Desktop\Verminoble\blender_scenebench\blender_modelbench\兰花\形态1\alembic\alembic\OrchidMeshGrp.abc'
```

生产构建：

```powershell
npm run build
npm run preview
```

## 8. 验收基线

提交或部署前至少确认：

- `npm run build` 成功。
- `flower.glb` 与 76 张 PNG 没有 404。
- 滚动起点、中段、终点对应动画起点、中段、终点。
- 切片可以完全收拢、展开，并支持中途反向拖拽。
- 画布横向拖拽可连续旋转 360° 及更多圈，纵向拖拽可调整俯仰，旋转中途反向不会跳变。
- 展开后有明显的空间透视、遮挡和时间顺序。
- 移动端可用，且不会因为横向拖拽阻塞垂直滚动。
- reduced-motion 下不会持续自动绕行或弹性运动。
- 推送远程后，干净克隆可以直接安装依赖并启动页面。

## 9. Git 约定

- Git 根目录：本目录。
- 默认分支：`main`。
- 远程：`https://github.com/DewMysimple/Shuttle.git`。
- 第一条提交信息：`feat: add rhododendron 3d time slice experience`。
- 不提交外层 `.blend`、MP4、FBX、MAX 和原始贴图目录。
