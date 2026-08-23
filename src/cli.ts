#!/usr/bin/env node

import { TranscriptWatcher } from './services/transcriptWatcher';
import { ContextAnalyzer, AnalysisResult } from './services/contextAnalyzer';
import { ContextCompacter } from './services/contextCompacter';

// Simple ANSI color helpers
const reset = '\x1b[0m';
const bold = '\x1b[1m';
const dim = '\x1b[2m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const cyan = '\x1b[36m';
const magenta = '\x1b[35m';
const blue = '\x1b[34m';

function printHeader() {
  console.log(`\n${bold}${cyan}⚡ ANTIGRAVITY CONTEXT TRACKER CLI${reset} ${dim}v0.4.0${reset}`);
  console.log(`${dim}──────────────────────────────────────────────────${reset}`);
}

function printStatus(analysis: AnalysisResult) {
  const t = analysis.tokens;
  const limit = t.limitTokens;
  const pct = t.percentageUsed;

  const limitFormatted = limit >= 1000000 
    ? (limit / 1000000).toFixed(1) + 'M' 
    : (limit / 1000).toFixed(0) + 'k';

  // Build a 20-character visual progress bar
  const filledBars = Math.min(20, Math.max(0, Math.round((pct / 100) * 20)));
  const emptyBars = 20 - filledBars;
  const barColor = pct >= 70 ? red : pct >= 50 ? yellow : green;
  const progressBar = `${barColor}[${'█'.repeat(filledBars)}${'░'.repeat(emptyBars)}]${reset}`;

  console.log(`${bold}Active Session :${reset} ${cyan}${analysis.sessionId}${reset}`);
  console.log(`${bold}Detected Model :${reset} ${magenta}${analysis.modelName}${reset} ${dim}(${analysis.modelCapability.family})${reset}`);
  console.log(`${bold}Last Active    :${reset} ${analysis.lastUpdated}`);
  console.log(`${bold}Context Usage  :${reset} ${bold}${t.totalTokens.toLocaleString()}${reset} / ${limitFormatted} tokens (${pct}%)`);
  console.log(`${bold}Capacity Gauge :${reset} ${progressBar} ${analysis.riskMessage}`);

  console.log(`\n${bold}Memory Composition:${reset}`);
  console.log(`  ${magenta}●${reset} System Rules & Skills: ${t.systemPromptTokens.toLocaleString()} tokens`);
  console.log(`  ${blue}●${reset} User Prompts          : ${t.userPromptTokens.toLocaleString()} tokens`);
  console.log(`  ${green}●${reset} Assistant Responses   : ${t.modelOutputTokens.toLocaleString()} tokens`);
  console.log(`  ${yellow}●${reset} Tool Output Buffers   : ${t.toolOutputTokens.toLocaleString()} tokens`);

  if (analysis.activeFiles.length > 0) {
    console.log(`\n${bold}Active Project Files (${analysis.activeFiles.length}):${reset}`);
    analysis.activeFiles.slice(0, 8).forEach(f => {
      console.log(`  ${dim}📄${reset} ${cyan}${f.filename}${reset} ${dim}(${f.count} refs)${reset}`);
    });
  }

  if (analysis.toolStats.length > 0) {
    console.log(`\n${bold}Executed Tools:${reset}`);
    const toolsStr = analysis.toolStats.map(ts => `${ts.toolName} (${ts.count})`).join(', ');
    console.log(`  ${dim}${toolsStr}${reset}`);
  }

  console.log(`${dim}──────────────────────────────────────────────────${reset}\n`);
}

function handleStatus(watcher: TranscriptWatcher) {
  printHeader();
  const { steps, session } = watcher.readActiveSteps();
  if (!session) {
    console.log(`${yellow}No active Antigravity session found in brain store.${reset}\n`);
    return;
  }

  const analysis = ContextAnalyzer.analyze(steps, session);
  printStatus(analysis);
}

function handleCompact(watcher: TranscriptWatcher) {
  printHeader();
  const { steps, session } = watcher.readActiveSteps();
  if (!session) {
    console.log(`${yellow}No active Antigravity session found to compact.${reset}\n`);
    return;
  }

  const analysis = ContextAnalyzer.analyze(steps, session);
  console.log(`${bold}Active Session:${reset} ${cyan}${session.id}${reset}`);
  console.log(`${dim}Compacting raw conversation history in-place on disk...${reset}\n`);

  const result = ContextCompacter.compactInPlace(steps, session, analysis);

  console.log(`${green}${bold}✔ In-Place Sliding-Window Compaction Successful!${reset}`);
  console.log(`  ${bold}Original Tokens:${reset} ${result.originalTokens.toLocaleString()} tokens`);
  console.log(`  ${bold}New Tokens     :${reset} ${green}${result.compactTokens.toLocaleString()} tokens${reset}`);
  console.log(`  ${bold}Reclaimed Space:${reset} ${green}${bold}${result.reclaimedTokens.toLocaleString()} tokens (${result.reclaimedPercentage}% reduction)${reset}`);
  console.log(`  ${bold}Recent Turns   :${reset} Preserved last ${result.preservedRecentStepsCount} chat turns 100% intact`);
  console.log(`  ${bold}Safety Backup  :${reset} ${dim}${result.backupPath}${reset}\n`);
  console.log(`${green}Your Antigravity App chat context is now refreshed and low-token!${reset}\n`);
}

function handleList(watcher: TranscriptWatcher) {
  printHeader();
  const sessions = watcher.listSessions();
  if (sessions.length === 0) {
    console.log(`${yellow}No sessions found in ~/.gemini/antigravity/brain.${reset}\n`);
    return;
  }

  console.log(`${bold}Recent Antigravity Sessions (${sessions.length} total):${reset}\n`);
  sessions.slice(0, 10).forEach((s, idx) => {
    const isCurrent = idx === 0 ? ` ${green}[ACTIVE]${reset}` : '';
    console.log(`  ${bold}#${idx + 1}${reset} ${cyan}${s.id}${reset}${isCurrent}`);
    console.log(`     ${dim}Last modified: ${s.lastActivity.toLocaleString()}${reset}`);
  });
  console.log(`\n${dim}──────────────────────────────────────────────────${reset}\n`);
}

function handleWatch(watcher: TranscriptWatcher) {
  console.clear();
  printHeader();
  console.log(`${green}Live terminal HUD running. Press Ctrl+C to exit.${reset}\n`);

  const update = () => {
    watcher.checkForActiveSessionSwitch();
    const { steps, session } = watcher.readActiveSteps();
    if (session) {
      console.clear();
      printHeader();
      console.log(`${green}● LIVE STREAMING MONITOR${reset} ${dim}(Ctrl+C to exit)${reset}\n`);
      const analysis = ContextAnalyzer.analyze(steps, session);
      printStatus(analysis);
    }
  };

  update();
  setInterval(update, 1500);
}

function printHelp() {
  printHeader();
  console.log(`${bold}Usage:${reset} ag-context [command]\n`);
  console.log(`${bold}Commands:${reset}`);
  console.log(`  ${cyan}status${reset}   (default) Display context tokens, active model, and capacity gauge`);
  console.log(`  ${cyan}compact${reset}  Instantly compact active conversation in-place on disk (~85% savings)`);
  console.log(`  ${cyan}watch${reset}    Live terminal dashboard streaming context in real-time`);
  console.log(`  ${cyan}list${reset}     List all conversation sessions stored in Antigravity brain`);
  console.log(`  ${cyan}help${reset}     Show this help guide\n`);
  console.log(`${bold}Examples:${reset}`);
  console.log(`  ag-context compact   ${dim}# Compact active chat session while using Antigravity App${reset}`);
  console.log(`  ag-context status    ${dim}# Check token usage of active model${reset}`);
  console.log(`  ag-context watch     ${dim}# Monitor active context live side-by-side in terminal${reset}\n`);
}

// CLI Command Router
function main() {
  const args = process.argv.slice(2);
  const command = args[0] ? args[0].toLowerCase() : 'status';
  const watcher = new TranscriptWatcher();

  switch (command) {
    case 'status':
      handleStatus(watcher);
      break;
    case 'compact':
      handleCompact(watcher);
      break;
    case 'list':
      handleList(watcher);
      break;
    case 'watch':
      handleWatch(watcher);
      break;
    case 'help':
    case '--help':
    case '-h':
      printHelp();
      break;
    default:
      console.log(`${red}Unknown command: "${command}"${reset}`);
      printHelp();
      break;
  }
}

if (require.main === module) {
  main();
}
