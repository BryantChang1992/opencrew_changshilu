# A2A 协作协议（Slack 多 Agent）

> 目标：让 Agent 之间的协作 **自动发生在正确的 Slack 频道/线程里**，做到：
> - 可见（用户 能在频道里看到）
> - 可追踪（每个任务一个 thread/session）
> - 不串上下文（thread 级隔离 + 任务包完整）

---

## 0. 术语

- **A2A（本文）**：Agent-to-Agent 协作流程（不等同于 OpenClaw 的某一个单独工具名）。
- **Task Thread**：在目标 Agent 的 Slack 频道里创建的任务线程；该线程即该任务的独立 Session。

---

## 1) 权限矩阵（必须遵守）

### 派单权限（单向）

```
CEO      → 可派单给 PM/CTO/QA/Ops/CFO/Support
PM       → 可派单给 CTO/QA
CTO      → 可派单给 Builder/Infra/Perf/Support
Infra    → 可 spawn research/ko
Perf     → 可 spawn research/ko
Builder  → 只接单执行；需要澄清时回到 CTO thread 提问
QA       → 只接单执行
Ops      → 作为审计/沉淀，通常不主动派单；可 spawn ko
CFO      → 可 spawn ko（财务知识沉淀）
Support  → 只接收派单，不主动派单
```

### 双向沟通权限（新增）

**重要变更**：所有团队负责人现在都可以主动与CEO沟通（但不能派单给CEO）。

```
PM/CTO/QA/Ops/CFO/Support → CEO
  ✅ 允许：汇报进展、请示问题、上报风险、主动同步信息
  ❌ 禁止：派单给CEO

Builder/Infra/Perf → CEO
  ✅ 允许：通过CTO间接汇报（先向CTO汇报，CTO决定是否上报CEO）
  ❌ 禁止：直接联系CEO（需遵守层级管理）
```

**沟通方式**：
1. **主动汇报**：在 #ceo 频道创建 thread，标题格式：
   ```
   REPORT <FROM>→CEO | <TITLE> | <TYPE>
   ```
   TYPE可以是：`进展汇报` / `问题请示` / `风险上报` / `信息同步`

2. **紧急情况**：如果需要CEO立即关注，在标题中加 `[URGENT]`：
   ```
   REPORT <FROM>→CEO | [URGENT] <TITLE> | 风险上报
   ```

3. **必须使用 sessions_send**：和派单一样，需要用 sessions_send 触发CEO session

### Spawn-only 角色

```
Research → 被 CEO/CTO/Infra/Perf/PM spawn 调用
KO       → 被 CEO/CTO/Infra/Perf/Ops/CFO spawn 调用
```

（注：技术上 Slack bot 可以给任意频道发消息，但这是组织纪律，不遵守视为 bug。）

---

## 2) A2A 触发方式（核心）

当 A 想让 B 开工时（**不允许人工复制粘贴**）：

> ⚠️ 重要现实：Slack 中所有 Agent 共用同一个 bot 身份。
> **bot 自己发到别的频道的消息，默认不会触发对方 Agent 自动运行**（OpenClaw 默认忽略 bot-authored inbound，避免自循环）。
> 因此：跨 Agent 的"真正触发"必须通过 **sessions_send（agent-to-agent）** 完成；Slack 发消息仅作为"可见性锚点"。

### Step 1 — 在目标频道创建可见的 root message（锚点）
A 在 B 的 Slack 频道创建一个任务根消息（root message），第一行固定前缀：

```
A2A <FROM>→<TO> | <TITLE> | TID:<YYYYMMDD-HHMM>-<short>
```

正文必须是完整任务包（建议使用 `~/.openclaw/shared/SUBAGENT_PACKET_TEMPLATE.md`）：
- Objective（目标）
- DoD（完成标准）
- Inputs（已有信息/链接/文件）
- Constraints（约束/边界）
- Output format（输出格式）
- CC（需要同步到哪个频道/人）

> 前置条件：OpenClaw bot 必须被邀请进目标频道，否则会报 `not_in_channel`。

