#!/usr/bin/env node

import * as readline from 'readline';
import * as path from 'path';
import { TranscriptWatcher } from './services/transcriptWatcher';
import { ContextAnalyzer, AnalysisResult } from './services/contextAnalyzer';
import { ContextCompacter } from './services/contextCompacter';

// ANSI Color Helpers
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
  console.log(`\n${cyan}╭────────────────────────────────────────────────────────╮${reset}`);
  console.log(`${cyan}│${reset}  ${bold}${cyan}⚡ ANTIGRAVITY CONTEXT TRACKER CLI${reset} ${dim}v0.6.0${reset}              ${cyan}│${reset}`);
  console.log(`${cyan}╰────────────────────────────────────────────────────────╯${reset}`);
}

function printStatus(analysis: AnalysisResult) {
  const t = analysis.tokens;
  const limit = t.limitTokens;
  const pct = t.percentageUsed;

  const limitFormatted = limit >= 1000000 
    ? (limit / 1000000).toFixed(1) + 'M' 
    : (limit / 1000).toFixed(0) + 'k';

  // 24-slot visual progress bar
  const totalSlots = 24;
  const filledBars = Math.min(totalSlots, Math.max(0, Math.round((pct / 100) * totalSlots)));
  const emptyBars = totalSlots - filledBars;
  const barColor = pct >= 70 ? red : pct >= 50 ? yellow : green;
  const progressBar = `${barColor}[${'█'.repeat(filledBars)}${'░'.repeat(emptyBars)}]${reset}`;

  console.log(`${bold}  Active Session :${reset} ${cyan}${analysis.sessionId}${reset}`);
  console.log(`${bold}  Detected Model :${reset} ${magenta}${analysis.modelName}${reset} ${dim}(${analysis.modelCapability.family} - ${limitFormatted} max)${reset}`);
  console.log(`${bold}  Last Active    :${reset} ${analysis.lastUpdated}`);
  console.log(`${bold}  Context Usage  :${reset} ${bold}${t.totalTokens.toLocaleString()}${reset} / ${limitFormatted} tokens (${pct}%)`);
  console.log(`${bold}  Capacity Gauge :${reset} ${progressBar} ${analysis.riskMessage}\n`);

  console.log(`${dim}  ┌─ Context Composition ──────────────────────────────┐${reset}`);
  console.log(`  ${dim}│${reset} ${magenta}●${reset} System Rules & Skills : ${t.systemPromptTokens.toLocaleString().padStart(8)} tokens       ${dim}│${reset}`);
  console.log(`  ${dim}│${reset} ${blue}●${reset} User Prompts          : ${t.userPromptTokens.toLocaleString().padStart(8)} tokens       ${dim}│${reset}`);
  console.log(`  ${dim}│${reset} ${green}●${reset} Assistant Responses   : ${t.modelOutputTokens.toLocaleString().padStart(8)} tokens       ${dim}│${reset}`);
  console.log(`  ${dim}│${reset} ${yellow}●${reset} Tool Output Buffers   : ${t.toolOutputTokens.toLocaleString().padStart(8)} tokens       ${dim}│${reset}`);
  console.log(`${dim}  └────────────────────────────────────────────────────┘${reset}`);

  if (analysis.activeFiles.length > 0) {
    console.log(`\n${bold}  Active Workspace Files & State Deltas:${reset}`);
    analysis.activeFiles.slice(0, 8).forEach(f => {
      let tag = `${dim}[REF]${reset}`;
      if (f.status === 'CREATED') tag = `${green}[NEW]${reset}`;
      else if (f.status === 'MODIFIED') tag = `${yellow}[MOD]${reset}`;
      console.log(`    ${tag} ${cyan}${f.filename.padEnd(24)}${reset} ${dim}(${f.count} refs)${reset}`);
    });
  }

  if (analysis.toolStats.length > 0) {
    console.log(`\n${bold}  Executed Tools Summary:${reset}`);
    const toolsStr = analysis.toolStats.slice(0, 6).map(ts => `${ts.toolName} (${ts.count})`).join(', ');
    console.log(`    ${dim}${toolsStr}${reset}`);
  }

  console.log(`\n${dim}────────────────────────────────────────────────────────${reset}\n`);
}

function handleStatus(watcher: TranscriptWatcher) {
  printHeader();
  const { steps, session } = watcher.readActiveSteps();
  if (!session) {
    console.log(`${yellow}  No active Antigravity session found in brain store.${reset}\n`);
    return;
  }

  const analysis = ContextAnalyzer.analyze(steps, session);
  printStatus(analysis);
}

