// @ts-nocheck
import { Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import User from '../models/User';

export interface AuthRequest extends Request {
  user?: any;
}

export const authenticate = async (req: any, res: any, next: any): Promise<void> => {
  try {
    const auth = req.headers?.authorization;
    if (!auth?.startsWith('Bearer ')) { res.status(401).json({ error: 'Token manquant' }); return; }
    const decoded: any = jwt.verify(auth.split(' ')[1], process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.id).select('-password');
    if (!user) { res.status(401).json({ error: 'Introuvable' }); return; }
    req.user = user;
    next();
  } catch { res.status(401).json({ error: 'Token invalide' }); }
};

export const requireTokensForGenerate = async (req: any, res: any, next: any): Promise<void> => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.tokens < 25) { res.status(402).json({ error: 'Tokens insuffisants', code: 'NO_TOKENS', tokensRemaining: user?.tokens || 0 }); return; }
    next();
  } catch { res.status(500).json({ error: 'Erreur tokens' }); }
};

export const requireTokensForChat = async (req: any, res: any, next: any): Promise<void> => {
  try {
    const user = await User.findById(req.user._id);
    if (!user || user.tokens < 15) { res.status(402).json({ error: 'Tokens insuffisants', code: 'NO_TOKENS', tokensRemaining: user?.tokens || 0 }); return; }
    next();
  } catch { res.status(500).json({ error: 'Erreur tokens' }); }
};
