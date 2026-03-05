/**
 * OpenClaw Memory Router Plugin
 *
 * 智能记忆检索插件 - 通过模式匹配优先使用已沉淀的记忆
 * 匹配策略：模糊匹配 > 语义检索
 * 自适应阈值：根据历史匹配成功率动态调整
 */

import { randomUUID } from "node:crypto";
import { readFile, writeFile, mkdir, access } from "node:fs/promises";
import { join, dirname } from "node:path";
import type { OpenClawPluginApi } from "openclaw/plugin-sdk";
import { Type } from "@sinclair/typebox";

// ============================================================================
// Types & Interfaces
// ============================================================================

type MemoryEntry = {
  id: string;
  pattern: string;           // 触发模式（正则或关键词）
  content: string;           // 记忆内容
  context?: string;          // 可选上下文
  metadata: {
    createdAt: number;
    updatedAt: number;
    hitCount: number;        // 命中次数
    lastHitAt?: number;      // 最后命中时间
    matchType: "exact" | "fuzzy" | "semantic"; // 最初创建时的匹配类型
    confidence: number;      // 置信度历史
  };
};

type MatchResult = {
  entry: MemoryEntry;
  score: number;             // 0-1 匹配分数
  matchType: "exact" | "fuzzy" | "semantic";
  matchedPattern?: string;   // 实际匹配到的模式
};

type AdaptiveThresholds = {
  exact: number;      // 精确匹配阈值 (默认 0.95)
  fuzzy: number;      // 模糊匹配阈值 (默认 0.70)
  semantic: number;   // 语义检索阈值 (默认 0.60)
  // 自适应调整参数
  successRate: number; // 历史匹配成功率
  adjustmentFactor: number; // 调整因子
};

// ============================================================================
// Configuration Schema
// ============================================================================

const configSchema = Type.Object({
  memoryFilePath: Type.Optional(Type.String({
    description: "记忆存储文件路径（相对于 workspace）",
    default: "~/.openclaw/memory-router/memories.json"
  })),
  adaptiveMode: Type.Optional(Type.Boolean({
    description: "启用自适应阈值调整",
    default: true
  })),
  thresholds: Type.Optional(Type.Object({
    exact: Type.Number({ default: 0.95, minimum: 0, maximum: 1 }),
    fuzzy: Type.Number({ default: 0.70, minimum: 0, maximum: 1 }),
    semantic: Type.Number({ default: 0.60, minimum: 0, maximum: 1 })
  })),
  maxMemoriesPerQuery: Type.Optional(Type.Number({
    description: "每次查询最多返回的记忆数",
    default: 3,
    minimum: 1,
    maximum: 10
  })),
  enableCache: Type.Optional(Type.Boolean({
    description: "启用查询缓存",
    default: true
  })),
  cacheTTL: Type.Optional(Type.Number({
    description: "缓存有效期（毫秒）",
    default: 60000 // 1分钟
  })),
  // 模型选择策略
  modelSelection: Type.Optional(Type.Object({
    highConfidence: Type.String({
      description: "高置信度匹配时使用的模型（可选，空则使用默认）",
      default: ""
    }),
    mediumConfidence: Type.String({
      description: "中等置信度匹配时使用的模型",
      default: ""
    }),
    lowConfidence: Type.String({
      description: "低置信度或无匹配时使用的模型",
      default: ""
    })
  }))
});

// ============================================================================
// Memory Store
// ============================================================================

class MemoryStore {
  private memories: MemoryEntry[] = [];
  private thresholds: AdaptiveThresholds;
  private filePath: string;
  private dirty = false;
  private saveTimer: NodeJS.Timeout | null = null;

  constructor(
    filePath: string,
    initialThresholds: { exact: number; fuzzy: number; semantic: number }
  ) {
    this.filePath = filePath;
    this.thresholds = {
      ...initialThresholds,
      successRate: 0.5,
      adjustmentFactor: 0.05
    };
  }

