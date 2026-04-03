// @ts-nocheck
import { Router, Response } from 'express';
import Groq from 'groq-sdk';
import User from '../models/User';
import { authenticate, requireTokensForChat, AuthRequest } from '../middleware/auth';

const router = Router();

// POST /api/chat
router.post(
  '/',
  authenticate,
  requireTokensForChat,
  async (req: AuthRequest, res: Response): Promise<void> => {
    const userId = req.user._id;

    try {
      const { messages } = req.body;

      if (!messages || !Array.isArray(messages)) {
        res.status(400).json({ error: 'messages[] requis' });
        return;
      }

      // ── Déduire 15 tokens AVANT l'appel Groq ──
      await User.findByIdAndUpdate(userId, { $inc: { tokens: -15 } });

      const groqKey = process.env.GROQ_API_KEY;
      if (!groqKey) {
        // Rembourser si clé manquante
        await User.findByIdAndUpdate(userId, { $inc: { tokens: 15 } });
        res.status(503).json({
          error: 'Service chat non configuré',
          reply: 'Le service de chat n\'est pas encore configuré. Réessayez plus tard.'
        });
        return;
      }

      const groq = new Groq({ apiKey: groqKey });

      // Utiliser llama-3.3-70b-versatile (PAS llama3-70b-8192 qui est déprécié)
      const completion = await groq.chat.completions.create({
        model: 'llama-3.3-70b-versatile',
        messages: [
          {
            role: 'system',
            content:
              'You are Roomvera AI, an expert interior design assistant. Help users with room redesign, furniture suggestions, style advice, color palettes, and prompt improvement. Be concise, practical, and inspiring. Respond in the same language as the user.'
          },
          ...messages
        ],
        max_tokens: 1000,
        temperature: 0.7
      });

      const reply =
        completion.choices[0]?.message?.content ??
        'Je n\'ai pas pu générer une réponse. Réessayez.';

      const freshUser = await User.findById(userId);

      res.json({
        reply,
        tokensRemaining: freshUser?.tokens ?? 0
      });
    } catch (err: any) {
      console.error('Chat error:', err.message);
      // Rembourser les 15 tokens en cas d'erreur Groq
      await User.findByIdAndUpdate(userId, { $inc: { tokens: 15 } });
      res.status(500).json({
        error: 'Chat échoué',
        reply: 'Une erreur est survenue. Vos tokens ont été remboursés. Réessayez.'
      });
    }
  }
);

export default router;
