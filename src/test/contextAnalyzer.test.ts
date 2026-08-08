import * as assert from 'assert';
import { ContextAnalyzer } from '../services/contextAnalyzer';
import { TranscriptStep, ConversationSession } from '../services/transcriptWatcher';

export function runTests() {
  console.log('Running ContextAnalyzer tests...');

  const mockSession: ConversationSession = {
    id: 'test-session-1234',
    dirPath: '/mock/dir',
    transcriptPath: '/mock/dir/transcript.jsonl',
    lastActivity: new Date()
  };

  const mockSteps: TranscriptStep[] = [
    {
      step_index: 0,
      type: 'USER_INPUT',
      source: 'USER_EXPLICIT',
      content: 'Please view file:///C:/workspace/index.ts and refactor it.'
    },
    {
      step_index: 1,
      type: 'PLANNER_RESPONSE',
      source: 'MODEL',
      content: 'I will analyze C:\\workspace\\index.ts and modify it.',
      tool_calls: [
        {
          name: 'view_file',
          arguments: { AbsolutePath: 'C:\\workspace\\index.ts' }
        }
      ]
    }
  ];

  const result = ContextAnalyzer.analyze(mockSteps, mockSession);

  assert.strictEqual(result.sessionId, 'test-session-1234');
  assert.strictEqual(result.stepCount, 2);
  assert.ok(result.tokens.totalTokens > 0);
  assert.ok(result.tokens.userPromptTokens > 0);
  assert.ok(result.tokens.modelOutputTokens > 0);
  assert.strictEqual(result.toolStats.length, 1);
  assert.strictEqual(result.toolStats[0].toolName, 'view_file');
  assert.ok(result.activeFiles.length >= 1);

  console.log('✅ ContextAnalyzer tests passed successfully!');
}

if (require.main === module) {
  runTests();
}
