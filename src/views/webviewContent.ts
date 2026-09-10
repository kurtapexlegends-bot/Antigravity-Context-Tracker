import { AnalysisResult } from '../services/contextAnalyzer';

export function getWebviewContent(analysis: AnalysisResult | null): string {
  const analysisDataJson = JSON.stringify(analysis || {});

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Antigravity Context Tracker</title>
  <style>
    :root {
      --bg-primary: var(--vscode-sideBar-background, #18181b);
      --card-bg: var(--vscode-editor-background, #1f1f23);
      --card-border: var(--vscode-widget-border, rgba(255, 255, 255, 0.08));
      --text-primary: var(--vscode-sideBarTitle-foreground, #f4f4f5);
      --text-secondary: var(--vscode-descriptionForeground, #a1a1aa);
      --accent-blue: #3b82f6;
      --accent-indigo: #6366f1;
      --accent-purple: #a855f7;
      --accent-cyan: #06b6d4;
      --accent-emerald: #10b981;
      --accent-amber: #f59e0b;
      --accent-rose: #f43f5e;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    body {
      font-family: var(--vscode-font-family, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif);
      font-size: var(--vscode-font-size, 12px);
      color: var(--text-primary);
      background-color: var(--bg-primary);
      padding: 12px;
      line-height: 1.4;
    }

    /* Scrollbar Styling */
    ::-webkit-scrollbar {
      width: 4px;
      height: 4px;
    }
    ::-webkit-scrollbar-track {
      background: transparent;
    }
    ::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.15);
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: rgba(255, 255, 255, 0.3);
    }

    /* App Header */
    .app-header {
      display: flex;
      flex-direction: column;
      gap: 8px;
      margin-bottom: 12px;
      padding-bottom: 10px;
      border-bottom: 1px solid var(--card-border);
    }

    .brand-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .brand-title {
      display: flex;
      align-items: center;
      gap: 6px;
      font-weight: 700;
      font-size: 13px;
      letter-spacing: -0.2px;
      color: #ffffff;
    }

    .live-badge {
      display: flex;
      align-items: center;
      gap: 4px;
      background: rgba(16, 185, 129, 0.12);
      color: var(--accent-emerald);
      padding: 2px 6px;
      border-radius: 10px;
      font-size: 9px;
      font-weight: 600;
      border: 1px solid rgba(16, 185, 129, 0.25);
    }

    .live-dot {
      width: 5px;
      height: 5px;
      background-color: var(--accent-emerald);
      border-radius: 50%;
      box-shadow: 0 0 6px var(--accent-emerald);
      animation: pulse 1.8s infinite;
    }

    @keyframes pulse {
      0% { opacity: 1; transform: scale(1); }
      50% { opacity: 0.3; transform: scale(0.8); }
      100% { opacity: 1; transform: scale(1); }
    }

    .version-tag {
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-secondary);
      font-size: 9px;
      padding: 1px 5px;
      border-radius: 4px;
    }

    .action-row {
      display: flex;
      gap: 6px;
    }

    .btn-compact {
      flex: 1;
      background: linear-gradient(135deg, #3b82f6, #8b5cf6);
      color: #ffffff;
      border: none;
      padding: 6px 10px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 11px;
      font-weight: 600;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 6px;
      box-shadow: 0 2px 8px rgba(99, 102, 241, 0.25);
      transition: all 0.2s ease;
    }

    .btn-compact:hover {
      transform: translateY(-1px);
      box-shadow: 0 4px 12px rgba(99, 102, 241, 0.4);
    }

    .btn-icon {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--card-border);
      color: var(--text-primary);
      width: 28px;
      height: 28px;
      border-radius: 6px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      font-size: 12px;
      transition: background 0.2s ease;
    }

    .btn-icon:hover {
      background: rgba(255, 255, 255, 0.12);
    }

    /* Cards */
    .card {
      background: var(--card-bg);
      border: 1px solid var(--card-border);
      border-radius: 8px;
      padding: 10px 12px;
      margin-bottom: 10px;
      box-shadow: 0 2px 6px rgba(0, 0, 0, 0.15);
    }

    .card-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.6px;
      color: var(--text-secondary);
      margin-bottom: 8px;
    }

    /* Risk Banner */
    .risk-banner {
      padding: 8px 10px;
      border-radius: 6px;
      font-size: 11px;
      line-height: 1.35;
      margin-bottom: 10px;
      display: flex;
      align-items: center;
      gap: 8px;
      font-weight: 500;
    }

    .risk-LOW {
      background: rgba(16, 185, 129, 0.1);
      border: 1px solid rgba(16, 185, 129, 0.25);
      color: #34d399;
    }

    .risk-MODERATE {
      background: rgba(245, 158, 11, 0.1);
      border: 1px solid rgba(245, 158, 11, 0.25);
      color: #fbbf24;
    }

    .risk-HIGH {
      background: rgba(244, 63, 94, 0.15);
      border: 1px solid rgba(244, 63, 94, 0.35);
      color: #fda4af;
      animation: alertGlow 2s infinite;
    }

    @keyframes alertGlow {
      0% { border-color: rgba(244, 63, 94, 0.35); }
      50% { border-color: rgba(244, 63, 94, 0.7); }
      100% { border-color: rgba(244, 63, 94, 0.35); }
    }

    /* Gauge Bar */
    .gauge-metrics {
      display: flex;
      justify-content: space-between;
      align-items: baseline;
      margin-bottom: 6px;
    }

    .tokens-value {
      font-size: 20px;
      font-weight: 800;
      color: #ffffff;
      letter-spacing: -0.3px;
    }

    .tokens-max {
      font-size: 11px;
      color: var(--text-secondary);
    }

    .progress-bar-container {
      position: relative;
      height: 9px;
      width: 100%;
      background: rgba(255, 255, 255, 0.06);
      border-radius: 5px;
      overflow: hidden;
      display: flex;
    }

    .progress-seg {
      height: 100%;
      transition: width 0.3s cubic-bezier(0.4, 0, 0.2, 1);
    }

    .threshold-indicator {
      position: absolute;
      left: 70%;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--accent-rose);
      box-shadow: 0 0 5px var(--accent-rose);
      z-index: 3;
    }

    .seg-system { background-color: var(--accent-purple); }
    .seg-user { background-color: var(--accent-blue); }
    .seg-model { background-color: var(--accent-emerald); }
    .seg-tool { background-color: var(--accent-amber); }

    .legend-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 6px;
      margin-top: 10px;
      padding-top: 8px;
      border-top: 1px dashed rgba(255, 255, 255, 0.06);
    }

    .legend-chip {
      display: flex;
      align-items: center;
      gap: 6px;
      font-size: 10px;
      color: var(--text-secondary);
    }

    .dot-chip {
      width: 6px;
      height: 6px;
      border-radius: 50%;
    }

    /* Active Files List */
    .file-grid {
      display: flex;
      flex-direction: column;
      gap: 4px;
      max-height: 140px;
      overflow-y: auto;
    }

    .file-card {
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.04);
      padding: 4px 8px;
      border-radius: 5px;
      font-family: var(--vscode-editor-font-family, monospace);
      font-size: 10px;
      transition: background 0.15s ease;
    }

    .file-card:hover {
      background: rgba(255, 255, 255, 0.07);
    }

    .file-path {
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      max-width: 78%;
      color: var(--vscode-gitDecoration-modifiedResourceForeground, #38bdf8);
    }

    .ref-badge {
      background: rgba(255, 255, 255, 0.08);
      color: var(--text-secondary);
      padding: 1px 5px;
      border-radius: 8px;
      font-size: 9px;
    }

    /* Tools Summary */
    .tool-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }

    .tool-pill {
      background: rgba(99, 102, 241, 0.12);
      border: 1px solid rgba(99, 102, 241, 0.25);
      color: #a5b4fc;
      padding: 2px 6px;
      border-radius: 4px;
      font-size: 10px;
      font-family: monospace;
    }

    /* Timeline Stream */
    .timeline-feed {
      display: flex;
      flex-direction: column;
      gap: 6px;
      max-height: 220px;
      overflow-y: auto;
    }

    .timeline-node {
      border-left: 2px solid var(--accent-indigo);
      padding-left: 8px;
      display: flex;
      flex-direction: column;
      gap: 2px;
    }

    .node-meta {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 10px;
    }

    .node-type {
      font-weight: 700;
      color: var(--accent-cyan);
    }

    .node-source {
      font-size: 9px;
      color: var(--text-secondary);
      background: rgba(255, 255, 255, 0.05);
      padding: 1px 4px;
      border-radius: 3px;
    }

    .node-text {
      font-size: 10px;
      color: var(--text-secondary);
      line-height: 1.3;
      word-break: break-word;
    }

    .empty-prompt {
      text-align: center;
      padding: 24px 12px;
      color: var(--text-secondary);
      font-size: 11px;
    }
  </style>
