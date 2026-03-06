**中文** | [English](DEPLOY.en.md)

# 部署指南（精简版）

> **本文适合直接发给你的 OpenClaw，让它代你执行部署。** 完整的人工操作指南（含详细说明、常见报错、验证清单）见 → [完整上手指南](docs/GETTING_STARTED.md)
>
> 原则：**不依赖"一键脚本"**、不提供"完整 openclaw.json"，用最小增量 + 可回滚的方式，把 OpenCrew 加进你现有的 OpenClaw。

---

## 🚀 选择你的部署方式

| 场景 | 推荐文档 | 说明 |
|------|----------|------|
| **首次部署** | 本文档 | 从零开始部署完整的 OpenCrew 多 Agent 团队 |
| **增量更新** | [增量部署指南](docs/INCREMENTAL_DEPLOY.md) | 已部署 OpenCrew，需要添加新插件或更新协议 |
| **添加插件** | 见下方插件章节 | Memory Router、Daily Memory Synthesizer、Task Follow-up |
| **更新协议** | [增量部署指南](docs/INCREMENTAL_DEPLOY.md) | 更新 A2A 协议、SYSTEM_RULES 等 |

**快速导航**:
- 首次部署 → 继续阅读下方 [前置要求](#0-前置要求新手请按顺序做)
- 添加 Task Follow-up 强制汇报机制 → [第9节](#9-可选task-followup-插件强制派单汇报机制) + [增量部署指南](docs/INCREMENTAL_DEPLOY.md#13-task-followup-插件)
- 添加每日记忆自动总结 → [第8节](#8-可选daily-memory-synthesizer-插件每日记忆自动总结) + [增量部署指南](docs/INCREMENTAL_DEPLOY.md#12-daily-memory-synthesizer-插件)
- 启用双向沟通机制 → [增量部署指南](docs/INCREMENTAL_DEPLOY.md#21-a2a-协议更新)

## 核心原则（所有 Agent 必须遵守）

### 团队文化：简单、坦诚、阳光、真实
- **简单**：沟通极简，结论先行
- **坦诚**：有问题直接说，不隐瞒
- **阳光**：积极面对问题，相信团队
- **真实**：**不造假，不怕出问题，及时解决**

### 派单跟进原则
- A 给 B 派单，A 每 15 分钟汇报进展
- **禁止派完单完全看不到进展**
- 任务结束自动结束汇报

---

## 0. 前置要求（新手请按顺序做）

1. 你能正常运行 OpenClaw（本机）
   - 能执行：`openclaw status`
2. 你有一个 Slack workspace
3. 你准备使用 **一个 Slack App** 来管理所有 OpenCrew Agent（后续增减 Agent 就是增减频道 + 配置绑定）

如果你还没把 Slack 接入 OpenClaw：先完成 [`docs/SLACK_SETUP.md`](docs/SLACK_SETUP.md)。

---

## 1. 创建 Slack 频道（岗位）

### 组织架构

```
董事层
├── 用户（人类）- 最终决策者
└── CEO - 执行董事，对齐用户意图、协调各团队

执行团队
├── 产品团队 → PM (产品负责人)
├── 研发团队 → CTO (技术负责人)
│   ├── Builder (代码实现)
│   ├── Infra (基础设施)
│   └── Perf (性能优化)
├── 测试团队 → QA (测试负责人)
├── 运营团队 → Ops (运营负责人)
├── 财务团队 → CFO (财务负责人)
└── OpenClaw 售后 → Support (高权限操作)

Spawn-only 角色（按需调用）
├── Research (调研员)
└── KO (知识官，知识沉淀)
```

### 建议创建的频道

**董事层**：
- #ceo（CEO 执行董事）

**执行团队**：
- #pm（产品负责人）
- #cto（CTO 技术负责人）
- #build（Builder 代码实现者）
- #infra（Infra 基础设施专家，精通分布式存储、文件系统、共识协议）
- #perf（Perf 性能评估专家）
- #qa（QA 测试负责人）
- #ops（Ops 运营负责人）
- #cfo（CFO 财务负责人）
- #support（Support OpenClaw售后，负责高权限操作）

**可选（spawn-only，可以不创建频道）**：
- #research（Research 调研员）
- #ko（KO 知识官）

然后把 bot 邀请进这些频道：`/invite @<bot>`。

---

## 给 OpenClaw 的执行提示

> 以下信息面向执行部署的 OpenClaw Agent。如果你是人工阅读，可跳过这一节。

当用户让你部署 OpenCrew 时，按以下流程执行：

### 执行流程

```
Step 1: 备份
  cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak.$(date +%s)

Step 2: 复制文件（见下方"方式 B"的 bash 命令，照搬即可）
  - shared/*.md → ~/.openclaw/shared/
  - workspaces/<agent>/ → ~/.openclaw/workspace-<agent>/（不覆盖已有文件）
  - 为每个 workspace 创建软链接：shared → ~/.openclaw/shared
  - 创建子目录：memory/, cto/scars, cto/patterns 等

Step 3: 获取 Slack Channel ID
  用户已提供 Bot Token。用 Slack API 自动获取（不需要让用户手动复制）：
  curl -s -H "Authorization: Bearer <botToken>" \
    "https://slack.com/api/conversations.list?types=public_channel&limit=200"
  从返回的 channels 里匹配 is_member=true 的频道名，拿到 Channel ID。
  用户告诉你"#ceo → CEO"时，找到 name=ceo 的频道即可。

Step 4: 写入 Slack 配置
  把 botToken 和 appToken 写入 channels.slack（Socket Mode）。

Step 5: 合并 Agent 配置
  读本仓库的 docs/CONFIG_SNIPPET_2026.2.9.md，按其结构把以下增量合并到 openclaw.json：
  - agents.list（新增 Agent 条目，保留用户原有的 main agent）
  - bindings（Channel ID → Agent 映射）
  - channels.slack.channels（allowlist + requireMention）
  - tools.agentToAgent + session.agentToAgent（A2A 保护）
  - channels.slack.thread（thread 隔离）

Step 6: 重启并验证
  openclaw gateway restart
  openclaw status（确认 Agent 数量和 Slack 状态正常）
```

### 边界（不要做的事）

- **不要修改**用户的 `models` / `auth` / `gateway` 相关配置
- **不要删除**用户已有的 agents、bindings 或 channels 条目
- 遇到冲突（如用户已有同名 agent id）先停下来问用户

---

## 2. 把 OpenCrew 文件放进你的 `~/.openclaw/`

你有两种方式：

### 方式 A（推荐）：让你现有的 OpenClaw 代你完成部署

把下面这段话发给你的 OpenClaw（替换 `<>` 里的内容）：

```
帮我部署 OpenCrew 多 Agent 团队。

仓库：请 clone https://github.com/AlexAnys/opencrew.git 到 /tmp/opencrew
（如果已下载，仓库路径：<你的本地路径>）

Slack tokens（请写入配置，不要回显）：
- Bot Token: <你的 xoxb- token>
- App Token: <你的 xapp- token>

我已创建以下频道并邀请了 bot：
- #ceo → CEO
- #pm → PM
- #cto → CTO
- #build → Builder
- #qa → QA
- #ops → Ops
- #cfo → CFO
- #support → Support

请读仓库里的 DEPLOY.md，按流程完成部署。
不要改我的 models / auth / gateway 配置，只做 OpenCrew 的增量。
```

你的 OpenClaw 会读取本文件和 `docs/CONFIG_SNIPPET_2026.2.9.md`，自动完成备份、文件复制、配置合并、重启和验证。

### 方式 B：手动复制（透明但需要一点命令行）

```bash
mkdir -p ~/.openclaw/shared
cp shared/*.md ~/.openclaw/shared/

# 复制所有 workspace
for a in ceo pm cto builder infra perf qa ops cfo support research ko; do
  mkdir -p ~/.openclaw/workspace-$a
  rsync -a --ignore-existing "workspaces/$a/" "$HOME/.openclaw/workspace-$a/"
done

# （推荐）把 shared/ 以软链接方式挂到每个 workspace 下
for a in ceo pm cto builder infra perf qa ops cfo support research ko; do
  if [ ! -e "$HOME/.openclaw/workspace-$a/shared" ]; then
    ln -s "$HOME/.openclaw/shared" "$HOME/.openclaw/workspace-$a/shared"
  fi
done

# 创建各团队需要的子目录
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

> 说明：这里使用 `rsync --ignore-existing` 是为了尽量避免覆盖你已经在用的 workspace 文件。

---

## 3. 写入最小增量配置（OpenClaw 2026.2.9）

请按这个文件操作：[`docs/CONFIG_SNIPPET_2026.2.9.md`](docs/CONFIG_SNIPPET_2026.2.9.md)

它包含：
- 需要新增的 agents（以及各自 workspace 路径）
- Slack 频道 bindings（频道=岗位）
- Slack allowlist（安全：只允许这些频道触发）
- A2A 保护（maxPingPongTurns / 发起权限 / subagent 禁止 sessions）
- 回滚方式

---

## 4. 重启并验证

```bash
openclaw gateway restart
openclaw status
```

验证建议：
1) 在 #ceo 发一句话 → CEO 响应
2) 在 #cto 发一句话 → CTO 响应
3) 在 #ceo 让 CEO 派一个研发任务给 CTO → #cto 出现 thread，CTO 在 thread 内回复
4) 在 #cto 让 CTO 派一个实现任务给 Builder → #build 出现 thread，Builder 在 thread 内回复

---

## 5. 组织架构说明

### 5.1 董事层

| 角色 | 频道 | Emoji | 职责 |
|------|------|-------|------|
| **CEO** | #ceo | 💎 | 执行董事，对齐用户意图、战略方向、跨团队协调、最终决策 |

**CEO 核心职责**：
- 对齐用户真正要什么，必要时帮他重新定义问题
- 资源有限时帮用户做取舍，给2-3选项+代价+推荐
- 在用户忙时替他做"可逆推进"
- 只呈现高信号信息，降低用户认知负荷

### 5.2 执行团队

#### 产品团队

| 角色 | 频道 | Emoji | 职责 |
|------|------|-------|------|
| **PM** | #pm | 📋 | 产品负责人，需求管理、优先级排序、用户故事 |

#### 研发团队

| 角色 | 频道 | Emoji | 职责 |
|------|------|-------|------|
| **CTO** | #cto | 🛠️ | 技术负责人，架构决策、技术方向、工程质量 |
| **Builder** | #build | 🧱 | 代码实现者，专注实现、测试、交付 |
| **Infra** | #infra | 🔧 | 基础设施专家，分布式系统、存储、基础设施 |
| **Perf** | #perf | ⚡ | 性能专家，性能分析、优化建议、基准测试 |

#### 测试团队

| 角色 | 频道 | Emoji | 职责 |
|------|------|-------|------|
| **QA** | #qa | ✅ | 测试负责人，测试策略、质量标准、缺陷跟踪 |

#### 运营团队

| 角色 | 频道 | Emoji | 职责 |
|------|------|-------|------|
| **Ops** | #ops | 📊 | 运营负责人，流程优化、成本控制、系统治理 |

#### 财务团队

| 角色 | 频道 | Emoji | 职责 |
|------|------|-------|------|
| **CFO** | #cfo | 💰 | 财务负责人，Token 成本统计、收入统计、财务报告 |

#### OpenClaw 售后团队

| 角色 | 频道 | Emoji | 职责 |
|------|------|-------|------|
| **Support** | #support | 🔧 | 高权限操作执行、系统维护、紧急响应 |

**Support 高权限操作清单**：

| 操作类型 | 风险等级 | 审批要求 |
|---------|---------|---------|
| 重启网关 | 高 | CEO 或用户批准 |
| 数据备份 | 中 | CTO 批准 |
| 数据恢复 | 极高 | CEO + 用户双重批准 |
| 配置变更 | 高 | CTO 批准 |
| 紧急停服 | 极高 | CEO 批准 |
| 日志导出 | 低 | 自动记录 |

### 5.3 Spawn-only 角色

以下角色不绑定固定频道，由各团队负责人按需 spawn 调用：

| 角色 | Emoji | 职责 | 可 spawn 的团队负责人 |
|------|-------|------|----------------------|
| **Research** | 🔍 | 技术调研、信息收集 | CEO / CTO / Infra / Perf / PM |
| **KO** | 📚 | 知识沉淀、经验抽象、文档管理 | CEO / CTO / Infra / Perf / Ops / CFO |

**KO 使用场景**：
- CTO 完成项目后，spawn KO 整理技术文档
- Infra 解决架构问题后，spawn KO 沉淀经验
- CFO 生成财务报告后，spawn KO 归档记录

### 5.4 A2A 权限矩阵与派单跟进

```
CEO      → 可派单给 PM/CTO/QA/Ops/CFO/Support
PM       → 可派单给 CTO/QA
CTO      → 可派单给 Builder/Infra/Perf/Support
Infra    → 可 spawn research/ko
Perf     → 可 spawn research/ko
Builder  → 只接单执行，需要澄清时回到 CTO thread 提问
QA       → 只接单执行
Ops      → 作为审计/沉淀，通常不主动派单；可 spawn ko
CFO      → 可 spawn ko（财务知识沉淀）
Support  → 只接收派单，不主动派单
```

**派单跟进规则（强制）**：
1. A 给 B 派单后，A 每 15 分钟在自己的协调 thread 里汇报进展
2. **禁止行为**：
   - ❌ 派完单完全看不到进展
   - ❌ 超过 15 分钟无汇报不说明原因
   - ❌ 不回应询问
   - ❌ 虚假汇报
3. **问题升级**：B 超过 30 分钟无响应、重大阻塞、无法按期完成 → 立即升级给 CEO

### 5.5 任务分级

| 类型 | 说明 | 处理流程 | Closeout |
|------|------|---------|----------|
| **Q** | 一次性查询 | 直接回答 | 不需要 |
| **A** | 小任务 | 执行层处理 | 必须 |
| **P** | 项目/长任务 | 需 Task Card + Checkpoint | 必须 |
| **S** | 系统变更 | 需 CEO 审批 + Ops Review | 必须 |

---

## 6. 可选项：如果你不需要某些团队

- **Infra（基础设施专家）**：可选，适合需要分布式系统、存储、基础设施架构评审的场景
- **Perf（性能专家）**：可选，适合需要性能分析和优化指导的场景
- **QA（测试团队）**：可选，适合需要专门测试流程的项目
- **CFO（财务团队）**：可选，适合需要成本追踪和财务报告的场景
- **Research / KO**：spawn-only，不需要创建频道

---

## 7. 可选：Memory Router 插件（智能记忆检索）

Memory Router 是一个 OpenClaw 插件，实现**自学习机制**：通过模式匹配优先使用已沉淀的记忆，避免每次都走 LLM 判断。

### 功能特性

- **三级匹配策略**：精确匹配 > 模糊匹配 > 语义检索
- **自适应阈值**：根据历史匹配成功率自动调整匹配严格度
- **智能缓存**：查询结果缓存，提升响应速度
- **模型选择**：根据匹配置信度自动选择不同模型（可选）

### 部署文档

详细的部署指南（包含全新部署和增量部署两种方式）请参考：

📄 **`docs/MEMORY_ROUTER_SETUP.md`**

该文档包含：
- Part A: 全新部署（与 OpenCrew 一起部署）
- Part B: 增量部署（已有 OpenClaw 用户）
- 完整的测试流程
- 配置详解
- 故障排查指南

### 快速预览

```bash
# 复制插件文件
mkdir -p ~/.openclaw/extensions/memory-router
cp extensions/memory-router/* ~/.openclaw/extensions/memory-router/

# 然后在 openclaw.json 中启用插件（详见上述文档）
```

---

## 8. 可选：Daily Memory Synthesizer 插件（每日记忆自动总结）

Daily Memory Synthesizer 是一个 OpenClaw 插件，让每个 Agent 在每天结束时**自主总结当日的经验教训**，形成自我迭代机制。

### 功能特性

- ✅ **自动记录任务**：在任务完成时自动记录到每日记忆
- ✅ **洞察和经验追踪**：记录今日洞察、经验教训、自我迭代
- ✅ **每日总结生成**：生成结构化的每日记忆 Markdown 文件
- ✅ **定时提醒机制**：在每天指定时间提醒 Agent 进行总结
- ✅ **长期记忆升级**：支持将高价值内容升级到 MEMORY.md

### 为什么需要这个插件？

原架构的问题：
- Agent 不会每天主动整理记忆
- Daily memory 文件更新是被动触发的
- 没有机制确保每天都有内容写入
- 完全依赖 agent 的"自律性"

这个插件解决的问题：
- **形成习惯**：通过定时提醒让 Agent 养成每日总结的习惯
- **结构化记录**：提供标准化的记录格式（任务、洞察、经验、迭代）
- **自动触发**：在任务完成时自动记录，减少遗忘
- **长期沉淀**：定期升级高价值内容到长期记忆

### 部署文档

详细的部署指南（包含全新部署和增量部署两种方式）请参考：

📄 **`docs/DAILY_MEMORY_SYNTHESIZER_SETUP.md`**

该文档包含：
- Part A: 全新部署（与 OpenCrew 一起部署）
- Part B: 增量部署（已有 OpenClaw 用户）
- 使用指南和最佳实践
- 与 Memory Router 插件协同使用
- 故障排查指南

### 快速预览

```bash
# 复制插件文件
mkdir -p ~/.openclaw/extensions/daily-memory-synthesizer
cp extensions/daily-memory-synthesizer/* ~/.openclaw/extensions/daily-memory-synthesizer/
```

在 `openclaw.json` 中启用插件：

```json
{
  "plugins": {
    "daily-memory-synthesizer": {
      "enabled": true,
      "config": {
        "memoryDir": "memory",
        "summaryHour": 23,
        "enableAutoSummary": true
      }
    }
  },
  "agents": {
    "list": [
      {
        "id": "ceo",
        "plugins": ["daily-memory-synthesizer"]
      }
    ]
  }
}
```

### 与 Memory Router 协同使用

建议同时部署两个插件，形成完整的记忆管理体系：

- **memory-router**: 负责**检索**已有记忆，提供智能匹配
- **daily-memory-synthesizer**: 负责**生成**每日记忆，形成自我迭代

```json
{
  "id": "ceo",
  "plugins": [
    "memory-router",              // 检索已有记忆
    "daily-memory-synthesizer"    // 生成每日记忆
  ]
}
```

---

## 9. 可选：Task Follow-up 插件（强制派单汇报机制）

Task Follow-up 是一个 OpenClaw 插件，**强制保证派单汇报机制的有效性**，解决了原架构中派单汇报依赖Agent自觉性的问题。

### 功能特性

- ✅ **任务注册跟踪**：派单时注册任务到跟踪系统
- ✅ **强制定时汇报**：每15分钟（可配置）提醒Agent汇报进展
- ✅ **超时自动升级**：超时未汇报自动升级，3次后通知CEO
- ✅ **状态实时查询**：随时查询任务状态和统计信息
- ✅ **双向沟通支持**：支持团队负责人主动向CEO汇报

### 为什么需要这个插件？

原架构的问题：
- 派单汇报"每15分钟"只是文档约束，没有技术保障
- 完全依赖 Agent 的主动性和记忆力
- HEARTBEAT 间隔12小时，无法跟踪具体任务
- 没有超时惩罚机制

这个插件解决的问题：
- **强制执行**：通过技术手段强制保证汇报机制生效
- **自动提醒**：超时未汇报会收到警告
- **自动升级**：多次超时自动通知CEO介入
- **双向沟通**：团队负责人可以主动向CEO汇报

### 部署文档

详细的部署指南（包含全新部署和增量部署两种方式）请参考：

📄 **`docs/TASK_FOLLOWUP_SETUP.md`**

该文档包含：
- Part A: 全新部署（与 OpenCrew 一起部署）
- Part B: 增量部署（已有 OpenClaw 用户）
- Part C: 双向沟通机制部署
- 使用指南和最佳实践
- 与其他插件协同使用
- 故障排查指南

### 快速预览

```bash
# 复制插件文件
mkdir -p ~/.openclaw/extensions/task-followup
cp extensions/task-followup/* ~/.openclaw/extensions/task-followup/
```

在 `openclaw.json` 中启用插件：

```json
{
  "plugins": {
    "task-followup": {
      "enabled": true,
      "config": {
        "reportIntervalMinutes": 15,
        "maxEscalateCount": 3,
        "enableAutoEscalation": true
      }
    }
  },
  "agents": {
    "list": [
      {
        "id": "ceo",
        "plugins": ["task-followup"]
      },
      {
        "id": "cto",
        "plugins": ["task-followup"]
      }
    ]
  }
}
```

### 使用方式

#### 派单时（CEO/CTO/PM等）

1. 创建 root message 并用 sessions_send 触发目标 Agent
2. **调用 `task_followup_register` 注册任务**
3. **每15分钟调用 `task_followup_report` 汇报进展**

#### 主动向CEO汇报（各团队负责人）

在 #ceo 频道创建 thread，标题格式：
```
REPORT CTO→CEO | 项目X进展汇报 | 进展汇报
```

然后用 sessions_send 触发 CEO session。

### 与其他插件协同

建议三个插件协同使用：

```json
{
  "id": "ceo",
  "plugins": [
    "memory-router",              // 检索已有记忆
    "daily-memory-synthesizer",   // 生成每日记忆
    "task-followup"               // 强制汇报机制
  ]
}
```

---

## 重要说明：关于"一键脚本"和 Slack routing patch

- 本 repo **不提供/不推荐**"一键脚本直接改你的系统配置"（每个人安装路径/现有配置不同，风险大）。推荐用你现有的 OpenClaw 按步骤做可回滚的增量部署。
- Slack 的"每条 root message 自动独立 session"目前没有纯配置级别的完美解法；高级用户可参考 `patches/`（见 docs/KNOWN_ISSUES.md）。
