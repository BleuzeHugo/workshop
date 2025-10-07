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
    const [result] = await pool.query(
      "INSERT INTO game (name) VALUES (?)", 
      [name]
    );
    res.json({ id: result.insertId, name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// POST /api/games/:gameId/join - Rejoindre un jeu
router.post("/:gameId/join", async (req, res) => {
  const { gameId } = req.params;
  const { playerId } = req.body;

  // Validation des IDs
  if (!playerId) {
    return res.status(400).json({ error: "ID du joueur requis" });
  }

  try {
    // Vérifier si le jeu existe
    const [games] = await pool.query(
      "SELECT id FROM game WHERE id = ?",
      [gameId]
    );

    if (games.length === 0) {
      return res.status(404).json({ error: "Jeu non trouvé" });
    }

    // Vérifier si le joueur existe
    const [players] = await pool.query(
      "SELECT id FROM player WHERE id = ?",
      [playerId]
    );

    if (players.length === 0) {
      return res.status(404).json({ error: "Joueur non trouvé" });
    }

    // Vérifier si le joueur est déjà dans ce jeu
    const [existing] = await pool.query(
      "SELECT * FROM player_game WHERE player_id = ? AND game_id = ?",
      [playerId, gameId]
    );

    if (existing.length > 0) {
      return res.status(400).json({ error: "Le joueur est déjà dans ce jeu" });
    }

    // Compter les joueurs dans le jeu
    const [[{ player_count }]] = await pool.query(
      "SELECT COUNT(*) AS player_count FROM player_game WHERE game_id = ?",
      [gameId]
    );

    if (player_count >= 4) {
      return res.status(400).json({ error: "Ce groupe est complet ! (4 joueurs maximum)" });
    }

    // Ajouter le joueur au jeu
    await pool.query(
      "INSERT INTO player_game (player_id, game_id) VALUES (?, ?)",
      [playerId, gameId]
    );

    res.json({ 
      success: true, 
      message: "Joueur ajouté au groupe",
      player_count: player_count + 1
    });

  } catch (err) {
    console.error(err);
    
    // Gestion des erreurs de clé étrangère
    if (err.code === 'ER_NO_REFERENCED_ROW') {
      return res.status(400).json({ error: "Jeu ou joueur non trouvé" });
    }
    
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// GET /api/games/:gameId/players - Obtenir les joueurs d'un jeu
router.get("/:gameId/players", async (req, res) => {
  const { gameId } = req.params;

  try {
    const [players] = await pool.query(`
      SELECT p.id, p.name
      FROM player p
      INNER JOIN player_game pg ON p.id = pg.player_id
      WHERE pg.game_id = ?
    `, [gameId]);

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

export default router;