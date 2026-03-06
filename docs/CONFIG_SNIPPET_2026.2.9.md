**中文** | [English](en/CONFIG_SNIPPET_2026.2.9.md)

> 📖 [README](../README.md) → [完整上手指南](GETTING_STARTED.md) → **配置参考**

# OpenClaw 2026.2.9 — OpenCrew 公司制架构配置

> 适用：已经在本机安装并能运行 OpenClaw（能执行 `openclaw status`）。
>
> 原则：
> - 不提供"完整 openclaw.json"（避免误覆盖 `auth/models/gateway`）
> - 只提供 **最小增量**：新增 Agents + Slack 频道绑定 + A2A 限制
> - 可回滚：删除我们新增的片段 + 删除新建的 workspace 目录

---

## 改之前先做备份（强烈建议）

```bash
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak.$(date +%Y%m%d-%H%M%S)
```

---

## 你需要准备的占位符

- Slack Channel IDs：
  - `<SLACK_CHANNEL_ID_CEO>`（#ceo）
  - `<SLACK_CHANNEL_ID_PM>`（#pm）
  - `<SLACK_CHANNEL_ID_CTO>`（#cto）
  - `<SLACK_CHANNEL_ID_BUILD>`（#build）
  - `<SLACK_CHANNEL_ID_INFRA>`（#infra）
  - `<SLACK_CHANNEL_ID_PERF>`（#perf）
  - `<SLACK_CHANNEL_ID_QA>`（#qa）
  - `<SLACK_CHANNEL_ID_OPS>`（#ops）
  - `<SLACK_CHANNEL_ID_CFO>`（#cfo）
  - `<SLACK_CHANNEL_ID_SUPPORT>`（#support）
  - `<SLACK_CHANNEL_ID_RESEARCH>`（#research，可选，spawn-only）
  - `<SLACK_CHANNEL_ID_KO>`（#ko，可选，spawn-only）

获取方法见：[`docs/SLACK_SETUP.md`](./SLACK_SETUP.md)

---

## 需要加到 `~/.openclaw/openclaw.json` 的最小增量

> 说明：以下片段假设你已经有自己的 `openclaw.json`。你只需要把这些**新增项**合并进去即可。
>
> 如果你已经有同名 agent id，请改成不冲突的 id，并同步修改 bindings。

### A) 新增 Agents（`agents.list`）

把这些 agent 追加到你现有的 `agents.list` 里（不要删除你原来的 `main`）：

```json
{
  "agents": {
    "list": [
      {
        "id": "ceo",
        "name": "Chief Executive Officer",
        "workspace": "~/.openclaw/workspace-ceo",
        "subagents": { "allowAgents": ["ceo", "research", "ko"] },
        "heartbeat": { "every": "12h", "target": "slack", "to": "channel:<SLACK_CHANNEL_ID_CEO>" }
      },
      {
        "id": "pm",
        "name": "Product Manager",
        "workspace": "~/.openclaw/workspace-pm",
        "subagents": { "allowAgents": ["pm", "research"] }
      },
      {
        "id": "cto",
        "name": "CTO / Tech Lead",
        "workspace": "~/.openclaw/workspace-cto",
        "subagents": { "allowAgents": ["cto", "builder", "infra", "perf", "research", "ko"] }
      },
      {
        "id": "builder",
        "name": "Builder / Executor",
        "workspace": "~/.openclaw/workspace-builder",
        "subagents": { "allowAgents": ["builder"] }
      },
      {
        "id": "infra",
        "name": "Infrastructure Architect",
        "workspace": "~/.openclaw/workspace-infra",
        "subagents": { "allowAgents": ["infra", "research", "ko"] }
      },
      {
        "id": "perf",
        "name": "Performance Engineer",
        "workspace": "~/.openclaw/workspace-perf",
        "subagents": { "allowAgents": ["perf", "research", "ko"] },
        "heartbeat": { "every": "24h", "target": "slack", "to": "channel:<SLACK_CHANNEL_ID_PERF>" }
      },
      {
        "id": "qa",
        "name": "Quality Assurance",
        "workspace": "~/.openclaw/workspace-qa",
        "subagents": { "allowAgents": ["qa"] }
      },
      {
        "id": "ops",
        "name": "Operations / Governance",
        "workspace": "~/.openclaw/workspace-ops",
        "subagents": { "allowAgents": ["ops", "ko"] }
      },
      {
        "id": "cfo",
        "name": "Chief Financial Officer",
        "workspace": "~/.openclaw/workspace-cfo",
        "subagents": { "allowAgents": ["cfo", "ko"] }
      },
      {
        "id": "support",
        "name": "OpenClaw Support",
        "workspace": "~/.openclaw/workspace-support",
        "subagents": { "allowAgents": ["support"] }
      },
      {
        "id": "research",
        "name": "Research Worker (Spawn-only)",
        "workspace": "~/.openclaw/workspace-research",
        "subagents": { "allowAgents": [] }
      },
      {
        "id": "ko",
        "name": "Knowledge Officer (Spawn-only)",
        "workspace": "~/.openclaw/workspace-ko",
        "subagents": { "allowAgents": [] }
      }
    ]
  }
}
```

