import express from "express";
import pool from "../../config/db.js";

const router = express.Router();

// POST /api/party/:gameId/start - Démarrer une partie avec thème aléatoire
router.post("/:gameId/start", async (req, res) => {
  const { gameId } = req.params;

  try {
    // Vérifier si le jeu existe
    const [games] = await pool.query("SELECT id FROM game WHERE id = ?", [gameId]);
    if (games.length === 0) return res.status(404).json({ error: "Jeu non trouvé" });

    // Vérifier s'il y a au moins 2 joueurs
    const [[{ player_count }]] = await pool.query(
      "SELECT COUNT(*) AS player_count FROM player_game WHERE game_id = ?",
      [gameId]
    );
    if (player_count < 2) return res.status(400).json({ error: "Il faut au moins 2 joueurs" });

    // Vérifier si tous les joueurs sont prêts
    const [[{ ready_count }]] = await pool.query(
      "SELECT COUNT(*) AS ready_count FROM player_game WHERE game_id = ? AND is_ready = TRUE",
      [gameId]
    );
    if (ready_count < player_count) return res.status(400).json({ error: "Tous les joueurs doivent être prêts" });

    // Vérifier si une partie est déjà en cours pour ce groupe
    const [existingLevels] = await pool.query(
      "SELECT level_id FROM game_level WHERE game_id = ? LIMIT 1",
      [gameId]
    );
    if (existingLevels.length > 0) return res.status(400).json({ error: "Une partie est déjà en cours pour ce groupe" });

    // Récupérer tous les thèmes disponibles
    const [themes] = await pool.query("SELECT id, name FROM theme");
    if (themes.length === 0) return res.status(400).json({ error: "Aucun thème disponible" });

    // Sélectionner un thème aléatoire
    const randomTheme = themes[Math.floor(Math.random() * themes.length)];
    
    // Normaliser le nom du thème pour la redirection
    const normalizedTheme = {
      id: randomTheme.id,
      name: randomTheme.name,
      route: `/${randomTheme.name.toLowerCase()}`
    };

    // CRÉER UN NOUVEAU LEVEL pour ce thème
    const [levelResult] = await pool.query(
      "INSERT INTO level (theme_id, required_score) VALUES (?, ?)",
      [randomTheme.id, 100] // Score requis par défaut
    );
    const newLevelId = levelResult.insertId;

    // Créer la relation entre le groupe et le nouveau level
    await pool.query(
      "INSERT INTO game_level (game_id, level_id, is_finished) VALUES (?, ?, FALSE)",
      [gameId, newLevelId]
    );

    // Mettre à jour le jeu pour indiquer qu'il a commencé
    await pool.query(
      "UPDATE game SET current_level = ?, is_finished = FALSE WHERE id = ?",
      [newLevelId, gameId]
    );

    // Réinitialiser le statut "prêt" de tous les joueurs pour la prochaine partie
    await pool.query(
      "UPDATE player_game SET is_ready = FALSE WHERE game_id = ?",
      [gameId]
    );

    // Récupérer les données mises à jour du jeu
    const [[updatedGame]] = await pool.query(`
      SELECT g.*, 
             COUNT(DISTINCT gl.level_id) as total_levels,
             COUNT(DISTINCT CASE WHEN gl.is_finished = TRUE THEN gl.level_id END) as completed_levels
      FROM game g
      LEFT JOIN game_level gl ON g.id = gl.game_id
      WHERE g.id = ?
      GROUP BY g.id
    `, [gameId]);

    // 🔥 CONFIGURATION DU TIMER (10 minutes = 600 secondes)
    const timerDuration = 600;
    const startedAt = new Date().toISOString();

    console.log(`🚀 Partie démarrée pour group:${gameId} - Timer: ${timerDuration}s - Thème: ${normalizedTheme.name}`);

    // 🔥 ÉMETTRE L'ÉVÉNEMENT DE DÉBUT DE PARTIE AVEC LES INFOS TIMER
    req.app.locals.io.to(`group:${gameId}`).emit('game:started', {
      game: updatedGame,
      theme: normalizedTheme,
      levelId: newLevelId,
      timerDuration: timerDuration,
      timerStartedAt: startedAt,
      message: `Partie commencée - Thème : ${normalizedTheme.name} - Timer: 10 minutes`
    });

    // 🔥 ÉMETTRE DIRECTEMENT LE DÉMARRAGE DU TIMER POUR TOUS LES JOUEURS
    req.app.locals.io.to(`group:${gameId}`).emit('timer:started', {
      duration: timerDuration,
      startedAt: startedAt,
      gameId: gameId,
      levelId: newLevelId,
      theme: normalizedTheme.name
    });

    // 🔥 METTRE À JOUR LA BASE DE DONNÉES AVEC LES INFOS TIMER (optionnel)
    await pool.query(
      "UPDATE game SET timer_started_at = ?, timer_duration = ? WHERE id = ?",
      [startedAt, timerDuration, gameId]
    );

    res.json({ 
      success: true, 
      message: "Partie créée avec succès",
      game: updatedGame,
      theme: normalizedTheme,
      levelId: newLevelId,
      timer: {
        duration: timerDuration,
        startedAt: startedAt
      }
    });

  } catch (err) {
    console.error('❌ Erreur lors du démarrage de la partie:', err);
    res.status(500).json({ error: "Erreur serveur lors du démarrage de la partie" });
  }
});

