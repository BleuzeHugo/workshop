<script>
  import { onMount, onDestroy } from 'svelte';
  import { socket, realTimeData, initSocket } from '$stores/socket';
  
  let currentSocket;
  let groupId = ''; // À définir selon ton contexte
  
  onMount(() => {
    // Initialiser Socket.IO
    currentSocket = initSocket();
    
    // Rejoindre le groupe quand le socket est prêt
    const unsubscribe = socket.subscribe($socket => {
      if ($socket && groupId) {
        $socket.emit('join:group', groupId);
      }
    });
    
    return () => unsubscribe();
  });
  
  onDestroy(() => {
    if (currentSocket) {
      currentSocket.disconnect();
    }
  });
  
  // Fonctions pour émettre des événements
  function startTimer(duration) {
    if (currentSocket && groupId) {
      currentSocket.emit('timer:start', { groupId, duration });
    }
  }
  
  function updateTimer(timeLeft) {
    if (currentSocket && groupId) {
      currentSocket.emit('timer:update', { groupId, timeLeft });
    }
  }
  
  function updateValues(values, playerName) {
    if (currentSocket && groupId) {
      currentSocket.emit('values:update', { groupId, values, playerName });
    }
  }
  
  function completeGame(playerId) {
    if (currentSocket && groupId) {
      currentSocket.emit('game:complete', { groupId, playerId });
    }
  }
  
  // Exposer les fonctions
  $: exports = {
    startTimer,
    updateTimer,
    updateValues,
    completeGame,
    groupId: {
      get: () => groupId,
      set: (value) => {
        groupId = value;
        if (currentSocket && value) {
          currentSocket.emit('join:group', value);
        }
      }
    }
  };
  
  export { exports as realTime };
</script>

<!-- Ce composant gère la synchro en arrière-plan -->
<div class="real-time-sync" style="display: none;">
  <!-- Contenu caché - juste pour la logique -->
</div>