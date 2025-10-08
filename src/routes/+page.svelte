<script>
  import { onMount, onDestroy } from "svelte";
  import { getSocket } from "$lib/socket";
  import { goto } from "$app/navigation";
  import {
    savePlayer,
    getStoredPlayer,
    verifyToken,
    clearPlayer,
    restoreSession,
  } from "$lib/auth";

  let playerName = "";
  let player = null;
  let groups = [];
  let newGroupName = "";
  let loading = false;
  let socket;
  let currentPlayerGroup = null;
  let restoringSession = true;
  let sessionError = false;

  onMount(async () => {
    console.log("=== DÉBUT MOUNT ===");

    try {
      // Essai de restauration de session
      const restoredPlayer = await restoreSession();
      if (restoredPlayer) {
        player = restoredPlayer;
        console.log("✅ Session restaurée:", player.name);
        // Charger l'appartenance au groupe ET les groupes en parallèle
        await Promise.all([loadPlayerMembership(), loadGroups()]);
      }
    } catch (error) {
      console.error("❌ Erreur restauration:", error);
      sessionError = true;
    } finally {
      restoringSession = false;
      console.log(
        "🔚 Restauration terminée, player:",
        player ? player.name : "null"
      );
    }

    // Initialiser Socket.IO
    socket = getSocket();

    socket.on("game:created", (newGame) => {
      console.log("🎮 Nouveau groupe:", newGame.name);
      if (!groups.find((g) => g.id === newGame.id)) {
        groups = [newGame, ...groups];
      }
    });

    socket.on("game:updated", (updatedGame) => {
      console.log("🔄 Groupe mis à jour:", updatedGame.name);
      groups = groups.map((group) =>
        group.id === updatedGame.id ? updatedGame : group
      );

      // Si le groupe actuel du joueur a été mis à jour
      if (currentPlayerGroup && currentPlayerGroup.id === updatedGame.id) {
        currentPlayerGroup = updatedGame;
      }

      // Recharger l'appartenance si le joueur a rejoint/quitté un groupe
      if (player) {
        loadPlayerMembership();
      }
    });

    console.log("=== FIN MOUNT ===");
  });

  onDestroy(() => {
    if (socket) {
      socket.off("game:created");
      socket.off("game:updated");
    }
  });

  async function loadPlayerMembership() {
    if (!player) return;

    try {
      console.log("🔍 Chargement membership...");
      const res = await fetch(`/api/games/player/${player.id}/membership`);
      if (res.ok) {
        const data = await res.json();
        console.log("📊 Données membership:", data);

        if (data.inGroup) {
          currentPlayerGroup = data.game;
          console.log("🎯 Dans le groupe:", currentPlayerGroup.name);
        } else {
          currentPlayerGroup = null;
          console.log("👤 Pas dans un groupe");
        }
      } else {
        console.log("❌ Erreur HTTP membership:", res.status);
      }
    } catch (error) {
      console.error("❌ Erreur chargement membership:", error);
    }
  }

  async function loadGroups() {
    try {
      console.log("🔍 Chargement groupes...");
      const res = await fetch("/api/games");
      if (res.ok) {
        groups = await res.json();
        console.log(`📋 ${groups.length} groupes chargés`);
      } else {
        console.log("❌ Erreur HTTP groupes:", res.status);
      }
    } catch (error) {
      console.error("❌ Erreur chargement groupes:", error);
    }
  }

  async function createPlayer() {
    if (!playerName.trim()) return;

    loading = true;
    try {
      console.log("👤 Création joueur:", playerName);
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playerName.trim() }),
      });

      if (res.ok) {
        player = await res.json();
        savePlayer(player);
        console.log("✅ Joueur créé:", player.name);
        currentPlayerGroup = null;
        await loadGroups();
      } else {
        const errorData = await res.json();
        throw new Error(errorData.error || "Erreur création");
      }
    } catch (error) {
      console.error("❌ Erreur création joueur:", error);
      alert(error.message);
    } finally {
      loading = false;
    }
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;

    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName.trim() }),
      });

      if (res.ok) {
        const data = await res.json();
        console.log("🏗️ Groupe créé:", data.name);
        newGroupName = "";
      } else {
        const error = await res.json();
        throw new Error(error.error || "Erreur création");
      }
    } catch (error) {
      console.error("❌ Erreur création groupe:", error);
      alert(error.message);
    }
  }

  async function joinGroup(groupId) {
    if (currentPlayerGroup) {
      alert(`❌ Déjà dans le groupe "${currentPlayerGroup.name}"`);
      return;
    }

    try {
      const res = await fetch(`/api/games/${groupId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id }),
      });

      const data = await res.json();

      if (data.error) {
        alert(data.error);
      } else {
        console.log("✅ Rejoint groupe:", groupId);
        // Mettre à jour l'appartenance avant la redirection
        await loadPlayerMembership();
        goto(`/group/${groupId}`);
      }
    } catch (error) {
      console.error("❌ Erreur rejoindre groupe:", error);
      alert("Erreur connexion groupe");
    }
  }

  function disconnect() {
    console.log("👋 Déconnexion");
    clearPlayer();
    player = null;
    playerName = "";
    groups = [];
    currentPlayerGroup = null;
  }

  async function leaveCurrentGroup() {
    if (!currentPlayerGroup) return;

    if (confirm(`Quitter le groupe "${currentPlayerGroup.name}" ?`)) {
      try {
        const res = await fetch(`/api/games/${currentPlayerGroup.id}/leave`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ playerId: player.id }),
        });

        const data = await res.json();

        if (data.error) {
          alert(data.error);
        } else {
          currentPlayerGroup = null;
          await loadGroups();
          console.log("🚪 Groupe quitté");
        }
      } catch (error) {
        console.error("❌ Erreur quitter groupe:", error);
        alert("Erreur sortie groupe");
      }
    }
  }

  // Fonction pour forcer le chargement en cas de blocage
  function forceLoad() {
    console.log("Forçage chargement...");
    restoringSession = false;
    sessionError = false;
  }
</script>

<div class="page">
  <div class="container">
    {#if restoringSession}
      <div class="loading-section">
        <div class="spinner"></div>
        <p>Restauration de votre session...</p>
        {#if sessionError}
          <p class="error-message">Erreur de chargement</p>
        {/if}
        <button on:click={forceLoad} class="force-btn">
          Si ça bloque, cliquez ici
        </button>
      </div>
    {:else if !player}
      <div class="player-creation">
        <h1>Créer ton joueur</h1>
        <div class="input-group">
          <input
            placeholder="Ton pseudo"
            bind:value={playerName}
            maxlength="20"
          />
          <button
            class="create-btn"
            on:click={createPlayer}
            disabled={!playerName.trim() || loading}
          >
            {#if loading}Création...{:else}Créer mon joueur{/if}
          </button>
        </div>
      </div>
    {:else}
      <div class="game-section">
        <div class="player-header">
          <div class="player-info">
            <h2>
              <span class="status-indicator status-online"></span>
              Bienvenue, <strong>{player.name}</strong>
            </h2>
          </div>
          <button class="disconnect-btn" on:click={disconnect}>
            Déconnexion
          </button>
        </div>

        {#if currentPlayerGroup}
          <div class="current-group">
            <div class="current-group-header">
              <h3>Tu es déjà dans un groupe</h3>
              <button class="leave-group-btn" on:click={leaveCurrentGroup}>
                Quitter
              </button>
            </div>
            <div class="current-group-content">
              <div class="group-details">
                <strong>{currentPlayerGroup.name}</strong>
                <span class="player-count-badge"
                  >{currentPlayerGroup.player_count}/4 joueurs</span
                >
              </div>
              <button
                class="join-btn"
                on:click={() => goto(`/group/${currentPlayerGroup.id}`)}
              >
                Rejoindre
              </button>
            </div>
          </div>
        {:else}
          <div class="game-section-mini">
            <h3>Créer un groupe</h3>
            <div class="input-group">
              <input
                placeholder="Nom du groupe"
                bind:value={newGroupName}
                maxlength="30"
              />
              <button
                class="create-btn"
                on:click={createGroup}
                disabled={!newGroupName.trim()}
              >
                Créer le groupe
              </button>
            </div>
          </div>
        {/if}

        <div class="game-section-mini">
          <div class="section-header">
            <h3>Groupes disponibles</h3>
          </div>

          {#if groups.length === 0}
            <div class="empty-state">
              <p>Aucun groupe disponible.</p>
              <p>Sois le premier à en créer un !</p>
            </div>
          {:else}
            <div class="groups-list">
              {#each groups as group}
                <div class="group-card">
                  <div class="group-info">
                    <div class="group-name">{group.name}</div>
                    <div class="group-meta">
                      <span class="player-count"
                        >{group.player_count}/4 joueurs</span
                      >
                      {#if group.player_count === 4}
                        <span class="status-badge full">🔒 Complet</span>
                      {:else if group.player_count === 3}
                        <span class="status-badge almost-full"
                          >⚠️ Presque complet</span
                        >
                      {/if}
                    </div>
                  </div>
                  <button
                    class="join-btn"
                    on:click={() => joinGroup(group.id)}
                    disabled={group.player_count >= 4 || currentPlayerGroup}
                  >
                    {#if currentPlayerGroup}
                      Déjà dans un groupe
                    {:else if group.player_count >= 4}
                      Complet
                    {:else}
                      Rejoindre
                    {/if}
                  </button>
                </div>
              {/each}
            </div>
          {/if}
        </div>
      </div>
    {/if}
  </div>
</div>

<style>
  :root {
    --bg: rgba(255, 255, 255, 0.06);
    --text: #e5e5e5;
    --color-primary: rgba(0, 94, 68, 0.5);
    --color-secondary: rgba(103, 174, 142, 0.5);
    /* --color-primary: #005e44; */
    /* --color-secondary: #67ae8e; */
  }
  .page {
    /* min-height: 100vh; */
    background-image: url("../lib/assets/foret.jpg");
    background-size: cover;
    background-position: center;
    /* padding: 20px; */
  }

  .container {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
    font-family: "Segoe UI", Tahoma, Geneva, Verdana, sans-serif;
    min-height: 100vh;
  }

  /* Section de chargement */
  .loading-section {
    text-align: center;
    padding: 4rem 2rem;
    background: white;
    border-radius: 12px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
  }

  .spinner {
    width: 40px;
    height: 40px;
    border: 4px solid #f3f3f3;
    border-top: 4px solid #667eea;
    border-radius: 50%;
    animation: spin 1s linear infinite;
    margin: 0 auto 1rem;
  }

  .force-btn {
    background: #ff9800;
    color: white;
    margin-top: 1rem;
  }

  .force-btn:hover {
    background: #f57c00;
  }

  .error-message {
    color: #ff4444;
    margin: 0.5rem 0;
  }

  @keyframes spin {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(360deg);
    }
  }

  /* Création de joueur */
  .player-creation {
    /* background: white; */
    padding: 2.5rem;
    border-radius: 16px;
    /* box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); */
    text-align: center;

    /* background: var(--bg); */
    border-radius: 2rem;
    backdrop-filter: blur(2px);
    box-shadow:
      inset 1px 1px 4px rgba(255, 255, 255, 0.2),
      inset -1px -1px 6px rgba(0, 0, 0, 0.3),
      0 4px 12px rgba(0, 0, 0, 0.15);
    overflow: hidden;
  }

  .player-creation h1 {
    color: #333;
    margin-bottom: 1rem;
    font-size: 2rem;
  }

  .session-info {
    color: #666;
    margin-bottom: 2rem;
    font-size: 0.95rem;
    line-height: 1.4;
  }

  /* Sections de jeu */
  .game-section {
    /* background: white; */
    padding: 2rem;
    /* border-radius: 16px; */
    /* box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1); */
    margin-bottom: 1.5rem;
    border-radius: 2rem;
    backdrop-filter: blur(2px);
    box-shadow:
      inset 1px 1px 4px rgba(255, 255, 255, 0.2),
      inset -1px -1px 6px rgba(0, 0, 0, 0.3),
      0 4px 12px rgba(0, 0, 0, 0.15);
    overflow: hidden;
  }

  .game-section-mini {
    /* background: white; */
    background: linear-gradient(135deg, var(--color-secondary), var(--color-primary));
    padding: 2rem;
    border-radius: 16px;
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.1);
    margin-bottom: 1.5rem;
  }

  /* En-tête joueur */
  .player-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 1.5rem;
  }

  .player-info h2 {
    color: #333;
    margin-bottom: 0.5rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
  }

  .session-saved {
    color: #4caf50;
    font-size: 0.9rem;
    margin: 0;
    font-weight: 500;
  }

  /* Groupes */
  .section-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1.5rem;
  }

  .section-header h3 {
    color: #333;
    margin: 0;
  }

  .real-time-badge {
    background: #4caf50;
    color: white;
    padding: 0.4rem 0.8rem;
    border-radius: 20px;
    font-size: 0.8rem;
    display: flex;
    align-items: center;
    gap: 0.5rem;
    font-weight: 500;
  }

  .pulse-dot {
    width: 8px;
    height: 8px;
    background: white;
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

  /* Indicateur de statut */
  .status-indicator {
    display: inline-block;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    margin-right: 0.5rem;
  }

  .status-online {
    background: #4caf50;
  }

  /* Groupes actuels */
  .current-group {
    background: #e8f5e8;
    border: 2px solid #4caf50;
    border-radius: 12px;
    padding: 1.5rem;
    margin: 1.5rem 0;
  }

  .current-group-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
  }

  .current-group-header h3 {
    color: #2e7d32;
    margin: 0;
  }

  .current-group-content {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .group-details {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .player-count-badge {
    background: #4caf50;
    color: white;
    padding: 0.3rem 0.8rem;
    border-radius: 12px;
    font-size: 0.8rem;
    font-weight: 500;
  }

  /* Listes de groupes */
  .groups-list {
    space-y: 1rem;
  }

  .group-card {
    background: #f8f9fa;
    border: 2px solid #e9ecef;
    border-radius: 12px;
    padding: 1.5rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    transition: all 0.3s ease;
  }

  .group-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.1);
    border-color: #667eea;
  }

  .group-info {
    flex-grow: 1;
  }

  .group-name {
    font-weight: 600;
    font-size: 1.1rem;
    color: #333;
    margin-bottom: 0.5rem;
  }

  .group-meta {
    display: flex;
    align-items: center;
    gap: 1rem;
  }

  .player-count {
    color: #666;
    font-size: 0.9rem;
  }

  .status-badge {
    font-size: 0.8rem;
    padding: 0.2rem 0.6rem;
    border-radius: 8px;
    font-weight: 500;
  }

  .status-badge.full {
    background: #ffebee;
    color: #c62828;
  }

  .status-badge.almost-full {
    background: #fff3e0;
    color: #ef6c00;
  }

  .status-badge.empty {
    background: #e3f2fd;
    color: #1565c0;
  }

  /* États vides */
  .empty-state {
    text-align: center;
    padding: 3rem 2rem;
    color: #666;
  }

  .empty-state p {
    margin: 0.5rem 0;
  }

  /* Input groups */
  .input-group {
    display: flex;
    gap: 0.5rem;
    align-items: center;
  }

  input {
    padding: 0.75rem 1rem;
    border: 2px solid #e0e0e0;
    border-radius: 8px;
    font-size: 1rem;
    flex-grow: 1;
    transition: border-color 0.3s;
  }

  input:focus {
    outline: none;
    border-color: #667eea;
    box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
  }

  /* Boutons */
  button {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s ease;
    font-weight: 500;
    white-space: nowrap;
  }

  button:disabled {
    background: #ccc !important;
    color: #666 !important;
    cursor: not-allowed;
    transform: none !important;
  }

  .create-btn {
    background: #4caf50;
    color: white;
  }

  .create-btn:hover:not(:disabled) {
    background: #45a049;
    transform: translateY(-2px);
  }

  .join-btn {
    background: #2196f3;
    color: white;
    padding: 0.6rem 1.2rem;
    font-size: 0.9rem;
  }

  .join-btn:hover:not(:disabled) {
    background: #1976d2;
    transform: translateY(-2px);
  }

  .disconnect-btn {
    background: #ff4444;
    color: white;
  }

  .disconnect-btn:hover {
    background: #cc0000;
    transform: translateY(-2px);
  }

  .leave-group-btn {
    background: #ff9800;
    color: white;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
  }

  .leave-group-btn:hover {
    background: #f57c00;
    transform: translateY(-2px);
  }

  .button-loading {
    display: inline-flex;
    align-items: center;
    gap: 0.5rem;
  }

  /* Responsive */
  @media (max-width: 768px) {
    .container {
      padding: 1rem;
    }

    .player-header,
    .current-group-content,
    .input-group {
      flex-direction: column;
      gap: 1rem;
    }

    .group-card {
      flex-direction: column;
      gap: 1rem;
      text-align: center;
    }

    .group-meta {
      justify-content: center;
    }

    button {
      width: 100%;
    }
  }
</style>
