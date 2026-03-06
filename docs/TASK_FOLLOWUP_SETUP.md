# Task Follow-up 插件部署指南

## 概述

Task Follow-up 是一个 OpenClaw 插件，**强制保证派单汇报机制的有效性**，解决了原架构中派单汇报依赖Agent自觉性的问题。

### 核心功能

- ✅ **任务注册跟踪**：派单时注册任务到跟踪系统
- ✅ **强制定时汇报**：每15分钟（可配置）提醒Agent汇报进展
- ✅ **超时自动升级**：超时未汇报自动升级，3次后通知CEO
- ✅ **状态实时查询**：随时查询任务状态和统计信息
- ✅ **双向沟通支持**：支持团队负责人主动向CEO汇报

---

## Part A: 全新部署（与 OpenCrew 一起部署）

如果你是第一次部署 OpenCrew，可以在部署 OpenCrew 的同时部署此插件。

### 步骤 1: 复制插件文件

在执行 OpenCrew 部署脚本时，添加以下命令：

```bash
# 创建插件目录
mkdir -p ~/.openclaw/extensions/task-followup

# 复制插件文件
cp extensions/task-followup/* ~/.openclaw/extensions/task-followup/
```

或者，如果你使用 OpenCrew 的完整部署脚本，在 `DEPLOY.md` 的方式 B 中添加：

```bash
# 在复制 shared/ 和 workspaces/ 之后添加：

# 复制插件
mkdir -p ~/.openclaw/extensions/task-followup
cp extensions/task-followup/* ~/.openclaw/extensions/task-followup/
```

### 步骤 2: 在 openclaw.json 中启用插件

在 `~/.openclaw/openclaw.json` 中添加插件配置：

```json
{
  "plugins": {
    "task-followup": {
      "enabled": true,
      "config": {
        "reportIntervalMinutes": 15,
        "maxEscalateCount": 3,
        "enableAutoEscalation": true,
        "dataFilePath": "~/.openclaw/task-followup/tasks.json"
      }
    }
  },
  "agents": {
    "list": [
      {
        "id": "ceo",
        "plugins": ["task-followup", "daily-memory-synthesizer"]
      },
      {
        "id": "cto",
        "plugins": ["task-followup", "daily-memory-synthesizer"]
      },
      {
        "id": "pm",
        "plugins": ["task-followup", "daily-memory-synthesizer"]
      },
      {
        "id": "ops",
        "plugins": ["task-followup", "daily-memory-synthesizer"]
      }
    ]
  }
}
```

### 步骤 3: 重启 OpenClaw

```bash
openclaw gateway restart
```

### 步骤 4: 验证部署

```bash
# 检查插件是否加载
openclaw plugins list

# 应该看到：
# - task-followup (enabled)
```

---

## Part B: 增量部署（已有 OpenClaw 用户）

如果你已经在使用 OpenClaw，可以单独部署此插件。

### 步骤 1: 备份配置

```bash
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak.$(date +%s)
```

### 步骤 2: 复制插件文件

```bash
# 创建插件目录
mkdir -p ~/.openclaw/extensions/task-followup

# 复制插件文件
cp extensions/task-followup/* ~/.openclaw/extensions/task-followup/
```

### 步骤 3: 更新 openclaw.json

#### 3.1 添加插件全局配置

在 `openclaw.json` 中找到或创建 `plugins` 部分：

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
  }
}
```

#### 3.2 为需要的 Agent 启用插件

在 `agents.list` 中为每个需要的 Agent 添加 `plugins` 字段：

```json
{
  "agents": {
    "list": [
      {
        "id": "ceo",
        "plugins": ["task-followup"]
      },
      {
        "id": "cto",
        "plugins": ["task-followup"]
      },
      {
        "id": "pm",
        "plugins": ["task-followup"]
      },
      {
        "id": "ops",
        "plugins": ["task-followup"]
      }
    ]
  }
}
```

**注意**：如果你的 agent 配置中已有其他插件，在数组中追加：

```json
{
  "id": "ceo",
  "plugins": ["daily-memory-synthesizer", "task-followup"]
}
```

### 步骤 4: 重启并验证

```bash
openclaw gateway restart
openclaw status
```

---

## Part C: 双向沟通机制部署

### 更新通信协议

Task Followup 插件已支持双向沟通，但需要确保 `A2A_PROTOCOL.md` 已更新。

#### 检查 A2A_PROTOCOL.md

确认文件中包含以下内容：

```markdown
### 双向沟通权限（新增）

**重要变更**：所有团队负责人现在都可以主动与CEO沟通（但不能派单给CEO）。

PM/CTO/QA/Ops/CFO/Support → CEO
  ✅ 允许：汇报进展、请示问题、上报风险、主动同步信息
  ❌ 禁止：派单给CEO
```

如果没有，请更新 `~/.openclaw/shared/A2A_PROTOCOL.md` 文件。

#### 更新 SYSTEM_RULES.md

确认文件中包含以下内容：

```markdown
## 10) 派单跟进原则（强制遵守）

