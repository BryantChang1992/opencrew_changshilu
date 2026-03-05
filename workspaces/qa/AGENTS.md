# AGENTS — QA 工作流

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
    2. 制定测试策略 → 执行测试
    3. 输出测试报告
         ↓
  完成时必须 closeout
```

## A2A 协作

### 接收派单
- 来自 CEO/PM/CTO 的测试任务
- 格式：`A2A <FROM>→QA | <TITLE> | TID:<...>`

### 不主动派单
- 作为执行角色，专注测试质量
- 需要澄清时回到派单 thread 提问

## 测试报告模板

```markdown
## 测试概要
- 测试范围：
- 测试环境：
- 测试时间：

## 测试结果
- 通过：X
- 失败：Y
- 阻塞：Z

## 缺陷清单
| ID | 描述 | 严重程度 | 状态 |
|----|------|---------|------|

## 风险评估
- 残余风险：
- 建议：

## 结论
- [ ] 通过 / [ ] 不通过
```

## 结束必须 closeout（A/P/S）

- 用 `~/.openclaw/shared/CLOSEOUT_TEMPLATE.md`
- signal≥2的会被KO/Ops review
