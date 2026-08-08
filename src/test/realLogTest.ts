import { TranscriptWatcher } from '../services/transcriptWatcher';
import { ContextAnalyzer } from '../services/contextAnalyzer';

console.log('Testing live Antigravity brain log discovery...');

const watcher = new TranscriptWatcher();
const sessions = watcher.listSessions();

console.log(`Discovered ${sessions.length} sessions in Antigravity brain.`);
if (sessions.length > 0) {
  const activeSession = sessions[0];
  console.log(`Active session ID: ${activeSession.id}`);
  console.log(`Transcript path: ${activeSession.transcriptPath}`);
  console.log(`Last active: ${activeSession.lastActivity.toLocaleString()}`);

  const { steps, session } = watcher.readActiveSteps();
  console.log(`Read ${steps.length} steps from transcript log.`);

  if (session) {
    const analysis = ContextAnalyzer.analyze(steps, session);
    console.log('\n--- LIVE ANALYSIS SUMMARY ---');
    console.log(`Model: ${analysis.modelName}`);
    console.log(`Risk Level: ${analysis.riskLevel} (${analysis.riskMessage})`);
    console.log(`Tokens: ${analysis.tokens.totalTokens.toLocaleString()} / ${analysis.tokens.limitTokens.toLocaleString()} (${analysis.tokens.percentageUsed}%)`);
    console.log(`System Tokens: ${analysis.tokens.systemPromptTokens}`);
    console.log(`User Tokens: ${analysis.tokens.userPromptTokens}`);
    console.log(`Model Tokens: ${analysis.tokens.modelOutputTokens}`);
    console.log(`Tool Tokens: ${analysis.tokens.toolOutputTokens}`);
    console.log(`Active Files (${analysis.activeFiles.length}):`);
    analysis.activeFiles.forEach(f => console.log(`  - ${f.filename} (${f.count} refs)`));
    console.log(`Tool Calls (${analysis.toolStats.length}):`);
    analysis.toolStats.forEach(t => console.log(`  - ${t.toolName}: ${t.count}`));
  }
}
