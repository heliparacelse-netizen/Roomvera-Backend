import { Router, Request, Response, raw } from 'express';
import User from '../models/User';
import { authenticate, AuthRequest } from '../middleware/auth';

const router = Router();

const PLAN_TOKENS: Record<string, number> = {
  starter: 500,
  pro:     1500,
  studio:  5000
};

// POST /api/stripe/checkout — abonnement mensuel
router.post('/checkout', authenticate, async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { planId } = req.body;
    const stripeKey = process.env.STRIPE_SECRET_KEY;

    if (!stripeKey) {
      res.status(503).json({ error: 'Stripe non configuré. Ajoutez STRIPE_SECRET_KEY sur Render.' });
      return;
    }

    const priceIds: Record<string, string> = {
      starter: process.env.STRIPE_PRICE_STARTER ?? '',
      pro:     process.env.STRIPE_PRICE_PRO     ?? '',
      studio:  process.env.STRIPE_PRICE_STUDIO  ?? ''
    };

    if (!planId || !priceIds[planId]) {
      res.status(400).json({ error: 'Plan invalide ou Price ID non configuré' });
      return;
    }

    const Stripe = require('stripe');
    const stripe = new Stripe(stripeKey);

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'subscription',
      line_items: [{ price: priceIds[planId], quantity: 1 }],
      metadata: { userId: req.user._id.toString(), plan: planId },
      success_url: `${process.env.FRONTEND_URL}/dashboard?subscribed=true`,
      cancel_url:  `${process.env.FRONTEND_URL}/dashboard/billing`
    });

    res.json({ url: session.url });
  } catch (err: any) {
    console.error('Stripe checkout error:', err.message);
    res.status(500).json({ error: 'Création de session échouée' });
  }
});

// POST /api/stripe/webhook — événements Stripe
// Note: ce handler reçoit le raw body (configuré dans server.ts)
router.post('/webhook', async (req: Request, res: Response): Promise<void> => {
  const stripeKey     = process.env.STRIPE_SECRET_KEY;
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (!stripeKey || !webhookSecret) {
    res.json({ received: true });
    return;
  }

  try {
    const Stripe = require('stripe');
    const stripe  = new Stripe(stripeKey);
    const sig     = req.headers['stripe-signature'];
    const event   = stripe.webhooks.constructEvent(req.body, sig, webhookSecret);

    if (event.type === 'checkout.session.completed') {
      const session  = event.data.object as any;
      const { userId, tokens, plan } = session.metadata ?? {};

      if (tokens && userId) {
        await User.findByIdAndUpdate(userId, { $inc: { tokens: parseInt(tokens, 10) } });
      }
      if (plan && userId) {
        await User.findByIdAndUpdate(userId, {
          plan,
          $inc: { tokens: PLAN_TOKENS[plan] ?? 0 }
        });
      }
    }

    if (event.type === 'customer.subscription.deleted') {
      const sub = event.data.object as any;
      const userId = sub.metadata?.userId;
      if (userId) await User.findByIdAndUpdate(userId, { plan: 'free' });
    }

    res.json({ received: true });
  } catch (err: any) {
    console.error('Webhook error:', err.message);
    res.status(400).json({ error: `Webhook error: ${err.message}` });
  }
});

export default router;