### B) A2A / 子智能体保护（`tools` + `session`）

```json
{
  "tools": {
    "agentToAgent": { "enabled": true, "allow": ["ceo", "pm", "cto", "ops", "cfo"] },
    "subagents": { "tools": { "deny": ["group:sessions"] } }
  },
  "session": {
    "agentToAgent": { "maxPingPongTurns": 4 }
  }
}
```

### C) Slack 频道绑定（`bindings`）

> 注：Research 和 KO 是 spawn-only 角色，可以不绑定频道。

```json
{
  "bindings": [
    { "agentId": "ceo", "match": { "channel": "slack", "peer": { "kind": "channel", "id": "<SLACK_CHANNEL_ID_CEO>" } } },
    { "agentId": "pm", "match": { "channel": "slack", "peer": { "kind": "channel", "id": "<SLACK_CHANNEL_ID_PM>" } } },
    { "agentId": "cto", "match": { "channel": "slack", "peer": { "kind": "channel", "id": "<SLACK_CHANNEL_ID_CTO>" } } },
    { "agentId": "builder", "match": { "channel": "slack", "peer": { "kind": "channel", "id": "<SLACK_CHANNEL_ID_BUILD>" } } },
    { "agentId": "infra", "match": { "channel": "slack", "peer": { "kind": "channel", "id": "<SLACK_CHANNEL_ID_INFRA>" } } },
    { "agentId": "perf", "match": { "channel": "slack", "peer": { "kind": "channel", "id": "<SLACK_CHANNEL_ID_PERF>" } } },
    { "agentId": "qa", "match": { "channel": "slack", "peer": { "kind": "channel", "id": "<SLACK_CHANNEL_ID_QA>" } } },
    { "agentId": "ops", "match": { "channel": "slack", "peer": { "kind": "channel", "id": "<SLACK_CHANNEL_ID_OPS>" } } },
    { "agentId": "cfo", "match": { "channel": "slack", "peer": { "kind": "channel", "id": "<SLACK_CHANNEL_ID_CFO>" } } },
    { "agentId": "support", "match": { "channel": "slack", "peer": { "kind": "channel", "id": "<SLACK_CHANNEL_ID_SUPPORT>" } } }
  ]
}
```

### D) Slack allowlist + thread 隔离（`channels.slack`）

