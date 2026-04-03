import { Router, Request, Response } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/auth/register
router.post('/register', async (req: Request, res: Response): Promise<void> => {
  try {
    const { name, email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email et mot de passe requis' });
      return;
    }
    const existing = await User.findOne({ email: email.toLowerCase().trim() });
    if (existing) {
      res.status(400).json({ error: 'Email déjà utilisé' });
      return;
    }
    const user = new User({
      email: email.toLowerCase().trim(),
      password,
      name: name?.trim() || email.split('@')[0],
      tokens: 75,
      plan: 'free'
    });
    await user.save();
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );
    res.status(201).json({
      token,
      user: {
        id:     user._id,
        email:  user.email,
        name:   user.name,
        plan:   user.plan,
        tokens: user.tokens
      }
    });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Inscription échouée' });
  }
});

// POST /api/auth/login
router.post('/login', async (req: Request, res: Response): Promise<void> => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      res.status(400).json({ error: 'Email et mot de passe requis' });
      return;
    }
    const user = await User.findOne({ email: email.toLowerCase().trim() });
    if (!user || !(await user.comparePassword(password))) {
      res.status(401).json({ error: 'Email ou mot de passe incorrect' });
      return;
    }
    const token = jwt.sign(
      { id: user._id, email: user.email },
      process.env.JWT_SECRET!,
      { expiresIn: '30d' }
    );
    res.json({
      token,
      user: {
        id:     user._id,
        email:  user.email,
        name:   user.name,
        plan:   user.plan,
        tokens: user.tokens
      }
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Connexion échouée' });
  }
});

// GET /api/auth/me
router.get('/me', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    res.json({ user });
  } catch (err) {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

export default router;
