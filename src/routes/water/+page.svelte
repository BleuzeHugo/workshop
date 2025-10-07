<script>
  import { onMount } from 'svelte';
  import { navigate } from '$app/navigation';
  import Timer from './Timer.svelte'; // ✅ Import du Timer

  // États
  let values = Array(6).fill("");
  let message = "";
  
  // Constantes
  const TOTAL_TIME = 10 * 60; // même durée que le Hub

  // pH actuel calculé
  $: currentPH = values.filter(v => v !== "").length === 6 
    ? (values.map(parseFloat).reduce((a, b) => a + b, 0) / 6).toFixed(2)
    : "--";

  // Gestion du changement d'input
  function handleChange(index, value) {
    value = value.replace(",", ".");
    if (!/^(\d{0,2})(\.\d{0,2})?$/.test(value) && value !== "") return;
    
    values = values.map((val, i) => i === index ? value : val);
  }

  // Vérification de la moyenne
  function checkAverage() {
    const numericValues = values.map(parseFloat).filter(v => !isNaN(v));
    
    if (numericValues.length < 6) {
      message = "⚠️ Remplis toutes les cases avant de valider !";
      return;
    }

    const integers = numericValues.map(v => Math.floor(v));
    const hasDuplicate = integers.some(
      (val, idx) => integers.indexOf(val) !== idx
    );
    
    if (hasDuplicate) {
      message = "❌ Deux valeurs commencent par le même chiffre !";
      return;
    }

    const avg = numericValues.reduce((sum, val) => sum + val, 0) / numericValues.length;

    if (avg >= 6.8 && avg <= 7.2) {
      message = "✅ Parfait ! Le pH est équilibré 🌊";
      localStorage.setItem("waterCompleted", "true");
      setTimeout(() => navigate("/"), 2000);
    } else {
      message = `❌ Le pH moyen est ${avg.toFixed(2)} — essaie d'atteindre entre 6.8 et 7.2`;
    }
  }

  // Navigation vers le hub
  function goToHub() {
    navigate("/");
  }
</script>

<div class="water-room">
  <!-- ✅ Timer en haut à droite -->
  <div class="water-timer">
    <Timer {TOTAL_TIME} />
  </div>

  <h2>💧 Salle de l'Eau</h2>
  <p class="instruction">
    Il faut obtenir un pH entre <strong>6.8</strong> et <strong>7.2</strong>
    pour sauver les espèces maritimes.
    Fais vite !!
  </p>

  <div class="input-grid">
    {#each values as value, index}
      <input
        type="text"
        bind:value={values[index]}
        on:input={(e) => handleChange(index, e.target.value)}
        placeholder="0.0"
      />
    {/each}
  </div>

  <button class="check-btn" on:click={checkAverage}>
    Vérifier le pH
  </button>

  <p class="current-ph">pH actuel de l'eau : {currentPH}</p>
  
  <p class:success={message.includes('✅')}
     class:error={message.includes('❌')} 
     class:warning={message.includes('⚠️')}>
    {message}
  </p>

  <button class="hub-btn" on:click={goToHub}>
    Retour au Hub
  </button>
</div>