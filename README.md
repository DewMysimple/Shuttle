# 杜鹃花 · 3D 时间切片

这是一个独立的 Three.js/Vite 交互作品页。源模型来自：

`C:\Users\Administrator\Desktop\Free\杜鹃花_形态1.blend`

## 生成网页素材

在 PowerShell 中执行：

```powershell
& 'F:\Blender\blender.exe' --background --factory-startup 'C:\Users\Administrator\Desktop\Free\杜鹃花_形态1.blend' --python '.\scripts\export_blender_assets.py' -- "$PWD\public\assets"
```

该脚本会生成一个自包含 `flower.glb` 和 76 张 RGBA PNG 时间切片。PNG 用于保留 Blender 透明渲染的干净边缘。

## 启动

```powershell
npm install
npm run dev
```

然后打开 Vite 输出的本地地址。