  async load(): Promise<void> {
    try {
      await access(this.filePath);
      const data = await readFile(this.filePath, "utf-8");
      const parsed = JSON.parse(data);
      this.memories = parsed.memories || [];
      if (parsed.thresholds) {
        this.thresholds = { ...this.thresholds, ...parsed.thresholds };
      }
    } catch (err) {
      // 文件不存在，初始化为空
      this.memories = [];
      await this.ensureDir();
    }
  }

  async save(): Promise<void> {
    if (!this.dirty) return;

    await this.ensureDir();
    const data = {
      version: "1.0",
      updatedAt: Date.now(),
      thresholds: {
        exact: this.thresholds.exact,
        fuzzy: this.thresholds.fuzzy,
        semantic: this.thresholds.semantic,
        successRate: this.thresholds.successRate
      },
      memories: this.memories
    };
    await writeFile(this.filePath, JSON.stringify(data, null, 2), "utf-8");
    this.dirty = false;
  }

  private async ensureDir(): Promise<void> {
    const dir = dirname(this.filePath);
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

  // 添加/更新记忆
  add(entry: Omit<MemoryEntry, "id" | "metadata"> & { metadata?: Partial<MemoryEntry["metadata"]> }): MemoryEntry {
    const now = Date.now();
    const newEntry: MemoryEntry = {
      id: randomUUID(),
      pattern: entry.pattern,
      content: entry.content,
      context: entry.context,
      metadata: {
        createdAt: now,
        updatedAt: now,
        hitCount: 0,
        matchType: entry.metadata?.matchType || "fuzzy",
        confidence: entry.metadata?.confidence || 0.8,
        ...entry.metadata
      }
    };
    this.memories.push(newEntry);
    this.scheduleSave();
    return newEntry;
  }

  // 记录命中
  recordHit(id: string, confidence: number): void {
    const entry = this.memories.find(m => m.id === id);
    if (entry) {
      entry.metadata.hitCount++;
      entry.metadata.lastHitAt = Date.now();
      // 更新平均置信度
      entry.metadata.confidence = (entry.metadata.confidence * 0.7 + confidence * 0.3);
      this.scheduleSave();
    }
  }

  // 获取所有记忆
  getAll(): MemoryEntry[] {
    return [...this.memories];
  }

  // 获取自适应阈值
  getThresholds(): AdaptiveThresholds {
    return { ...this.thresholds };
  }

  // 更新自适应阈值（根据成功率）
  updateAdaptiveThresholds(success: boolean): void {
    // 指数移动平均更新成功率
    this.thresholds.successRate = this.thresholds.successRate * 0.9 + (success ? 1 : 0) * 0.1;

    // 根据成功率调整阈值
    const factor = this.thresholds.adjustmentFactor;
    if (this.thresholds.successRate > 0.8) {
      // 成功率高，可以提高阈值要求（更严格）
      this.thresholds.exact = Math.min(0.98, this.thresholds.exact + factor * 0.1);
      this.thresholds.fuzzy = Math.min(0.85, this.thresholds.fuzzy + factor * 0.2);
    } else if (this.thresholds.successRate < 0.3) {
      // 成功率低，降低阈值要求（更宽松）
      this.thresholds.exact = Math.max(0.90, this.thresholds.exact - factor * 0.1);
      this.thresholds.fuzzy = Math.max(0.60, this.thresholds.fuzzy - factor * 0.2);
    }

    this.scheduleSave();
  }

  // 删除记忆
  delete(id: string): boolean {
    const idx = this.memories.findIndex(m => m.id === id);
    if (idx >= 0) {
      this.memories.splice(idx, 1);
      this.scheduleSave();
      return true;
    }
    return false;
  }
}

// ============================================================================
// Matching Engine
// ============================================================================

class MatchingEngine {
  constructor(private store: MemoryStore) {}

