import { Router, Response } from 'express';
import User from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

interface TokenPack {
  tokens: number;
  price: number;
  label: string;
}

const TOKEN_PACKS: Record<string, TokenPack> = {
  pack_50:   { tokens: 50,   price: 2.99,  label: '~2 redesigns' },
  pack_150:  { tokens: 150,  price: 7.99,  label: '~6 redesigns — Best Value' },
  pack_500:  { tokens: 500,  price: 19.99, label: '~20 redesigns' },
  pack_1500: { tokens: 1500, price: 49.99, label: '~60 redesigns' }
};

// GET /api/tokens
router.get('/', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const user = await User.findById(req.user._id).select('-password');
    if (!user) {
      res.status(404).json({ error: 'Utilisateur introuvable' });
      return;
    }
    res.json({
      tokens:                  user.tokens,
      plan:                    user.plan,
      redesignsRemaining:      Math.floor(user.tokens / 25),
      chatMessagesRemaining:   Math.floor(user.tokens / 15)
    });
  } catch {
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

// POST /api/tokens/buy
router.post('/buy', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { packId } = req.body;
    const pack = TOKEN_PACKS[packId];

    if (!pack) {
      res.status(400).json({ error: 'Pack invalide' });
      return;
    }

    const stripeKey = process.env.STRIPE_SECRET_KEY;
    if (!stripeKey) {
      res.status(503).json({
        error: 'Ajoutez STRIPE_SECRET_KEY dans Render Environment pour activer les paiements.'
      });
      return;
    }

    // Import dynamique de Stripe pour éviter les erreurs si clé absente
    const Stripe = require('stripe');
    const stripe = new Stripe(stripeKey);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: { name: `${pack.tokens} Roomvera Tokens — ${pack.label}` },
            unit_amount: Math.round(pack.price * 100)
          },
          quantity: 1
        }
      ],
      metadata: {
        userId: req.user._id.toString(),
        tokens: pack.tokens.toString(),
        packId
      },
      success_url: `${process.env.FRONTEND_URL}/dashboard?purchased=true`,
      cancel_url:  `${process.env.FRONTEND_URL}/dashboard/billing`
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe buy error:', err.message);
    res.status(500).json({ error: 'Création de session de paiement échouée' });
  }
});

export default router;
