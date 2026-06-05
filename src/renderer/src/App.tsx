import React, { useState, useEffect, useRef, useCallback } from 'react'
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

// ─── Helpers ─────────────────────────────────────────────────────────────────

function isColorKey(v: string): v is ColorKey {
  return v in COLORS
}

function useNoteId(): string | null {
  return new URLSearchParams(window.location.search).get('noteId')
}

// ─── Component ───────────────────────────────────────────────────────────────

export default function App(): React.JSX.Element {
  const noteId = useNoteId()
  const [note, setNote] = useState<NoteData | null>(null)
  const [content, setContent] = useState('')
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Load note on mount
  useEffect(() => {
    if (!noteId) return
    window.noteApi.get(noteId).then(data => {
      if (!data) return
      setNote(data)
      setContent(data.content)
    })
  }, [noteId])

  // Focus textarea once loaded
  useEffect(() => {
    if (note) textareaRef.current?.focus()
  }, [note?.id])

  // Debounced content save
  const scheduleSave = useCallback(
    (value: string) => {
      if (!noteId) return
      if (saveTimer.current) clearTimeout(saveTimer.current)
      saveTimer.current = setTimeout(() => {
        window.noteApi.update(noteId, { content: value })
      }, 400)
    },
    [noteId]
  )

  const handleContent = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setContent(e.target.value)
    scheduleSave(e.target.value)
  }

  const handleColor = async (key: ColorKey) => {
    if (!noteId || !note) return
    setNote(prev => prev ? { ...prev, color: key } : prev)
    await window.noteApi.update(noteId, { color: key })
  }

  const handleDelete = async () => {
    if (!noteId) return
    // Flush pending save before deleting
    if (saveTimer.current) clearTimeout(saveTimer.current)
    await window.noteApi.delete(noteId)
  }

  const handleMinimize = () => window.noteApi.minimize()
  const handleNewNote  = () => window.noteApi.create()

  // ─── Render ───────────────────────────────────────────────────────────────

  const colorKey = note && isColorKey(note.color) ? note.color : 'yellow'
  const palette  = COLORS[colorKey]

  if (!note) {
    return <div className="skeleton" style={{ background: palette.bg }} />
  }

  return (
    <div
      className="note"
      style={{
        '--bg':     palette.bg,
        '--header': palette.header,
        '--text':   palette.text,
      } as React.CSSProperties}
    >
      {/* ── Header / drag handle ── */}
      <div className="header drag">
        {/* Color dots */}
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

        {/* Window controls */}
        <div className="controls no-drag">
          <button className="btn btn--min" onClick={handleMinimize} title="Minimize">
            <svg width="10" height="2" viewBox="0 0 10 2"><rect width="10" height="2" rx="1" fill="currentColor"/></svg>
          </button>
          <button className="btn btn--close" onClick={handleDelete} title="Delete note">
            <svg width="10" height="10" viewBox="0 0 10 10">
              <line x1="1" y1="1" x2="9" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
              <line x1="9" y1="1" x2="1" y2="9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round"/>
            </svg>
          </button>
        </div>
      </div>

      {/* ── Body ── */}
      <textarea
        ref={textareaRef}
        className="body no-drag"
        value={content}
        onChange={handleContent}
        placeholder="Write your note…"
        spellCheck
        style={{ color: palette.text }}
      />

      {/* ── Footer ── */}
      <div className="footer no-drag">
        <button className="new-btn" onClick={handleNewNote} title="New note  ⌘⇧N">
          + New Note
        </button>
        <span className="hint">⌘⇧N</span>
      </div>
    </div>
  )
}