  // 主匹配函数：模糊匹配 > 语义检索
  match(prompt: string): MatchResult[] {
    const results: MatchResult[] = [];
    const thresholds = this.store.getThresholds();

    // 1. 精确匹配（关键词完全包含）
    const exactMatches = this.findExactMatches(prompt, thresholds.exact);
    results.push(...exactMatches);

    // 2. 模糊匹配（编辑距离、相似度）
    const fuzzyMatches = this.findFuzzyMatches(prompt, thresholds.fuzzy, results.map(r => r.entry.id));
    results.push(...fuzzyMatches);

    // 3. 语义检索（简单实现：基于词向量相似度）
    const semanticMatches = this.findSemanticMatches(prompt, thresholds.semantic, results.map(r => r.entry.id));
    results.push(...semanticMatches);

    // 按分数排序
    results.sort((a, b) => b.score - a.score);

    // 记录命中
    for (const result of results.slice(0, 3)) {
      this.store.recordHit(result.entry.id, result.score);
    }

    return results;
  }

  // 精确匹配：检查 prompt 是否包含模式关键词
  private findExactMatches(prompt: string, threshold: number): MatchResult[] {
    const results: MatchResult[] = [];
    const lowerPrompt = prompt.toLowerCase();

    for (const entry of this.store.getAll()) {
      const patterns = entry.pattern.split(/[|,;]/).map(p => p.trim().toLowerCase());

      for (const pattern of patterns) {
        if (!pattern) continue;

        // 完全包含
        if (lowerPrompt.includes(pattern)) {
          const score = pattern.length / Math.max(prompt.length, pattern.length);
          if (score >= threshold) {
            results.push({
              entry,
              score: Math.min(1, score + 0.1), // 精确匹配加分
              matchType: "exact",
              matchedPattern: pattern
            });
            break; // 该 entry 已匹配，跳过后续 pattern
          }
        }
      }
    }

    return results;
  }

  // 模糊匹配：基于字符级相似度
  private findFuzzyMatches(prompt: string, threshold: number, excludeIds: string[]): MatchResult[] {
    const results: MatchResult[] = [];

    for (const entry of this.store.getAll()) {
      if (excludeIds.includes(entry.id)) continue;

      const patterns = entry.pattern.split(/[|,;]/).map(p => p.trim());

      for (const pattern of patterns) {
        if (!pattern) continue;

        const similarity = this.calculateSimilarity(prompt, pattern);
        if (similarity >= threshold) {
          results.push({
            entry,
            score: similarity,
            matchType: "fuzzy",
            matchedPattern: pattern
          });
          break;
        }
      }
    }

    return results;
  }

  // 语义检索：基于词袋模型 + TF-IDF 简化版
  private findSemanticMatches(prompt: string, threshold: number, excludeIds: string[]): MatchResult[] {
    const results: MatchResult[] = [];
    const promptTokens = this.tokenize(prompt);

    for (const entry of this.store.getAll()) {
      if (excludeIds.includes(entry.id)) continue;

      const entryTokens = this.tokenize(entry.pattern + " " + (entry.context || ""));
      const similarity = this.calculateCosineSimilarity(promptTokens, entryTokens);

      if (similarity >= threshold) {
        results.push({
          entry,
          score: similarity,
          matchType: "semantic"
        });
      }
    }

    return results;
  }

  // 计算字符串相似度（Levenshtein 距离简化版）
  private calculateSimilarity(s1: string, s2: string): number {
    const longer = s1.length > s2.length ? s1 : s2;
    const shorter = s1.length > s2.length ? s2 : s1;

    if (longer.length === 0) return 1.0;

    const distance = this.levenshteinDistance(longer.toLowerCase(), shorter.toLowerCase());
    return (longer.length - distance) / longer.length;
  }

  private levenshteinDistance(s1: string, s2: string): number {
    const matrix: number[][] = [];

    for (let i = 0; i <= s2.length; i++) {
      matrix[i] = [i];
    }

    for (let j = 0; j <= s1.length; j++) {
      matrix[0][j] = j;
    }

    for (let i = 1; i <= s2.length; i++) {
      for (let j = 1; j <= s1.length; j++) {
        if (s2.charAt(i - 1) === s1.charAt(j - 1)) {
          matrix[i][j] = matrix[i - 1][j - 1];
        } else {
          matrix[i][j] = Math.min(
            matrix[i - 1][j - 1] + 1, // substitution
            matrix[i][j - 1] + 1,     // insertion
            matrix[i - 1][j] + 1      // deletion
          );
        }
      }
    }

    return matrix[s2.length][s1.length];
  }

