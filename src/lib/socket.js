import { io } from 'socket.io-client';
import { writable } from 'svelte/store';

// Stores Svelte pour la réactivité
export const isConnected = writable(false);
export const realTimeData = writable({
  timer: null,
  players: [],
  gameState: {},
  syncedValues: {},
  lastUpdatedBy: null
});

// Créer une instance Socket.IO
let socket;

// Fonction pour initialiser la connexion socket
export function initSocket() {
  if (!socket) {
    socket = io(import.meta.env.DEV ? 'http://localhost:3000' : window.location.origin, {
      autoConnect: true
    });

    // Gestion des événements globaux
    socket.on('connect', () => {
      console.log('🔌 Connecté au serveur');
      isConnected.set(true);
    });

    socket.on('disconnect', () => {
      console.log('❌ Déconnecté du serveur');
      isConnected.set(false);
    });

    socket.on('error', (error) => {
      console.error('❌ Erreur Socket.IO:', error);
      isConnected.set(false);
    });

    // 🔥 ÉVÉNEMENTS TEMPS RÉEL POUR LA SYNCHRONISATION
    socket.on("timer:started", (data) => {
      realTimeData.update((d) => ({ ...d, timer: data }));
      console.log("⏱️ Timer démarré:", data);
    });

    socket.on("timer:updated", (data) => {
      realTimeData.update((d) => ({
        ...d,
        timer: { ...d.timer, timeLeft: data.timeLeft }
      }));
    });

    socket.on("values:updated", ({ values, updatedBy }) => {
      realTimeData.update((d) => ({
        ...d,
        syncedValues: values,
        lastUpdatedBy: updatedBy
      }));
    });

    socket.on('player:ready', (data) => {
      console.log('✅ Joueur prêt:', data);
      realTimeData.update(state => {
        const players = [...state.players];
        const playerIndex = players.findIndex(p => p.id === data.playerId);
        
        if (playerIndex !== -1) {
          players[playerIndex] = { ...players[playerIndex], ready: data.ready };
        } else {
          players.push({ id: data.playerId, ready: data.ready });
        }
        
        return { ...state, players };
      });
    });

    socket.on('game:started', (data) => {
      console.log('🚀 Jeu démarré:', data);
      realTimeData.update(state => ({
        ...state,
        gameState: { 
          ...state.gameState, 
          started: true,
          startedAt: new Date().toISOString()
        }
      }));
    });

    socket.on('game:completed', (data) => {
      console.log('🎉 Partie terminée:', data);
      realTimeData.update(state => ({
        ...state,
        gameState: { 
          ...state.gameState, 
          completed: true,
          completedBy: data.completedBy,
          completedAt: data.timestamp
        }
      }));
    });

    socket.on('user:joined', (data) => {
      console.log('👥 Nouvel utilisateur:', data);
      realTimeData.update(state => ({
        ...state,
        players: [...state.players, { id: data.userId, joinedAt: data.timestamp }]
      }));
    });

    socket.on('level:completed', (data) => {
      console.log('🏆 Niveau terminé:', data);
      realTimeData.update(state => ({
        ...state,
        gameState: {
          ...state.gameState,
          levelCompleted: true,
          themeName: data.themeName
        }
      }));
    });
  }
  return socket;
}

// Getter pour récupérer l'instance socket
export function getSocket() {
  if (!socket) {
    return initSocket();
  }
  return socket;
}

// Fonction pour se déconnecter
export function disconnectSocket() {
  if (socket) {
    socket.disconnect();
    socket = null;
    isConnected.set(false);
    realTimeData.set({
      timer: null,
      players: [],
      gameState: {},
      syncedValues: {},
      lastUpdatedBy: null
    });
  }
}

// 🔥 FONCTIONS UTILITAIRES POUR LA SYNCHRO TEMPS RÉEL

// Rejoindre un groupe
export function joinGroup(groupId) {
  const socket = getSocket();
  if (socket && groupId) {
    socket.emit('join:group', groupId);
    console.log(`👥 Tentative de rejoindre le groupe: ${groupId}`);
  }
}

// Quitter un groupe
export function leaveGroup(groupId) {
  const socket = getSocket();
  if (socket && groupId) {
    socket.emit('leave:group', groupId);
  }
}

// Démarrer un timer
export function startTimer(groupId, duration) {
  const socket = getSocket();
  if (socket && groupId) {
    socket.emit('timer:start', { groupId, duration });
  }
}

// Mettre à jour le timer
export function updateTimer(groupId, timeLeft) {
  const socket = getSocket();
  if (socket && groupId) {
    socket.emit('timer:update', { groupId, timeLeft });
  }
}

// Synchroniser des valeurs
export function updateValues(groupId, values, playerName) {
  const socket = getSocket();
  if (socket && groupId) {
    socket.emit('values:update', { groupId, values, playerName });
  }
}

// Marquer un joueur comme prêt
export function togglePlayerReady(groupId, playerId, ready) {
  const socket = getSocket();
  if (socket && groupId) {
    socket.emit('player:toggle:ready', { groupId, playerId, ready });
  }
}

// Démarrer le jeu
export function startGame(groupId) {
  const socket = getSocket();
  if (socket && groupId) {
    socket.emit('game:start', groupId);
  }
}

// Terminer le jeu
export function completeGame(groupId, playerId) {
  const socket = getSocket();
  if (socket && groupId) {
    socket.emit('game:complete', { groupId, playerId });
  }
}

// Fonction pour réinitialiser les données temps réel
export function resetRealTimeData() {
  realTimeData.set({
    timer: null,
    players: [],
    gameState: {},
    syncedValues: {},
    lastUpdatedBy: null
  });
}

export default getSocket;