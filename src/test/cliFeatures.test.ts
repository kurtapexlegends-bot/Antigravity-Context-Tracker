import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ContextAnalyzer } from '../services/contextAnalyzer';
import { ContextCompacter } from '../services/contextCompacter';
import { ModelDetector } from '../services/modelDetector';
import { TranscriptStep, ConversationSession } from '../services/transcriptWatcher';

export function runCliFeaturesTest() {
  console.log('Testing CLI v0.5.0 features: Bloat Inspector, Backup Restore, and Model Detection...');

  // 1. Test Model Detection for Gemini 3.8 Flash
  const model38 = ModelDetector.getCapability('Gemini 3.8 Flash (High)');
  assert.strictEqual(model38.modelName, 'Gemini 3.8 Flash');
  assert.strictEqual(model38.limitTokens, 1048576);

  // 2. Test Bloat Inspector
  const mockSteps: TranscriptStep[] = [
    {
      step_index: 0,
      type: 'USER_INPUT',
      content: 'Small prompt'
    },
    {
      step_index: 1,
      type: 'VIEW_FILE',
      content: 'A'.repeat(8000), // ~2000 tokens
      tool_calls: [{ name: 'view_file', arguments: { AbsolutePath: 'C:\\large_file.js' } }]
    },
    {
      step_index: 2,
      type: 'RUN_COMMAND',
      content: 'B'.repeat(16000), // ~4000 tokens
      tool_calls: [{ name: 'run_command', arguments: { CommandLine: 'npm run test' } }]
    }
  ];

  const bloat = ContextAnalyzer.inspectBloat(mockSteps, 2);
  assert.strictEqual(bloat.length, 2);
  assert.strictEqual(bloat[0].stepIndex, 2, 'Largest step should be step #2');
  assert.strictEqual(bloat[0].toolName, 'run_command');
  assert.strictEqual(bloat[0].target, 'npm run test');

  // 3. Test Undo / Restore Backup
  const tempDir = path.join(os.tmpdir(), 'ag_restore_test_' + Date.now());
  const logsDir = path.join(tempDir, '.system_generated', 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  const transcriptPath = path.join(logsDir, 'transcript.jsonl');
  const backupPath = path.join(logsDir, 'transcript.jsonl.bak');

  fs.writeFileSync(backupPath, '{"step_index":0,"content":"Original raw history"}\n', 'utf-8');
  fs.writeFileSync(transcriptPath, '{"step_index":0,"content":"Compacted digest"}\n', 'utf-8');

  const mockSession: ConversationSession = {
    id: 'restore-test-session',
    dirPath: tempDir,
    transcriptPath,
    lastActivity: new Date()
  };

  const restoreResult = ContextCompacter.restoreBackup(mockSession);
  assert.strictEqual(restoreResult.success, true);
  
  const restoredContent = fs.readFileSync(transcriptPath, 'utf-8');
  assert.ok(restoredContent.includes('Original raw history'), 'Transcript should be restored to backup content');

  // Clean up
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('✅ All CLI v0.5.0 features passed successfully!');
}

if (require.main === module) {
  runCliFeaturesTest();
}
