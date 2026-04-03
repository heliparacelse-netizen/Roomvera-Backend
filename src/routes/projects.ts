// @ts-nocheck
import { Router, Response } from 'express';
import Generation from '../models/Generation';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// GET /api/projects
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const projects = await Generation.find({ userId: req.user._id, status: 'done' })
      .sort({ createdAt: -1 })
      .limit(50);
    res.json({ projects });
  } catch {
    res.status(500).json({ error: 'Erreur lors de la récupération des projets' });
  }
});

// DELETE /api/projects/:id
router.delete('/:id', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    await Generation.findOneAndDelete({ _id: req.params.id, userId: req.user._id });
    res.json({ success: true });
  } catch {
    res.status(500).json({ error: 'Suppression échouée' });
  }
});

export default router;
