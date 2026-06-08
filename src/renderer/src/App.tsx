import React, { useState, useEffect, useRef, useCallback } from 'react'
import { useEditor, EditorContent } from '@tiptap/react'
import StarterKit from '@tiptap/starter-kit'
import Underline from '@tiptap/extension-underline'
import Highlight from '@tiptap/extension-highlight'
import Placeholder from '@tiptap/extension-placeholder'
import type { NoteData } from './env.d'

// ─── Color palette ───────────────────────────────────────────────────────────

const COLORS = {
  yellow: { bg: '#FFFDE7', header: '#FFF176', dot: '#F9A825', text: '#4E342E' },
  green:  { bg: '#F1F8E9', header: '#C5E1A5', dot: '#558B2F', text: '#1B5E20' },
  pink:   { bg: '#FCE4EC', header: '#F48FB1', dot: '#C2185B', text: '#880E4F' },
  blue:   { bg: '#E3F2FD', header: '#90CAF9', dot: '#1565C0', text: '#0D47A1' },
  purple: { bg: '#F3E5F5', header: '#CE93D8', dot: '#6A1B9A', text: '#4A148C' },
  orange: { bg: '#FFF8E1', header: '#FFD54F', dot: '#E65100', text: '#BF360C' },
} as const

type ColorKey = keyof typeof COLORS

function isColorKey(v: string): v is ColorKey { return v in COLORS }
function useNoteId() { return new URLSearchParams(window.location.search).get('noteId') }

// ─── Toolbar icons ────────────────────────────────────────────────────────────

function BoldIcon()   { return <svg width="12" height="12" viewBox="0 0 12 12"><text x="1" y="10" fontFamily="Georgia,serif" fontSize="12" fontWeight="bold" fill="currentColor">B</text></svg> }
function ItalicIcon() { return <svg width="12" height="12" viewBox="0 0 12 12"><text x="2" y="10" fontFamily="Georgia,serif" fontSize="12" fontStyle="italic" fill="currentColor">I</text></svg> }
function UnderlineIcon() {
  return <svg width="12" height="13" viewBox="0 0 12 13">
    <text x="2" y="10" fontFamily="Georgia,serif" fontSize="11" fill="currentColor">U</text>
    <line x1="1" y1="12.5" x2="11" y2="12.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
  </svg>
}
function StrikeIcon() {
  return <svg width="14" height="12" viewBox="0 0 14 12">
    <text x="2" y="10" fontFamily="Georgia,serif" fontSize="11" fill="currentColor">S</text>
    <line x1="0" y1="6" x2="14" y2="6" stroke="currentColor" strokeWidth="1.5"/>
  </svg>
}
function BulletIcon() {
  return <svg width="14" height="12" viewBox="0 0 14 12" fill="currentColor">
    <circle cx="2" cy="3" r="1.5"/>
    <circle cx="2" cy="7" r="1.5"/>
    <circle cx="2" cy="11" r="1.5"/>
    <rect x="5" y="2" width="9" height="2" rx="1"/>
    <rect x="5" y="6" width="9" height="2" rx="1"/>
    <rect x="5" y="10" width="9" height="2" rx="1"/>
  </svg>
}
function HighlightIcon() {
  return <svg width="14" height="12" viewBox="0 0 14 12" fill="none">
    <rect x="1" y="2" width="12" height="7" rx="1.5" fill="currentColor" opacity="0.35"/>
    <text x="2.5" y="9" fontFamily="Georgia,serif" fontSize="8" fill="currentColor" fontWeight="bold">H</text>
  </svg>
}

// ─── Toolbar ─────────────────────────────────────────────────────────────────

interface ToolbarProps {
  editor: ReturnType<typeof useEditor>
  palette: typeof COLORS[ColorKey]
}

