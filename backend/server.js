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
const server = createServer(app);
const io = new Server(server, {
  cors: {
    origin: isProd ? false : ["http://localhost:5173", "http://localhost:3000"],
    methods: ["GET", "POST"]
  }
});

app.use(compression());
app.use(express.json());
app.use('/api', apiRoutes);

// 🧠 Mémoire en RAM des états de parties
const gameState = {}; 
// Structure : {
//   [groupId]: { timer: { timeLeft, interval }, values: [], startedAt: Date }
// }

// 🔌 SOCKET.IO — GESTION TEMPS RÉEL
io.on('connection', (socket) => {
  console.log('🔌 Utilisateur connecté:', socket.id);

  // 🎯 Rejoindre un groupe
  socket.on('join:group', (groupId) => {
    socket.join(`group:${groupId}`);
    console.log(`👥 Utilisateur ${socket.id} a rejoint group:${groupId}`);

    // Envoie l’état actuel de la partie s’il existe
    if (gameState[groupId]) {
      const { values, timer } = gameState[groupId];
      if (values) {
        socket.emit('values:updated', {
          values,
          playerName: 'Système',
          timestamp: new Date().toISOString()
        });
      }
      if (timer) {
        socket.emit('timer:updated', {
          timeLeft: timer.timeLeft ?? 600,
          updatedBy: 'Système',
          timestamp: new Date().toISOString()
        });
      }
    }

    // Prévenir les autres joueurs
    socket.to(`group:${groupId}`).emit('user:joined', {
      userId: socket.id,
      timestamp: new Date().toISOString()
    });
  });

  // 👋 Quitter un groupe
  socket.on('leave:group', (groupId) => {
    socket.leave(`group:${groupId}`);
    console.log(`👋 Utilisateur ${socket.id} a quitté group:${groupId}`);
  });

  // ✅ Statut prêt
  socket.on('player:toggle:ready', (data) => {
    const { groupId, playerId, ready } = data;
    io.to(`group:${groupId}`).emit('player:ready', {
      playerId,
      ready,
      timestamp: new Date().toISOString()
    });
  });

  // 🚀 Démarrage du jeu
  socket.on('game:start', (groupId) => {
    io.to(`group:${groupId}`).emit('game:started');
    console.log(`🚀 Jeu démarré pour group:${groupId}`);
  });

  // 🕒 Démarrage du timer (serveur centralisé)
  socket.on("timer:start", ({ groupId, duration = 600, startedAt }) => {
    console.log(`🚀 Timer serveur lancé pour group:${groupId} (${duration}s)`);

    if (!gameState[groupId]) gameState[groupId] = {};
    const state = gameState[groupId];

    // Nettoyer un ancien timer
    if (state.timer?.interval) clearInterval(state.timer.interval);

    // Initialiser le nouveau timer
    state.timer = {
      initialDuration: duration,
      timeLeft: duration,
      startedAt: startedAt ? new Date(startedAt) : new Date(),
      interval: null
    };

    io.to(`group:${groupId}`).emit("timer:started", {
      duration,
      startedAt: state.timer.startedAt.toISOString(),
      timeLeft: duration
    });

    // Boucle serveur — décrémente toutes les secondes
    state.timer.interval = setInterval(() => {
      if (!state.timer) return clearInterval(state.timer.interval);

      state.timer.timeLeft -= 1;

      if (state.timer.timeLeft < 0) {
        clearInterval(state.timer.interval);
        state.timer.timeLeft = 0;
      }

      io.to(`group:${groupId}`).emit("timer:updated", {
        timeLeft: state.timer.timeLeft,
        updatedBy: "server"
      });

      if (state.timer.timeLeft <= 0) {
        console.log(`⏰ Temps écoulé pour group:${groupId}`);
        io.to(`group:${groupId}`).emit("game:timeup", { groupId });
        clearInterval(state.timer.interval);
      }
    }, 1000);
  });


  // ⏱️ Mise à jour manuelle du timer
  socket.on('timer:update', (data) => {
    const { groupId, timeLeft } = data;
    if (!gameState[groupId]) gameState[groupId] = {};
    gameState[groupId].timer = { ...(gameState[groupId].timer || {}), timeLeft };

    io.to(`group:${groupId}`).emit('timer:updated', {
      timeLeft,
      updatedBy: socket.id,
      timestamp: new Date().toISOString()
    });
  });

  // 💧 Synchronisation des valeurs entre joueurs
  socket.on("values:update", ({ groupId, values, playerName }) => {
    if (!gameState[groupId]) gameState[groupId] = {};
    gameState[groupId].values = values;
    gameState[groupId].lastUpdatedBy = playerName;

    io.to(`group:${groupId}`).emit("values:updated", {
      values,
      updatedBy: playerName
    });
  });

  // 🎉 Partie terminée
  socket.on('game:complete', (data) => {
    const { groupId, playerId } = data;
    io.to(`group:${groupId}`).emit('game:completed', {
      completedBy: playerId,
      timestamp: new Date().toISOString()
    });
    console.log(`🎉 Partie terminée par ${playerId} dans group:${groupId}`);

    if (gameState[groupId]?.timer?.interval) {
      clearInterval(gameState[groupId].timer.interval);
      gameState[groupId].timer = null;
    }
  });

  // ⏰ Temps écoulé manuellement
  socket.on('game:timeup', (data) => {
    const { groupId, playerId, playerName } = data;
    io.to(`group:${groupId}`).emit('game:timeup', {
      groupId,
      playerId,
      playerName,
      timestamp: new Date().toISOString()
    });
    console.log(`⏰ Temps écoulé signalé par ${playerName} (${playerId}) dans ${groupId}`);
  });

  // ❌ Déconnexion
  socket.on('disconnect', () => {
    console.log('❌ Utilisateur déconnecté:', socket.id);
  });
});

// 🔥 Export io pour routes API
app.locals.io = io;

// Configuration Vite / SvelteKit
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

server.listen(PORT, () => {
  console.log(`✅ Serveur Express + SvelteKit + Socket.IO sur http://localhost:${PORT}`);
});