  // 分词
  private tokenize(text: string): Map<string, number> {
    const tokens = new Map<string, number>();
    const words = text.toLowerCase()
      .replace(/[^\u4e00-\u9fa5a-z0-9\s]/g, " ") // 保留中文和英文数字
      .split(/\s+/)
      .filter(w => w.length > 1);

    for (const word of words) {
      tokens.set(word, (tokens.get(word) || 0) + 1);
    }

    return tokens;
  }

  // 计算余弦相似度
  private calculateCosineSimilarity(v1: Map<string, number>, v2: Map<string, number>): number {
    const allTokens = new Set([...v1.keys(), ...v2.keys()]);
    let dotProduct = 0;
    let norm1 = 0;
    let norm2 = 0;

    for (const token of allTokens) {
      const a = v1.get(token) || 0;
      const b = v2.get(token) || 0;
      dotProduct += a * b;
      norm1 += a * a;
      norm2 += b * b;
    }

    if (norm1 === 0 || norm2 === 0) return 0;
    return dotProduct / (Math.sqrt(norm1) * Math.sqrt(norm2));
  }
}

// ============================================================================
// Query Cache
// ============================================================================

class QueryCache {
  private cache = new Map<string, { results: MatchResult[]; timestamp: number }>();

  constructor(
    private enabled: boolean,
    private ttl: number
  ) {}

  get(key: string): MatchResult[] | null {
    if (!this.enabled) return null;

    const entry = this.cache.get(key);
    if (!entry) return null;

    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(key);
      return null;
    }

    return entry.results;
  }

  set(key: string, results: MatchResult[]): void {
    if (!this.enabled) return;

    this.cache.set(key, { results, timestamp: Date.now() });

    // 清理过期缓存
    if (this.cache.size > 100) {
      const now = Date.now();
      for (const [k, v] of this.cache.entries()) {
        if (now - v.timestamp > this.ttl) {
          this.cache.delete(k);
        }
      }
    }
  }

  clear(): void {
    this.cache.clear();
  }
}

// ============================================================================
// Plugin Definition
// ============================================================================

