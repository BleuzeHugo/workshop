<script>
  let message = '';
  let response = '';

  async function sendMessage() {
    const res = await fetch('/api/test', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message })
    });
    const data = await res.json();
    response = data.reply || data.error;
  }
</script>

<h1>Test Escape Game</h1>

<input placeholder="Ton message" bind:value={message} />
<button on:click={sendMessage}>Envoyer au backend</button>

{#if response}
  <p><strong>Réponse backend :</strong> {response}</p>
{/if}
