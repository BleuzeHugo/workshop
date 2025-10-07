// backend/server.js
import express from 'express';
import compression from 'compression';
import sirv from 'sirv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

const app = express();
app.use(compression());
app.use(express.json());

// Exemple de route API
app.get('/api/hello', (req, res) => {
  res.json({ message: 'Hello from Express + SvelteKit!' });
});

app.post('/api/test', (req, res) => {
  const { message } = req.body || {};
  if (!message) return res.status(400).json({ error: 'No message provided' });
  res.json({ reply: `Message reçu par le backend : "${message}"` });
});

if (!isProd) {
  // 🔹 Mode développement : on utilise Vite en middleware
  const vite = await createViteServer({
    root: __dirname + '/../', // racine du projet
    server: { middlewareMode: true },
  });
  app.use(vite.middlewares);
} else {
  // 🔹 Mode production : on sert le build SvelteKit
  const { handler } = await import('../build/handler.js');
  app.use(sirv(path.resolve(__dirname, '../build/client'), { dev: false }));
  app.use(handler);
}

// Démarrage du serveur
app.listen(PORT, () => {
  console.log(`✅ Serveur fusionné Express + SvelteKit lancé sur http://localhost:${PORT}`);
});
