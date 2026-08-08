import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const brainDir = path.join(os.homedir(), '.gemini', 'antigravity', 'brain');
console.log('Inspecting brain directory:', brainDir);

if (fs.existsSync(brainDir)) {
  const entries = fs.readdirSync(brainDir, { withFileTypes: true });
  for (const entry of entries) {
    if (entry.isDirectory()) {
      const sessionDir = path.join(brainDir, entry.name);
      try {
        const stats = fs.statSync(sessionDir);
        const transcriptPath = path.join(sessionDir, '.system_generated', 'logs', 'transcript.jsonl');
        let tMtime = null;
        let tAtime = null;
        if (fs.existsSync(transcriptPath)) {
          const tStats = fs.statSync(transcriptPath);
          tMtime = tStats.mtime;
          tAtime = tStats.atime;
        }

        // List all files/subdirs in session folder to see what changes when switching tabs
        const subFiles = fs.readdirSync(sessionDir);

        console.log(`\nSession: ${entry.name}`);
        console.log(`  Folder mtime: ${stats.mtime.toLocaleString()}`);
        console.log(`  Folder atime: ${stats.atime.toLocaleString()}`);
        console.log(`  Transcript mtime: ${tMtime ? tMtime.toLocaleString() : 'N/A'}`);
        console.log(`  Transcript atime: ${tAtime ? tAtime.toLocaleString() : 'N/A'}`);
        console.log(`  Contents: ${subFiles.join(', ')}`);

        const sysGen = path.join(sessionDir, '.system_generated');
        if (fs.existsSync(sysGen)) {
          const sysFiles = fs.readdirSync(sysGen);
          console.log(`  .system_generated contents: ${sysFiles.join(', ')}`);
        }
      } catch (e) {
        console.error(e);
      }
    }
  }
}
