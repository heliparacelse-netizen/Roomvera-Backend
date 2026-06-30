const router = require('express').Router();
const { createCheckoutSession } = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth');

// Le frontend appelle POST /api/payment/checkout
router.post('/checkout', protect, createCheckoutSession);

// NB: le webhook Stripe (/api/payment/webhook) est monte directement dans
// index.js AVANT express.json(), car il exige le corps brut (raw body).

module.exports = router;
