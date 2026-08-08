import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

export interface TranscriptStep {
  step_index: number;
  source?: string;
  type?: string;
  status?: string;
  content?: string | any;
  tool_calls?: Array<{
    name?: string;
    summary?: string;
    arguments?: any;
  }>;
  timestamp?: string;
  is_truncated?: boolean;
}

export interface ConversationSession {
  id: string;
  dirPath: string;
  transcriptPath: string;
  lastActivity: Date;
}

export class TranscriptWatcher {
  private activeSessionId: string | null = null;
  private fileWatcher: fs.FSWatcher | null = null;
  private brainWatcher: fs.FSWatcher | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastReadSize = 0;
  private cachedSteps: TranscriptStep[] = [];
  private onUpdateCallbacks: Array<(steps: TranscriptStep[], session: ConversationSession) => void> = [];

  constructor(customSessionId?: string) {
    if (customSessionId) {
      this.activeSessionId = customSessionId;
    }
  }

  public getAntigravityBrainDir(): string {
    const homedir = os.homedir();
    return path.join(homedir, '.gemini', 'antigravity', 'brain');
  }

  public listSessions(): ConversationSession[] {
    const brainDir = this.getAntigravityBrainDir();
    if (!fs.existsSync(brainDir)) {
      return [];
    }

    try {
      const entries = fs.readdirSync(brainDir, { withFileTypes: true });
      const sessions: ConversationSession[] = [];

      for (const entry of entries) {
        if (entry.isDirectory() && entry.name !== 'tempmediaStorage') {
          const sessionDir = path.join(brainDir, entry.name);
          const transcriptPath = path.join(sessionDir, '.system_generated', 'logs', 'transcript.jsonl');
          const logsDir = path.join(sessionDir, '.system_generated', 'logs');
          
          if (fs.existsSync(transcriptPath)) {
            try {
              const tStats = fs.statSync(transcriptPath);
              let maxTime = Math.max(tStats.mtime.getTime(), tStats.atime.getTime());

              // Also check logs folder & session dir timestamps for tab opens/reads
              if (fs.existsSync(logsDir)) {
                const lStats = fs.statSync(logsDir);
                maxTime = Math.max(maxTime, lStats.mtime.getTime(), lStats.atime.getTime());
              }

              const sStats = fs.statSync(sessionDir);
              maxTime = Math.max(maxTime, sStats.mtime.getTime(), sStats.atime.getTime());

              sessions.push({
                id: entry.name,
                dirPath: sessionDir,
                transcriptPath,
                lastActivity: new Date(maxTime)
              });
            } catch (e) {
              // ignore inaccessible files
            }
          }
        }
      }

      // Sort by latest activity (mtime or atime)
      return sessions.sort((a, b) => b.lastActivity.getTime() - a.lastActivity.getTime());
    } catch (e) {
      return [];
    }
  }

  public getActiveSession(): ConversationSession | null {
    const sessions = this.listSessions();
    if (sessions.length === 0) {
      return null;
    }

    if (this.activeSessionId) {
      const matched = sessions.find(s => s.id === this.activeSessionId);
      if (matched) {
        return matched;
      }
    }

    // Default to most recently accessed/modified session
    return sessions[0];
  }

  public setActiveSessionId(sessionId: string) {
    if (this.activeSessionId !== sessionId) {
      this.activeSessionId = sessionId;
      this.cachedSteps = [];
      this.lastReadSize = 0;
      this.restartWatch();
    }
  }

  public checkForActiveSessionSwitch(): boolean {
    const sessions = this.listSessions();
    if (sessions.length > 0) {
      const newestSession = sessions[0];
      if (this.activeSessionId !== newestSession.id) {
        // If another session was opened or updated more recently, auto switch to it!
        this.setActiveSessionId(newestSession.id);
        return true;
      }
    }
    return false;
  }

  public onUpdate(callback: (steps: TranscriptStep[], session: ConversationSession) => void) {
    this.onUpdateCallbacks.push(callback);
  }

  public startWatching() {
    this.restartWatch();
    this.startBrainDirWatch();
  }

  public stopWatching() {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }
    if (this.brainWatcher) {
      this.brainWatcher.close();
      this.brainWatcher = null;
    }
    if (this.pollInterval) {
      clearInterval(this.pollInterval);
      this.pollInterval = null;
    }
  }

  public readActiveSteps(): { steps: TranscriptStep[]; session: ConversationSession | null } {
    const session = this.getActiveSession();
    if (!session || !fs.existsSync(session.transcriptPath)) {
      return { steps: [], session: null };
    }

    try {
      const stats = fs.statSync(session.transcriptPath);
      if (stats.size === this.lastReadSize && this.cachedSteps.length > 0) {
        return { steps: this.cachedSteps, session };
      }

      const rawContent = fs.readFileSync(session.transcriptPath, 'utf-8');
      const lines = rawContent.split(/\r?\n/).filter(line => line.trim().length > 0);
      const steps: TranscriptStep[] = [];

      for (const line of lines) {
        try {
          steps.push(JSON.parse(line));
        } catch (err) {
          // ignore corrupted lines
        }
      }

      this.lastReadSize = stats.size;
      this.cachedSteps = steps;
      return { steps, session };
    } catch (error) {
      return { steps: this.cachedSteps, session };
    }
  }

  private startBrainDirWatch() {
    const brainDir = this.getAntigravityBrainDir();
    if (fs.existsSync(brainDir)) {
      try {
        this.brainWatcher = fs.watch(brainDir, { recursive: true }, () => {
          // Whenever any session folder or log is touched in brainDir, check for session tab switch
          this.checkForActiveSessionSwitch();
        });
      } catch (e) {
        // recursive watch may not be supported on all OS platforms
      }
    }
  }

  private restartWatch() {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
    }

    const session = this.getActiveSession();
    if (!session || !fs.existsSync(session.transcriptPath)) {
      return;
    }

    this.notifyListeners();

    let debounceTimeout: NodeJS.Timeout | null = null;
    const triggerUpdate = () => {
      if (debounceTimeout) clearTimeout(debounceTimeout);
      debounceTimeout = setTimeout(() => {
        this.notifyListeners();
      }, 200);
    };

    try {
      this.fileWatcher = fs.watch(session.transcriptPath, (eventType) => {
        if (eventType === 'change' || eventType === 'rename') {
          triggerUpdate();
        }
      });
    } catch (e) {
      console.error('Failed fs.watch on transcript file:', e);
    }

    // Polling interval checking every 1s for both tab switches & file size changes
    if (!this.pollInterval) {
      this.pollInterval = setInterval(() => {
        const switched = this.checkForActiveSessionSwitch();
        if (!switched && session) {
          try {
            const stats = fs.statSync(session.transcriptPath);
            if (stats.size !== this.lastReadSize) {
              triggerUpdate();
            }
          } catch (e) {}
        }
      }, 1000);
    }
  }

  private notifyListeners() {
    const { steps, session } = this.readActiveSteps();
    if (session) {
      for (const callback of this.onUpdateCallbacks) {
        try {
          callback(steps, session);
        } catch (e) {
          console.error('Error in transcript update listener:', e);
        }
      }
    }
  }
}
