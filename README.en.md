# Claude Session Manager

[한국어](./README.md)

A desktop GUI for browsing, searching, and resuming your [Claude Code](https://claude.com/claude-code) sessions.

![Claude Session Manager](./assets/screenshot.svg)

Built with **Tauri v2** (Rust backend) + **React** + **TypeScript** + **Tailwind CSS**.

## Features

- **Project-based session grouping** — Automatically groups sessions by project directory
- **Conversation preview** — See message history with highlighted tool usage
- **Keyboard-first navigation** — `j/k` to navigate, `⌘Enter` to resume, `/` to search
- **Terminal resume** — Open any session directly in iTerm2 with `claude --resume`
- **Tags & bookmarks** — Organize sessions with custom tags and bookmarks
- **6 developer themes** — Material Oceanic, Material Darker, Dracula, One Dark, Night Owl, Ayu Mirage
- **Session name display** — Automatically recognizes session names set via `/rename`
- **Fast Rust parser** — JSONL streaming parser in Rust for large session files (30MB+)
- **In-memory cache** — Instant project switching after initial load

## Installation

### Install via DMG (recommended)

Download the latest DMG from [Releases](https://github.com/nobel6018/claude-session-manager/releases).

> **⚠️ macOS Gatekeeper warning**
>
> Since the app is not signed with an Apple Developer certificate, macOS may show *"damaged and can't be opened"* on first launch.
> Use one of the following methods to resolve this:
>
> **Option 1 — Remove quarantine via Terminal:**
> ```bash
> xattr -cr /Applications/Claude\ Session\ Manager.app
> ```
>
> **Option 2 — Allow in System Settings:**
> `System Settings` → `Privacy & Security` → scroll down to the "unidentified developer" notice → click **"Open Anyway"**

### Prerequisites

- [Rust](https://rustup.rs/) (1.70+)
- [Node.js](https://nodejs.org/) (18+)

### Development

```bash
git clone https://github.com/nobel6018/claude-session-manager.git
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
| `⌘Enter` | Resume session in terminal |
| `⌘R` | Refresh session list |
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
│  │  - Theme picker │  │  - Memory cache  │   │
│  └────────────────┘  └──────────────────┘   │
└─────────────────────────────────────────────┘
         reads from: ~/.claude/
```

## How It Works

1. **Scanning**: Rust backend scans `~/.claude/projects/` to discover all session JSONL files
2. **Parsing**: Each JSONL file is streamed and parsed in Rust, extracting only the fields needed for display
3. **Caching**: All sessions are cached in memory on first load; subsequent requests only filter the cache
4. **Preview**: When a session is selected, full message history is parsed and sent to the React frontend
5. **Resume**: Uses AppleScript to open a new iTerm2 window with `claude --resume <sessionId>`

## License

MIT
