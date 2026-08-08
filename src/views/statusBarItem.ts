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
    const limitM = (analysis.tokens.limitTokens / 1000000).toFixed(1);
    const pct = analysis.tokens.percentageUsed;

    // Risk indicator
    let icon = '$(pulse)';
    let color: string | undefined = undefined;

    if (analysis.riskLevel === 'HIGH') {
      icon = '$(error)';
      color = '#f87171'; // Red highlight
    } else if (analysis.riskLevel === 'MODERATE') {
      icon = '$(warning)';
      color = '#fbbf24'; // Amber warning
    }

    this.statusBarItem.text = `${icon} Context: ${totalK}k / ${limitM}M (${pct}%)`;
    this.statusBarItem.color = color;

    const tooltip = new vscode.MarkdownString();
    tooltip.isTrusted = true;
    tooltip.appendMarkdown(`**Antigravity Active Context Tracker**\n\n`);
    tooltip.appendMarkdown(`- **Model**: ${analysis.modelName}\n`);
    tooltip.appendMarkdown(`- **Session ID**: \`${analysis.sessionId}\`\n`);
    tooltip.appendMarkdown(`- **Context Capacity**: **${analysis.tokens.totalTokens.toLocaleString()}** / ${analysis.tokens.limitTokens.toLocaleString()} (${pct}%)\n\n`);
    tooltip.appendMarkdown(`**Hallucination Risk Status:**\n`);
    tooltip.appendMarkdown(`${analysis.riskMessage}\n\n`);
    tooltip.appendMarkdown(`**Context Breakdown:**\n`);
    tooltip.appendMarkdown(`- System Rules: \`${analysis.tokens.systemPromptTokens.toLocaleString()}\` tokens\n`);
    tooltip.appendMarkdown(`- User Prompts: \`${analysis.tokens.userPromptTokens.toLocaleString()}\` tokens\n`);
    tooltip.appendMarkdown(`- Model Output: \`${analysis.tokens.modelOutputTokens.toLocaleString()}\` tokens\n`);
    tooltip.appendMarkdown(`- Tool Results: \`${analysis.tokens.toolOutputTokens.toLocaleString()}\` tokens\n\n`);
    tooltip.appendMarkdown(`*Updates automatically in real time without refreshing.*`);

    this.statusBarItem.tooltip = tooltip;
  }

  public dispose() {
    this.statusBarItem.dispose();
  }
}
