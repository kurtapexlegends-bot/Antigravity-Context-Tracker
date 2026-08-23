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

    // 1. Scan transcript steps for latest model selection change or system metadata
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

        // Direct mention in system messages
        const directMatch = contentStr.match(/Gemini (3\.[0-9]|1\.[0-9]|2\.[0-9]) [A-Za-z0-9 ()]+/i);
        if (directMatch && directMatch[0]) {
          rawModelName = directMatch[0].trim();
          break;
        }
      }
    }

    // 2. Try reading from ~/.gemini/settings.json
    if (!rawModelName) {
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
    }

    // 3. Try checking VS Code settings workspace configuration if in extension runtime
    if (!rawModelName) {
      try {
        const vscode = require('vscode');
        if (vscode && vscode.workspace) {
          const config = vscode.workspace.getConfiguration('antigravity');
          const cfgModel = (config.get('model') as string) || (config.get('modelSelection') as string);
          if (cfgModel) {
            rawModelName = cfgModel;
          }
        }
      } catch (e) {}
    }

    if (!rawModelName) {
      rawModelName = 'Gemini 3.7 Flash';
    }

    return this.getCapability(rawModelName);
  }

  public static getCapability(rawName: string): ModelCapability {
    const lower = rawName.toLowerCase();

    // Clean up internal model keys into human readable names
    let displayName = rawName;
    if (lower === 'gemini-3.1-pro-preview' || lower.includes('3.1-pro')) {
      displayName = 'Gemini 3.1 Pro Preview';
    } else if (lower.includes('3.7-flash') || lower.includes('3.7 flash')) {
      displayName = 'Gemini 3.7 Flash';
    } else if (lower.includes('3.6-flash') || lower.includes('3.6 flash')) {
      displayName = 'Gemini 3.6 Flash';
    } else if (lower.includes('3.5-flash') || lower.includes('3.5 flash')) {
      displayName = 'Gemini 3.5 Flash';
    } else if (lower.includes('3.6-pro') || lower.includes('3.6 pro')) {
      displayName = 'Gemini 3.6 Pro';
    }

    // Gemini Pro (2M Tokens)
    if (lower.includes('pro')) {
      const limitTokens = 2097152; // 2M Tokens
      return {
        modelName: displayName,
        limitTokens,
        family: 'Gemini',
        thresholdTokens: Math.floor(limitTokens * 0.70)
      };
    }

    // Claude 3.5 Sonnet (200k Tokens)
    if (lower.includes('claude') || lower.includes('sonnet')) {
      const limitTokens = 200000;
      return {
        modelName: displayName.includes('Sonnet') ? displayName : 'Claude 3.5 Sonnet',
        limitTokens,
        family: 'Anthropic',
        thresholdTokens: Math.floor(limitTokens * 0.70)
      };
    }

    // GPT-4o (128k Tokens)
    if (lower.includes('gpt-4') || lower.includes('gpt4') || lower.includes('openai')) {
      const limitTokens = 128000;
      return {
        modelName: displayName.includes('GPT') ? displayName : 'GPT-4o',
        limitTokens,
        family: 'OpenAI',
        thresholdTokens: Math.floor(limitTokens * 0.70)
      };
    }

    // DeepSeek (128k Tokens)
    if (lower.includes('deepseek')) {
      const limitTokens = 128000;
      return {
        modelName: displayName,
        limitTokens,
        family: 'DeepSeek',
        thresholdTokens: Math.floor(limitTokens * 0.70)
      };
    }

    // Gemini Flash (Default 1M Tokens)
    const limitTokens = 1048576; // 1M Tokens
    return {
      modelName: displayName,
      limitTokens,
      family: 'Gemini',
      thresholdTokens: Math.floor(limitTokens * 0.70)
    };
  }
}
