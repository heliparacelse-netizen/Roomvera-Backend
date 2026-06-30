const stripe = require('../config/stripe');
const User = require('../models/User');

exports.createCheckoutSession = async (req, res) => {
  try {
    if (!stripe) {
      return res.status(503).json({ message: 'Les paiements seront bientot disponibles' });
    }
    const planId = req.body.planId || req.body.plan;
    if (!planId) return res.status(400).json({ message: 'planId requis' });

    // STRIPE_BASIC_PRICE_ID, STRIPE_PRO_PRICE_ID, STRIPE_AGENCY_PRICE_ID
    const priceId = process.env['STRIPE_' + planId.toUpperCase() + '_PRICE_ID'];
    if (!priceId) return res.status(400).json({ message: 'Plan invalide' });

    const frontend = (process.env.FRONTEND_URL || 'http://localhost:3000').split(',')[0].trim();

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'subscription',
      success_url: frontend + '/dashboard?payment=success',
      cancel_url: frontend + '/tarifs?payment=cancel',
      client_reference_id: req.user._id.toString(),
      metadata: { plan: planId },
    });

    return res.status(200).json({ url: session.url });
  } catch (e) {
    return res.status(500).json({ message: e.message });
  }
};

exports.handleWebhook = async (req, res) => {
  if (!stripe) return res.status(503).send('Stripe non configure');
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    // req.body est ici le Buffer brut grace a express.raw() monte dans index.js
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send(`Webhook Error: ${e.message}`);
  }

  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    const plan = s.metadata.plan;
    const creditsByPlan = { basic: 50, pro: 150, agency: 100000 };
    const planNameByPlan = { basic: 'Basic', pro: 'Pro', agency: 'Agency' };
    const credits = creditsByPlan[plan] ?? 0;

    if (s.client_reference_id) {
      await User.findByIdAndUpdate(s.client_reference_id, {
        $inc: { credits },
        plan: planNameByPlan[plan] || 'Free',
      });
    }
  }

  return res.json({ received: true });
};
