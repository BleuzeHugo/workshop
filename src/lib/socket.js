import { io } from 'socket.io-client';

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
    });

    socket.on('disconnect', () => {
      console.log('❌ Déconnecté du serveur');
    });

    socket.on('error', (error) => {
      console.error('❌ Erreur Socket.IO:', error);
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
  }
}

export default getSocket;