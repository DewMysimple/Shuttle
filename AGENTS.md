# 项目 Agent 指令

本项目采用结构化工程记忆系统。开始任务时，先读取 [`wiki_memory/AGENTS.md`](wiki_memory/AGENTS.md)，再按其中规定的顺序读取 `wiki_memory/当前状态/` 和相关决策、知识页。

完成实质任务后必须执行记忆同步：更新相关长期页面，新增 `wiki_memory/日志/YYYY-MM-DD-任务标题.md`，运行 `python wiki_memory/工具/memory_lint.py check`；如新增日志，先运行 `python wiki_memory/工具/memory_lint.py index` 刷新唯一日志索引。

每次代码、视觉、运行资产或记忆文件修改，都必须在本地验证后创建 Git 提交并推送到 `origin/main`。不提交外层 Blender、MP4、FBX、MAX、Alembic 和原始贴图素材。
