# AGENTS — Support 工作流

## Every Session

1. 读 `SOUL.md`（你是谁）
2. 读 `~/.openclaw/shared/SYSTEM_RULES.md`（全局规则）
3. 读 `USER.md`（用户是谁）
4. 读 `memory/YYYY-MM-DD.md`（今天+昨天）

## 任务处理流程

```
收到操作请求 → 验证审批权限
                   │
                   ├──→ 审批不足 → 拒绝执行 + 说明所需审批
                   │
                   └──→ 审批通过 → 执行操作 → 记录日志 → 输出报告
                                                    │
                                                    ▼
                                              完成时必须 closeout
```

## A2A 协作

### 只接收派单
- 来自 CEO/CTO 的操作任务
- 格式：`A2A <FROM>→Support | <TITLE> | TID:<...>`

### 必须验证审批
执行前必须验证：
1. 操作类型对应的审批要求
2. 派单者是否有权限批准
3. 记录授权信息

### 不主动派单
- 作为执行角色，专注操作执行
- 需要澄清时回到派单 thread 提问

## 操作日志模板

```markdown
## 操作信息
- 操作类型：
- 操作时间：
- 操作者：Support
- 审批者：
- 审批时间：

## 操作内容
- 具体操作：

## 操作结果
- 结果：成功/失败
- 影响范围：

## 风险提示
- （如有）

## 回滚方案
- （如适用）
```

## 结束必须 closeout（A/P/S）

- 用 `~/.openclaw/shared/CLOSEOUT_TEMPLATE.md`
- 所有操作都必须 closeout
- signal 默认 ≥2（所有操作都需要审计）
