const router = require('express').Router();
const { signup, login, forgotPassword } = require('../controllers/auth.controller');

// Route modifiée pour correspondre au frontend (forgot au lieu de forgot-password)
router.post('/signup', signup);
router.post('/login', login);
router.post('/forgot', forgotPassword);

module.exports = router;
