<script>
  import { onMount, onDestroy } from "svelte";
  import { page } from "$app/stores";
  import { goto } from "$app/navigation";
  import { getSocket } from "$lib/socket";
  import { getStoredPlayer } from "$lib/auth";

  let socket;
  let group = null;
  let players = [];
  let currentPlayer = null;
  let readyPlayers = new Set();
  let isReady = false;
  let loading = true;
  let gameStarted = false;
  let startingGame = false;

  const groupId = $page.params.id;

  onMount(async () => {
    socket = getSocket();

    // Charger les données initiales
    await loadGroupData();
    await loadCurrentPlayer();

    if (currentPlayer) {
      // Rejoindre la room du groupe
      socket.emit("join:group", groupId);

      // Écouter les mises à jour des joueurs
      socket.on("players:updated", (data) => {
        console.log("🔄 Joueurs mis à jour:", data);
        players = data.players;

        // Mettre à jour les joueurs prêts
        readyPlayers.clear();
        players.forEach((player) => {
          if (player.is_ready) {
            readyPlayers.add(player.id);
          }
        });

        // Mettre à jour le statut du currentPlayer
        const currentPlayerData = players.find(
          (p) => p.id === currentPlayer.id
        );
        if (currentPlayerData) {
          isReady = !!currentPlayerData.is_ready;
        }

        // Vérifier si tous les joueurs sont prêts
        checkAllPlayersReady();
      });

      // Écouter le lancement du jeu
      socket.on("game:started", (data) => {
        console.log("🎮 Début de la partie !", data);
        gameStarted = true;
        startingGame = false;
        showGameStartMessage(data.theme);
      });
    }

    // Nettoyer à la déconnexion
    onDestroy(() => {
      if (socket) {
        socket.emit("leave:group", groupId);
        socket.off("players:updated");
        socket.off("game:started");
      }
    });
  });

  async function loadGroupData() {
    try {
      // Charger les infos du groupe
      const groupRes = await fetch(`/api/games/${groupId}`);
      if (!groupRes.ok) throw new Error("Groupe non trouvé");
      group = await groupRes.json();

      // Charger les joueurs du groupe avec leur statut ready
      const playersRes = await fetch(`/api/games/${groupId}/players`);
      players = await playersRes.json();

      // Initialiser les joueurs prêts
      players.forEach((player) => {
        if (player.is_ready) {
          readyPlayers.add(player.id);
        }
      });

      // Vérifier si tous sont déjà prêts au chargement
      checkAllPlayersReady();
    } catch (error) {
      console.error("Erreur:", error);
      alert("Groupe non trouvé");
      goto("/");
    } finally {
      loading = false;
    }
  }

  async function loadCurrentPlayer() {
    currentPlayer = getStoredPlayer();
    console.log("Current player:", currentPlayer);

    if (!currentPlayer) {
      alert("Aucun joueur connecté");
      goto("/");
      return;
    }

    // Vérifier si le currentPlayer est bien dans ce groupe
    const playerInGroup = players.find((p) => p.id === currentPlayer.id);
    if (!playerInGroup) {
      alert("Vous ne faites pas partie de ce groupe");
      goto("/");
      return;
    }

    // Mettre à jour le statut ready du currentPlayer
    isReady = !!playerInGroup.is_ready;
  }

  async function toggleReady() {
    if (!currentPlayer) return;

    try {
      const newReadyState = !isReady;

      const res = await fetch(`/api/games/${groupId}/ready`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          playerId: currentPlayer.id,
          ready: newReadyState,
        }),
      });

      if (res.ok) {
        console.log("Statut ready mis à jour:", newReadyState);
        // La mise à jour sera gérée par l'événement Socket.IO
      } else {
        const error = await res.json();
        alert(error.error || "Erreur");
      }
    } catch (error) {
      console.error("Erreur toggle ready:", error);
      alert("Erreur de connexion");
    }
  }

  function checkAllPlayersReady() {
    // Vérifier si tous les joueurs sont prêts et qu'il y a au moins 2 joueurs
    const allReady =
      readyPlayers.size === players.length && players.length >= 2;

    if (allReady && !gameStarted && !startingGame) {
      console.log("Tous les joueurs sont prêts ! Lancement de la partie...");
      startGameAutomatically();
    }
  }

  async function startGameAutomatically() {
    if (gameStarted || startingGame) return;

    startingGame = true;
    console.log("🚀 Lancement de la partie...");

    try {
      const res = await fetch(`/api/party/${groupId}/start`, {
        method: "POST",
        headers: { "Content-Type": "application/json" }
      });

      if (res.ok) {
        const data = await res.json();
        console.log("✅ Partie créée:", data);
        // L'événement Socket.IO game:started sera émis par le serveur
      } else {
        const error = await res.json();
        console.error("❌ Erreur création partie:", error);
        startingGame = false;
        alert(error.error || "Erreur lors du démarrage");
      }
    } catch (error) {
      console.error("❌ Erreur création partie:", error);
      startingGame = false;
      alert("Erreur de connexion");
    }
  }

  function showGameStartMessage(theme) {
  // Créer une overlay pour annoncer le début de la partie
  const overlay = document.createElement("div");
  overlay.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0,0,0,0.8);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    color: white;
    font-family: Arial, sans-serif;
  `;

  const themeMessage = theme ? `<p style="font-size: 1.5rem; margin: 1rem 0; color: #4CAF50;">Thème : ${theme.name}</p>` : '';

  // Déterminer l'URL de redirection basée sur le thème
  const themeRoutes = {
    'Air': '/air',
    'Energy': '/energy', 
    'Water': '/water',
  };

  const gameRoute = themeRoutes[theme.name] || '/game';

  overlay.innerHTML = `
    <div style="text-align: center; background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); padding: 3rem; border-radius: 20px; box-shadow: 0 10px 30px rgba(0,0,0,0.3);">
      <h1 style="font-size: 3rem; margin: 0 0 1rem 0;">🎮 C'est parti !</h1>
      <p style="font-size: 1.5rem; margin: 0 0 1rem 0;">Tous les joueurs sont prêts !</p>
      ${themeMessage}
      <p style="font-size: 1.2rem; opacity: 0.9; margin: 2rem 0;">Redirection vers le jeu...</p>
      <button onclick="this.parentElement.parentElement.remove(); window.location.href='${gameRoute}'" style="margin-top: 1rem; padding: 1rem 2rem; font-size: 1.2rem; background: #4CAF50; color: white; border: none; border-radius: 10px; cursor: pointer;">
        Commencer maintenant
      </button>
    </div>
  `;

  document.body.appendChild(overlay);

  // Redirection automatique après 5 secondes
  setTimeout(() => {
    if (overlay.parentElement) {
      overlay.remove();
    }
    goto(gameRoute);
  }, 5000);
}

  async function leaveGroup() {
    if (confirm("Veux-tu vraiment quitter ce groupe ?")) {
      try {
        const res = await fetch(`/api/games/${groupId}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: currentPlayer.id }),
        });

        if (res.ok) {
          goto("/");
        } else {
          const error = await res.json();
          alert(error.error || "Erreur");
        }
      } catch (error) {
        console.error("❌ Erreur quitter groupe:", error);
        alert("Erreur de connexion");
      }
    }
  }
