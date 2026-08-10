import * as vscode from 'vscode';
import { AnalysisResult } from '../services/contextAnalyzer';

export class ContextStatusBarItem {
  private statusBarItem: vscode.StatusBarItem;

  constructor() {
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      100
    );
    this.statusBarItem.command = 'antigravity-context.refresh';
    this.statusBarItem.name = 'Antigravity Context Tracker';
    this.statusBarItem.text = '$(pulse) Context: Init...';
    this.statusBarItem.show();
  }

  public update(analysis: AnalysisResult | null) {
    if (!analysis) {
      this.statusBarItem.text = '$(pulse) Context: No Session';
      this.statusBarItem.tooltip = 'No active Antigravity conversation session detected.';
      return;
    }

    const totalK = (analysis.tokens.totalTokens / 1000).toFixed(1);
    const limitFormatted = analysis.tokens.limitTokens >= 1000000 
      ? (analysis.tokens.limitTokens / 1000000).toFixed(1) + 'M'
      : (analysis.tokens.limitTokens / 1000).toFixed(0) + 'k';

    const pct = analysis.tokens.percentageUsed;

    let icon = '$(pulse)';
    let color: string | undefined = undefined;

    if (analysis.riskLevel === 'HIGH') {
      icon = '$(error)';
      color = '#f87171';
    } else if (analysis.riskLevel === 'MODERATE') {
      icon = '$(warning)';
      color = '#fbbf24';
    }

    this.statusBarItem.text = `${icon} Context: ${totalK}k / ${limitFormatted} (${pct}%)`;
    this.statusBarItem.color = color;

    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;
    tooltip.appendMarkdown(`**Antigravity Active Context Tracker**\n\n`);
    tooltip.appendMarkdown(`- **Detected Active Model**: **${analysis.modelName}** (${analysis.modelCapability.family})\n`);
    tooltip.appendMarkdown(`- **Model Context Capacity**: **${limitFormatted}** tokens max limit\n`);
    tooltip.appendMarkdown(`- **Session ID**: \`${analysis.sessionId}\`\n`);
    tooltip.appendMarkdown(`- **Used Context**: **${analysis.tokens.totalTokens.toLocaleString()}** / ${analysis.tokens.limitTokens.toLocaleString()} (${pct}%)\n\n`);
    tooltip.appendMarkdown(`**Hallucination Risk Status:**\n`);
    tooltip.appendMarkdown(`${analysis.riskMessage}\n\n`);
    tooltip.appendMarkdown(`**Context Memory Breakdown:**\n`);
    tooltip.appendMarkdown(`- System Rules & Skills: \`${analysis.tokens.systemPromptTokens.toLocaleString()}\` tokens\n`);
    tooltip.appendMarkdown(`- User Prompts: \`${analysis.tokens.userPromptTokens.toLocaleString()}\` tokens\n`);
    tooltip.appendMarkdown(`- Assistant Responses: \`${analysis.tokens.modelOutputTokens.toLocaleString()}\` tokens\n`);
    tooltip.appendMarkdown(`- Tool Output Buffers: \`${analysis.tokens.toolOutputTokens.toLocaleString()}\` tokens\n\n`);
    tooltip.appendMarkdown(`*Auto-detects model & updates context in real time without refreshing.*`);

    this.statusBarItem.tooltip = tooltip;
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}