function handleCompact(watcher: TranscriptWatcher) {
  printHeader();
  const { steps, session } = watcher.readActiveSteps();
  if (!session) {
    console.log(`${yellow}  No active Antigravity session found to compact.${reset}\n`);
    return;
  }

  const analysis = ContextAnalyzer.analyze(steps, session);
  console.log(`  ${bold}Target Session:${reset} ${cyan}${session.id}${reset}`);
  console.log(`  ${dim}Applying Next-Gen Smart Hybrid Compaction on disk...${reset}\n`);

  const result = ContextCompacter.compactInPlace(steps, session, analysis, 3);

  console.log(`  ${green}${bold}✔ Smart Hybrid Compaction Successful!${reset}`);
  console.log(`    ${bold}Original Tokens   :${reset} ${result.originalTokens.toLocaleString()} tokens`);
  console.log(`    ${bold}New Tokens        :${reset} ${green}${result.compactTokens.toLocaleString()} tokens${reset}`);
  console.log(`    ${bold}Reclaimed Space   :${reset} ${green}${bold}${result.reclaimedTokens.toLocaleString()} tokens (${result.reclaimedPercentage}% reduction)${reset}`);
  console.log(`    ${bold}Turn-Aware State  :${reset} Preserved last ${result.preservedRecentTurnsCount} complete turns (${result.preservedRecentStepsCount} steps) 100% intact`);
  console.log(`    ${bold}Stubbed Observers :${reset} ${result.stubbedObservationsCount} heavy tool payloads condensed`);
  console.log(`    ${bold}Safety Backup     :${reset} ${dim}${result.backupPath}${reset}\n`);
  console.log(`  ${green}Antigravity App context is refreshed with fresh capacity!${reset}\n`);
}

function handleUndo(watcher: TranscriptWatcher) {
  printHeader();
  const session = watcher.getActiveSession();
  if (!session) {
    console.log(`${yellow}  No active session found.${reset}\n`);
    return;
  }

  console.log(`  ${bold}Active Session:${reset} ${cyan}${session.id}${reset}`);
  console.log(`  ${dim}Restoring from latest safety backup...${reset}\n`);

  const res = ContextCompacter.restoreBackup(session);
  if (res.success) {
    console.log(`  ${green}${bold}✔ Session Restored!${reset}`);
    console.log(`  ${dim}${res.message}${reset}\n`);
    const { steps } = watcher.readActiveSteps();
    const analysis = ContextAnalyzer.analyze(steps, session);
    console.log(`  ${bold}Restored Tokens:${reset} ${analysis.tokens.totalTokens.toLocaleString()} tokens across ${steps.length} steps.\n`);
  } else {
    console.log(`  ${red}${bold}✖ Restore Failed:${reset} ${res.message}\n`);
  }
}

function handleClean(watcher: TranscriptWatcher) {
  printHeader();
  const session = watcher.getActiveSession();
  if (!session) {
    console.log(`${yellow}  No active session found.${reset}\n`);
    return;
  }

  const logsDir = path.dirname(session.transcriptPath);
  const deletedCount = ContextCompacter.pruneOldBackups(logsDir, 2);

  if (deletedCount > 0) {
    console.log(`  ${green}${bold}✔ Cleaned up ${deletedCount} older backup files.${reset}`);
  } else {
    console.log(`  ${dim}Backup storage is clean. Kept latest active safety backups.${reset}`);
  }
  console.log(`\n${dim}────────────────────────────────────────────────────────${reset}\n`);
}

function handleInspect(watcher: TranscriptWatcher) {
  printHeader();
  const { steps, session } = watcher.readActiveSteps();
  if (!session || steps.length === 0) {
    console.log(`${yellow}  No active conversation steps found.${reset}\n`);
    return;
  }

  const analysis = ContextAnalyzer.analyze(steps, session);
  const bloatItems = ContextAnalyzer.inspectBloat(steps, 6);

  console.log(`  ${bold}Session:${reset} ${cyan}${session.id}${reset} ${dim}(Total: ${analysis.tokens.totalTokens.toLocaleString()} tokens)${reset}\n`);
  console.log(`  ${bold}🔍 Top Token-Consuming Steps (Bloat Diagnosis):${reset}\n`);

  bloatItems.forEach((b, idx) => {
    const pctOfTotal = ((b.tokens / analysis.tokens.totalTokens) * 100).toFixed(1);
    const label = b.toolName ? `Tool: ${b.toolName}` : b.type;
    const target = b.target ? ` -> ${dim}${b.target}${reset}` : '';

    console.log(`  ${bold}#${idx + 1} [Step #${b.stepIndex}]${reset} ${yellow}${b.tokens.toLocaleString()} tokens${reset} ${dim}(${pctOfTotal}% of total)${reset}`);
    console.log(`     ${cyan}${label}${reset}${target}`);
    console.log(`     ${dim}Snippet: ${b.snippet}${reset}\n`);
  });

  console.log(`  ${dim}💡 Tip: Run 'ag-context compact' to condense older heavy tool logs.${reset}\n`);
  console.log(`${dim}────────────────────────────────────────────────────────${reset}\n`);
}