</script>

<div class="page">
  <div class="group-container">
    {#if loading}
      <div class="loading">
        <p>Chargement du groupe...</p>
      </div>
    {:else if group && currentPlayer}
      <div class="group-header">
        <h1>{group.name}</h1>
        <p>Groupe de jeu - En attente des joueurs</p>
        <div class="group-meta">
          <span class="player-count">{group.player_count}/4 joueurs</span>
          {#if startingGame}
            <div class="starting-indicator">
              <div class="pulse"></div>
              Démarrage...
            </div>
          {/if}
        </div>
      </div>

      <div class="players-section">
        <h2>Joueurs dans le groupe</h2>
        <div class="players-grid">
          {#each players as player}
            <div
              class="player-card {readyPlayers.has(player.id) ? 'ready' : ''}"
            >
              <div class="player-avatar">
                {player.name.charAt(0).toUpperCase()}
              </div>
              <div class="player-info">
                <div class="player-name">
                  {player.name}
                  {#if player.id === currentPlayer.id}
                    <span class="you-badge">(Vous)</span>
                  {/if}
                </div>
                <div class="player-status">
                  {readyPlayers.has(player.id) ? "Prêt" : "En attente"}
                </div>
              </div>
              {#if readyPlayers.has(player.id)}
                <div class="ready-badge">Prêt</div>
              {/if}
            </div>
          {/each}
        </div>
      </div>

      <div class="ready-section">
        <h2>Préparation</h2>
        <div class="ready-stats">
          {readyPlayers.size}/{players.length} joueurs prêts
          {#if readyPlayers.size === players.length && players.length >= 2}
            <span class="all-ready">Tous prêts ! Début de la partie...</span>
          {:else if readyPlayers.size === players.length && players.length < 2}
            <span class="waiting-players">En attente de plus de joueurs...</span>
          {/if}
        </div>

        <div class="action-buttons">
          <button
            class="ready-btn {isReady ? 'ready' : ''}"
            on:click={toggleReady}
            disabled={startingGame}
          >
            {#if isReady}
              Annuler Prêt
            {:else}
              Je suis Prêt
            {/if}
          </button>
        </div>

        {#if gameStarted}
          <div class="game-started-message">
            <h3>La partie a commencé !</h3>
            <p>Redirection vers le jeu...</p>
          </div>
        {/if}
      </div>
      

      <div class="footer-actions">
        <button class="leave-btn" on:click={leaveGroup} disabled={startingGame}>
          🚪 Quitter le groupe
        </button>
      </div>
    {:else}
      <div class="error-section">
        <h2>❌ Impossible d'accéder au groupe</h2>
        <p>Le groupe n'existe pas ou vous n'y avez pas accès.</p>
        <button class="ready-btn" on:click={() => goto("/")}>
          Retour à l'accueil
        </button>
      </div>
    {/if}
  </div>
</div>

<style>
  .page {
    background-image: url("../../../lib/assets/foret.jpg");
    background-size: cover;
    background-position: center;
    min-height: 100vh;
    padding: 1rem;
  }

  .group-container {
    border-radius: 2rem;
    backdrop-filter: blur(2px);
    box-shadow:
      inset 1px 1px 4px rgba(255, 255, 255, 0.2),
      inset -1px -1px 6px rgba(0, 0, 0, 0.3),
      0 4px 12px rgba(0, 0, 0, 0.15);
    overflow: hidden;
    max-width: 800px;
    margin: 0 auto;
    padding: 2rem;
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    background: rgba(255, 255, 255, 0.95);
  }

  .group-header {
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    color: white;
    padding: 2rem;
    border-radius: 12px;
    margin-bottom: 2rem;
    text-align: center;
  }

  .group-header h1 {
    margin: 0 0 0.5rem 0;
    font-size: 2rem;
  }

  .group-meta {
    display: flex;
    justify-content: center;
    align-items: center;
    gap: 1rem;
    margin-top: 1rem;
    flex-wrap: wrap;
  }

  .player-count {
    background: rgba(255, 255, 255, 0.2);
    padding: 0.4rem 0.8rem;
    border-radius: 20px;
    font-size: 0.9rem;
  }

  .starting-indicator {
    display: inline-flex;
    align-items: center;
    background: rgba(255, 255, 255, 0.2);
    padding: 0.4rem 0.8rem;
    border-radius: 20px;
    font-size: 0.9rem;
    gap: 0.5rem;
  }

  .players-section {
    margin-bottom: 2rem;
  }

  .players-section h2 {
    color: #333;
    margin-bottom: 1rem;
    text-align: center;
  }

  .players-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    gap: 1rem;
  }

  .player-card {
    background: white;
    border: 2px solid #e0e0e0;
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    align-items: center;
    gap: 1rem;
    transition: all 0.3s;
    position: relative;
  }

  .player-card.ready {
    border-color: #4caf50;
    background: #f1f8e9;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.2);
  }

  .player-avatar {
    width: 40px;
    height: 40px;
    background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
    border-radius: 50%;
    display: flex;
    align-items: center;
    justify-content: center;
    color: white;
    font-weight: bold;
    font-size: 1.2rem;
  }

  .player-info {
    flex-grow: 1;
  }

  .player-name {
    font-weight: bold;
    font-size: 1.1rem;
    margin-bottom: 0.25rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .you-badge {
    background: #2196f3;
    color: white;
    padding: 0.1rem 0.5rem;
    border-radius: 8px;
    font-size: 0.7rem;
  }

  .player-status {
    font-size: 0.9rem;
    color: #666;
  }

  .ready-badge {
    background: #4caf50;
    color: white;
    padding: 0.25rem 0.75rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  .ready-section {
    background: #f8f9fa;
    padding: 2rem;
    border-radius: 12px;
    margin-bottom: 2rem;
  }

  .ready-section h2 {
    color: #333;
    margin-bottom: 1rem;
    text-align: center;
  }

  .ready-stats {
    font-size: 1.3rem;
    margin: 1.5rem 0;
    color: #333;
    text-align: center;
    font-weight: 600;
  }

  .all-ready {
    color: #4caf50;
    margin-left: 0.5rem;
    font-weight: 600;
  }

  .waiting-players {
    color: #ff9800;
    margin-left: 0.5rem;
    font-weight: 600;
  }

  .action-buttons {
    display: flex;
    justify-content: center;
    gap: 1rem;
    flex-wrap: wrap;
  }

  .ready-btn {
    background: #4caf50;
    color: white;
    border: none;
    padding: 1rem 2rem;
    font-size: 1.1rem;
    border-radius: 8px;
    cursor: pointer;
    transition: all 0.3s;
    font-weight: 600;
  }

  .ready-btn:hover:not(:disabled) {
    background: #45a049;
    transform: translateY(-2px);
    box-shadow: 0 4px 12px rgba(76, 175, 80, 0.3);
  }

  .ready-btn.ready {
    background: #ff9800;
  }

  .ready-btn.ready:hover:not(:disabled) {
    background: #f57c00;
    box-shadow: 0 4px 12px rgba(255, 152, 0, 0.3);
  }

  .ready-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
    transform: none;
  }

  .game-started-message {
    background: #4caf50;
    color: white;
    padding: 1.5rem;
    border-radius: 8px;
    text-align: center;
    margin-top: 1rem;
  }

  .footer-actions {
    text-align: center;
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

  .leave-btn:hover:not(:disabled) {
    background: #cc0000;
    transform: translateY(-2px);
  }

  .leave-btn:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .loading {
    text-align: center;
    padding: 3rem;
    font-size: 1.2rem;
  }

  .error-section {
    text-align: center;
    padding: 3rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
  }

  .pulse {
    width: 8px;
    height: 8px;
    background: #4caf50;
    border-radius: 50%;
    animation: pulse 2s infinite;
  }

  @keyframes pulse {
    0% {
      opacity: 1;
    }
    50% {
      opacity: 0.5;
    }
    100% {
      opacity: 1;
    }
  }

  /* Responsive */
  @media (max-width: 768px) {
    .group-container {
      padding: 1rem;
    }

    .action-buttons {
      flex-direction: column;
    }

    .players-grid {
      grid-template-columns: 1fr;
    }

    .group-meta {
      flex-direction: column;
      gap: 0.5rem;
    }
  }
</style>