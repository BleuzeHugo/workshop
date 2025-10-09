<script>
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";
  import { page } from "$app/stores";
  import {
    getSocket,
    joinGroup,
    updateValues,
    completeGame,
    isConnected,
    realTimeData
  } from "$lib/socket";
  import { getStoredPlayer } from "$lib/auth";

  // --- Variables principales ---
  let currentPlayer = null;
  let socket;
  let gameId = $page.params.id;
  let values = Array(6).fill("");
  let message = "";
  let gameFinished = false;
  let updateHistory = [];

  // --- Stores en temps réel ---
  $: connected = $isConnected;
  $: state = $realTimeData;
  $: syncedTimer = state?.timer;
  $: syncedValues = state?.syncedValues;
  $: timeLeft = syncedTimer?.timeLeft ?? null;
  $: lastUpdatedBy = state?.lastUpdatedBy;

  // --- Synchronisation des valeurs reçues ---
  $: if (syncedValues && Array.isArray(syncedValues)) {
    if (JSON.stringify(syncedValues) !== JSON.stringify(values)) {
      values = [...syncedValues];
      if (lastUpdatedBy && lastUpdatedBy !== currentPlayer?.name) {
        updateHistory.unshift({
          playerName: lastUpdatedBy,
          timestamp: new Date()
        });
        if (updateHistory.length > 5) updateHistory.pop();
      }
    }
  }

  // --- Détection de la fin du temps ---
  $: if (state.gameState?.timeUp && !gameFinished) {
    message = "⏰ Temps écoulé ! La partie est terminée.";
    gameFinished = true;
  }

  // --- Initialisation au montage ---
  onMount(() => {
    currentPlayer = getStoredPlayer();
    if (!currentPlayer) {
      goto("/");
      return;
    }

    socket = getSocket();
    joinGroup(gameId);

    console.log("🎮 Rejoint le groupe:", gameId);
  });

  onDestroy(() => {
    console.log("👋 Déconnexion de la salle d’eau");
  });

  // --- Gestion des champs ---
  function handleChange(index, value) {
    if (gameFinished) return;
    value = value.replace(",", ".");
    if (!/^(\d{0,2})(\.\d{0,2})?$/.test(value) && value !== "") return;

    const newValues = [...values];
    newValues[index] = value;
    values = newValues;

    updateValues(gameId, newValues, currentPlayer.name);
  }

  // --- Vérification du pH ---
  function checkAverage() {
    if (gameFinished) return;
    const nums = values.map(v => parseFloat(v)).filter(v => !isNaN(v));

    if (nums.length < 6) {
      message = "⚠️ Remplis toutes les cases avant de valider !";
      return;
    }

    const avg = nums.reduce((a, b) => a + b, 0) / nums.length;

    if (avg >= 6.8 && avg <= 7.2) {
      message = "✅ Parfait ! Le pH est équilibré 🌊";
      gameFinished = true;
      completeGame(gameId, currentPlayer.id);
    } else {
      message = `❌ Le pH moyen est ${avg.toFixed(2)} — essaie d'atteindre entre 6.8 et 7.2`;
    }
  }

  // --- Formatage du timer ---
  function formatTime(seconds) {
    if (seconds == null) return "--:--";
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  }

  function formatTimeAgo(date) {
    const now = new Date();
    const diff = Math.floor((now - date) / 1000);
    if (diff < 60) return "À l'instant";
    const mins = Math.floor(diff / 60);
    return `Il y a ${mins} min`;
  }
</script>

<!-- ========================== -->
<!--   INTERFACE PRINCIPALE     -->
<!-- ========================== -->

<div class="water-room">
  <div class="sync-status">
    <div>
      {#if connected}
        🟢 Connecté au groupe <strong>{gameId}</strong>
      {:else}
        🔴 Déconnecté
      {/if}
    </div>
    <div class="timer-display {timeLeft < 60 ? 'warning' : ''}">
      ⏱️ {timeLeft !== null ? formatTime(timeLeft) : "En attente..."}
    </div>
  </div>

  <h2>💧 Salle de l'Eau</h2>
  <p class="instruction">
    Travaillez ensemble ! Obtenez un pH entre <strong>6.8</strong> et <strong>7.2</strong>.
  </p>

  {#if updateHistory.length > 0}
    <div class="update-history">
      <h4>📝 Dernières modifications :</h4>
      {#each updateHistory as update}
        <div class="update-item">
          <span class="player">{update.playerName}</span>
          <span class="time">{formatTimeAgo(update.timestamp)}</span>
        </div>
      {/each}
    </div>
  {/if}

  {#if gameFinished}
    <div class="game-finished-message">
      <h3>{message}</h3>
    </div>
  {:else}
    <div class="input-grid">
      {#each values as v, i}
        <input
          type="text"
          bind:value={values[i]}
          on:input={(e) => handleChange(i, e.target.value)}
          placeholder="0.0"
        />
      {/each}
    </div>

    <button class="check-btn" on:click={checkAverage}>
      Vérifier le pH
    </button>

    <p class="current-ph">
      pH actuel :
      {(values.filter(v => v !== "").length === 6)
        ? (values.map(v => parseFloat(v) || 0).reduce((a, b) => a + b, 0) / 6).toFixed(2)
        : "--"}
    </p>

    <p
      class:success={message.includes("✅")}
      class:error={message.includes("❌")}
      class:warning={message.includes("⚠️")}
    >
      {message}
    </p>
  {/if}
</div>

<!-- ========================== -->
<!--           STYLES           -->
<!-- ========================== -->

<style>
  .water-room {
    max-width: 700px;
    margin: 0 auto;
    padding: 2rem;
    text-align: center;
    background: rgba(255, 255, 255, 0.9);
    border-radius: 12px;
    box-shadow: 0 0 10px rgba(0, 0, 0, 0.1);
  }

  .sync-status {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 1rem;
    padding: 0.5rem 1rem;
    background: #e3f2fd;
    border-radius: 8px;
  }

  .timer-display {
    font-weight: bold;
    font-size: 1.5rem;
    color: #2196f3;
  }

  .timer-display.warning {
    color: #ff9800;
    animation: pulse 1s infinite;
  }

  @keyframes pulse {
    0%, 100% { opacity: 1; }
    50% { opacity: 0.6; }
  }

  .input-grid {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 1rem;
    margin: 2rem 0;
  }

  input {
    padding: 1rem;
    font-size: 1.1rem;
    text-align: center;
    border-radius: 8px;
    border: 2px solid #ddd;
    transition: 0.2s;
  }

  input:focus {
    outline: none;
    border-color: #2196f3;
    background: #e3f2fd;
  }

  .check-btn {
    background: #2196f3;
    color: white;
    border: none;
    padding: 1rem 2rem;
    border-radius: 8px;
    cursor: pointer;
    font-size: 1.1rem;
    margin-bottom: 1rem;
    transition: 0.2s;
  }

  .check-btn:hover {
    background: #1976d2;
  }

  .current-ph {
    font-weight: bold;
    margin-top: 1rem;
  }

  .success { color: #4caf50; }
  .error { color: #f44336; }
  .warning { color: #ff9800; }

  .update-history {
    background: #f9f9f9;
    border-radius: 8px;
    padding: 1rem;
    margin-bottom: 1.5rem;
    text-align: left;
  }

  .update-item {
    display: flex;
    justify-content: space-between;
    padding: 0.3rem 0;
    font-size: 0.9rem;
  }

  .update-item .player {
    font-weight: bold;
    color: #1976d2;
  }
</style>
