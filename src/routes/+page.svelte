<script>
  import { onMount } from "svelte";

  let playerName = "";
  let player = null;
  let groups = [];
  let newGroupName = "";

  async function createPlayer() {
    const res = await fetch("http://localhost:3000/api/players", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: playerName })
    });
    player = await res.json();
    await loadGroups();
  }

  async function loadGroups() {
    const res = await fetch("http://localhost:3000/api/games");
    groups = await res.json();
  }

  async function createGroup() {
    if (!newGroupName) return;
    const res = await fetch("http://localhost:3000/api/games", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newGroupName })
    });
    const data = await res.json();
    groups.push({ ...data, player_count: 0 });
    newGroupName = "";
  }

  async function joinGroup(groupId) {
    const res = await fetch(`http://localhost:3000/api/games/${groupId}/join`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ playerId: player.id })
    });
    const data = await res.json();
    if (data.error) alert(data.error);
    else alert("Tu as rejoint le groupe !");
    await loadGroups();
  }

  onMount(() => {
    if (player) loadGroups();
  });
</script>

{#if !player}
  <h1>Créer ton joueur</h1>
  <input placeholder="Ton pseudo" bind:value={playerName} />
  <button on:click={createPlayer} disabled={!playerName}>Créer</button>
{:else}
  <h2>Bienvenue, {player.name} 👋</h2>

  <section>
    <h3>Créer un groupe</h3>
    <input placeholder="Nom du groupe" bind:value={newGroupName} />
    <button on:click={createGroup}>Créer</button>
  </section>

  <section>
    <h3>Groupes disponibles</h3>
    {#each groups as group}
      <div style="margin-bottom:8px; border:1px solid #ccc; padding:8px; border-radius:8px;">
        <strong>{group.name}</strong> ({group.player_count}/4 joueurs)
        <button on:click={() => joinGroup(group.id)} disabled={group.player_count >= 4}>
          {group.player_count >= 4 ? "Complet" : "Rejoindre"}
        </button>
      </div>
    {/each}
  </section>
{/if}
