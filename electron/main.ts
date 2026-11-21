import { app, BrowserWindow, ipcMain } from 'electron';
import path from 'node:path';

const APP_DIR = __dirname;
const RESOURCES_DIR = app.isPackaged
  ? path.dirname(APP_DIR)
  : path.join(APP_DIR, '..');

const SERVER_DIR = path.join(RESOURCES_DIR, 'server');
const VIEW_DIR = path.join(RESOURCES_DIR, 'view');
const DEFAULT_PORT = 3001;

// Configure the server environment before requiring it
process.env.CLIENT_BUILD_DIR = VIEW_DIR;
process.env.DB_PATH = path.join(app.getPath('appData'), 'ElecBin', 'inventory.db');

let server: any = null;
let mainWindow: BrowserWindow | null = null;
let actualPort = DEFAULT_PORT;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    title: 'ElecBin',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(APP_DIR, 'preload.js'),
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  mainWindow.loadURL(`http://localhost:${actualPort}/`);
  return mainWindow;
}

async function startServer(): Promise<void> {
  const { initDatabase } = require(path.join(SERVER_DIR, 'db', 'schema')) as {
    initDatabase: () => void;
  };
  initDatabase();

  const { default: expressApp } = require(path.join(SERVER_DIR, 'app')) as {
    default: any;
  };

  return new Promise((resolve, reject) => {
    let srv: any = null;
    srv = expressApp.listen(DEFAULT_PORT, '127.0.0.1');
    srv.on('listening', () => {
      actualPort = (srv.address() as any).port;
      resolve();
    });
    srv.on('error', (err: any) => {
      if (err.code === 'EADDRINUSE') {
        console.error(`Port ${DEFAULT_PORT} in use, trying random port`);
        srv.close();
        srv = expressApp.listen(0, '127.0.0.1');
        srv.on('listening', () => {
          actualPort = (srv.address() as any).port;
          resolve();
        });
      } else {
        reject(err);
      }
    });
    server = srv;
  });
}

app.whenReady().then(async () => {
  try {
    await startServer();
    console.log(`Server on ${actualPort}`);
    createWindow();
  } catch (err) {
    console.error('Failed to start server:', err);
    app.quit();
  }
});

app.on('window-all-closed', () => {
  mainWindow = null;
  server?.close();
  if (process.platform !== 'darwin') app.quit();
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) createWindow();
});

ipcMain.on('app:quit', () => {
  server?.close();
  app.quit();
});
