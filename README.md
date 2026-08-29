# 兰花 · 3D 时间切片

这是一个独立的 Three.js/Vite 交互作品页。当前源模型来自：

`C:\Users\Administrator\Desktop\Free\兰花_形态1.blend`

## 生成网页素材

在 PowerShell 中执行：

```powershell
& 'F:\Blender\blender.exe' --background --factory-startup 'C:\Users\Administrator\Desktop\Free\兰花_形态1.blend' --python '.\scripts\export_blender_assets.py' -- "$PWD\public\assets" 'C:\Users\Administrator\Desktop\Verminoble\blender_scenebench\blender_modelbench\兰花\形态1\alembic\alembic\OrchidMeshGrp.abc'
```

兰花文件中的动画是 MeshSequenceCache，需要额外的 Alembic 缓存。脚本会将它烘焙为 GLB morph targets，再生成自包含 `flower.glb` 和 76 张 RGBA PNG 时间切片。PNG 用于保留 Blender 透明渲染的干净边缘。

如果 Alembic 缓存位于其他位置，将命令最后一个路径替换为实际的 `OrchidMeshGrp.abc` 路径。该 106 MB 原始缓存不进入网页仓库；仓库中保留已生成的运行资产。

## 启动

```powershell
npm install
npm run dev
```

然后打开 Vite 输出的本地地址。

## 交互

- 页面滚动控制 76 个兰花时间状态。
- 画布横向拖拽展开或收拢切片，同时连续累积方位角，可绕兰花完整旋转 360° 及更多圈。
- 画布纵向拖拽控制俯仰角，避免翻转造成视角迷失。
- 展开按钮只控制时间轴，不会重置当前视角；按 `R` 可恢复默认视角。
- 主体有呼吸漂浮、切片漂移、粒子和轨道光环等环境动效；系统开启 reduced-motion 时会自动降低动态幅度。
