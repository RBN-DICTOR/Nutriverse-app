// Express server entrypoint for local dev (Vite middleware) and standalone production (/dist).
import express from 'express';
import path from 'node:path';
import app from './server/app';

const PORT = Number(process.env.PORT) || 3000;

async function start() {
  if (process.env.NODE_ENV === 'production') {
    const dist = path.resolve(process.cwd(), 'dist');
    app.use(express.static(dist));
    app.use((_req, res) => res.sendFile(path.join(dist, 'index.html')));
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  app.listen(PORT, '0.0.0.0', () => console.log(`NutriVerse on http://localhost:${PORT}`));
}

if (!process.env.VERCEL) {
  start();
}

export default app;
