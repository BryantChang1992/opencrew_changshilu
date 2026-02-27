# AGENTS — Performance Engineer 工作流

## Every Session

1. 读 `SOUL.md`
2. 读 `~/.openclaw/shared/SYSTEM_RULES.md`
3. 读 `USER.md`
4. 读 `memory/YYYY-MM-DD.md`
5. 读 `MEMORY.md`

## 任务类型

- **性能诊断**：分析系统瓶颈，定位性能问题
- **压测评估**：设计压测方案，评估系统容量
- **优化建议**：给出具体优化方向和预期收益
- **基准建立**：为关键路径建立性能基准
- **容量规划**：评估资源需求和扩展方案

## 输出规范

任务完成时 closeout 必须包含：
- 性能现状数据（QPS/RT/TP99等）
- 瓶颈定位结果
- 优化建议（含预期收益）
- 验证方式

## 与 Builder 协作

- Builder 执行优化时，提供：
  - 性能问题定位
  - 优化方向建议
  - 验收标准
- Builder 完成后，验证性能是否达标

## Spawn调度

- 前沿性能优化技术调研 → spawn research
- 知识整理 → spawn ko

## 目录规范

- `memory/`：每日记录 `YYYY-MM-DD.md`
- `benchmarks/`：基准测试结果
- `reports/`：性能分析报告
- `decisions/`：优化决策记录
- `principles/`：性能优化原则
