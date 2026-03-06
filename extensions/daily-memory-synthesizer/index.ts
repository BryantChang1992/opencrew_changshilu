/**
 * Daily Memory Synthesizer Plugin
 *
 * 每日记忆自动总结插件 - 让每个 Agent 在每天结束时自主总结当日的经验教训
 * 核心功能：
 * 1. 监测当日任务完成情况（通过 closeout 记录）
 * 2. 在每日结束时（或下次启动时）触发总结
 * 3. 自动生成结构化的 daily memory 文件
 * 4. 定期提醒 Agent review 并升级到长期记忆
 */

import { readFile, writeFile, mkdir, access, readdir } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";

// ============================================================================
// Types & Interfaces
// ============================================================================

type DailyMemory = {
  date: string;              // YYYY-MM-DD
  agentId: string;
  tasks: TaskSummary[];
  insights: string[];        // 今日洞察
  lessons: string[];         // 经验教训
  selfUpdates: string[];     // 自我迭代记录
  createdAt: number;
  updatedAt: number;
};

type TaskSummary = {
  taskId: string;
  title: string;
  type: "Q" | "A" | "P" | "S";
  status: "completed" | "blocked" | "ongoing";
  closeout?: string;         // closeout 摘要
  signal: number;            // 0-3 重要性
};

type SynthesizerConfig = {
  memoryDir: string;         // memory 目录路径
  timezone: string;          // 时区
  summaryHour: number;       // 每天几点触发总结（0-23）
  enableAutoSummary: boolean; // 是否启用自动总结
  maxTasksPerDay: number;    // 每天最多记录多少任务
};

// ============================================================================
// Daily Memory Manager
// ============================================================================

class DailyMemoryManager {
  private config: SynthesizerConfig;
  private currentMemory: DailyMemory | null = null;

  constructor(config: SynthesizerConfig) {
    this.config = config;
  }

  async loadOrCreate(date: string, agentId: string): Promise<DailyMemory> {
    const filePath = this.getMemoryFilePath(date);

    try {
      await access(filePath);
      const data = await readFile(filePath, "utf-8");
      this.currentMemory = JSON.parse(data);
    } catch {
      // 文件不存在，创建新的
      this.currentMemory = {
        date,
        agentId,
        tasks: [],
        insights: [],
        lessons: [],
        selfUpdates: [],
        createdAt: Date.now(),
        updatedAt: Date.now()
      };
      await this.save();
    }

    return this.currentMemory!;
  }

  async save(): Promise<void> {
    if (!this.currentMemory) return;

    const filePath = this.getMemoryFilePath(this.currentMemory.date);
    await this.ensureDir(dirname(filePath));

    this.currentMemory.updatedAt = Date.now();
    await writeFile(filePath, JSON.stringify(this.currentMemory, null, 2), "utf-8");
  }

  addTask(task: TaskSummary): void {
    if (!this.currentMemory) return;

    // 检查是否已存在
    const existing = this.currentMemory.tasks.find(t => t.taskId === task.taskId);
    if (existing) {
      Object.assign(existing, task);
    } else {
      this.currentMemory.tasks.push(task);
    }
  }

  addInsight(insight: string): void {
    if (!this.currentMemory || this.currentMemory.insights.includes(insight)) return;
    this.currentMemory.insights.push(insight);
  }

  addLesson(lesson: string): void {
    if (!this.currentMemory || this.currentMemory.lessons.includes(lesson)) return;
    this.currentMemory.lessons.push(lesson);
  }

  addSelfUpdate(update: string): void {
    if (!this.currentMemory || this.currentMemory.selfUpdates.includes(update)) return;
    this.currentMemory.selfUpdates.push(update);
  }

  getTasks(): TaskSummary[] {
    return this.currentMemory?.tasks || [];
  }

  private getMemoryFilePath(date: string): string {
    return join(this.config.memoryDir, `${date}.json`);
  }

  private async ensureDir(dir: string): Promise<void> {
    try {
      await mkdir(dir, { recursive: true });
    } catch {
      // 目录已存在
    }
  }
}

// ============================================================================
// Memory Synthesizer
// ============================================================================

class MemorySynthesizer {
  constructor(private manager: DailyMemoryManager) {}

  async synthesizeDailySummary(): Promise<string> {
    const memory = this.manager.loadOrCreate(
      this.getCurrentDate(),
      "current-agent" // 会被实际 agent id 替换
    );

    const tasks = this.manager.getTasks();

    if (tasks.length === 0) {
      return "# 今日暂无任务记录\n\n暂无需要总结的内容。";
    }

    // 构建总结提示
    const summary = this.buildSummaryPrompt(memory);
    return summary;
  }

