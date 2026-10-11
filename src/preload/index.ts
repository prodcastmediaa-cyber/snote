import { contextBridge, ipcRenderer } from 'electron'

contextBridge.exposeInMainWorld('noteApi', {
  get:            (id: string)                                   => ipcRenderer.invoke('note:get', id),
  update:         (id: string, updates: Record<string, unknown>) => ipcRenderer.invoke('note:update', id, updates),
  delete:         (id: string)                                   => ipcRenderer.invoke('note:delete', id),
  create:         ()                                             => ipcRenderer.invoke('note:create'),
  minimize:       ()                                             => ipcRenderer.invoke('note:minimize'),
  closeRequested: ()                                             => ipcRenderer.invoke('note:close-requested'),
  // One-way fast calls (no await needed)
  drag:           (dx: number, dy: number)                       => ipcRenderer.send('note:drag', dx, dy),
  cache:          (id: string, html: string)                     => ipcRenderer.send('note:cache', id, html),
})
