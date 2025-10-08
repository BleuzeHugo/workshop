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
// io.on('connection', (socket) => {
//   console.log('🔌 Utilisateur connecté:', socket.id);

//   // Rejoindre une room "games" pour les mises à jour des jeux
//   socket.join('games');

//   socket.on('disconnect', () => {
//     console.log('❌ Utilisateur déconnecté:', socket.id);
//   });
// });

io.on('connection', (socket) => {
  console.log('🔌 Utilisateur connecté:', socket.id);

  // Rejoindre une room spécifique
  socket.on('join:group', (groupId) => {
    socket.join(`group:${groupId}`);
    console.log(`👥 Utilisateur ${socket.id} a rejoint group:${groupId}`);
    
    // Notifier les autres membres
    socket.to(`group:${groupId}`).emit('user:joined', { userId: socket.id });
  });

  // Quitter une room
  socket.on('leave:group', (groupId) => {
    socket.leave(`group:${groupId}`);
    console.log(`👋 Utilisateur ${socket.id} a quitté group:${groupId}`);
  });

  // Gestion du statut "prêt"
  socket.on('player:toggle:ready', (data) => {
    const { groupId, playerId, ready } = data;
    
    // Notifier tous les membres du groupe
    io.to(`group:${groupId}`).emit('player:ready', {
      playerId,
      ready
    });
    
    console.log(`✅ Joueur ${playerId} ${ready ? 'prêt' : 'non prêt'} dans group:${groupId}`);
  });

  // Démarrer le jeu
  socket.on('game:start', (groupId) => {
    // Vérifier que tous sont prêts (logique à implémenter)
    io.to(`group:${groupId}`).emit('game:started');
    console.log(`🚀 Jeu démarré pour group:${groupId}`);
  });

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