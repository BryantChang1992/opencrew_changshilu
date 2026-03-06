# Daily Memory Synthesizer 插件部署指南

## 概述

Daily Memory Synthesizer 是一个 OpenClaw 插件，让每个 Agent 在每天结束时自主总结当日的经验教训，形成自我迭代机制。

### 核心功能

- ✅ **自动记录任务**：在任务完成时自动记录到每日记忆
- ✅ **洞察和经验追踪**：记录今日洞察、经验教训、自我迭代
- ✅ **每日总结生成**：生成结构化的每日记忆 Markdown 文件
- ✅ **定时提醒机制**：在每天指定时间提醒 Agent 进行总结
- ✅ **长期记忆升级**：支持将高价值内容升级到 MEMORY.md

---

## Part A: 全新部署（与 OpenCrew 一起部署）

如果你是第一次部署 OpenCrew，可以在部署 OpenCrew 的同时部署此插件。

### 步骤 1: 复制插件文件

在执行 OpenCrew 部署脚本时，添加以下命令：

```bash
# 创建插件目录
mkdir -p ~/.openclaw/extensions/daily-memory-synthesizer

# 复制插件文件
cp extensions/daily-memory-synthesizer/* ~/.openclaw/extensions/daily-memory-synthesizer/
```

或者，如果你使用 OpenCrew 的完整部署脚本，在 `DEPLOY.md` 的方式 B 中添加：

```bash
# 在复制 shared/ 和 workspaces/ 之后添加：

# 复制插件
mkdir -p ~/.openclaw/extensions/daily-memory-synthesizer
cp extensions/daily-memory-synthesizer/* ~/.openclaw/extensions/daily-memory-synthesizer/
```

### 步骤 2: 在 openclaw.json 中启用插件

