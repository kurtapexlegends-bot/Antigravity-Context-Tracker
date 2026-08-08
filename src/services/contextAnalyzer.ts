import { TranscriptStep, ConversationSession } from './transcriptWatcher';
import * as path from 'path';

export type RiskLevel = 'LOW' | 'MODERATE' | 'HIGH';

export interface CategoryBreakdown {
  systemPromptTokens: number;
  userPromptTokens: number;
  modelOutputTokens: number;
  toolOutputTokens: number;
  totalTokens: number;
  limitTokens: number;
  percentageUsed: number;
}

export interface ReferencedFile {
  path: string;
  filename: string;
  count: number;
}

export interface ToolUsageStat {
  toolName: string;
  count: number;
}

export interface AnalysisResult {
  sessionId: string;
  lastUpdated: string;
  stepCount: number;
  tokens: CategoryBreakdown;
  activeFiles: ReferencedFile[];
  toolStats: ToolUsageStat[];
  modelName: string;
  riskLevel: RiskLevel;
  riskMessage: string;
  stepsSummary: Array<{
    index: number;
    type: string;
    source: string;
    snippet: string;
    tools: string[];
    status: string;
  }>;
}

export class ContextAnalyzer {
  private static DEFAULT_LIMIT = 1000000; // 1M tokens default for Gemini

  public static analyze(steps: TranscriptStep[], session: ConversationSession): AnalysisResult {
    let userPromptTokens = 0;
    let modelOutputTokens = 0;
    let toolOutputTokens = 0;
    
    // Baseline system prompt + skills/rules context estimate
    let systemPromptTokens = 8500;

    const fileMap = new Map<string, number>();
    const toolMap = new Map<string, number>();
    const stepsSummary: AnalysisResult['stepsSummary'] = [];

    let modelName = 'Gemini 3.6 Flash';

    // File path regex compiled once
    const fileRegex = /(?:[A-Za-z]:[\\/][^:*?"<>|\r\n\s]+\.[a-zA-Z0-9]+|file:\/\/\/[^:*?"<>|\r\n\s]+\.[a-zA-Z0-9]+)/g;

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const stepType = step.type || 'UNKNOWN';
      const stepSource = step.source || 'MODEL';
      const contentStr = typeof step.content === 'string' 
        ? step.content 
        : (step.content ? JSON.stringify(step.content) : '');

      const estimatedTokens = Math.ceil(contentStr.length / 4);

      if (stepType === 'USER_INPUT') {
        userPromptTokens += estimatedTokens;
      } else if (stepType === 'PLANNER_RESPONSE' || stepSource === 'MODEL') {
        modelOutputTokens += estimatedTokens;
      } else {
        toolOutputTokens += estimatedTokens;
      }

      if (contentStr.includes('Gemini Pro') || contentStr.includes('gemini-pro')) {
        modelName = 'Gemini 3.6 Pro';
      }

      const toolNames: string[] = [];
      if (step.tool_calls && Array.isArray(step.tool_calls)) {
        for (const tc of step.tool_calls) {
          const tName = tc.name || 'unknown_tool';
          toolNames.push(tName);
          toolMap.set(tName, (toolMap.get(tName) || 0) + 1);

          if (tc.arguments) {
            this.extractFilesFromText(JSON.stringify(tc.arguments), fileMap, fileRegex);
          }
        }
      }

      if (contentStr.length < 5000) { // skip file scanning on massive text blobs to remain super lightweight
        this.extractFilesFromText(contentStr, fileMap, fileRegex);
      }

      // Keep step snippet lightweight
      let snippet = contentStr.replace(/[\r\n]+/g, ' ');
      if (snippet.length > 120) {
        snippet = snippet.substring(0, 120) + '...';
      }

      stepsSummary.push({
        index: step.step_index ?? i,
        type: stepType,
        source: stepSource,
        snippet,
        tools: toolNames,
        status: step.status || 'DONE'
      });
    }

    const totalTokens = systemPromptTokens + userPromptTokens + modelOutputTokens + toolOutputTokens;
    const percentageUsed = Math.min(100, Math.round((totalTokens / this.DEFAULT_LIMIT) * 1000) / 10);

    // Determine Hallucination Risk Level & Recommendation Threshold
    // Thresholds based on LLM attention density & Needle-In-A-Haystack research:
    // < 50%: LOW (High reasoning accuracy, sharp recall)
    // 50% - 70%: MODERATE (Attention dilution starts; details may be skipped)
    // > 70%: HIGH (Context saturation; model is prone to hallucinations & loss of focus)
    let riskLevel: RiskLevel = 'LOW';
    let riskMessage = '🟢 Low Risk: Optimal context recall & reasoning precision.';

    if (percentageUsed >= 70) {
      riskLevel = 'HIGH';
      riskMessage = '🔴 High Risk (>70% capacity): Model is prone to hallucinations and detail loss. Start a new chat session!';
    } else if (percentageUsed >= 50) {
      riskLevel = 'MODERATE';
      riskMessage = '🟡 Moderate Risk (50-70% capacity): Attention density diluting. Keep prompts concise.';
    }

    const activeFiles: ReferencedFile[] = Array.from(fileMap.entries())
      .map(([filePath, count]) => {
        const parts = filePath.split(/[/\\]/);
        const filename = parts[parts.length - 1] || filePath;
        return { path: filePath, filename, count };
      })
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);

    const toolStats: ToolUsageStat[] = Array.from(toolMap.entries())
      .map(([toolName, count]) => ({ toolName, count }))
      .sort((a, b) => b.count - a.count);

    return {
      sessionId: session.id,
      lastUpdated: new Date().toLocaleTimeString(),
      stepCount: steps.length,
      modelName,
      riskLevel,
      riskMessage,
      tokens: {
        systemPromptTokens,
        userPromptTokens,
        modelOutputTokens,
        toolOutputTokens,
        totalTokens,
        limitTokens: this.DEFAULT_LIMIT,
        percentageUsed
      },
      activeFiles,
      toolStats,
      stepsSummary: stepsSummary.reverse()
    };
  }

  private static extractFilesFromText(text: string, fileMap: Map<string, number>, regex: RegExp) {
    regex.lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = regex.exec(text)) !== null) {
      let matchedPath = match[0].replace('file:///', '');
      matchedPath = path.normalize(matchedPath);
      if (!matchedPath.includes('node_modules') && !matchedPath.includes('.system_generated')) {
        fileMap.set(matchedPath, (fileMap.get(matchedPath) || 0) + 1);
      }
    }
  }
}
