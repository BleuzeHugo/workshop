<script>
  import { onMount, onDestroy } from "svelte";
  import { goto } from "$app/navigation";

  let zoneRange = [40, 60]; // zone verte
  let cursorY = 50;
  let timeInside = 0;
  let gameStarted = false;

  let zoneInterval;
  let checkInterval;

  // Déplacement automatique de la zone verte toutes les secondes
  function startZoneMovement() {
    zoneInterval = setInterval(() => {
      const shift = Math.floor(Math.random() * 21) - 10; // -10 à +10
      let [min, max] = zoneRange;

      let newMin = Math.max(0, Math.min(100, min + shift));
      let newMax = Math.max(newMin + 5, Math.min(100, max + shift));

      zoneRange = [newMin, newMax];
    }, 1000);
  }

  // Vérifie si le curseur reste dans la zone
  function startCheckingZone() {
    checkInterval = setInterval(() => {
      if (cursorY >= zoneRange[0] && cursorY <= zoneRange[1]) {
        timeInside = Math.min(30, timeInside + 0.1); // max 30s
      }

      if (timeInside >= 30) {
        clearIntervals();
        alert("✅ Mission réussie !");
        localStorage.setItem("airCompleted", "true");
        goto("/hub");
      }
    }, 100);
  }

  function startGame() {
    gameStarted = true;
    timeInside = 0;
    cursorY = 50;
    startZoneMovement();
    startCheckingZone();
  }

  function clearIntervals() {
    clearInterval(zoneInterval);
    clearInterval(checkInterval);
  }

  onDestroy(() => {
    clearIntervals();
  });

  function handleMouseMove(e) {
    const rect = e.currentTarget.getBoundingClientRect();
    let newY = ((e.clientY - rect.top) / rect.height) * 100;
    newY = Math.max(0, Math.min(100, 100 - newY));
    cursorY = newY;
  }
</script>

<div class="air-room">
  <h2>🌬️ Salle Air</h2>

  <div class="story-card-Airroom">
    🌬️ Une pollution invisible flotte dans l'air du laboratoire GaiaCorp.
    Vous devez guider le flux d'air à travers la zone sécurisée sans le faire
    dépasser les limites ! Restez concentrés et aidez GaiaCorp à maintenir
    un air pur et respirable.
  </div>

  {#if !gameStarted}
    <button class="start-button" on:click={startGame}>
      Démarrer la mission
    </button>
  {:else}
    <p>Temps dans la zone : {timeInside.toFixed(1)} / 30 s</p>

    <div class="gauge-container" on:mousemove={handleMouseMove}>
      <!-- Zone verte -->
      <div
        class="gauge-zone"
        style="
          top: {100 - zoneRange[1]}%;
          height: {zoneRange[1] - zoneRange[0]}%;
        "
      />
      <!-- Curseur joueur -->
      <div
        class="gauge-cursor"
        style="top: {100 - cursorY}%"
      />
    </div>

    <p>Déplace ta souris verticalement pour suivre la zone verte !</p>
  {/if}
</div>

<style>
  .air-room {
    text-align: center;
    color: #fff;
    padding: 20px;
    background: #264653;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    align-items: center;
  }

  .story-card-Airroom {
    background-color: #d0f4f7;
    border: 2px solid #00bcd4;
    border-radius: 12px;
    padding: 20px;
    margin: 20px 0;
    max-width: 700px;
    text-align: center;
    font-size: 1.1rem;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    line-height: 1.5;
    color: #000;
  }

  .start-button {
    padding: 12px 20px;
    font-size: 1rem;
    border-radius: 6px;
    border: none;
    cursor: pointer;
    background-color: #00ff99;
    color: #000;
    font-weight: bold;
    margin-top: 20px;
    transition: transform 0.2s ease;
  }

  .start-button:hover {
    transform: scale(1.05);
  }

  .gauge-container {
    position: relative;
    height: 400px;
    width: 60px;
    margin: 30px auto;
    background: #333;
    border-radius: 8px;
    cursor: pointer;
  }

  .gauge-zone {
    position: absolute;
    width: 100%;
    background: green;
    opacity: 0.5;
    border-radius: 4px;
  }

  .gauge-cursor {
    position: absolute;
    width: 100%;
    height: 6px;
    background: yellow;
  }
</style>
