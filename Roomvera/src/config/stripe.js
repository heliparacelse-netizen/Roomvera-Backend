const Stripe = require('stripe');

// Stripe est optionnel tant que le paiement n'est pas active.
// Sans cle, on n'instancie pas le client (evite un crash au demarrage sur Render).
const stripe = process.env.STRIPE_SECRET_KEY
  ? new Stripe(process.env.STRIPE_SECRET_KEY)
  : null;

module.exports = stripe;