</head>
<body>

  <div id="app"></div>

  <script>
    const vscode = acquireVsCodeApi();
    let initialData = ${analysisDataJson};

    function render(data) {
      const container = document.getElementById('app');
      if (!data || !data.sessionId) {
        container.innerHTML = \`
          <div class="empty-prompt">
            <p>⚡ Waiting for active Antigravity session log...</p>
          </div>
        \`;
        return;
      }

      const t = data.tokens || {};
      const total = t.totalTokens || 0;
      const limit = t.limitTokens || 1000000;
      const limitFormatted = limit >= 1000000 
        ? (limit / 1000000).toFixed(1) + 'M'
        : (limit / 1000).toFixed(0) + 'k';
      
      const sysPct = ((t.systemPromptTokens || 0) / limit) * 100;
      const userPct = ((t.userPromptTokens || 0) / limit) * 100;
      const modelPct = ((t.modelOutputTokens || 0) / limit) * 100;
      const toolPct = ((t.toolOutputTokens || 0) / limit) * 100;

      const riskClass = 'risk-' + (data.riskLevel || 'LOW');


      const filesHtml = (data.activeFiles || []).map(f => \`
        <div class="file-card" title="\${f.path}">
          <span class="file-path">📄 \${f.filename}</span>
          <span class="ref-badge">\${f.count} refs</span>
        </div>
      \`).join('');

      const toolsHtml = (data.toolStats || []).map(ts => \`
        <span class="tool-pill">\${ts.toolName} (\${ts.count})</span>
      \`).join('');

      const stepsHtml = (data.stepsSummary || []).slice(0, 12).map(s => \`
        <div class="timeline-node">
          <div class="node-meta">
            <span class="node-type">Step #\${s.index} • \${s.type}</span>
            <span class="node-source">\${s.source}</span>
          </div>
          <div class="node-text">\${escapeHtml(s.snippet)}</div>
        </div>
      \`).join('');

      container.innerHTML = \`
        <div class="app-header">
          <div class="brand-row">
            <div class="brand-title">
              ⚡ Context Tracker
              <span class="version-tag">v0.5.0</span>
            </div>

            <div class="live-badge">
              <span class="live-dot"></span>
              LIVE STREAM
            </div>
          </div>

          <div class="action-row">
            <button class="btn-compact" onclick="compactSession()" title="Compact active conversation tab in-place on disk">
              ⚡ Compact Tab (In-Place)
            </button>
            <button class="btn-icon" onclick="undoCompaction()" title="Restore Uncompacted History from Backup">↺</button>
            <button class="btn-icon" onclick="refresh()" title="Force Refresh Analytics">↻</button>
            <button class="btn-icon" onclick="exportSummary()" title="Export Summary Markdown">📥</button>
          </div>
        </div>


        <div class="risk-banner \${riskClass}">
          <div>\${data.riskMessage}</div>
        </div>

        <div class="card">
          <div class="card-header">
            <span>Context Capacity</span>
            <span style="color:#ffffff">\${t.percentageUsed}%</span>
          </div>
          <div class="gauge-metrics">
            <span class="tokens-value">\${total.toLocaleString()}</span>
            <span class="tokens-max">/ \${limitFormatted} max tokens</span>
          </div>

          <div class="progress-bar-container">
            <div class="threshold-indicator" title="70% Hallucination Risk Threshold"></div>
            <div class="progress-seg seg-system" style="width: \${sysPct}%" title="System Rules: \${(t.systemPromptTokens || 0).toLocaleString()}"></div>
            <div class="progress-seg seg-user" style="width: \${userPct}%" title="Prompts: \${(t.userPromptTokens || 0).toLocaleString()}"></div>
            <div class="progress-seg seg-model" style="width: \${modelPct}%" title="Assistant: \${(t.modelOutputTokens || 0).toLocaleString()}"></div>
            <div class="progress-seg seg-tool" style="width: \${toolPct}%" title="Tools: \${(t.toolOutputTokens || 0).toLocaleString()}"></div>
          </div>

          <div class="legend-grid">
            <div class="legend-chip"><div class="dot-chip seg-system"></div> System (\${(t.systemPromptTokens || 0).toLocaleString()})</div>
            <div class="legend-chip"><div class="dot-chip seg-user"></div> Prompts (\${(t.userPromptTokens || 0).toLocaleString()})</div>
            <div class="legend-chip"><div class="dot-chip seg-model"></div> Assistant (\${(t.modelOutputTokens || 0).toLocaleString()})</div>
            <div class="legend-chip"><div class="dot-chip seg-tool"></div> Tools (\${(t.toolOutputTokens || 0).toLocaleString()})</div>
          </div>
        </div>

        <div class="card">
          <div class="card-header">Active Files (\${(data.activeFiles || []).length})</div>
          <div class="file-grid">
            \${filesHtml || '<div style="color:#888; font-size:10px;">No file references recorded yet.</div>'}
          </div>
        </div>

        <div class="card">
          <div class="card-header">Executed Tools (\${(data.toolStats || []).length})</div>
          <div class="tool-pills">
            \${toolsHtml || '<div style="color:#888; font-size:10px;">No tools executed yet.</div>'}
          </div>
        </div>

        <div class="card">
          <div class="card-header">Step Stream (\${data.stepCount} total)</div>
          <div class="timeline-feed">
            \${stepsHtml || '<div style="color:#888; font-size:10px;">No activity recorded yet.</div>'}
          </div>
        </div>
      \`;
    }

    function compactSession() {
      vscode.postMessage({ command: 'compact' });
    }

    function undoCompaction() {
      vscode.postMessage({ command: 'undo' });
    }

    function refresh() {
      vscode.postMessage({ command: 'refresh' });
    }


    function exportSummary() {
      vscode.postMessage({ command: 'export' });
    }

    function escapeHtml(str) {
      return (str || '').replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    }

    window.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'update') {
        render(message.data);
      }
    });

    render(initialData);
  </script>
</body>
</html>`;
}
