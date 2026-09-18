#!/usr/bin/env node

import * as readline from 'readline';
import * as path from 'path';
import { TranscriptWatcher } from './services/transcriptWatcher';
import { ContextAnalyzer, AnalysisResult } from './services/contextAnalyzer';
import { ContextCompacter } from './services/contextCompacter';

// ANSI Color & Styling Helpers
const reset = '\x1b[0m';
const bold = '\x1b[1m';
const dim = '\x1b[2m';
const green = '\x1b[32m';
const yellow = '\x1b[33m';
const red = '\x1b[31m';
const cyan = '\x1b[36m';
const magenta = '\x1b[35m';
const blue = '\x1b[34m';

function formatTokens(tokens: number): string {
  if (tokens >= 1000000) return (tokens / 1000000).toFixed(1) + 'M';
  if (tokens >= 1000) return (tokens / 1000).toFixed(1) + 'k';
  return tokens.toString();
}

function printHeader(sessionShortId = '', time = '') {
  const title = `${bold}${cyan}⚡ Antigravity Context${reset} ${dim}v0.7.0${reset}`;
  const rightMeta = sessionShortId ? `${dim}Session: ${cyan}${sessionShortId}${reset} ${dim}(${time})${reset}` : '';

  console.log(`\n ${title}  ${rightMeta}`);
  console.log(` ${dim}─────────────────────────────────────────────────────────────────────────${reset}`);
}

function printStatus(analysis: AnalysisResult) {
  const t = analysis.tokens;
  const limit = t.limitTokens;
  const pct = t.percentageUsed;
  const limitFmt = formatTokens(limit);
  const totalFmt = formatTokens(t.totalTokens);

  // 36-slot high-resolution visual progress bar
  const totalSlots = 36;
  const filledBars = Math.min(totalSlots, Math.max(0, Math.round((pct / 100) * totalSlots)));
  const emptyBars = totalSlots - filledBars;
  const barColor = pct >= 70 ? red : pct >= 50 ? yellow : green;
  const progressBar = `${barColor}${'█'.repeat(filledBars)}${dim}${'░'.repeat(emptyBars)}${reset}`;

  const shortSession = analysis.sessionId.length > 8 ? analysis.sessionId.substring(0, 8) : analysis.sessionId;
  printHeader(shortSession, analysis.lastUpdated);

  // Core Status Row
  const riskDot = pct >= 70 ? `${red}● High Risk${reset}` : pct >= 50 ? `${yellow}● Moderate${reset}` : `${green}● Optimal Recall${reset}`;
  console.log(`  ${dim}Model${reset}   ${magenta}${analysis.modelName}${reset} ${dim}(${analysis.modelCapability.family} · ${limitFmt} max)${reset}`);
  console.log(`  ${dim}Usage${reset}   ${bold}${t.totalTokens.toLocaleString()}${reset} ${dim}/ ${limitFmt} tokens${reset}  ${dim}(${pct}%)${reset}   ${riskDot}`);
  console.log(`  [${progressBar}] ${bold}${pct}%${reset}\n`);

  // Memory Breakdown (Inline clean badges)
  const calcPct = (val: number) => t.totalTokens > 0 ? Math.round((val / t.totalTokens) * 100) : 0;
  console.log(`  ${dim}Memory Breakdown${reset}`);
  console.log(`    ${magenta}●${reset} System  ${formatTokens(t.systemPromptTokens).padEnd(6)} ${dim}(${calcPct(t.systemPromptTokens)}%)${reset}   ${blue}●${reset} Prompts  ${formatTokens(t.userPromptTokens).padEnd(6)} ${dim}(${calcPct(t.userPromptTokens)}%)${reset}`);
  console.log(`    ${green}●${reset} Model   ${formatTokens(t.modelOutputTokens).padEnd(6)} ${dim}(${calcPct(t.modelOutputTokens)}%)${reset}   ${yellow}●${reset} Tools    ${formatTokens(t.toolOutputTokens).padEnd(6)} ${dim}(${calcPct(t.toolOutputTokens)}%)${reset}\n`);

  // Active Files in compact 2-column grid
  if (analysis.activeFiles.length > 0) {
    console.log(`  ${dim}Active Workspace Files${reset}`);
    const files = analysis.activeFiles.slice(0, 6);
    for (let i = 0; i < files.length; i += 2) {
      const f1 = files[i];
      const f2 = files[i + 1];

      const renderFile = (f: typeof f1) => {
        if (!f) return '';
        let tag = `${dim}REF${reset}`;
        if (f.status === 'CREATED') tag = `${green}NEW${reset}`;
        else if (f.status === 'MODIFIED') tag = `${yellow}MOD${reset}`;
        const name = f.filename.length > 20 ? f.filename.substring(0, 18) + '..' : f.filename;
        return `  ${tag} ${cyan}${name.padEnd(21)}${reset} ${dim}(${f.count})${reset}`;
      };

      const col1 = renderFile(f1).padEnd(36);
      const col2 = f2 ? renderFile(f2) : '';
      console.log(`  ${col1}${col2}`);
    }
    console.log('');
  }

  // Executed Tools in clean inline summary
  if (analysis.toolStats.length > 0) {
    const toolsStr = analysis.toolStats.slice(0, 5).map(ts => `${cyan}${ts.toolName}${reset} ${dim}(${ts.count})${reset}`).join(' · ');
    console.log(`  ${dim}Tools${reset}   ${toolsStr}`);
  }

  console.log(` ${dim}─────────────────────────────────────────────────────────────────────────${reset}\n`);
}

