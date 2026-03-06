# 增量部署指南

> 本文档适用于**已部署 OpenCrew 的用户**，指导如何增量更新各个组件。
>
> 如果你是首次部署，请参考 [DEPLOY.md](../DEPLOY.md) 或 [完整上手指南](GETTING_STARTED.md)。

---

## 目录

- [1. 插件增量部署](#1-插件增量部署)
  - [1.1 Memory Router 插件](#11-memory-router-插件)
  - [1.2 Daily Memory Synthesizer 插件](#12-daily-memory-synthesizer-插件)
  - [1.3 Task Follow-up 插件](#13-task-followup-插件)
- [2. 协议与规则增量更新](#2-协议与规则增量更新)
  - [2.1 A2A 协议更新](#21-a2a-协议更新)
  - [2.2 SYSTEM_RULES 更新](#22-system_rules-更新)
- [3. Workspace 文件增量更新](#3-workspace-文件增量更新)
- [4. 常见增量更新场景](#4-常见增量更新场景)
- [5. 回滚指南](#5-回滚指南)

---

## 1. 插件增量部署

### 1.1 Memory Router 插件

**详细文档**: [`MEMORY_ROUTER_SETUP.md`](MEMORY_ROUTER_SETUP.md) → Part B: 增量部署

**快速步骤**:

```bash
# 1. 复制插件文件
mkdir -p ~/.openclaw/extensions/memory-router
cp extensions/memory-router/* ~/.openclaw/extensions/memory-router/

# 2. 在 openclaw.json 中添加插件配置
# 详见 MEMORY_ROUTER_SETUP.md

# 3. 重启
openclaw gateway restart
```

**配置要点**:
- 在 `plugins` 中启用 `memory-router`
- 在目标 Agent 的 `plugins` 数组中添加 `"memory-router"`

---

### 1.2 Daily Memory Synthesizer 插件

**详细文档**: [`DAILY_MEMORY_SYNTHESIZER_SETUP.md`](DAILY_MEMORY_SYNTHESIZER_SETUP.md) → Part B: 增量部署

**快速步骤**:

```bash
# 1. 复制插件文件
mkdir -p ~/.openclaw/extensions/daily-memory-synthesizer
cp extensions/daily-memory-synthesizer/* ~/.openclaw/extensions/daily-memory-synthesizer/

# 2. 在 openclaw.json 中添加插件配置
# 详见 DAILY_MEMORY_SYNTHESIZER_SETUP.md

# 3. 重启
openclaw gateway restart
```

**配置要点**:
- 配置 `summaryHour`（默认23点）
- 在目标 Agent 的 `plugins` 数组中添加 `"daily-memory-synthesizer"`

---

### 1.3 Task Follow-up 插件

**详细文档**: [`TASK_FOLLOWUP_SETUP.md`](TASK_FOLLOWUP_SETUP.md) → Part B: 增量部署

**快速步骤**:

```bash
# 1. 复制插件文件
mkdir -p ~/.openclaw/extensions/task-followup
cp extensions/task-followup/* ~/.openclaw/extensions/task-followup/

# 2. 在 openclaw.json 中添加插件配置
# 详见 TASK_FOLLOWUP_SETUP.md

# 3. 重启
openclaw gateway restart
```

**配置要点**:
- 配置 `reportIntervalMinutes`（默认15分钟）
- 配置 `maxEscalateCount`（默认3次）
- 在 CEO 和各团队负责人的 Agent 中启用此插件

**同时需要更新 A2A 协议** → 参见 [2.1 A2A 协议更新](#21-a2a-协议更新)

---

## 2. 协议与规则增量更新

### 2.1 A2A 协议更新

**文件**: `shared/A2A_PROTOCOL.md`

**更新步骤**:

```bash
# 1. 备份现有文件
cp ~/.openclaw/shared/A2A_PROTOCOL.md ~/.openclaw/shared/A2A_PROTOCOL.md.bak

# 2. 复制新版本
cp shared/A2A_PROTOCOL.md ~/.openclaw/shared/A2A_PROTOCOL.md

# 3. 无需重启，下次 Agent 启动时自动生效
```

**关键更新（2026.3）**:
- 新增双向沟通机制：团队负责人可主动向 CEO 汇报/请示
- 新增 `REPORT` 类型消息：格式为 `REPORT <FROM>→<TO> | <TOPIC> | 进展汇报`

---

### 2.2 SYSTEM_RULES 更新

**文件**: `shared/SYSTEM_RULES.md`

**更新步骤**:

```bash
# 1. 备份现有文件
cp ~/.openclaw/shared/SYSTEM_RULES.md ~/.openclaw/shared/SYSTEM_RULES.md.bak

# 2. 复制新版本
cp shared/SYSTEM_RULES.md ~/.openclaw/shared/SYSTEM_RULES.md

# 3. 无需重启，下次 Agent 启动时自动生效
```

**关键更新（2026.3）**:
- 派单汇报从"软约束"改为由 `task-followup` 插件保障的"硬性流程"
- 新增任务超时自动升级机制

---

## 3. Workspace 文件增量更新

如果某个 Agent 的 `SYSTEM.md` 或 `MEMORY.md` 有更新：

```bash
# 例如更新 CEO 的 SYSTEM.md
cp workspaces/ceo/SYSTEM.md ~/.openclaw/workspace-ceo/SYSTEM.md

# 更新后无需重启，下次 Agent 启动时自动生效
```

**建议**:
- 使用 `rsync --ignore-existing` 避免覆盖本地修改
- 重要修改前先备份

---

## 4. 常见增量更新场景

### 场景 A: 添加 Task Follow-up 强制汇报机制

**适用情况**: 已部署 OpenCrew，希望加强派单汇报的执行力

**步骤**:
1. 部署 Task Follow-up 插件 → [1.3](#13-task-followup-插件)
2. 更新 A2A 协议 → [2.1](#21-a2a-协议更新)
3. 更新 SYSTEM_RULES → [2.2](#22-system_rules-更新)
4. 在 CEO 和团队负责人的 Agent 配置中启用插件

**验证**:
```
# 在 #cto 让 CTO 派单给 Builder
# 观察 CTO 是否在启动时收到超时警告
# 等待 15 分钟，观察是否有自动升级提醒
```

---

### 场景 B: 添加每日记忆自动总结

**适用情况**: 已部署 OpenCrew，希望 Agent 每天自动总结经验

**步骤**:
1. 部署 Daily Memory Synthesizer 插件 → [1.2](#12-daily-memory-synthesizer-插件)
2. （推荐）部署 Memory Router 插件 → [1.1](#11-memory-router-插件)
3. 在目标 Agent 配置中启用插件

**验证**:
```
# 在 Agent 启动时观察是否收到每日总结提醒（如果当天还没总结）
# 手动调用 task_record 测试记录功能
```

---

### 场景 C: 启用双向沟通机制

**适用情况**: 已部署 OpenCrew，希望团队负责人能主动向 CEO 汇报

**步骤**:
1. 更新 A2A 协议 → [2.1](#21-a2a-协议更新)
2. 更新 SYSTEM_RULES → [2.2](#22-system_rules-更新)

**使用方式**:
```
# 在 #ceo 频道创建 thread，标题格式：
REPORT CTO→CEO | 项目X进展汇报 | 进展汇报

# 然后用 sessions_send 触发 CEO session
```

---

## 5. 回滚指南

### 插件回滚

**方法 1：禁用插件**

在 `openclaw.json` 中将插件设为禁用：

```json
{
  "plugins": {
    "task-followup": {
      "enabled": false
    }
  }
}
```

**方法 2：从 Agent 中移除**

从 Agent 的 `plugins` 数组中移除插件名：

```json
{
  "id": "ceo",
  "plugins": []
}
```

然后重启：

```bash
openclaw gateway restart
```

### 协议/规则回滚

```bash
# 恢复备份
cp ~/.openclaw/shared/A2A_PROTOCOL.md.bak ~/.openclaw/shared/A2A_PROTOCOL.md
cp ~/.openclaw/shared/SYSTEM_RULES.md.bak ~/.openclaw/shared/SYSTEM_RULES.md
```

---

## 相关文档

- [DEPLOY.md](../DEPLOY.md) - 全量部署指南
- [MEMORY_ROUTER_SETUP.md](MEMORY_ROUTER_SETUP.md) - Memory Router 详细部署
- [DAILY_MEMORY_SYNTHESIZER_SETUP.md](DAILY_MEMORY_SYNTHESIZER_SETUP.md) - 每日记忆总结详细部署
- [TASK_FOLLOWUP_SETUP.md](TASK_FOLLOWUP_SETUP.md) - Task Follow-up 详细部署
- [GETTING_STARTED.md](GETTING_STARTED.md) - 完整上手指南
