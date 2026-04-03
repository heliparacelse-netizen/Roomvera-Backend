import { Router, Response } from 'express';
import Generation from '../models/Generation';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/generations
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const generations = await Generation.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(100);
    res.json({ generations });
  } catch {
    res.status(500).json({ error: 'Erreur lors de la récupération des générations' });
  }
});

// DELETE /api/generations/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const gen = await Generation.findOneAndDelete({
      _id: req.params.id,
      userId: req.user._id
    });
    if (!gen) {
      res.status(404).json({ error: 'Génération introuvable' });
      return;
    }
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Suppression échouée' });
  }
});

export default router;
