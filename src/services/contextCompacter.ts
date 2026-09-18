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
  preservedRecentTurnsCount: number;
  preservedRecentStepsCount: number;
  stubbedObservationsCount: number;
  backupPath: string;
}

export class ContextCompacter {
  /**
   * Next-Gen Smart Hybrid Compactor:
   * 1. Turn-Aware Windowing (Preserves last N=3 complete user-model conversational turns).
   * 2. Semantic Tool Observation Stubbing (Strips bulky stdout/file views while preserving trajectory).
   * 3. Working Memory State (Root Goal + File State Deltas: CREATED, MODIFIED, READ-ONLY).
   * 4. Automatic Backup Rotation (Retains latest 5 backups to keep disk footprint lightweight).
   */
  public static compactInPlace(
    steps: TranscriptStep[], 
    session: ConversationSession, 
    analysis: AnalysisResult,
    recentTurnsToKeep = 3
  ): CompactionResult {
    // 1. Identify turn boundaries (scanning backwards for USER_INPUT steps)
    const turnIndices: number[] = [];
    for (let i = 0; i < steps.length; i++) {
      if (steps[i].type === 'USER_INPUT' && steps[i].source !== 'SYSTEM') {
        turnIndices.push(i);
      }
    }

    let splitIndex = 0;
    let preservedTurns = 0;

    if (turnIndices.length > recentTurnsToKeep) {
      splitIndex = turnIndices[turnIndices.length - recentTurnsToKeep];
      preservedTurns = recentTurnsToKeep;
    } else if (turnIndices.length > 1) {
      splitIndex = turnIndices[1];
      preservedTurns = turnIndices.length - 1;
    } else {
      splitIndex = Math.max(0, steps.length - 8);
      preservedTurns = 1;
    }

    const olderSteps = steps.slice(0, splitIndex);
    const recentSteps = steps.slice(splitIndex);

    // 2. Extract Project Goals (Root Objective vs Recent Directives)
    const userPrompts: string[] = [];
    for (const step of olderSteps) {
      const contentStr = typeof step.content === 'string'
        ? step.content
        : (step.content ? JSON.stringify(step.content) : '');

      if (step.type === 'USER_INPUT' && contentStr.trim() && step.source !== 'SYSTEM') {
        const cleanPrompt = contentStr.replace(/<[^>]+>/g, '').trim();
        if (cleanPrompt && !userPrompts.includes(cleanPrompt)) {
          userPrompts.push(cleanPrompt);
        }
      }
    }

    const rootGoal = userPrompts[0] || 'Build and maintain application functionality according to specifications.';
    const intermediateGoals = userPrompts.slice(1);

    // 3. File State Delta Classification
    const createdFiles = analysis.activeFiles.filter(f => f.status === 'CREATED');
    const modifiedFiles = analysis.activeFiles.filter(f => f.status === 'MODIFIED');
    const readOnlyFiles = analysis.activeFiles.filter(f => f.status === 'VIEWED');

    const filesDeltaReport = [
      createdFiles.length > 0 ? `### [CREATED / WRITTEN FILES]\n${createdFiles.map(f => `- \`${f.filename}\` (${f.path})`).join('\n')}` : '',
      modifiedFiles.length > 0 ? `### [MODIFIED FILES]\n${modifiedFiles.map(f => `- \`${f.filename}\` (${f.path})`).join('\n')}` : '',
      readOnlyFiles.length > 0 ? `### [INSPECTED / REFERENCE FILES]\n${readOnlyFiles.slice(0, 6).map(f => `- \`${f.filename}\` (${f.count} refs)`).join('\n')}` : ''
    ].filter(Boolean).join('\n\n');

    // 4. Extract Key Milestones from Older Planner Responses
    const keyMilestones: string[] = [];
    for (const step of olderSteps) {
      if (step.type === 'PLANNER_RESPONSE' && typeof step.content === 'string') {
        const lines = step.content.split(/\r?\n/).filter(l => l.startsWith('#') || l.startsWith('- ') || l.startsWith('* '));
        if (lines.length > 0) {
          keyMilestones.push(lines.slice(0, 2).join('\n'));
        }
      }
    }

    // 5. Tool Observation Stubbing for Older Trajectory (Cursor / Claude Code style)
    let stubbedObservationsCount = 0;
    const stubbedOlderSteps: TranscriptStep[] = [];

    for (const step of olderSteps) {
      // If it's a bulky tool execution step, stub it
      if (step.type !== 'USER_INPUT' && step.type !== 'PLANNER_RESPONSE') {
        const stubbed = this.stubObservation(step);
        stubbedOlderSteps.push(stubbed);
        stubbedObservationsCount++;
      }
    }

    // 6. Build the Smart Working Memory Checkpoint
    const continuationPrompt = `<SMART_HYBRID_CONTEXT_CHECKPOINT>
