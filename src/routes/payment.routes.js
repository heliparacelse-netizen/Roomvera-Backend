const router = require('express').Router();
const { createCheckoutSession, handleWebhook } = require('../controllers/payment.controller');
const { protect } = require('../middleware/auth');
router.post('/create-checkout-session', protect, createCheckoutSession);
router.post('/webhook', require('express').raw({ type: 'application/json' }), handleWebhook);
module.exports = router;
