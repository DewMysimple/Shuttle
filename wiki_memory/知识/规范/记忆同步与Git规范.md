---
type: knowledge
status: active
kind: process
importance: high
updated: 2026-08-30
topic: memory-and-git-conventions
source_logs:
  - "[[日志/2026-08-30-工程初始化与远程管理]]"
  - "[[日志/2026-08-30-wiki_memory结构化]]"
supersedes: null
---

# 记忆同步与 Git 规范

## 一句话结论

代码、视觉、运行资产和工程记忆必须作为同一个可追溯变更提交，并推送到远程 `main`。

## 适用范围

本项目所有后续会话和所有会改变仓库状态的操作。

## 详细内容

- Git 根目录是当前网页工程目录，远程为 `origin`，主分支为 `main`。
- 结构化记忆使用 YAML frontmatter、Obsidian wiki 链接和唯一 MOC 日志索引。
- 每次实质任务新增一篇 `日志/YYYY-MM-DD-任务标题.md`，不改写已封存日志。
- 当前有效事实进入 `当前状态/`；已确认选型进入 `决策/`；稳定流程进入 `知识/`。
- 二进制运行资产可以提交，但外层源素材和约 106 MB 的 Alembic 缓存不提交。

## 常见问题或陷阱

- 不要把密钥、令牌或机器特定绝对路径写入 wiki memory。
- 不要用自定义单文件摘要替代 `当前状态/`、`决策/`、`知识/`、`日志/` 分层。
- 推送前必须确认工作区干净且远程分支已经包含最新提交。

## 来源

- [[决策/ADR-004-仓库与记忆同步策略|ADR-004 仓库与记忆同步策略]]
- [[日志/2026-08-30-wiki_memory结构化|wiki_memory 结构化]]
