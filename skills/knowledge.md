# Knowledge File — Sticky Note Application

Everything learned while building this app. Read this before touching anything.

---

## What was built

A macOS floating sticky-note app using **Electron + React + TypeScript**.
Each note is its own frameless window that floats over ALL macOS Spaces/Desktops,
exactly like Google Meet's floating video — you can switch apps, switch desktops,
go fullscreen in another app, and the note stays visible.

---

## The two magic lines

```ts
win.setAlwaysOnTop(true, 'floating')
win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
```

These go in the main process when creating each note window. Without both of these,
the note either hides behind other apps or disappears when you switch Space.

---

## Tech stack

| Layer | Package | Version |
|---|---|---|
| Desktop shell | `electron` | `35.7.5` |
| Build/dev server | `electron-vite` | `3.1.0` |
| Bundler | `vite` | `5.4.21` |
| UI | `react` + `react-dom` | `19.x` |
| Types | TypeScript | `6.0.3` |
| Packaging | `electron-builder` | `26.x` |

**Why these specific versions (not latest):**
- `electron-vite@5` broke `require('electron')` resolution — use `@3`
- `electron@42` + `electron-vite@5` had a Rollup interop bug — use `@35`
- `@electron-toolkit/*` v4 crashes on Electron 42 with `app.isPackaged` undefined — removed entirely, use native Electron APIs

---

## Critical bug that was hit (and solved)

### Symptom
```
TypeError: Cannot read properties of undefined (reading 'whenReady')
```
`electron.app` was `undefined` in the main process.

### Root cause
`ELECTRON_RUN_AS_NODE=1` was set in the shell environment.
When this flag is set, Electron runs as plain Node.js — `require('electron')`
returns the npm package path string (`"/path/to/Electron.app/..."`)
instead of the Electron built-in API.

### Fix
```json
"dev": "cross-env ELECTRON_RUN_AS_NODE= electron-vite dev"
```
`cross-env ELECTRON_RUN_AS_NODE=` forces the variable to be cleared/empty
before launching, regardless of what the parent shell has set.

### How to detect this bug again
```bash
echo $ELECTRON_RUN_AS_NODE   # should be empty
```

---

## Architecture

```
src/
  main/index.ts       ← Electron main process (Node.js side)
                         - Creates note windows
                         - Reads/writes notes.json
                         - Registers global shortcut ⌘⇧N
                         - Sets up tray icon
                         - Handles all IPC calls

  preload/index.ts    ← Context bridge
                         - Exposes noteApi to renderer safely
                         - Uses contextBridge.exposeInMainWorld

  renderer/
    index.html        ← Entry HTML
    src/
      main.tsx        ← React entry point
      App.tsx         ← Single note UI component
      index.css       ← All styling
      env.d.ts        ← TypeScript types for window.noteApi
```

### Data flow

```
User types → App.tsx debounces 400ms → window.noteApi.update()
          → preload bridges to main via IPC
          → main writes to notes.json
          → next app launch reads notes.json → restores all windows
```

### Note persistence
Notes are stored at:
```
~/Library/Application Support/sticky-note-application/notes.json
```
Plain JSON array. Each note stores: `id, content, color, x, y, width, height, createdAt, updatedAt`.

---

## Window setup (important details)

```ts
new BrowserWindow({
  frame: false,          // no native title bar
  transparent: true,     // allows CSS border-radius + shadow
  alwaysOnTop: true,     // above all other apps
  resizable: true,       // native Electron resize handles
  skipTaskbar: true,     // don't show in Dock
  hasShadow: true,       // macOS shadow
})
```

`transparent: true` is required for the rounded corners to work.
Without it, the window has a hard rectangular edge.

### Drag without a frame
```css
.drag    { -webkit-app-region: drag; }
.no-drag { -webkit-app-region: no-drag; }
```
Apply `.drag` to the header. Apply `.no-drag` to all buttons inside the header,
and to the textarea. Without `.no-drag` on the textarea, clicking it drags the window.

---

## Color palette

```ts
const COLORS = {
  yellow: { bg: '#FFFDE7', header: '#FFF176', dot: '#F9A825', text: '#4E342E' },
  green:  { bg: '#F1F8E9', header: '#C5E1A5', dot: '#558B2F', text: '#1B5E20' },
  pink:   { bg: '#FCE4EC', header: '#F48FB1', dot: '#C2185B', text: '#880E4F' },
  blue:   { bg: '#E3F2FD', header: '#90CAF9', dot: '#1565C0', text: '#0D47A1' },
  purple: { bg: '#F3E5F5', header: '#CE93D8', dot: '#6A1B9A', text: '#4A148C' },
  orange: { bg: '#FFF8E1', header: '#FFD54F', dot: '#E65100', text: '#BF360C' },
}
```

---

## IPC API (preload ↔ main)

| Channel | Args | Returns | What it does |
|---|---|---|---|
| `note:get` | `id` | `Note \| null` | Load note data by ID |
| `note:update` | `id, Partial<Note>` | `Note \| null` | Save changes |
| `note:delete` | `id` | `void` | Delete note + close window |
| `note:create` | — | `void` | Create new note window |
| `note:minimize` | — | `void` | Minimize the calling window |

---

## How to add features quickly

### Rich text / markdown
```bash
npm install @tiptap/react @tiptap/starter-kit --legacy-peer-deps
```
Replace the `<textarea>` in App.tsx with a Tiptap editor.

### Reminders / notifications
```ts
import { Notification } from 'electron'
new Notification({ title: 'Reminder', body: note.content.slice(0, 60) }).show()
```

### Auto-launch on login
```ts
app.setLoginItemSettings({ openAtLogin: true })
```
Add to main process after `app.whenReady()`.

### Pin/unpin toggle (stop floating)
```ts
win.setAlwaysOnTop(!win.isAlwaysOnTop(), 'floating')
win.setVisibleOnAllWorkspaces(!win.isVisibleOnAllWorkspaces())
```

### Dark mode
Listen to `nativeTheme.themeSource` changes and send to renderer via IPC.

---

## Commands

| Command | What it does |
|---|---|
| `npm run dev` | Start with hot reload |
| `npm run build` | Production build |
| `npm run package:mac` | Build + package as `.dmg` installer |
| Double-click `Start Sticky Notes.command` | Open app without terminal |
