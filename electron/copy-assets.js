const { cpSync, rmSync } = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..');
const ELECTRON = __dirname;

function run() {
  console.log('[copy-assets] Cleaning electron/server and electron/view...');
  rmSync(path.join(ELECTRON, 'server'), { recursive: true, force: true });
  rmSync(path.join(ELECTRON, 'view'), { recursive: true, force: true });

  console.log('[copy-assets] Copying server/dist -> electron/server...');
  cpSync(path.join(ROOT, 'server', 'dist'), path.join(ELECTRON, 'server'), { recursive: true });

  console.log('[copy-assets] Copying client/dist -> electron/view...');
  cpSync(path.join(ROOT, 'client', 'dist'), path.join(ELECTRON, 'view'), { recursive: true });

  console.log('[copy-assets] Copying server/node_modules -> electron/server/node_modules...');
  cpSync(path.join(ROOT, 'server', 'node_modules'), path.join(ELECTRON, 'server', 'node_modules'), { recursive: true });

  console.log('[copy-assets] Done. Ready to compile electron main.');
}

run();
