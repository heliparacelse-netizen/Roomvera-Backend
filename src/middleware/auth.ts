import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface AuthRequest extends Request {
  user?: any;
}

// Vérifie le JWT et attache req.user
export const authenticate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      res.status(401).json({ error: 'Token manquant' });
      return;
    }
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET!) as any;
    const user = await User.findById(decoded.id).select('-password');
    if (!user) {
      res.status(401).json({ error: 'Utilisateur introuvable' });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: 'Token invalide' });
  }
};

// Vérifie 25 tokens minimum pour générer
export const requireTokensForGenerate = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.tokens < 25) {
      res.status(402).json({
        error: 'Tokens insuffisants. Il faut 25 tokens pour générer.',
        code: 'NO_TOKENS',
        tokensRemaining: user?.tokens || 0
      });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: 'Vérification des tokens échouée' });
  }
};

// Vérifie 15 tokens minimum pour le chat
export const requireTokensForChat = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.tokens < 15) {
      res.status(402).json({
        error: 'Tokens insuffisants. Il faut 15 tokens pour chatter.',
        code: 'NO_TOKENS',
        tokensRemaining: user?.tokens || 0
      });
      return;
    }
    next();
  } catch {
    res.status(500).json({ error: 'Vérification des tokens échouée' });
  }
};
