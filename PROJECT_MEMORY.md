# 工程记忆：杜鹃花 3D 时间切片

> 更新时间：2026-08-30
>
> 这是本项目的长期上下文、技术决策和执行记录。后续继续开发时，优先阅读本文，再查看 `README.md`、`src/main.js` 和 `scripts/export_blender_assets.py`。

### 最近修改

- 2026-08-30：按视觉稿收敛为单一主界面。删除独立引导页、结尾说明页和画布中央的额外提示，只保留固定舞台、杜鹃花模型、时间切片、帧数信息、拖拽提示和展开按钮。
- 同次修改将主界面的滚动区调整为 520vh，继续保留滚动逐帧和水平拖拽交互。
- 验证结果：页面只包含 1 个主 section；首屏状态为 `FRAME 01 / 76`；滚动到中段可到 `FRAME 47 / 76`；展开按钮可切换为“收拢切片”；桌面端 1440×900 首屏加载完成后 loading 面板自动隐藏。
- 工程约定：每次代码或视觉修改都必须同步更新本文，完成独立 Git 提交并推送到 `origin/main`。

## 1. 项目目标

制作一个独立的 Three.js/Vite 互动作品页，主体是杜鹃花，不是参考视频中的蝴蝶。

核心体验：

- 页面滚动逐帧穿过杜鹃花骨骼动画。
- 动画被均匀采样为 76 个时间状态。
- 水平拖拽让 76 张透明时间切片沿空间轴展开或收拢。
- 展开后能看到连续的 3D 时间轨迹、遮挡关系和透视变化。
- 粉色、紫色、黄色的粉彩雾光、透明卡片和柔和的展示台构成整体视觉。
- 桌面端优先保证完整空间效果，移动端自动降低 DPR、模型尺寸和镜头复杂度。

参考视频的重点不是复用蝴蝶素材，而是复用它的交互语法和构图：实时 3D 主体、时间切片、滚动控制时间、拖拽控制空间展开，以及后半段的镜头绕行。

## 2. 源素材与已确认事实

### Blender 源文件

实际使用的源文件是：

`C:\Users\Administrator\Desktop\Free\杜鹃花_形态1.blend`

曾出现过的 `C:\Users\Administrator\Desktop\Free\杜鹃花\_形态1.blend` 不是实际路径。原始文件位于本工程目录外，不进入 Git 仓库。

使用 Blender：

`F:\Blender\blender.exe`

Blender 检查结果：

- 场景：`杜鹃花_模型展示`
- 帧范围：1–420
- 帧率：24 fps，约 17.5 秒
- 骨架对象：`源文件_昆虫骨架`
- 骨骼数量：64
- 动画 Action：`Insect|Insect|fly`
- 杜鹃花模型：`杜鹃花_高模`
- 展示台：`展示台_杜鹃花`
- Blender 相机本身没有动画
- 4 张杜鹃花贴图已打包在 `.blend` 中，尺寸为 2048×2048
- 模型包含 ARMATURE modifier，没有 Shape Keys

外层素材目录 `C:\Users\Administrator\Desktop\Free\形态1` 还包含原始 FBX、MAX 和贴图，但网页导出不依赖它们。

### 参考 MP4

参考视频位于外层目录，约 3444×1936、17 秒、约 515 帧。视频概念上将动作组织为 76 个时间切片；后段包含镜头/场景旋转，因此网页端重新实现了镜头绕行。

## 3. 已确定的技术方案

采用混合方案：

1. `flower.glb`：实时加载杜鹃花模型和真实骨骼动画。
2. `frame-001.png` 至 `frame-076.png`：Blender 透明渲染得到的 76 张时间切片，用于形成可展开的空间轨迹。
3. Three.js：负责 GLB、AnimationMixer、切片卡片、相机和交互。
4. CSS：负责页面渐变、雾光、信息层、布局和移动端适配。

时间采样规则：

```js
sampleFrame(i) = round(1 + i * (420 - 1) / 75)
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
- 拖拽过程支持反向操作，并使用可中断的阻尼/弹簧式过渡。
- 滚动到后半段时，根据当前进度重建镜头绕行。
- 键盘支持方向键、Home、End，展开按钮支持无鼠标访问。
- `prefers-reduced-motion` 下关闭镜头旋转和弹性动画。

## 4. 工程结构

```text
rhododendron-time-slices/
├─ index.html                         页面结构和作品文案
├─ src/
│  ├─ main.js                         Three.js 场景、动画和交互
│  └─ style.css                       粉彩视觉、布局、响应式样式
├─ scripts/
│  └─ export_blender_assets.py        Blender GLB/切片自动导出脚本
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
5. 编写 Blender 自动处理脚本，导出自包含 `flower.glb`，并采样 76 张透明 PNG。
6. 实现实时 GLB 动画、时间切片、滚动映射、水平拖拽和镜头绕行。
7. 完成粉彩渐变、透明卡片、雾光、响应式和 reduced-motion 处理。
8. 执行 `npm install` 和 `npm run build`，构建成功。
9. 启动本地 Vite 服务，在桌面、移动端和 reduced-motion 场景下进行浏览器验证。
10. 验证 GLB 和全部 76 张 PNG 均可访问，滚动和拖拽状态可正常更新。

## 6. 已知限制与处理方式

- glTF 导出会将每个顶点的骨骼影响限制为最多 4 根，并重新归一化权重。这是 glTF 常见约束；如果后续发现姿态和 Blender 明显不一致，应在导出脚本中烘焙动画或提高时间切片的视觉权重。
- Blender 原相机无动画，所以网页镜头绕行是基于当前进度的 Three.js 重建，不是从 Blender 相机直接导出。
- 时间切片使用 RGBA PNG，而不是直接使用视频帧，以保留透明边缘并避免把 3444×1936 的视频帧全部带入网页。
- 目前没有加入重型后处理 Bloom，主要使用渐变、透明材质、边缘线和雾光完成视觉；如性能允许，后续可以增加桌面端轻量 Bloom。
- 旧 WebP 实验文件不被网页引用，统一排除，不作为运行资产。

## 7. 日常运行与重新导出

在工程目录执行：

```powershell
npm install
npm run dev
```

重新从 Blender 生成运行资产：

```powershell
& 'F:\Blender\blender.exe' --background --factory-startup 'C:\Users\Administrator\Desktop\Free\杜鹃花_形态1.blend' --python '.\scripts\export_blender_assets.py' -- "$PWD\public\assets"
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
