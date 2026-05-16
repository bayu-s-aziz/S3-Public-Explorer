import express from 'express';
import { execSync } from 'child_process';
console.log('--- SERVER.TS FILE LOADED ---');

// Try to kill anything on port 3000 before we start
try {
  console.log('Attempting to clear port 3000...');
  execSync('npx kill-port 3000');
  console.log('Port 3000 cleared');
} catch (e) {
  console.log('No existing process found on port 3000 or failed to kill');
}

import path from 'path';
import { createServer as createViteServer } from 'vite';
import fs from 'fs/promises';
import axios from 'axios';
import { fileURLToPath } from 'url';

// Simple way that works for both tsx (root) and bundled dist/server.cjs (dist)
const getDistPath = () => {
  if (process.env.NODE_ENV === 'production') {
    // When running from dist/server.cjs, the dist folder is the same folder
    // But usually process.cwd() is the root.
    return path.resolve(process.cwd(), 'dist');
  }
  return path.resolve(process.cwd(), 'dist'); // Same for dev if we want to serve static
};

async function startServer() {
  const app = express();
  // FORCE Port 3000 as required by the environment
  const PORT = 3000;

  console.log('--- SERVER INITIALIZING ---');
  console.log('Node version:', process.version);
  console.log('NODE_ENV:', process.env.NODE_ENV);
  console.log('CWD:', process.cwd());
  console.log('Target PORT:', PORT);

  app.use(express.json());

  // Logging middleware
  app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.url}`);
    next();
  });

  // Initialize JSON Database
  const labelsFile = process.env.NODE_ENV === 'production' ? '/tmp/labels.json' : './labels.json';
  console.log(`Using labels file: ${labelsFile}`);
  let folderLabels: Record<string, string> = {};
  
  try {
    const data = await fs.readFile(labelsFile, 'utf-8');
    folderLabels = JSON.parse(data);
    console.log('Labels loaded successfully');
  } catch (error) {
    console.log('No labels file found or invalid JSON, starting with empty labels');
    folderLabels = {};
  }

  async function saveLabels() {
    try {
      await fs.writeFile(labelsFile, JSON.stringify(folderLabels, null, 2));
      console.log('Labels saved to file');
    } catch (error) {
      console.error('Error saving labels to file:', error);
    }
  }

  // --- API ROUTES ---
  
  app.get('/api/health', (req, res) => {
    res.json({ 
      status: 'ok', 
      time: new Date().toISOString(),
      env: process.env.NODE_ENV,
      node: process.version
    });
  });

  app.get('/ping', (req, res) => {
    res.send('pong');
  });

  app.get('/api/labels', (req, res) => {
    console.log('Handling GET /api/labels');
    res.json(folderLabels);
  });

  app.post('/api/labels', async (req, res) => {
    console.log('Handling POST /api/labels');
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

  app.get('/api/s3', async (req, res) => {
    const prefix = req.query.prefix || '';
    console.log(`Handling GET /api/s3 for prefix: "${prefix}"`);
    
    try {
      const targetUrl = `https://aws3.unigal.ac.id/ftgenk-storage/?list-type=2&prefix=${encodeURIComponent(prefix as string)}&delimiter=/`;
      
      const response = await axios.get(targetUrl, {
        responseType: 'text',
        headers: {
          'Accept': 'application/xml'
        }
      });
      
      res.header('Content-Type', 'text/xml');
      res.send(response.data);
    } catch (error: any) {
      console.error('Error fetching S3 via axios:', error.message);
      if (error.response) {
        res.status(error.response.status).send(error.response.data);
      } else {
        res.status(500).json({ error: 'Failed to fetch directory contents' });
      }
    }
  });

  // Catch-all for API
  app.all('/api/*', (req, res) => {
    console.log(`Unmatched API route: ${req.url}`);
    res.status(404).json({ error: 'API route not found' });
  });

  // --- ASSETS & SPA FALLBACK ---

  if (process.env.NODE_ENV !== 'production') {
    try {
      console.log('Initializing Vite middleware...');
      // Temporarily remove PORT so Vite doesn't try to bind its HMR or anything to it
      const systemPort = process.env.PORT;
      delete process.env.PORT;
      process.env.PORT = '24678'; // some random port for vite to use if it wants

      const vite = await createViteServer({
        server: { 
          middlewareMode: true,
          hmr: false,
          port: 24678, // force it to stay away from 3000
          watch: null // disable watcher
        },
        appType: 'spa',
      });
      
      process.env.PORT = systemPort; // restore PORT

      app.use(vite.middlewares);
      console.log('Vite middleware integrated');
    } catch (e) {
      console.error('Failed to initialize Vite middleware:', e);
    }
  } else {
    const distPath = getDistPath();
    console.log(`Serving static files from: ${distPath}`);
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch(err => {
  console.error('FAILED TO START SERVER:', err);
});
