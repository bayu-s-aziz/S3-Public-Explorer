import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';

async function startServer() {
  const app = express();
  const PORT = 3000;

  // Proxy API for S3
  app.get('/api/s3', async (req, res) => {
    try {
      const prefix = req.query.prefix || '';
      // Fetch using S3 REST API ListObjectsV2 standard params
      const targetUrl = `https://aws3.unigal.ac.id/ftgenk-storage/?list-type=2&prefix=${encodeURIComponent(prefix as string)}&delimiter=/`;
      
      const response = await fetch(targetUrl);
      const data = await response.text();
      
      if (!response.ok) {
        return res.status(response.status).send(data);
      }
      
      res.header('Content-Type', 'text/xml');
      res.send(data);
    } catch (error: any) {
      console.error('Error fetching S3:', error);
      res.status(500).json({ error: error.message || 'Failed to fetch directory contents' });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // Support SPA routing in production
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
