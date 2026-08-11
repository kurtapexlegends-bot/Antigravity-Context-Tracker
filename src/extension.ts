import * as vscode from 'vscode';
import { TranscriptWatcher } from './services/transcriptWatcher';
import { ContextAnalyzer, AnalysisResult } from './services/contextAnalyzer';
import { ContextCompacter } from './services/contextCompacter';
import { ContextStatusBarItem } from './views/statusBarItem';
import { ContextSidebarProvider } from './views/sidebarProvider';

let watcher: TranscriptWatcher;
let statusBar: ContextStatusBarItem;
let sidebarProvider: ContextSidebarProvider;
let latestAnalysis: AnalysisResult | null = null;

export function activate(context: vscode.ExtensionContext) {
  console.log('Antigravity Context Tracker Extension v0.3.2 active!');

  watcher = new TranscriptWatcher();
  statusBar = new ContextStatusBarItem();

  const handleRefresh = () => {
    watcher.checkForActiveSessionSwitch();
    const { steps, session } = watcher.readActiveSteps();
    if (session) {
      latestAnalysis = ContextAnalyzer.analyze(steps, session);
    } else {
      latestAnalysis = null;
    }
    statusBar.update(latestAnalysis);
    sidebarProvider.update(latestAnalysis);
  };

  sidebarProvider = new ContextSidebarProvider(context.extensionUri, handleRefresh);

  context.subscriptions.push(
    vscode.window.registerWebviewViewProvider(
      ContextSidebarProvider.viewType,
      sidebarProvider
    )
  );

  watcher.onUpdate((steps, session) => {
    latestAnalysis = ContextAnalyzer.analyze(steps, session);
    statusBar.update(latestAnalysis);
    sidebarProvider.update(latestAnalysis);
  });

  watcher.startWatching();

  // Listen to active tab changes in editor to auto-detect active opened conversation tab
  context.subscriptions.push(
    vscode.window.onDidChangeActiveTextEditor(editor => {
      if (editor && editor.document) {
        const filePath = editor.document.uri.fsPath;
        const brainDir = watcher.getAntigravityBrainDir();
        if (filePath.startsWith(brainDir)) {
          const relative = filePath.substring(brainDir.length).replace(/^[/\\]/, '');
          const sessionId = relative.split(/[/\\]/)[0];
          if (sessionId && sessionId.length > 10) {
            watcher.setActiveSessionId(sessionId, true);
            return;
          }
        }
      }
      watcher.checkForActiveSessionSwitch();
    }),

    vscode.window.onDidChangeWindowState(state => {
      if (state.focused) {
        watcher.checkForActiveSessionSwitch();
      }
    })
  );

  // Initial load trigger
  handleRefresh();

  // Command: Refresh
  const refreshCmd = vscode.commands.registerCommand('antigravity-context.refresh', () => {
    handleRefresh();
    vscode.window.showInformationMessage('Antigravity Context Tracker refreshed!');
  });

  // Command: Compact Session In-Place (Atomic & Safe)
  const compactCmd = vscode.commands.registerCommand('antigravity-context.compactSession', async () => {
    const { steps, session } = watcher.readActiveSteps();
    if (!session || !latestAnalysis) {
      vscode.window.showWarningMessage('No active Antigravity session to compact.');
      return;
    }

    // Perform atomic in-place transcript log compaction on disk
    const compaction = ContextCompacter.compactInPlace(steps, session, latestAnalysis);

    // Instantly refresh watcher state
    handleRefresh();

    // Show confirmation document and notification
    const doc = await vscode.workspace.openTextDocument({
      content: compaction.markdown,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);

    vscode.window.showInformationMessage(
      `⚡ Current tab compacted safely! Reclaimed ${compaction.reclaimedTokens.toLocaleString()} tokens (${compaction.reclaimedPercentage}% reduction). Backup saved at ${compaction.backupPath}`
    );
  });

  // Command: Export Summary
  const exportCmd = vscode.commands.registerCommand('antigravity-context.exportSummary', async () => {
    if (!latestAnalysis) {
      vscode.window.showWarningMessage('No active conversation context to export.');
      return;
    }

    const markdown = generateMarkdownReport(latestAnalysis);
    const doc = await vscode.workspace.openTextDocument({
      content: markdown,
      language: 'markdown'
    });
    await vscode.window.showTextDocument(doc);
  });

  // Command: Select Session (User Pinned)
  const selectSessionCmd = vscode.commands.registerCommand('antigravity-context.selectSession', async () => {
    const sessions = watcher.listSessions();
    if (sessions.length === 0) {
      vscode.window.showInformationMessage('No Antigravity conversation sessions found in brain store.');
      return;
    }

    const items = sessions.map(s => ({
      label: `Session ${s.id.substring(0, 8)}...`,
      description: `Last active: ${s.lastActivity.toLocaleString()}`,
      detail: s.id,
      session: s
    }));

    const selected = await vscode.window.showQuickPick(items, {
      placeHolder: 'Select an Antigravity Conversation Session to track'
    });

    if (selected) {
      watcher.setActiveSessionId(selected.session.id, true);
      vscode.window.showInformationMessage(`Tracking context for session: ${selected.session.id}`);
    }
  });

  context.subscriptions.push(statusBar, refreshCmd, compactCmd, exportCmd, selectSessionCmd);
}

export function deactivate() {
  if (watcher) {
    watcher.stopWatching();
  }
}

function generateMarkdownReport(analysis: AnalysisResult): string {
  const t = analysis.tokens;
  return `# Antigravity Conversation Context Summary Digest

**Session ID**: \`${analysis.sessionId}\`  
**Model**: ${analysis.modelName}  
**Last Updated**: ${analysis.lastUpdated}  
**Total Steps**: ${analysis.stepCount}  
**Hallucination Risk Level**: ${analysis.riskLevel} (${analysis.riskMessage})  

## 1. Token & Context Capacity
- **Total Context Tokens**: **${t.totalTokens.toLocaleString()}** / ${t.limitTokens.toLocaleString()} (${t.percentageUsed}%)
- **System Rules & Context**: ${t.systemPromptTokens.toLocaleString()} tokens
- **User Prompts**: ${t.userPromptTokens.toLocaleString()} tokens
- **Model Responses**: ${t.modelOutputTokens.toLocaleString()} tokens
- **Tool Outputs**: ${t.toolOutputTokens.toLocaleString()} tokens

## 2. Active Referenced Files (${analysis.activeFiles.length})
${analysis.activeFiles.map(f => `- \`${f.filename}\` (${f.count} references) — \`${f.path}\``).join('\n')}

## 3. Tool Usage Statistics (${analysis.toolStats.length} tools)
${analysis.toolStats.map(ts => `- **${ts.toolName}**: ${ts.count} executions`).join('\n')}

## 4. Activity Step Feed (Latest 15)
${analysis.stepsSummary.slice(0, 15).map(s => `- **Step #${s.index}** [${s.type} | ${s.source}]: ${s.snippet}`).join('\n')}
`;
}
