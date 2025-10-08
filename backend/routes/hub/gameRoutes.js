import express from "express";
import pool from "../../config/db.js";

const router = express.Router();

// GET /api/games - Liste tous les jeux avec le nombre de joueurs
router.get("/", async (_req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT 
        g.*, 
        COUNT(pg.player_id) AS player_count
      FROM game g
      LEFT JOIN player_game pg ON g.id = pg.game_id
      GROUP BY g.id
    `);
    res.json(rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/games - Créer un nouveau jeu
router.post("/", async (req, res) => {
  const { name } = req.body;

  if (!name) {
    return res.status(400).json({ error: "Nom du groupe requis" });
  }

  try {
    const [result] = await pool.query("INSERT INTO game (name) VALUES (?)", [
      name,
    ]);

    const newGame = { id: result.insertId, name, player_count: 0 };

    req.app.locals.io.emit("game:created", newGame);

    res.json(newGame);
    // res.json({ id: result.insertId, name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/:groupId", async (req, res) => {
  const { groupId } = req.params;

  try {
    const [games] = await pool.query(`
      SELECT 
        g.*, 
        COUNT(pg.player_id) AS player_count
      FROM game g
      LEFT JOIN player_game pg ON g.id = pg.game_id
      WHERE g.id = ?
      GROUP BY g.id
    `, [groupId]);

    if (games.length === 0) {
      return res.status(404).json({ error: "Groupe non trouvé" });
    }

    res.json(games[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/games/:gameId/join - Rejoindre un jeu
router.post("/:gameId/join", async (req, res) => {
  const { gameId } = req.params;
  const { playerId } = req.body;

  if (!playerId) {
    return res.status(400).json({ error: "ID du joueur requis" });
  }

  try {
    // Vérifications existantes...
    const [games] = await pool.query("SELECT id FROM game WHERE id = ?", [gameId]);
    if (games.length === 0) return res.status(404).json({ error: "Jeu non trouvé" });

    const [players] = await pool.query("SELECT id FROM player WHERE id = ?", [playerId]);
    if (players.length === 0) return res.status(404).json({ error: "Joueur non trouvé" });

    const [existing] = await pool.query(
      "SELECT * FROM player_game WHERE player_id = ? AND game_id = ?",
      [playerId, gameId]
    );
    if (existing.length > 0) return res.status(400).json({ error: "Le joueur est déjà dans ce jeu" });

    const [[{ player_count }]] = await pool.query(
      "SELECT COUNT(*) AS player_count FROM player_game WHERE game_id = ?",
      [gameId]
    );
    if (player_count >= 4) return res.status(400).json({ error: "Ce groupe est complet !" });

    // Ajouter le joueur
    await pool.query(
      "INSERT INTO player_game (player_id, game_id) VALUES (?, ?)",
      [playerId, gameId]
    );

    // 🔥 Récupérer les données mises à jour du jeu
    const [[updatedGame]] = await pool.query(`
      SELECT g.*, COUNT(pg.player_id) AS player_count
      FROM game g
      LEFT JOIN player_game pg ON g.id = pg.game_id
      WHERE g.id = ?
      GROUP BY g.id
    `, [gameId]);

    // 🔥 Émettre la mise à jour à tous les clients
    req.app.locals.io.emit('game:updated', updatedGame);

    res.json({ 
      success: true, 
      message: "Joueur ajouté au groupe",
      game: updatedGame
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/games/:gameId/players - Obtenir les joueurs d'un jeu
router.get("/:gameId/players", async (req, res) => {
  const { gameId } = req.params;

  try {
    const [players] = await pool.query(
      `
      SELECT p.id, p.name
      FROM player p
      INNER JOIN player_game pg ON p.id = pg.player_id
      WHERE pg.game_id = ?
    `,
      [gameId]
    );

    res.json(players);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// DELETE /api/games/:gameId/players/:playerId - Retirer un joueur d'un jeu
router.delete("/:gameId/players/:playerId", async (req, res) => {
  const { gameId, playerId } = req.params;

  try {
    const [result] = await pool.query(
      "DELETE FROM player_game WHERE game_id = ? AND player_id = ?",
      [gameId, playerId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Joueur non trouvé dans ce jeu" });
    }

    res.json({ success: true, message: "Joueur retiré du jeu" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.put("/:gameId/ready", async (req, res) => {
  const { gameId } = req.params;
  const { playerId, ready } = req.body;

  try {
    await pool.query(
      "UPDATE player_game SET is_ready = ? WHERE player_id = ? AND game_id = ?",
      [ready, playerId, gameId]
    );

    // Récupérer les joueurs mis à jour
    const [players] = await pool.query(`
      SELECT p.id, p.name, pg.is_ready
      FROM player p
      INNER JOIN player_game pg ON p.id = pg.player_id
      WHERE pg.game_id = ?
    `, [gameId]);

    // Récupérer le compte des joueurs prêts
    const [[readyCount]] = await pool.query(
      "SELECT COUNT(*) as count FROM player_game WHERE game_id = ? AND is_ready = TRUE",
      [gameId]
    );

    // Émettre l'événement Socket.IO
    req.app.locals.io.to(`group:${gameId}`).emit('players:updated', {
      players,
      readyCount: readyCount.count
    });

    res.json({ success: true, players, readyCount: readyCount.count });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.get("/player/:playerId/membership", async (req, res) => {
  const { playerId } = req.params;

  try {
    const [groups] = await pool.query(`
      SELECT 
        g.*,
        COUNT(pg.player_id) AS player_count
      FROM game g
      INNER JOIN player_game pg ON g.id = pg.game_id
      WHERE pg.player_id = ?
      GROUP BY g.id
      LIMIT 1
    `, [playerId]);

    if (groups.length === 0) {
      return res.json({ inGroup: false });
    }

    res.json({ 
      inGroup: true, 
      game: groups[0] 
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

router.post("/:gameId/leave", async (req, res) => {
  const { gameId } = req.params;
  const { playerId } = req.body;

  try {
    const [result] = await pool.query(
      "DELETE FROM player_game WHERE game_id = ? AND player_id = ?",
      [gameId, playerId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Joueur non trouvé dans ce jeu" });
    }

    // Récupérer les données mises à jour du jeu
    const [[updatedGame]] = await pool.query(`
      SELECT g.*, COUNT(pg.player_id) AS player_count
      FROM game g
      LEFT JOIN player_game pg ON g.id = pg.game_id
      WHERE g.id = ?
      GROUP BY g.id
    `, [gameId]);

    // Émettre la mise à jour
    req.app.locals.io.emit('game:updated', updatedGame);

    res.json({ 
      success: true, 
      message: "Joueur a quitté le groupe",
      game: updatedGame
    });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
