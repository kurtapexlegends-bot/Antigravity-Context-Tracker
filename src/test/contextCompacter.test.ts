import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ContextCompacter } from '../services/contextCompacter';
import { ContextAnalyzer } from '../services/contextAnalyzer';
import { TranscriptStep, ConversationSession } from '../services/transcriptWatcher';

export function runCompacterTests() {
  console.log('Running ContextCompacter v0.3.3 sliding-window unit tests...');

  const tempDir = path.join(os.tmpdir(), 'ag_compactor_test_' + Date.now());
  const logsDir = path.join(tempDir, '.system_generated', 'logs');
  fs.mkdirSync(logsDir, { recursive: true });

  const transcriptPath = path.join(logsDir, 'transcript.jsonl');
  const mockInitialLine = JSON.stringify({
    step_index: 0,
    type: 'USER_INPUT',
    source: 'USER_EXPLICIT',
    content: 'Initial heavy prompt text...'
  }) + '\n';
  fs.writeFileSync(transcriptPath, mockInitialLine, 'utf-8');

  const mockSession: ConversationSession = {
    id: 'compactor-test-1234',
    dirPath: tempDir,
    transcriptPath,
    lastActivity: new Date()
  };

  const mockSteps: TranscriptStep[] = [
    {
      step_index: 0,
      type: 'USER_INPUT',
      source: 'USER_EXPLICIT',
      content: 'Refactor index.ts to implement feature X.'
    },
    {
      step_index: 1,
      type: 'PLANNER_RESPONSE',
      source: 'MODEL',
      content: 'I will modify index.ts and create helper.ts',
      tool_calls: [
        { name: 'write_to_file', arguments: { TargetFile: 'C:\\project\\helper.ts' } }
      ]
    }
  ];

  const analysis = ContextAnalyzer.analyze(mockSteps, mockSession);
  const result = ContextCompacter.compactInPlace(mockSteps, mockSession, analysis);

  assert.ok(result.markdown.includes('Level 1 Sliding-Window Context Compaction Digest'));
  assert.ok(result.continuationPrompt.includes('SLIDING_WINDOW_CONTEXT_DIGEST'));
  assert.ok(fs.existsSync(transcriptPath + '.bak'), 'Backup file should be created');
  assert.ok(result.compactTokens > 0);

  // Clean up temp dir
  try {
    fs.rmSync(tempDir, { recursive: true, force: true });
  } catch (e) {}

  console.log('✅ ContextCompacter v0.3.3 sliding-window tests passed successfully!');
}

if (require.main === module) {
  runCompacterTests();
}
