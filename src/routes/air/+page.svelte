<h1>Test Escape Game</h1>

<input placeholder="Ton message" bind:value={message} />
<button on:click={sendMessage}>Envoyer au backend</button>

{#if response}
  <p><strong>Réponse backend :</strong> {response}</p>
{/if}