function handleStatus(watcher: TranscriptWatcher) {
  const { steps, session } = watcher.readActiveSteps();
  if (!session) {
    printHeader();
    console.log(`  ${yellow}No active Antigravity session found in brain store.${reset}\n`);
    return;
  }

  const analysis = ContextAnalyzer.analyze(steps, session);
  printStatus(analysis);
}

function handleCompact(watcher: TranscriptWatcher) {
  const { steps, session } = watcher.readActiveSteps();
  if (!session) {
    printHeader();
    console.log(`  ${yellow}No active Antigravity session found to compact.${reset}\n`);
    return;
  }

  const analysis = ContextAnalyzer.analyze(steps, session);
  printHeader(session.id.substring(0, 8), new Date().toLocaleTimeString());

  console.log(`  ${dim}Applying Next-Gen Smart Hybrid Compaction on disk...${reset}\n`);

  const result = ContextCompacter.compactInPlace(steps, session, analysis, 3);

  console.log(`  ${green}${bold}✔ Smart Hybrid Compaction Applied!${reset}`);
  console.log(`    ${dim}Original  :${reset} ${result.originalTokens.toLocaleString()} tokens`);
  console.log(`    ${dim}Compacted :${reset} ${green}${bold}${result.compactTokens.toLocaleString()} tokens${reset}`);
  console.log(`    ${dim}Reclaimed :${reset} ${green}${bold}${result.reclaimedTokens.toLocaleString()} tokens (${result.reclaimedPercentage}% reduction)${reset}`);
  console.log(`    ${dim}Turns Kept:${reset} ${result.preservedRecentTurnsCount} complete conversational turns (${result.preservedRecentStepsCount} steps) 100% intact`);
  console.log(`    ${dim}Backup    :${reset} ${dim}${result.backupPath}${reset}\n`);
  console.log(`  ${dim}Antigravity App context is refreshed with fresh capacity.${reset}`);
  console.log(` ${dim}─────────────────────────────────────────────────────────────────────────${reset}\n`);
}

