# 兰花 · 3D 时间切片

这是一个独立的 Three.js/Vite 交互作品页。当前时间切片源自：

`C:\Users\Administrator\Desktop\Free\兰花_形态1.blend`

工程记忆：快速交接看 [`wiki_memory/README.md`](./wiki_memory/README.md)，完整历史兼容记录看 [`PROJECT_MEMORY.md`](./PROJECT_MEMORY.md)。结构化记忆的维护协议位于 [`wiki_memory/AGENTS.md`](./wiki_memory/AGENTS.md)。

## 生成网页素材

在 PowerShell 中执行：

```powershell
& 'F:\Blender\blender.exe' --background --factory-startup 'C:\Users\Administrator\Desktop\Free\兰花_形态1.blend' --python '.\scripts\export_blender_assets.py' -- "$PWD\public\assets" 'C:\Users\Administrator\Desktop\Verminoble\blender_scenebench\blender_modelbench\兰花\形态1\alembic\alembic\OrchidMeshGrp.abc'
```

兰花文件中的动画是 MeshSequenceCache，需要额外的 Alembic 缓存。脚本会按源场景的完整整数帧范围（当前为 1–166，共 166 帧）逐帧生成 RGBA PNG 时间切片；同时保留可选的 `flower.glb` 导出结果供后续资产检查，但网页主界面不会加载或显示实时 3D 模型。PNG 用于保留 Blender 透明渲染的干净边缘。

渲染切片前，脚本会扫描完整动画的评估包围盒，自动缩小并光学居中 Blender 相机，在画面四周保留安全边距。这样花朵从闭合到完全展开时仍完整位于每张卡片内，不会因后段姿态超出原始相机取景而被裁剪；该调整只作用于导出渲染，不会修改源 `.blend`。

网页运行时先读取 `slice-manifest.json`，再按清单中的数量加载 PNG；因此切片数量不再写死为 76。进入页面后时间切片默认以中等展开状态显示，不会在中央额外立起一个实时模型。

如果 Alembic 缓存位于其他位置，将命令最后一个路径替换为实际的 `OrchidMeshGrp.abc` 路径。该约 106 MB 原始缓存不进入网页仓库；仓库中保留已生成的 166 帧运行资产。

## 启动

```powershell
npm install
npm run dev
```

然后打开 Vite 输出的本地地址。

也可以直接双击 `runStart.cmd` 启动；脚本会自动切换到工程目录，检查 Node.js/npm，并在依赖缺失时执行 `npm install`。

## 交互

- 长按画布约 260ms 后播放 manifest 中的全部兰花时间状态：左键长按正向播放，右键长按倒放，松开立即暂停；播放到对应边界后停留，再次长按会从相应起点重新播放。
- 画布右侧的“正放”和“倒放”按钮单击即可开始对应方向播放，再次点击当前播放方向可暂停；“开头”和“结尾”按钮单击后会暂停并直接跳到首帧或尾帧。
- 页面只显示 manifest 中的透明时间切片，不加载中心实时 GLB 模型。
- 播放时当前帧锚定在中央焦点，所有可见切片保持正面平行并沿世界 X 轴以 `0.30` 的固定步进排成一条直线；不再使用 X+Z 联动、弯曲或逐片倾斜。
- 播放推进到第 N 帧后，索引小于 `floor(frameFloat)` 的历史切片会从渲染中隐藏，视为已越过相机视野；当前帧与尚未播放的切片继续组成直线时间序列。
- 画布拖拽只控制视角：横向拖拽连续累积方位角，可绕兰花完整旋转 360° 及更多圈，每个视口宽度约旋转 333°；向下拖动是俯视，向上拖动是仰视，纵向范围扩大到 ±45°，并提高了俯仰响应。
- 旋转采用更快的可打断阻尼跟随，松手后只做短暂、无惯性的角度收敛，不会继续甩动。
- 约 8px 只作为起拖死区；超过死区后，水平位移独立控制 yaw、垂直位移独立控制 pitch，斜向拖动会同时改变两个角度；正向或倒放期间仍可继续拖拽旋转视角，松开才暂停播放。
- 相机固定，时间切片作为一个转台统一旋转；滚轮只控制相机距离（3–15.5），向上放大、向下缩小，缩放响应已加快，并以当前时间切片为聚焦中心，不改变时间或旋转角度。
- “展开切片”按钮独立控制时间轴，不会改变当前视角；按 `R` 可恢复默认视角。
- 键盘聚焦画布后，按住空格正向播放、松开暂停；左右方向键旋转 10°，上下方向键调整 4° 俯仰，`Home` / `End` 控制收拢和展开。
- 时间切片有整体呼吸、错位漂移、粒子和轨道光环等环境动效；系统开启 reduced-motion 时会自动降低动态幅度。
