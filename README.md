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
- 时间选择与视口导航彼此独立：逐帧播放只改变被选中的实体平面；自由相机不会再被时间轴每帧覆写。默认透视视图围绕整组切片建立固定枢轴，可从任意方向查看水平分层结构。
- 首屏从中位的第 46 帧进入展开总览，使当前实体帧位于完整时间体中央；首尾仍可通过按钮直接到达。
- 画面没有独立的中心装饰框；可见边界只属于 91 个真实切片自身。

## 交互

- Blender 风格三维导航：中键拖拽旋转，`Shift + 中键` 平移，滚轮缩放；同时保留左键旋转与右键平移，便于触控板和普通网页用户操作。
- `Alt + 滚轮`：一次前进或后退一个实体切片；再按 `Shift` 时一次移动五帧。普通滚轮完整保留给三维视口缩放。
- `Alt + 左键` 径向向外拖拽：展开 91 层；向内拖拽收拢。也可点击右下角按钮或按 `E` 切换层距。
- 视口预设：`透视` 框显整组实体切片，`前`/`侧` 检查平行与不相交关系，`当前帧` 回到蝴蝶固定构图。`Home`/`R` 框显全部，数字键盘 `1`/`3`/`7` 对应前视、侧视和当前帧俯视。
- 正向/反向按钮：沿真实平面逐帧穿梭，再次点击当前方向暂停。
- 方向键：逐帧穿梭；`Shift + 方向键` 一次五帧；`Ctrl/Command + Home` 跳到首帧，`End` 跳到尾帧，空格开始或暂停正向穿梭。

系统启用 `prefers-reduced-motion` 时会关闭非必要缓动和环境呼吸，但仍保留逐帧穿梭与展开结构。