### Step 2 — 用 sessions_send 触发 B 在该 thread/session 中运行
A 读取 root message 的 Slack message id（ts），拼出 thread sessionKey：

- 频道 session：`agent:<B>:slack:channel:<channelId>`
- 线程 session：`agent:<B>:slack:channel:<channelId>:thread:<root_ts>`

然后 A 用 `sessions_send(sessionKey=..., message=<完整任务包或第一步的引用>)` 触发 B。

### Step 3 — 执行与汇报
- B 的执行与产出都留在该 thread。
- 需要上游（如 CTO）掌控节奏时，上游应在自己的协调 thread 里同步 checkpoint/closeout（见第 3 节）。

---

## 3) 可见性（用户 必须能看到）

- 任务根消息必须在目标频道可见（root message 作为锚点）。
- 关键 checkpoint（开始/阻塞/完成）至少更新 1 次。
- **上游负责到底**：谁派单（例如 CTO 派给 Builder），谁负责在自己的协调 thread 里持续跟进：
  - Builder thread 的输出由 CTO 通过 sessions_send 的 tool result 捕获
  - CTO 必须在 #cto 的对应协调 thread 里同步 checkpoint（避免 用户 去多个频道"捞信息"）
- **定期汇报**：A 每 15 分钟在自己的协调 thread 里汇报任务进展（详见 `SYSTEM_RULES.md` 第 10 节）
- 完成后必须 closeout：
  - 结果摘要
  - 产出链接
  - 风险/遗留
  - 是否需要 KO 写入知识（默认：spawn KO 处理）

---

## 4) 频道映射（约定）

| 频道 | Agent | 团队 |
|------|-------|------|
| #ceo | CEO | 董事层 |
| #pm | PM | 产品团队 |
| #cto | CTO | 研发团队 |
| #build | Builder | 研发团队 |
| #infra | Infra | 研发团队 |
| #perf | Perf | 研发团队 |
| #qa | QA | 测试团队 |
| #ops | Ops | 运营团队 |
| #cfo | CFO | 财务团队 |
| #support | Support | 售后团队 |

**Spawn-only 角色（不绑定频道）**：
- Research：被 CEO/CTO/Infra/Perf/PM spawn 调用
- KO：被 CEO/CTO/Infra/Perf/Ops/CFO spawn 调用

---

## 5) 命名与并行

- **一个任务 = 一个 thread = 一个 session**。
- 同一个频道可以并行多个任务 thread；不要在频道主线里混聊多个任务。

---

## 6) 失败回退

如果 Slack thread 行为异常：
- 退回到"单频道单任务"：临时在频道主线完成该任务
- 或让 CEO/CTO 在 thread 里发 /new 重置（开始新 session id）

---

## 7) Spawn-only 角色使用

Research 和 KO 是 spawn-only 角色，不绑定固定频道，由各团队负责人按需调用：

| 角色 | 可 spawn 的团队负责人 | 用途 |
|------|----------------------|------|
| Research | CEO / CTO / Infra / Perf / PM | 技术调研、信息收集 |
| KO | CEO / CTO / Infra / Perf / Ops / CFO | 知识沉淀、经验抽象 |

使用方式：
1. 用 `~/.openclaw/shared/SUBAGENT_PACKET_TEMPLATE.md` 组装任务包
2. `sessions_spawn` 到 research/ko
3. subagent 没有 SOUL/USER/MEMORY，任务描述必须完整自包含
4. 要求 announce 带：Status/Result/Notes

## 8) Support 团队特殊规则

Support 执行高权限操作前必须验证审批：

| 操作类型 | 风险等级 | 审批要求 |
|---------|---------|---------|
| 重启网关 | 高 | CEO 或用户批准 |
| 数据备份 | 中 | CTO 批准 |
| 数据恢复 | 极高 | CEO + 用户双重批准 |
| 配置变更 | 高 | CTO 批准 |
| 紧急停服 | 极高 | CEO 批准 |
| 日志导出 | 低 | 自动记录 |

派单给 Support 时，派单者必须明确表示已审批，否则 Support 有权拒绝执行。
