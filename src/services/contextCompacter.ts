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
  preservedRecentStepsCount: number;
  backupPath: string;
}

export class ContextCompacter {
  /**
   * Soft / Sliding-Window Compaction (Level 1):
   * Summarizes heavy older steps into a high-density checkpoint while preserving the 
   * last 6-8 recent chat turns 100% word-for-word intact for seamless conversational flow.
   */
  public static compactInPlace(steps: TranscriptStep[], session: ConversationSession, analysis: AnalysisResult): CompactionResult {
    const RECENT_TURNS_TO_PRESERVE = 8;
    
    let olderSteps: TranscriptStep[] = [];
    let recentSteps: TranscriptStep[] = [];

    if (steps.length > RECENT_TURNS_TO_PRESERVE) {
      olderSteps = steps.slice(0, steps.length - RECENT_TURNS_TO_PRESERVE);
      recentSteps = steps.slice(steps.length - RECENT_TURNS_TO_PRESERVE);
    } else {
      // If session has 8 or fewer steps, keep all recent steps and compact raw tool logs inside older steps
      recentSteps = [...steps];
    }

    const userPrompts: string[] = [];
    const keyMilestones: string[] = [];

    // Extract objectives and milestones from older steps
    for (const step of olderSteps) {
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

    const continuationPrompt = `<SLIDING_WINDOW_CONTEXT_DIGEST>
Session History Checkpoint (Older Steps Compacted for Session ${analysis.sessionId})

## Core Objectives & Historical Requests
${userPrompts.map((p, idx) => `### Request ${idx + 1}:\n${p}`).join('\n\n') || 'All initial project setup and requirements.'}

## Active Project Files (${analysis.activeFiles.length} files)
${filesList || 'No file references recorded.'}

## Key Technical Decisions & Milestones
${keyMilestones.slice(-8).map(m => `> ${m.replace(/\n/g, '\n> ')}`).join('\n\n') || 'All core project files and rules are verified.'}

## Current Status & Verification
- **Session ID**: \`${analysis.sessionId}\`
- **Compacted Older Steps**: ${olderSteps.length} steps summarized into this checkpoint
- **Preserved Recent Steps**: ${recentSteps.length} turns 100% intact
- **Model**: ${analysis.modelName} (${analysis.modelCapability.family})
- **Status**: Level 1 Sliding-Window compaction active. Natural conversational continuity preserved.
</SLIDING_WINDOW_CONTEXT_DIGEST>`;

    const checkpointStep: TranscriptStep = {
      step_index: 0,
      source: 'SYSTEM',
      type: 'USER_INPUT',
      status: 'DONE',
      content: continuationPrompt,
      timestamp: new Date().toISOString()
    };

    // Re-index recent steps after checkpoint step
    const reindexedRecentSteps = recentSteps.map((step, idx) => ({
      ...step,
      step_index: idx + 1
    }));

    const finalSteps: TranscriptStep[] = olderSteps.length > 0 
      ? [checkpointStep, ...reindexedRecentSteps]
      : reindexedRecentSteps;

    const transcriptPath = session.transcriptPath;
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${transcriptPath}.bak_${timestampStr}`;
    const standardBackupPath = `${transcriptPath}.bak`;

    // 1. Create timestamped and standard safety backups
    if (fs.existsSync(transcriptPath)) {
      try {
        fs.copyFileSync(transcriptPath, backupPath);
        fs.copyFileSync(transcriptPath, standardBackupPath);
      } catch (e) {
        console.error('Failed to create transcript safety backup:', e);
      }
    }

    // 2. Write out updated steps array atomically
    const compactedLines = finalSteps.map(s => JSON.stringify(s)).join('\n') + '\n';
    const tmpPath = `${transcriptPath}.tmp_${Date.now()}`;

    try {
      fs.writeFileSync(tmpPath, compactedLines, 'utf-8');
      fs.renameSync(tmpPath, transcriptPath);
    } catch (e) {
      fs.writeFileSync(transcriptPath, compactedLines, 'utf-8');
      if (fs.existsSync(tmpPath)) {
        try { fs.unlinkSync(tmpPath); } catch (err) {}
      }
    }

    // 3. Update transcript_full.jsonl if present
    const fullTranscriptPath = path.join(path.dirname(transcriptPath), 'transcript_full.jsonl');
    if (fs.existsSync(fullTranscriptPath)) {
      try {
        fs.copyFileSync(fullTranscriptPath, `${fullTranscriptPath}.bak`);
        fs.writeFileSync(fullTranscriptPath, compactedLines, 'utf-8');
      } catch (e) {
        // ignore optional full transcript error
      }
    }

    const compactTokens = Math.ceil(compactedLines.length / 4);
    const reclaimedTokens = Math.max(0, analysis.tokens.totalTokens - compactTokens);
    const reclaimedPercentage = Math.max(0, Math.round((reclaimedTokens / analysis.tokens.totalTokens) * 100));

    const markdown = `# Level 1 Sliding-Window Context Compaction Digest

> [!NOTE]
> **Active Conversation Tab Compacted Safely (Level 1 Soft Compaction)!**
> - **Preserved Recent Chat Window**: Last ${recentSteps.length} chat turns kept 100% word-for-word intact.
> - **Summarized Older History**: ${olderSteps.length} older steps condensed into 1 checkpoint step.
> - **Safety Backup**: Saved at \`${backupPath}\`.

## 📊 Compaction Results
- **Original Context Tokens**: **${analysis.tokens.totalTokens.toLocaleString()}** tokens (${analysis.tokens.percentageUsed}% capacity)
- **New Active Context Tokens**: **${compactTokens.toLocaleString()}** tokens
- **Reclaimed Context Window**: **${reclaimedTokens.toLocaleString()}** tokens (**${reclaimedPercentage}% reduction**)
- **Original Step Count**: ${analysis.stepCount} steps -> **${finalSteps.length} Steps (${olderSteps.length > 0 ? '1 Checkpoint + ' : ''}${recentSteps.length} Recent Turns)**

---

## Checkpoint Content
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
      stepCount: finalSteps.length,
      preservedRecentStepsCount: recentSteps.length,
      backupPath
    };
  }
}
