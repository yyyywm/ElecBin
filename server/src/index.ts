import app, { servesFrontend } from './app';
import { initDatabase } from './db/schema';
import { spawnSync } from 'node:child_process';

initDatabase();

function openBrowser(url: string) {
  // Only auto-open when this server actually serves the frontend; in dev the UI is Vite on :5173
  if (!servesFrontend) return;
  let cmd = 'xdg-open';
  if (process.platform === 'win32') {
    cmd = 'start';
    url = `'${url}'`;
    spawnSync(cmd, [url], { shell: true });
  } else if (process.platform === 'darwin') {
    cmd = 'open';
    spawnSync(cmd, [url]);
  } else {
    spawnSync(cmd, [url]);
  }
}

const portArg = process.argv.find((arg) => arg.startsWith('--port='));
let PORT = portArg ? Number(portArg.split('=')[1]) : 3001;

const server = app.listen(PORT, '127.0.0.1', () => {
  const actualPort = (server.address() as { port: number }).port;
  console.log(`Server running on http://localhost:${actualPort}`);
  openBrowser(`http://localhost:${actualPort}/`);
});

server.on('error', (err: { code: string }) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`Port ${PORT} is already in use.`);
    console.error(`Trying to start on a random available port...`);
    server.listen(0, '127.0.0.1', () => {
      const actualPort = (server.address() as { port: number }).port;
      console.log(`Server running on http://localhost:${actualPort}`);
      openBrowser(`http://localhost:${actualPort}/`);
    });
  } else {
    console.error('Server failed to start:', err);
    process.exit(1);
  }
});
