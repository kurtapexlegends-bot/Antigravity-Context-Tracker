import * as vscode from 'vscode';
import { AnalysisResult } from '../services/contextAnalyzer';
import { getWebviewContent } from './webviewContent';

export class ContextSidebarProvider implements vscode.WebviewViewProvider {
  public static readonly viewType = 'antigravity-context-view';
  private _view?: vscode.WebviewView;
  private _currentAnalysis: AnalysisResult | null = null;
  private _onRefreshRequested: () => void;

  constructor(
    private readonly _extensionUri: vscode.Uri,
    onRefreshRequested: () => void
  ) {
    this._onRefreshRequested = onRefreshRequested;
  }

  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    _token: vscode.CancellationToken
  ) {
    this._view = webviewView;

    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this._extensionUri]
    };

    webviewView.webview.html = getWebviewContent(this._currentAnalysis);

    webviewView.webview.onDidReceiveMessage(message => {
      if (message.command === 'refresh') {
        this._onRefreshRequested();
      } else if (message.command === 'compact') {
        vscode.commands.executeCommand('antigravity-context.compactSession');
      } else if (message.command === 'export') {
        vscode.commands.executeCommand('antigravity-context.exportSummary');
      }
    });

  }

  public update(analysis: AnalysisResult | null) {
    this._currentAnalysis = analysis;
    if (this._view) {
      this._view.webview.postMessage({
        type: 'update',
        data: analysis
      });
    }
  }
}
