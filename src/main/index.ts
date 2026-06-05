import { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, nativeImage, screen } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'

interface Note {
  id: string
  content: string
  color: string
  x: number
  y: number
  width: number
  height: number
  createdAt: number
  updatedAt: number
}

// ─── Persistence ────────────────────────────────────────────────────────────

function storePath(): string {
  return join(app.getPath('userData'), 'notes.json')
}

function readNotes(): Note[] {
  const path = storePath()
  if (!existsSync(path)) return []
  try {
    return JSON.parse(readFileSync(path, 'utf-8'))
  } catch {
    return []
  }
}

function writeNotes(notes: Note[]): void {
  writeFileSync(storePath(), JSON.stringify(notes, null, 2))
}

// ─── State ───────────────────────────────────────────────────────────────────

const noteWindows = new Map<string, BrowserWindow>()
let tray: Tray | null = null

// ─── Window factory ──────────────────────────────────────────────────────────

function createNoteWindow(note: Note): BrowserWindow {
  const win = new BrowserWindow({
    width: note.width,
    height: note.height,
    x: note.x,
    y: note.y,
    minWidth: 200,
    minHeight: 160,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    resizable: true,
    movable: true,
    skipTaskbar: true,
    hasShadow: true,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  // The two lines that make it float over ALL macOS Spaces / Desktops
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?noteId=${note.id}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { noteId: note.id }
    })
  }

  win.once('ready-to-show', () => win.show())

  // Persist geometry on every move/resize
  const saveGeometry = (): void => {
    if (win.isDestroyed()) return
    const [x, y] = win.getPosition()
    const [width, height] = win.getSize()
    const notes = readNotes()
    writeNotes(notes.map(n => (n.id === note.id ? { ...n, x, y, width, height } : n)))
  }
  win.on('moved', saveGeometry)
  win.on('resized', saveGeometry)

  noteWindows.set(note.id, win)
  win.on('closed', () => noteWindows.delete(note.id))

  return win
}

// ─── Note CRUD ───────────────────────────────────────────────────────────────

function createNote(): void {
  const { workAreaSize } = screen.getPrimaryDisplay()
  const existing = readNotes()
  const offset = (existing.length % 10) * 24

  const note: Note = {
    id: randomUUID(),
    content: '',
    color: 'yellow',
    x: Math.min(100 + offset, workAreaSize.width - 300),
    y: Math.min(100 + offset, workAreaSize.height - 300),
    width: 280,
    height: 300,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }

  writeNotes([...existing, note])
  createNoteWindow(note)
}

function updateNote(id: string, updates: Partial<Note>): Note | null {
  const notes = readNotes()
  let updated: Note | null = null
  const next = notes.map(n => {
    if (n.id !== id) return n
    updated = { ...n, ...updates, updatedAt: Date.now() }
    return updated
  })
  if (updated) writeNotes(next)
  return updated
}

function deleteNote(id: string): void {
  writeNotes(readNotes().filter(n => n.id !== id))
  const win = noteWindows.get(id)
  if (win && !win.isDestroyed()) win.destroy()
  noteWindows.delete(id)
}

// ─── Tray ────────────────────────────────────────────────────────────────────

function setupTray(): void {
  // Minimal template icon (transparent 1×1 PNG) — emoji title shows in menu bar
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  )
  tray = new Tray(icon)
  tray.setTitle('📝')
  tray.setToolTip('Sticky Notes')

  tray.setContextMenu(
    Menu.buildFromTemplate([
      { label: 'New Note', accelerator: 'CmdOrCtrl+Shift+N', click: createNote },
      { type: 'separator' },
      {
        label: 'Show All Notes',
        click: () => noteWindows.forEach(w => { if (!w.isDestroyed()) { w.show(); w.focus() } })
      },
      {
        label: 'Hide All Notes',
        click: () => noteWindows.forEach(w => { if (!w.isDestroyed()) w.hide() })
      },
      { type: 'separator' },
      { label: 'Quit Sticky Notes', click: () => app.quit() }
    ])
  )
}

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  electronApp.setAppUserModelId('com.manvendra.stickynotes')
  app.on('browser-window-created', (_, w) => optimizer.watchWindowShortcuts(w))

  setupTray()

  globalShortcut.register('CommandOrControl+Shift+N', createNote)

  const saved = readNotes()
  if (saved.length === 0) {
    createNote()
  } else {
    saved.forEach(note => createNoteWindow(note))
  }

  // ─── IPC handlers ─────────────────────────────────────────────────────────

  ipcMain.handle('note:get', (_, id: string) =>
    readNotes().find(n => n.id === id) ?? null
  )

  ipcMain.handle('note:update', (_, id: string, updates: Partial<Note>) =>
    updateNote(id, updates)
  )

  ipcMain.handle('note:delete', (_, id: string) => deleteNote(id))

  ipcMain.handle('note:create', () => createNote())

  ipcMain.handle('note:minimize', (event) => {
    BrowserWindow.fromWebContents(event.sender)?.minimize()
  })

  app.on('activate', () => {
    if (noteWindows.size === 0) createNote()
  })
})

app.on('will-quit', () => globalShortcut.unregisterAll())

// Keep app alive in tray even when all note windows are closed
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})
