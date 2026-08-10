import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { TranscriptStep } from './transcriptWatcher';

export interface ModelCapability {
  modelName: string;
  limitTokens: number;
  family: string;
  thresholdTokens: number;
}

export class ModelDetector {
  public static detectModel(steps: TranscriptStep[]): ModelCapability {
    let rawModelName = '';

    // 1. Try reading from ~/.gemini/settings.json
    try {
      const settingsPath = path.join(os.homedir(), '.gemini', 'settings.json');
      if (fs.existsSync(settingsPath)) {
        const raw = fs.readFileSync(settingsPath, 'utf-8');
        const parsed = JSON.parse(raw);
        if (parsed && parsed.model && parsed.model.name) {
          rawModelName = parsed.model.name;
        }
      }
    } catch (e) {}

    // 2. Try checking VS Code settings workspace configuration if in extension runtime
    if (!rawModelName) {
      try {
        // eslint-disable-next-line @typescript-eslint/no-var-requires
        const vscode = require('vscode');
        if (vscode && vscode.workspace) {
          const config = vscode.workspace.getConfiguration('antigravity');
          const cfgModel = (config.get('model') as string) || (config.get('modelSelection') as string);
          if (cfgModel) {
            rawModelName = cfgModel;
          }

        }
      } catch (e) {
        // Ignore if running outside VS Code extension host (e.g. CLI tests)
      }
    }

    // 3. Scan transcript steps for latest model selection change or step metadata
    if (steps && steps.length > 0) {
      for (let i = steps.length - 1; i >= 0; i--) {
        const step = steps[i];
        const contentStr = typeof step.content === 'string' 
          ? step.content 
          : (step.content ? JSON.stringify(step.content) : '');

        const match = contentStr.match(/Model Selection`? from [^ ]+ to ([A-Za-z0-9. ()-]+)/i);
        if (match && match[1]) {
          rawModelName = match[1].trim();
          break;
        }

        if (contentStr.includes('gemini-3.6-pro') || contentStr.includes('Gemini 3.6 Pro') || contentStr.includes('gemini-3.1-pro')) {
          if (!rawModelName) rawModelName = 'Gemini 3.6 Pro';
        }
      }
    }

    if (!rawModelName) {
      rawModelName = 'Gemini 3.6 Flash';
    }

    return this.getCapability(rawModelName);
  }

  public static getCapability(rawName: string): ModelCapability {
    const lower = rawName.toLowerCase();

    // Gemini Pro (2M Tokens)
    if (lower.includes('pro') || lower.includes('gemini-3.1-pro') || lower.includes('gemini-3.6-pro')) {
      const limitTokens = 2097152; // 2,097,152 Tokens (2M)
      return {
        modelName: 'Gemini 3.6 Pro',
        limitTokens,
        family: 'Gemini',
        thresholdTokens: Math.floor(limitTokens * 0.70)
      };
    }

    // Claude 3.5 Sonnet (200k Tokens)
    if (lower.includes('claude') || lower.includes('sonnet')) {
      const limitTokens = 200000; // 200,000 Tokens (200k)
      return {
        modelName: 'Claude 3.5 Sonnet',
        limitTokens,
        family: 'Anthropic',
        thresholdTokens: Math.floor(limitTokens * 0.70)
      };
    }

    // GPT-4o (128k Tokens)
    if (lower.includes('gpt-4') || lower.includes('gpt4') || lower.includes('openai')) {
      const limitTokens = 128000; // 128,000 Tokens (128k)
      return {
        modelName: 'GPT-4o',
        limitTokens,
        family: 'OpenAI',
        thresholdTokens: Math.floor(limitTokens * 0.70)
      };
    }

    // DeepSeek (128k Tokens)
    if (lower.includes('deepseek')) {
      const limitTokens = 128000; // 128,000 Tokens (128k)
      return {
        modelName: 'DeepSeek R1/V3',
        limitTokens,
        family: 'DeepSeek',
        thresholdTokens: Math.floor(limitTokens * 0.70)
      };
    }

    // Gemini Flash (Default 1M Tokens)
    const limitTokens = 1048576; // 1,048,576 Tokens (1M)
    return {
      modelName: rawName.length > 25 ? 'Gemini 3.6 Flash' : rawName,
      limitTokens,
      family: 'Gemini',
      thresholdTokens: Math.floor(limitTokens * 0.70)
    };
  }
}
