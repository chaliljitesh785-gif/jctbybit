import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import apiApp from './api/index.ts';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Mount Vercel-compatible API routes
  app.use(apiApp);

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { 
        middlewareMode: true,
        hmr: false 
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on port ${PORT}`);
    
    // Render Keep-Alive Mechanism
    // This self-pings the application every 55 seconds to prevent cold starts.
    const url = process.env.RENDER_EXTERNAL_URL || `http://localhost:${PORT}`;
    setInterval(async () => {
      try {
        await fetch(`${url}/api/health`);
        console.log(`Keep-alive ping sent to ${url}/api/health`);
      } catch (err) {
        console.error('Keep-alive ping failed:', err);
      }
    }, 55000); // 55 seconds
  });
}

startServer();
