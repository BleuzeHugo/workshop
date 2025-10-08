// backend/server.js
import express from 'express';
import compression from 'compression';
import sirv from 'sirv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { createServer } from 'http';
import { Server } from 'socket.io';
import apiRoutes from './routes/index.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const isProd = process.env.NODE_ENV === 'production';
const PORT = process.env.PORT || 3000;

const app = express();
const server = createServer(app); // ✅ Créer le serveur HTTP
const io = new Server(server, {   // ✅ Initialiser Socket.IO
  cors: {
    origin: isProd ? false : ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

app.use(compression());
app.use(express.json());

// Routes API
app.use('/api', apiRoutes);

// 🔥 Gestion des connexions Socket.IO
io.on('connection', (socket) => {
  console.log('🔌 Utilisateur connecté:', socket.id);

  // Rejoindre une room "games" pour les mises à jour des jeux
  socket.join('games');

  socket.on('disconnect', () => {
    console.log('❌ Utilisateur déconnecté:', socket.id);
  });
});

// 🔥 Export io pour l'utiliser dans les routes
app.locals.io = io;

if (!isProd) {
  const vite = await createViteServer({
    root: __dirname + '/../',
    server: { middlewareMode: true },
  });
  app.use(vite.middlewares);
} else {
  const { handler } = await import('../build/handler.js');
  app.use(sirv(path.resolve(__dirname, '../build/client'), { dev: false }));
  app.use(handler);
}

// ✅ Utiliser server.listen au lieu de app.listen
server.listen(PORT, () => {
  console.log(`✅ Serveur Express + SvelteKit + Socket.IO sur http://localhost:${PORT}`);
});