function handleList(watcher: TranscriptWatcher) {
  printHeader();
  const sessions = watcher.listSessions();
  if (sessions.length === 0) {
    console.log(`${yellow}  No sessions found in ~/.gemini/antigravity/brain.${reset}\n`);
    return;
  }

  console.log(`  ${bold}Recent Conversation Sessions (${sessions.length} total):${reset}\n`);
  sessions.slice(0, 10).forEach((s, idx) => {
    const isCurrent = idx === 0 ? ` ${green}[ACTIVE]${reset}` : '';
    console.log(`  ${bold}[${idx + 1}]${reset} ${cyan}${s.id}${reset}${isCurrent}`);
    console.log(`      ${dim}Last modified: ${s.lastActivity.toLocaleString()}${reset}`);
  });
  console.log(`\n  ${dim}💡 Tip: Run 'ag-context switch <number>' to switch active session.${reset}\n`);
  console.log(`${dim}────────────────────────────────────────────────────────${reset}\n`);
}

function handleSwitch(watcher: TranscriptWatcher, arg?: string) {
  printHeader();
  const sessions = watcher.listSessions();
  if (sessions.length === 0) {
    console.log(`${yellow}  No sessions found.${reset}\n`);
    return;
  }

  const switchToIndex = (index: number) => {
    if (index < 1 || index > sessions.length) {
      console.log(`  ${red}Invalid session number. Choose between 1 and ${sessions.length}.${reset}\n`);
      return;
    }
    const targetSession = sessions[index - 1];
    watcher.setActiveSessionId(targetSession.id, true);
    console.log(`  ${green}${bold}✔ Switched active tracked session to:${reset}`);
    console.log(`  ${cyan}${targetSession.id}${reset} ${dim}(Last modified: ${targetSession.lastActivity.toLocaleString()})${reset}\n`);
  };

  if (arg && !isNaN(parseInt(arg, 10))) {
    switchToIndex(parseInt(arg, 10));
    return;
  }

  console.log(`  ${bold}Select a session to track:${reset}\n`);
  sessions.slice(0, 8).forEach((s, idx) => {
    console.log(`  ${bold}[${idx + 1}]${reset} ${cyan}${s.id}${reset} ${dim}(${s.lastActivity.toLocaleTimeString()})${reset}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`\n  ${bold}Enter session number (1-${Math.min(8, sessions.length)}): ${reset}`, answer => {
    rl.close();
    const num = parseInt(answer.trim(), 10);
    switchToIndex(num);
  });
}

function handleWatch(watcher: TranscriptWatcher) {
  console.clear();
  printHeader();
  console.log(`  ${green}Live terminal HUD running. Press Ctrl+C to exit.${reset}\n`);

  const update = () => {
    watcher.checkForActiveSessionSwitch();
    const { steps, session } = watcher.readActiveSteps();
    if (session) {
      console.clear();
      printHeader();
      console.log(`  ${green}● LIVE STREAMING MONITOR${reset} ${dim}(Ctrl+C to exit)${reset}\n`);
      const analysis = ContextAnalyzer.analyze(steps, session);
      printStatus(analysis);
    }
  };

  update();
  setInterval(update, 1500);
}

function printHelp() {
  printHeader();
  console.log(`${bold}Usage:${reset} ag-context [command] [options]\n`);
  console.log(`${bold}Available Commands:${reset}`);
  console.log(`  ${cyan}status${reset}   (default) Display context tokens, active model, and capacity gauge`);
  console.log(`  ${cyan}compact${reset}  Apply smart hybrid compaction on disk (~85-95% token reduction)`);
  console.log(`  ${cyan}undo${reset}     Restore raw un-compacted conversation from latest safety backup (.bak)`);
  console.log(`  ${cyan}inspect${reset}  Diagnose token bloat (shows top token-consuming steps & files)`);
  console.log(`  ${cyan}switch${reset}   Interactively switch active tracked conversation session`);
  console.log(`  ${cyan}clean${reset}    Clean up older backup files to save disk storage`);
  console.log(`  ${cyan}list${reset}     List all conversation sessions stored in Antigravity brain`);
  console.log(`  ${cyan}watch${reset}    Live terminal dashboard streaming context in real-time`);
  console.log(`  ${cyan}help${reset}     Show this help guide\n`);
  console.log(`${bold}Examples:${reset}`);
  console.log(`  ag-context compact      ${dim}# Smart-compact while using Antigravity Desktop App${reset}`);
  console.log(`  ag-context undo         ${dim}# Instant rollback to raw history${reset}`);
  console.log(`  ag-context inspect      ${dim}# Identify large tool/file bloat${reset}`);
  console.log(`  ag-context clean        ${dim}# Free up backup disk space${reset}`);
  console.log(`  ag-context watch        ${dim}# Real-time terminal HUD${reset}\n`);
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
    case 'undo':
    case 'restore':
      handleUndo(watcher);
      break;
    case 'inspect':
    case 'bloat':
      handleInspect(watcher);
      break;
    case 'clean':
    case 'prune':
      handleClean(watcher);
      break;
    case 'switch':
    case 'select':
      handleSwitch(watcher, args[1]);
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
      console.log(`\n  ${red}Unknown command: "${command}"${reset}`);
      printHelp();
      break;
  }
}

if (require.main === module) {
  main();
}