  private buildSummaryPrompt(memory: DailyMemory): string {
    const completedTasks = memory.tasks.filter(t => t.status === "completed");
    const blockedTasks = memory.tasks.filter(t => t.status === "blocked");
    const ongoingTasks = memory.tasks.filter(t => t.status === "ongoing");
    const highSignalTasks = memory.tasks.filter(t => t.signal >= 2);

    let prompt = `# 每日记忆总结提示 - ${memory.date}

## 今日完成任务 (${completedTasks.length})

${completedTasks.map(t => `- [${t.type}] ${t.title}${t.closeout ? `\n  Closeout: ${t.closeout}` : ""}`).join("\n")}

## 高价值任务 (signal≥2, ${highSignalTasks.length}个)

${highSignalTasks.map(t => `- ${t.title}: ${t.closeout || "无 closeout"}`).join("\n")}

## 阻塞/进行中任务

${blockedTasks.length > 0 ? `阻塞: ${blockedTasks.map(t => t.title).join(", ")}` : ""}
${ongoingTasks.length > 0 ? `进行中: ${ongoingTasks.map(t => t.title).join(", ")}` : ""}

## 请回答以下问题并更新记忆：

1. **今日最大收获**：今天最重要的认知/经验是什么？
2. **踩过的坑**：今天遇到了哪些坑？如何避免？
3. **改进建议**：哪些流程/方法可以优化？
4. **值得沉淀**：哪些经验值得写入长期记忆 (MEMORY.md)？

请用简洁的语言回答，每条不超过 2 句话。
`;

    return prompt;
  }

  private getCurrentDate(): string {
    const now = new Date();
    return now.toISOString().split("T")[0];
  }
}

// ============================================================================
// Plugin Definition
// ============================================================================

