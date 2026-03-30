# Claude Session Manager

A desktop GUI for browsing, searching, and resuming your [Claude Code](https://claude.com/claude-code) sessions.

Built with **Tauri v2** (Rust backend) + **React** + **TypeScript** + **Tailwind CSS**.

## Features

- **Project-based session grouping** — Automatically groups sessions by project directory
- **Conversation preview** — See message history with highlighted tool usage
- **Keyboard-first navigation** — `j/k` to navigate, `⌘Enter` to resume, `/` to search
- **Terminal resume** — Open any session directly in Terminal with `claude --resume`
- **Tags & bookmarks** — Organize sessions with custom tags and bookmarks
- **Fast Rust parser** — JSONL parsing in Rust for large session files (up to 30MB+)
- **Dark mode** — Designed for developers who live in the terminal

## Installation

### Prerequisites

- [Rust](https://rustup.rs/) (1.70+)
- [Node.js](https://nodejs.org/) (18+)

### Development

```bash
git clone https://github.com/levit/claude-session-manager.git
cd claude-session-manager
npm install
npm run tauri dev
```

### Build

```bash
npm run tauri build
```

The built app will be in `src-tauri/target/release/bundle/`.

## Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `j` / `↓` | Next session |
| `k` / `↑` | Previous session |
| `⌘K` or `/` | Focus search |
| `⌘Enter` | Resume session in Terminal |
| `Esc` | Clear search |

## Architecture

```
┌─────────────────────────────────────────────┐
│              Tauri v2 App                    │
│  ┌────────────────┐  ┌──────────────────┐   │
│  │  React Frontend │◄─┤  Rust Backend    │   │
│  │                 │  │                  │   │
│  │  - 3-column UI  │  │  - JSONL Parser  │   │
│  │  - Zustand store│  │  - File Scanner  │   │
│  │  - Keyboard nav │  │  - SQLite (tags) │   │
│  │  - Tag manager  │  │  - Shell (resume)│   │
│  └────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────┘
         reads from: ~/.claude/
```

## How It Works

1. **Scanning**: Rust backend scans `~/.claude/projects/` to discover all session JSONL files
2. **Parsing**: Each JSONL file is streamed and parsed in Rust, extracting only the fields needed for display
3. **Indexing**: Sessions are grouped by project, sorted by date, with bookmarks pinned to top
4. **Preview**: When a session is selected, full message history is parsed and sent to the React frontend
5. **Resume**: Uses AppleScript to open a new Terminal window with `claude --resume <sessionId>`

## License

MIT
