/**
 * Task Follow-up Plugin
 *
 * 任务跟踪插件 - 强制保证派单汇报机制的有效性
 * 核心功能：
 * 1. 跟踪所有A2A派单任务
 * 2. 每15分钟自动提醒上游Agent汇报进展
 * 3. 超时未汇报自动升级给CEO
 * 4. 提供任务状态查询和统计
 */

import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";

// ============================================================================
// Types & Interfaces
// ============================================================================

type TaskStatus = "pending" | "in_progress" | "blocked" | "completed" | "escalated";

type TrackedTask = {
  taskId: string;              // 任务ID
  title: string;               // 任务标题
  fromAgent: string;           // 派单的Agent
  toAgent: string;             // 接单的Agent
  channel: string;             // 目标频道
  threadTs: string;            // Thread timestamp
  createdAt: number;           // 创建时间
  lastReportAt?: number;       // 最后汇报时间
  status: TaskStatus;          // 任务状态
  reportCount: number;         // 汇报次数
  escalateCount: number;       // 升级次数
  metadata?: {
    closeout?: string;
    blockedReason?: string;
    estimatedCompletion?: number;
  };
};

type FollowupConfig = {
  reportIntervalMinutes: number;     // 汇报间隔（分钟）
  maxEscalateCount: number;          // 最大升级次数
  enableAutoEscalation: boolean;     // 是否启用自动升级
  dataFilePath: string;              // 数据文件路径
};

// ============================================================================
// Task Tracker
// ============================================================================

class TaskTracker {
  private tasks: Map<string, TrackedTask> = new Map();
  private config: FollowupConfig;
  private dataFilePath: string;
  private dirty = false;
  private saveTimer: NodeJS.Timeout | null = null;
  private checkTimer: NodeJS.Timeout | null = null;

  constructor(config: FollowupConfig) {
    this.config = config;
    this.dataFilePath = config.dataFilePath;
  }

  async load(): Promise<void> {
    try {
      await access(this.dataFilePath);
      const data = await readFile(this.dataFilePath, "utf-8");
      const parsed = JSON.parse(data);
      const tasks = parsed.tasks || [];
      this.tasks = new Map(tasks.map((t: TrackedTask) => [t.taskId, t]));
    } catch {
      this.tasks = new Map();
      await this.ensureDir();
    }
  }

  async save(): Promise<void> {
    if (!this.dirty) return;

    await this.ensureDir();
    const data = {
      version: "1.0",
      updatedAt: Date.now(),
      tasks: Array.from(this.tasks.values())
    };
    await writeFile(this.dataFilePath, JSON.stringify(data, null, 2), "utf-8");
    this.dirty = false;
  }

  private async ensureDir(): Promise<void> {
    const dir = dirname(this.dataFilePath);
    try {
      await mkdir(dir, { recursive: true });
    } catch {
      // 目录已存在
    }
  }

  private scheduleSave(): void {
    this.dirty = true;
    if (this.saveTimer) {
      clearTimeout(this.saveTimer);
    }
    this.saveTimer = setTimeout(() => this.save(), 1000);
  }

  addTask(task: Omit<TrackedTask, "createdAt" | "status" | "reportCount" | "escalateCount">): void {
    const trackedTask: TrackedTask = {
      ...task,
      createdAt: Date.now(),
      status: "pending",
      reportCount: 0,
      escalateCount: 0
    };
    this.tasks.set(task.taskId, trackedTask);
    this.scheduleSave();
  }

  updateTask(taskId: string, updates: Partial<TrackedTask>): void {
    const task = this.tasks.get(taskId);
    if (task) {
      Object.assign(task, updates);
      this.tasks.set(taskId, task);
      this.scheduleSave();
    }
  }

