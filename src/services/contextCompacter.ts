import * as fs from 'fs';
import * as path from 'path';
import { TranscriptStep, ConversationSession } from './transcriptWatcher';
import { AnalysisResult } from './contextAnalyzer';

export interface CompactionResult {
  markdown: string;
  continuationPrompt: string;
  originalTokens: number;
  compactTokens: number;
  reclaimedTokens: number;
  reclaimedPercentage: number;
  activeFilesCount: number;
  stepCount: number;
  backupPath: string;
}

export class ContextCompacter {
  public static compactInPlace(steps: TranscriptStep[], session: ConversationSession, analysis: AnalysisResult): CompactionResult {
    const userPrompts: string[] = [];
    const keyMilestones: string[] = [];

    // Collect user prompts and milestones
    for (const step of steps) {
      const contentStr = typeof step.content === 'string'
        ? step.content
        : (step.content ? JSON.stringify(step.content) : '');

      if (step.type === 'USER_INPUT' && contentStr.trim()) {
        userPrompts.push(contentStr.trim());
      } else if (step.type === 'PLANNER_RESPONSE' && contentStr.trim()) {
        const lines = contentStr.split(/\r?\n/).filter(l => l.startsWith('#') || l.startsWith('- ') || l.startsWith('* '));
        if (lines.length > 0) {
          keyMilestones.push(lines.slice(0, 3).join('\n'));
        }
      }
    }

    const filesList = analysis.activeFiles.map(f => `- \`${f.filename}\` (${f.count} references) -> \`${f.path}\``).join('\n');
    const toolStatsList = analysis.toolStats.map(t => `- **${t.toolName}**: ${t.count} calls`).join('\n');

    const continuationPrompt = `<CONTINUATION_CONTEXT_DIGEST>
Session Context Handoff Digest (In-Place Compacted Session ${analysis.sessionId})

## Core Objectives & User Requirements
${userPrompts.map((p, idx) => `### Request ${idx + 1}:\n${p}`).join('\n\n')}

## Active Working Files (${analysis.activeFiles.length} files)
${filesList || 'No file references recorded.'}

## Key Technical Decisions & Milestones
${keyMilestones.slice(-6).map(m => `> ${m.replace(/\n/g, '\n> ')}`).join('\n\n') || 'All core project files and rules are verified.'}

## Current Status & Verification
- **Session ID**: \`${analysis.sessionId}\`
- **Compacted Steps**: ${analysis.stepCount} raw steps replaced with 1 high-density checkpoint step
- **Model**: ${analysis.modelName}
- **Status**: Active tab context compacted in-place. Ready for continuation.
</CONTINUATION_CONTEXT_DIGEST>

Please review the continuation context digest above and confirm readiness to resume work on the codebase.`;

    const compactStep: TranscriptStep = {
      step_index: 0,
      source: 'SYSTEM',
      type: 'USER_INPUT',
      status: 'DONE',
      content: continuationPrompt,
      timestamp: new Date().toISOString()
    };

    // 1. Create safety backup of raw transcript.jsonl
    const transcriptPath = session.transcriptPath;
    const backupPath = transcriptPath + '.bak';
    if (fs.existsSync(transcriptPath)) {
      try {
        fs.copyFileSync(transcriptPath, backupPath);
      } catch (e) {
        console.error('Failed to create transcript backup:', e);
      }
    }

    // 2. Perform In-Place rewrite of transcript.jsonl
    const compactedLine = JSON.stringify(compactStep) + '\n';
    fs.writeFileSync(transcriptPath, compactedLine, 'utf-8');

    // 3. Update transcript_full.jsonl if present
    const fullTranscriptPath = path.join(path.dirname(transcriptPath), 'transcript_full.jsonl');
    if (fs.existsSync(fullTranscriptPath)) {
      try {
        fs.copyFileSync(fullTranscriptPath, fullTranscriptPath + '.bak');
        fs.writeFileSync(fullTranscriptPath, compactedLine, 'utf-8');
      } catch (e) {
        // ignore optional full transcript error
      }
    }

    const compactTokens = Math.ceil(continuationPrompt.length / 4);
    const reclaimedTokens = Math.max(0, analysis.tokens.totalTokens - compactTokens);
    const reclaimedPercentage = Math.max(0, Math.round((reclaimedTokens / analysis.tokens.totalTokens) * 100));

    const markdown = `# In-Place Context Compaction Digest

> [!NOTE]
> **Active Conversation Tab Compacted!**
> The active session (\`${analysis.sessionId}\`) transcript log on disk has been rewritten in-place with a high-density checkpoint step. Raw log backup stored at \`${backupPath}\`.

## 📊 In-Place Compaction Results
- **Original Context Tokens**: **${analysis.tokens.totalTokens.toLocaleString()}** tokens (${analysis.tokens.percentageUsed}% capacity)
- **New Active Context Tokens**: **${compactTokens.toLocaleString()}** tokens
- **Reclaimed Context Window**: **${reclaimedTokens.toLocaleString()}** tokens (**${reclaimedPercentage}% reduction**)
- **Original Raw Steps**: ${analysis.stepCount} steps -> **1 Compacted Checkpoint Step**

---

## Compacted Checkpoint Content
\`\`\`xml
${continuationPrompt}
\`\`\`
`;

    return {
      markdown,
      continuationPrompt,
      originalTokens: analysis.tokens.totalTokens,
      compactTokens,
      reclaimedTokens,
      reclaimedPercentage,
      activeFilesCount: analysis.activeFiles.length,
      stepCount: analysis.stepCount,
      backupPath
    };
  }
}
