import { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, nativeImage, screen } from 'electron'
import { join } from 'path'
import { readFileSync, writeFileSync, existsSync } from 'fs'
import { randomUUID } from 'crypto'

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

// ─── Persistence ─────────────────────────────────────────────────────────────

function storePath(): string {
  return join(app.getPath('userData'), 'notes.json')
}

function readNotes(): Note[] {
  const p = storePath()
  if (!existsSync(p)) return []
  try { return JSON.parse(readFileSync(p, 'utf-8')) } catch { return [] }
}

function writeNotes(notes: Note[]): void {
  writeFileSync(storePath(), JSON.stringify(notes, null, 2))
}

// ─── State ───────────────────────────────────────────────────────────────────

const noteWindows = new Map<string, BrowserWindow>()
let tray: Tray | null = null
const isDev = process.env['NODE_ENV'] === 'development' || !app.isPackaged

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
      contextIsolation: true,
    }
  })

  // The two lines that make it float above ALL macOS Spaces / Desktops
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?noteId=${note.id}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), {
      query: { noteId: note.id }
    })
  }

  win.once('ready-to-show', () => win.show())

  const saveGeometry = (): void => {
    if (win.isDestroyed()) return
    const [x, y] = win.getPosition()
    const [w, h] = win.getSize()
    writeNotes(readNotes().map(n => n.id === note.id ? { ...n, x, y, width: w, height: h } : n))
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
  const offset = (existing.length % 12) * 22

  const note: Note = {
    id: randomUUID(),
    content: '',
    color: 'yellow',
    x: Math.min(80 + offset, workAreaSize.width - 300),
    y: Math.min(80 + offset, workAreaSize.height - 320),
    width: 280,
    height: 300,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  writeNotes([...existing, note])
  createNoteWindow(note)
}

function updateNote(id: string, updates: Partial<Note>): Note | null {
  const notes = readNotes()
  let updated: Note | null = null
  writeNotes(notes.map(n => {
    if (n.id !== id) return n
    updated = { ...n, ...updates, updatedAt: Date.now() }
    return updated
  }))
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
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  )
  tray = new Tray(icon)
  tray.setTitle('📝')
  tray.setToolTip('Sticky Notes')
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'New Note',       accelerator: 'CmdOrCtrl+Shift+N', click: createNote },
    { type: 'separator' },
    { label: 'Show All Notes', click: () => noteWindows.forEach(w => { if (!w.isDestroyed()) { w.show(); w.focus() } }) },
    { label: 'Hide All Notes', click: () => noteWindows.forEach(w => { if (!w.isDestroyed()) w.hide() }) },
    { type: 'separator' },
    { label: 'Quit',           click: () => app.quit() },
  ]))
}

// ─── App lifecycle ───────────────────────────────────────────────────────────

app.whenReady().then(() => {
  app.setAppUserModelId('com.manvendra.stickynotes')

  setupTray()
  globalShortcut.register('CommandOrControl+Shift+N', createNote)

  const saved = readNotes()
  if (saved.length === 0) {
    createNote()
  } else {
    saved.forEach(note => createNoteWindow(note))
  }

  // IPC handlers
  ipcMain.handle('note:get',     (_, id)      => readNotes().find(n => n.id === id) ?? null)
  ipcMain.handle('note:update',  (_, id, upd) => updateNote(id, upd))
  ipcMain.handle('note:delete',  (_, id)      => deleteNote(id))
  ipcMain.handle('note:create',  ()           => createNote())
  ipcMain.handle('note:minimize', (e)         => BrowserWindow.fromWebContents(e.sender)?.minimize())

  app.on('activate', () => { if (noteWindows.size === 0) createNote() })
})

app.on('will-quit',         () => globalShortcut.unregisterAll())
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
