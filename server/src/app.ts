import express, { static as serveStatic } from 'express';
import path from 'node:path';
import fs from 'node:fs';
import cors from 'cors';
import routes from './routes';
import { errorHandler } from './middleware/errorHandler';

const app = express();

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API health endpoint
app.get('/api/health', (_req, res) => {
  res.json({ success: true, data: { status: 'ok', timestamp: new Date().toISOString() } });
});

// API routes
app.use('/api', routes);

// Frontend static files (set via CLIENT_BUILD_DIR env; default to ./dist in local dev)
// Skipped when the build output doesn't exist (e.g. `npm run dev`, where Vite serves the frontend)
const clientBuildDir = process.env.CLIENT_BUILD_DIR || path.join(__dirname, 'dist');
const indexHtml = path.join(clientBuildDir, 'index.html');
export const servesFrontend = fs.existsSync(indexHtml);
if (servesFrontend) {
  // Serve static assets
  app.use(serveStatic(clientBuildDir));
  // SPA fallback: serve index.html for non-asset, non-API paths
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api')) return next();
    res.sendFile(indexHtml);
  });
}

app.use(errorHandler);

export default app;