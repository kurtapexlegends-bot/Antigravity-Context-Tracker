import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
const currentSessionId = 'a671094b-dde4-4905-aa83-c645b68122da';
const transcriptPath = path.join(brainDir, currentSessionId, '.system_generated', 'logs', 'transcript.jsonl');

console.log('Inspecting transcript:', transcriptPath);

if (fs.existsSync(transcriptPath)) {
  const lines = fs.readFileSync(transcriptPath, 'utf-8').split(/\r?\n/).filter(l => l.trim().length > 0);
  console.log(`Total lines: ${lines.length}`);

  const sampleKeys = new Set<string>();
  const stepTypes = new Set<string>();
  const modelsFound = new Set<string>();

  for (let i = 0; i < lines.length; i++) {
    try {
      const obj = JSON.parse(lines[i]);
      Object.keys(obj).forEach(k => sampleKeys.add(k));
      if (obj.type) stepTypes.add(obj.type);
      if (obj.model) modelsFound.add(obj.model);
      if (obj.model_name) modelsFound.add(obj.model_name);
      if (obj.content && typeof obj.content === 'object') {
        if (obj.content.model) modelsFound.add(obj.content.model);
      }
      
      // Print first 5 steps raw structure overview
      if (i < 3) {
        console.log(`\n--- Step ${i} ---`);
        console.log(JSON.stringify(obj, null, 2).substring(0, 500));
      }
    } catch (e) {}
  }

  console.log('\nTop-level keys found in transcript steps:', Array.from(sampleKeys));
  console.log('Step types found:', Array.from(stepTypes));
  console.log('Models found in logs:', Array.from(modelsFound));
} else {
  console.log('Transcript file not found.');
}

// Also check global settings or config in ~/.gemini
const geminiDir = path.join(os.homedir(), '.gemini');
console.log('\nSearching for settings/config in:', geminiDir);
if (fs.existsSync(geminiDir)) {
  const walkDir = (dir: string, depth = 0) => {
    if (depth > 2) return;
    try {
      const files = fs.readdirSync(dir, { withFileTypes: true });
      for (const f of files) {
        const full = path.join(dir, f.name);
        if (f.isFile() && (f.name.endsWith('.json') || f.name.endsWith('.config'))) {
          console.log(`  File: ${full}`);
        } else if (f.isDirectory() && !f.name.startsWith('.')) {
          walkDir(full, depth + 1);
        }
      }
    } catch (e) {}
  };
  walkDir(geminiDir);
}