  recordReport(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.lastReportAt = Date.now();
      task.reportCount++;
      if (task.status === "pending") {
        task.status = "in_progress";
      }
      this.tasks.set(taskId, task);
      this.scheduleSave();
    }
  }

  completeTask(taskId: string, closeout?: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.status = "completed";
      task.metadata = { ...task.metadata, closeout };
      this.tasks.set(taskId, task);
      this.scheduleSave();
    }
  }

  escalateTask(taskId: string): void {
    const task = this.tasks.get(taskId);
    if (task) {
      task.escalateCount++;
      if (task.escalateCount >= this.config.maxEscalateCount) {
        task.status = "escalated";
      }
      this.tasks.set(taskId, task);
      this.scheduleSave();
    }
  }

  getTask(taskId: string): TrackedTask | undefined {
    return this.tasks.get(taskId);
  }

  getTasksByAgent(agentId: string): TrackedTask[] {
    return Array.from(this.tasks.values())
      .filter(t => t.fromAgent === agentId && t.status !== "completed");
  }

  getOverdueTasks(): TrackedTask[] {
    const now = Date.now();
    const intervalMs = this.config.reportIntervalMinutes * 60 * 1000;
    
    return Array.from(this.tasks.values())
      .filter(t => {
        if (t.status === "completed" || t.status === "escalated") return false;
        const lastReport = t.lastReportAt || t.createdAt;
        return (now - lastReport) > intervalMs;
      });
  }

  getAllActiveTasks(): TrackedTask[] {
    return Array.from(this.tasks.values())
      .filter(t => t.status !== "completed");
  }

  startPeriodicCheck(callback: (overdueTasks: TrackedTask[]) => void): void {
    // 每分钟检查一次
    this.checkTimer = setInterval(() => {
      const overdueTasks = this.getOverdueTasks();
      if (overdueTasks.length > 0) {
        callback(overdueTasks);
      }
    }, 60 * 1000);
  }

  stopPeriodicCheck(): void {
    if (this.checkTimer) {
      clearInterval(this.checkTimer);
      this.checkTimer = null;
    }
  }
}

// ============================================================================
// Plugin Definition
// ============================================================================