// PUT /api/games/:gameId/level/:levelId/finish - Le groupe termine un niveau
router.put("/:gameId/level/:levelId/finish", async (req, res) => {
  const { gameId, levelId } = req.params;

  try {
    // Vérifier si le jeu existe
    const [games] = await pool.query("SELECT id FROM game WHERE id = ?", [gameId]);
    if (games.length === 0) return res.status(404).json({ error: "Jeu non trouvé" });

    // Vérifier si le niveau existe et appartient à ce jeu
    const [levels] = await pool.query(`
      SELECT l.*, t.name as theme_name 
      FROM level l 
      JOIN theme t ON l.theme_id = t.id 
      JOIN game_level gl ON l.id = gl.level_id
      WHERE l.id = ? AND gl.game_id = ?`,
      [levelId, gameId]
    );
    if (levels.length === 0) return res.status(404).json({ error: "Niveau non trouvé pour ce groupe" });

    const level = levels[0];

    // Marquer le niveau comme terminé pour le groupe
    await pool.query(
      "UPDATE game_level SET is_finished = TRUE WHERE game_id = ? AND level_id = ?",
      [gameId, levelId]
    );

    // Marquer le jeu comme terminé aussi
    await pool.query(
      "UPDATE game SET is_finished = TRUE WHERE id = ?",
      [gameId]
    );

    // Émettre l'événement de niveau terminé
    req.app.locals.io.to(`group:${gameId}`).emit('level:completed', {
      gameId,
      levelId,
      themeId: level.theme_id,
      themeName: level.theme_name,
      gameFinished: true,
      message: `Partie terminée - Thème ${level.theme_name} complété !`
    });

    res.json({ 
      success: true, 
      message: "Niveau terminé avec succès",
      gameFinished: true
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/games/:gameId/progress - Progression de la partie
router.get("/:gameId/progress", async (req, res) => {
  const { gameId } = req.params;

  try {
    // Récupérer les infos du jeu avec progression
    const [games] = await pool.query(`
      SELECT 
        g.*,
        COUNT(DISTINCT gl.level_id) as total_levels,
        COUNT(DISTINCT CASE WHEN gl.is_finished = TRUE THEN gl.level_id END) as completed_levels
      FROM game g
      LEFT JOIN game_level gl ON g.id = gl.game_id
      WHERE g.id = ?
      GROUP BY g.id
    `, [gameId]);

    if (games.length === 0) {
      return res.status(404).json({ error: "Jeu non trouvé" });
    }

    const game = games[0];

    // Récupérer les niveaux avec leurs thèmes et statut
    const [levels] = await pool.query(`
      SELECT 
        l.id as level_id,
        l.theme_id,
        t.name as theme_name,
        gl.is_finished,
        l.required_score
      FROM level l
      JOIN theme t ON l.theme_id = t.id
      LEFT JOIN game_level gl ON l.id = gl.level_id AND gl.game_id = ?
      ORDER BY l.id
    `, [gameId]);

    res.json({ 
      game: game,
      levels: levels
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/games/:gameId/current-level - Niveau actuel du groupe
router.get("/:gameId/current-level", async (req, res) => {
  const { gameId } = req.params;

  try {
    const [games] = await pool.query("SELECT current_level FROM game WHERE id = ?", [gameId]);
    
    if (games.length === 0) {
      return res.status(404).json({ error: "Jeu non trouvé" });
    }

    const currentLevel = games[0].current_level;

    // Récupérer les infos du niveau actuel
    const [levels] = await pool.query(`
      SELECT l.*, t.name as theme_name
      FROM level l
      JOIN theme t ON l.theme_id = t.id
      WHERE l.id = ?
    `, [currentLevel]);

    if (levels.length === 0) {
      return res.json({ 
        currentLevel: currentLevel,
        levelInfo: null,
        message: "Niveau actuel non trouvé"
      });
    }

    res.json({ 
      currentLevel: currentLevel,
      levelInfo: levels[0]
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.put("/:gameId/level/current/finish", async (req, res) => {
  const { gameId } = req.params;
  const { playerId } = req.body;

  try {
    // Récupérer le niveau actuel du jeu
    const [games] = await pool.query(
      "SELECT current_level FROM game WHERE id = ?",
      [gameId]
    );
    
    if (games.length === 0) return res.status(404).json({ error: "Jeu non trouvé" });
    
    const currentLevelId = games[0].current_level;
    
    if (!currentLevelId) return res.status(400).json({ error: "Aucun niveau en cours" });

    // Marquer le niveau comme terminé
    await pool.query(
      "UPDATE game_level SET is_finished = TRUE WHERE game_id = ? AND level_id = ?",
      [gameId, currentLevelId]
    );

    // Marquer le jeu comme terminé
    await pool.query(
      "UPDATE game SET is_finished = TRUE WHERE id = ?",
      [gameId]
    );

    // Récupérer le thème utilisé
    const [themes] = await pool.query(`
      SELECT t.* 
      FROM theme t
      JOIN level l ON t.id = l.theme_id
      WHERE l.id = ?
    `, [currentLevelId]);

    const usedTheme = themes[0];

    // Récupérer les thèmes non utilisés
    const [availableThemes] = await pool.query(`
      SELECT t.* 
      FROM theme t
      WHERE t.id NOT IN (
        SELECT DISTINCT l.theme_id 
        FROM level l 
        JOIN game_level gl ON l.id = gl.level_id 
        JOIN game g ON gl.game_id = g.id 
        WHERE g.id = ?
      )
    `, [gameId]);

    let nextTheme = null;

    // Si des thèmes sont disponibles, en sélectionner un aléatoirement
    if (availableThemes.length > 0) {
      nextTheme = availableThemes[Math.floor(Math.random() * availableThemes.length)];
      nextTheme.route = `/${nextTheme.name.toLowerCase()}`;
    }

    // Émettre l'événement de fin de partie
    req.app.locals.io.to(`group:${gameId}`).emit('game:completed', {
      gameId,
      levelId: currentLevelId,
      theme: usedTheme,
      nextTheme,
      message: "Partie terminée avec succès !"
    });

    res.json({
      success: true,
      message: "Partie terminée",
      nextTheme
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ Gestion de la synchronisation via Socket.IO (remplace la section WebSocket)

// POST /api/party/:gameId/timer/start - Démarrer le timer global pour un jeu
router.post('/:gameId/timer/start', async (req, res) => {
  const { gameId } = req.params;
  const { duration } = req.body; // en secondes

  try {
    // Émettre le démarrage du timer à tous
    req.app.locals.io.to(`group:${gameId}`).emit('timer:started', {
      duration,
      startedAt: new Date().toISOString()
    });

    res.json({ success: true, message: 'Timer démarré' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/party/:gameId/sync/timer - Synchroniser le timer (remplace WebSocket)
router.post('/:gameId/sync/timer', async (req, res) => {
  const { gameId } = req.params;
  const { timeLeft, playerId } = req.body;

  try {
    // Synchroniser le timer pour tous
    req.app.locals.io.to(`group:${gameId}`).emit('timer:update', {
      timeLeft,
      updatedBy: playerId
    });

    res.json({ success: true, message: 'Timer synchronisé' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/party/:gameId/sync/values - Synchroniser les valeurs (remplace WebSocket)
router.post('/:gameId/sync/values', async (req, res) => {
  const { gameId } = req.params;
  const { values, playerId, playerName } = req.body;

  try {
    // Mettre à jour les valeurs pour tous
    req.app.locals.io.to(`group:${gameId}`).emit('values:updated', {
      values,
      updatedBy: playerId,
      playerName
    });

    res.json({ success: true, message: 'Valeurs synchronisées' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/party/:gameId/complete - Marquer la partie comme terminée (remplace WebSocket)
router.post('/:gameId/complete', async (req, res) => {
  const { gameId } = req.params;
  const { playerId } = req.body;

  try {
    await handleGameCompletion(gameId, { playerId });
    res.json({ success: true, message: 'Partie terminée' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// ✅ Fonction pour gérer la fin de partie
async function handleGameCompletion(gameId, data) {
  try {
    // Récupérer le niveau actuel du jeu
    const [games] = await pool.query(
      "SELECT current_level FROM game WHERE id = ?",
      [gameId]
    );
    
    if (games.length === 0) return;
    
    const currentLevelId = games[0].current_level;
    
    if (!currentLevelId) return;

    // Marquer le niveau comme terminé
    await pool.query(
      "UPDATE game_level SET is_finished = TRUE WHERE game_id = ? AND level_id = ?",
      [gameId, currentLevelId]
    );

    // Marquer le jeu comme terminé
    await pool.query(
      "UPDATE game SET is_finished = TRUE WHERE id = ?",
      [gameId]
    );

    // Récupérer le thème utilisé
    const [themes] = await pool.query(`
      SELECT t.* 
      FROM theme t
      JOIN level l ON t.id = l.theme_id
      WHERE l.id = ?
    `, [currentLevelId]);

    const usedTheme = themes[0];

    // Récupérer les thèmes non utilisés
    const [availableThemes] = await pool.query(`
      SELECT t.* 
      FROM theme t
      WHERE t.id NOT IN (
        SELECT DISTINCT l.theme_id 
        FROM level l 
        JOIN game_level gl ON l.id = gl.level_id 
        JOIN game g ON gl.game_id = g.id 
        WHERE g.id = ?
      )
    `, [gameId]);

    let nextTheme = null;

    // Si des thèmes sont disponibles, en sélectionner un aléatoirement
    if (availableThemes.length > 0) {
      nextTheme = availableThemes[Math.floor(Math.random() * availableThemes.length)];
      nextTheme.route = `/${nextTheme.name.toLowerCase()}`;
    }

    // Émettre l'événement de fin de partie
    req.app.locals.io.to(`group:${gameId}`).emit('game:completed', {
      gameId,
      levelId: currentLevelId,
      theme: usedTheme,
      nextTheme,
      completedBy: data.playerId,
      message: "Partie terminée avec succès !"
    });

  } catch (err) {
    console.error(err);
  }
}

export default router;