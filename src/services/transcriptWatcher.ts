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
  private isUserPinnedSession = false;
  private fileWatcher: fs.FSWatcher | null = null;
  private pollInterval: NodeJS.Timeout | null = null;
  private lastReadSize = 0;
  private cachedSteps: TranscriptStep[] = [];
  private onUpdateCallbacks: Array<(steps: TranscriptStep[], session: ConversationSession) => void> = [];

  constructor(customSessionId?: string) {
    if (customSessionId) {
      this.activeSessionId = customSessionId;
      this.isUserPinnedSession = true;
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
          
          if (fs.existsSync(transcriptPath)) {
            try {
              const tStats = fs.statSync(transcriptPath);
              // Use MODIFICATION time (mtime) strictly to avoid flickering caused by background atime scans
              sessions.push({
                id: entry.name,
                dirPath: sessionDir,
                transcriptPath,
                lastActivity: tStats.mtime
              });
            } catch (e) {
              // ignore inaccessible files
            }
          }
        }
      }

      // Sort strictly by modification time (newest write first)
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

    // If user manually selected a session, honor it unless activeSessionId is missing
    if (this.activeSessionId) {
      const matched = sessions.find(s => s.id === this.activeSessionId);
      if (matched) {
        return matched;
      }
    }

    // Default to the most recently modified transcript log (newest mtime)
    this.activeSessionId = sessions[0].id;
    return sessions[0];
  }

  public setActiveSessionId(sessionId: string, userPinned = false) {
    if (this.activeSessionId !== sessionId) {
      this.activeSessionId = sessionId;
      this.isUserPinnedSession = userPinned;
      this.cachedSteps = [];
      this.lastReadSize = 0;
      this.restartWatch();
    }
  }

  public checkForActiveSessionSwitch(): boolean {
    if (this.isUserPinnedSession) {
      return false; // Don't override if user explicitly pinned a session
    }

    const sessions = this.listSessions();
    if (sessions.length > 0) {
      const newestSession = sessions[0];
      // Only switch if the newest session modification time is significantly newer
      if (this.activeSessionId !== newestSession.id) {
        this.activeSessionId = newestSession.id;
        this.cachedSteps = [];
        this.lastReadSize = 0;
        this.restartWatch();
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
  }

  public stopWatching() {
    if (this.fileWatcher) {
      this.fileWatcher.close();
      this.fileWatcher = null;
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
          // ignore incomplete/corrupted lines
        }
      }

      this.lastReadSize = stats.size;
      this.cachedSteps = steps;
      return { steps, session };
    } catch (error) {
      return { steps: this.cachedSteps, session };
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
      }, 250);
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

    if (!this.pollInterval) {
      this.pollInterval = setInterval(() => {
        if (!this.isUserPinnedSession) {
          const switched = this.checkForActiveSessionSwitch();
          if (switched) return;
        }

        const currentSession = this.getActiveSession();
        if (currentSession && fs.existsSync(currentSession.transcriptPath)) {
          try {
            const stats = fs.statSync(currentSession.transcriptPath);
            if (stats.size !== this.lastReadSize) {
              triggerUpdate();
            }
          } catch (e) {}
        }
      }, 1500);
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
