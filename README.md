# 兰花 · 3D 时间切片

这是一个独立的 Three.js/Vite 交互作品页。当前时间切片源自：

`C:\Users\Administrator\Desktop\Free\兰花_形态1.blend`

工程记忆：快速交接看 [`wiki_memory/README.md`](./wiki_memory/README.md)，完整历史兼容记录看 [`PROJECT_MEMORY.md`](./PROJECT_MEMORY.md)。结构化记忆的维护协议位于 [`wiki_memory/AGENTS.md`](./wiki_memory/AGENTS.md)。

## 生成网页素材

在 PowerShell 中执行：

```powershell
& 'F:\Blender\blender.exe' --background --factory-startup 'C:\Users\Administrator\Desktop\Free\兰花_形态1.blend' --python '.\scripts\export_blender_assets.py' -- "$PWD\public\assets" 'C:\Users\Administrator\Desktop\Verminoble\blender_scenebench\blender_modelbench\兰花\形态1\alembic\alembic\OrchidMeshGrp.abc'
```

兰花文件中的动画是 MeshSequenceCache，需要额外的 Alembic 缓存。脚本会按 76 个采样状态生成 RGBA PNG 时间切片；同时保留可选的 `flower.glb` 导出结果供后续资产检查，但网页主界面不会加载或显示实时 3D 模型。PNG 用于保留 Blender 透明渲染的干净边缘。

网页运行时只加载 `slice-manifest.json` 和 76 张 PNG。进入页面后时间切片默认以中等展开状态显示，不会在中央额外立起一个实时模型。

如果 Alembic 缓存位于其他位置，将命令最后一个路径替换为实际的 `OrchidMeshGrp.abc` 路径。该 106 MB 原始缓存不进入网页仓库；仓库中保留已生成的运行资产。

## 启动

```powershell
npm install
npm run dev
```

然后打开 Vite 输出的本地地址。

也可以直接双击 `runStart.cmd` 启动；脚本会自动切换到工程目录，检查 Node.js/npm，并在依赖缺失时执行 `npm install`。

## 交互

- 页面滚动控制 76 个兰花时间状态。
- 页面只显示 76 张透明时间切片，不加载中心实时 GLB 模型。
- 画布拖拽只控制视角：横向拖拽连续累积方位角，可绕兰花完整旋转 360° 及更多圈；纵向拖拽只做 ±28° 的轻微俯仰。
- 拖拽超过约 8px 后会锁定横向或纵向主方向，避免斜向手势同时改变两个角度。
- 相机固定，时间切片作为一个转台统一旋转；滚动不会自动绕行镜头。
- “展开切片”按钮独立控制时间轴，不会改变当前视角；按 `R` 可恢复默认视角。
- 键盘聚焦画布后，左右方向键旋转 10°，上下方向键调整 4° 俯仰，`Home` / `End` 控制收拢和展开。
- 时间切片有整体呼吸、错位漂移、粒子和轨道光环等环境动效；系统开启 reduced-motion 时会自动降低动态幅度。
