import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const settingsFiles = [
  path.join(os.homedir(), '.gemini', 'settings.json'),
  path.join(os.homedir(), '.gemini', 'state.json'),
  path.join(os.homedir(), '.gemini', 'config', 'config.json'),
  path.join(os.homedir(), '.gemini', 'antigravity-cli', 'settings.json')
];

for (const file of settingsFiles) {
  console.log(`\n=== File: ${file} ===`);
  if (fs.existsSync(file)) {
    try {
      const content = fs.readFileSync(file, 'utf-8');
      console.log(content.substring(0, 1000));
    } catch (e) {
      console.error('Error reading:', e);
    }
  } else {
    console.log('File does not exist.');
  }
}