```json
{
  "channels": {
    "slack": {
      "replyToMode": "all",
      "groupPolicy": "allowlist",
      "channels": {
        "<SLACK_CHANNEL_ID_CEO>": { "allow": true, "requireMention": false },
        "<SLACK_CHANNEL_ID_PM>": { "allow": true, "requireMention": false },
        "<SLACK_CHANNEL_ID_CTO>": { "allow": true, "requireMention": false },
        "<SLACK_CHANNEL_ID_BUILD>": { "allow": true, "requireMention": false },
        "<SLACK_CHANNEL_ID_INFRA>": { "allow": true, "requireMention": false },
        "<SLACK_CHANNEL_ID_PERF>": { "allow": true, "requireMention": false },
        "<SLACK_CHANNEL_ID_QA>": { "allow": true, "requireMention": false },
        "<SLACK_CHANNEL_ID_OPS>": { "allow": true, "requireMention": false },
        "<SLACK_CHANNEL_ID_CFO>": { "allow": true, "requireMention": false },
        "<SLACK_CHANNEL_ID_SUPPORT>": { "allow": true, "requireMention": false }
      },
      "thread": { "historyScope": "thread", "inheritParent": false }
    }
  }
}
```

### 可选：开启 @mention gate（降噪；建议你跑通后再开）

开源版默认所有频道设为 `requireMention: false`，优先保证"照着做就能跑起来"。

如果你希望某些频道更安静（只在你显式 @mention 时才触发），把对应项改成 `true`：

```json
{
  "channels": {
    "slack": {
      "channels": {
        "<SLACK_CHANNEL_ID_SUPPORT>": { "allow": true, "requireMention": true }
      }
    }
  }
}
```

### E) Heartbeat（推荐默认开启：本 snippet 已为 CEO/Perf 开启）

很多人以为"有了 `HEARTBEAT.md` 文件就会自动跑心跳"，但 **心跳是否运行由 `openclaw.json` 决定**。

在上面的 `agents.list` 示例里，我们已经为 `ceo` / `perf` 加了：
- `heartbeat.every = "12h"` 或 `"24h"`
- `heartbeat.target = "slack"` + `to = "channel:<...>"`

> 重要规则（来自 OpenClaw 文档）：
> 如果 `agents.list[]` 里**任何一个** agent 配了 `heartbeat` 块，那么**只有**配置了 `heartbeat` 的 agents 才会运行心跳。
> 因此：如果你原本依赖 `agents.defaults.heartbeat` 跑"全局心跳"，引入 per-agent heartbeat 后行为会变化。

如果你不想让 CEO/Perf 运行心跳：删除对应 agent 条目中的 `heartbeat` 块即可。
验证心跳是否在跑：

```bash
openclaw system heartbeat last
# 需要时可手动启用/禁用
openclaw system heartbeat enable
openclaw system heartbeat disable
```

> 如果你想"固定每天 09:00/21:00 准时触发"，更适合用 cron；heartbeat 更适合"间隔型、自检型"。

### F) 工作区目录准备（强烈建议）

OpenCrew 的工作流会用到一些子目录（用于 daily memory、KO inbox/knowledge、CTO scars/patterns 等）。
建议先创建（不会影响你现有配置）：

```bash
# CEO
mkdir -p ~/.openclaw/workspace-ceo/{memory,board}

# PM
mkdir -p ~/.openclaw/workspace-pm/memory

# CTO
mkdir -p ~/.openclaw/workspace-cto/{memory,scars,patterns}

# Builder
mkdir -p ~/.openclaw/workspace-builder/memory

# Infra
mkdir -p ~/.openclaw/workspace-infra/{memory,principles,decisions,benchmarks,watchlist,signals}

# Perf
mkdir -p ~/.openclaw/workspace-perf/{memory,principles,decisions,benchmarks,reports}

# QA
mkdir -p ~/.openclaw/workspace-qa/{memory,test-cases,reports}

# Ops
mkdir -p ~/.openclaw/workspace-ops/memory

# CFO
mkdir -p ~/.openclaw/workspace-cfo/{memory,reports,records}

# Support
mkdir -p ~/.openclaw/workspace-support/{memory,operations,authorizations}

# Research (spawn-only)
mkdir -p ~/.openclaw/workspace-research/memory

# KO (spawn-only)
mkdir -p ~/.openclaw/workspace-ko/{inbox,knowledge,memory}
```

