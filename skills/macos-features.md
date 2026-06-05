# macOS Feature Reference

Quick reference for features we can add based on the app idea.

## Window Styles
```ts
// Floating note (always on top)
win.setAlwaysOnTop(true, 'floating')

// Frameless window
new BrowserWindow({ frame: false })

// macOS native title bar with traffic lights
new BrowserWindow({ titleBarStyle: 'hiddenInset' })

// Frosted glass / blur effect
new BrowserWindow({ vibrancy: 'under-window' })
```

## System Tray
```ts
import { Tray, Menu } from 'electron'
const tray = new Tray('/path/to/icon.png')
tray.setContextMenu(Menu.buildFromTemplate([...]))
```

## Notifications
```ts
import { Notification } from 'electron'
new Notification({ title: 'Sticky Note', body: 'Reminder!' }).show()
```

## Global Shortcuts
```ts
import { globalShortcut } from 'electron'
globalShortcut.register('CommandOrControl+Shift+N', () => createNewNote())
```

## Auto-launch on Login
```ts
app.setLoginItemSettings({ openAtLogin: true })
```

## Local Storage / Persistence
- Use `electron-store` for JSON-based persistent storage
- Use `fs` (Node.js) for file-based notes
- Use SQLite via `better-sqlite3` for structured data
