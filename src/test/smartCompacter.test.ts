import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ContextAnalyzer } from '../services/contextAnalyzer';
import { ContextCompacter } from '../services/contextCompacter';
import { TranscriptStep, ConversationSession } from '../services/transcriptWatcher';

export function runSmartCompacterTests() {
  console.log('Testing Next-Gen Smart Hybrid Compactor v0.6.0...');

  const tempDir = path.join(os.tmpdir(), 'ag_smart_test_' + Date.now());
  const logsDir = path.join(tempDir, '.system_generated', 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  const transcriptPath = path.join(logsDir, 'transcript.jsonl');

  const mockSession: ConversationSession = {
    id: 'smart-test-session',
    dirPath: tempDir,
    transcriptPath,
    lastActivity: new Date()
  };

  // Build a realistic multi-turn conversation
  const mockSteps: TranscriptStep[] = [
    // Turn 1 (Old)
    {
      step_index: 0,
      type: 'USER_INPUT',
      source: 'USER_EXPLICIT',
      content: 'Create authentication controller and setup login route.'
    },
    {
      step_index: 1,
      type: 'VIEW_FILE',
      content: 'Line 1 to 2000 of large config file...'.repeat(50),
      tool_calls: [{ name: 'view_file', arguments: { AbsolutePath: 'C:\\app\\config.php' } }]
    },
    {
      step_index: 2,
      type: 'RUN_COMMAND',
      content: 'Terminal stdout: npm install output 500 lines...'.repeat(20),
      tool_calls: [{ name: 'run_command', arguments: { CommandLine: 'composer require jwt' } }]
    },
    {
      step_index: 3,
      type: 'PLANNER_RESPONSE',
      source: 'MODEL',
      content: 'I created AuthController.php with login and logout methods.'
    },
    // Turn 2 (Old)
    {
      step_index: 4,
      type: 'USER_INPUT',
      source: 'USER_EXPLICIT',
      content: 'Now write the AuthController.php file.'
    },
    {
      step_index: 5,
      type: 'GENERIC',
      content: 'File created successfully.',
      tool_calls: [{ name: 'write_to_file', arguments: { TargetFile: 'C:\\app\\AuthController.php' } }]
    },
    {
      step_index: 6,
      type: 'PLANNER_RESPONSE',
      source: 'MODEL',
      content: '# Authentication Implemented\n- JWT token authentication setup complete.'
    },
    // Turn 3 (Recent Turn 1)
    {
      step_index: 7,
      type: 'USER_INPUT',
      source: 'USER_EXPLICIT',
      content: 'Add validation rules in AuthController.php.'
    },
    {
      step_index: 8,
      type: 'GENERIC',
      content: 'File updated successfully.',
      tool_calls: [{ name: 'replace_file_content', arguments: { TargetFile: 'C:\\app\\AuthController.php' } }]
    },
    // Turn 4 (Recent Turn 2)
    {
      step_index: 9,
      type: 'USER_INPUT',
      source: 'USER_EXPLICIT',
      content: 'Can you check if there are lint errors?'
    },
    {
      step_index: 10,
      type: 'PLANNER_RESPONSE',
      source: 'MODEL',
      content: 'No lint errors detected. Everything builds cleanly.'
    }
  ];

  fs.writeFileSync(transcriptPath, mockSteps.map(s => JSON.stringify(s)).join('\n') + '\n', 'utf-8');

  // 1. Analyze and verify file action deltas
  const analysis = ContextAnalyzer.analyze(mockSteps, mockSession);
  const authFile = analysis.activeFiles.find(f => f.filename === 'AuthController.php');
  assert.ok(authFile, 'AuthController.php should be in active files');
  assert.strictEqual(authFile?.status, 'CREATED', 'AuthController.php should be marked as CREATED');

  // 2. Perform Smart Compaction
  const result = ContextCompacter.compactInPlace(mockSteps, mockSession, analysis, 2);

  assert.ok(result.reclaimedPercentage > 0, 'Should reclaim token percentage');
  assert.ok(result.continuationPrompt.includes('SMART_HYBRID_CONTEXT_CHECKPOINT'));
  assert.ok(result.continuationPrompt.includes('AuthController.php'));
  assert.strictEqual(result.preservedRecentTurnsCount, 2, 'Should preserve 2 recent turns');
  assert.ok(result.stubbedObservationsCount >= 2, 'Should stub older observations');

  // 3. Test backup rotation
  for (let i = 0; i < 7; i++) {
    fs.writeFileSync(path.join(logsDir, `transcript.jsonl.bak_2026-09-18T10-0${i}-00`), 'dummy', 'utf-8');
  }
  const deletedBackups = ContextCompacter.pruneOldBackups(logsDir, 5);
  assert.strictEqual(deletedBackups, 3, 'Should prune excess backups down to 5');

  // Clean up
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('✅ Next-Gen Smart Hybrid Compactor v0.6.0 tests passed successfully!');
}

if (require.main === module) {
  runSmartCompacterTests();
}