const taskFollowupPlugin = {
  id: "task-followup",
  name: "Task Follow-up",
  description: "任务跟踪插件 - 强制保证派单汇报机制的有效性",
  kind: "utility" as const,
  configSchema: Type.Object({
    reportIntervalMinutes: Type.Optional(Type.Number({
      description: "汇报间隔（分钟）",
      default: 15,
      minimum: 5,
      maximum: 60
    })),
    maxEscalateCount: Type.Optional(Type.Number({
      description: "最大升级次数",
      default: 3,
      minimum: 1,
      maximum: 10
    })),
    enableAutoEscalation: Type.Optional(Type.Boolean({
      description: "是否启用自动升级",
      default: true
    })),
    dataFilePath: Type.Optional(Type.String({
      description: "数据文件路径",
      default: "~/.openclaw/task-followup/tasks.json"
    }))
  }),

  register(api: OpenClawPluginApi) {
    const config = api.pluginConfig || {};
    const resolvedPath = api.resolvePath(
      config.dataFilePath || "~/.openclaw/task-followup/tasks.json"
    );

    // 初始化跟踪器
    const tracker = new TaskTracker({
      reportIntervalMinutes: config.reportIntervalMinutes ?? 15,
      maxEscalateCount: config.maxEscalateCount ?? 3,
      enableAutoEscalation: config.enableAutoEscalation ?? true,
      dataFilePath: resolvedPath
    });

    // 异步加载
    tracker.load().then(() => {
      api.logger.info(`task-followup: loaded (${tracker.getAllActiveTasks().length} active tasks)`);
    }).catch((err) => {
      api.logger.warn(`task-followup: failed to load: ${err.message}`);
    });

    // =======================================================================
    // Tools
    // =======================================================================

    // 注册派单任务
    api.registerTool(
      {
        name: "task_followup_register",
        label: "Register Task for Follow-up",
        description: "注册派单任务到跟踪系统。在派单时调用，确保后续汇报机制生效。",
        parameters: Type.Object({
          taskId: Type.String({ description: "任务ID" }),
          title: Type.String({ description: "任务标题" }),
          fromAgent: Type.String({ description: "派单的Agent ID" }),
          toAgent: Type.String({ description: "接单的Agent ID" }),
          channel: Type.String({ description: "目标频道ID" }),
          threadTs: Type.String({ description: "Thread timestamp" })
        }),
        async execute(_toolCallId, params) {
          const { taskId, title, fromAgent, toAgent, channel, threadTs } = params as {
            taskId: string;
            title: string;
            fromAgent: string;
            toAgent: string;
            channel: string;
            threadTs: string;
          };

          tracker.addTask({
            taskId,
            title,
            fromAgent,
            toAgent,
            channel,
            threadTs
          });

          return {
            content: [{
              type: "text",
              text: `✅ 任务已注册跟踪\n\n任务: ${title}\nID: ${taskId}\n派单: ${fromAgent} → ${toAgent}\n汇报间隔: ${config.reportIntervalMinutes ?? 15}分钟\n\n⚠️ 重要：你必须每隔${config.reportIntervalMinutes ?? 15}分钟调用 task_followup_report 汇报进展，否则任务会被自动升级。`
            }],
            details: { taskId, registered: true }
          };
        }
      },
      { name: "task_followup_register" }
    );

    // 汇报任务进展
    api.registerTool(
      {
        name: "task_followup_report",
        label: "Report Task Progress",
        description: "汇报派单任务的进展。必须在派单后定期调用（默认每15分钟）。",
        parameters: Type.Object({
          taskId: Type.String({ description: "任务ID" }),
          status: Type.Union([
            Type.Literal("in_progress"),
            Type.Literal("blocked"),
            Type.Literal("completed")
          ], { description: "任务状态" }),
          summary: Type.String({ description: "进展摘要" }),
          blockedReason: Type.Optional(Type.String({ description: "阻塞原因（如果status=blocked）" })),
          estimatedCompletion: Type.Optional(Type.Number({ description: "预计完成时间戳" }))
        }),
        async execute(_toolCallId, params) {
          const { taskId, status, summary, blockedReason, estimatedCompletion } = params as {
            taskId: string;
            status: "in_progress" | "blocked" | "completed";
            summary: string;
            blockedReason?: string;
            estimatedCompletion?: number;
          };

          tracker.recordReport(taskId);

          if (status === "completed") {
            tracker.completeTask(taskId, summary);
          } else {
            tracker.updateTask(taskId, {
              status,
              metadata: { blockedReason, estimatedCompletion }
            });
          }

          const task = tracker.getTask(taskId);
          const nextReportTime = new Date(Date.now() + (config.reportIntervalMinutes ?? 15) * 60 * 1000);

          return {
            content: [{
              type: "text",
              text: `✅ 进展已记录\n\n任务: ${task?.title}\n状态: ${status}\n摘要: ${summary}${blockedReason ? `\n阻塞原因: ${blockedReason}` : ""}\n\n下次汇报时间: ${nextReportTime.toLocaleTimeString('zh-CN')}\n汇报次数: ${task?.reportCount || 0}`
            }],
            details: { taskId, reported: true, status }
          };
        }
      },
      { name: "task_followup_report" }
    );

    // 查询任务状态
    api.registerTool(
      {
        name: "task_followup_status",
        label: "Query Task Status",
        description: "查询任务跟踪状态",
        parameters: Type.Object({
          taskId: Type.Optional(Type.String({ description: "任务ID（不提供则查询所有）" })),
          agentId: Type.Optional(Type.String({ description: "查询指定Agent的派单任务" }))
        }),
        async execute(_toolCallId, params) {
          const { taskId, agentId } = params as {
            taskId?: string;
            agentId?: string;
          };

          if (taskId) {
            const task = tracker.getTask(taskId);
            if (!task) {
              return {
                content: [{ type: "text", text: `未找到任务: ${taskId}` }],
                details: { found: false }
              };
            }

            const lastReport = task.lastReportAt 
              ? new Date(task.lastReportAt).toLocaleString('zh-CN')
              : "从未汇报";
            
            const overdueMs = Date.now() - (task.lastReportAt || task.createdAt);
            const overdueMinutes = Math.floor(overdueMs / 60000);
            const isOverdue = overdueMinutes > (config.reportIntervalMinutes ?? 15);

            return {
              content: [{
                type: "text",
                text: `📋 任务状态\n\nID: ${task.taskId}\n标题: ${task.title}\n状态: ${task.status}\n派单: ${task.fromAgent} → ${task.toAgent}\n创建: ${new Date(task.createdAt).toLocaleString('zh-CN')}\n最后汇报: ${lastReport}\n汇报次数: ${task.reportCount}\n升级次数: ${task.escalateCount}${isOverdue ? `\n\n⚠️ 已超时 ${overdueMinutes} 分钟` : ""}`
              }],
              details: { task, isOverdue }
            };
          }

          let tasks: TrackedTask[];
          if (agentId) {
            tasks = tracker.getTasksByAgent(agentId);
          } else {
            tasks = tracker.getAllActiveTasks();
          }

          if (tasks.length === 0) {
            return {
              content: [{ type: "text", text: "暂无活动任务" }],
              details: { count: 0 }
            };
          }

          const summary = tasks.map(t => 
            `- [${t.status}] ${t.title} (${t.fromAgent}→${t.toAgent})`
          ).join("\n");

          return {
            content: [{
              type: "text",
              text: `📋 活动任务 (${tasks.length})\n\n${summary}`
            }],
            details: { count: tasks.length, tasks }
          };
        }
      },
      { name: "task_followup_status" }
    );

    // 升级任务
    api.registerTool(
      {
        name: "task_followup_escalate",
        label: "Escalate Task",
        description: "升级任务（当超时未汇报时）",
        parameters: Type.Object({
          taskId: Type.String({ description: "任务ID" }),
          reason: Type.String({ description: "升级原因" })
        }),
        async execute(_toolCallId, params) {
          const { taskId, reason } = params as {
            taskId: string;
            reason: string;
          };

          tracker.escalateTask(taskId);
          const task = tracker.getTask(taskId);

          return {
            content: [{
              type: "text",
              text: `⚠️ 任务已升级\n\n任务: ${task?.title}\n升级次数: ${task?.escalateCount}/${config.maxEscalateCount ?? 3}\n原因: ${reason}${task?.escalateCount >= (config.maxEscalateCount ?? 3) ? "\n\n🚨 已达到最大升级次数，需要CEO介入！" : ""}`
            }],
            details: { taskId, escalated: true, escalateCount: task?.escalateCount }
          };
        }
      },
      { name: "task_followup_escalate" }
    );

    // =======================================================================
    // Lifecycle Hooks
    // =======================================================================

    // 在 agent 启动时检查是否有需要汇报的任务
    api.on("before_agent_start", async (event) => {
      const agentId = api.agentId || "unknown";
      const tasks = tracker.getTasksByAgent(agentId);
      
      if (tasks.length > 0) {
        const now = Date.now();
        const intervalMs = (config.reportIntervalMinutes ?? 15) * 60 * 1000;
        
        const overdueTasks = tasks.filter(t => {
          const lastReport = t.lastReportAt || t.createdAt;
          return (now - lastReport) > intervalMs;
        });

        if (overdueTasks.length > 0) {
          const taskList = overdueTasks.map(t => 
            `- ${t.title} (超时 ${Math.floor((now - (t.lastReportAt || t.createdAt)) / 60000)} 分钟)`
          ).join("\n");

          const prompt = `
<task-followup-alert>
⚠️ 你有 ${overdueTasks.length} 个派单任务超时未汇报！

${taskList}

请立即调用 \`task_followup_report\` 汇报进展，否则任务将被升级。
</task-followup-alert>
          `.trim();

          return { prependContext: prompt };
        }
      }

      return {};
    });

    // 启动定期检查
    tracker.startPeriodicCheck((overdueTasks) => {
      api.logger.warn(`task-followup: ${overdueTasks.length} tasks overdue`);
      
      // 如果启用自动升级
      if (config.enableAutoEscalation !== false) {
        overdueTasks.forEach(task => {
          if (task.escalateCount < (config.maxEscalateCount ?? 3)) {
            tracker.escalateTask(task.taskId);
            api.logger.info(`task-followup: escalated task ${task.taskId}`);
          }
        });
      }
    });

    // =======================================================================
    // Service
    // =======================================================================

    api.registerService({
      id: "task-followup",
      start: () => {
        api.logger.info(`task-followup: service started (interval: ${config.reportIntervalMinutes ?? 15}min)`);
      },
      stop: () => {
        tracker.stopPeriodicCheck();
        tracker.save().catch((err) => {
          api.logger.error(`task-followup: failed to save on stop: ${err.message}`);
        });
        api.logger.info("task-followup: service stopped");
      }
    });
  }
};

export default taskFollowupPlugin;
