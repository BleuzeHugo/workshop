import express from "express";
import gameRoutes from './hub/gameRoutes.js';
import playerRoutes from './hub/playerRoutes.js';

const router = express.Router();

// Montage de toutes les routes
router.use('/games', gameRoutes);
router.use('/players', playerRoutes);

// Routes de santé/api
router.get('/health', (req, res) => {
  res.json({ status: 'OK', message: 'API is running' });
});

export default router;