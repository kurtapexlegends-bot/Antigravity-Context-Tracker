import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

// 1. Check all possible settings files for active model
const settingsPaths = [
  path.join(os.homedir(), '.gemini', 'settings.json'),
  path.join(os.homedir(), '.gemini', 'config', 'config.json'),
  path.join(os.homedir(), '.gemini', 'antigravity', 'settings.json'),
  path.join(os.homedir(), '.gemini', 'antigravity-ide', 'settings.json'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'Antigravity', 'User', 'settings.json'),
  path.join(os.homedir(), 'AppData', 'Roaming', 'Code', 'User', 'settings.json')
];

console.log('--- CHECKING SETTINGS FILES ---');
for (const p of settingsPaths) {
  if (fs.existsSync(p)) {
    console.log(`Found: ${p}`);
    try {
      const content = fs.readFileSync(p, 'utf-8');
      console.log(content.substring(0, 500));
    } catch (e) {}
  }
}

// 2. Check active session 0736364b
const sessionId = '0736364b-906e-4032-9429-02496b0528ad';
const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
const transcriptPath = path.join(brainDir, sessionId, '.system_generated', 'logs', 'transcript.jsonl');

if (fs.existsSync(transcriptPath)) {
  const lines = fs.readFileSync(transcriptPath, 'utf-8').split(/\r?\n/).filter(l => l.trim().length > 0);
  console.log(`\n--- SESSION ${sessionId} ---`);
  console.log(`Total lines: ${lines.length}`);
  
  let userChars = 0;
  let modelChars = 0;
  let toolChars = 0;
  let thinkingChars = 0;

  for (const l of lines) {
    try {
      const obj = JSON.parse(l);
      if (obj.thinking) thinkingChars += obj.thinking.length;
      const c = typeof obj.content === 'string' ? obj.content : JSON.stringify(obj.content || '');
      if (obj.type === 'USER_INPUT') userChars += c.length;
      else if (obj.type === 'PLANNER_RESPONSE') modelChars += c.length;
      else toolChars += c.length;
    } catch (e) {}
  }

  console.log(`User prompt chars: ${userChars} (~${Math.ceil(userChars/4)} tokens)`);
  console.log(`Model response chars: ${modelChars} (~${Math.ceil(modelChars/4)} tokens)`);
  console.log(`Tool output chars: ${toolChars} (~${Math.ceil(toolChars/4)} tokens)`);
  console.log(`Thinking chars (pruned between turns): ${thinkingChars} (~${Math.ceil(thinkingChars/4)} tokens)`);
}