const memoryRouterPlugin = {
  id: "memory-router",
  name: "Memory Router",
  description: "智能记忆检索插件 - 模糊匹配优先，自适应阈值",
  kind: "memory" as const,
  configSchema,

  register(api: OpenClawPluginApi) {
    const config = api.pluginConfig || {};
    const resolvedPath = api.resolvePath(
      config.memoryFilePath || "~/.openclaw/memory-router/memories.json"
    );

    // 初始化存储（延迟加载，避免同步阻塞）
    const store = new MemoryStore(resolvedPath, {
      exact: config.thresholds?.exact ?? 0.95,
      fuzzy: config.thresholds?.fuzzy ?? 0.70,
      semantic: config.thresholds?.semantic ?? 0.60
    });

    // 初始化匹配引擎
    const engine = new MatchingEngine(store);

    // 初始化缓存
    const cache = new QueryCache(
      config.enableCache ?? true,
      config.cacheTTL ?? 60000
    );

    // 异步加载存储（不阻塞插件注册）
    store.load().then(() => {
      api.logger.info(`memory-router: loaded (${resolvedPath}, ${store.getAll().length} memories)`);
    }).catch((err) => {
      api.logger.warn(`memory-router: failed to load memories: ${err.message}`);
    });

    // =======================================================================
    // Tools
    // =======================================================================

    // 添加记忆
    api.registerTool(
      {
        name: "memory_add",
        label: "Add Memory",
        description: "添加新的记忆模式。当用户表达偏好、决策或重要信息时使用。",
        parameters: Type.Object({
          pattern: Type.String({ description: "触发模式，支持多个用 | 分隔" }),
          content: Type.String({ description: "记忆内容" }),
          context: Type.Optional(Type.String({ description: "可选上下文" }))
        }),
        async execute(_toolCallId, params) {
          const { pattern, content, context } = params as {
            pattern: string;
            content: string;
            context?: string;
          };

          const entry = store.add({
            pattern,
            content,
            context,
            metadata: { matchType: "fuzzy", confidence: 0.8 }
          });

          return {
            content: [{ type: "text", text: `记忆已添加: ${entry.id}` }],
            details: { id: entry.id, pattern, content: content.slice(0, 100) }
          };
        }
      },
      { name: "memory_add" }
    );

    // 搜索记忆
    api.registerTool(
      {
        name: "memory_search",
        label: "Search Memory",
        description: "搜索相关记忆",
        parameters: Type.Object({
          query: Type.String({ description: "搜索查询" }),
          limit: Type.Optional(Type.Number({ description: "返回数量", default: 5 }))
        }),
        async execute(_toolCallId, params) {
          const { query, limit = 5 } = params as { query: string; limit?: number };

          const results = engine.match(query).slice(0, limit);

          if (results.length === 0) {
            return {
              content: [{ type: "text", text: "未找到相关记忆" }],
              details: { count: 0 }
            };
          }

          const text = results
            .map((r, i) => `${i + 1}. [${r.matchType}] ${r.entry.content} (${(r.score * 100).toFixed(0)}%)`)
            .join("\n");

          return {
            content: [{ type: "text", text: `找到 ${results.length} 条记忆:\n${text}` }],
            details: {
              count: results.length,
              results: results.map(r => ({
                id: r.entry.id,
                content: r.entry.content,
                score: r.score,
                matchType: r.matchType
              }))
            }
          };
        }
      },
      { name: "memory_search" }
    );

    // 列出所有记忆
    api.registerTool(
      {
        name: "memory_list",
        label: "List Memories",
        description: "列出所有记忆",
        parameters: Type.Object({
          limit: Type.Optional(Type.Number({ default: 20 }))
        }),
        async execute(_toolCallId, params) {
          const { limit = 20 } = params as { limit?: number };
          const memories = store.getAll()
            .sort((a, b) => b.metadata.hitCount - a.metadata.hitCount)
            .slice(0, limit);

          const text = memories
            .map(m => `- [${m.metadata.hitCount}次] ${m.pattern} => ${m.content.slice(0, 50)}...`)
            .join("\n");

          return {
            content: [{ type: "text", text: `共 ${store.getAll().length} 条记忆:\n${text}` }],
            details: { total: store.getAll().length, shown: memories.length }
          };
        }
      },
      { name: "memory_list" }
    );

    // 删除记忆
    api.registerTool(
      {
        name: "memory_delete",
        label: "Delete Memory",
        description: "删除指定记忆",
        parameters: Type.Object({
          id: Type.String({ description: "记忆ID" })
        }),
        async execute(_toolCallId, params) {
          const { id } = params as { id: string };
          const success = store.delete(id);

          return {
            content: [{ type: "text", text: success ? "记忆已删除" : "未找到该记忆" }],
            details: { success, id }
          };
        }
      },
      { name: "memory_delete" }
    );

    // 查看统计
    api.registerTool(
      {
        name: "memory_stats",
        label: "Memory Stats",
        description: "查看记忆统计和自适应阈值",
        parameters: Type.Object({}),
        async execute() {
          const thresholds = store.getThresholds();
          const memories = store.getAll();
          const totalHits = memories.reduce((sum, m) => sum + m.metadata.hitCount, 0);

          const text = `
记忆统计:
- 总数: ${memories.length}
- 总命中: ${totalHits}

自适应阈值:
- 精确匹配: ${(thresholds.exact * 100).toFixed(1)}%
- 模糊匹配: ${(thresholds.fuzzy * 100).toFixed(1)}%
- 语义检索: ${(thresholds.semantic * 100).toFixed(1)}%
- 历史成功率: ${(thresholds.successRate * 100).toFixed(1)}%
          `.trim();

          return {
            content: [{ type: "text", text }],
            details: { thresholds, totalMemories: memories.length, totalHits }
          };
        }
      },
      { name: "memory_stats" }
    );

    // =======================================================================
    // Lifecycle Hook: before_agent_start
    // =======================================================================

    api.on("before_agent_start", async (event) => {
      const prompt = event.prompt;
      if (!prompt || prompt.length < 3) return;

      // 检查缓存
      const cacheKey = prompt.slice(0, 100); // 前100字符作为缓存键
      let results = cache.get(cacheKey);

      if (!results) {
        results = engine.match(prompt);
        cache.set(cacheKey, results);
      }

      if (results.length === 0) {
        // 无匹配，更新自适应阈值（失败）
        if (config.adaptiveMode !== false) {
          store.updateAdaptiveThresholds(false);
        }
        return;
      }

      // 有匹配，更新自适应阈值（成功）
      if (config.adaptiveMode !== false) {
        store.updateAdaptiveThresholds(true);
      }

      // 取最佳匹配
      const bestMatch = results[0];
      const maxMemories = config.maxMemoriesPerQuery ?? 3;
      const topResults = results.slice(0, maxMemories);

      // 构建上下文
      const memoryContext = topResults
        .map((r, i) => `[${i + 1}] ${r.entry.content}${r.entry.context ? ` (${r.entry.context})` : ""}`)
        .join("\n");

      const prependContext = `
<relevant-memories>
以下是从记忆库中检索到的相关信息（匹配度: ${(bestMatch.score * 100).toFixed(0)}%，类型: ${bestMatch.matchType}）：
${memoryContext}
</relevant-memories>
      `.trim();

      api.logger.info?.(`memory-router: injected ${topResults.length} memories (best: ${(bestMatch.score * 100).toFixed(0)}%)`);

      // 模型选择策略
      const modelSelection = config.modelSelection || {};
      let modelOverride: string | undefined;

      if (bestMatch.score >= 0.90 && modelSelection.highConfidence) {
        modelOverride = modelSelection.highConfidence;
      } else if (bestMatch.score >= 0.70 && modelSelection.mediumConfidence) {
        modelOverride = modelSelection.mediumConfidence;
      } else if (modelSelection.lowConfidence) {
        modelOverride = modelSelection.lowConfidence;
      }

      return {
        prependContext,
        ...(modelOverride && { modelOverride })
      };
    });

    // =======================================================================
    // CLI Commands
    // =======================================================================

    api.registerCli(
      ({ program }) => {
        const mem = program.command("memory-router").description("Memory Router 插件命令");

        mem
          .command("stats")
          .description("显示统计信息")
          .action(async () => {
            const thresholds = store.getThresholds();
            const memories = store.getAll();
            console.log(`记忆总数: ${memories.length}`);
            console.log(`自适应阈值: 精确=${thresholds.exact.toFixed(2)}, 模糊=${thresholds.fuzzy.toFixed(2)}, 语义=${thresholds.semantic.toFixed(2)}`);
            console.log(`历史成功率: ${(thresholds.successRate * 100).toFixed(1)}%`);
          });

        mem
          .command("list")
          .description("列出记忆")
          .option("-l, --limit <n>", "数量限制", "20")
          .action(async (opts) => {
            const memories = store.getAll()
              .sort((a, b) => b.metadata.hitCount - a.metadata.hitCount)
              .slice(0, parseInt(opts.limit));
            console.log(JSON.stringify(memories, null, 2));
          });

        mem
          .command("clear-cache")
          .description("清除查询缓存")
          .action(async () => {
            cache.clear();
            console.log("缓存已清除");
          });
      },
      { commands: ["memory-router"] }
    );

    // =======================================================================
    // Service
    // =======================================================================

    api.registerService({
      id: "memory-router",
      start: () => {
        api.logger.info(`memory-router: service started (${store.getAll().length} memories)`);
      },
      stop: () => {
        // 同步保存，确保数据不丢失
        store.save().catch((err) => {
          api.logger.error(`memory-router: failed to save on stop: ${err.message}`);
        });
        api.logger.info("memory-router: service stopped");
      }
    });
  }
};

export default memoryRouterPlugin;
