import express from "express";
import pool from "../../config/db.js";
import crypto from "crypto";

const router = express.Router();

// 🧍 Créer un joueur
router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Nom requis" });

  try {
    // Générer un token unique
    const token = crypto.randomBytes(32).toString('hex');
    const tokenExpiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000); // 30 jours
    
    const [result] = await pool.query(
      "INSERT INTO player (name, token, token_expires_at) VALUES (?, ?, ?)", 
      [name, token, tokenExpiresAt]
    );
    
    const player = {
      id: result.insertId,
      name,
      token // 🔥 IMPORTANT : Renvoyer le token au frontend
    };

    res.json(player);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

// 🔥 NOUVEAU : Vérifier un token (pour la reconnexion)
router.get("/verify-token", async (req, res) => {
  const { token } = req.query;

  if (!token) {
    return res.status(400).json({ error: "Token requis" });
  }

  try {
    const [players] = await pool.query(
      "SELECT id, name, token_expires_at FROM player WHERE token = ?",
      [token]
    );

    if (players.length === 0) {
      return res.status(404).json({ error: "Token invalide" });
    }

    const player = players[0];
    
    // Vérifier si le token a expiré
    if (new Date() > new Date(player.token_expires_at)) {
      return res.status(401).json({ error: "Token expiré" });
    }

    res.json({
      id: player.id,
      name: player.name,
      token: token // Renvoyer le même token
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;