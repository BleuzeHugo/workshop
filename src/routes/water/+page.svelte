<script>
  import { goto } from "$app/navigation"; // SvelteKit, sinon adapte selon ton routeur

  // --- États principaux ---
  let currentGame = null; // "quiz" | "ph" | "qcm" | "final"
  let quizSolved = false;
  let phSolved = false;
  let qcmSolved = false;
  let message = "";

  // Lettres pour le code final
  const quizLetter = "E";
  const phLetter = "A";
  const qcmLetter = "U";

  // --- Données pH ---
  let phValues = { s1: "", s2: "", s3: "" };

  // --- Données QCM ---
  const pollutionQuestions = [
    { question: "Quel est le principal polluant des océans ?", options: ["Plastique", "Carburant", "Gaz à effet de serre"], answer: "Plastique" },
    { question: "Quelle substance chimique issue des engrais peut polluer l'eau ?", options: ["Sel", "Nitrates", "Oxygène"], answer: "Nitrates" },
    { question: "Quel type de déchets est le plus fréquent dans les rivières ?", options: ["Algues", "Métaux lourds", "Plastique"], answer: "Plastique" },
    { question: "Quelle action contribue à réduire la pollution de l'eau ?", options: ["Recycler les déchets", "Jeter dans les rivières", "Brûler le plastique"], answer: "Recycler les déchets" },
    { question: "Quel organisme peut être affecté par les polluants de l'eau ?", options: ["Poissons", "Mammifères", "Oiseaux"], answer: "Poissons" },
  ];

  let qcmQueue = [...pollutionQuestions];
  let currentQ = 0;
  let selectedAnswer = "";
  let qcmScore = 0;

  // --- Code final ---
  let codeInput = "";

  // === Fonctions utilitaires ===
  const handleBack = () => {
    currentGame = null;
    message = "";
  };

  // === Mini-jeu : pH ===
  const handlePHChange = (e) => {
    const { name, value } = e.target;
    if (/^\d*\.?\d{0,2}$/.test(value)) {
      phValues = { ...phValues, [name]: value };
    }
  };

  const checkPH = () => {
    const s1 = parseFloat(phValues.s1);
    const s2 = parseFloat(phValues.s2);
    const s3 = parseFloat(phValues.s3);

    if (
      isNaN(s1) || isNaN(s2) || isNaN(s3) ||
      s1 < 0 || s1 > 5 ||
      s2 < 5 || s2 > 9 ||
      s3 < 9 || s3 > 12
    ) {
      alert("Valeurs invalides pour chaque flacon. Respectez les intervalles !");
      return;
    }

    const avg = (s1 + s2 + s3) / 3;

    if (avg >= 6.8 && avg <= 7.2) {
      phSolved = true;
      alert(`✅ pH correct ! Moyenne : ${avg.toFixed(2)} → lettre obtenue : ${phLetter}`);
    } else {
      alert(`❌ pH incorrect. Moyenne actuelle : ${avg.toFixed(2)}`);
    }
  };

  // === Mini-jeu : QCM ===
  const handleAnswer = (e) => selectedAnswer = e.target.value;

  const checkQcm = () => {
    const question = qcmQueue[currentQ];
    if (selectedAnswer === question.answer) {
      qcmScore += 1;
      alert("✅ Bonne réponse !");
    } else {
      alert(`❌ Mauvaise réponse. La bonne réponse était : ${question.answer}`);
      qcmQueue.push(question);
    }

    if (qcmScore >= 3) {
      qcmSolved = true;
      alert(`🎉 QCM terminé ! Lettre obtenue : ${qcmLetter}`);
      return;
    }

    let newQueue = [...qcmQueue];
    newQueue.splice(currentQ, 1);
    qcmQueue = newQueue;
    currentQ = 0;
    selectedAnswer = "";
  };

  // === Code final ===
  const checkCode = () => {
    const finalCode = quizLetter + phLetter + qcmLetter; // "EAU"
    if (quizSolved && phSolved && qcmSolved && codeInput.toUpperCase() === finalCode) {
      alert("🎉 Eau sauvée ! Retour au Hub.");
      localStorage.setItem("waterCompleted", "true");
      goto("/"); // Retour au hub
    } else {
      message = "Code incorrect ou mini-jeux non terminés.";
    }
  };
</script>