### G) 可选：启用 Daily Memory Synthesizer 插件（推荐）

Daily Memory Synthesizer 插件让每个 Agent 在每天结束时自主总结当日的经验教训，形成自我迭代机制。

#### 全新部署

在 `openclaw.json` 中添加插件全局配置：

```json
{
  "plugins": {
    "daily-memory-synthesizer": {
      "enabled": true,
      "config": {
        "memoryDir": "memory",
        "timezone": "Asia/Shanghai",
        "summaryHour": 23,
        "enableAutoSummary": true,
        "maxTasksPerDay": 20
      }
    }
  }
}
```

然后在每个需要的 Agent 配置中添加插件：

```json
{
  "agents": {
    "list": [
      {
        "id": "ceo",
        "name": "Chief Executive Officer",
        "workspace": "~/.openclaw/workspace-ceo",
        "plugins": ["daily-memory-synthesizer"],
        "subagents": { "allowAgents": ["ceo", "research", "ko"] }
      },
      {
        "id": "cto",
        "name": "CTO / Tech Lead",
        "workspace": "~/.openclaw/workspace-cto",
        "plugins": ["daily-memory-synthesizer"],
        "subagents": { "allowAgents": ["cto", "builder", "infra", "perf", "research", "ko"] }
      },
      {
        "id": "pm",
        "name": "Product Manager",
        "workspace": "~/.openclaw/workspace-pm",
        "plugins": ["daily-memory-synthesizer"],
        "subagents": { "allowAgents": ["pm", "research"] }
      },
      {
        "id": "ops",
        "name": "Operations",
        "workspace": "~/.openclaw/workspace-ops",
        "plugins": ["daily-memory-synthesizer"],
        "subagents": { "allowAgents": ["ops", "ko"] }
      }
    ]
  }
}
```

#### 增量部署

如果你已经部署了 OpenCrew，只需：

1. 添加插件全局配置（见上）
2. 在需要的 Agent 配置中添加 `"plugins": ["daily-memory-synthesizer"]`
3. 重启：`openclaw gateway restart`

#### 与 Memory Router 协同使用

建议同时启用两个插件：

```json
{
  "id": "ceo",
  "plugins": [
    "memory-router",              // 检索已有记忆
    "daily-memory-synthesizer"    // 生成每日记忆
  ]
}
```

#### 详细文档

完整的部署和使用指南请参考：**`docs/DAILY_MEMORY_SYNTHESIZER_SETUP.md`**

---

## 应用后：重启 + 验证

```bash
openclaw gateway restart
openclaw status
```

验证建议：
1) 在 #ceo 发消息 → CEO 应答
2) 让 CEO 派单给 CTO → #cto 出现 thread，CTO 在 thread 内回复
3) 在 #cto 让 CTO 派单给 Builder → #build 出现 thread，Builder 在 thread 内回复

---

## 回滚方式（很重要）

1) 直接恢复备份：

```bash
cp ~/.openclaw/openclaw.json.bak.<timestamp> ~/.openclaw/openclaw.json
openclaw gateway restart
```

2) 或手动回滚：
- 从 `openclaw.json` 删除本文件中新增的：
  - `agents.list` 里新增的 OpenCrew agents
  - `bindings` 新增条目
  - `channels.slack.channels` 的 allowlist 条目
  - `tools.agentToAgent` / `session.agentToAgent` 的增量
- （可选）删除新建目录：`~/.openclaw/workspace-{ceo,pm,cto,builder,infra,perf,qa,ops,cfo,support,research,ko}`

---

## 组织架构参考

```
董事层
├── 用户（人类）- 最终决策者
└── CEO - 执行董事

执行团队
├── 产品团队 → PM
├── 研发团队 → CTO / Builder / Infra / Perf
├── 测试团队 → QA
├── 运营团队 → Ops
├── 财务团队 → CFO
└── 售后团队 → Support

Spawn-only 角色
├── Research (调研员)
└── KO (知识官，知识沉淀)
```
