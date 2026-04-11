const router = require('express').Router();
const { createCheckoutSession, handleWebhook } = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth');

// Route modifiée pour correspondre au frontend (checkout au lieu de create-checkout-session)
router.post('/checkout', protect, createCheckoutSession);
router.post('/webhook', require('express').raw({ type: 'application/json' }), handleWebhook);

module.exports = router;
