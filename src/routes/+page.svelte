<script>
  import { onMount, onDestroy } from "svelte";
  import { getSocket } from "$lib/socket";
  import { page } from '$app/stores'; // ✅ Ajout pour la navigation
  import { goto } from '$app/navigation'; // ✅ Ajout pour la navigation

  let playerName = "";
  let player = null;
  let groups = [];
  let newGroupName = "";
  let loading = false;
  let socket;
  let currentPlayerGroup = null;

  onMount(async () => {
    socket = getSocket();
    
    socket.on('game:created', (newGame) => {
      console.log('🎮 Nouveau groupe créé:', newGame);
      if (!groups.find(g => g.id === newGame.id)) {
        groups = [newGame, ...groups];
      }
    });

    socket.on('game:updated', (updatedGame) => {
      console.log('🔄 Groupe mis à jour:', updatedGame);
      groups = groups.map(group => 
        group.id === updatedGame.id ? updatedGame : group
      );
    });

    if (player) {
      await loadPlayerMembership();
      await loadGroups();
    }
  });

  onDestroy(() => {
    if (socket) {
      socket.off('game:created');
      socket.off('game:updated');
    }
  });

  async function loadPlayerMembership() {
    if (!player) return;
    
    try {
      const res = await fetch(`/api/games/player/${player.id}/membership`);
      const data = await res.json();
      
      if (data.inGroup) {
        currentPlayerGroup = data.game;
        // ✅ Rediriger vers la page du groupe si déjà membre
        goto(`/group/${currentPlayerGroup.id}`);
      } else {
        currentPlayerGroup = null;
      }
    } catch (error) {
      console.error("Erreur chargement membership:", error);
    }
  }

  async function createPlayer() {
    if (!playerName.trim()) return;
    
    loading = true;
    try {
      const res = await fetch("/api/players", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: playerName })
      });
      
      if (!res.ok) throw new Error("Erreur création joueur");
      
      player = await res.json();
      currentPlayerGroup = null;
      await loadGroups();
    } catch (error) {
      console.error("Erreur:", error);
      alert("Erreur création joueur");
    } finally {
      loading = false;
    }
  }

  async function loadGroups() {
    try {
      const res = await fetch("/api/games");
      if (!res.ok) throw new Error("Erreur chargement");
      groups = await res.json();
    } catch (error) {
      console.error("Erreur:", error);
      alert("Erreur chargement groupes");
    }
  }

  async function createGroup() {
    if (!newGroupName.trim()) return;
    
    try {
      const res = await fetch("/api/games", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newGroupName })
      });
      
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Erreur création");
      }
      
      newGroupName = "";
    } catch (error) {
      alert(error.message);
    }
  }

  async function joinGroup(groupId) {
    if (currentPlayerGroup) {
      alert(`❌ Tu es déjà dans le groupe "${currentPlayerGroup.name}"`);
      return;
    }

    try {
      const res = await fetch(`/api/games/${groupId}/join`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ playerId: player.id })
      });
      
      const data = await res.json();
      
      if (data.error) {
        alert(data.error);
      } else {
        // ✅ Rediriger vers la page du groupe après avoir rejoint
        goto(`/group/${groupId}`);
      }
    } catch (error) {
      alert("Erreur connexion groupe");
    }
  }

  function disconnect() {
    player = null;
    playerName = "";
    groups = [];
    currentPlayerGroup = null;
  }
</script>