<div class="water-room">
  <h2>🧪 Salle de l’eau - La rivière polluée</h2>

  <div class="story-card-Waterroom">
    <p>
      🌊 La rivière principale de GaiaCorp est gravement polluée par des substances chimiques et des déchets.
      Votre mission : purifier l’eau en réussissant les épreuves de chimie, de pH et de connaissance environnementale.
      Sauvez la vie aquatique avant qu’il ne soit trop tard !
    </p>
  </div>

  {#if !currentGame}
    <div class="choice-menu">
      <h3>Choisissez une catégorie :</h3>
      <div class="choice-buttons">
        <button on:click={() => currentGame = "quiz"} disabled={quizSolved}>🔬 Équation chimique</button>
        <button on:click={() => currentGame = "ph"} disabled={phSolved}>⚗️ Ajuster le pH</button>
        <button on:click={() => currentGame = "qcm"} disabled={qcmSolved}>🌍 Quiz pollution</button>
        {#if quizSolved && phSolved && qcmSolved}
          <button on:click={() => currentGame = "final"}>🔓 Code final</button>
        {/if}
      </div>
    </div>
  {/if}

  {#if currentGame === "quiz"}
    <div class="quiz-section">
      <h3>🔬 Équation chimique</h3>
      {#if !quizSolved}
        <ChemistryQuiz on:solve={() => quizSolved = true} />
      {:else}
        <p>✅ Énigme chimie résolue ! Lettre : {quizLetter}</p>
      {/if}
      <button class="check-btn" on:click={handleBack}>⬅ Retour</button>
    </div>
  {/if}

  {#if currentGame === "ph"}
    <div class="ph-section">
      <h3>⚗️ Ajuster le pH des solutions</h3>
      {#each Object.keys(phValues) as s, i}
        <div>
          <label>
            Flacon {i + 1} {s === "s1" ? "(0-5)" : s === "s2" ? "(5-9)" : "(9-12)"} :
          </label>
          <input type="number" step="0.01" name={s} bind:value={phValues[s]} on:input={handlePHChange} />
        </div>
      {/each}
      <button class="check-btn" on:click={checkPH}>Valider pH</button>
      {#if phSolved}
        <p>✅ pH correct ! Lettre obtenue : {phLetter}</p>
      {/if}
      <button class="check-btn" on:click={handleBack}>⬅ Retour</button>
    </div>
  {/if}

  {#if currentGame === "qcm"}
    <div class="qcm-section">
      <h3>🌍 Identifier les polluants</h3>
      {#if !qcmSolved && qcmQueue.length > 0}
        <div>
          <p>Réponses correctes : {qcmScore} / 3</p>
          <p>{qcmQueue[currentQ].question}</p>
          {#each qcmQueue[currentQ].options as opt}
            <div>
              <input type="radio" name="qcm" value={opt} bind:group={selectedAnswer} />
              <label>{opt}</label>
            </div>
          {/each}
          <button class="check-btn" on:click={checkQcm} disabled={!selectedAnswer}>Valider</button>
        </div>
      {:else if qcmSolved}
        <p>✅ QCM réussi ! Lettre obtenue : {qcmLetter}</p>
      {/if}
      <button class="check-btn" on:click={handleBack}>⬅ Retour</button>
    </div>
  {/if}

  {#if currentGame === "final"}
    <div class="code-section">
      <h3>🔓 Code final</h3>
      <p>Entrez le mot magique pour purifier la rivière.</p>
      <input type="text" bind:value={codeInput} placeholder="Entrez le code" />
      <button class="check-btn" on:click={checkCode}>Valider</button>
      {#if message}
        <p class="message">{message}</p>
      {/if}
      <button class="check-btn" on:click={handleBack}>⬅ Retour</button>
    </div>
  {/if}
</div>


<style>
  .water-room {
  height: 100vh;
  position: relative;
  background: linear-gradient(to bottom, #a3e4ff, #f0fbff);
  font-family: sans-serif;
  padding: 20px;
  overflow-y: auto;
}

h2, h3 { text-align: center; }

.ph-section, .quiz-section, .qcm-section, .code-section {
  border: 2px solid #0275d8;
  border-radius: 8px;
  padding: 10px;
  margin: 15px auto;
  max-width: 600px;
  background-color: rgba(255,255,255,0.8);
}

input, select {
  margin: 5px;
  padding: 5px;
  width: 100px;
}

.check-btn {
  padding: 8px 15px;
  margin-top: 10px;
  font-size: 1rem;
  border: none;
  border-radius: 5px;
  background-color: #0275d8;
  color: #fff;
  cursor: pointer;
}

.check-btn:hover {
  background-color: #025aa5;
}

.message {
  color: red;
  font-weight: bold;
  margin-top: 10px;
}

.story-card-Waterroom {
  background-color: #e0f7fa; /* bleu clair pour rappeler l'eau */
  border: 2px solid #00acc1; /* contour plus foncé */
  border-radius: 12px;
  padding: 20px;
  margin: 20px auto;
  max-width: 700px;
  text-align: center;
  font-size: 1.1rem;
  box-shadow: 0 4px 8px rgba(0,0,0,0.1);
  line-height: 1.5;
}

.choice-buttons button {
  background: linear-gradient(135deg, #00b4d8, #0096c7);
  color: white;
  border: none;
  padding: 14px 28px;
  border-radius: 50px;
  font-size: 1.1rem;
  cursor: pointer;
  font-weight: 600;
  letter-spacing: 0.5px;
  transition: all 0.25s ease;
  box-shadow: 0 4px 12px rgba(0, 150, 200, 0.3);
}

.choice-buttons button:hover {
  background: linear-gradient(135deg, #00d4ff, #48cae4);
  transform: scale(1.07);
  box-shadow: 0 0 12px rgba(0, 200, 255, 0.6);
}

.choice-buttons button:disabled {
  background: #4f6d7a;
  color: #ccc;
  cursor: not-allowed;
  box-shadow: none;
}

/* === Boutons de validation généraux (Valider, etc.) === */
.check-btn {
  background: linear-gradient(135deg, #00ffcc, #00b4d8);
  border: none;
  padding: 10px 22px;
  border-radius: 30px;
  color: #000;
  font-weight: 700;
  margin-top: 15px;
  cursor: pointer;
  transition: all 0.25s ease;
}

.check-btn:hover {
  transform: scale(1.05);
  background: linear-gradient(135deg, #00fff0, #48cae4);
}

/* boutons du menu */
.menu-btn {
  background: linear-gradient(135deg, #00b4d8, #0077b6);
  color: #fff;
  border: none;
  padding: 12px 22px;
  border-radius: 999px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 700;
  min-width: 170px;
  box-shadow: 0 6px 16px rgba(0,120,170,0.18);
  transition: transform .18s ease, box-shadow .18s ease;
}

.menu-btn:hover:not(:disabled) { transform: translateY(-4px); box-shadow: 0 10px 24px rgba(0,140,200,0.22); }

/* menu / choix */
.choice-menu {
  display: flex;
  flex-direction: column;
  align-items: center;
  margin-top: 26px;
}

.choice-buttons {
  display: flex;
  justify-content: center;
  gap: 18px;
  flex-wrap: wrap;
  margin-top: 14px;
  width: 100%;
  max-width: 900px;
  padding: 0 10px;
}

/* boutons du menu */
.menu-btn {
  background: linear-gradient(135deg, #00b4d8, #0077b6);
  color: #fff;
  border: none;
  padding: 12px 22px;
  border-radius: 999px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 700;
  min-width: 170px;
  box-shadow: 0 6px 16px rgba(0,120,170,0.18);
  transition: transform .18s ease, box-shadow .18s ease;
}

.menu-btn:hover:not(:disabled) { transform: translateY(-4px); box-shadow: 0 10px 24px rgba(0,140,200,0.22); }

/* bouton final (même look) */
.final-btn {
  background: linear-gradient(135deg, #00d4a6, #00b4d8);
}

/* état désactivé */
.menu-btn:disabled {
  background: #415a68;
  color: #cbd5da;
  cursor: not-allowed;
  transform: none;
  box-shadow: none;
  opacity: 0.9;
}

/* boutons valider / général */
.check-btn {
  background: linear-gradient(135deg, #00ffcc, #00b4d8);
  border: none;
  padding: 10px 18px;
  border-radius: 28px;
  color: #000;
  font-weight: 700;
  margin: 8px;
  cursor: pointer;
}

/* bouton retour discret */
.back-btn {
  background: transparent;
  color: #fff;
  border: 1px solid rgba(255,255,255,0.15);
  padding: 8px 14px;
  border-radius: 8px;
  cursor: pointer;
  margin-left: 8px;
}

/* rangée de contrôles */
.controls-row {
  margin-top: 12px;
  display: flex;
  justify-content: center;
  gap: 10px;
  align-items: center;
}

/* petits états */
.small-ok { color: #9fe6a0; font-weight: 700; margin-top: 8px; }
.message { color: #ffd166; margin-top: 10px; font-weight: 700; }

/* responsive : boutons en colonne sur petits écrans */
@media (max-width: 600px) {
  .choice-buttons { flex-direction: column; align-items: center; gap: 10px; }
  .menu-btn { min-width: 90%; }
}
</style>