function handleUndo(watcher: TranscriptWatcher) {
  const session = watcher.getActiveSession();
  if (!session) {
    printHeader();
    console.log(`  ${yellow}No active session found.${reset}\n`);
    return;
  }

  printHeader(session.id.substring(0, 8), new Date().toLocaleTimeString());
  console.log(`  ${dim}Restoring from latest safety backup...${reset}\n`);

  const res = ContextCompacter.restoreBackup(session);
  if (res.success) {
    console.log(`  ${green}${bold}✔ Session Restored Successfully!${reset}`);
    console.log(`  ${dim}${res.message}${reset}\n`);
    const { steps } = watcher.readActiveSteps();
    const analysis = ContextAnalyzer.analyze(steps, session);
    console.log(`  ${dim}Restored State:${reset} ${bold}${analysis.tokens.totalTokens.toLocaleString()}${reset} tokens across ${steps.length} steps.`);
  } else {
    console.log(`  ${red}${bold}✖ Restore Failed:${reset} ${res.message}`);
  }
  console.log(`\n ${dim}─────────────────────────────────────────────────────────────────────────${reset}\n`);
}

function handleClean(watcher: TranscriptWatcher) {
  const session = watcher.getActiveSession();
  if (!session) {
    printHeader();
    console.log(`  ${yellow}No active session found.${reset}\n`);
    return;
  }

  printHeader(session.id.substring(0, 8), new Date().toLocaleTimeString());
  const logsDir = path.dirname(session.transcriptPath);
  const deletedCount = ContextCompacter.pruneOldBackups(logsDir, 2);

  if (deletedCount > 0) {
    console.log(`  ${green}${bold}✔ Cleaned up ${deletedCount} older backup files to save disk space.${reset}`);
  } else {
    console.log(`  ${dim}Backup storage is clean. Kept latest active safety backups.${reset}`);
  }
  console.log(`\n ${dim}─────────────────────────────────────────────────────────────────────────${reset}\n`);
}

function handleInspect(watcher: TranscriptWatcher) {
  const { steps, session } = watcher.readActiveSteps();
  if (!session || steps.length === 0) {
    printHeader();
    console.log(`  ${yellow}No active conversation steps found.${reset}\n`);
    return;
  }

  const analysis = ContextAnalyzer.analyze(steps, session);
  const bloatItems = ContextAnalyzer.inspectBloat(steps, 5);

  printHeader(session.id.substring(0, 8), analysis.lastUpdated);
  console.log(`  ${dim}Total Context: ${bold}${analysis.tokens.totalTokens.toLocaleString()} tokens${reset} ${dim}across ${steps.length} steps${reset}\n`);
  console.log(`  ${bold}Top Token-Consuming Observations:${reset}\n`);

  bloatItems.forEach((b, idx) => {
    const pctOfTotal = ((b.tokens / analysis.tokens.totalTokens) * 100).toFixed(1);
    const label = b.toolName ? `${cyan}${b.toolName}${reset}` : `${magenta}${b.type}${reset}`;
    const target = b.target ? ` ${dim}→ ${b.target}${reset}` : '';

    console.log(`  ${dim}#${idx + 1}${reset}  [Step #${b.stepIndex}]  ${yellow}${b.tokens.toLocaleString()} tokens${reset} ${dim}(${pctOfTotal}%)${reset}  ${label}${target}`);
    console.log(`      ${dim}${b.snippet}${reset}\n`);
  });

  console.log(`  ${dim}💡 Tip: Run 'ag-context compact' to condense older heavy tool logs.${reset}`);
  console.log(` ${dim}─────────────────────────────────────────────────────────────────────────${reset}\n`);
}

function handleList(watcher: TranscriptWatcher) {
  printHeader();
  const sessions = watcher.listSessions();
  if (sessions.length === 0) {
    console.log(`  ${yellow}No sessions found in ~/.gemini/antigravity/brain.${reset}\n`);
    return;
  }

  console.log(`  ${bold}Recent Conversation Sessions (${sessions.length} total):${reset}\n`);
  sessions.slice(0, 8).forEach((s, idx) => {
    const isCurrent = idx === 0 ? ` ${green}[ACTIVE]${reset}` : '';
    const shortId = s.id.length > 12 ? s.id.substring(0, 12) + '..' : s.id;
    console.log(`  ${dim}[${idx + 1}]${reset}  ${cyan}${shortId.padEnd(16)}${reset} ${dim}${s.lastActivity.toLocaleDateString()} ${s.lastActivity.toLocaleTimeString()}${reset}${isCurrent}`);
  });
  console.log(`\n  ${dim}💡 Tip: Run 'ag-context switch <number>' to change tracked session.${reset}`);
  console.log(` ${dim}─────────────────────────────────────────────────────────────────────────${reset}\n`);
}

