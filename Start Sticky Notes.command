#!/bin/bash

# Change to the app directory (relative to this script's location)
cd "$(dirname "$0")"

# Clear the flag that breaks Electron's require('electron') resolution
unset ELECTRON_RUN_AS_NODE

# Check Node.js is available
if ! command -v node &>/dev/null; then
  osascript -e 'display alert "Node.js not found" message "Please install Node.js from nodejs.org and try again."'
  exit 1
fi

# Check node_modules exists
if [ ! -d "node_modules" ]; then
  echo "Installing dependencies (first time only)..."
  npm install --legacy-peer-deps
fi

echo "Starting Sticky Notes..."
npm run dev
