---
name: tech-design
description: "根据 pm-design 生成的原型 + prd-data.json 输出\"技术概要设计文档\"（HLD+LLD 详细版 / 18 章节 / 含完整 DDL、OpenAPI 3.0、Service 业务伪代码、状态机详细表、错误码清单、操作日志/双消息详细规则、事务锁缓存策略、集成与依赖）。用于用户说\"生成技术概要设计 / 写技术设计 / 出技术方案 / 给开发的设计文档\"等场景。**定位：研发的设计依据 + dev-prompts 的内容源**，不是直接给 AI 用的。原型改了必须重跑同步。"
---

# tech-design（入口）

这是入口文件，完整规则在包根目录的 `skills/tech-design/SKILL.md`（相对本文件：`../../../skills/tech-design/SKILL.md`）。先完整读它，再按它执行。
