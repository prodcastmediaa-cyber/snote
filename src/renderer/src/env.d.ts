export interface NoteData {
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

interface NoteApi {
  get:      (id: string)                              => Promise<NoteData | null>
  update:   (id: string, updates: Partial<NoteData>) => Promise<NoteData | null>
  delete:   (id: string)                              => Promise<void>
  create:   ()                                        => Promise<void>
  minimize: ()                                        => Promise<void>
}

declare interface Window {
  noteApi: NoteApi
}
