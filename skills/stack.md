# Tech Stack

## Core
- **Electron** — macOS native app shell, window management, tray, system APIs
- **React 19** — UI layer
- **TypeScript** — type safety across main + renderer
- **Vite** — fast dev server and bundler (via electron-vite)

## Build & Package
- **electron-vite** — unified dev/build for Electron + Vite
- **electron-builder** — packages the app into .dmg / .app

## Electron Toolkit
- **@electron-toolkit/utils** — `is.dev`, `electronApp`, `optimizer`
- **@electron-toolkit/preload** — safe `electronAPI` bridge
- **@electron-toolkit/tsconfig** — shared TS configs

## Commands
| Command | What it does |
|---------|-------------|
| `npm run dev` | Start dev server with hot reload |
| `npm run build` | Build for production |
| `npm run package:mac` | Build + package as .dmg |

## Folder Structure
```
src/
  main/       → Electron main process (Node.js)
  preload/    → Context bridge between main ↔ renderer
  renderer/   → React app (what the user sees)
assets/       → Icons, images
skills/       → This documentation folder
```
