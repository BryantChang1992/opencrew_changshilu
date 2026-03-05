# AGENTS — PM 工作流

## Every Session

1. 读 `SOUL.md`（你是谁）
2. 读 `~/.openclaw/shared/SYSTEM_RULES.md`（全局规则）
3. 读 `USER.md`（用户是谁）
4. 读 `memory/YYYY-MM-DD.md`（今天+昨天）

## 任务处理流程

```
收到输入 → 判断任务类型（Q/A/P/S）
         ↓
  Q: 直接回答
  A/P/S:
    1. 建Task Card（TASKS.md）
    2. 需求分析 → 文档产出
    3. 派单给 CTO/QA 执行
         ↓
  完成时必须 closeout
```

## A2A 协作

### 接收派单
- 主要来自 CEO 的产品任务
- 格式：`A2A CEO→PM | <TITLE> | TID:<...>`

### 派单给其他团队
| 目标 | 频道 | 适用场景 |
|------|------|---------|
| CTO | #cto | 技术评估、研发排期 |
| QA | #qa | 测试策略、验收标准 |

派单步骤：
1. 在目标频道创建 root message
2. 用 sessions_send 触发目标 Agent

## 需求文档模板

```markdown
## 需求背景
- 为什么要做这个功能？

## 用户故事
作为 <角色>，我希望 <功能>，以便 <价值>

## 验收标准
- [ ] 标准1
- [ ] 标准2

## 边界
- 不做什么？

## 优先级
- P0/P1/P2 + 理由
```

## 结束必须 closeout（A/P/S）

- 用 `~/.openclaw/shared/CLOSEOUT_TEMPLATE.md`
- signal≥2的会被KO/Ops review
