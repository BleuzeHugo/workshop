import express from "express";
import pool from "../../config/db.js";

const router = express.Router();

// 🧍 Créer un joueur
router.post("/", async (req, res) => {
  const { name } = req.body;
  if (!name) return res.status(400).json({ error: "Nom requis" });

  try {
    const [result] = await pool.query("INSERT INTO player (name) VALUES (?)", [name]);
    res.json({ id: result.insertId, name });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Erreur serveur" });
  }
});

export default router;
