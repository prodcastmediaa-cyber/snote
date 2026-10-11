import { app, BrowserWindow, ipcMain, Tray, Menu, globalShortcut, nativeImage, screen, dialog } from 'electron'
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
  open: boolean   // legacy field from the save-button experiment; always true in v1
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
  try {
    // default open:true for notes created before this field existed
    return (JSON.parse(readFileSync(p, 'utf-8')) as Partial<Note>[])
      .map(n => ({ open: true, ...n } as Note))
  } catch { return [] }
}

function writeNotes(notes: Note[]): void {
  writeFileSync(storePath(), JSON.stringify(notes, null, 2))
}

// ─── State ───────────────────────────────────────────────────────────────────

const noteWindows  = new Map<string, BrowserWindow>()  // noteId → window
const windowToNote = new Map<BrowserWindow, string>()  // window → noteId (reverse)
const contentCache = new Map<string, string>()          // noteId → latest HTML (for emergency saves)
let tray: Tray | null = null
const isDev = process.env['NODE_ENV'] === 'development' || !app.isPackaged

// ─── Tray rebuild ─────────────────────────────────────────────────────────────

function rebuildTray(): void {
  if (!tray) return
  tray.setContextMenu(Menu.buildFromTemplate([
    { label: 'New Note',       accelerator: 'CmdOrCtrl+Shift+N', click: createNote },
    { type: 'separator' },
    { label: 'Show All',       click: () => noteWindows.forEach(w => { if (!w.isDestroyed()) { w.show(); w.focus() } }) },
    { label: 'Hide All',       click: () => noteWindows.forEach(w => { if (!w.isDestroyed()) w.hide() }) },
    { type: 'separator' },
    { label: 'Open at Login',  type: 'checkbox', checked: app.getLoginItemSettings().openAtLogin,
      click: item => { app.setLoginItemSettings({ openAtLogin: item.checked }); rebuildTray() } },
    { type: 'separator' },
    { label: 'Quit',           click: () => app.quit() },
  ]))
}

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

  // Float above ALL macOS Spaces/Desktops
  win.setAlwaysOnTop(true, 'floating')
  win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  // Explicitly re-assert movable — macOS can strip it from floating+all-spaces windows
  win.setMovable(true)

  if (isDev && process.env['ELECTRON_RENDERER_URL']) {
    win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}?noteId=${note.id}`)
  } else {
    win.loadFile(join(__dirname, '../renderer/index.html'), { query: { noteId: note.id } })
  }

  win.once('ready-to-show', () => {
    win.show()
    // Re-apply after show — macOS sometimes resets these on first paint
    win.setAlwaysOnTop(true, 'floating')
    win.setMovable(true)
  })

  // Save geometry on move/resize
  const saveGeometry = (): void => {
    if (win.isDestroyed()) return
    const [x, y] = win.getPosition()
    const [w, h] = win.getSize()
    writeNotes(readNotes().map(n => n.id === note.id ? { ...n, x, y, width: w, height: h } : n))
  }
  win.on('moved',   saveGeometry)
  win.on('resized', saveGeometry)

  noteWindows.set(note.id, win)
  windowToNote.set(win, note.id)
  win.on('closed', () => {
    noteWindows.delete(note.id)
    windowToNote.delete(win)
  })

  return win
}

// ─── Note CRUD ───────────────────────────────────────────────────────────────

function createNote(): void {
  const { workAreaSize } = screen.getPrimaryDisplay()
  const existing = readNotes()
  const offset   = (existing.length % 12) * 22

  const note: Note = {
    id: randomUUID(),
    content: '',
    color: 'yellow',
    open: true,
    x: Math.min(80 + offset, workAreaSize.width - 300),
    y: Math.min(80 + offset, workAreaSize.height - 320),
    width: 280,
    height: 300,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  }

  writeNotes([...existing, note])
  createNoteWindow(note)
  rebuildTray()
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
  contentCache.delete(id)
  writeNotes(readNotes().filter(n => n.id !== id))
  const win = noteWindows.get(id)
  if (win && !win.isDestroyed()) win.destroy()
  noteWindows.delete(id)
  rebuildTray()
}

// ─── Tray setup ──────────────────────────────────────────────────────────────

function setupTray(): void {
  const icon = nativeImage.createFromDataURL(
    'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg=='
  )
  tray = new Tray(icon)
  tray.setTitle('📝')
  tray.setToolTip('SNOTE')
  rebuildTray()
}

// ─── App lifecycle ───────────────────────────────────────────────────────────

// One SNOTE process; launching it again just sticks up a fresh note
if (!app.requestSingleInstanceLock()) app.exit(0)
app.on('second-instance', () => createNote())

app.whenReady().then(() => {
  app.setAppUserModelId('com.manvendra.snote')

  setupTray()
  globalShortcut.register('CommandOrControl+Shift+N', createNote)

  const saved = readNotes().filter(n => n.open)
  writeNotes(saved)
  if (saved.length === 0) createNote()
  else saved.forEach(note => createNoteWindow(note))

  // ── IPC handlers ──────────────────────────────────────────────────────────

  ipcMain.handle('note:get',    (_, id)      => readNotes().find(n => n.id === id) ?? null)
  ipcMain.handle('note:update', (_, id, upd) => updateNote(id, upd))
  ipcMain.handle('note:delete', (_, id)      => deleteNote(id))
  ipcMain.handle('note:create', ()           => createNote())
  ipcMain.handle('note:minimize', (e)        => BrowserWindow.fromWebContents(e.sender)?.minimize())

  // Custom drag — bypasses OS movability restrictions on floating+all-spaces windows
  ipcMain.on('note:drag', (e, dx: number, dy: number) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win || win.isDestroyed()) return
    const [x, y] = win.getPosition()
    win.setPosition(x + dx, y + dy, false)
  })

  // Content cache — renderer sends this on every keystroke so main always has latest
  ipcMain.on('note:cache', (_, id: string, html: string) => {
    contentCache.set(id, html)
  })

  // v1 has no save button: closing a note tears it up for good
  ipcMain.handle('note:close-requested', async (e) => {
    const win = BrowserWindow.fromWebContents(e.sender)
    if (!win) return
    const id = windowToNote.get(win)
    if (!id) return

    const { response } = await dialog.showMessageBox(win, {
      type:      'question',
      buttons:   ['Tear it up', 'Not yet'],
      defaultId: 0,
      cancelId:  1,
      title:     'Done?',
      message:   'Did you actually do the thing?',
      detail:    'There is no save button. On purpose. Tearing it up deletes it forever.',
    })

    if (response === 0) deleteNote(id)
  })

  app.on('activate', () => { if (noteWindows.size === 0) createNote() })
})

// Flush all cached content before the process exits
app.on('before-quit', () => {
  if (contentCache.size === 0) return
  const notes = readNotes()
  writeNotes(notes.map(n => {
    const cached = contentCache.get(n.id)
    return cached !== undefined ? { ...n, content: cached, updatedAt: Date.now() } : n
  }))
})

app.on('will-quit',         () => globalShortcut.unregisterAll())
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit() })
