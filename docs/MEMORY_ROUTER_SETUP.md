# Memory Router 插件部署指南

> 智能记忆检索插件 - 通过模式匹配优先使用已沉淀的记忆

---

## 目录

- [Part A: 全新部署（推荐）](#part-a-全新部署推荐) - 适用于从头开始部署 OpenCrew 的用户
- [Part B: 增量部署](#part-b-增量部署) - 适用于已有 OpenClaw 配置的用户

---

## Part A: 全新部署（推荐）

适用于正在从头部署 OpenCrew 的用户，与主部署流程一起完成。

### 前置要求

- 已完成 OpenClaw 基础安装
- 正在按照 `DEPLOY.md` 进行 OpenCrew 部署

### 部署步骤

#### Step 1: 复制插件文件

在部署 OpenCrew 工作区的同时，复制 Memory Router 插件：

```bash
# 创建插件目录
mkdir -p ~/.openclaw/extensions/memory-router

# 复制插件文件（在 opencrew 仓库目录执行）
cp extensions/memory-router/index.ts ~/.openclaw/extensions/memory-router/
cp extensions/memory-router/openclaw.plugin.json ~/.openclaw/extensions/memory-router/
cp extensions/memory-router/package.json ~/.openclaw/extensions/memory-router/
```

#### Step 2: 配置 openclaw.json

在 `~/.openclaw/openclaw.json` 中添加插件配置：

```json
{
  "plugins": [
    {
      "id": "memory-router",
      "enabled": true,
      "config": {
        "memoryFilePath": "~/.openclaw/memory-router/memories.json",
        "adaptiveMode": true,
        "thresholds": {
          "exact": 0.95,
          "fuzzy": 0.70,
          "semantic": 0.60
        },
        "maxMemoriesPerQuery": 3,
        "enableCache": true,
        "cacheTTL": 60000
      }
    }
  ]
}
```

#### Step 3: 启动并验证

```bash
# 启动 OpenClaw
openclaw start

# 查看插件加载状态
openclaw plugins list

# 查看日志确认
openclaw logs | grep memory-router
```

预期输出：
```
memory-router: loaded (~/.openclaw/memory-router/memories.json, 0 memories)
```

---

## Part B: 增量部署

适用于已有 OpenClaw 配置和运行的用户，单独添加 Memory Router 插件。

### 前置要求

- OpenClaw 已安装并正常运行
- 可以执行 `openclaw status` 且返回正常

### 部署步骤

#### Step 1: 备份现有配置

```bash
# 备份 openclaw.json
cp ~/.openclaw/openclaw.json ~/.openclaw/openclaw.json.bak.$(date +%s)

# 确认备份成功
ls -la ~/.openclaw/openclaw.json.bak.*
```

#### Step 2: 复制插件文件

```bash
# 创建插件目录
mkdir -p ~/.openclaw/extensions/memory-router

# 复制插件文件（在 opencrew 仓库目录执行）
cp extensions/memory-router/index.ts ~/.openclaw/extensions/memory-router/
cp extensions/memory-router/openclaw.plugin.json ~/.openclaw/extensions/memory-router/
cp extensions/memory-router/package.json ~/.openclaw/extensions/memory-router/

# 确认文件复制成功
ls -la ~/.openclaw/extensions/memory-router/
```

#### Step 3: 修改配置

编辑 `~/.openclaw/openclaw.json`，在 `plugins` 数组中添加：

```json
{
  "id": "memory-router",
  "enabled": true,
  "config": {
    "memoryFilePath": "~/.openclaw/memory-router/memories.json",
    "adaptiveMode": true,
    "thresholds": {
      "exact": 0.95,
      "fuzzy": 0.70,
      "semantic": 0.60
    },
    "maxMemoriesPerQuery": 3,
    "enableCache": true,
    "cacheTTL": 60000
  }
}
```

#### Step 4: 验证配置语法

```bash
openclaw config validate
```

如果报错，请检查 JSON 语法（逗号、括号等）。

#### Step 5: 重启 OpenClaw

```bash
# 平滑重启
openclaw restart

# 或者先停止再启动
openclaw stop && openclaw start
```

#### Step 6: 验证安装

```bash
# 查看插件列表
openclaw plugins list

# 查看日志
openclaw logs | grep memory-router

# 查看记忆统计
openclaw memory-router stats
```

---

## 测试流程（必做）

无论哪种部署方式，都需要完成以下测试：

### Test 1: 基础功能测试

```bash
# 查看记忆统计
openclaw memory-router stats

# 预期输出：
# 记忆总数: 0
# 自适应阈值: 精确=0.95, 模糊=0.70, 语义=0.60
# 历史成功率: 50.0%
```

### Test 2: 添加测试记忆

通过 Slack 向任意 Agent 发送：
```
/memory_add pattern:"测试|test" content:"这是一个测试记忆"
```

或通过 CLI：
```bash
openclaw tool memory_add --pattern="测试|test" --content="这是一个测试记忆"
```

### Test 3: 验证记忆检索

发送包含"测试"或"test"的消息，然后检查日志：

```bash
openclaw logs | grep "memory-router: injected"

# 预期输出：
# memory-router: injected 1 memories (best: 95%)
```

### Test 4: 列表查询

```bash
openclaw memory-router list --limit 10
```

---

## 功能说明

### 核心特性

- **三级匹配策略**：精确匹配 > 模糊匹配 > 语义检索
- **自适应阈值**：根据历史匹配成功率自动调整匹配严格度
- **智能缓存**：查询结果缓存，默认 60 秒 TTL
- **模型选择**：根据匹配置信度自动选择不同模型（可选）

### 匹配流程

```
用户输入
    ↓
1. 精确匹配检查（关键词完全包含，阈值 0.95）
    ↓ 匹配？→ 返回高置信度结果
    ↓ 不匹配
2. 模糊匹配检查（编辑距离相似度，阈值 0.70）
    ↓ 匹配？→ 返回中等置信度结果
    ↓ 不匹配
3. 语义检索检查（词袋模型 + 余弦相似度，阈值 0.60）
    ↓ 匹配？→ 返回低置信度结果
    ↓ 不匹配
   让 LLM 正常处理
```

### 可用工具

插件启用后，所有 Agent 都可以使用以下工具：

- `memory_add` - 添加新记忆
- `memory_search` - 搜索记忆
- `memory_list` - 列出所有记忆
- `memory_delete` - 删除记忆
- `memory_stats` - 查看统计和自适应阈值

### CLI 命令

```bash
openclaw memory-router stats      # 查看统计
openclaw memory-router list       # 列出记忆
openclaw memory-router clear-cache # 清除缓存
```

---

## 配置详解

### 核心配置项

| 配置项 | 类型 | 默认值 | 说明 |
|--------|------|--------|------|
| `memoryFilePath` | string | `~/.openclaw/memory-router/memories.json` | 记忆存储路径 |
| `adaptiveMode` | boolean | `true` | 启用自适应阈值调整 |
| `thresholds.exact` | number | `0.95` | 精确匹配阈值 (0-1) |
| `thresholds.fuzzy` | number | `0.70` | 模糊匹配阈值 (0-1) |
| `thresholds.semantic` | number | `0.60` | 语义检索阈值 (0-1) |
| `maxMemoriesPerQuery` | number | `3` | 每次查询最多返回的记忆数 |
| `enableCache` | boolean | `true` | 启用查询缓存 |
| `cacheTTL` | number | `60000` | 缓存有效期（毫秒） |

### 模型选择配置（可选）

```json
{
  "modelSelection": {
    "highConfidence": "gpt-4o-mini",    // 置信度 >= 90% 时使用轻量模型
    "mediumConfidence": "gpt-4o",       // 置信度 70-90% 时使用标准模型
    "lowConfidence": ""                 // 置信度 < 70% 时使用默认模型
  }
}
```

---

## 故障排查

### 问题 1: OpenClaw 无法启动

```bash
# 1. 查看错误日志
openclaw logs --tail=50

# 2. 临时禁用插件
# 编辑 ~/.openclaw/openclaw.json，将 memory-router 的 enabled 改为 false

# 3. 重启测试
openclaw restart

# 4. 检查插件文件完整性
ls -la ~/.openclaw/extensions/memory-router/

# 5. 检查配置语法
openclaw config validate
```

### 问题 2: 插件未加载

```bash
# 查看所有插件
openclaw plugins list

# 检查插件目录权限
ls -la ~/.openclaw/extensions/

# 手动检查配置文件
 cat ~/.openclaw/openclaw.json | grep -A 10 "memory-router"
```

### 问题 3: 记忆未命中

```bash
# 检查当前记忆列表
openclaw memory-router list

# 测试搜索功能
openclaw tool memory_search --query="你的测试关键词"

# 查看自适应阈值
openclaw memory-router stats
```

### 问题 4: 性能问题

- 降低 `maxMemoriesPerQuery` 到 2
- 减少 `cacheTTL` 到 30000（30秒）
- 定期清理不常用的记忆

---

## 备份与迁移

### 备份记忆

```bash
cp ~/.openclaw/memory-router/memories.json ~/backups/memories-$(date +%Y%m%d).json
```

### 迁移到新环境

```bash
# 1. 复制插件文件
scp -r ~/.openclaw/extensions/memory-router user@new-host:~/.openclaw/extensions/

# 2. 复制记忆数据
scp ~/.openclaw/memory-router/memories.json user@new-host:~/.openclaw/memory-router/

# 3. 在新环境添加配置到 openclaw.json
```

---

## 卸载

```bash
# 1. 从 openclaw.json 中移除插件配置

# 2. 删除插件文件
rm -rf ~/.openclaw/extensions/memory-router

# 3. 可选：删除记忆数据
rm -rf ~/.openclaw/memory-router/

# 4. 重启 OpenClaw
openclaw restart
```

---

## 更新日志

### v1.0.0
- 初始版本
- 支持三级匹配策略
- 自适应阈值调整
- 查询缓存
