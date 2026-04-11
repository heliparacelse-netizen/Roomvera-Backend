const stripe = require('../config/stripe');
const User = require('../models/User');

exports.createCheckoutSession = async (req, res) => {
  try {
    // Le frontend envoie planId, on s'adapte
    const planId = req.body.planId || req.body.plan;
    const priceId = process.env["STRIPE_" + planId.toUpperCase() + "_PRICE_ID"];
    
    if (!priceId) return res.status(400).json({ message: 'Invalid plan' });
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{ price: priceId, quantity: 1 }],
      mode: 'payment',
      success_url: process.env.FRONTEND_URL + "/success",
      cancel_url: process.env.FRONTEND_URL + "/pricing",
      client_reference_id: req.user._id.toString(),
      metadata: { plan: planId }
    });
    
    // Format exact attendu par le frontend
    res.status(200).json({ url: session.url });
  } catch (e) {
    res.status(500).json({ message: e.message });
  }
};

exports.handleWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;
  
  try {
    event = stripe.webhooks.constructEvent(req.rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (e) {
    return res.status(400).send("Webhook Error");
  }
  
  if (event.type === 'checkout.session.completed') {
    const s = event.data.object;
    let c = s.metadata.plan === 'Basic' ? 50 : s.metadata.plan === 'Pro' ? 200 : 1000;
    await User.findByIdAndUpdate(s.client_reference_id, { $inc: { credits: c }, plan: s.metadata.plan });
  }
  
  res.json({ received: true });
};
