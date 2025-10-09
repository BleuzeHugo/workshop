<script>
  import { goto } from "$app/navigation";

  // Coefficients (a, b, c, d)
  let coeffs = ["", "", "", ""];
  let message = "";
  let solved = false;

  // Vérifie si l'équation chimique est équilibrée
  function checkEquation(values) {
    const [a, b, c, d] = values.map(Number);
    if ([a, b, c, d].some((x) => isNaN(x) || x <= 0)) return false;

    const C_left = 3 * a;
    const H_left = 8 * a;
    const O_left = 2 * b;

    const C_right = 1 * c;
    const H_right = 2 * d;
    const O_right = 2 * c + 1 * d;

    return C_left === C_right && H_left === H_right && O_left === O_right;
  }

  function handleChange(index, value) {
    const updated = [...coeffs];
    updated[index] = value;
    coeffs = updated;
  }

  function handleSubmit() {
    if (checkEquation(coeffs)) {
      message = "✅ Correct ! La réaction est équilibrée.";
      solved = true;
      localStorage.setItem("chemCompleted", "true");
      setTimeout(() => goto("/hub"), 1500);
    } else {
      message = "❌ Incorrect, réessaie !";
    }
  }
</script>

<div class="chem-quiz">
  <h2>⚗️ Équilibrer la combustion du propane</h2>
  <p>Remplis les coefficients entiers pour équilibrer l’équation :</p>

  <div class="equation">
    <input
      type="number"
      bind:value={coeffs[0]}
      on:input={(e) => handleChange(0, e.target.value)}
      disabled={solved}
    />
    C₃H₈ + 
    <input
      type="number"
      bind:value={coeffs[1]}
      on:input={(e) => handleChange(1, e.target.value)}
      disabled={solved}
    />
    O₂ → 
    <input
      type="number"
      bind:value={coeffs[2]}
      on:input={(e) => handleChange(2, e.target.value)}
      disabled={solved}
    />
    CO₂ + 
    <input
      type="number"
      bind:value={coeffs[3]}
      on:input={(e) => handleChange(3, e.target.value)}
      disabled={solved}
    />
    H₂O
  </div>

  <button on:click={handleSubmit} disabled={solved}>Valider</button>

  {#if message}
    <p class="chem-message">{message}</p>
  {/if}

  {#if solved}
    <p class="chem-code">
      🔤 Lettre du code final : <strong>E</strong>
    </p>
  {/if}
</div>

<style>
  .chem-quiz {
    background: #e8faff;
    border: 2px solid #0275d8;
    border-radius: 10px;
    padding: 20px;
    width: 90%;
    max-width: 600px;
    text-align: center;
    margin: 20px auto;
    box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
    color: #000;
  }

  .equation {
    margin: 15px 0;
    font-size: 1.2rem;
  }

  .equation input {
    width: 45px;
    text-align: center;
    font-size: 1rem;
    margin: 0 5px;
    border-radius: 5px;
    border: 1px solid #0275d8;
    background: #fff;
    padding: 4px;
  }

  button {
    margin-top: 10px;
    padding: 10px 16px;
    background-color: #0275d8;
    color: #fff;
    border: none;
    border-radius: 6px;
    font-weight: bold;
    cursor: pointer;
    transition: 0.2s;
  }

  button:hover {
    background-color: #025aa5;
  }

  .chem-message {
    margin-top: 10px;
    font-weight: bold;
  }

  .chem-code {
    margin-top: 15px;
    font-size: 1.2rem;
    color: #0275d8;
  }
</style>
