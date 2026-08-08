# Antigravity Active Context Tracker Extension ⚡

[![VS Code Extension](https://img.shields.io/badge/VS%20Code-Extension-blue.svg)](https://code.visualstudio.com/)
[![Version](https://img.shields.io/badge/version-0.3.0-purple.svg)](https://github.com/kurtapexlegends-bot/Antigravity-Context-Tracker)

A high-precision, real-time context tracking, visualization, and non-lossy compaction extension built for **Google Antigravity IDE** and **Visual Studio Code**.

---

## 🌟 Key Features

- **⚡ Live Real-Time Context Stream**: Automatically watches active Antigravity session transcript logs (`transcript.jsonl`) on disk and updates token usage without manual refreshing.
- **⚡ In-Place Context Compaction (Option A)**:
  - Compacts raw transcript history directly on disk into a high-density, non-lossy checkpoint.
  - Reclaims **80%–95% of consumed context tokens** on your active conversation tab.
  - Preserves 100% of user directives, file paths, code symbols, technical choices, and current state.
  - Automatically creates a safety backup (`transcript.jsonl.bak`) before rewriting.
- **⚠️ Hallucination Risk Alert Gauge**:
  - **🟢 Low Risk (0–50%)**: Optimal recall & sharp reasoning precision.
  - **🟡 Moderate Risk (50–70%)**: Attention density dilutes (>500k tokens).
  - **🔴 High Risk (>70%)**: Context saturation threshold indicator.
- **📊 Interactive Sidebar Dashboard**:
  - Context capacity gauge & multi-segment progress bar.
  - Active workspace file references with click-to-view paths.
  - Tool execution frequency breakdown (`write_to_file`, `run_command`, `view_file`, etc.).
  - Chronological step timeline feed.

---

## 🚀 Installation

### Option A: Install from VSIX Package
1. Download `antigravity-context-tracker-0.3.0.vsix`.
2. Open terminal and run:
   ```powershell
   code --install-extension antigravity-context-tracker-0.3.0.vsix
   ```
3. Or in VS Code / Antigravity IDE, go to **Extensions (`Ctrl+Shift+X`)** -> **`...`** -> **Install from VSIX...**

### Option B: Run from Source
1. Clone this repository:
   ```bash
   git clone https://github.com/kurtapexlegends-bot/Antigravity-Context-Tracker.git
   cd Antigravity-Context-Tracker
   ```
2. Install dependencies & compile:
   ```bash
   npm install
   npm run compile
   ```
3. Press `F5` in VS Code to launch the Extension Development Host.

---

## 🛠️ Extension Commands

| Command | Title | Description |
| :--- | :--- | :--- |
| `antigravity-context.compactSession` | **Compact Current Conversation Tab (In-Place)** | Rewrites active transcript log on disk into a compacted checkpoint. |
| `antigravity-context.refresh` | **Refresh Active Context** | Force re-analyzes transcript log on disk. |
| `antigravity-context.exportSummary` | **Export Context Digest** | Exports session digest to a Markdown document. |
| `antigravity-context.selectSession` | **Select Conversation Session** | Switch between past/active sessions in brain store. |

---

## 📄 License
MIT License.
