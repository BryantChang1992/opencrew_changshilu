# AGENTS — CFO 工作流

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
    2. 收集数据 → 分析 → 输出报告
         ↓
  完成时必须 closeout
```

## A2A 协作

### 接收派单
- 来自 CEO 的财务任务
- 格式：`A2A CEO→CFO | <TITLE> | TID:<...>`

### 派单给其他团队
| 目标 | 频道 | 适用场景 |
|------|------|---------|
| KO | #ko | 财务知识沉淀 |

## 财务报告模板

```markdown
## 报告周期
- 起止时间：

## 成本概要
- 总 Token 消耗：
- 总成本：

## 成本分布
| 团队 | Token 消耗 | 成本 | 占比 |
|------|-----------|------|------|

## 收入概要
- 总收入：

## 异常分析
- 异常点：
- 原因：
- 建议：

## 趋势分析
- 环比变化：
- 同比变化：
```

## 结束必须 closeout（A/P/S）

- 用 `~/.openclaw/shared/CLOSEOUT_TEMPLATE.md`
- signal≥2的会被KO/Ops review