function handleSwitch(watcher: TranscriptWatcher, arg?: string) {
  const sessions = watcher.listSessions();
  if (sessions.length === 0) {
    printHeader();
    console.log(`  ${yellow}No sessions found.${reset}\n`);
    return;
  }

  const switchToIndex = (index: number) => {
    if (index < 1 || index > sessions.length) {
      console.log(`  ${red}Invalid session number. Choose between 1 and ${sessions.length}.${reset}\n`);
      return;
    }
    const targetSession = sessions[index - 1];
    watcher.setActiveSessionId(targetSession.id, true);
    printHeader(targetSession.id.substring(0, 8));
    console.log(`  ${green}${bold}✔ Switched active tracked session to:${reset}`);
    console.log(`  ${cyan}${targetSession.id}${reset} ${dim}(Last modified: ${targetSession.lastActivity.toLocaleString()})${reset}\n`);
    console.log(` ${dim}─────────────────────────────────────────────────────────────────────────${reset}\n`);
  };

  if (arg && !isNaN(parseInt(arg, 10))) {
    switchToIndex(parseInt(arg, 10));
    return;
  }

  printHeader();
  console.log(`  ${bold}Select a session to track:${reset}\n`);
  sessions.slice(0, 6).forEach((s, idx) => {
    const shortId = s.id.substring(0, 12) + '..';
    console.log(`  ${dim}[${idx + 1}]${reset}  ${cyan}${shortId.padEnd(16)}${reset} ${dim}${s.lastActivity.toLocaleTimeString()}${reset}`);
  });

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  rl.question(`\n  ${bold}Enter session number (1-${Math.min(6, sessions.length)}): ${reset}`, answer => {
    rl.close();
    const num = parseInt(answer.trim(), 10);
    switchToIndex(num);
  });
}

function handleWatch(watcher: TranscriptWatcher) {
  console.clear();
  console.log(`\n  ${green}● LIVE STREAMING HUD MONITOR${reset} ${dim}(Press Ctrl+C to exit)${reset}`);

  const update = () => {
    watcher.checkForActiveSessionSwitch();
    const { steps, session } = watcher.readActiveSteps();
    if (session) {
      console.clear();
      const analysis = ContextAnalyzer.analyze(steps, session);
      printStatus(analysis);
    }
  };

  update();
  setInterval(update, 1500);
}

function printHelp() {
  printHeader();
  console.log(`  ${bold}Usage:${reset} ag-context [command]\n`);
  console.log(`  ${bold}Commands:${reset}`);
  console.log(`    ${cyan}status${reset}    ${dim}(default)${reset} Display clean context metrics & capacity gauge`);
  console.log(`    ${cyan}compact${reset}   Smart-compact conversation in-place (~85-95% token reduction)`);
  console.log(`    ${cyan}undo${reset}      Rollback to raw uncompacted conversation from .bak`);
  console.log(`    ${cyan}inspect${reset}   Diagnose token bloat (top token-consuming steps & files)`);
  console.log(`    ${cyan}switch${reset}    Interactively switch tracked conversation session`);
  console.log(`    ${cyan}clean${reset}     Prune older backup files to keep disk space minimal`);
  console.log(`    ${cyan}list${reset}      List recent Antigravity conversation sessions`);
  console.log(`    ${cyan}watch${reset}     Live terminal dashboard streaming in real-time`);
  console.log(`    ${cyan}help${reset}      Show this guide\n`);
  console.log(`  ${bold}Examples:${reset}`);
  console.log(`    ag-context compact   ${dim}# Run while chatting in Antigravity App${reset}`);
  console.log(`    ag-context inspect   ${dim}# Identify large tool/file bloat${reset}`);
  console.log(`    ag-context undo      ${dim}# Instant rollback${reset}\n`);
  console.log(` ${dim}─────────────────────────────────────────────────────────────────────────${reset}\n`);
}

// Command Router
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