在 `~/.openclaw/openclaw.json` 中添加插件配置：

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
  },
  "agents": {
    "list": [
      {
        "id": "ceo",
        "plugins": ["daily-memory-synthesizer"]
      },
      {
        "id": "cto",
        "plugins": ["daily-memory-synthesizer"]
      },
      {
        "id": "pm",
        "plugins": ["daily-memory-synthesizer"]
      },
      {
        "id": "builder",
        "plugins": ["daily-memory-synthesizer"]
      },
      {
        "id": "ops",
        "plugins": ["daily-memory-synthesizer"]
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
# - daily-memory-synthesizer (enabled)
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
mkdir -p ~/.openclaw/extensions/daily-memory-synthesizer

# 复制插件文件
cp extensions/daily-memory-synthesizer/* ~/.openclaw/extensions/daily-memory-synthesizer/
```

### 步骤 3: 更新 openclaw.json

#### 3.1 添加插件全局配置

在 `openclaw.json` 中找到或创建 `plugins` 部分：

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

#### 3.2 为需要的 Agent 启用插件

在 `agents.list` 中为每个需要的 Agent 添加 `plugins` 字段：

```json
{
  "agents": {
    "list": [
      {
        "id": "ceo",
        "plugins": ["daily-memory-synthesizer"]
      },
      {
        "id": "cto",
        "plugins": ["daily-memory-synthesizer"]
      }
      // ... 其他 agent
    ]
  }
}
```

**注意**：如果你的 agent 配置中没有 `plugins` 字段，直接添加即可。如果已有其他插件（如 `memory-router`），在数组中追加：

```json
{
  "id": "ceo",
  "plugins": ["memory-router", "daily-memory-synthesizer"]
}
```

### 步骤 4: 重启并验证

```bash
openclaw gateway restart
openclaw status
```

---

## 使用指南

### Agent 工作流集成

在 Agent 的 `AGENTS.md` 中添加以下内容：

```markdown
## 每日记忆维护

### 任务完成时
调用 `daily_memory_record_task` 记录任务：
- taskId: 任务ID
- title: 任务标题
- type: Q/A/P/S
- status: completed/blocked/ongoing
- closeout: 任务总结（可选）
- signal: 重要性 0-3（可选，默认1）

### 有重要发现时
调用 `daily_memory_add_insight` 记录洞察。

### 踩坑或学到经验时
调用 `daily_memory_add_lesson` 记录教训。

### 自我迭代时
调用 `daily_memory_record_self_update` 记录变更。

### 每日结束时
调用 `daily_memory_synthesize` 生成每日总结。

### 查看历史记忆
调用 `daily_memory_view` 查看指定日期的记忆。
```

### 自动触发机制

插件会在以下时机自动触发：

1. **每日总结时间**（默认 23:00）
   - 如果当天有任务但未记录洞察，会自动提示 Agent 进行总结

2. **Agent 启动时**
   - 如果是新的日期，会初始化当日的记忆文件

3. **任务完成时**
   - Agent 主动调用 `daily_memory_record_task`

### 生成的文件结构

```
workspace-ceo/
├── memory/
│   ├── 2024-01-15.json    # 结构化数据
│   ├── 2024-01-15.md      # Markdown 格式（可读性强）
│   ├── 2024-01-16.json
│   ├── 2024-01-16.md
│   └── ...
└── MEMORY.md              # 长期精选记忆
```

### 示例输出

`2024-01-15.md` 示例：

```markdown
# 2024-01-15 - 每日记忆

> 生成时间: 2024/1/15 23:00:00

## 任务记录 (3)

### [A] 实现用户认证功能

- **状态**: completed
- **重要性**: 2
- **Closeout**: 完成了 JWT 认证实现，测试通过

### [P] 重构数据库层

- **状态**: ongoing
- **重要性**: 3

### [Q] 解释 Redis 缓存策略

- **状态**: completed
- **重要性**: 1

## 今日洞察

- JWT token 过期时间设置为 7 天比较合适，既能保证安全又不会频繁要求用户登录
- 使用 TypeScript 的类型守卫可以有效减少运行时错误

## 经验教训

- 不要在没有备份的情况下直接修改生产环境数据库
- PR 提交前务必本地测试，避免 CI 失败

## 自我迭代

- 修改了 SOUL.md，增加了"优先使用 TypeScript"的原则。回滚：删除该条目即可
```

---

## 配置参数说明

| 参数 | 类型 | 默认值 | 说明 |
|------|------|--------|------|
| `memoryDir` | string | `"memory"` | Memory 目录路径（相对于 workspace） |
| `timezone` | string | `"Asia/Shanghai"` | 时区设置 |
| `summaryHour` | number | `23` | 每天几点触发总结提示（0-23） |
| `enableAutoSummary` | boolean | `true` | 是否启用自动总结提示 |
| `maxTasksPerDay` | number | `20` | 每天最多记录多少任务 |

---

## 与 Memory Router 插件协同

此插件可以与 `memory-router` 插件协同使用：

- **memory-router**: 负责**检索**已有记忆，提供智能匹配
- **daily-memory-synthesizer**: 负责**生成**每日记忆，形成自我迭代

建议配置：

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

## 故障排查

### 问题 1: 插件未加载

**症状**: `openclaw plugins list` 中看不到插件

**解决方案**:
1. 检查文件是否复制到正确位置：`ls ~/.openclaw/extensions/daily-memory-synthesizer/`
2. 检查 `openclaw.json` 中是否正确配置
3. 查看日志：`openclaw logs | grep daily-memory`

### 问题 2: Agent 无法调用工具

**症状**: Agent 报告找不到 `daily_memory_record_task` 等工具

**解决方案**:
1. 确认 Agent 配置中包含 `plugins: ["daily-memory-synthesizer"]`
2. 重启 gateway: `openclaw gateway restart`

### 问题 3: Memory 文件未生成

**症状**: `memory/` 目录下没有文件

**解决方案**:
1. 确认 `memoryDir` 配置正确
2. 确认 Agent 有写入权限
3. 手动测试：在 Slack 中让 Agent 调用 `daily_memory_view`

---

## 卸载

如需卸载此插件：

1. 从 `openclaw.json` 中移除插件配置：
   - 删除 `plugins.daily-memory-synthesizer`
   - 从各 agent 的 `plugins` 数组中移除

2. 删除插件文件：
   ```bash
   rm -rf ~/.openclaw/extensions/daily-memory-synthesizer
   ```

3. 重启：
   ```bash
   openclaw gateway restart
   ```

**注意**：已生成的 memory 文件不会被删除，如需删除请手动操作。

---

## 最佳实践

1. **定时总结习惯**
   - 建议在每个工作日结束时（如 23:00）触发总结
   - 培养 Agent 的"反思习惯"

2. **信号分级**
   - signal 0: 日常查询，无需沉淀
   - signal 1: 常规任务，记录即可
   - signal 2: 重要任务，需要总结经验
   - signal 3: 关键任务，必须写入 MEMORY.md

3. **定期回顾**
   - 建议每周 review 一周的 daily memory
   - 将高价值内容升级到长期记忆

4. **避免过度记录**
   - 通过 `maxTasksPerDay` 控制记录数量
   - 只记录真正有价值的信息

---

## 更新日志

### v1.0.0 (2024-01-15)
- 初始版本
- 支持任务记录、洞察、经验教训追踪
- 支持每日总结生成
- 支持定时提醒机制
