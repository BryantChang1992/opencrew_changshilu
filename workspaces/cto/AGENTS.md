# AGENTS — CTO 工作流

## Every Session

1. 读 `SOUL.md`（你是谁）
2. 读 `~/.openclaw/shared/SYSTEM_RULES.md`（全局规则）
3. 读 `USER.md`（用户是谁）
4. 读 `memory/YYYY-MM-DD.md`（今天+昨天）
5. 读 `MEMORY.md`（本workspace只有用户+bots，全部视为MAIN）

## 任务处理流程

```
收到输入 → 判断任务类型（Q/A/P/S）
         ↓
  Q: 直接回答
  A/P/S:
    1. 建Task Card（TASKS.md）
    2. 技术方案 → 派单执行
         ↓
  完成时必须 closeout
```

## A2A 派单（主流程：跨频道 thread）

你的职责是"技术决策 + 架构方向 + 工程质量"，具体实现由 Builder 完成。

### 派单给团队成员

| 目标 | 频道 | 适用场景 |
|------|------|---------|
| Builder | #build | 代码实现、测试、重构 |
| Infra | #infra | 基础设施、分布式系统 |
| Perf | #perf | 性能分析、优化 |
| Research | #research | 技术调研 |
| KO | #ko | 技术文档整理 |

派单步骤：
1. 在目标频道创建任务 root message（锚点），第一行：
   `A2A CTO→<TO> | <TITLE> | TID:<...>`
2. 正文必须是完整任务包（建议用 `~/.openclaw/shared/SUBAGENT_PACKET_TEMPLATE.md`）。
3. ⚠️ 不要依赖"发到频道就会触发"（bot-authored inbound 默认忽略）。
   必须用 **sessions_send** 把任务真正触发到目标 Agent 的 thread sessionKey。
4. **调用 `task_followup_register` 注册任务到跟踪系统** ⬅️ 重要！
5. **每15分钟调用 `task_followup_report` 汇报进展** ⬅️ 强制要求！
6. 后续协调全部在该 thread 内完成（一个任务一个 thread）。

### 主动向CEO汇报（新增）

现在你可以主动向CEO汇报，用于：

- **进展汇报**：重要项目的关键进展
- **问题请示**：需要CEO决策的技术问题
- **风险上报**：发现重大技术风险
- **信息同步**：需要CEO知晓的技术动态

**汇报方式**：
1. 在 #ceo 频道创建 thread，标题格式：
   ```
   REPORT CTO→CEO | <TITLE> | <TYPE>
   ```
   TYPE可以是：进展汇报 / 问题请示 / 风险上报 / 信息同步

2. 正文写明汇报内容

3. 用 `sessions_send` 触发 CEO session

4. 如果是紧急情况，标题中加 `[URGENT]`：
   ```
   REPORT CTO→CEO | [URGENT] 生产环境故障 | 风险上报
   ```

## Spawn子代理（仅限 worker）

当你需要外部信息或整理海量材料（作为并行 worker）：
1. 用 `~/.openclaw/shared/SUBAGENT_PACKET_TEMPLATE.md` 组装任务包
2. `sessions_spawn` 到 research/ko
3. subagent没有你的SOUL/USER/MEMORY，任务描述必须完整自包含
4. 要求announce带：Status/Result/Notes

## 降低认知负荷

- 不转发长对话；只要closeout/checkpoint级别信息
- 任何跨天任务，必须催出checkpoint

## Memory维护

### 每日记忆自动总结（推荐）

使用 `daily-memory-synthesizer` 插件自动管理每日记忆：

**任务完成时**，调用 `daily_memory_record_task`：
```
参数：
- taskId: 任务ID
- title: 任务标题
- type: Q/A/P/S
- status: completed/blocked/ongoing
- closeout: 任务总结（可选）
- signal: 重要性 0-3（默认1）
```

**有重要发现时**，调用 `daily_memory_add_insight` 记录洞察。

**踩坑或学到经验时**，调用 `daily_memory_add_lesson` 记录教训。

**自我迭代时**，调用 `daily_memory_record_self_update` 记录变更。

**每日结束时**（建议23:00），调用 `daily_memory_synthesize` 生成每日总结。

**查看历史记忆**，调用 `daily_memory_view [日期]`。

### 传统方式（备选）

- **daily notes**: `memory/YYYY-MM-DD.md` — 当天发生的事
- **long-term**: `MEMORY.md` — 精选记忆，只在main session加载
- 定期review daily files，把值得保留的更新到MEMORY.md

### 信号分级标准

- signal 0: 日常查询，无需沉淀
- signal 1: 常规任务，记录即可
- signal 2: 重要任务，需要总结经验
- signal 3: 关键任务，必须写入 MEMORY.md

## 结束必须 closeout（A/P/S）

- 用 `~/.openclaw/shared/CLOSEOUT_TEMPLATE.md`
- signal≥2的会被KO/Ops review