const dailyMemorySynthesizerPlugin = {
  id: "daily-memory-synthesizer",
  name: "Daily Memory Synthesizer",
  description: "每日记忆自动总结插件 - 让 Agent 每天自主总结经验教训",
  kind: "memory" as const,
  configSchema: Type.Object({
    memoryDir: Type.Optional(Type.String({
      description: "memory 目录路径（相对于 workspace）",
      default: "memory"
    })),
    timezone: Type.Optional(Type.String({
      description: "时区",
      default: "Asia/Shanghai"
    })),
    summaryHour: Type.Optional(Type.Number({
      description: "每天几点触发总结（0-23）",
      default: 23,
      minimum: 0,
      maximum: 23
    })),
    enableAutoSummary: Type.Optional(Type.Boolean({
      description: "是否启用自动总结提示",
      default: true
    })),
    maxTasksPerDay: Type.Optional(Type.Number({
      description: "每天最多记录多少任务",
      default: 20,
      minimum: 5,
      maximum: 50
    }))
  }),

  register(api: OpenClawPluginApi) {
    const config = api.pluginConfig || {};
    const workspacePath = api.resolvePath(".");
    const memoryDir = api.resolvePath(config.memoryDir || "memory");

    // 初始化管理器
    const manager = new DailyMemoryManager({
      memoryDir,
      timezone: config.timezone || "Asia/Shanghai",
      summaryHour: config.summaryHour ?? 23,
      enableAutoSummary: config.enableAutoSummary ?? true,
      maxTasksPerDay: config.maxTasksPerDay ?? 20
    });

    const synthesizer = new MemorySynthesizer(manager);

    // =======================================================================
    // Tools
    // =======================================================================

    // 记录任务
    api.registerTool(
      {
        name: "daily_memory_record_task",
        label: "Record Task to Daily Memory",
        description: "记录任务到每日记忆。在任务完成或产生重要进展时调用。",
        parameters: Type.Object({
          taskId: Type.String({ description: "任务ID" }),
          title: Type.String({ description: "任务标题" }),
          type: Type.Union([
            Type.Literal("Q"),
            Type.Literal("A"),
            Type.Literal("P"),
            Type.Literal("S")
          ], { description: "任务类型" }),
          status: Type.Union([
            Type.Literal("completed"),
            Type.Literal("blocked"),
            Type.Literal("ongoing")
          ], { description: "任务状态" }),
          closeout: Type.Optional(Type.String({ description: "Closeout 摘要" })),
          signal: Type.Optional(Type.Number({
            description: "重要性 0-3，默认 1",
            minimum: 0,
            maximum: 3,
            default: 1
          }))
        }),
        async execute(_toolCallId, params) {
          const { taskId, title, type, status, closeout, signal = 1 } = params as {
            taskId: string;
            title: string;
            type: "Q" | "A" | "P" | "S";
            status: "completed" | "blocked" | "ongoing";
            closeout?: string;
            signal?: number;
          };

          const date = new Date().toISOString().split("T")[0];
          await manager.loadOrCreate(date, api.agentId || "unknown");

          manager.addTask({
            taskId,
            title,
            type,
            status,
            closeout,
            signal
          });

          await manager.save();

          return {
            content: [{
              type: "text",
              text: `✅ 任务已记录到 ${date} 的每日记忆\n\n任务: ${title}\n类型: ${type}\n状态: ${status}\n重要性: ${signal}`
            }],
            details: { taskId, date, recorded: true }
          };
        }
      },
      { name: "daily_memory_record_task" }
    );

    // 记录洞察
    api.registerTool(
      {
        name: "daily_memory_add_insight",
        label: "Add Insight to Daily Memory",
        description: "添加今日洞察到每日记忆。当你有重要发现或认知时调用。",
        parameters: Type.Object({
          insight: Type.String({ description: "洞察内容" })
        }),
        async execute(_toolCallId, params) {
          const { insight } = params as { insight: string };

          const date = new Date().toISOString().split("T")[0];
          await manager.loadOrCreate(date, api.agentId || "unknown");

          manager.addInsight(insight);
          await manager.save();

          return {
            content: [{
              type: "text",
              text: `✅ 洞察已添加到 ${date} 的每日记忆\n\n💡 ${insight}`
            }],
            details: { date, added: true }
          };
        }
      },
      { name: "daily_memory_add_insight" }
    );

    // 记录经验教训
    api.registerTool(
      {
        name: "daily_memory_add_lesson",
        label: "Add Lesson to Daily Memory",
        description: "添加经验教训到每日记忆。当你踩坑或学到重要经验时调用。",
        parameters: Type.Object({
          lesson: Type.String({ description: "经验教训内容" })
        }),
        async execute(_toolCallId, params) {
          const { lesson } = params as { lesson: string };

          const date = new Date().toISOString().split("T")[0];
          await manager.loadOrCreate(date, api.agentId || "unknown");

          manager.addLesson(lesson);
          await manager.save();

          return {
            content: [{
              type: "text",
              text: `✅ 经验教训已添加到 ${date} 的每日记忆\n\n📝 ${lesson}`
            }],
            details: { date, added: true }
          };
        }
      },
      { name: "daily_memory_add_lesson" }
    );

    // 记录自我迭代
    api.registerTool(
      {
        name: "daily_memory_record_self_update",
        label: "Record Self-Update to Daily Memory",
        description: "记录自我迭代到每日记忆。当你修改自己的配置文件时调用。",
        parameters: Type.Object({
          update: Type.String({ description: "自我迭代内容：变更了什么、为什么、如何回滚" })
        }),
        async execute(_toolCallId, params) {
          const { update } = params as { update: string };

          const date = new Date().toISOString().split("T")[0];
          await manager.loadOrCreate(date, api.agentId || "unknown");

          manager.addSelfUpdate(update);
          await manager.save();

          return {
            content: [{
              type: "text",
              text: `✅ 自我迭代已记录到 ${date} 的每日记忆\n\n🔄 ${update}`
            }],
            details: { date, added: true }
          };
        }
      },
      { name: "daily_memory_record_self_update" }
    );

    // 生成每日总结
    api.registerTool(
      {
        name: "daily_memory_synthesize",
        label: "Synthesize Daily Memory Summary",
        description: "生成每日记忆总结。在每天结束时或需要盘点时调用。",
        parameters: Type.Object({
          autoUpdate: Type.Optional(Type.Boolean({
            description: "是否自动更新 MEMORY.md（将高价值内容升级为长期记忆）",
            default: false
          }))
        }),
        async execute(_toolCallId, params) {
          const { autoUpdate = false } = params as { autoUpdate?: boolean };

          const date = new Date().toISOString().split("T")[0];
          await manager.loadOrCreate(date, api.agentId || "unknown");

          const summary = await synthesizer.synthesizeDailySummary();

          // 保存为 Markdown 格式
          const mdPath = join(memoryDir, `${date}.md`);
          await manager.save();

          // 转换为 Markdown 格式
          const memory = await manager.loadOrCreate(date, api.agentId || "unknown");
          const mdContent = generateMarkdownContent(memory);
          await writeFile(mdPath, mdContent, "utf-8");

          return {
            content: [{
              type: "text",
              text: `📊 每日记忆总结已生成\n\n文件: ${mdPath}\n\n${summary}`
            }],
            details: { date, mdPath, autoUpdate }
          };
        }
      },
      { name: "daily_memory_synthesize" }
    );

    // 查看每日记忆
    api.registerTool(
      {
        name: "daily_memory_view",
        label: "View Daily Memory",
        description: "查看指定日期的每日记忆",
        parameters: Type.Object({
          date: Type.Optional(Type.String({
            description: "日期 YYYY-MM-DD，默认今天",
            default: new Date().toISOString().split("T")[0]
          }))
        }),
        async execute(_toolCallId, params) {
          const { date = new Date().toISOString().split("T")[0] } = params as { date?: string };

          const memory = await manager.loadOrCreate(date, api.agentId || "unknown");

          const content = `# 每日记忆 - ${date}

## 任务记录 (${memory.tasks.length})

${memory.tasks.map(t =>
  `- [${t.type}] ${t.title} (${t.status}, signal: ${t.signal})${t.closeout ? `\n  ${t.closeout}` : ""}`
).join("\n")}

## 今日洞察

${memory.insights.map(i => `- 💡 ${i}`).join("\n") || "暂无"}

## 经验教训

${memory.lessons.map(l => `- 📝 ${l}`).join("\n") || "暂无"}

## 自我迭代

${memory.selfUpdates.map(u => `- 🔄 ${u}`).join("\n") || "暂无"}
`;

          return {
            content: [{ type: "text", text: content }],
            details: { date, taskCount: memory.tasks.length }
          };
        }
      },
      { name: "daily_memory_view" }
    );

    // =======================================================================
    // Lifecycle Hooks
    // =======================================================================

    // 在 agent 启动时检查是否需要触发每日总结
    api.on("before_agent_start", async (event) => {
      const now = new Date();
      const hour = now.getHours();

      // 如果启用了自动总结，并且在总结时间（默认23点）
      if (config.enableAutoSummary !== false && hour === (config.summaryHour ?? 23)) {
        const date = now.toISOString().split("T")[0];
        const memory = await manager.loadOrCreate(date, api.agentId || "unknown");

        // 如果今天还没有总结
        if (memory.tasks.length > 0 && memory.insights.length === 0) {
          const prompt = `
<daily-memory-reminder>
⏰ 现在是每日总结时间。

你今天完成了 ${memory.tasks.length} 个任务，但还没有记录洞察和经验教训。

建议调用 \`daily_memory_synthesize\` 工具生成每日总结。
</daily-memory-reminder>
          `.trim();

          return { prependContext: prompt };
        }
      }

      return {};
    });

    // 在 agent 结束时，如果完成了任务，提示记录
    api.on("after_agent_complete", async (event) => {
      // 检查是否有任务完成但未记录
      // 这里可以添加更复杂的逻辑
    });

    // =======================================================================
    // CLI Commands
    // =======================================================================

    api.registerCli(
      ({ program }) => {
        const mem = program.command("daily-memory").description("每日记忆管理命令");

        mem
          .command("summary [date]")
          .description("生成指定日期的总结（默认今天）")
          .action(async (date) => {
            const targetDate = date || new Date().toISOString().split("T")[0];
            const memory = await manager.loadOrCreate(targetDate, api.agentId || "unknown");
            console.log(JSON.stringify(memory, null, 2));
          });

        mem
          .command("list")
          .description("列出所有每日记忆文件")
          .action(async () => {
            try {
              const files = await readdir(memoryDir);
              const memoryFiles = files.filter(f => f.endsWith('.json'));
              console.log(`找到 ${memoryFiles.length} 个每日记忆文件:`);
              memoryFiles.forEach(f => console.log(`  - ${f}`));
            } catch {
              console.log("暂无每日记忆文件");
            }
          });
      },
      { commands: ["daily-memory"] }
    );

    // =======================================================================
    // Service
    // =======================================================================

    api.registerService({
      id: "daily-memory-synthesizer",
      start: () => {
        api.logger.info("daily-memory-synthesizer: service started");
      },
      stop: () => {
        api.logger.info("daily-memory-synthesizer: service stopped");
      }
    });
  }
};

// ============================================================================
// Helper Functions
// ============================================================================

function generateMarkdownContent(memory: DailyMemory): string {
  return `# ${memory.date} - 每日记忆

> 生成时间: ${new Date(memory.updatedAt).toLocaleString('zh-CN')}

## 任务记录 (${memory.tasks.length})

${memory.tasks.map(t =>
  `### [${t.type}] ${t.title}

- **状态**: ${t.status}
- **重要性**: ${t.signal}
${t.closeout ? `- **Closeout**: ${t.closeout}` : ""}
`
).join("\n")}

## 今日洞察

${memory.insights.map(i => `- ${i}`).join("\n") || "暂无"}

## 经验教训

${memory.lessons.map(l => `- ${l}`).join("\n") || "暂无"}

## 自我迭代

${memory.selfUpdates.map(u => `- ${u}`).join("\n") || "暂无"}
`;
}

export default dailyMemorySynthesizerPlugin;