### 强制机制（通过 task-followup 插件保障）

**重要变更**：派单汇报现在通过 `task-followup` 插件强制执行，不再依赖Agent自觉。
```

如果没有，请更新 `~/.openclaw/shared/SYSTEM_RULES.md` 文件。

---

## 使用指南

### Agent 工作流集成

#### 派单时（CEO/CTO/PM等）

在 A2A 派单流程中增加一步：注册任务到跟踪系统。

**原有流程**：
1. 在目标频道创建 root message
2. 用 sessions_send 触发目标 Agent
3. 等待结果

**新流程**：
1. 在目标频道创建 root message
2. 用 sessions_send 触发目标 Agent
3. **调用 `task_followup_register` 注册任务** ⬅️ 新增
4. **每15分钟调用 `task_followup_report` 汇报进展** ⬅️ 新增

#### 接单时（Builder/QA/Support等）

正常执行任务即可，上游会主动跟进。

#### 主动向CEO汇报（各团队负责人）

现在可以在 #ceo 频道主动创建 thread 汇报：

1. 在 #ceo 创建 thread，标题格式：
   ```
   REPORT CTO→CEO | 项目X进展汇报 | 进展汇报
   ```

2. 正文写明汇报内容

3. 用 `sessions_send` 触发 CEO session

### 工具调用示例

#### 注册派单任务

```
调用：task_followup_register
参数：
{
  "taskId": "20240115-1430-build-feature",
  "title": "实现用户认证功能",
  "fromAgent": "cto",
  "toAgent": "builder",
  "channel": "C1234567890",
  "threadTs": "1234567890.123456"
}
```

#### 汇报进展

```
调用：task_followup_report
参数：
{
  "taskId": "20240115-1430-build-feature",
  "status": "in_progress",
  "summary": "Builder已完成80%，预计明天完成",
  "estimatedCompletion": 1705363200000
}
```

#### 查询任务状态

```
调用：task_followup_status
参数：
{
  "agentId": "cto"  // 查询CTO派出的所有任务
}
```

---

## 配置参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `reportIntervalMinutes` | number | `15` | 汇报间隔（分钟） |
| `maxEscalateCount` | number | `3` | 最大升级次数 |
| `enableAutoEscalation` | boolean | `true` | 是否启用自动升级 |
| `dataFilePath` | string | `"~/.openclaw/task-followup/tasks.json"` | 数据文件路径 |

---

## 与其他插件协同

### 与 Daily Memory Synthesizer 协同

建议同时启用两个插件：

```json
{
  "id": "ceo",
  "plugins": [
    "daily-memory-synthesizer",  // 生成每日记忆
    "task-followup"              // 强制汇报机制
  ]
}
```

### 与 Memory Router 协同

三个插件可以协同使用：

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

## 故障排查

### 问题 1: 插件未加载

**症状**: `openclaw plugins list` 中看不到插件

**解决方案**:
1. 检查文件是否复制到正确位置：`ls ~/.openclaw/extensions/task-followup/`
2. 检查 `openclaw.json` 中是否正确配置
3. 查看日志：`openclaw logs | grep task-followup`

### 问题 2: Agent 无法调用工具

**症状**: Agent 报告找不到 `task_followup_register` 等工具

**解决方案**:
1. 确认 Agent 配置中包含 `plugins: ["task-followup"]`
2. 重启 gateway: `openclaw gateway restart`

### 问题 3: 任务未自动升级

**症状**: 超时任务没有被升级

**解决方案**:
1. 确认 `enableAutoEscalation` 设置为 `true`
2. 检查日志：`openclaw logs | grep escalate`

---

## 卸载

如需卸载此插件：

1. 从 `openclaw.json` 中移除插件配置：
   - 删除 `plugins.task-followup`
   - 从各 agent 的 `plugins` 数组中移除

2. 删除插件文件：
   ```bash
   rm -rf ~/.openclaw/extensions/task-followup
   rm -rf ~/.openclaw/task-followup
   ```

3. 重启：
   ```bash
   openclaw gateway restart
   ```

**注意**：已跟踪的任务数据不会被删除，如需删除请手动操作。

---

## 最佳实践

1. **派单立即注册**
   - 派单后立即调用 `task_followup_register`
   - 不要依赖记忆，养成习惯

2. **定时汇报**
   - 设置固定时间点汇报（如每15分钟）
   - 即使进展不大也要汇报状态

3. **主动上报**
   - 遇到阻塞立即上报
   - 不要等超时才汇报

4. **合理配置间隔**
   - 短任务：5-10分钟
   - 中等任务：15分钟（默认）
   - 长任务：30分钟

---

## 更新日志

### v1.0.0 (2024-01-15)
- 初始版本
- 支持任务注册、定时汇报、自动升级
- 支持双向沟通机制
- 与 A2A 协议深度集成