<div class="container">
  {#if !player}
    <div class="player-creation">
      <h1>🎮 Créer ton joueur</h1>
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
        {loading ? "Création..." : "Créer mon joueur"}
      </button>
    </div>
  {:else}
    <div class="game-section">
      <div style="display: flex; justify-content: space-between; align-items: center;">
        <h2>
          <span class="status-indicator status-online"></span>
          Bienvenue, <strong>{player.name}</strong> 👋
        </h2>
        <button class="disconnect-btn" on:click={disconnect}>
          Déconnexion
        </button>
      </div>

      {#if currentPlayerGroup}
        <div class="current-group">
          <h3>🎯 Tu es déjà dans un groupe</h3>
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <div>
              <strong>{currentPlayerGroup.name}</strong> 
            </div>
            <button class="join-btn" on:click={() => goto(`/group/${currentPlayerGroup.id}`)}>
              Rejoindre le groupe
            </button>
          </div>
        </div>
      {:else}
        <div class="game-section">
          <h3>🏗️ Créer un groupe</h3>
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
      {/if}

      <div class="game-section">
        <h3>👥 Groupes disponibles <span class="real-time-badge">Temps réel</span></h3>
        
        {#if groups.length === 0}
          <p style="text-align: center; color: #666; padding: 2rem;">
            Aucun groupe disponible. Sois le premier à en créer un ! 🚀
          </p>
        {:else}
          {#each groups as group}
            <div class="group-card">
              <div class="group-info">
                <div class="group-name">{group.name}</div>
                <div class="player-count">
                  {group.player_count}/4 joueurs
                  {#if group.player_count === 4}
                    <span style="color: #ff4444; margin-left: 0.5rem;">🔒 Complet</span>
                  {:else if group.player_count === 3}
                    <span style="color: #ff9800; margin-left: 0.5rem;">⚠️ Presque complet</span>
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
        {/if}
      </div>
    </div>
  {/if}
</div>

<style>
  /* Styles inchangés */
  .container {
    max-width: 600px;
    margin: 0 auto;
    padding: 2rem;
    font-family: Arial, sans-serif;
  }

  .player-creation, .game-section {
    background: #f5f5f5;
    padding: 1.5rem;
    border-radius: 12px;
    margin-bottom: 2rem;
    border: 2px solid #e0e0e0;
  }

  h1, h2, h3 {
    color: #333;
    margin-bottom: 1rem;
  }

  input {
    padding: 0.75rem;
    border: 2px solid #ddd;
    border-radius: 8px;
    font-size: 1rem;
    margin-right: 0.5rem;
    width: 200px;
  }

  input:focus {
    outline: none;
    border-color: #4CAF50;
  }

  button {
    padding: 0.75rem 1.5rem;
    border: none;
    border-radius: 8px;
    font-size: 1rem;
    cursor: pointer;
    transition: all 0.3s;
  }

  button:disabled {
    background: #ccc;
    cursor: not-allowed;
  }

  .create-btn {
    background: #4CAF50;
    color: white;
  }

  .create-btn:hover:not(:disabled) {
    background: #45a049;
    transform: translateY(-2px);
  }

  .join-btn {
    background: #2196F3;
    color: white;
    padding: 0.5rem 1rem;
    font-size: 0.9rem;
  }

  .join-btn:hover:not(:disabled) {
    background: #1976D2;
  }

  .disconnect-btn {
    background: #ff4444;
    color: white;
    margin-left: 1rem;
  }

  .disconnect-btn:hover {
    background: #cc0000;
  }

  .group-card {
    background: white;
    border: 1px solid #ddd;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1rem;
    display: flex;
    justify-content: space-between;
    align-items: center;
    box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    transition: transform 0.2s;
  }

  .group-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 4px 8px rgba(0,0,0,0.15);
  }

  .group-info {
    flex-grow: 1;
  }

  .group-name {
    font-weight: bold;
    font-size: 1.1rem;
    color: #333;
  }

  .player-count {
    color: #666;
    font-size: 0.9rem;
  }

  .real-time-badge {
    background: #4CAF50;
    color: white;
    padding: 0.25rem 0.5rem;
    border-radius: 12px;
    font-size: 0.8rem;
    margin-left: 0.5rem;
  }

  .current-group {
    background: #e8f5e8;
    border: 2px solid #4CAF50;
    border-radius: 8px;
    padding: 1rem;
    margin: 1rem 0;
  }
</style>