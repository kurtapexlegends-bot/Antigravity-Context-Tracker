import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ModelDetector } from '../services/modelDetector';

const sessionId = '0736364b-906e-4032-9429-02496b0528ad';
const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
const transcriptPath = path.join(brainDir, sessionId, '.system_generated', 'logs', 'transcript.jsonl');

console.log('Inspecting session transcript:', transcriptPath);

if (fs.existsSync(transcriptPath)) {
  const content = fs.readFileSync(transcriptPath, 'utf-8');
  const lines = content.split(/\r?\n/).filter(l => l.trim().length > 0);
  console.log(`Total lines in transcript: ${lines.length}`);
  console.log(`Total character length: ${content.length} (~${Math.ceil(content.length / 4)} tokens)`);

  const steps = lines.map(l => {
    try { return JSON.parse(l); } catch(e) { return null; }
  }).filter(Boolean);

  // Check for model selection strings in content
  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    const str = JSON.stringify(s);
    if (str.includes('Model Selection') || str.includes('Gemini') || str.includes('model')) {
      console.log(`Step ${i} model mentions:`, str.substring(0, 300));
    }
  }

  const detected = ModelDetector.detectModel(steps);
  console.log('\nDetected model by ModelDetector:', detected);
} else {
  console.log('File does not exist.');
}
