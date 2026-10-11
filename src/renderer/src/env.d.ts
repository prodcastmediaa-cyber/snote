export interface NoteData {
  id: string
  content: string
  color: string
  x: number
  y: number
  width: number
  height: number
  open: boolean
  createdAt: number
  updatedAt: number
}

interface NoteApi {
  get:            (id: string)                              => Promise<NoteData | null>
  update:         (id: string, updates: Partial<NoteData>) => Promise<NoteData | null>
  delete:         (id: string)                              => Promise<void>
  create:         ()                                        => Promise<void>
  minimize:       ()                                        => Promise<void>
  closeRequested: ()                                        => Promise<void>
  drag:           (dx: number, dy: number)                  => void
  cache:          (id: string, html: string)                => void
}

declare interface Window {
  noteApi: NoteApi
}
