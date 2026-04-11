const router = require('express').Router();
const { signup, login, forgotPassword } = require('../controllers/auth.controller');
router.post('/signup', signup); router.post('/login', login); router.post('/forgot-password', forgotPassword);
module.exports = router;
