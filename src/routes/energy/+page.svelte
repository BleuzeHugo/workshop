<script>
  import { goto } from "$app/navigation";
  import { onDestroy } from "svelte";

  let role = null;
  let completed = false;
  let connections = [];
  let selectedA = null;

  const wires = [
    { a: 1, b: 3, color: "red" },
    { a: 2, b: 2, color: "blue" },
    { a: 3, b: 6, color: "green" },
    { a: 4, b: 5, color: "yellow" },
    { a: 5, b: 1, color: "purple" },
    { a: 6, b: 4, color: "orange" }
  ];

  function handleCompletion() {
    completed = true;
    localStorage.setItem("energyCompleted", "true");
    localStorage.setItem("gameFinished", "true");
    setTimeout(() => goto("/hub"), 3000);
  }

  function handleConnect(side, id) {
    if (side === "A") {
      selectedA = id;
      return;
    }

    if (side === "B" && selectedA) {
      const mapping = wires.find((w) => w.a === selectedA);
      const correctB = mapping ? mapping.b : null;

      if (id === correctB) {
        if (!connections.some((c) => c.a === selectedA || c.b === id)) {
          const newConns = [...connections, { a: selectedA, b: id }];
          connections = newConns;
          selectedA = null;
          if (newConns.length === wires.length) handleCompletion();
        } else {
          selectedA = null;
        }
      } else {
        alert("❌ Connexion incorrecte !");
        selectedA = null;
      }
    }
  }

  onDestroy(() => {
    connections = [];
  });
</script>

{#if completed}
  <div class="energy-room success">
    <h2>⚡ Salle de l'Énergie réussie !</h2>
    <p>Le courant circule à nouveau — redirection vers le Hub...</p>
  </div>
{:else if !role}
  <div class="energy-room">
    <h2>⚡ Salle de l'Énergie</h2>

    <div class="story-card-Energyroom">
      <p>
        ⚡ La centrale électrique de GaiaCorp est en surcharge !
        Des câbles endommagés empêchent l'énergie de circuler correctement
        dans le laboratoire. Communiquez et reliez les bonnes connexions
        pour rétablir le courant.
      </p>
    </div>

    <p>Choisis ton rôle :</p>
    <div class="role-buttons">
      <button on:click={() => (role = "electrician")}>🔌 Électricien</button>
      <button on:click={() => (role = "observer")}>👁️ Observateur</button>
    </div>
  </div>
{:else}
  <div class="energy-room">
    <h2>⚡ Salle de l'Énergie</h2>

    <div class="story-card-Energyroom">
      <p>
        ⚡ La centrale électrique de GaiaCorp est en surcharge !
        Des câbles endommagés empêchent l'énergie de circuler correctement
        dans le laboratoire. Communiquez et reliez les bonnes connexions
        pour rétablir le courant.
      </p>
    </div>

    {#if role === "electrician"}
      <div class="cable-zone">
        <h3>Relie les bons fils ⚙️</h3>
        <p>(Les couleurs sont masquées — communique avec les observateurs !)</p>

        <div class="wiring-container">
          <svg class="wiring-svg">
            {#each connections as c}
              <line
                x1="80"
                y1="{60 + (c.a - 1) * 60}"
                x2="420"
                y2="{60 + (c.b - 1) * 60}"
                stroke="#999"
                stroke-width="4"
                stroke-linecap="round"
              />
            {/each}
          </svg>

          <div class="side left-side">
            {#each wires as w}
              <button
                class="connector {selectedA === w.a ? 'active' : ''}"
                on:click={() => handleConnect('A', w.a)}
              >
                A{w.a}
              </button>
            {/each}
          </div>

          <div class="side right-side">
            {#each [1, 2, 3, 4, 5, 6] as b}
              <button
                class="connector"
                on:click={() => handleConnect('B', b)}
              >
                B{b}
              </button>
            {/each}
          </div>
        </div>
      </div>
    {:else}
      <div class="cable-zone">
        <h3>Observe les fils 🔍</h3>
        <p>Indique aux électriciens quelles connexions faire selon les couleurs.</p>

        <div class="wiring-container">
          <svg class="wiring-svg">
            {#each wires as w, i}
              <line
                x1="80"
                y1="{60 + i * 60}"
                x2="420"
                y2="{60 + (w.b - 1) * 60}"
                stroke="{w.color}"
                stroke-width="5"
                stroke-linecap="round"
              />
            {/each}
          </svg>

          <div class="side left-side">
            {#each wires as w}
              <div class="connector-label">A{w.a}</div>
            {/each}
          </div>

          <div class="side right-side">
            {#each [1, 2, 3, 4, 5, 6] as b}
              {#if wires.find(w => w.b === b)}
                <div class="connector-label">
                  B{b} ({wires.find(w => w.b === b).color})
                </div>
              {:else}
                <div class="connector-label">B{b} (gris)</div>
              {/if}
            {/each}
          </div>
        </div>
      </div>
    {/if}
  </div>
{/if}

<style>
  .energy-room {
    text-align: center;
    padding: 30px;
    background: linear-gradient(to bottom, #f4fff6, #e0faff);
    min-height: 100vh;
    font-family: "Poppins", sans-serif;
  }

  h2 {
    margin-bottom: 10px;
  }

  .role-buttons {
    margin-top: 20px;
  }

  .role-buttons button {
    margin: 10px;
    padding: 15px 30px;
    border: none;
    border-radius: 8px;
    background: #0078d7;
    color: white;
    font-size: 1.1rem;
    cursor: pointer;
    transition: transform 0.2s;
  }

  .role-buttons button:hover {
    transform: scale(1.05);
  }

  .cable-zone {
    margin-top: 30px;
  }

  .wiring-container {
    position: relative;
    display: flex;
    justify-content: space-between;
    width: 500px;
    margin: 40px auto;
  }

  .wiring-svg {
    position: absolute;
    top: 0;
    left: 0;
    width: 500px;
    height: 400px;
    pointer-events: none;
  }

  .side {
    display: flex;
    flex-direction: column;
    justify-content: space-around;
    height: 400px;
  }

  .connector,
  .connector-label {
    background: #ddd;
    border: none;
    border-radius: 50%;
    width: 50px;
    height: 50px;
    font-weight: bold;
    cursor: pointer;
    margin: 5px 0;
    display: flex;
    align-items: center;
    justify-content: center;
  }

  .connector.active {
    background: #0078d7;
    color: white;
  }

  .success {
    display: flex;
    flex-direction: column;
    justify-content: center;
    align-items: center;
    height: 100vh;
    background: linear-gradient(to bottom, #eafff1, #c7ffd4);
  }

  .story-card-Energyroom {
    background-color: #fff3e0;
    border: 2px solid #ffb74d;
    border-radius: 12px;
    padding: 20px;
    margin: 20px auto;
    max-width: 700px;
    text-align: center;
    font-size: 1.1rem;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    line-height: 1.5;
  }
</style>