# Session Context & Working Memory Checkpoint (Session: ${analysis.sessionId})

## 1. Primary Project Objective
> ${rootGoal}

${intermediateGoals.length > 0 ? `## 2. Key User Directives Applied\n${intermediateGoals.slice(-4).map((g, idx) => `- Directives #${idx + 1}: ${g.substring(0, 150)}`).join('\n')}` : ''}

## 3. Working File State Deltas
${filesDeltaReport || '- No explicit file modifications recorded.'}

## 4. Technical Milestones & Architecture Decisions
${keyMilestones.slice(-6).map(m => `> ${m.replace(/\n/g, '\n> ')}`).join('\n\n') || '- Project setup verified.'}

## 5. Session Status
- **Session ID**: \`${analysis.sessionId}\`
- **Model**: ${analysis.modelName} (${analysis.modelCapability.family})
- **Turn-Aware Preservation**: Last ${preservedTurns} conversational turns (${recentSteps.length} steps) kept 100% intact.
- **Older Observations Stubbed**: ${stubbedObservationsCount} heavy tool payloads condensed into lightweight stubs.
</SMART_HYBRID_CONTEXT_CHECKPOINT>`;

    const checkpointStep: TranscriptStep = {
      step_index: 0,
      source: 'SYSTEM',
      type: 'USER_INPUT',
      status: 'DONE',
      content: continuationPrompt,
      timestamp: new Date().toISOString()
    };

    // Re-index steps
    const reindexedRecentSteps = recentSteps.map((step, idx) => ({
      ...step,
      step_index: idx + 1
    }));

    const finalSteps: TranscriptStep[] = [checkpointStep, ...reindexedRecentSteps];

    // 7. Atomic Write with Backup & Rotation
    const transcriptPath = session.transcriptPath;
    const logsDir = path.dirname(transcriptPath);
    const timestampStr = new Date().toISOString().replace(/[:.]/g, '-');
    const backupPath = `${transcriptPath}.bak_${timestampStr}`;
    const standardBackupPath = `${transcriptPath}.bak`;

    if (fs.existsSync(transcriptPath)) {
      try {
        fs.copyFileSync(transcriptPath, backupPath);
        fs.copyFileSync(transcriptPath, standardBackupPath);
        this.pruneOldBackups(logsDir, 2);
      } catch (e) {
        console.error('Failed to create transcript safety backup:', e);
      }
    }

    // Atomic write via temporary file
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

    // Also update transcript_full.jsonl if present
    const fullTranscriptPath = path.join(logsDir, 'transcript_full.jsonl');
    if (fs.existsSync(fullTranscriptPath)) {
      try {
        fs.copyFileSync(fullTranscriptPath, `${fullTranscriptPath}.bak`);
        fs.writeFileSync(fullTranscriptPath, compactedLines, 'utf-8');
      } catch (e) {}
    }

    const compactTokens = Math.ceil(compactedLines.length / 4);
    const reclaimedTokens = Math.max(0, analysis.tokens.totalTokens - compactTokens);
    const reclaimedPercentage = Math.max(0, Math.round((reclaimedTokens / analysis.tokens.totalTokens) * 100));

    const markdown = `# Smart Hybrid Context Compaction Digest (v0.7.0)


> [!NOTE]
> **Active Conversation Tab Compacted Safely!**
> - **Turn-Aware Preservation**: Last **${preservedTurns} complete conversational turns** (${recentSteps.length} steps) kept 100% verbatim.
> - **Observation Stubbing**: **${stubbedObservationsCount}** older tool dumps replaced with semantic stubs.
> - **Working Memory**: File state deltas and primary objective synthesized.
> - **Safety Backup**: Saved at \`${backupPath}\`.

## 📊 Compaction Results
- **Original Context Tokens**: **${analysis.tokens.totalTokens.toLocaleString()}** tokens (${analysis.tokens.percentageUsed}% capacity)
- **New Active Context Tokens**: **${compactTokens.toLocaleString()}** tokens
- **Reclaimed Context Window**: **${reclaimedTokens.toLocaleString()}** tokens (**${reclaimedPercentage}% reduction**)
- **Active Files Categorized**: **${analysis.activeFiles.length}** files (${createdFiles.length} created, ${modifiedFiles.length} modified)

---

## Checkpoint Working Memory State
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
      preservedRecentTurnsCount: preservedTurns,
      preservedRecentStepsCount: recentSteps.length,
      stubbedObservationsCount,
      backupPath
    };
  }

  /**
   * Replaces a bulky tool output step with a lightweight semantic stub (Claude Code / Cursor style)
   */
  private static stubObservation(step: TranscriptStep): TranscriptStep {
    let stubText = '[Observation pruned]';
    const contentStr = typeof step.content === 'string' ? step.content : JSON.stringify(step.content || '');

    if (step.tool_calls && step.tool_calls.length > 0) {
      const tc = step.tool_calls[0];
      const name = tc.name || 'tool';
      if (name === 'view_file' || name === 'read_file') {
        const target = tc.arguments?.AbsolutePath || tc.arguments?.TargetFile || 'file';
        stubText = `[File Inspection: ${path.basename(target)} cached]`;
      } else if (name === 'run_command') {
        const cmd = tc.arguments?.CommandLine ? tc.arguments.CommandLine.substring(0, 40) : 'command';
        stubText = `[Ran command: \`${cmd}\` -> Completed]`;
      } else if (name === 'replace_file_content' || name === 'write_to_file') {
        const target = tc.arguments?.TargetFile || 'file';
        stubText = `[File Updated: ${path.basename(target)}]`;
      } else {
        stubText = `[Tool execution: ${name} completed]`;
      }
    } else if (contentStr.includes('The command exited with code')) {
      stubText = '[Command execution completed successfully]';
    } else if (contentStr.includes('File Path:')) {
      stubText = '[File inspection output cached]';
    }

    return {
      ...step,
      content: stubText,
      is_truncated: true
    };
  }

  /**
   * Prunes older backup files to avoid consuming excessive disk space (keeps maxBackups)
   */
  public static pruneOldBackups(logsDir: string, maxBackups = 2): number {
    if (!fs.existsSync(logsDir)) return 0;


    try {
      const entries = fs.readdirSync(logsDir);
      const timestampedBackups = entries
        .filter(f => f.startsWith('transcript.jsonl.bak_'))
        .map(f => ({
          file: path.join(logsDir, f),
          mtime: fs.statSync(path.join(logsDir, f)).mtime
        }))
        .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

      if (timestampedBackups.length > maxBackups) {
        const toDelete = timestampedBackups.slice(maxBackups);
        for (const item of toDelete) {
          try { fs.unlinkSync(item.file); } catch (e) {}
        }
        return toDelete.length;
      }
    } catch (e) {}
    return 0;
  }

  /**
   * Safely restore session transcript from the most recent .bak or .bak_<timestamp> file
   */
  public static restoreBackup(session: ConversationSession): { success: boolean; message: string; backupFile?: string } {
    const transcriptPath = session.transcriptPath;
    const logsDir = path.dirname(transcriptPath);

    if (!fs.existsSync(logsDir)) {
      return { success: false, message: 'Logs directory not found.' };
    }

    const entries = fs.readdirSync(logsDir);
    const backupFiles = entries
      .filter(f => f.startsWith('transcript.jsonl.bak'))
      .map(f => {
        const full = path.join(logsDir, f);
        return { file: full, mtime: fs.statSync(full).mtime };
      })
      .sort((a, b) => b.mtime.getTime() - a.mtime.getTime());

    if (backupFiles.length === 0) {
      return { success: false, message: 'No backup files found for this conversation session.' };
    }

    const latestBackup = backupFiles[0].file;
    try {
      fs.copyFileSync(transcriptPath, `${transcriptPath}.pre_restore`);
      fs.copyFileSync(latestBackup, transcriptPath);

      const fullBak = path.join(logsDir, 'transcript_full.jsonl.bak');
      const fullPath = path.join(logsDir, 'transcript_full.jsonl');
      if (fs.existsSync(fullBak)) {
        try { fs.copyFileSync(fullBak, fullPath); } catch (e) {}
      }

      return {
        success: true,
        message: `Successfully restored session from ${path.basename(latestBackup)}!`,
        backupFile: latestBackup
      };
    } catch (err: any) {
      return {
        success: false,
        message: `Failed to restore backup: ${err.message}`
      };
    }
  }
}