function Toolbar({ editor, palette }: ToolbarProps): React.JSX.Element | null {
  if (!editor) return null

  const btn = (active: boolean, onClick: () => void, title: string, children: React.ReactNode) => (
    <button
      className={`fmt-btn no-drag${active ? ' fmt-btn--active' : ''}`}
      onMouseDown={e => { e.preventDefault(); onClick() }}
      title={title}
      style={active ? { background: 'rgba(0,0,0,0.15)', color: palette.text } : {}}
    >
      {children}
    </button>
  )

  return (
    <div className="toolbar no-drag" style={{ borderColor: 'rgba(0,0,0,0.1)', background: palette.header }}>
      {btn(editor.isActive('bold'),      () => editor.chain().focus().toggleBold().run(),      'Bold (⌘B)',        <BoldIcon/>)}
      {btn(editor.isActive('italic'),    () => editor.chain().focus().toggleItalic().run(),    'Italic (⌘I)',      <ItalicIcon/>)}
      {btn(editor.isActive('underline'), () => editor.chain().focus().toggleUnderline().run(), 'Underline (⌘U)',   <UnderlineIcon/>)}
      {btn(editor.isActive('strike'),    () => editor.chain().focus().toggleStrike().run(),    'Strikethrough',    <StrikeIcon/>)}
      <div className="fmt-sep"/>
      {btn(editor.isActive('bulletList'), () => editor.chain().focus().toggleBulletList().run(), 'Bullet list',   <BulletIcon/>)}
      <div className="fmt-sep"/>
      {btn(editor.isActive('highlight'), () => editor.chain().focus().toggleHighlight().run(), 'Highlight',       <HighlightIcon/>)}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function App(): React.JSX.Element {
  const noteId = useNoteId()
  const [note, setNote]       = useState<NoteData | null>(null)
  const [colorKey, setColorKey] = useState<ColorKey>('yellow')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load note on mount
  useEffect(() => {
    if (!noteId) return
    window.noteApi.get(noteId).then(data => {
      if (!data) return
      setNote(data)
      setColorKey(isColorKey(data.color) ? data.color : 'yellow')
    })
  }, [noteId])

  // Debounced save
  const scheduleSave = useCallback((html: string) => {
    if (!noteId) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(() => {
      window.noteApi.update(noteId, { content: html })
    }, 400)
  }, [noteId])

  const editor = useEditor({
    extensions: [
      StarterKit,
      Underline,
      Highlight.configure({ multicolor: false }),
      Placeholder.configure({ placeholder: 'Write your note…' }),
    ],
    content: '',
    editorProps: {
      attributes: {
        class: 'editor-body no-drag',
        spellcheck: 'true',
      },
    },
    onUpdate: ({ editor }) => scheduleSave(editor.getHTML()),
  })

  // Set content once note loads
  useEffect(() => {
    if (!editor || !note) return
    // Gracefully handle both plain-text and HTML content from older versions
    const html = note.content.startsWith('<') ? note.content : `<p>${note.content}</p>`
    editor.commands.setContent(html, false)
    editor.commands.focus('end')
  }, [editor, note?.id])

  const palette = COLORS[colorKey]

  const handleColor = async (key: ColorKey) => {
    if (!noteId) return
    setColorKey(key)
    setNote(prev => prev ? { ...prev, color: key } : prev)
    await window.noteApi.update(noteId, { color: key })
  }

  const handleDelete  = async () => { if (!noteId) return; if (saveTimer.current) clearTimeout(saveTimer.current); await window.noteApi.delete(noteId) }
  const handleMinimize = () => window.noteApi.minimize()
  const handleNewNote  = () => window.noteApi.create()

  if (!note) return <div className="skeleton" style={{ background: palette.bg }} />

  return (
    <div className="note" style={{ '--bg': palette.bg, '--header': palette.header, '--text': palette.text } as React.CSSProperties}>

      {/* ── Header / drag handle ── */}
      <div className="header drag">
        <div className="colors no-drag">
          {(Object.keys(COLORS) as ColorKey[]).map(key => (
            <button
              key={key}
              className={`dot${colorKey === key ? ' dot--active' : ''}`}
              style={{ background: COLORS[key].dot }}
              onClick={() => handleColor(key)}
              title={key}
            />
          ))}
        </div>
        <div className="controls no-drag">
          <button className="btn btn--min"   onClick={handleMinimize} title="Minimize">
            <svg width="10" height="2" viewBox="0 0 10 2"><rect width="10" height="2" rx="1" fill="currentColor"/></svg>
          </button>
          <button className="btn btn--close" onClick={handleDelete}   title="Delete note">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Formatting toolbar ── */}
      <Toolbar editor={editor} palette={palette} />

      {/* ── Editor body ── */}
      <EditorContent editor={editor} className="editor-wrap no-drag" />

      {/* ── Footer ── */}
      <div className="footer no-drag" style={{ background: palette.header }}>
        <button className="new-btn" onClick={handleNewNote} title="New note  ⌘⇧N">+ New Note</button>
        <span className="hint">⌘⇧N</span>
      </div>
    </div>
  )
}
