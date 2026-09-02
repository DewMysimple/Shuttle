# 蝴蝶时间切片

这是一个 Three.js/Vite 交互艺术作品。运行资产来自 `Source/BUTTERFLY_FLAP_FAST_FOLLOW_PATH_1_WING_FLAP_ONLY.blend` 的 1 到 91 帧，每个整数帧都被采样为一张独立的 768×768 RGBA PNG。

工程记忆入口位于 [`wiki_memory/README.md`](./wiki_memory/README.md)，维护协议位于 [`wiki_memory/AGENTS.md`](./wiki_memory/AGENTS.md)。

## 生成网页素材

在 PowerShell 中从工程根目录执行：

```powershell
& 'F:\Blender\blender.exe' --background "$PWD\Source\BUTTERFLY_FLAP_FAST_FOLLOW_PATH_1_WING_FLAP_ONLY.blend" --python '.\scripts\export_butterfly_slices.py' -- "$PWD\public\assets"
```

导出脚本具有以下约束：

- 只渲染带 `展示_` 前缀的身体、左翼和右翼网格。
- 相机沿世界 Z 轴正对模型的 X-Y 平面，使用固定正交投影，目标锁定在身体包围盒中心。
- 每个源整数帧生成一张静态 PNG，不插值、不跳帧；清单记录源帧与网页索引的一一映射。
- 导出先写入独立暂存目录，全部成功后才原子替换运行资产，避免中断时留下半套切片。
- 清除与主体不相连的低透明度渲染碎片；不修改源 `.blend`。

源 `.blend` 和参考 MP4 只用于离线采样与视觉研究，均被 Git 忽略。Git 只保存网页运行所需的 PNG 和清单。

## 启动

```powershell
npm install
npm run dev
```

也可以运行 `runStart.cmd`。

## 真实时间切片结构

- 91 个 Three.js 平面分别永久绑定 91 张纹理。运行中不会替换中心层纹理，也没有 `focusLayer` 或中心动画代理。
- 逐帧照片来自相机沿 Z 轴正对 X-Y 平面的采样；网页将照片映射到 X-Z 水平平面。
- 所有时间片法线一致，沿世界 Y 轴保持独立间距，因此彼此平行且不相交。
- 收拢时，相机沿 Y 轴穿过真实平面来切换姿态。展开时增大平面间距并自动转到斜侧总览，能直接看到水平分层结构。
- 画面没有独立的中心装饰框；可见边界只属于 91 个真实切片自身。

## 交互

- 滚轮：一次前进或后退一个实体切片；`Shift + 滚轮` 一次移动五帧。
- 左键径向拖拽：向外展开 91 层，向内收拢。
- 右键拖拽或 `Alt + 左键拖拽`：检查水平切片的侧视角。
- `Control/Command + 滚轮`：缩放。
- 正向/反向按钮：沿真实平面逐帧穿梭，再次点击当前方向暂停。
- 方向键：逐帧穿梭；`Shift + 方向键` 一次五帧；`Home`/`End` 跳到首尾。
- `E`：展开或收拢；`R`：恢复正视和默认缩放；空格：开始或暂停正向穿梭。

系统启用 `prefers-reduced-motion` 时会关闭非必要缓动和环境呼吸，但仍保留逐帧穿梭与展开结构。
