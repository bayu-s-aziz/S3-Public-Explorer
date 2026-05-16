import express from 'express';
import path from 'path';
import { createServer as createViteServer } from 'vite';
import fs from 'fs/promises';

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // Initialize JSON Database
  const labelsFile = process.env.NODE_ENV === 'production' ? '/tmp/labels.json' : './labels.json';
  let folderLabels: Record<string, string> = {};
  
  try {
    const data = await fs.readFile(labelsFile, 'utf-8');
    folderLabels = JSON.parse(data);
  } catch (error) {
    // If file doesn't exist, start with empty
    folderLabels = {};
  }

  async function saveLabels() {
    try {
      await fs.writeFile(labelsFile, JSON.stringify(folderLabels, null, 2));
    } catch (error) {
      console.error('Error saving labels to file:', error);
    }
  }

  // Labels API
  app.get('/api/labels', async (req, res) => {
    try {
      res.json(folderLabels);
    } catch (error: any) {
      console.error('Error fetching labels:', error);
      res.status(500).json({ error: 'Failed to fetch labels' });
    }
  });

  app.post('/api/labels', async (req, res) => {
    try {
      const { prefix, label } = req.body;
      if (typeof prefix !== 'string' || typeof label !== 'string') {
        return res.status(400).json({ error: 'Invalid input' });
      }
      
      if (!label.trim()) {
        delete folderLabels[prefix];
      } else {
        folderLabels[prefix] = label.trim();
      }
      
      await saveLabels();
      res.json({ success: true });
    } catch (error: any) {
      console.error('Error saving label:', error);
      res.status(500).json({ error: 'Failed to save label' });
    }
  });

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
