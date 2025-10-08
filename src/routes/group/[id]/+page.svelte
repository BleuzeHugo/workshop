<script>
  import { onMount, onDestroy } from 'svelte';
  import { page } from '$app/stores';
  import { goto } from '$app/navigation';
  import { getSocket } from '$lib/socket';

  let socket;
  let group = null;
  let players = [];
  let currentPlayer = null;
  let readyPlayers = new Set(); // Set des IDs des joueurs prêts
  let isReady = false;
  let loading = true;

  // Récupérer l'ID du groupe depuis l'URL
  const groupId = $page.params.id;

  onMount(async () => {
    socket = getSocket();
    
    // Charger les données initiales
    await loadGroupData();
    await loadCurrentPlayer();
    
    // Rejoindre la room du groupe
    socket.emit('join:group', groupId);

    // Écouter les mises à jour des joueurs
    socket.on('group:players:updated', (updatedPlayers) => {
      players = updatedPlayers;
    });

    // Écouter les changements de statut "prêt"
    socket.on('player:ready', (data) => {
      if (data.ready) {
        readyPlayers.add(data.playerId);
      } else {
        readyPlayers.delete(data.playerId);
      }
      readyPlayers = new Set(readyPlayers); // Trigger update
    });

    // Écouter le lancement du jeu
    socket.on('game:started', () => {
      alert('🚀 Le jeu commence !');
      goto('/game'); // Rediriger vers la page du jeu
    });

    // Nettoyer à la déconnexion
    onDestroy(() => {
      if (socket) {
        socket.emit('leave:group', groupId);
        socket.off('group:players:updated');
        socket.off('player:ready');
        socket.off('game:started');
      }
    });
  });

  async function loadGroupData() {
    try {
      // Charger les infos du groupe
      const groupRes = await fetch(`/api/games/${groupId}`);
      if (!groupRes.ok) throw new Error('Groupe non trouvé');
      group = await groupRes.json();

      // Charger les joueurs du groupe
      const playersRes = await fetch(`/api/games/${groupId}/players`);
      players = await playersRes.json();
    } catch (error) {
      console.error('Erreur:', error);
      alert('Groupe non trouvé');
      goto('/');
    } finally {
      loading = false;
    }
  }

  async function loadCurrentPlayer() {
    // Récupérer le joueur depuis le localStorage ou une API
    const playerData = localStorage.getItem('currentPlayer');
    if (playerData) {
      currentPlayer = JSON.parse(playerData);
    }
  }

  function toggleReady() {
    if (!currentPlayer) return;
    
    isReady = !isReady;
    socket.emit('player:toggle:ready', {
      groupId: groupId,
      playerId: currentPlayer.id,
      ready: isReady
    });
  }

  function startGame() {
    if (readyPlayers.size !== players.length) {
      alert('❌ Tous les joueurs doivent être prêts !');
      return;
    }
    
    socket.emit('game:start', groupId);
  }

  function leaveGroup() {
    if (confirm('Veux-tu vraiment quitter ce groupe ?')) {
      goto('/');
    }
  }
</script>

<div class="group-container">
  {#if loading}
    <div class="loading">
      <p>Chargement du groupe...</p>
    </div>
  {:else if group}
    <div class="group-header">
      <h1>🎮 {group.name}</h1>
      <p>Groupe de jeu - En attente des joueurs</p>
      <div class="real-time-indicator">
        <div class="pulse"></div>
        Temps réel
      </div>
    </div>

    <div class="players-grid">
      {#each players as player}
        <div class="player-card {readyPlayers.has(player.id) ? 'ready' : ''}">
          <div class="player-name">{player.name}</div>
          <div class="player-status">
            {readyPlayers.has(player.id) ? '✅ Prêt' : '⏳ En attente'}
          </div>
          {#if readyPlayers.has(player.id)}
            <div class="ready-badge">Prêt</div>
          {/if}
        </div>
      {/each}
    </div>

    <div class="ready-section">
      <h2>Statut de préparation</h2>
      <div class="ready-stats">
        {readyPlayers.size}/{players.length} joueurs prêts
      </div>
      
      {#if currentPlayer}
        <button 
          class="ready-btn {isReady ? 'ready' : ''}" 
          on:click={toggleReady}
        >
          {isReady ? '🚫 Annuler Prêt' : '✅ Je suis Prêt'}
        </button>
      {/if}

      {#if currentPlayer && players[0]?.id === currentPlayer.id} <!-- Si créateur du groupe -->
        <button 
          class="start-btn" 
          on:click={startGame}
          disabled={readyPlayers.size !== players.length || players.length < 2}
        >
          {players.length < 2 ? 'En attente de joueurs...' : '🚀 Lancer le Jeu'}
        </button>
      {/if}
    </div>

    <div style="text-align: center;">
      <button class="leave-btn" on:click={leaveGroup}>
        Quitter le groupe
      </button>
    </div>
  {:else}
    <div style="text-align: center; padding: 3rem;">
      <h2>Groupe non trouvé</h2>
      <button class="ready-btn" on:click={() => goto('/')}>
        Retour à l'accueil
      </button>
    </div>
  {/if}
</div>

<style>
  .group-container {
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    font-family: Arial, sans-serif;
  }

  .group-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
    border-radius: 12px;
    margin-bottom: 2rem;
    text-align: center;
  }

  .players-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 1rem;
    margin-bottom: 2rem;
  }

  .player-card {
    background: white;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    padding: 1.5rem;
    text-align: center;
    transition: all 0.3s;
    position: relative;
  }

  .player-card.ready {
    border-color: #4CAF50;
    background: #f1f8e9;
  }

  .player-name {
    font-weight: bold;
    font-size: 1.1rem;
    margin-bottom: 0.5rem;
  }

  .player-status {
    font-size: 0.9rem;
    color: #666;
  }

  .ready-badge {
    background: #4CAF50;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    position: absolute;
    top: -8px;
    right: -8px;
  }

  .ready-section {
    background: #f5f5f5;
    padding: 2rem;
    border-radius: 12px;
    text-align: center;
    margin-bottom: 2rem;
  }

  .ready-stats {
    font-size: 1.2rem;
    margin: 1rem 0;
    color: #333;
  }

  .ready-btn {
    background: #4CAF50;
    color: white;
    border: none;
    padding: 1rem 2rem;
    font-size: 1.1rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    margin: 0 0.5rem;
  }

  .ready-btn:hover {
    background: #45a049;
    transform: translateY(-2px);
  }

  .ready-btn.ready {
    background: #ff9800;
  }

  .ready-btn.ready:hover {
    background: #f57c00;
  }

  .start-btn {
    background: #2196F3;
    color: white;
    border: none;
    padding: 1rem 2rem;
    font-size: 1.1rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    margin: 0 0.5rem;
  }

  .start-btn:hover:not(:disabled) {
    background: #1976D2;
    transform: translateY(-2px);
  }

  .start-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .leave-btn {
    background: #ff4444;
    color: white;
    border: none;
    padding: 0.75rem 1.5rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
  }

  .leave-btn:hover {
    background: #cc0000;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    font-size: 1.2rem;
  }

  .real-time-indicator {
    display: inline-flex;
    align-items: center;
    background: #e3f2fd;
    padding: 0.5rem 1rem;
    border-radius: 20px;
    font-size: 0.9rem;
    margin-left: 1rem;
  }

  .pulse {
    width: 8px;
    height: 8px;
    background: #4CAF50;
    border-radius: 50%;
    margin-right: 0.5rem;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% { opacity: 1; }
    50% { opacity: 0.5; }
    100% { opacity: 1; }
  }
</style>